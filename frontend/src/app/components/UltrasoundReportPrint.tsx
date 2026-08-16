import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
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

export function UltrasoundReportPrint({ hospital, exam, onClose }: UltrasoundReportPrintProps) {
  const componentRef = useRef<HTMLDivElement>(null);

  const reportNumber = `US-${String(exam.hospital_id)}-${String(exam.sequence_id).padStart(4, '0')}`;

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
          <div ref={componentRef} className="bg-white text-gray-900 p-8 mx-auto max-w-3xl shadow-sm">
            <style>{`
              .us-report-body p { margin: 0 0 6px 0; line-height: 1.6; }
              .us-report-body ul, .us-report-body ol { margin: 0 0 6px 18px; }
              .us-report-body li { margin: 0 0 4px 0; }
            `}</style>

            {/* Hospital header */}
            <div className="flex flex-row justify-between items-center gap-3 border-b-4 border-blue-600 pb-2 mb-3">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">{hospital.name}</h1>
                <div className="text-sm text-gray-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {hospital.phone && (
                    <span className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-blue-600" />
                      {hospital.phone}
                    </span>
                  )}
                  {hospital.email && (
                    <span className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-600" />
                      {hospital.email}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-blue-800 font-semibold text-xs uppercase tracking-wide">
                  Ultrasound Report
                </div>
              </div>
              {hospital.logo && (
                <img
                  src={resolveAssetUrl(hospital.logo)}
                  alt="Hospital Logo"
                  className="max-h-24 h-auto w-auto object-contain shrink-0"
                  loading="eager"
                  decoding="sync"
                />
              )}
            </div>

            {/* Patient / exam summary */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2 pb-1 border-b border-gray-200">
                  Patient Information
                </h3>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div>
                    <dt className="text-blue-700 font-semibold">Name</dt>
                    <dd className="text-gray-900">{exam.patient?.name ?? '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-blue-700 font-semibold">Patient ID</dt>
                    <dd className="text-gray-900">{exam.patient?.patient_id ?? exam.patient_id}</dd>
                  </div>
                  <div>
                    <dt className="text-blue-700 font-semibold">Age / Gender</dt>
                    <dd className="text-gray-900">
                      {exam.patient?.age ?? '-'} Y / {exam.patient?.gender ?? '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-blue-700 font-semibold">Exam Date</dt>
                    <dd className="text-gray-900">{safeDate(exam.examined_at)}</dd>
                  </div>
                </dl>
              </div>

              <div className="border border-gray-200 rounded-lg p-3 bg-blue-50/50">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2 pb-1 border-b border-gray-200">
                  Examination Details
                </h3>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div>
                    <dt className="text-blue-700 font-semibold">Study</dt>
                    <dd className="text-gray-900">{exam.ultrasound_type?.name ?? '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-blue-700 font-semibold">Report #</dt>
                    <dd className="text-gray-900">{reportNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-blue-700 font-semibold">Radiologist</dt>
                    <dd className="text-gray-900">{exam.doctor?.name || exam.updated_by || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-blue-700 font-semibold">Referred By</dt>
                    <dd className="text-gray-900">{exam.referred_by || '-'}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {exam.clinical_notes && (
              <div className="mb-4">
                <h3 className="text-[11px] font-bold text-blue-800 uppercase tracking-wide mb-1">Clinical Indication</h3>
                <p className="text-xs text-gray-700 whitespace-pre-wrap">{exam.clinical_notes}</p>
              </div>
            )}

            {/* Report body */}
            <div className="mb-4">
              <h3 className="text-[11px] font-bold text-blue-800 uppercase tracking-wide mb-2 pb-1 border-b border-gray-200">
                Findings
              </h3>
              <div
                className="us-report-body text-sm text-gray-800"
                dangerouslySetInnerHTML={{ __html: exam.report_body || '<p>No findings recorded.</p>' }}
              />
            </div>

            {exam.impression && (
              <div className="mb-6 border-l-4 border-blue-600 bg-blue-50/60 px-3 py-2">
                <h3 className="text-[11px] font-bold text-blue-800 uppercase tracking-wide mb-1">Impression</h3>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{exam.impression}</p>
              </div>
            )}

            {/* Signature */}
            <div className="flex justify-end mt-10">
              <div className="text-center">
                <div className="w-52 border-t border-gray-400 pt-1">
                  <p className="text-xs font-semibold text-gray-900">{exam.doctor?.name || exam.updated_by || ''}</p>
                  <p className="text-[10px] text-gray-500">
                    {exam.doctor?.specialization || 'Radiologist'}
                    {exam.doctor?.registration_number ? ` • ${exam.doctor.registration_number}` : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-2 border-t border-gray-200 text-[10px] text-gray-500 flex justify-between">
              <span>{hospital.name}{hospital.address ? ` • ${hospital.address}` : ''}</span>
              <span>Printed {format(new Date(), 'MMM dd, yyyy hh:mm a')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
