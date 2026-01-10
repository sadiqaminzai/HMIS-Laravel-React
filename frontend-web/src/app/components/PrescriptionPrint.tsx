import React, { useRef } from 'react';
import { X, Phone, Mail, MapPin, Printer } from 'lucide-react';
import { Hospital, Patient, Doctor, PrescriptionMedicine } from '../types';
import { instructionOptions } from '../data/mockData';
import { QRCodeSVG } from 'qrcode.react';
import { formatDate } from '../utils/date';


interface PrescriptionPrintProps {
  hospital: Hospital;
  patient: Patient;
  doctor: Doctor;
  medicines: PrescriptionMedicine[];
  advice: string;
  prescriptionNumber: string;
  diagnosis?: string;
  prescriptionDate?: Date;
  onClose: () => void;
  viewOnly?: boolean;
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
  createdBy,
  updatedAt,
  updatedBy
}: PrescriptionPrintProps) {
  
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
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
              height: 297mm; /* Exact A4 Height */
              padding: 20mm !important;
              margin: 0;
              background: white;
              box-sizing: border-box !important; /* CRITICAL FIX */
              z-index: 9999;
              
              /* Layout */
              display: flex !important;
              flex-direction: column;
              justify-content: space-between;
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

            /* Footer Positioning */
            #print-footer {
              width: 100%;
              margin-top: auto !important; /* Ensure it stays at bottom */
              background: white; /* Ensure it's not transparent over other things */
              z-index: 10000;
              break-inside: avoid;
            }
            
            /* Helper to hide UI elements */
            .print-hide {
              display: none !important;
            }
          }
        `}
      </style>

      {/* Main Container */}
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        
        {/* Header - Screen Only */}
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

        {/* Printable Content */}
        <div id="prescription-print-content" className="p-8 bg-white text-gray-900 flex flex-col min-h-full">
          
          {/* Hospital Header */}
          <div className="flex justify-between items-start border-b-4 border-blue-600 pb-6 mb-8">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{hospital.name}</h1>
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  {hospital.address}
                </div>
                <div className="flex items-center gap-4">
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
            </div>
            <div className="flex flex-col items-center justify-center w-24 h-24 bg-blue-50 border-2 border-blue-600 rounded-lg">
              <span className="text-5xl font-bold text-blue-600 leading-none">℞</span>
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mt-1">Prescription</span>
            </div>
          </div>

          {/* Info Cards Grid */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Patient Info */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-2 mb-3">Patient Information</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div>
                  <span className="block text-xs text-gray-500">Name</span>
                  <span className="font-semibold text-gray-900">{patient.name}</span>
                </div>
                <div>
                  <span className="block text-xs text-gray-500">Patient ID</span>
                  <span className="font-mono text-gray-900">{patient.patientId}</span>
                </div>
                <div>
                  <span className="block text-xs text-gray-500">Age / Gender</span>
                  <span className="text-gray-900">{patient.age} Y / {patient.gender}</span>
                </div>
                <div>
                  <span className="block text-xs text-gray-500">Date</span>
                  <span className="text-gray-900">{formatDate(prescriptionDate, hospital.timezone, hospital.calendarType)}</span>
                </div>
              </div>
            </div>

            {/* Doctor Info */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider border-b border-blue-200 pb-2 mb-3">Doctor Information</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="col-span-2">
                  <span className="block text-xs text-blue-400">Doctor Name</span>
                  <span className="font-semibold text-gray-900">{doctor.name}</span>
                </div>
                <div>
                  <span className="block text-xs text-blue-400">Specialization</span>
                  <span className="text-gray-900">{doctor.specialization}</span>
                </div>
                <div>
                  <span className="block text-xs text-blue-400">Prescription #</span>
                  <span className="font-mono font-bold text-gray-900">{prescriptionNumber}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Body Layout */}
          <div className="flex flex-row gap-6 mb-4 flex-grow print-content-grow">
            {/* Left Column: Diagnosis & Advice (30%) */}
            <div className="w-[30%] flex flex-col gap-6 border-r border-gray-200 pr-6">
              
              {/* Top Left: Diagnosis */}
              <div className="flex-1">
                 <div className="flex items-center gap-2 mb-2 border-b border-gray-200 pb-1">
                    <span className="text-lg text-blue-600 font-serif leading-none">Dx</span>
                    <h3 className="text-xs font-bold text-gray-700 uppercase">Diagnosis</h3>
                 </div>
                 {diagnosis ? (
                   <div className="text-xs text-gray-800" dangerouslySetInnerHTML={{ __html: diagnosis }} />
                 ) : (
                   <div className="text-xs text-gray-400 italic">No diagnosis recorded</div>
                 )}
              </div>

              {/* Bottom Left: Advice */}
              <div className="flex-1">
                 <div className="flex items-center gap-2 mb-2 border-b border-gray-200 pb-1">
                    <span className="text-amber-600 font-bold">⚠</span>
                    <h3 className="text-xs font-bold text-gray-700 uppercase">Advice</h3>
                 </div>
                 {advice ? (
                   <div className="text-xs text-gray-800" dangerouslySetInnerHTML={{ __html: advice }} />
                 ) : (
                   <div className="text-xs text-gray-400 italic">No specific advice</div>
                 )}
              </div>

            </div>

            {/* Right Column: Medicines Table (70%) */}
            <div className="w-[70%]">
              <div 
                className="bg-blue-600 text-white px-3 py-1.5 rounded-t-lg flex justify-between items-center mb-0"
                style={{ backgroundColor: hospital.brandColor }}
              >
                <h3 className="font-bold text-xs uppercase tracking-wide">Prescribed Medicines</h3>
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded text-white">{medicines.length} Items</span>
              </div>
              <table className="w-full border-collapse border-x border-b border-gray-200">
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
                      <td className="px-2 py-1 border-b border-gray-100 font-medium">
                        {med.medicineName}
                        {med.type && !med.medicineName.includes(med.type) && (
                          <span className="font-normal text-gray-500 ml-1">{med.type}</span>
                        )}
                        <span className="text-[9px] text-gray-500 block font-normal leading-tight">{med.strength}</span>
                      </td>
                      <td className="px-2 py-1 border-b border-gray-100 whitespace-nowrap">
                        <span className="inline-block px-1 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-semibold border border-blue-100">
                          {med.dose}
                        </span>
                      </td>
                      <td className="px-2 py-1 border-b border-gray-100 whitespace-nowrap">{med.duration}</td>
                      <td className="px-2 py-1 border-b border-gray-100 text-gray-600 truncate max-w-[80px]" title={getInstructionLabel(med.instruction)}>
                        {getInstructionLabel(med.instruction)}
                      </td>
                      <td className="px-2 py-1 border-b border-gray-100 text-center font-medium">{med.quantity}</td>
                    </tr>
                  ))}
                  {/* Fill empty rows to maintain layout consistency if needed, though flex container handles height */}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Section */}
          <div id="print-footer" className="mt-auto">
            <div className="pt-8 border-t border-gray-200 flex items-end justify-between">
              {/* QR Code */}
              <div className="flex flex-col items-center">
                <div className="bg-white p-1 border border-gray-200 rounded-lg">
                  <QRCodeSVG value={qrData} size={80} />
                </div>
                <span className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide">Scan to Verify</span>
              </div>

              {/* Signature */}
              <div className="text-center min-w-[200px]">
                {doctor.signature ? (
                  <img src={doctor.signature} alt="Signature" className="h-14 mx-auto mb-1 object-contain" />
                ) : (
                  <div className="h-14 mb-1"></div>
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
              <p className="mt-1 italic">This is a computer-generated prescription and does not require a physical signature if digitally signed.</p>
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