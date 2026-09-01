import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { X, Phone, Mail, Printer } from 'lucide-react';
import { Hospital, Patient, Doctor, PrescriptionMedicine } from '../types';
import { instructionOptions } from '../data/mockData';
import { QRCodeSVG } from 'qrcode.react';
import { formatDate, formatVisitDate } from '../utils/date';
import { buildVerificationUrl } from '../utils/verification';
import { useSettings } from '../context/SettingsContext';
import { POWERED_BY_TEXT } from '../utils/receiptBranding';
import { printName } from '../utils/printName';

// Extended type for medicine with additional display fields
type ExtendedPrescriptionMedicine = PrescriptionMedicine & {
  genericName?: string;
  brandName?: string;
};

/**
 * The letterhead palette, derived from the hospital's configured brand colour.
 *
 * Two hospitals on one installation should not hand out identical paper, so
 * the masthead is built from Settings > Brand Colour rather than a fixed blue.
 *
 * Every stop is darkened until white text clears 4.5:1 against it. A hospital
 * is free to pick a pale yellow as its brand; the prescription still has to be
 * readable, and a patient-facing document is the wrong place to honour a colour
 * choice literally at the cost of legibility.
 */
const BRAND_FALLBACK = '#1d4ed8';

const hexToRgb = (hex: string): [number, number, number] | null => {
  const clean = hex.trim().replace(/^#/, '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};

const toHex = ([r, g, b]: [number, number, number]) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

const relativeLuminance = ([r, g, b]: [number, number, number]) => {
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const contrastWithWhite = (rgb: [number, number, number]) => 1.05 / (relativeLuminance(rgb) + 0.05);

/** Mix toward black (amount < 0) or white (amount > 0). */
const mix = (rgb: [number, number, number], amount: number): [number, number, number] => {
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  return rgb.map((c) => c + (target - c) * t) as [number, number, number];
};

/** Darken until white text on it clears the AA threshold for small text. */
const ensureReadable = (rgb: [number, number, number]): [number, number, number] => {
  let out = rgb;
  for (let i = 0; i < 20 && contrastWithWhite(out) < 4.5; i += 1) {
    out = mix(out, -0.08);
  }
  return out;
};

const buildBrandPalette = (brandColor?: string) => {
  const base = hexToRgb(brandColor || '') ?? hexToRgb(BRAND_FALLBACK)!;
  const mid = ensureReadable(base);
  // Bright-to-dark across the band, as asked: a deeper shade of the brand on
  // the left, the brand itself in the middle, a lifted tone on the right.
  const dark = ensureReadable(mix(mid, -0.35));
  const light = ensureReadable(mix(mid, 0.22));
  return {
    dark: toHex(dark),
    mid: toHex(mid),
    light: toHex(light),
    // Strip: a wash of the brand with brand-dark text on it.
    strip: toHex(mix(mid, 0.86)),
    stripText: toHex(mix(mid, -0.45)),
    // The body watermark, as a SOLID light tint rather than a low opacity.
    // At 5% alpha the mark composited to roughly #f7f5fb, which printers
    // simply do not lay ink down for -- it showed on screen and vanished on
    // paper. A real colour prints predictably.
    watermark: toHex(mix(mid, 0.87)),
  };
};

interface PrescriptionPrintProps {
  hospital: Hospital;
  patient: Patient;
  doctor: Doctor;
  medicines: ExtendedPrescriptionMedicine[];
  advice: string;
  prescriptionNumber: string;
  diagnosis?: string;
  prescriptionDate?: Date;
  nextVisit?: Date | null;
  onClose: () => void;
  viewOnly?: boolean;
  embedded?: boolean;
  verificationToken?: string;
  // Audit fields
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
}


/**
 * A letterhead headline that always occupies exactly one line.
 *
 * Hospital and doctor names vary from "SHC" to "HABIB-AL-SHIFA HEALTH CENTER",
 * and a fixed type size cannot serve both: the long ones wrapped to two lines
 * and pushed the band out of shape. This measures the rendered text and steps
 * the size down until it fits, so a short name keeps the full display size and
 * a long one shrinks instead of wrapping.
 *
 * A component rather than a hook because the letterhead is rendered twice --
 * once per page -- and each copy has to measure itself.
 */
function FitHeadline({
  text,
  max,
  min,
  className = '',
  style,
}: {
  text: string;
  max: number;
  min: number;
  className?: string;
  /** The brand colour is per-hospital, so it cannot be a utility class. */
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      // Before the flex column has been laid out the width reads 0, and every
      // size "overflows" -- the loop would bottom out at the minimum and stay
      // there. Wait for a real width instead.
      if (!el.clientWidth) return;
      // The true width of the text, which scrollWidth cannot give: with hidden
      // overflow it is clamped to clientWidth and so never reports the text as
      // narrower than its box. A range over the contents measures the text
      // itself, which is what has to be compared against the space available.
      const textWidth = () => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return range.getBoundingClientRect().width;
      };

      // Aim a little under the box. The printed sheet is a different width
      // from the modal this is measured in, so a size that exactly fills one
      // can overflow the other -- which is how the tail of a long hospital
      // name went missing on paper.
      const room = el.clientWidth - 8;
      let size = max;
      el.style.fontSize = `${size}px`;
      let guard = 0;
      while (size > min && textWidth() > room && guard < 240) {
        size -= 0.5;
        guard += 1;
        el.style.fontSize = `${size}px`;
      }
    };

    fit();
    // Layout and font loading both settle after this effect: measure again.
    const frame = requestAnimationFrame(fit);
    document.fonts?.ready.then(fit).catch(() => {});

    // The column is flex-sized, so its width settles after the first paint and
    // changes again on a window resize. Width only: re-fitting on the height
    // change that fitting itself causes would loop.
    const parent = el.parentElement;
    if (!parent || typeof ResizeObserver === 'undefined') {
      return () => cancelAnimationFrame(frame);
    }
    let lastWidth = parent.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const width = parent.getBoundingClientRect().width;
      if (Math.abs(width - lastWidth) < 0.5) return;
      lastWidth = width;
      fit();
    });
    observer.observe(parent);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [text, max, min]);

  return (
    <div ref={ref} className={`rx-headline ${className}`} style={style}>
      {text}
    </div>
  );
}

export function PrescriptionPrint({
  hospital,
  patient,
  doctor,
  medicines,
  advice,
  prescriptionNumber,
  diagnosis = '',
  prescriptionDate = new Date(),
  nextVisit = null,
  onClose,
  viewOnly = false,
  embedded = false,
  verificationToken,
  createdBy,
  updatedAt,
  updatedBy
}: PrescriptionPrintProps) {
  const componentRef = useRef<HTMLDivElement>(null);
  const { loadHospitalSetting, getPrescriptionPrintAssetSettings, getShowPrescriptionListMeta, getPrescriptionWatermark } = useSettings();

  useEffect(() => {
    if (!hospital?.id) return;
    loadHospitalSetting(hospital.id).catch(() => {
      // Use fallback defaults from SettingsContext when load fails
    });
  }, [hospital?.id, loadHospitalSetting]);

  // A hospital whose logo file has gone missing printed the broken-image icon
  // and the words "Hospital Logo" onto a patient's prescription. The mark is a
  // better answer than a broken asset.
  const [logoFailed, setLogoFailed] = useState(false);
  // Falls back to the drawn mark when the artwork has not been dropped into
  // public/, so the prescription never prints a broken image.
  const [watermarkFailed, setWatermarkFailed] = useState(false);
  const brand = React.useMemo(() => buildBrandPalette(hospital.brandColor), [hospital.brandColor]);

  const printAssetSettings = getPrescriptionPrintAssetSettings(hospital.id);
  const showPrescriptionListMeta = getShowPrescriptionListMeta(hospital.id);
  const logoWidthPx = printAssetSettings.logoWidth || 176;
  const logoHeightPx = printAssetSettings.logoHeight || 160;
  const signatureWidthPx = printAssetSettings.signatureWidth || 200;
  const signatureHeightPx = printAssetSettings.signatureHeight || 112;

  const resolveAssetUrl = (path?: string | null): string => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace('/api', '');
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const withStorage = normalized.startsWith('/storage/') ? normalized : `/storage${normalized}`;
    return `${base}${withStorage}`;
  };

  const formatMedicineForPrint = (med: ExtendedPrescriptionMedicine) => {
    // New Format: Medicine Type + Brand Name + (Generic Name) + Strength
    const brandName = med.brandName || med.medicineName || '';
    const genericName = med.genericName || '';
    const type = (med.type || '').trim();
    const strength = (med.strength || '').trim();

    // Start with type
    let displayName = type;

    // Add Brand Name
    if (brandName && !displayName.toLowerCase().includes(brandName.toLowerCase())) {
        displayName += ` ${brandName}`;
    }

    // Add generic name in parentheses
    if (genericName && !displayName.toLowerCase().includes(genericName.toLowerCase())) {
      displayName += ` (${genericName})`;
    }

    // Add strength
    if (strength && !displayName.toLowerCase().includes(strength.toLowerCase())) {
      displayName += ` ${strength}`;
    }

    // Printed in capitals like every other name on a hospital document.
    return printName(displayName.replace(/\s+/g, ' ').trim());
  };

  const waitForPrintImages = async () => {
    const root = componentRef.current;
    if (!root) return;

    const images = Array.from(root.querySelectorAll('img'));
    if (!images.length) return;

    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }

            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          })
      )
    );
  };

  /**
   * The watermark, as configured in Settings > Prescription.
   *
   * Three sources: the bundled stethoscope, the hospital's own logo, or an
   * image uploaded for the purpose. A logo is rarely square, so only the width
   * is set and the height follows the image -- forcing both squashed logos.
   */
  const watermarkSetting = getPrescriptionWatermark(hospital.id);
  // null means "use the drawn mark below". The stethoscope has always been the
  // inline SVG -- the PNG this used to request does not exist, so every render
  // fired a 404 and arrived at the SVG through the error handler anyway.
  const watermarkSrc = (() => {
    if (watermarkSetting.source === 'custom') return watermarkSetting.url;
    if (watermarkSetting.source === 'logo') {
      return hospital.logo ? resolveAssetUrl(hospital.logo) : null;
    }
    return null;
  })();
  // A source that resolves to nothing (logo chosen, none uploaded) falls back
  // to the drawn stethoscope rather than printing a broken image.
  const watermarkWidth = watermarkSetting.width;
  // Gap between the foot of the mark and the top of the footer. Upright there
  // is no rotation overhang to allow for, so this is a plain margin rather
  // than the size-scaled clearance the tilted version needed.
  const watermarkClearance = 24;
  const showWatermark = watermarkSetting.enabled;

  // One broken image must not condemn the next one chosen: clear the failure
  // whenever the source changes, or picking a good image after a bad one would
  // keep showing the drawn fallback until the page reloads.
  useEffect(() => {
    setWatermarkFailed(false);
  }, [watermarkSrc]);

  const pageStyle = `
    @page {
      size: A4;
      margin: 0;
    }

    body {
      visibility: hidden;
      background-color: white;
      margin: 0;
      padding: 0;
    }

    #prescription-print-content {
      visibility: visible;
      position: relative;
      width: 100%;
      /* A full sheet, not just as tall as the content. The body grid grows into
         the slack, so the divider between the notes and the prescription runs
         the length of the page instead of stopping halfway down and leaving
         the rest blank. Content longer than a page still overflows onto the
         next one -- this is a minimum, not a fixed height. */
      min-height: 297mm;
      height: auto;
      /* 6mm all round. The old 30mm bottom was a reservation for a footer
         taken out of the flow -- and it was wrong: that footer is 47mm tall,
         so the last 17mm of the body ran underneath it. The footer flows now,
         so it occupies its own real height and nothing has to be guessed. */
      padding: 6mm 8mm 6mm 8mm !important;
      margin: 0;
      background: white;
      box-sizing: border-box !important;
      z-index: 9999;
      overflow: visible;
      /* A flex column, matching the preview. As a block, nothing inside could
         claim the page's spare height: the body ended at its content and the
         next-visit row sat wherever the medicines happened to stop, halfway up
         a mostly empty sheet. The columns inside are still laid out with
         floats -- only this outer box changes. */
      display: flex !important;
      flex-direction: column !important;
    }

    /* The heading used to sit on a coloured strip, so print forced it white.
       It now stands on the white sheet above the table, and white on white is
       why "Prescribed Medicines" appeared in the preview but not on paper.
       The colours come from the element's own inline brand styling. */
    #prescription-print-content .prescribed-medicines-header {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #prescription-print-content .prescribed-medicines-count {
      color: #9ca3af !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    #prescription-print-content * {
      visibility: visible;
    }

    /* In the flow, not fixed to the page bottom. Fixing it meant the sheet had
       to reserve space by guessing its height, and the guess was 17mm short --
       which is why the next-visit row disappeared behind the signature block
       and the divider ran on past the rule above the QR. In flow it takes the
       height it actually needs, and the body above it grows into whatever is
       left, which puts the footer at the foot of the page anyway. */
    #print-footer {
      visibility: visible !important;
      display: block !important;
      position: static !important;
      background: white;
      break-inside: avoid;
      page-break-inside: avoid;
      page-break-before: avoid;
    }

    #prescription-print-content .grid.grid-cols-1.sm\\:grid-cols-2 {
      margin-bottom: 12px !important;
      gap: 10px !important;
    }

    #prescription-print-content .grid.grid-cols-1.sm\\:grid-cols-2 > div {
      padding: 10px !important;
    }

    #prescription-print-content table th,
    #prescription-print-content table td {
      padding-top: 2px !important;
      padding-bottom: 2px !important;
    }

    #prescription-print-content thead {
      display: table-header-group;
    }

    #prescription-print-content tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    #print-signatures {
      display: flex !important;
      justify-content: space-between !important;
      align-items: flex-end !important;
      width: 100% !important;
      visibility: visible !important;
      page-break-inside: avoid;
      break-inside: avoid;
      padding-top: 0 !important;
      gap: 8px !important;
    }

    /* Flex, not the block-with-floats this used to be. A float has no height
       of its own, so the notes column -- and the rule down its edge -- stopped
       where its text ended instead of running the drop of the page. Flex
       children stretch, which is the whole point here. Safe against
       pagination: the first page's list is capped at FIRST_PAGE_MEDICINE_LIMIT
       and the rest is moved to its own page, so this row never has to break. */
    #prescription-print-content .print-content-grow {
      display: flex !important;
      flex-direction: row !important;
      align-items: stretch !important;
      break-inside: auto;
      page-break-inside: auto;
    }

    #prescription-print-content .print-content-grow > div {
      page-break-inside: auto;
      break-inside: auto;
    }

    #prescription-print-content .print-content-grow > div:first-child {
      float: none !important;
      flex: 0 0 30% !important;
      width: 30% !important;
      max-width: 30% !important;
    }

    #prescription-print-content .print-content-grow > div:last-child {
      float: none !important;
      flex: 1 1 auto !important;
      width: 70% !important;
      max-width: 70% !important;
      margin-bottom: 4mm !important;
    }

    #prescription-print-content .print-content-grow::after {
      content: "";
      display: block;
      clear: both;
    }

    #print-footer svg {
      visibility: visible !important;
      display: block !important;
      width: 64px !important;
      height: 64px !important;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    #print-footer img {
      visibility: visible !important;
      display: block !important;
      max-height: none !important;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    #print-footer p {
      margin: 0 !important;
      line-height: 1.1 !important;
    }

    #prescription-print-content .print-page-break {
      break-before: page;
      page-break-before: always;
      margin-top: 8mm !important;
    }

    /* The band's colours are set inline from the hospital's brand, so the
       print sheet only has to stop the browser dropping them. */
    #prescription-print-content .rx-watermark {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    }

    /* Flex, and kept separate from the watermark above: the masthead centres
       its contents in a band twice its old height, and a shared display:block
       would flatten that -- the same way it once flattened the title strip. */
    /* On paper the headline may wrap. It is measured against the on-screen
       sheet, and A4 is not that width -- without this the overflow is clipped
       and the end of the name simply does not print. */
    #prescription-print-content .rx-headline {
      white-space: normal !important;
      overflow: visible !important;
    }

    #prescription-print-content .rx-next-visit {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    #prescription-print-content .rx-body-grid {
      grid-template-rows: 1fr !important;
    }

    /* The print sheet lays the body out with floats, not grid -- the 30/70 pair
       above. This row has to match them exactly, or its tinted half stops at a
       different width from the panel it continues. */
    /* Stays a flex column on paper. Forcing it to block (an earlier attempt at
       fixing the float layout) is what stopped it growing, so the body ended at
       its content and left the lower half of the sheet empty. */
    #prescription-print-content .rx-body-wrap {
      display: flex !important;
      flex-direction: column !important;
    }

    /* Block, so the 30/70 floats inside still work -- but a flex item, so it
       takes the slack and pushes the next-visit row to the foot of the page. */
    #prescription-print-content .print-content-grow {
      flex: 1 1 auto !important;
    }



    #prescription-print-content .rx-nv-row { display: block !important; }
    #prescription-print-content .rx-nv-row > div:first-child {
      float: left !important;
      width: 30% !important;
      max-width: 30% !important;
      padding-right: 12px !important;
    }
    #prescription-print-content .rx-nv-row > div:last-child {
      float: right !important;
      width: 70% !important;
      max-width: 70% !important;
    }
    #prescription-print-content .rx-nv-row::after {
      content: "";
      display: block;
      clear: both;
    }

    #prescription-print-content .rx-notes-foot {
      background: rgba(0, 0, 0, 0.018) !important;
      border-right: 2px solid ${brand.light} !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    #prescription-print-content .rx-notes {
      background: rgba(0, 0, 0, 0.018) !important;
      border-right: 2px solid ${brand.light} !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    #prescription-print-content .rx-mark { font-size: 26px !important; }
    #prescription-print-content .rx-scripts-head { margin-bottom: 12px !important; }

    /* styles/print.css carries an app-wide "th, td { border: 1px solid }" for
       every printable module, and on paper it was drawing the column rules
       this table is designed without. Cleared here for this table only -- the
       lab report and the invoices still want their grid. The row rules are
       then put back, bottom edges only. */
    #prescription-print-content .rx-med-table th,
    #prescription-print-content .rx-med-table td {
      border: 0 !important;
    }
    #prescription-print-content .rx-med-table { font-size: 11px !important; }
    #prescription-print-content .rx-med-table thead th {
      padding: 0 6px 5px !important;
      font-size: 9px !important;
      font-weight: 700 !important;
      letter-spacing: 0.1em !important;
      text-transform: uppercase !important;
      color: #9ca3af !important;
      border-bottom: 1px solid #d1d5db !important;
    }
    #prescription-print-content .rx-med-table tbody td {
      padding: 6px !important;
      vertical-align: top !important;
      border-bottom: 1px dotted #cbd5e1 !important;
    }
    #prescription-print-content .rx-med-table tbody tr:last-child td {
      border-bottom: 0 !important;
    }
    #prescription-print-content .rx-med-table .rx-med-group td {
      padding-top: 9px !important;
      border-bottom: 1px solid #e5e7eb !important;
      color: ${brand.stripText} !important;
    }

    /* The patient row's cells are spans, not table cells, so the app-wide rule
       above misses them -- but their layout lives in the component's own style
       block, which is not guaranteed to reach the print document. Repeated. */
    #prescription-print-content .rx-patient-line .rx-cell {
      display: flex !important;
      flex-direction: column !important;
      gap: 1px !important;
      padding: 4px 10px !important;
      border-right: 1px solid rgba(0, 0, 0, 0.08) !important;
    }
    #prescription-print-content .rx-patient-line .rx-cell:last-child {
      border-right: 0 !important;
    }
    #prescription-print-content .rx-patient-line .rx-cell-label {
      font-size: 8px !important;
      font-weight: 700 !important;
      letter-spacing: 0.14em !important;
      text-transform: uppercase !important;
      line-height: 1 !important;
    }
    #prescription-print-content .rx-patient-line .rx-cell-value {
      font-size: 11.5px !important;
      line-height: 1.25 !important;
      color: #111827 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }

    /* The condensed face for the two fitted names. */
    #prescription-print-content .rx-headline {
      font-family: 'Bahnschrift', 'Segoe UI Variable Display', 'Segoe UI',
                   'Roboto Condensed', 'Helvetica Neue', 'Arial Narrow',
                   system-ui, sans-serif !important;
      font-stretch: 87.5% !important;
      font-variation-settings: 'wdth' 87.5 !important;
      letter-spacing: 0.005em !important;
    }

    #prescription-print-content .rx-topband,
    #prescription-print-content .rx-footband {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      visibility: visible !important;
      opacity: 1 !important;
      overflow: hidden !important;
    }

    #prescription-print-content .rx-footband {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }

    /* The attribution sat high in the band because the browser's default
       paragraph margins survived into the print document and pushed it off
       centre. Zeroed, so align-items actually centres it. */
    #prescription-print-content .rx-footband p {
      margin: 0 !important;
      line-height: 1 !important;
      width: 100% !important;
    }

    #prescription-print-content .rx-topband {
      display: block !important;
      height: 48px !important;
      position: relative !important;
    }

    #prescription-print-content .rx-headrow {
      background: #fff !important;
      display: block !important;
    }

    /* The closing band reaches the paper edge on three sides, mirroring the
       letterhead. #print-footer is fixed inside the 8mm side / 6mm bottom
       print margins, so the band steps back out through them. */
    #prescription-print-content .rx-footband {
      margin-left: -8mm !important;
      margin-right: -8mm !important;
      margin-bottom: -6mm !important;
      margin-top: 4px !important;
      min-height: 48px !important;
      justify-content: center !important;
    }

    #prescription-print-content .rx-stripes {
      display: flex !important;
      visibility: visible !important;
      position: absolute !important;
      gap: 7px !important;
      height: 48px !important;
    }
    #prescription-print-content .rx-stripes i {
      display: block !important;
      width: 26px !important;
      height: 100% !important;
      background: #fff !important;
      transform: skewX(-22deg) !important;
    }
    #prescription-print-content .rx-stripes-head {
      top: 0 !important;
      right: 90px !important;
    }
    #prescription-print-content .rx-stripes-foot {
      bottom: 0 !important;
      left: 90px !important;
      align-items: flex-end !important;
    }
    #prescription-print-content .rx-stripes-foot i { transform: skewX(22deg) !important; }

    #prescription-print-content .rx-stripes i,
    #prescription-print-content .rx-wedge {
      display: block !important;
      visibility: visible !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Repeated for the print document, which does not inherit the component's
       own <style> block. Without it the mark printed tiny. */
    #prescription-print-content .rx-watermark svg,
    #prescription-print-content .rx-watermark img {
      width: ${watermarkWidth}px !important;
      height: auto !important;
      display: block !important;
    }
    /* The drawn fallback carries no intrinsic ratio, so it needs both. */
    #prescription-print-content .rx-watermark svg { height: ${watermarkWidth}px !important; }

    /* Flex, not block. This rule used to be shared with the watermark above,
       whose display: block collapsed the strip's justify-between -- so Rx and
       ID printed jammed against the title instead of out on the right. */
    #prescription-print-content .rx-title-strip {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      visibility: visible !important;
      opacity: 1 !important;
    }

    /* Matches the sheet's own print padding (6mm top, 8mm sides) so the
       masthead reaches the paper edge on all three sides. */
    #prescription-print-content .rx-letterhead-bleed {
      margin-top: -6mm !important;
      margin-left: -8mm !important;
      margin-right: -8mm !important;
    }

    #prescription-print-content .rx-letterhead-bleed .rx-topband,
    #prescription-print-content .rx-letterhead-bleed .rx-headrow {
      border-radius: 0 !important;
    }

    #prescription-print-content .rx-print-logo {
      width: ${logoWidthPx}px !important;
      height: ${logoHeightPx}px !important;
      object-fit: contain !important;
    }

    #prescription-print-content .rx-print-signature {
      width: ${signatureWidthPx}px !important;
      height: ${signatureHeightPx}px !important;
      object-fit: contain !important;
    }

    .rx-info-grid > div {
      padding: 2px 4px;
    }

    .print-hide {
      display: none !important;
      visibility: hidden !important;
    }
  `;

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    onBeforePrint: waitForPrintImages,
    pageStyle,
  });

  const getInstructionLabel = (value: string) => {
    return instructionOptions.find(opt => opt.value === value)?.label || value;
  };

  const FIRST_PAGE_MEDICINE_LIMIT = 17;
  const firstPageMedicines = medicines.slice(0, FIRST_PAGE_MEDICINE_LIMIT);
  const remainingMedicines = medicines.slice(FIRST_PAGE_MEDICINE_LIMIT);

  const renderMedicineRows = (rows: ExtendedPrescriptionMedicine[], startIndex = 0) => {
    const renderedRows: React.ReactNode[] = [];

    rows.forEach((med, index) => {
      const previousMedicine = index > 0 ? rows[index - 1] : null;
      const startsNewGroup = Boolean(med.groupKey) && med.groupKey !== previousMedicine?.groupKey;

      if (startsNewGroup) {
        renderedRows.push(
          <tr key={`group-${startIndex}-${index}`} className="rx-med-group">
            <td colSpan={5} className="text-[10px] font-semibold uppercase tracking-wide">
              {med.groupLabel || 'Treatment Set'}
            </td>
          </tr>
        );
      }

      // Transparent, not white: the zebra fill was opaque and hid the
      // watermark behind the table completely. The rule between rows is
      // enough to follow a line across.
      renderedRows.push(
        <tr key={`${startIndex}-${index}`}>
          <td className="font-medium break-words">
            {formatMedicineForPrint(med)}
          </td>
          <td className="whitespace-nowrap font-semibold" style={{ color: brand.stripText }}>
            {med.dose}
          </td>
          <td className="whitespace-nowrap">{med.duration}</td>
          <td
            className="text-gray-600 whitespace-pre-wrap break-words"
            title={getInstructionLabel(med.instruction)}
          >
            {getInstructionLabel(med.instruction)}
          </td>
          <td className="text-center font-medium">{med.quantity ?? '-'}</td>
        </tr>
      );
    });

    return renderedRows;
  };

  /**
   * The letterhead.
   *
   * Modelled on a printed prescription pad rather than a web page: a coloured
   * masthead carrying the practice's identity, the prescriber's credentials on
   * the left where a reader looks first, and the clinic's contact details on
   * the right. The plain black-on-white title and rule it replaces gave a
   * patient-facing document the look of an internal report.
   *
   * Colour is safe here -- the print stylesheet already sets
   * print-color-adjust: exact, so the band prints as it appears.
   */
  const renderHospitalHeader = (extraClassName = 'mb-2') => (
    // rx-letterhead-bleed pulls the band out through the sheet's own padding so
    // it meets the paper at the top and both sides, the way a printed pad's
    // masthead does. The body below keeps its margins.
    <div className={`rx-letterhead rx-letterhead-bleed ${extraClassName}`}>

      {/* Row 1: a shallow coloured band carrying nothing but the corner
          geometry. Holding the colour here rather than behind the details
          means the names below get the full width of the sheet at full
          contrast -- on the coloured band they were competing with it for
          both space and legibility. */}
      <div
        className="rx-topband relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${brand.dark} 0%, ${brand.mid} 60%, ${brand.light} 100%)` }}
      >
        {/* Three, in white: on the darker band a white bar reads as a cut
            through the colour, which is the effect the printed pad has. Four
            dark ones on a dark field barely showed. */}
        <span className="rx-stripes rx-stripes-head" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>

      {/* Row 2: the details, on plain white. */}
      <div className="rx-headrow px-6 py-3">
        <div className="flex items-center justify-between gap-5">

          {/* Practice, left. */}
          <div className="min-w-0 flex-[1.35]">
            <FitHeadline
              text={hospital.name}
              max={27}
              min={13}
              className="font-extrabold uppercase leading-tight"
              style={{ color: brand.dark }}
            />
            {/* Two behaviours, chosen by what was typed. Line breaks entered on
                the hospital form are the author's own layout, so they are kept
                verbatim. A single long line instead shrinks to fit rather than
                wrapping or being cut -- a truncated address is not an address,
                and these run long in Pashto. */}
            {hospital.address && (
              hospital.address.includes(String.fromCharCode(10)) ? (
                <div className="mt-0.5 whitespace-pre-line break-words text-[11px] leading-snug text-gray-600">
                  {hospital.address}
                </div>
              ) : (
                <FitHeadline
                  text={hospital.address}
                  max={12}
                  min={8}
                  className="mt-0.5 leading-snug text-gray-600"
                />
              )
            )}
            {/* Flush with the name above: there is no longer a wedge behind
                them to clear, so an indent would only break the left edge the
                block reads down. */}
            <div className="rx-contacts mt-1.5 flex flex-col items-start gap-1 text-[13px] font-medium text-gray-700">
              {hospital.phone && (
                <span className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: brand.mid }} />
                  {hospital.phone}
                </span>
              )}
              {hospital.email && (
                <span className="flex items-center gap-2 break-all">
                  <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: brand.mid }} />
                  {hospital.email}
                </span>
              )}
            </div>
          </div>

          {/* Logo, centre. No light chip behind it any more -- the row is white,
              so a logo of either tone reads on it directly. */}
          <div className="flex shrink-0 items-center">
            {hospital.logo && !logoFailed ? (
              <img
                src={resolveAssetUrl(hospital.logo)}
                alt=""
                onError={() => setLogoFailed(true)}
                /* Size comes from Settings > Printing via .rx-print-logo. */
                className="rx-print-logo"
                loading="eager"
                decoding="sync"
              />
            ) : (
              <span
                className="flex h-16 w-16 items-center justify-center rounded-md text-3xl font-bold leading-none"
                style={{ color: brand.mid, border: `2px solid ${brand.light}` }}
              >
                ℞
              </span>
            )}
          </div>

          {/* Prescriber, right. */}
          <div className="min-w-0 flex-1 text-right">
            <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              Prescribed by
            </div>
            {/* Shrinks rather than wrapping: the name is never abbreviated,
                but "DR. HABIBA HABIB ADIL" no longer takes two lines. */}
            <FitHeadline
              text={printName(doctor.name)}
              max={24}
              min={13}
              className="font-bold leading-tight"
              style={{ color: brand.dark }}
            />
            {/* Wraps rather than truncating: a doctor's qualifications run to a
                full line or two ("MBBS MD RMP Kabul MUSP Ultrasound Specialist
                ...") and an ellipsis on a letterhead loses the part that
                establishes their standing. whitespace-pre-line keeps the line
                breaks typed into the field. */}
            {doctor.specialization && (
              <div className="mt-0.5 whitespace-pre-line break-words text-[11.5px] leading-snug text-gray-600">
                {doctor.specialization}
              </div>
            )}
            {doctor.registrationNumber && (
              <div className="mt-0.5 text-[10.5px] text-gray-500">Reg. No {doctor.registrationNumber}</div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: the coloured rule that closes the letterhead and announces the
          document. Doubles as the separator between the practice's identity
          above and the patient's details below. */}
      <div
        className="rx-title-strip flex items-center justify-between px-6 py-1.5"
        style={{ background: `linear-gradient(90deg, ${brand.dark} 0%, ${brand.mid} 70%, ${brand.light} 100%)` }}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white">
          Patient Prescription
        </span>
        {/* Rx # moved here from the doctor panel that this design removes.
            The Prescription List Visibility switch governs the whole pair: with
            it off the Rx number goes too, not just the patient ID. Leaving the
            Rx behind meant a clinic that had chosen to print no reference
            numbers still got one. */}
        {showPrescriptionListMeta && (
          <span className="text-[10px] font-semibold text-white">
            Rx # <span className="font-mono font-bold">{prescriptionNumber}</span>
            {patient.patientId ? ` \u00b7 ID ${patient.patientId}` : ''}
          </span>
        )}
      </div>
    </div>
  );

  // QR Data
  const qrData = JSON.stringify({
    prescriptionNumber,
    hospitalCode: hospital.code,
    patientId: patient.patientId,
    doctorId: doctor.id,
    date: prescriptionDate.toISOString(),
    nextVisit: nextVisit ? nextVisit.toISOString() : null,
    medicineCount: medicines.length
  });
  const verificationUrl = buildVerificationUrl('prescription', verificationToken);
  const qrValue = verificationUrl || qrData;

  return (
    <div
      className={
        embedded
          ? 'min-h-screen bg-white dark:bg-gray-900 py-4 px-3 sm:py-6 sm:px-4'
          : 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm'
      }
    >
      {/* Robust Print Styles */}
      <style>
        {`
          /* These live in the component's own <style>, not in the react-to-print
             page style, so they apply to the preview as well. The masthead
             previously rendered flat white on screen and coloured only on
             paper, which made the preview useless for checking it. */
          /* A condensed face for the two names, so a long one fits at a size
             worth reading. Arial Narrow ships with Windows and Office and is
             what the clinic's own printer will have; the rest of the stack
             covers Linux and mobile. No webfont -- the letterhead has to render
             identically with no network. */
          /* Last resort only: at the minimum size a name that still does not
             fit wraps rather than being cut off. A second line is untidy; a
             half-printed hospital name is wrong. */
          .rx-headline { text-overflow: clip; }

          .rx-headline {
            /* Bahnschrift: the DIN-derived variable face Windows ships with,
               so it is already on the clinic's machines and its printers with
               no webfont to download. Modern and narrow where Arial Narrow was
               merely narrow. The rest of the stack covers macOS, Linux and
               mobile before falling back to the old condensed choices. */
            font-family: 'Bahnschrift', 'Segoe UI Variable Display', 'Segoe UI',
                         'Roboto Condensed', 'Helvetica Neue', 'Arial Narrow',
                         system-ui, sans-serif;
            font-stretch: 87.5%;
            font-variation-settings: 'wdth' 87.5;
            letter-spacing: 0.005em;
            white-space: nowrap;
            overflow: hidden;
          }

          .rx-topband,
          .rx-patient-line,
          .rx-title-strip,
          .rx-footband,
          .rx-stripes i,
          .rx-wedge {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* The colour band is now a rule across the top rather than the field
             the details sit on. Tall enough to carry the corner bars and read
             as a deliberate masthead, short enough that it does not eat the
             page. */
          .rx-topband { height: 48px; }

          /* The details row: white, so the names have the sheet's full
             contrast and the whole width of the page to fit on one line. */
          .rx-headrow { background: #fff; }

          /* The slanted bars. Four of them, parallel, running off the top edge
             so they read as a corner treatment rather than four floating
             rectangles. */
          .rx-stripes {
            position: absolute;
            display: flex;
            gap: 7px;
            pointer-events: none;
          }
          /* 100%, not 150%: the bars used to run a half-height past their own
             box and finish behind the prescriber's name. They stop above it. */
          .rx-stripes i {
            display: block;
            width: 26px;
            height: 100%;
            background: #fff;
            transform: skewX(-22deg);
          }
          /* Set well in from the paper edge rather than hard against it: at the
             margin they read as the band being cut off, inboard they read as a
             deliberate mark. */
          .rx-stripes-head { top: 0; right: 90px; height: 48px; }
          /* Mirrored in the footer: bars at the other end, leaning the other
             way, so the two bands frame the sheet. */
          .rx-stripes-foot { bottom: 0; left: 90px; height: 48px; align-items: flex-end; }
          .rx-stripes-foot i { transform: skewX(22deg); }

          /* The wedge that runs out of the corner opposite the bars. */
          .rx-wedge {
            position: absolute;
            width: 120px;
            pointer-events: none;
            transform: skewX(-22deg);
          }
          .rx-wedge-foot { right: -70px; top: -30px; bottom: 50%; }

          /* The footer band mirrors the letterhead: same gradient, same
             geometry, so the page is closed by the same device that opens it.
             It bleeds to the paper edges exactly as the masthead does. */
          .rx-footband {
            position: relative;
            overflow: hidden;
            margin-left: -1rem;
            margin-right: -1rem;
            margin-bottom: -1rem;
            min-height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          @media (min-width: 640px) {
            .rx-footband {
              margin-left: -2rem;
              margin-right: -2rem;
              margin-bottom: -2rem;
            }
          }

          /* The dotted rule each patient field is written on. */
          /* One row, filling the height the flex parent gives it. Left to
             size itself the row ended at its content and the divider stopped
             halfway down a mostly empty page; stretched, the two columns run
             to the footer and the blank space below a short prescription reads
             as part of the form. */
          .rx-body-grid { grid-template-rows: 1fr; }

          /* The notes column: a faint tint and a coloured rule down its
             right edge. The tint sets it apart from the list beside it without
             boxing it, and the rule is the divider between the two halves of
             the sheet -- drawn once, on this side, rather than as a border on
             both. */
          .rx-notes {
            background: rgba(0, 0, 0, 0.018);
            border-right: 2px solid ${brand.light};
            border-radius: 3px 0 0 3px;
          }

          /* The strip below the list that carries the next visit. Same tint and
             same right-hand rule as the notes panel above it, so the divider
             is continuous from the top of the body to the bottom of this row
             rather than stopping where the medicines end. */
          .rx-notes-foot {
            background: rgba(0, 0, 0, 0.018);
            border-right: 2px solid ${brand.light};
            border-radius: 0 0 0 3px;
          }

          /* The prescription list keeps a plain white ground: it is the part
             the pharmacist reads, and a tint behind it only fights the
             watermark. */
          .rx-scripts { background: transparent; }

          /* The heading mark, at the size a pad prints it. */
          .rx-mark { font-size: 26px; }

          /* The heading stands clear of the list it introduces. */
          .rx-scripts-head { margin-bottom: 12px; }

          /* A list, not a grid: rules run between rows only, dotted and
             generously spaced, and no line is drawn between columns. */
          .rx-med-table { font-size: 11px; }
          .rx-med-table thead th {
            padding: 0 6px 5px;
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #9ca3af;
            border-bottom: 1px solid #d1d5db;
          }
          .rx-med-table tbody td {
            padding: 6px;
            border-bottom: 1px dotted #cbd5e1;
            vertical-align: top;
          }
          .rx-med-table tbody tr:last-child td { border-bottom: 0; }
          .rx-med-table .rx-med-group td {
            padding-top: 9px;
            border-bottom: 1px solid #e5e7eb;
            color: ${brand.stripText};
          }

          /* One banded row of four cells. The label sits above its value in
             small caps so the value itself is the thing the eye lands on. */
          .rx-patient-line { border-radius: 0 3px 3px 0; }
          .rx-patient-line .rx-cell {
            display: flex;
            flex-direction: column;
            gap: 1px;
            padding: 4px 10px;
            border-right: 1px solid rgba(0, 0, 0, 0.08);
          }
          .rx-patient-line .rx-cell:last-child { border-right: 0; }
          .rx-patient-line .rx-cell-label {
            font-size: 8px;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            line-height: 1;
          }
          .rx-patient-line .rx-cell-value {
            font-size: 11.5px;
            line-height: 1.25;
            color: #111827;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          /* Decoration behind the body. Positioned against the sheet, kept out
             of the flow so it can never push content onto a second page. */
          /* The sheet is the watermark's containing block. Without this it
             was positioned on screen against the modal instead of the page,
             so preview and print disagreed about where it sat. */
          #prescription-print-content {
            position: relative;
          }

          /* The same margins the printed page uses, so the preview is the page.
             Everything measured here -- the fitted headlines above all -- then
             holds on paper. */
          .rx-sheet {
            padding: 6mm 8mm 30mm 8mm;
            min-height: 297mm;
          }

          /* The sheet pads itself (p-4, sm:p-8); the masthead undoes that on
             three sides so it runs to the paper edge. Kept as negative margins
             rather than moving the band outside the padded container, so it
             still scrolls and paginates with the rest of the document. */
          .rx-letterhead-bleed {
            margin-top: -6mm;
            margin-left: -8mm;
            margin-right: -8mm;
          }

          /* The letterhead's rows sit against the paper edge, so nothing in
             it is rounded. */
          .rx-letterhead-bleed .rx-topband,
          .rx-letterhead-bleed .rx-headrow {
            border-radius: 0;
          }

          /* The configured logo size, applied on screen as well as in print so
             the preview shows what will actually come out of the printer. */
          .rx-print-logo {
            width: ${logoWidthPx}px;
            height: ${logoHeightPx}px;
            object-fit: contain;
          }

          /* Sits directly above the footer, turned 45 degrees like a stamp.
             bottom:100% is measured from the footer's own top edge, so the mark
             tracks the footer wherever the prescription's length puts it. The
             extra offset absorbs the overhang a 45-degree rotation adds (a
             440px square occupies 622px once turned, hanging 91px past its own
             box). It is not lowered further than this: at a 61px offset the
             mark's edge reached the QR code, which has to stay scannable for
             verification. 81px leaves roughly 20px of clearance. */
          .rx-watermark {
            position: absolute;
            bottom: calc(100% + ${watermarkClearance}px);
            left: 50%;
            /* Upright. The 45-degree tilt was decoration the mark did not
               need, and it cost the sheet a third more room: a rotated square
               occupies its own diagonal. */
            transform: translateX(-50%);
            transform-origin: center;
            color: ${brand.watermark};
            pointer-events: none;
            z-index: 0;
            line-height: 0;
          }

          /* Size lives here, not on the element's width/height attributes.
             Presentation attributes were being dropped somewhere in the print
             pipeline, so the mark came out at a fraction of the size it was
             given; an explicit CSS rule survives. */
          .rx-watermark svg,
          .rx-watermark img {
            width: ${watermarkWidth}px !important;
            height: auto !important;
            display: block;
          }
          /* The drawn fallback has no intrinsic size, so it needs both. */
          .rx-watermark svg { height: ${watermarkWidth}px !important; }

          /* A photograph cannot take currentColor, so it is washed out with
             filters instead. Deliberately not opacity: a low alpha composites
             to something a printer will not lay ink down for -- the reason the
             first version of this mark printed blank. brightness/contrast
             produce real light pixels that print. */
          .rx-watermark img {
            filter: grayscale(1) brightness(1.45) contrast(0.32);
            mix-blend-mode: multiply;
          }

          /* Everything real sits above the mark. The body block is also the
             mark's containing block, so its position: relative is load-bearing
             here, not only a stacking hint. */
          .rx-patient-line,
          .rx-letterhead,
          .print-content-grow {
            position: relative;
            z-index: 1;
          }

          /* The footer is the mark's containing block, so it must be
             positioned -- and must not clip a child that hangs above it.

             z-index 0, deliberately: position + z-index makes this a stacking
             context, and everything inside it paints at that level. At 1 it
             tied with the body block and, coming later in the document, won
             -- which is how the watermark ended up printed OVER the medicine
             names in the preview. At 0 the whole footer layer, mark included,
             sits under the content above it. */
          #print-footer {
            position: relative;
            z-index: 0;
            overflow: visible;
          }

          /* ...but the footer's own contents still have to clear the mark
             inside their own stacking context. */
          #print-footer > *:not(.rx-watermark) {
            position: relative;
            z-index: 1;
          }

          /* The columns paint above the mark; their own backgrounds stay clear
             so it reads through the table. */
          .print-content-grow > *:not(.rx-watermark) {
            position: relative;
            z-index: 1;
          }

          /* Quill content spacing for diagnosis/advice (screen + print) */
          .rx-quill-content,
          .rx-quill-content p {
            margin: 0 0 6px 0;
            line-height: 1.5;
            white-space: pre-wrap;
          }
          /* Ensure empty paragraphs take up space */
          .rx-quill-content p:empty:before,
          .rx-quill-content p br {
            content: "\\00a0";
            display: inline-block;
          }
          
          .rx-quill-content p:last-child {
            margin-bottom: 0;
          }
          .rx-quill-content ul,
          .rx-quill-content ol {
            margin: 0 0 6px 16px;
          }
          .rx-quill-content li {
            margin: 0 0 4px 0;
          }
        `}
      </style>

      {/* Main Container */}
      <div
        // A4 wide, not an arbitrary modal width. The headline sizes are
        // measured against this sheet and then printed on a real one; when the
        // two differed by 13% a name that fitted the preview overflowed the
        // page, which is how the end of a long hospital name went missing.
        className={`bg-white dark:bg-gray-800 rounded-xl w-full max-w-[210mm] flex flex-col ${
          embedded ? 'shadow-none' : 'max-h-[90vh] overflow-y-auto shadow-2xl'
        }`}
      >

        {/* Header - Screen Only */}
        {!embedded && (
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10 print-hide rounded-t-xl">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {viewOnly ? 'View Prescription' : 'Print Preview'}
            </h2>
            <div className="flex gap-3">
              {!viewOnly && (
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Printable Content */}
        <div id="prescription-print-content" ref={componentRef} className="rx-sheet bg-white text-gray-900 flex flex-col min-h-full">

          {/* Hospital Header */}
          {renderHospitalHeader('mb-2')}

          {/*
            Info Cards Grid

            Label and value share a line rather than stacking. The stacked
            version cost two lines per field and pushed long prescriptions onto
            a second sheet; inline rows cut this block to roughly half the
            height while keeping every field.
          */}
          {/* The patient line, written the way a paper pad writes it: one row of
              labelled rules across the sheet. The two stacked cards this
              replaces repeated the prescriber's details -- already in the
              letterhead above -- and spent a third of the page saying so. */}
          <div
            className="rx-patient-line mt-3 flex items-stretch text-[11px]"
            style={{ background: brand.strip, borderLeft: `3px solid ${brand.mid}` }}
          >
            {/* Four cells divided by hairlines rather than four labelled rules
                floating on white: on a form the reader scans left to right,
                a boxed row makes each field's extent obvious and stops a long
                name from visually running into the age beside it. */}
            <span className="rx-cell flex-1 min-w-0">
              <span className="rx-cell-label" style={{ color: brand.stripText }}>Name</span>
              <span className="rx-cell-value font-semibold">{printName(patient.name)}</span>
            </span>
            <span className="rx-cell w-[86px] shrink-0">
              <span className="rx-cell-label" style={{ color: brand.stripText }}>Age</span>
              <span className="rx-cell-value">{patient.age} Y</span>
            </span>
            <span className="rx-cell w-[96px] shrink-0">
              <span className="rx-cell-label" style={{ color: brand.stripText }}>Sex</span>
              <span className="rx-cell-value capitalize">{patient.gender}</span>
            </span>
            <span className="rx-cell w-[190px] shrink-0">
              <span className="rx-cell-label" style={{ color: brand.stripText }}>Date</span>
              <span className="rx-cell-value">
                {formatDate(prescriptionDate, hospital.timezone, hospital.calendarType)}
              </span>
            </span>
          </div>

          {/* The line that ends the heading matter. Everything above it
              identifies the sheet; everything below is the prescription. */}
          <div className="rx-body-rule mt-3 mb-3" style={{ borderTop: `1px solid ${brand.mid}` }} />

          {/* Main Body Layout */}
          <div className="rx-body-wrap flex flex-col flex-grow mb-4">
          <div className="rx-body-grid grid grid-cols-1 md:grid-cols-12 print:grid-cols-12 gap-0 flex-grow print-content-grow">
            {/* Left Column: Diagnosis & Advice (30%) */}
            {/* A faint tinted panel, so the notes column reads as the margin
                of the pad rather than a second table. The divider is drawn on
                this side as a coloured rule, not a hairline border. */}
            <div className="rx-notes md:col-span-4 print:col-span-4 flex flex-col gap-4 p-3 overflow-hidden">

              {/* Top Left: Diagnosis */}
                <div className="flex-1 overflow-hidden break-words">
                  <div className="flex items-center gap-2 mb-2 border-b border-gray-200 pb-1">
                    <span className="text-lg text-blue-600 font-serif leading-none">CR</span>
                    <h3 className="text-xs font-bold text-gray-700 uppercase">Clinical Record</h3>
                  </div>
                  {diagnosis ? (
                   <div className="text-xs text-gray-800 rx-quill-content" dangerouslySetInnerHTML={{ __html: diagnosis }} />
                  ) : (
                   <div className="text-xs text-gray-400 italic">No clinical record</div>
                  )}
                </div>

                {/* Bottom Left: Note */}
                {advice && advice.replace(/<[^>]*>/g, '').trim() ? (
                 <div className="flex-1 overflow-hidden break-words">
                   <div className="flex items-center gap-2 mb-2 border-b border-gray-200 pb-1">
                     <span className="text-amber-600 font-bold">⚠</span>
                     <h3 className="text-xs font-bold text-gray-700 uppercase">Note:</h3>
                   </div>
                   <div className="text-xs text-gray-800 rx-quill-content" dangerouslySetInnerHTML={{ __html: advice }} />
                 </div>
                ) : null}

            </div>

            {/* Right Column: Medicines Table (70%) */}
            <div className="rx-scripts md:col-span-8 print:col-span-8 overflow-hidden pl-4">
              {/* The ℞ stands on its own above the list, at the size a
                  prescription pad prints it -- it is the heading, so it is not
                  buried in a coloured strip beside a label. It answers the CR
                  mark on the clinical record opposite. */}
              <div className="rx-scripts-head flex items-baseline justify-between">
                <span className="flex items-baseline gap-2">
                  <span className="rx-mark font-serif leading-none" style={{ color: brand.dark }}>℞</span>
                  <h3
                    className="font-bold text-[10px] uppercase tracking-[0.18em] prescribed-medicines-header"
                    style={{ color: brand.stripText }}
                  >
                    Prescribed Medicines
                  </h3>
                </span>
                <span className="text-[9px] text-gray-400 prescribed-medicines-count">{medicines.length} Items</span>
              </div>
              <div className="overflow-x-auto">
                {/* No box, no column rules, no row numbers: a prescription is
                    a list, and ruling it like a spreadsheet made it read as
                    one. The dotted rules between lines are all the separation
                    a reader needs, and dropping the numbers gives the medicine
                    names the width they were short of. */}
                <table className="rx-med-table w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left">Medicine Name</th>
                      <th className="text-left w-16">Dosage</th>
                      <th className="text-left w-16">Duration</th>
                      <th className="text-left w-24">Instr.</th>
                      <th className="text-center w-10">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="text-[10px] text-gray-700">
                    {renderMedicineRows(firstPageMedicines)}
                    {/* Fill empty rows to maintain layout consistency if needed, though flex container handles height */}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Next visit, on a row of its own beneath the two columns. It stays
              at the foot of the page above the QR, where it was, and being
              inside this wrapper means the rule dividing notes from
              prescription carries on down past it rather than stopping at the
              bottom of the list. */}
          {nextVisit && (
            <div className="rx-nv-row grid grid-cols-1 md:grid-cols-12 print:grid-cols-12 gap-0">
              <div className="rx-notes-foot md:col-span-4 print:col-span-4 p-3">
                <div className="rx-next-visit inline-flex items-baseline gap-2 rounded border-l-2 px-2.5 py-1"
                     style={{ borderColor: brand.mid, background: brand.strip }}>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ color: brand.stripText }}>
                    Next Visit
                  </span>
                  {/* Normal weight at body size: it is a date, not a headline,
                      and set bold at 14px it shouted louder than the
                      medicines. */}
                  <span className="text-[11px] text-gray-800">
                    {formatVisitDate(nextVisit, hospital.timezone, hospital.calendarType)}
                  </span>
                </div>
              </div>
              <div className="md:col-span-8 print:col-span-8" />
            </div>
          )}
          </div>

          {remainingMedicines.length > 0 && (
            <div className="print-page-break">
              {renderHospitalHeader('mb-3')}

              {/* The overflow page carries the same list, drawn the same way.
                  It also has to: renderMedicineRows now emits five cells, and
                  this table's own header still declared six -- a column count
                  that no longer matched the rows it was heading. */}
              <div className="mb-4">
                <div className="rx-scripts-head flex items-baseline justify-between">
                  <span className="flex items-baseline gap-2">
                    <span className="rx-mark font-serif leading-none" style={{ color: brand.dark }}>℞</span>
                    <h3
                      className="font-bold text-[10px] uppercase tracking-[0.18em] prescribed-medicines-header"
                      style={{ color: brand.stripText }}
                    >
                      Prescribed Medicines (Continued)
                    </h3>
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="rx-med-table w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left">Medicine Name</th>
                        <th className="text-left w-16">Dosage</th>
                        <th className="text-left w-16">Duration</th>
                        <th className="text-left w-24">Instr.</th>
                        <th className="text-center w-10">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700">
                      {renderMedicineRows(remainingMedicines, FIRST_PAGE_MEDICINE_LIMIT)}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Footer Section */}
          {/* No mt-auto. An auto margin consumes a flex container's free space
              before flex-grow gets any, so it was the reason the body grid --
              and the divider down it -- stopped at its content while the rest
              of the page sat empty. The grid grows instead, and pushes the
              footer down as it does. */}
          <div id="print-footer">
            {/* The mark hangs off the top edge of the footer rather than
                sitting inside the body block. The body is only as tall as the
                prescription, so on a short one the mark landed on top of the
                medicines table; anchoring to the footer puts it in the empty
                space below the table however long the prescription runs.
                Decoration only -- aria-hidden, no pointer. */}
            {showWatermark && (
            <div className="rx-watermark" aria-hidden="true">
              {watermarkFailed || !watermarkSrc ? (
                <svg viewBox="0 0 512 512" width="520" height="520" fill="none" stroke="currentColor" strokeWidth="30"
                     strokeLinecap="round" strokeLinejoin="round">
                  <path d="M128 48v112a80 80 0 0 0 160 0V48" />
                  <path d="M96 48h64M256 48h64" />
                  <path d="M208 240v56a112 112 0 0 0 224 0v-40" />
                  <circle cx="432" cy="216" r="40" />
                </svg>
              ) : (
                <img
                  src={watermarkSrc}
                  alt=""
                  onError={() => setWatermarkFailed(true)}
                  loading="eager"
                  decoding="sync"
                />
              )}
            </div>
            )}
            <div id="print-signatures" className="pt-6 sm:pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6 sm:gap-0">
              {/* QR Code */}
              <div className="flex flex-col items-center">
                <div className="bg-white p-1 border border-gray-200 rounded-lg">
                  <QRCodeSVG value={qrValue} size={80} />
                </div>
                <span className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide">Scan to Verify</span>
              </div>

              {/* Signature */}
              <div className="text-center min-w-[200px]">
                {doctor.signature ? (
                  <img
                    src={resolveAssetUrl(doctor.signature)}
                    alt="Signature"
                    className="rx-print-signature max-h-28 h-auto mx-auto mb-1 object-contain"
                    loading="eager"
                    decoding="sync"
                  />
                ) : (
                  <div className="h-28 mb-1"></div>
                )}
                <div className="border-t border-gray-900 pt-1">
                  <p className="font-bold text-gray-900 text-sm">{doctor.name}</p>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wide">Doctor's Signature</p>
                </div>
              </div>
            </div>

            {/* Closing band, matching the letterhead. The practice name,
                address and licence used to be repeated here as grey text; all
                three are in the masthead on the same sheet, and the licence has
                no bearing on a prescription -- so the band carries only the
                attribution, and its job is to finish the page the way the
                letterhead starts it. */}
            <div
              className="rx-footband mt-8"
              style={{ background: `linear-gradient(135deg, ${brand.dark} 0%, ${brand.mid} 50%, ${brand.light} 100%)` }}
            >
              <span className="rx-stripes rx-stripes-foot" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="rx-wedge rx-wedge-foot" aria-hidden="true" style={{ background: brand.light }} />
              <p className="relative m-0 w-full px-6 text-center text-[10px] italic leading-none text-white/90">{POWERED_BY_TEXT}</p>
            </div>
          </div>

          {/* System Audit Information - Screen Only */}
          <div className="mt-8 pt-4 border-t border-gray-200 print-hide">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">System Information</h4>
            <div className="grid grid-cols-4 gap-4 text-[10px] text-gray-600">
              <div>
                <span className="block font-semibold">Created By</span>
                <span>{createdBy || '-'}</span>
              </div>
              <div>
                <span className="block font-semibold">Created At</span>
                <span>{prescriptionDate ? formatDate(prescriptionDate, hospital.timezone, hospital.calendarType) : '-'}</span>
              </div>
              <div>
                <span className="block font-semibold">Updated By</span>
                <span>{updatedBy || '-'}</span>
              </div>
              <div>
                <span className="block font-semibold">Updated At</span>
                <span>{updatedAt ? formatDate(updatedAt, hospital.timezone, hospital.calendarType) : '-'}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
