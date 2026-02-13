import React, { useRef } from 'react';
import { X, Phone, Mail, Printer } from 'lucide-react';
import { Hospital, Patient, Doctor, PrescriptionMedicine } from '../types';
import { instructionOptions } from '../data/mockData';
import { QRCodeSVG } from 'qrcode.react';
import { formatDate } from '../utils/date';
import { buildVerificationUrl } from '../utils/verification';

// Extended type for medicine with additional display fields
type ExtendedPrescriptionMedicine = PrescriptionMedicine & {
  genericName?: string;
  brandName?: string;
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
  onClose,
  viewOnly = false,
  embedded = false,
  verificationToken,
  createdBy,
  updatedAt,
  updatedBy
}: PrescriptionPrintProps) {

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

    return displayName.replace(/\s+/g, ' ').trim();
  };

  const handlePrint = () => {
    window.print();
  };

  const getInstructionLabel = (value: string) => {
    return instructionOptions.find(opt => opt.value === value)?.label || value;
  };

  // QR Data
  const qrData = JSON.stringify({
    prescriptionNumber,
    hospitalCode: hospital.code,
    patientId: patient.patientId,
    doctorId: doctor.id,
    date: prescriptionDate.toISOString(),
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
          @media print {
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

            /* Reset specific print container */
            #prescription-print-content {
              visibility: visible;
              position: absolute;
              left: 0;
              top: 0;
              width: 210mm;
              min-height: 297mm; /* Exact A4 Height */
              height: auto;
              padding: 20mm !important;
              margin: 0;
              background: white;
              box-sizing: border-box !important; /* CRITICAL FIX */
              z-index: 9999;
              overflow: visible;

              /* Layout */
              display: flex !important;
              flex-direction: column;
              justify-content: space-between;
            }


            /* Force prescribed medicines header text to white when printing */
            #prescription-print-content .prescribed-medicines-header,
            #prescription-print-content .prescribed-medicines-count {
              color: #ffffff !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            /* Ensure all children are visible */
            #prescription-print-content * {
              visibility: visible;
            }

            /* Content Area - allow it to take available space */
            #prescription-print-content > .flex-grow {
              flex-grow: 1;
              overflow: visible;
            }

            /* Footer Positioning - QR Code and Signature */
            #print-footer {
              visibility: visible !important;
              display: block !important;
              width: 100%;
              margin-top: auto !important;
              background: white;
              z-index: 10000;
              break-inside: avoid;
              page-break-inside: avoid;
            }

            #print-signatures {
               display: flex !important;
               justify-content: space-between !important;
               align-items: flex-end !important;
               width: 100% !important;
               visibility: visible !important;
               page-break-inside: avoid;
            }

            /* Ensure QR Code prints properly */
            #print-footer svg {
              visibility: visible !important;
              display: block !important;
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }

            /* Ensure signature image prints */
            #print-footer img {
              visibility: visible !important;
              display: block !important;
              max-height: 110px;
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }

            /* Helper to hide UI elements */
            .print-hide {
              display: none !important;
              visibility: hidden !important;
            }
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
        <div id="prescription-print-content" className="p-4 sm:p-8 bg-white text-gray-900 flex flex-col min-h-full">

          {/* Hospital Header */}
          <div className="flex flex-row justify-between items-center gap-3 border-b-4 border-blue-600 pb-1 mb-2">
            <div className="flex-1">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 mb-1">{hospital.name}</h1>
              <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-blue-600" />
                    {hospital.phone}
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-600" />
                    {hospital.email}
                  </div>
                </div>
              </div>
              <div className="mt-1 text-blue-800 font-semibold text-[10px] sm:text-xs uppercase tracking-wide">
                Patient Prescription
              </div>
            </div>
            <div className="flex flex-col items-end justify-start w-44 shrink-0">
              {hospital.logo ? (
                <img src={resolveAssetUrl(hospital.logo)} alt="Hospital Logo" className="h-32 sm:h-40 w-auto object-contain" />
              ) : (
                <span className="text-4xl sm:text-5xl font-bold text-blue-600 leading-none">℞</span>
              )}
            </div>
          </div>

          {/* Info Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-2 mb-6 sm:mb-8">
            {/* Patient Info */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider border-b border-gray-200 pb-2 mb-3">Patient Information</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div>
                  <span className="block text-xs font-bold text-blue-900">Name</span>
                  <span className="font-semibold text-gray-900">{patient.name}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-blue-900">Patient ID</span>
                  <span className="font-mono text-gray-900">{patient.patientId}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-blue-900">Age / Gender</span>
                  <span className="text-gray-900">{patient.age} Y / {patient.gender}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-blue-900">Date</span>
                  <span className="text-gray-900">{formatDate(prescriptionDate, hospital.timezone, hospital.calendarType)}</span>
                </div>
              </div>
            </div>

            {/* Doctor Info */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider border-b border-blue-200 pb-2 mb-3">Doctor Information</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div>
                  <span className="block text-xs font-bold text-blue-900">Doctor Name</span>
                  <span className="font-semibold text-gray-900">{doctor.name}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-blue-900">Registration No.</span>
                  <span className="text-gray-900">{doctor.registrationNumber || '-'}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-blue-900">Specialization</span>
                  <span className="text-gray-900">{doctor.specialization}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-blue-900">Prescription #</span>
                  <span className="font-mono font-bold text-gray-900">{prescriptionNumber}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Body Layout */}
          <div className="flex flex-col md:flex-row print:flex-row gap-4 lg:gap-6 mb-4 flex-grow print-content-grow">
            {/* Left Column: Diagnosis & Advice (30%) */}
            <div className="w-full md:w-[30%] print:w-[30%] flex flex-col gap-4 lg:gap-6 border-b md:border-b-0 print:border-b-0 md:border-r print:border-r border-gray-200 pb-4 md:pb-0 print:pb-0 lg:pr-6 print:pr-6">

              {/* Top Left: Diagnosis */}
                <div className="flex-1">
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
                 <div className="flex-1">
                   <div className="flex items-center gap-2 mb-2 border-b border-gray-200 pb-1">
                     <span className="text-amber-600 font-bold">⚠</span>
                     <h3 className="text-xs font-bold text-gray-700 uppercase">Note:</h3>
                   </div>
                   <div className="text-xs text-gray-800 rx-quill-content" dangerouslySetInnerHTML={{ __html: advice }} />
                 </div>
                ) : null}

            </div>

            {/* Right Column: Medicines Table (70%) */}
            <div className="w-full md:w-[70%] print:w-[70%]">
              <div
                className="bg-blue-600 text-white px-3 py-1.5 rounded-t-lg flex justify-between items-center mb-0"
                style={{ backgroundColor: hospital.brandColor }}
              >
                <h3 className="font-bold text-xs uppercase tracking-wide prescribed-medicines-header">Prescribed Medicines</h3>
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded prescribed-medicines-count">{medicines.length} Items</span>
              </div>
              <div className="overflow-x-auto border-x border-b border-gray-200">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase">
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
                    {medicines.map((med, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-2 py-1 border-b border-gray-100 text-gray-400">{index + 1}</td>
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
                    ))}
                    {/* Fill empty rows to maintain layout consistency if needed, though flex container handles height */}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer Section */}
          <div id="print-footer" className="mt-auto">
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
                  <img src={resolveAssetUrl(doctor.signature)} alt="Signature" className="h-28 mx-auto mb-1 object-contain" />
                ) : (
                  <div className="h-28 mb-1"></div>
                )}
                <div className="border-t border-gray-900 pt-1">
                  <p className="font-bold text-gray-900 text-sm">{doctor.name}</p>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wide">Doctor's Signature</p>
                </div>
              </div>
            </div>

            {/* Legal Footer */}
            <div className="text-center mt-8 pt-4 border-t border-gray-100 text-[10px] text-gray-400">
              <p className="font-medium text-gray-500">{hospital.name} • {hospital.address}</p>
              <p>License No: {hospital.license}</p>
              <p className="mt-1 italic">Powered by: Soft Care IT Solutions - Kabul Afghanistan. +93 789 68 10 10 | +93 70 102 1319 | +93 78 979 5964 | softcareitsolutions.com</p>
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