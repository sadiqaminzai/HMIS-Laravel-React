import React, { useEffect, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { X, Phone, Mail, Printer } from 'lucide-react';
import { Hospital, Patient, Doctor, PrescriptionMedicine } from '../types';
import { instructionOptions } from '../data/mockData';
import { QRCodeSVG } from 'qrcode.react';
import { formatDate } from '../utils/date';
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
  const { loadHospitalSetting, getPrescriptionPrintAssetSettings, getShowPrescriptionListMeta } = useSettings();

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
      min-height: auto;
      height: auto;
      padding: 6mm 8mm 30mm 8mm !important;
      margin: 0;
      background: white;
      box-sizing: border-box !important;
      z-index: 9999;
      overflow: visible;
      display: block !important;
    }

    #prescription-print-content .prescribed-medicines-header,
    #prescription-print-content .prescribed-medicines-count {
      color: #ffffff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    #prescription-print-content * {
      visibility: visible;
    }

    #print-footer {
      visibility: visible !important;
      display: block !important;
      position: fixed !important;
      left: 8mm;
      right: 8mm;
      bottom: 6mm;
      background: white;
      z-index: 10000;
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

    #prescription-print-content .print-content-grow {
      display: block !important;
      break-inside: auto;
      page-break-inside: auto;
    }

    #prescription-print-content .print-content-grow > div {
      page-break-inside: auto;
      break-inside: auto;
    }

    #prescription-print-content .print-content-grow > div:first-child {
      float: left !important;
      width: 30% !important;
      max-width: 30% !important;
      padding-right: 12px !important;
    }

    #prescription-print-content .print-content-grow > div:last-child {
      float: right !important;
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

    #print-footer .text-center.mt-8.pt-4 {
      margin-top: 2px !important;
      padding-top: 2px !important;
      break-inside: auto;
      page-break-inside: auto;
    }

    #print-footer p {
      margin: 0 !important;
      line-height: 1.1 !important;
    }

    #print-footer .text-center.mt-8.pt-4 p + p {
      margin-top: 1px !important;
    }

    #prescription-print-content .print-page-break {
      break-before: page;
      page-break-before: always;
      margin-top: 8mm !important;
    }

    /* The band's colours are set inline from the hospital's brand, so the
       print sheet only has to stop the browser dropping them. */
    #prescription-print-content .rx-masthead,
    #prescription-print-content .rx-watermark {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    }

    /* Repeated for the print document, which does not inherit the component's
       own <style> block. Without it the mark printed tiny. */
    #prescription-print-content .rx-watermark svg,
    #prescription-print-content .rx-watermark img {
      width: 440px !important;
      height: 440px !important;
      display: block !important;
    }

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

    #prescription-print-content .rx-letterhead-bleed .rx-masthead {
      border-top-left-radius: 0 !important;
      border-top-right-radius: 0 !important;
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
          <tr key={`group-${startIndex}-${index}`} className="bg-indigo-500/10">
            <td colSpan={6} className="px-2 py-1 border-b border-indigo-100 text-[10px] font-semibold text-indigo-700 uppercase tracking-wide">
              {med.groupLabel || 'Treatment Set'}
            </td>
          </tr>
        );
      }

      // Transparent, not white: the zebra fill was opaque and hid the
      // watermark behind the table completely. The rule between rows is
      // enough to follow a line across.
      renderedRows.push(
        <tr key={`${startIndex}-${index}`} className={(startIndex + index) % 2 === 0 ? '' : 'bg-gray-500/5'}>
          <td className="px-2 py-1 border-b border-gray-100 text-gray-400">{startIndex + index + 1}</td>
          <td className="px-2 py-1 border-b border-gray-100 font-medium break-words">
            {formatMedicineForPrint(med)}
          </td>
          <td className="px-2 py-1 border-b border-gray-100 whitespace-nowrap">
            <span className="inline-block px-1 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-semibold border border-blue-100">
              {med.dose}
            </span>
          </td>
          <td className="px-2 py-1 border-b border-gray-100 whitespace-nowrap">{med.duration}</td>
          <td
            className="px-2 py-1 border-b border-gray-100 text-gray-600 whitespace-pre-wrap break-words max-w-[140px]"
            title={getInstructionLabel(med.instruction)}
          >
            {getInstructionLabel(med.instruction)}
          </td>
          <td className="px-2 py-1 border-b border-gray-100 text-center font-medium">{med.quantity ?? '-'}</td>
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
      <div
        className="rx-masthead relative overflow-hidden rounded-t-md px-4 py-3"
        style={{ background: `linear-gradient(135deg, ${brand.dark} 0%, ${brand.mid} 50%, ${brand.light} 100%)` }}
      >
        <div className="relative flex items-stretch justify-between gap-3">
          {/* Prescriber, left: the credentials a pharmacist checks first. */}
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/70">
              Prescribed by
            </div>
            <div className="truncate text-base sm:text-lg font-bold leading-tight text-white">
              {printName(doctor.name)}
            </div>
            {/* Wraps rather than truncating: a doctor's qualifications run to a
                full line or two ("MBBS MD RMP Kabul MUSP Ultrasound Specialist
                ...") and an ellipsis on a letterhead loses the part that
                establishes their standing. whitespace-pre-line keeps the line
                breaks typed into the field. */}
            {doctor.specialization && (
              <div className="whitespace-pre-line break-words text-[11px] leading-snug text-white/85">
                {doctor.specialization}
              </div>
            )}
            {doctor.registrationNumber && (
              <div className="text-[10px] text-white/70">Reg. No {doctor.registrationNumber}</div>
            )}
          </div>

          {/* Logo on a light chip: a dark logo on the band would disappear, and
              hospitals upload both kinds. Capped at 56px wide -- at its old
              size it pushed the practice name into an ellipsis, and the name
              matters more on a letterhead than the mark does. */}
          <div className="flex shrink-0 items-center">
            {hospital.logo && !logoFailed ? (
              <span className="flex items-center justify-center rounded-md bg-white/95 p-1">
                <img
                  src={resolveAssetUrl(hospital.logo)}
                  alt=""
                  onError={() => setLogoFailed(true)}
                  /* Size comes from Settings > Printing via .rx-print-logo;
                     h-auto/w-auto used to sit here and fought that rule. */
                  className="rx-print-logo"
                  loading="eager"
                  decoding="sync"
                />
              </span>
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-md bg-white/95 text-2xl font-bold leading-none" style={{ color: brand.mid }}>
                ℞
              </span>
            )}
          </div>

          {/* Practice, right. Wraps to a second line rather than truncating:
              a clinic whose name does not fit is not identified. */}
          <div className="min-w-0 flex-[1.4] text-right">
            <div className="text-sm sm:text-lg font-extrabold uppercase leading-tight tracking-wide text-white break-words">
              {hospital.name}
            </div>
            {hospital.address && (
              <div className="truncate text-[10px] text-white/80">{hospital.address}</div>
            )}
            <div className="mt-0.5 flex flex-col items-end gap-0.5 text-[10px] text-white/90">
              {hospital.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3" />
                  {hospital.phone}
                </span>
              )}
              {hospital.email && (
                <span className="flex items-center gap-1.5 truncate">
                  <Mail className="h-3 w-3" />
                  {hospital.email}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Title strip under the masthead, so the document says what it is
          without spending a full line of the letterhead on it. */}
      <div
        className="rx-title-strip flex items-center justify-between rounded-b-md px-4 py-1"
        style={{ background: brand.strip, borderTop: `2px solid ${brand.mid}` }}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: brand.stripText }}>
          Patient Prescription
        </span>
        {/* Rx # moved here from the doctor panel that this design removes.
            The Prescription List Visibility switch governs the whole pair: with
            it off the Rx number goes too, not just the patient ID. Leaving the
            Rx behind meant a clinic that had chosen to print no reference
            numbers still got one. */}
        {showPrescriptionListMeta && (
          <span className="text-[10px] font-semibold" style={{ color: brand.stripText }}>
            Rx # <span className="font-mono font-bold">{prescriptionNumber}</span>
            {patient.patientId ? ` · ID ${patient.patientId}` : ''}
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
          .rx-masthead,
          .rx-title-strip {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* The dotted rule each patient field is written on. */
          .rx-patient-line .rx-rule {
            border-bottom: 1px dotted #9ca3af;
            min-width: 0;
            padding-bottom: 1px;
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

          /* The sheet pads itself (p-4, sm:p-8); the masthead undoes that on
             three sides so it runs to the paper edge. Kept as negative margins
             rather than moving the band outside the padded container, so it
             still scrolls and paginates with the rest of the document. */
          .rx-letterhead-bleed {
            margin-top: -1rem;
            margin-left: -1rem;
            margin-right: -1rem;
          }

          @media (min-width: 640px) {
            .rx-letterhead-bleed {
              margin-top: -2rem;
              margin-left: -2rem;
              margin-right: -2rem;
            }
          }

          /* Square off the corners that now sit against the paper edge. */
          .rx-letterhead-bleed .rx-masthead {
            border-top-left-radius: 0;
            border-top-right-radius: 0;
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
            bottom: calc(100% + 81px);
            left: 50%;
            transform: translateX(-50%) rotate(-45deg);
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
            width: 440px !important;
            height: 440px !important;
            display: block;
          }

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
        className={`bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl flex flex-col ${
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
        <div id="prescription-print-content" ref={componentRef} className="p-4 sm:p-8 bg-white text-gray-900 flex flex-col min-h-full">

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
            className="rx-patient-line mt-2 mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 px-1 pb-2 text-[11px]"
            style={{ borderBottom: `2px solid ${brand.mid}` }}
          >
            <span className="flex flex-1 min-w-[220px] items-baseline gap-1">
              <span className="font-bold shrink-0" style={{ color: brand.stripText }}>Name</span>
              <span className="rx-rule flex-1 font-semibold text-gray-900">{printName(patient.name)}</span>
            </span>
            <span className="flex w-[92px] items-baseline gap-1">
              <span className="font-bold shrink-0" style={{ color: brand.stripText }}>Age</span>
              <span className="rx-rule flex-1 text-gray-900">{patient.age} Y</span>
            </span>
            <span className="flex w-[110px] items-baseline gap-1">
              <span className="font-bold shrink-0" style={{ color: brand.stripText }}>Sex</span>
              <span className="rx-rule flex-1 text-gray-900 capitalize">{patient.gender}</span>
            </span>
            <span className="flex flex-1 min-w-[180px] items-baseline gap-1">
              <span className="font-bold shrink-0" style={{ color: brand.stripText }}>Date</span>
              <span className="rx-rule flex-1 text-gray-900">
                {formatDate(prescriptionDate, hospital.timezone, hospital.calendarType)}
              </span>
            </span>
            {nextVisit && (
              <span className="flex flex-1 min-w-[160px] items-baseline gap-1">
                <span className="font-bold shrink-0" style={{ color: brand.stripText }}>Next Visit</span>
                <span className="rx-rule flex-1 text-gray-900">
                  {formatDate(nextVisit, hospital.timezone, hospital.calendarType)}
                </span>
              </span>
            )}
          </div>

          {/* Main Body Layout */}
          <div className="grid grid-cols-1 md:grid-cols-12 print:grid-cols-12 gap-4 lg:gap-6 mb-4 flex-grow print-content-grow">
            {/* Left Column: Diagnosis & Advice (30%) */}
            <div className="md:col-span-4 print:col-span-4 flex flex-col gap-4 lg:gap-6 border-b md:border-b-0 print:border-b-0 md:border-r print:border-r border-gray-200 pb-4 md:pb-0 print:pb-0 lg:pr-6 print:pr-6 overflow-hidden">

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
            <div className="md:col-span-8 print:col-span-8 overflow-hidden">
              <div
                className="bg-blue-600 text-white px-3 py-1.5 rounded-t-lg flex justify-between items-center mb-0"
                style={{ backgroundColor: hospital.brandColor }}
              >
                <h3 className="font-bold text-xs uppercase tracking-wide prescribed-medicines-header">Prescribed Medicines</h3>
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded prescribed-medicines-count">{medicines.length} Items</span>
              </div>
              <div className="overflow-x-auto border-x border-b border-gray-200">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-500/5 text-[10px] text-gray-500 uppercase">
                    <tr>
                      <th className="px-2 py-1 text-left font-semibold border-b border-gray-200 w-8">#</th>
                      <th className="px-2 py-1 text-left font-semibold border-b border-gray-200">Medicine Name</th>
                      <th className="px-2 py-1 text-left font-semibold border-b border-gray-200 w-16">Dosage</th>
                      <th className="px-2 py-1 text-left font-semibold border-b border-gray-200 w-16">Duration</th>
                      <th className="px-2 py-1 text-left font-semibold border-b border-gray-200 w-20">Instr.</th>
                      <th className="px-2 py-1 text-center font-semibold border-b border-gray-200 w-10">Qty</th>
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

          {remainingMedicines.length > 0 && (
            <div className="print-page-break">
              {renderHospitalHeader('mb-3')}

              <div className="mb-4">
                <div
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-t-lg flex justify-between items-center mb-0"
                  style={{ backgroundColor: hospital.brandColor }}
                >
                  <h3 className="font-bold text-xs uppercase tracking-wide prescribed-medicines-header">Prescribed Medicines (Continued)</h3>
                </div>
                <div className="overflow-x-auto border-x border-b border-gray-200">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-500/5 text-[10px] text-gray-500 uppercase">
                      <tr>
                        <th className="px-2 py-1 text-left font-semibold border-b border-gray-200 w-8">#</th>
                        <th className="px-2 py-1 text-left font-semibold border-b border-gray-200">Medicine Name</th>
                        <th className="px-2 py-1 text-left font-semibold border-b border-gray-200 w-16">Dosage</th>
                        <th className="px-2 py-1 text-left font-semibold border-b border-gray-200 w-16">Duration</th>
                        <th className="px-2 py-1 text-left font-semibold border-b border-gray-200 w-20">Instr.</th>
                        <th className="px-2 py-1 text-center font-semibold border-b border-gray-200 w-10">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="text-[10px] text-gray-700">
                      {renderMedicineRows(remainingMedicines, FIRST_PAGE_MEDICINE_LIMIT)}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Footer Section */}
          <div id="print-footer" className="mt-auto">
            {/* The mark hangs off the top edge of the footer rather than
                sitting inside the body block. The body is only as tall as the
                prescription, so on a short one the mark landed on top of the
                medicines table; anchoring to the footer puts it in the empty
                space below the table however long the prescription runs.
                Decoration only -- aria-hidden, no pointer. */}
            <div className="rx-watermark" aria-hidden="true">
              {watermarkFailed ? (
                <svg viewBox="0 0 512 512" width="520" height="520" fill="none" stroke="currentColor" strokeWidth="30"
                     strokeLinecap="round" strokeLinejoin="round">
                  <path d="M128 48v112a80 80 0 0 0 160 0V48" />
                  <path d="M96 48h64M256 48h64" />
                  <path d="M208 240v56a112 112 0 0 0 224 0v-40" />
                  <circle cx="432" cy="216" r="40" />
                </svg>
              ) : (
                <img
                  src={`${import.meta.env.BASE_URL}watermark-stethoscope.png`}
                  alt=""
                  width={540}
                  height={540}
                  onError={() => setWatermarkFailed(true)}
                  loading="eager"
                  decoding="sync"
                />
              )}
            </div>
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

            {/* Legal Footer. The practice name, address and licence used to be
                repeated here; all three are in the letterhead at the top of the
                same sheet, and the licence has no bearing on a prescription. */}
            <div className="text-center mt-8 pt-4 border-t border-gray-100 text-[10px] text-gray-400">
              <p className="italic">{POWERED_BY_TEXT}</p>
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
