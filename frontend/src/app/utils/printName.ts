/**
 * Names as they appear on printed documents.
 *
 * Every printed record — a lab report, a receipt, a discharge summary — puts
 * people, products and procedures in capitals. It is not decoration: staff read
 * these at a counter, often from a thermal slip, and a name in capitals is the
 * part they match against a card or a shelf label without re-reading.
 *
 * Applied at the point of printing rather than on save, so the stored value
 * keeps whatever casing was entered and exports, searches and screens are
 * unaffected. Scripts without letter case — Pashto, Dari, Arabic — pass through
 * unchanged, which is why this is safe to apply to every name.
 */
export const printName = (value?: string | number | null): string => {
  if (value === null || value === undefined) return '';
  return String(value).toUpperCase();
};

/** The same rule for a name that may be missing, with a placeholder. */
export const printNameOr = (value: string | null | undefined, fallback = '-'): string => {
  const name = printName(value).trim();
  return name === '' ? fallback : name;
};

/** CSS for print markup built as HTML strings rather than React elements. */
export const PRINT_NAME_CSS = '.print-name { text-transform: uppercase; }';
