import React from 'react';
import { X, Printer, Phone, Mail, MapPin } from 'lucide-react';
import { Hospital, LabTest, TestTemplate, Patient, Doctor } from '../types';
import { formatDate } from '../utils/date';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

interface LabInvoicePrintProps {
  hospital: Hospital;
  patient: Patient | undefined;
  doctor: Doctor | undefined;
  labTest: LabTest;
  testTemplates: TestTemplate[];
  onClose: () => void;
  onPrint?: () => void; // Optional, defaults to window.print()
}

export function LabInvoicePrint({
  hospital,
  patient,
  doctor,
  labTest,
  testTemplates,
  onClose,
  onPrint
}: LabInvoicePrintProps) {
  
  // Calculate financials
  const invoiceItems = labTest.selectedTests.map(testId => {
    const template = testTemplates.find(t => t.id === testId);
    return {
      name: template?.testName || 'Unknown Test',
      price: template?.price || 0,
      code: template?.testCode || '-'
    };
  });

  const subtotal = invoiceItems.reduce((sum, item) => sum + item.price, 0);
  const discountAmount = Math.min(Math.max(Number(labTest.discountAmount || 0), 0), subtotal);
  const tax = 0; // Assuming 0 for now or hospital configured
  const total = Number.isFinite(labTest.totalAmount)
    ? Number(labTest.totalAmount)
    : Math.max(0, subtotal - discountAmount + tax);

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('lab-invoice-content');
    if (!element) return;

    try {
      const dataUrl = await toPng(element, { quality: 0.95, backgroundColor: '#ffffff' });
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Invoice_${labTest.testNumber}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #lab-invoice-content, #lab-invoice-content * {
              visibility: visible;
            }
            #lab-invoice-content {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 20px;
              background: white;
              display: block !important;
            }
            @page {
              size: auto;
              margin: 0;
            }
          }
        `}
      </style>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header - Screen Only */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 print:hidden">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            Invoice Preview
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
            >
              Download PDF
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Print
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Content */}
        <div className="overflow-y-auto flex-1 bg-gray-100 dark:bg-gray-900 p-6">
          <div id="lab-invoice-content" className="bg-white mx-auto max-w-[210mm] min-h-[297mm] p-8 shadow-sm text-gray-900">
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2" style={{ color: hospital.brandColor }}>{hospital.name}</h1>
                <div className="text-sm text-gray-600 space-y-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    {hospital.address}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      {hospital.phone}
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      {hospital.email}
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="bg-gray-100 px-4 py-2 rounded-lg inline-block text-center mb-2">
                  <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Invoice No</span>
                  <span className="text-xl font-mono font-bold text-gray-900">INV-{labTest.testNumber}</span>
                </div>
                <div className="text-sm text-gray-500">
                  Date: <span className="font-medium text-gray-900">{formatDate(new Date(), hospital.timezone, hospital.calendarType)}</span>
                </div>
              </div>
            </div>

            {/* Bill To Info */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 pb-1 border-b border-gray-200">Bill To (Patient)</h3>
                <div className="space-y-1 text-sm">
                  <p className="font-bold text-lg text-gray-900">{labTest.patientName}</p>
                  <p className="text-gray-600">ID: {labTest.patientDisplayId || labTest.patientId}</p>
                  <p className="text-gray-600">{labTest.patientAge} Years / {labTest.patientGender}</p>
                  {patient?.phone && <p className="text-gray-600">Phone: {patient.phone}</p>}
                  {patient?.address && <p className="text-gray-600">{patient.address}</p>}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 pb-1 border-b border-gray-200">Prescribed By</h3>
                <div className="space-y-1 text-sm">
                  <p className="font-bold text-lg text-gray-900">{labTest.doctorName}</p>
                  {doctor?.specialization && <p className="text-gray-600">{doctor.specialization}</p>}
                  <p className="text-gray-600">Hospital: {hospital.name}</p>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wider text-left border-y border-gray-200">
                    <th className="py-3 px-4 w-16">#</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 w-32 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoiceItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-3 px-4 text-gray-500">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900">{item.name}</span>
                        <span className="block text-xs text-gray-500">Code: {item.code}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-gray-900">
                        {item.price.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td colSpan={2} className="py-3 px-4 text-right font-bold text-gray-600">Subtotal</td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900">{subtotal.toFixed(2)}</td>
                  </tr>
                  {discountAmount > 0 && (
                    <tr>
                      <td colSpan={2} className="py-2 px-4 text-right text-gray-600">Discount</td>
                      <td className="py-2 px-4 text-right text-green-700">- {discountAmount.toFixed(2)}</td>
                    </tr>
                  )}
                  {tax > 0 && (
                    <tr>
                      <td colSpan={2} className="py-2 px-4 text-right text-gray-600">Tax</td>
                      <td className="py-2 px-4 text-right text-gray-900">{tax.toFixed(2)}</td>
                    </tr>
                  )}
                  <tr className="bg-gray-50">
                    <td colSpan={2} className="py-4 px-4 text-right font-bold text-lg text-gray-900 uppercase">Total Amount</td>
                    <td className="py-4 px-4 text-right font-bold text-xl text-blue-600">
                      {total.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Payment Status */}
            <div className="mb-12 flex justify-end">
              <div className="border-2 border-green-500 text-green-600 px-6 py-2 rounded-lg font-bold text-xl uppercase tracking-widest transform -rotate-6 opacity-80">
                {labTest.status === 'unpaid' ? 'UNPAID' : 'PAID'}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-8 border-t border-gray-200 text-center text-xs text-gray-500">
              <p className="font-bold mb-1">Terms & Conditions</p>
              <p>Payment is due upon receipt. Please make checks payable to {hospital.name}.</p>
              <p className="mt-4">Thank you for your business!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
