import { Medicine, SaleUnit } from '../types';

/**
 * Naming a product, and counting it, in the terms the counter uses.
 *
 * Both jobs were being done ad hoc wherever they were needed, which is how the
 * same product came to read "ESOXIM 40MG" on one screen and "Esoxim" on
 * another, and how stock ended up shown in loose pieces on screens where the
 * pharmacy only ever handles whole packs.
 */

/**
 * Brand + strength + form: "Risek 20mg Capsules".
 *
 * The brand alone is ambiguous -- a pharmacy stocks the same brand as syrup,
 * tablet and injection, at different strengths and different prices -- so a
 * list showing only the brand cannot be counted against the shelf.
 */
export function medicineDisplayName(
  medicine?: Pick<Medicine, 'brandName' | 'strength' | 'type'> | null,
  fallback = 'Unknown'
): string {
  if (!medicine) return fallback;
  const parts = [medicine.brandName, medicine.strength, medicine.type]
    .map((part) => (part ?? '').toString().trim())
    .filter(Boolean);
  return parts.length ? parts.join(' ') : fallback;
}

/** How many base pieces one of the given unit contains. */
export function piecesPerUnit(
  medicine?: Pick<Medicine, 'packSize' | 'piecesPerStrip'> | null,
  unit: SaleUnit = 'piece'
): number {
  if (!medicine) return 1;
  if (unit === 'pack') return Math.max(1, Number(medicine.packSize ?? 1));
  if (unit === 'strip') return Math.max(1, Number(medicine.piecesPerStrip ?? 1));
  return 1;
}

/**
 * The unit this product is actually sold in.
 *
 * The configured default, unless the product does not permit it -- in which
 * case the first unit it does permit, so the answer is always sellable.
 */
export function preferredSaleUnit(
  medicine?: Pick<Medicine, 'sellableUnits' | 'defaultSaleUnit'> | null
): SaleUnit {
  const allowed = (medicine?.sellableUnits && medicine.sellableUnits.length
    ? medicine.sellableUnits
    : ['piece']) as SaleUnit[];
  const configured = (medicine?.defaultSaleUnit ?? 'piece') as SaleUnit;
  return allowed.includes(configured) ? configured : allowed[0];
}

/** What one unit is called on screen: a hospital's own label, else the unit. */
export function saleUnitLabel(
  medicine: Pick<Medicine, 'packLabel' | 'stripLabel'> | null | undefined,
  unit: SaleUnit,
  count = 1
): string {
  const custom = unit === 'pack' ? medicine?.packLabel : unit === 'strip' ? medicine?.stripLabel : '';
  const base = (custom ?? '').trim() || unit;
  // Only pluralise the generic words; a hospital's own label is left as typed.
  if (count === 1 || (custom ?? '').trim()) return base;
  return `${base}s`;
}

export interface QuantityInSaleUnit {
  /** Whole units, floored -- a part pack cannot be handed over. */
  value: number;
  /** Base pieces left over once the whole units are taken out. */
  remainderPieces: number;
  unit: SaleUnit;
  label: string;
  /** Ready to render: "12 packs" (with "+3 pieces" when it does not divide). */
  text: string;
}

/**
 * Express a piece count in the product's own selling unit.
 *
 * Stock is held in base pieces because that is the only unit every product
 * shares. It is not, however, how anyone counts a shelf: a pharmacy holding a
 * hundred and sixty-eight capsules of Risek thinks of it as twelve packs. The
 * remainder is carried rather than hidden, so the figure still reconciles.
 */
export function formatQuantityInSaleUnit(
  pieces: number,
  medicine?: Medicine | null,
  unitOverride?: SaleUnit
): QuantityInSaleUnit {
  const total = Math.max(0, Math.round(Number(pieces) || 0));
  const unit = unitOverride ?? preferredSaleUnit(medicine);
  const factor = piecesPerUnit(medicine, unit);

  const value = Math.floor(total / factor);
  const remainderPieces = total - value * factor;
  const label = saleUnitLabel(medicine, unit, value);

  let text = `${value} ${label}`;
  if (remainderPieces > 0) {
    text += ` + ${remainderPieces} ${remainderPieces === 1 ? 'piece' : 'pieces'}`;
  }

  return { value, remainderPieces, unit, label, text };
}
