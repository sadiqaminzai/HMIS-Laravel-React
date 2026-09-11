<?php

namespace App\Support;

use App\Models\TransactionDetail;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Database\Eloquent\Builder;

/**
 * What a piece of medicine cost us.
 *
 * Stock is held in PIECES while cost_price is quoted per PACK, so the two
 * cannot be multiplied directly: 10 boxes of 60 tablets at 165/box is worth
 * 1,650, not 600 x 165 = 99,000.
 *
 * The per-piece cost comes from the purchases that actually delivered the stock
 * -- SUM(net billed) / SUM(pieces received) -- rather than from the medicine's
 * current pack_size. Packaging is editable, and using today's pack_size to
 * value goods received under a different one makes the stock figure move every
 * time someone corrects a pack size. This is the same reason transaction lines
 * snapshot pack_size_snapshot.
 *
 * This lived inline in the dashboard. The Profit report needs the identical
 * number -- a "profit" that disagrees with "stock worth" about what a pack cost
 * is worse than no report at all -- so it lives here and both callers use it.
 */
class PharmacyCosting
{
    /**
     * Weighted average cost per piece, one row per medicine_id.
     *
     * Join it as a subquery: ->leftJoinSub(PharmacyCosting::unitCosts($id), 'uc', ...).
     */
    public static function unitCosts(?int $hospitalId): Builder
    {
        return TransactionDetail::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_details.trx_id')
            ->where('transactions.trx_type', 'purchase')
            ->when($hospitalId, fn ($q) => $q->where('transactions.hospital_id', $hospitalId))
            ->groupBy('transaction_details.medicine_id')
            ->selectRaw('transaction_details.medicine_id')
            // `amount` rather than qtty x price because it is net of the line
            // discount, and base_bonus is in the divisor because free goods
            // occupy stock without adding cost -- they lower the average, which
            // is what "cost of what we hold" means. Valuing them at list price
            // would report stock worth more than was ever paid.
            ->selectRaw('SUM(transaction_details.amount)'
                . ' / NULLIF(SUM(transaction_details.base_qtty + transaction_details.base_bonus), 0)'
                . ' as unit_cost');
    }

    /**
     * SQL for the per-piece cost of one medicine row, with the fallback applied.
     *
     * Medicines with no purchase history (opening balances, manual entry) have
     * no row in the subquery, so they fall back to the current cost_price
     * converted per piece.
     *
     * Expects the `uc` subquery joined and the `medicines` table in scope.
     */
    public static function unitCostExpression(string $medicinesTable = 'medicines'): string
    {
        return 'COALESCE(uc.unit_cost, COALESCE(' . $medicinesTable . '.cost_price, 0)'
            . ' / GREATEST(COALESCE(' . $medicinesTable . '.pack_size, 1), 1))';
    }

    /**
     * SQL for whether a medicine row is below its reorder level.
     *
     * min_stock is stored in PACKS and stock is held in PIECES, so the
     * threshold is converted before the comparison. A NULL min_stock means "not
     * configured", which falls back to the hospital default rather than to
     * zero -- zero would mark every unconfigured product permanently healthy.
     *
     * Out-of-stock rows are deliberately NOT low stock: they are a separate,
     * more urgent band, and lumping them together hides how much is already
     * unsellable behind a single amber number.
     */
    public static function lowStockCondition(int $defaultMinPacks, string $table = 'medicines'): string
    {
        return 'COALESCE(' . $table . '.stock, 0) > 0 AND COALESCE(' . $table . '.stock, 0) <= '
            . self::thresholdPiecesExpression($defaultMinPacks, $table);
    }

    /**
     * SQL for the reorder level of a medicine row, expressed in PIECES.
     */
    public static function thresholdPiecesExpression(int $defaultMinPacks, string $table = 'medicines'): string
    {
        return '(COALESCE(' . $table . '.min_stock, ' . (int) $defaultMinPacks . ')'
            . ' * GREATEST(COALESCE(' . $table . '.pack_size, 1), 1))';
    }
}
