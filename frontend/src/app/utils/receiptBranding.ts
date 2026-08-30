/**
 * The brand line every printed receipt carries.
 *
 * It was previously written out at each print surface, which is how the
 * application ended up printing "Soft Core IT Solutions", "Soft Care IT
 * Solutions", "SoftCare IT Solutions" and "ShifaaScript HMIS" on four
 * different documents from the same hospital. One constant, one spelling.
 */
export const POWERED_BY_TEXT = 'Powered by: SoftCare IT Solutions  0772 502020 | 0788 502020';

/**
 * Markup for the print surfaces that build their document as an HTML string.
 *
 * Deliberately self-contained: those documents are written into a separate
 * print window that does not always load the application stylesheet, so the
 * styling cannot rely on utility classes being present.
 */
export const poweredByHtml = (compact = false): string =>
  `<div style="text-align:center;font-style:italic;font-weight:600;font-size:${
    compact ? '9px' : '10px'
  };color:#000;margin-top:${compact ? '4px' : '8px'};">${POWERED_BY_TEXT}</div>`;

/** Inline style for the JSX print surfaces, so both paths look the same. */
export const poweredByStyle = (compact = false): React.CSSProperties => ({
  textAlign: 'center',
  fontStyle: 'italic',
  fontSize: compact ? '9px' : '10px',
  fontWeight: 600,
  color: '#000',
  marginTop: compact ? '4px' : '8px',
});
