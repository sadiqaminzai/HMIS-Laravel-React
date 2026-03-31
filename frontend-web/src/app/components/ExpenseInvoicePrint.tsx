import React from 'react';
import { X, Printer, Phone, Mail, MapPin } from 'lucide-react';
import { Hospital, Expense } from '../types';
import { formatDate } from '../utils/date';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

interface ExpenseInvoicePrintProps {
  hospital: Hospital;
  expense: Expense;
  categoryName: string;
  onClose: () => void;
}

export function ExpenseInvoicePrint({
  hospital,
  expense,
  categoryName,
  onClose
}: ExpenseInvoicePrintProps) {
  
  const handlePrint = () => {
    const element = document.getElementById('expense-voucher-content');
    if (!element) return;

    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Expense Voucher</title>
          <style>
            html, body { margin: 0; padding: 0; background: #ffffff; font-family: Arial, sans-serif; }
            #expense-voucher-content { width: 100%; box-sizing: border-box; padding: 24px; color: #111827; }
            @page { margin: 10mm; }
          </style>
        </head>
        <body>${element.outerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('expense-voucher-content');
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
      pdf.save(`Expense_Voucher_${expense.id.substring(0, 8)}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #expense-voucher-content, #expense-voucher-content * {
              visibility: visible;
            }
            #expense-voucher-content {
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
            Voucher Preview
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
              title="Close"
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Content */}
        <div className="overflow-y-auto flex-1 bg-gray-100 dark:bg-gray-900 p-6">
          <div id="expense-voucher-content" className="bg-white mx-auto max-w-[210mm] min-h-[297mm] p-8 shadow-sm text-gray-900">
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{hospital.name}</h1>
                <div className="text-sm text-gray-600 space-y-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    {hospital.address || 'Address not available'}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      {hospital.phone || 'N/A'}
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      {hospital.email || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="bg-gray-100 px-4 py-2 rounded-lg inline-block text-center mb-2">
                  <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Voucher No</span>
                  <span className="text-xl font-mono font-bold text-gray-900">EXP-{expense.id.toString().padStart(6, '0')}</span>
                </div>
                <div className="text-sm text-gray-500">
                  Date: <span className="font-medium text-gray-900">{formatDate(expense.expenseDate, hospital.timezone, hospital.calendarType)}</span>
                </div>
              </div>
            </div>

            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wide border-b-2 border-gray-100 pb-2 inline-block">Expense Voucher</h2>
            </div>

            {/* Voucher Info */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 pb-1 border-b border-gray-200">Expense Details</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="block text-gray-500 text-xs uppercase">Title / Purpose</span>
                    <p className="font-bold text-lg text-gray-900">{expense.title}</p>
                  </div>
                  <div>
                    <span className="block text-gray-500 text-xs uppercase">Category</span>
                    <p className="text-gray-800 font-medium">{categoryName}</p>
                  </div>
                  {expense.notes && (
                    <div>
                        <span className="block text-gray-500 text-xs uppercase">Notes / Description</span>
                        <p className="text-gray-600">{expense.notes}</p>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 pb-1 border-b border-gray-200">Payment Details</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="block text-gray-500 text-xs uppercase">Payment Method</span>
                    <span className="inline-block px-3 py-1 bg-gray-100 rounded-full font-medium text-gray-800">
                      {expense.paymentMethod || 'Cash'}
                    </span>
                  </div>
                  {expense.reference && (
                    <div>
                        <span className="block text-gray-500 text-xs uppercase">Reference / Trans. ID</span>
                        <p className="font-mono text-gray-800">{expense.reference}</p>
                    </div>
                  )}
                  <div>
                    <span className="block text-gray-500 text-xs uppercase">Status</span>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase ${
                        expense.status === 'approved' ? 'text-green-600 bg-green-50' : 
                        expense.status === 'pending' ? 'text-amber-600 bg-amber-50' : 
                        'text-red-600 bg-red-50'
                    }`}>
                      {expense.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Amount Table */}
            <div className="mb-12">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wider text-left border-y border-gray-200">
                    <th className="py-3 px-4 w-16">#</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 w-40 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                   <tr>
                      <td className="py-4 px-4 text-gray-500">1</td>
                      <td className="py-4 px-4 font-medium text-gray-900">{expense.title}</td>
                      <td className="py-4 px-4 text-right font-bold text-gray-900">{expense.amount.toFixed(2)}</td>
                   </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200">
                    <td colSpan={2} className="py-4 px-4 text-right font-bold text-lg text-gray-900 uppercase">Total Amount</td>
                    <td className="py-4 px-4 text-right font-bold text-xl text-blue-600">
                      {expense.amount.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-12 mt-20 pt-8">
                <div className="border-t border-gray-300 pt-2 text-center">
                    <p className="text-sm font-medium text-gray-900">Authorize Signature</p>
                </div>
                 <div className="border-t border-gray-300 pt-2 text-center">
                    <p className="text-sm font-medium text-gray-900">Receiver Signature</p>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-8 border-t border-gray-200 text-center text-xs text-gray-500">
              <p>Generated by ShifaaScript Hospital Management System</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
