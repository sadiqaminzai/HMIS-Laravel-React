import React from 'react';
import { createPortal } from 'react-dom';
import { X, Printer } from 'lucide-react';
import { LabTest, Hospital, TestTemplate } from '../types';
import { LabReportTemplate } from './LabReportTemplate';

interface LabReportPrintNewProps {
  test: LabTest;
  testTemplates?: TestTemplate[];
  hospital: Hospital;
  onClose?: () => void;
  onPrint?: () => void;
}

export function LabReportPrintNew({ test, hospital, onClose, onPrint }: LabReportPrintNewProps) {
  const handlePrint = () => {
    window.print();
    onPrint?.();
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:p-0 print:bg-white print:static print:block">
      {/* Inline Print Styles */}
      <style>{`
        @media print {
          /* Hide main app root */
          #root, .app-root, body > div:not(.print-portal) {
            display: none !important;
          }

          /* Reset body for clean print */
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }

          /* Ensure portal is visible */
          .print-portal {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            z-index: 9999 !important;
          }

          /* The modal wrapper becomes the print container */
          .print-modal-wrapper {
             width: 100% !important;
             height: auto !important;
             position: relative !important;
             overflow: visible !important;
             display: block !important;
          }
          
          @page {
            size: A4;
            margin: 15mm;
          }
          
          /* Show only the print content and its parents */
          .print-content {
            display: block;
            width: 100%;
            height: auto;
            margin: 0 !important;
            padding: 0 !important;
            background: white;
            box-sizing: border-box;
          }
          
          /* Preserve all colors and styles */
          * {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
          }
          
          /* Table styles */
          .print-content table {
            border-collapse: collapse;
            width: 100%;
            page-break-inside: auto;
          }
          
          .print-content tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          
          .print-content thead {
            display: table-header-group;
          }

          .print-content tbody {
             display: table-row-group;
          }
          
          .print-content th,
          .print-content td {
            border: 1px solid #d1d5db;
            padding: 6px 8px;
            text-align: left;
          }
          
          /* Preserve text colors */
          .print-content .text-gray-900, .print-content h1, .print-content h2, .print-content h3 { color: #111827 !important; }
          .print-content .text-gray-600 { color: #4b5563 !important; }
          .print-content .text-gray-700 { color: #374151 !important; }
          .print-content .text-gray-500 { color: #6b7280 !important; }
          
          /* Preserve backgrounds */
          .print-content .bg-gray-100 { background-color: #f3f4f6 !important; }
          .print-content .bg-gray-50 { background-color: #f9fafb !important; }
          .print-content .bg-white { background-color: white !important; }
          
          /* Preserve borders */
          .print-content .border-gray-800 { border-color: #1f2937 !important; }
          .print-content .border-gray-300 { border-color: #d1d5db !important; }
          .print-content .border-gray-400 { border-color: #9ca3af !important; }
          .print-content .border-gray-200 { border-color: #e5e7eb !important; }
          /* Note: .border-brand color is handled by LabReportTemplate style props if needed, or we might need to inject dynamic CSS for brand color if it's not inline */
          
          /* Preserve border widths */
          .print-content .border-b-2 { border-bottom-width: 2px !important; }
          .print-content .border-t-2 { border-top-width: 2px !important; }
          .print-content .border-l-4 { border-left-width: 4px !important; }
          .print-content .border { border-width: 1px !important; }
          
          /* Remove shadows */
          * { box-shadow: none !important; text-shadow: none !important; }
          
          /* Ensure QR code canvas is visible */
          .print-content canvas { display: block !important; visibility: visible !important; }
          
          /* Push footer to bottom */
          .print-content .mt-8.border-t-2 {
            margin-top: 2rem !important;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-5xl max-h-[95vh] flex flex-col print-modal-wrapper print:shadow-none print:max-h-none print:w-full">
        {/* Header with Actions - Hide on Print */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 print:hidden">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Lab Test Report</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{test.testNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 text-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Report
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Preview Content - This will be printed */}
        <div className="flex-1 overflow-y-auto p-6 print:p-0 print:overflow-visible">
          <LabReportTemplate test={test} hospital={hospital} />
        </div>
      </div>
    </div>
  );

  // Use a portal to render the modal at the document body level
  return createPortal(
    <div className="print-portal relative z-[9999]">
      {modalContent}
    </div>,
    document.body
  );
}
