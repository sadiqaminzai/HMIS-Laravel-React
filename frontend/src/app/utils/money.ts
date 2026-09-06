/**
 * Numbers and money, written the way the chosen language writes them.
 *
 * Everything used to format through a hard-coded 'en-US', so a dashboard in
 * Pashto showed Pashto labels beside Western digits and put the afghani sign
 * on the wrong side of the number in a right-to-left column.
 *
 * Intl already knows all of this -- the digits, the group and decimal marks,
 * and which side the currency sits on -- provided it is handed the right
 * locale. The numbering-system extension is explicit because the plain
 * language tag alone does not switch the digits on every engine.
 */
const LOCALES: Record<string, string> = {
  en: 'en-US',
  // Pashto maps to the Dari locale on purpose. Chrome ships no Pashto locale
  // data, so 'ps-AF' silently falls back to English and prints Western digits
  // -- verified in the browser, where Node had happily produced ۱۲۳. Pashto and
  // Dari share the same numerals and the same afghani sign, so borrowing fa-AF
  // gives Pashto readers the digits they expect on every engine.
  ps: 'fa-AF-u-nu-arabext',
  fa: 'fa-AF-u-nu-arabext',   // Dari: the same digits
  ar: 'ar-u-nu-arab',         // Arabic: Arabic-Indic (١٢٣)
};

export const localeFor = (language?: string): string =>
  LOCALES[String(language || 'en').split('-')[0]] ?? LOCALES.en;

/**
 * A money amount with its currency, placed and digited for the language.
 *
 * Falls back to a plain formatted number if the runtime rejects the currency
 * code -- a wrong-looking total is still readable, an exception is not.
 */
export const formatMoneyIn = (
  amount: number,
  currency = 'AFN',
  language?: string
): string => {
  const locale = localeFor(language);
  const code = String(currency || 'AFN').toUpperCase();

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${formatNumberIn(amount, language, 2)} ${code}`;
  }
};

/** A plain number -- counts, quantities -- in the language's own digits. */
export const formatNumberIn = (
  value: number,
  language?: string,
  fractionDigits = 0
): string =>
  new Intl.NumberFormat(localeFor(language), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number(value) || 0);
