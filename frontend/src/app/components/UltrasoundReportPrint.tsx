import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { POWERED_BY_TEXT } from '../utils/receiptBranding';
import { printName, printNameOr } from '../utils/printName';
import { useReactToPrint } from 'react-to-print';
import { X, Printer, Phone, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { Hospital } from '../types';
import { UltrasoundExamApi } from '../api/ultrasound';
import { recordAuditEvent } from '../api/auditLogs';

interface UltrasoundReportPrintProps {
  hospital: Hospital;
  exam: UltrasoundExamApi;
  onClose: () => void;
}

const resolveAssetUrl = (path?: string | null): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace('/api', '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const withStorage = normalized.startsWith('/storage/') ? normalized : `/storage${normalized}`;
  return `${base}${withStorage}`;
};

// The examination is recorded by day, so the clock time is not printed.
const safeDate = (value?: string | null, pattern = 'MMM dd, yyyy') => {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : format(parsed, pattern);
};

/** Wash of the accent, derived rather than stored so the two cannot drift. */
function accentTint(hex: string, alpha = 0.1): string {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!match) return 'rgba(30, 143, 163, 0.08)';
  let body = match[1];
  if (body.length === 3) body = body.split('').map((c) => c + c).join('');
  const r = parseInt(body.slice(0, 2), 16);
  const g = parseInt(body.slice(2, 4), 16);
  const b = parseInt(body.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function UltrasoundReportPrint({ hospital, exam, onClose }: UltrasoundReportPrintProps) {
  const componentRef = useRef<HTMLDivElement>(null);

  // Just the number. The old US-<hospital>-0001 form put the hospital id in
  // the middle of something a clerk reads aloud, and padded it to four
  // digits for a counter that is nowhere near a thousand.
  /**
   * The printed sheet takes its colour from Hospital Details > Brand Color, the
   * same field the lab report reads, so both documents from one hospital match.
   * Tailwind's blue-600 was hardcoded throughout, which meant a site could set
   * its brand colour and still hand the patient a blue report.
   */
  const accent = hospital?.brandColor || '#1E8FA3';
  const accentWash = accentTint(accent, 0.08);

  const reportNumber = String(exam.sequence_id ?? exam.id ?? '');

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Ultrasound_Report_${reportNumber}`,
    pageStyle: `
      @page { size: A4; margin: 12mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
    onAfterPrint: () => {
      recordAuditEvent({
        module: 'Ultrasound',
        action: 'print',
        record_id: exam.id,
        record_label: exam.patient?.name ?? reportNumber,
        description: `Printed ultrasound report ${reportNumber}.`,
      });
    },
  });

  const modal = (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
        {/* Toolbar (never printed) */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Ultrasound Report Preview</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{reportNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 text-xs font-medium"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              onClick={onClose}
              title="Close"
              aria-label="Close preview"
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Printable area */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-100 dark:bg-gray-900">
          <div ref={componentRef} className="us-sheet bg-white text-gray-900 p-8 mx-auto max-w-3xl shadow-sm">
            <style>{`
              /* A sheet that fills the page, so the signature and footer sit on
                 its foot instead of floating up under a short report. */
              .us-sheet { display: flex; flex-direction: column; min-height: 1000px; max-width: 100%; }
              .us-foot { margin-top: auto; }

              /* The findings come from a rich-text editor, so they can carry a
                 long unbroken measurement, a pasted table or an image wider than
                 the page. Left alone those push the text off the right edge --
                 nothing clips them, the sheet simply grows. Everything inside is
                 held to the column width and long words are allowed to break. */
              .us-report-body { overflow-wrap: anywhere; word-break: break-word; }
              .us-report-body * { max-width: 100%; box-sizing: border-box; }
              .us-report-body img { height: auto; }
              .us-report-body table { width: 100%; table-layout: fixed; border-collapse: collapse; }
              .us-report-body pre { white-space: pre-wrap; }

              .us-report-body p { margin: 0 0 6px 0; line-height: 1.6; }
              .us-report-body ul, .us-report-body ol { margin: 0 0 6px 18px; }
              .us-report-body li { margin: 0 0 4px 0; }

              @media print {
                /* Tighter foot than head: the footer rule should sit close to the
                   paper edge, not float in a wide bottom margin. */
                @page { size: A4; margin: 12mm 12mm 8mm; }
                /* 297mm less the 12mm top and 8mm bottom margins, so the sheet is
                   exactly one page and the footer lands on its last line. */
                .us-sheet { min-height: 277mm; padding: 0 !important; box-shadow: none !important; }
              }
            `}</style>

            {/* Hospital header */}
            <div className="flex flex-row items-center gap-4 pb-2 mb-3" style={{ borderBottom: `4px solid ${accent}` }}>
              {hospital.logo && (
                <img
                  src={resolveAssetUrl(hospital.logo)}
                  alt=""
                  className="max-h-24 h-auto w-auto object-contain shrink-0"
                  loading="eager"
                  decoding="sync"
                />
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">{hospital.name}</h1>
                <div className="text-sm text-gray-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {hospital.phone && (
                    <span className="flex items-center gap-2">
                      <Phone className="w-4 h-4" style={{ color: accent }} />
                      {hospital.phone}
                    </span>
                  )}
                  {hospital.email && (
                    <span className="flex items-center gap-2">
                      <Mail className="w-4 h-4" style={{ color: accent }} />
                      {hospital.email}
                    </span>
                  )}
                </div>
              </div>

              {/* The document's name sits opposite the hospital's, where a
                  reader looks to see what they are holding. */}
              <div className="text-right shrink-0">
                <div
                  className="font-extrabold uppercase leading-tight"
                  style={{ color: accent, fontSize: '15px', letterSpacing: '0.12em' }}
                >
                  Ultrasound Report
                </div>
                <div className="text-[11px] font-semibold text-gray-800 mt-0.5">#{reportNumber}</div>
              </div>
            </div>

            {/* Patient / exam summary */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2 pb-1 border-b border-gray-200">
                  Patient Information
                </h3>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div>
                    <dt className="font-semibold" style={{ color: accent }}>Name</dt>
                    <dd className="text-gray-900">{printNameOr(exam.patient?.name)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold" style={{ color: accent }}>Patient ID</dt>
                    <dd className="text-gray-900">{exam.patient?.patient_id ?? exam.patient_id}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold" style={{ color: accent }}>Age / Gender</dt>
                    <dd className="text-gray-900">
                      {exam.patient?.age ?? '-'} Y / {exam.patient?.gender ?? '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold" style={{ color: accent }}>Exam Date</dt>
                    <dd className="text-gray-900">{safeDate(exam.examined_at)}</dd>
                  </div>
                </dl>
              </div>

              <div className="border border-gray-200 rounded-lg p-3" style={{ backgroundColor: accentWash }}>
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2 pb-1 border-b border-gray-200">
                  Examination Details
                </h3>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div>
                    <dt className="font-semibold" style={{ color: accent }}>Study</dt>
                    <dd className="text-gray-900">{printNameOr(exam.ultrasound_type?.name)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold" style={{ color: accent }}>Report #</dt>
                    <dd className="text-gray-900">{reportNumber}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold" style={{ color: accent }}>Sonologist</dt>
                    <dd className="text-gray-900">{printNameOr(exam.doctor?.name || exam.updated_by)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold" style={{ color: accent }}>Referred By</dt>
                    <dd className="text-gray-900">{printNameOr(exam.referred_by)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {exam.clinical_notes && (
              <div className="mb-4">
                <h3 className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: accent }}>Clinical Indication</h3>
                <p className="text-xs text-gray-700 whitespace-pre-wrap">{exam.clinical_notes}</p>
              </div>
            )}

            {/* Report body */}
            <div className="mb-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wide mb-2 pb-1 border-b border-gray-200" style={{ color: accent }}>
                Findings
              </h3>
              <div
                className="us-report-body text-sm text-gray-800"
                dangerouslySetInnerHTML={{ __html: exam.report_body || '<p>No findings recorded.</p>' }}
              />
            </div>

            {exam.impression && (
              <div className="mb-6 px-3 py-2" style={{ borderLeft: `4px solid ${accent}`, backgroundColor: accentWash }}>
                <h3 className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: accent }}>Impression</h3>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{exam.impression}</p>
              </div>
            )}

            {/* Everything below sits on the foot of the sheet: a signature
                floating halfway down a short report reads as unfinished, and a
                reader looks for it at the bottom. */}
            <div className="us-foot pt-8">
              <div className="flex justify-end">
                <div className="text-center">
                  <div className="w-52 border-t border-gray-400 pt-1">
                    <p className="text-xs font-semibold text-gray-900">{printName(exam.doctor?.name || exam.updated_by)}</p>
                    <p className="text-[10px] text-gray-500">
                      {exam.doctor?.specialization || 'Sonologist'}
                      {exam.doctor?.registration_number ? ` • ${exam.doctor.registration_number}` : ''}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex">
                <div className="h-0.5 flex-1" style={{ backgroundColor: accent }} />
                <div className="h-0.5 bg-red-500 w-16" />
              </div>
              <div className="pt-1.5 text-[9px] text-gray-500 flex justify-between">
                <span>{POWERED_BY_TEXT}</span>
                <span>Printed {format(new Date(), 'MMM dd, yyyy hh:mm a')}</span>
                <span>Page 1 of 1</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
