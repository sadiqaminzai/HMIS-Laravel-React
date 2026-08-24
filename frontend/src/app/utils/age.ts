export type AgeUnit = 'year' | 'month' | 'day';

/** Single letter shown beside the number: 30 Y, 15 M, 6 D. */
const SUFFIX: Record<AgeUnit, string> = { year: 'Y', month: 'M', day: 'D' };

/** Spelled out, for documents with room for it. */
const WORD: Record<AgeUnit, [string, string]> = {
  year: ['Year', 'Years'],
  month: ['Month', 'Months'],
  day: ['Day', 'Days'],
};

const toUnit = (unit?: AgeUnit | string | null): AgeUnit =>
  unit === 'month' || unit === 'day' ? unit : 'year';

/**
 * How a patient's age is written wherever it appears.
 *
 * Age is one number plus the unit it was given in. Deliberately NOT converted:
 * a family says "fifteen months" and that is what the register, the card and
 * every printout must say. Folding it into "1 Y 3 M" discards what was actually
 * reported and makes the same child read two different ways on two screens.
 *
 * Days matter for the same reason months do -- a neonate is days old, and a
 * ward that can only count years has to round that to zero.
 *
 *   15, 'year'   ->  "15 Y"
 *   15, 'month'  ->  "15 M"
 *    6, 'day'    ->  "6 D"
 */
export const formatAge = (
  value?: number | string | null,
  unit?: AgeUnit | string | null,
  options: { compact?: boolean; fallback?: string } = {}
): string => {
  const fallback = options.fallback ?? '-';
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount) || amount <= 0) return fallback;

  const suffix = SUFFIX[toUnit(unit)];
  return options.compact ? `${amount}${suffix}` : `${amount} ${suffix}`;
};

/** The long form: "15 Months", "30 Years", "6 Days". */
export const formatAgeLong = (
  value?: number | string | null,
  unit?: AgeUnit | string | null,
  fallback = '-'
): string => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return fallback;

  const [singular, plural] = WORD[toUnit(unit)];
  return `${amount} ${amount === 1 ? singular : plural}`;
};

/** Upper bound for the number box, so a slip of the keyboard is caught. */
export const maxAgeFor = (unit?: AgeUnit | string | null): number => {
  switch (toUnit(unit)) {
    case 'day': return 365;
    case 'month': return 240;
    default: return 150;
  }
};
