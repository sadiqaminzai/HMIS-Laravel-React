/** Languages the application renders right-to-left. */
export const RTL_LANGUAGES = ['ps', 'fa', 'ar', 'ur', 'he'] as const;

/**
 * True when the given i18n language code should be laid out right-to-left.
 * Accepts region-tagged codes such as `fa-AF`.
 */
export function isRtlLanguage(language?: string | null): boolean {
  const code = String(language || '').toLowerCase();
  return RTL_LANGUAGES.some((rtl) => code === rtl || code.startsWith(`${rtl}-`));
}

/** Direction string for the given language, suitable for a `dir` attribute. */
export function directionFor(language?: string | null): 'rtl' | 'ltr' {
  return isRtlLanguage(language) ? 'rtl' : 'ltr';
}
