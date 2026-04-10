import React, { useRef, useEffect } from "react";
import { useReactToPrint } from "react-to-print";
import { X, Phone, Mail, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Hospital } from "../types";
import { Patient } from "../context/PatientContext";
import { Doctor } from "../context/DoctorContext";
import { useSettings } from "../context/SettingsContext";

interface PatientSurgeryItem {
  id: string;
  hospitalId: string;
  patientId: string;
  patientName: string;
  doctorId?: string;
  doctorName?: string;
  surgeryId: string;
  surgeryName: string;
  surgeryDate: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  paymentStatus: "pending" | "paid" | "partial" | "cancelled";
  cost: number;
  notes?: string;
  dischargeDate?: string;
  dischargeSummary?: string;
  dischargeCreatedBy?: string;
  dischargeCompletedBy?: string;
}

interface DischargeSummaryPrintProps {
  hospital: Hospital;
  patient: Patient | undefined;
  doctor: Doctor | undefined;
  surgeryItem: PatientSurgeryItem;
  printedBy: string;
  embedded?: boolean;
  onClose?: () => void;
}

const formatDate = (dateInput: Date | string, timezone?: string, calendarType?: string) => {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

export function DischargeSummaryPrint({
  hospital,
  patient,
  doctor,
  surgeryItem,
  printedBy,
  embedded = false,
  onClose,
}: DischargeSummaryPrintProps) {
  const componentRef = useRef<HTMLDivElement>(null);
  const { loadHospitalSetting, getPrescriptionPrintAssetSettings } = useSettings();

  useEffect(() => {
    if (!hospital?.id) return;
    loadHospitalSetting(hospital.id).catch(() => {});
  }, [hospital?.id, loadHospitalSetting]);

  const printAssetSettings = getPrescriptionPrintAssetSettings(hospital.id);
  const logoWidthPx = printAssetSettings.logoWidth || 176;
  const logoHeightPx = printAssetSettings.logoHeight || 160;
  const signatureWidthPx = printAssetSettings.signatureWidth || 200;
  const signatureHeightPx = printAssetSettings.signatureHeight || 112;

  const resolveAssetUrl = (path?: string | null): string => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const base = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api").replace("/api", "");
    const normalized = path.startsWith("/") ? path : `/${path}`;
    const withStorage = normalized.startsWith("/storage/") ? normalized : `/storage${normalized}`;
    return `${base}${withStorage}`;
  };

  const waitForPrintImages = async () => {
    const root = componentRef.current;
    if (!root) return;
    const images = Array.from(root.querySelectorAll("img"));
    if (!images.length) return;
    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) { resolve(); return; }
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          })
      )
    );
  };

  const pageStyle = `
    @page { size: A4; margin: 0; }
    body { visibility: hidden; background-color: white; margin: 0; padding: 0; }
    #discharge-print-content {
      visibility: visible; position: relative; width: 100%; height: auto;
      padding: 6mm 8mm 30mm 8mm !important; margin: 0; background: white;
      box-sizing: border-box !important; z-index: 9999; overflow: visible; display: block !important;
    }
    #discharge-print-content * { visibility: visible; }
    #print-footer {
      visibility: visible !important; display: block !important; position: fixed !important;
      left: 8mm; right: 8mm; bottom: 6mm; background: white; z-index: 10000;
      break-inside: avoid; page-break-inside: avoid; page-break-before: avoid;
    }
    #discharge-print-content .rx-print-logo {
      width: ${logoWidthPx}px !important; height: ${logoHeightPx}px !important; object-fit: contain !important;
    }
    #discharge-print-content .rx-print-signature {
      width: ${signatureWidthPx}px !important; height: ${signatureHeightPx}px !important; object-fit: contain !important;
    }
  `;

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    onBeforePrint: waitForPrintImages,
    pageStyle,
  });

  const renderHospitalHeader = (extraClassName = "mb-2") => (
    <div className={`flex flex-row justify-between items-center gap-3 border-b-4 border-blue-600 pb-1 ${extraClassName}`}>
      <div className="flex-1">
        <h1 className="text-lg sm:text-2xl font-bold text-gray-900 mb-1">{hospital.name}</h1>
        <div className="text-xs sm:text-sm text-gray-600 space-y-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-blue-600" />{hospital.phone}</div>
            <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-blue-600" />{hospital.email}</div>
          </div>
        </div>
        <div className="mt-1 text-blue-800 font-semibold text-[10px] sm:text-xs uppercase tracking-wide">
          Discharge Summary
        </div>
      </div>
      <div className="flex flex-col items-end justify-start shrink-0">
        {hospital.logo ? (
          <img src={resolveAssetUrl(hospital.logo)} alt="Hospital Logo" className="rx-print-logo max-h-32 sm:max-h-40 h-auto w-auto object-contain" />
        ) : (
          <span className="text-4xl sm:text-5xl font-bold text-blue-600 leading-none">➕</span>
        )}
      </div>
    </div>
  );

  const qrData = JSON.stringify({
    surgeryCase: `SURG-${surgeryItem.id}`,
    hospitalCode: hospital.code,
    patientId: patient?.patientId,
    doctorId: doctor?.id,
    dischargeDate: surgeryItem.dischargeDate
  });

  const completedByName = surgeryItem.dischargeCompletedBy || doctor?.name || surgeryItem.doctorName || "-";

  return (
    <div className={embedded ? "min-h-screen bg-white dark:bg-gray-900 py-4 px-3 sm:py-6 sm:px-4" : "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"}>
      <style>
        {`
          .rx-quill-content, .rx-quill-content p { margin: 0 0 6px 0; line-height: 1.5; white-space: pre-wrap; }
          .rx-quill-content p:empty:before, .rx-quill-content p br { content: "\\00a0"; display: inline-block; }
          .rx-quill-content p:last-child { margin-bottom: 0; }
          .rx-quill-content ul, .rx-quill-content ol { margin: 0 0 6px 16px; }
          .rx-quill-content li { margin: 0 0 4px 0; }
          @media print {
            .screen-only { display: none !important; visibility: hidden !important; }
          }
        `}
      </style>
      <div className={`bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl flex flex-col ${embedded ? "shadow-none" : "max-h-[90vh] overflow-y-auto shadow-2xl"}`}>
        {!embedded && (
          <div className="screen-only sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10 rounded-t-xl">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Print Discharge Summary</h2>
            <div className="flex gap-3">
              <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"><Printer className="w-4 h-4" />Print</button>
              <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
          </div>
        )}

        <div id="discharge-print-content" ref={componentRef} className="p-4 sm:p-8 bg-white text-gray-900 flex flex-col min-h-full">
          {renderHospitalHeader("mb-2")}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-2 mb-6 sm:mb-8">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider border-b border-gray-200 pb-2 mb-3">Patient Information</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div><span className="block text-xs font-bold text-blue-900">Name</span><span className="font-semibold text-gray-900">{patient?.name || surgeryItem.patientName}</span></div>
                <div><span className="block text-xs font-bold text-blue-900">Patient ID</span><span className="font-mono text-gray-900">{patient?.patientId || "N/A"}</span></div>
                <div><span className="block text-xs font-bold text-blue-900">Age / Gender</span><span className="text-gray-900">{patient?.age ? `${patient.age} Y` : "-"} / {patient?.gender || "-"}</span></div>
                <div><span className="block text-xs font-bold text-blue-900">Discharge Date</span><span className="text-gray-900">{surgeryItem.dischargeDate ? formatDate(surgeryItem.dischargeDate, hospital.timezone, hospital.calendarType) : "-"}</span></div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider border-b border-blue-200 pb-2 mb-3">Surgery Information</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div><span className="block text-xs font-bold text-blue-900">Doctor/Surgeon</span><span className="font-semibold text-gray-900">{doctor?.name || surgeryItem.doctorName || "N/A"}</span></div>
                <div><span className="block text-xs font-bold text-blue-900">Surgery Name</span><span className="text-gray-900">{surgeryItem.surgeryName}</span></div>
                <div><span className="block text-xs font-bold text-blue-900">Surgery Date</span><span className="text-gray-900">{formatDate(surgeryItem.surgeryDate, hospital.timezone, hospital.calendarType)}</span></div>
                <div><span className="block text-xs font-bold text-blue-900">Surgery Case #</span><span className="font-mono font-bold text-gray-900">SURG-{surgeryItem.id}</span></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 print:grid-cols-12 gap-4 lg:gap-6 mb-4 flex-grow print-content-grow">
            <div className="md:col-span-7 print:col-span-7 overflow-hidden">
              <div className="bg-blue-600 text-white px-3 py-1.5 rounded-t-lg mb-0">
                <h3 className="font-bold text-xs uppercase tracking-wide">Discharge Summary</h3>
              </div>
              <div className="border border-gray-200 rounded-b-lg p-3 min-h-[260px]">
                {surgeryItem.dischargeSummary ? (
                  <div className="text-sm text-gray-800 rx-quill-content" dangerouslySetInnerHTML={{ __html: surgeryItem.dischargeSummary }} />
                ) : (
                  <div className="text-sm text-gray-400 italic">No discharge summary provided.</div>
                )}
              </div>
            </div>

            <div className="md:col-span-5 print:col-span-5 overflow-hidden">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider border-b border-gray-200 pb-2 mb-3">Case Metadata</h3>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div>
                    <span className="block text-xs font-bold text-blue-900">Prepared By</span>
                    <span className="text-gray-900">{surgeryItem.dischargeCreatedBy || "-"}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-blue-900">Completed By</span>
                    <span className="text-gray-900">{completedByName}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-blue-900">Case</span>
                    <span className="font-mono text-gray-900">SURG-{surgeryItem.id}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-blue-900">Status</span>
                    <span className="text-gray-900 capitalize">{surgeryItem.status.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div id="print-footer" className="mt-auto">
            <div id="print-signatures" className="pt-6 sm:pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6 sm:gap-0">
              <div className="flex flex-col items-center">
                <div className="bg-white p-1 border border-gray-200 rounded-lg"><QRCodeSVG value={qrData} size={80} /></div>
                <span className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide">Scan Case</span>
              </div>
              
              <div className="flex gap-10">
                  <div className="text-center min-w-[150px]">
                    <div className="h-28 mb-1 flex items-end justify-center">
                       <span className="text-sm font-medium italic text-gray-600 mb-2">{completedByName}</span>
                    </div>
                    <div className="border-t border-gray-900 pt-1">
                      <p className="font-bold text-gray-900 text-sm">Completed By</p>
                      <p className="text-[10px] text-gray-600 uppercase tracking-wide">Authorized User</p>
                    </div>
                  </div>

                  <div className="text-center min-w-[150px]">
                    {doctor?.signature ? (
                      <img src={resolveAssetUrl(doctor.signature)} alt="Signature" className="rx-print-signature max-h-28 h-auto mx-auto mb-1 object-contain" />
                    ) : (
                      <div className="h-28 mb-1"></div>
                    )}
                    <div className="border-t border-gray-900 pt-1">
                      <p className="font-bold text-gray-900 text-sm">{doctor?.name || surgeryItem.doctorName || "Doctor"}</p>
                      <p className="text-[10px] text-gray-600 uppercase tracking-wide">Doctor / Surgeon</p>
                    </div>
                  </div>
              </div>
            </div>

            <div className="text-center mt-8 pt-4 border-t border-gray-100 text-[10px] text-gray-400">
              <p className="font-medium text-gray-500">{hospital.name} • {hospital.address}</p>
              <p>License No: {hospital.license}</p>
              <p>Printed By: {printedBy} on {new Date().toLocaleString()}</p>
              <p className="mt-1 italic">Powered by: Soft Care IT Solutions - Kabul Afghanistan. +93 789 68 10 10 | +93 70 102 1319 | +93 78 979 5964 | softcareitsolutions.com</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}