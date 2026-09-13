<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * The lines of a multi-study receipt, priced the way the desk is allowed to.
 *
 * Shared by X-Ray (studies) and Dental (services). The two differ only in
 * column names and catalogue, passed in as $config:
 *
 *   catalogue      the catalogue model class (XrayType, DentalService)
 *   catalogueKey   the line's catalogue column (xray_type_id, dental_service_id)
 *   nameKey        the line's copied name column (study_name, service_name)
 *   feePermission  the right to type a fee (set_xray_fee, set_dental_fee)
 *   label          what one line is called in an error ("study", "service")
 *
 * THE FEE. A user holding the fee right may type any fee. Anyone else gets the
 * catalogue price -- and on an edit, a line already on the receipt keeps the
 * fee it was billed at, so correcting a patient's name cannot silently reprice
 * a bill a supervisor set. Disabling the input in the form is only a hint; this
 * is the control.
 */
trait BuildsReceiptLines
{
    /**
     * @param  Collection|null  $existingLines  the receipt's current lines, on an edit
     * @return array<int, array<string, mixed>>
     */
    protected function resolveReceiptLines(Request $request, array $config, int $hospitalId, ?Collection $existingLines = null): array
    {
        $catalogueKey = $config['catalogueKey'];
        $nameKey = $config['nameKey'];
        $items = $request->input('items');

        // A client from before multi-line receipts sends one study on the
        // header. Read as a single line, so a cached old page keeps working
        // for the minutes a deploy takes to reach every browser.
        if (!is_array($items) || $items === []) {
            $items = [[
                $catalogueKey => $request->input($catalogueKey),
                $nameKey => $request->input($nameKey),
                'fee' => $request->input('fee'),
            ]];
        }

        $user = $request->user();
        $canSetFee = $user !== null && ($user->role === 'super_admin' || $user->hasPermission($config['feePermission']));

        $catalogueIds = collect($items)->pluck($catalogueKey)->filter()->map(fn ($id) => (int) $id)->unique()->all();
        $catalogue = $catalogueIds
            ? $config['catalogue']::query()->where('hospital_id', $hospitalId)->whereIn('id', $catalogueIds)->get()->keyBy('id')
            : collect();

        $lines = [];
        $seen = [];

        foreach (array_values($items) as $index => $item) {
            $catalogueId = !empty($item[$catalogueKey]) ? (int) $item[$catalogueKey] : null;
            $entry = $catalogueId ? $catalogue->get($catalogueId) : null;

            if ($catalogueId && !$entry) {
                throw ValidationException::withMessages([
                    "items.{$index}.{$catalogueKey}" => ["The selected {$config['label']} does not belong to this hospital."],
                ]);
            }

            $name = trim((string) ($item[$nameKey] ?? '')) ?: (string) ($entry->name ?? '');

            if ($name === '') {
                throw ValidationException::withMessages([
                    "items.{$index}.{$nameKey}" => ["Every line needs a {$config['label']}."],
                ]);
            }

            // The same study or service twice on one receipt is billed twice.
            // The form's checklist cannot produce that, but an old cached page
            // or a crafted request can -- so it is refused here too. A catalogue
            // line is matched by its entry, a free-text line by its name.
            $key = $catalogueId ? 'id:' . $catalogueId : 'name:' . mb_strtolower($name);

            if (isset($seen[$key])) {
                throw ValidationException::withMessages([
                    "items.{$index}.{$catalogueKey}" => ["\"{$name}\" is already on this receipt."],
                ]);
            }

            $seen[$key] = true;

            $postedFee = $item['fee'] ?? null;

            if ($canSetFee && $postedFee !== null && $postedFee !== '') {
                $fee = (float) $postedFee;
            } else {
                $billed = $existingLines?->first(function ($line) use ($catalogueId, $catalogueKey, $nameKey, $name) {
                    return $catalogueId
                        ? (int) $line->{$catalogueKey} === $catalogueId
                        : strcasecmp((string) $line->{$nameKey}, $name) === 0;
                });

                $fee = $billed ? (float) $billed->fee : (float) ($entry->price ?? 0);
            }

            $lines[] = [
                $catalogueKey => $catalogueId,
                $nameKey => mb_substr($name, 0, 191),
                'fee' => round(max(0.0, $fee), 2),
                'sort_order' => $index,
            ];
        }

        return $lines;
    }

    /**
     * What the receipt header records about its lines.
     *
     * The header keeps a total, the first catalogue entry and every name joined,
     * so the ledger, Payment Collection and the list's search -- which all read
     * the header -- keep working without knowing lines exist.
     */
    protected function summariseReceiptLines(array $lines, string $catalogueKey, string $nameKey): array
    {
        return [
            'fee' => round(array_sum(array_column($lines, 'fee')), 2),
            $catalogueKey => $lines[0][$catalogueKey] ?? null,
            $nameKey => mb_substr(implode(', ', array_column($lines, $nameKey)), 0, 191),
        ];
    }
}
