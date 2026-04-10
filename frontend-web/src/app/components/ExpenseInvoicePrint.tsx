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
  const voucherNo = String(expense.sequenceId);
  
  const [receiptSize, setReceiptSize] = React.useState<'a4' | '80mm' | '76mm' | '58mm'>(() => {
    return (localStorage.getItem('expense_receipt_size') as any) || 'a4';
  });

  React.useEffect(() => {
    localStorage.setItem('expense_receipt_size', receiptSize);
  }, [receiptSize]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    if (!printWindow) return;

    const escapeHtml = (unsafe: string) => (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const dateFormatted = formatDate(expense.expenseDate, hospital.timezone, hospital.calendarType);
    let html = '';

    if (receiptSize === 'a4') {
      html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Expense Voucher</title>
            <style>
              @page { size: a4 auto; margin: 10mm; }
              * { box-sizing: border-box; }
              html, body {
                margin: 0; padding: 0; width: 100%; background: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                color: #111827; -webkit-print-color-adjust: exact; print-color-adjust: exact;
              }
              .receipt { max-width: 190mm; margin: 0 auto; padding: 20px; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 20px; margin-bottom: 24px; }
              .h-name { font-size: 28px; font-weight: 800; margin: 0 0 8px 0; text-transform: uppercase; color: #000; }
              .h-contact { font-size: 14px; color: #4b5563; margin: 4px 0; }
              .v-box { background: #f3f4f6; padding: 12px 20px; border-radius: 8px; text-align: center; margin-bottom: 8px; display: inline-block;}
              .v-label { font-size: 11px; font-weight: bold; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;}
              .v-val { font-size: 22px; font-family: monospace; font-weight: bold; color: #111827; }
              .v-date { font-size: 14px; text-align: right; color: #4b5563; }
              .title-box { text-align: center; margin-bottom: 32px; }
              .title-text { font-size: 22px; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #f3f4f6; padding-bottom: 6px; display: inline-block; color: #1f2937;}
              .grid { display: flex; justify-content: space-between; gap: 40px; margin-bottom: 40px; }
              .col { flex: 1; }
              .sec-title { font-size: 13px; font-weight: bold; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 16px; }
              .field { margin-bottom: 16px; font-size: 15px; }
              .f-label { display: block; font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px; }
              .f-val { font-weight: bold; font-size: 18px; color: #111827;}
              .f-val-sm { font-weight: 500; font-size: 15px; color: #374151; }
              .badge { display: inline-block; padding: 4px 12px; background: #f3f4f6; border-radius: 99px; font-size: 13px; font-weight: bold; text-transform: uppercase; color: #374151;}
              table { width: 100%; border-collapse: collapse; margin-bottom: 48px; }
              th { background: #f9fafb; padding: 14px 16px; text-align: left; font-size: 13px; text-transform: uppercase; color: #4b5563; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
              td { padding: 16px; font-size: 15px; border-bottom: 1px solid #f3f4f6; color: #111827; }
              th.right, td.right { text-align: right; }
              .t-total { background: #f9fafb; border-top: 2px solid #e5e7eb; }
              .t-total td { padding: 18px 16px; font-weight: bold; font-size: 18px; text-transform: uppercase;}
              .t-total td.blue { color: #2563eb; font-size: 24px; }
              .signs { display: flex; justify-content: space-between; margin-top: 80px; gap: 80px; }
              .sign { border-top: 1px solid #d1d5db; padding-top: 12px; flex: 1; text-align: center; font-size: 15px; font-weight: 600; color: #111827;}
            </style>
          </head>
          <body>
            <div class="receipt">
              <div class="header">
                <div>
                  <h1 class="h-name">${escapeHtml(hospital.name)}</h1>
                  <p class="h-contact">${escapeHtml(hospital.address || 'Address not available')}</p>
                  <p class="h-contact">${escapeHtml(hospital.phone || 'Phone N/A')} | ${escapeHtml(hospital.email || 'Email N/A')}</p>
                </div>
                <div style="text-align: right;">
                  <div class="v-box">
                    <span class="v-label">Voucher No</span>
                    <span class="v-val">${escapeHtml(voucherNo)}</span>
                  </div>
                  <div class="v-date">Date: <strong>${escapeHtml(dateFormatted)}</strong></div>
                </div>
              </div>

              <div class="title-box">
                <span class="title-text">Expense Voucher</span>
              </div>

              <div class="grid">
                <div class="col">
                  <div class="sec-title">Expense Details</div>
                  <div class="field"><span class="f-label">Title / Purpose</span><div class="f-val">${escapeHtml(expense.title)}</div></div>
                  <div class="field"><span class="f-label">Category</span><div class="f-val-sm">${escapeHtml(categoryName)}</div></div>
                  ${expense.notes ? `<div class="field"><span class="f-label">Notes / Description</span><div class="f-val-sm">${escapeHtml(expense.notes)}</div></div>` : ''}
                </div>
                <div class="col">
                  <div class="sec-title">Payment Details</div>
                  <div class="field"><span class="f-label">Payment Method</span><div class="badge">${escapeHtml(expense.paymentMethod || 'Cash')}</div></div>
                  ${expense.reference ? `<div class="field"><span class="f-label">Reference / Trans. ID</span><div class="f-val-sm monospace">${escapeHtml(expense.reference)}</div></div>` : ''}
                  <div class="field"><span class="f-label">Status</span><div class="badge">${escapeHtml(expense.status)}</div></div>
                </div>
              </div>

              <table>
                <thead><tr><th>#</th><th>Description</th><th class="right">Amount</th></tr></thead>
                <tbody><tr><td>1</td><td><strong>${escapeHtml(expense.title)}</strong></td><td class="right"><strong>${expense.amount.toFixed(2)}</strong></td></tr></tbody>
                <tfoot><tr class="t-total"><td colspan="2" class="right">Total Amount</td><td class="right blue">${expense.amount.toFixed(2)}</td></tr></tfoot>
              </table>

              <div class="signs">
                <div class="sign">Authorize Signature</div>
                <div class="sign">Receiver Signature</div>
              </div>
            </div>
          </body>
        </html>
      `;
    } else {
      const paperWidth = receiptSize;
      const baseFont = receiptSize === '58mm' ? 10 : receiptSize === '76mm' ? 11 : 12;
      
      html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Expense Voucher</title>
            <style>
              @page { size: ${paperWidth} auto; margin: 0; }
              * { box-sizing: border-box; }
              html, body {
                margin: 0; padding: 0; width: ${paperWidth}; background: #fff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact;
              }
              .receipt { padding: 4mm 2mm; display: flex; flex-direction: column; gap: 6px; }
              .header { text-align: left; padding-bottom: 4px; border-bottom: 1px dashed #ccc; margin-bottom: 4px; }
              .h-name { font-size: ${baseFont + 4}px; font-weight: 800; line-height: 1.2; text-transform: uppercase; margin: 0 0 2px 0; }
              .h-contact { font-size: ${baseFont - 2}px; margin: 2px 0; }
              .title { font-size: ${baseFont + 2}px; font-weight: bold; text-transform: uppercase; text-align: center; margin: 6px 0; background: #000; color: #fff; padding: 4px; line-height: 1;}
              .meta { font-size: ${baseFont}px; margin-bottom: 6px; display: flex; justify-content: space-between; }
              .row { margin-bottom: 4px; font-size: ${baseFont}px; }
              .label { font-size: ${baseFont - 2}px; color: #555; text-transform: uppercase; display: block; margin-bottom: 1px;}
              .val { font-weight: bold; }
              table { width: 100%; border-collapse: collapse; margin: 8px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; }
              th { text-align: left; font-size: ${baseFont - 2}px; text-transform: uppercase; padding: 4px 0; border-bottom: 1px dashed #000; }
              th.right { text-align: right; }
              td { font-size: ${baseFont}px; padding: 4px 0; font-weight: bold; }
              td.right { text-align: right; }
              .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-weight: bold; font-size: ${baseFont + 2}px; border-bottom: 1px dashed #000; margin-bottom: 12px;}
              .sign-box { margin-top: 24px; text-align: center; }
              .sign-line { border-top: 1px solid #000; padding-top: 4px; font-size: ${baseFont - 1}px; width: 80%; margin: 0 auto; }
            </style>
          </head>
          <body>
            <div class="receipt">
              <div class="header">
                <h1 class="h-name">${escapeHtml(hospital.name)}</h1>
                <p class="h-contact">${escapeHtml(hospital.address || 'Address not available')}</p>
                <p class="h-contact">${escapeHtml(hospital.phone || '')}</p>
              </div>
              <div class="title">Expense Voucher</div>
              <div class="meta">
                <span>No: ${escapeHtml(voucherNo)}</span>
                <span>Date: ${escapeHtml(dateFormatted)}</span>
              </div>
              
              <div class="row"><span class="label">Purpose / Title</span><span class="val">${escapeHtml(expense.title)}</span></div>
              <div class="row"><span class="label">Category</span><span class="val">${escapeHtml(categoryName)}</span></div>
              <div class="row"><span class="label">Payment</span><span class="val">${escapeHtml(expense.paymentMethod || 'Cash')}</span></div>
              ${expense.reference ? `<div class="row"><span class="label">Reference</span><span class="val">${escapeHtml(expense.reference)}</span></div>` : ''}
              ${expense.notes ? `<div class="row"><span class="label">Notes</span><span class="val">${escapeHtml(expense.notes)}</span></div>` : ''}
              
              <table>
                <thead><tr><th>Description</th><th class="right">Amt</th></tr></thead>
                <tbody><tr><td>${escapeHtml(expense.title)}</td><td class="right">${expense.amount.toFixed(2)}</td></tr></tbody>
              </table>

              <div class="total-row">
                <span>TOTAL</span>
                <span>${expense.amount.toFixed(2)}</span>
              </div>

              <div class="sign-box">
                <div class="sign-line">Receiver Signature</div>
              </div>
            </div>
          </body>
        </html>
      `;
    }

    printWindow.document.write(html);
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
      pdf.save(`Expense_Voucher_${voucherNo.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`);
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
            <select
              title="Receipt size"
              value={receiptSize}
              onChange={(e) => setReceiptSize(e.target.value as any)}
              className="mr-2 text-sm border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white py-1.5 px-3"
            >
              <option value="a4">A4 Size</option>
              <option value="80mm">80mm Thermal</option>
              <option value="76mm">76mm Thermal</option>
              <option value="58mm">58mm Thermal</option>
            </select>
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
                  <span className="text-xl font-mono font-bold text-gray-900">{voucherNo}</span>
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
