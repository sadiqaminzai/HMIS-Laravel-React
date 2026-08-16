import React from 'react';
import { X, Printer, Phone, Mail, MapPin } from 'lucide-react';
import { Hospital, LabTest, TestTemplate, Patient, Doctor } from '../types';
import { formatOnlyDate } from '../utils/date';
import { useSettings } from '../context/SettingsContext';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { POWERED_BY_TEXT, poweredByStyle } from '../utils/receiptBranding';

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
  /**
   * The lab receipt is handed to the patient at the counter, so it follows the
   * hospital's configured paper size (Settings > Print) like every other
   * counter document. It used to be hardcoded to A4, which meant a thermal
   * printer received a full-page layout and produced an unreadable slip.
   */
  const { getPrintPaperSize } = useSettings();
  const paperSize = getPrintPaperSize(hospital.id, 'lab_invoice');
  const isThermal = paperSize !== 'a4' && paperSize !== 'a5';
  
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

  /**
   * Prints in a window of its own rather than via window.print() on the app
   * page. Printing in place could never work reliably here: the global
   * styles/print.css declares `@page { size: A4; margin: 10mm }` for the whole
   * application, and an @page rule cannot be overridden by specificity or
   * !important -- only by cascade order, which we do not control because Vite
   * decides when the bundle's CSS is injected. On top of that the modal's
   * fixed overlay and its backdrop-filter each establish a containing block,
   * so the receipt anchored to the modal instead of the sheet. A dedicated
   * document has neither problem: nothing but the receipt is in it, and our
   * @page is the last one the parser sees.
   */
  const openPrintWindow = (markup: string) => {
    const win = window.open('', '_blank', 'width=420,height=640');
    if (!win) {
      // Pop-up blocked -- printing in place is wrong on thermal paper, so say
      // so rather than silently producing a mis-sized receipt.
      window.alert('Please allow pop-ups for this site to print the receipt.');
      return;
    }

    // The app bundle is deliberately NOT loaded for thermal receipts. It
    // carries `@page { size: A4; margin: 10mm }` from styles/print.css, and an
    // @page rule cannot be beaten by specificity or !important -- verified by
    // rendering this document with and without the bundle: with it, the sheet
    // comes out A4 no matter what we declare. A4 invoices keep the bundle,
    // since A4 is what they want anyway.
    const styles = isThermal
      ? ''
      : Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
          .filter((node) => node.id !== 'lab-invoice-modal-print-css')
          .map((node) => node.outerHTML)
          .join('\n');

    // Without the bundle the receipt needs the handful of utility classes it
    // actually uses. Small enough to keep honest, and it removes the async
    // stylesheet load that had to be waited on before printing.
    const thermalUtilities = `
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .font-bold { font-weight: 700; }
      .font-semibold { font-weight: 600; }
      .uppercase { text-transform: uppercase; }
      .leading-tight { line-height: 1.15; }
      .break-words { overflow-wrap: anywhere; word-break: break-word; }
      .flex { display: flex; }
      .justify-between { justify-content: space-between; }
      .pb-1 { padding-bottom: 4px; }
      .bg-white { background: #ffffff; }
      .text-black { color: #000000; }
      .mx-auto { margin-left: auto; margin-right: auto; }
      .shadow-sm { box-shadow: none; }
    `;

    win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>Lab Invoice</title>
    ${styles}
    <style>
      ${isThermal ? thermalUtilities : ''}
      * { box-sizing: border-box; }
      @page { size: ${isThermal ? `${paperSize} auto` : paperSize === 'a5' ? 'A5' : 'A4'}; margin: 0; }
      html, body {
        width: ${isThermal ? paperSize : 'auto'};
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff;
      }
      #lab-invoice-content {
        position: static !important;
        width: ${isThermal ? '100%' : 'auto'} !important;
        min-height: 0 !important;
        height: auto !important;
        max-width: none !important;
        margin: 0 !important;
        padding: ${isThermal ? '2mm 0 0' : '10mm'} !important;
        box-shadow: none !important;
      }
    </style>
  </head>
  <body>${markup}</body>
</html>`);
    win.document.close();

    // A4 pulls in the app bundle, which is fetched asynchronously; printing
    // before it lands gives an unstyled invoice. Thermal is self-contained.
    const run = () => {
      win.focus();
      win.print();
      win.close();
    };
    if (win.document.readyState === 'complete') {
      setTimeout(run, 250);
    } else {
      win.onload = () => setTimeout(run, 250);
    }
  };

  const handlePrint = () => {
    // Captured before onPrint, which settles the payment and unmounts this
    // modal -- by the time it resolves the node is gone.
    const markup = document.getElementById('lab-invoice-content')?.outerHTML ?? '';
    onPrint?.();
    openPrintWindow(markup);
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
    <div id="lab-invoice-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <style id="lab-invoice-modal-print-css">
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #lab-invoice-content, #lab-invoice-content * {
              visibility: visible;
            }
            html, body {
              width: ${isThermal ? paperSize : 'auto'} !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }
            /* The receipt is positioned absolutely so the hidden rest of the
               page cannot push it around. That only anchors it to the paper if
               no ancestor establishes a containing block -- and this modal has
               two that do: the fixed overlay and its backdrop-filter. Left as
               they are, the receipt inherits the overlay's centred box and
               prints small and inset. */
            #lab-invoice-overlay,
            #lab-invoice-card,
            #lab-invoice-card > div {
              position: static !important;
              display: block !important;
              width: auto !important;
              max-width: none !important;
              max-height: none !important;
              overflow: visible !important;
              margin: 0 !important;
              padding: 0 !important;
              background: none !important;
              backdrop-filter: none !important;
              filter: none !important;
              transform: none !important;
              box-shadow: none !important;
              border-radius: 0 !important;
            }
            #lab-invoice-content {
              position: absolute;
              left: 0;
              top: 0;
              width: ${isThermal ? paperSize : '100%'} !important;
              min-height: 0 !important;
              max-width: none !important;
              margin: 0 !important;
              padding: ${isThermal ? '0' : '20px'} !important;
              background: white;
              display: block !important;
              overflow: visible !important;
            }
            @page {
              size: ${isThermal ? `${paperSize} auto` : paperSize === 'a5' ? 'A5' : 'A4'};
              margin: 0;
            }
          }
        `}
      </style>

      <div id="lab-invoice-card" className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
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
        {isThermal ? (
          /*
            Thermal receipt. A roll is 58-80mm wide, so the two-column A4 layout
            below cannot be reused: everything is a single stacked column, the
            figures are monospaced so they line up, and colour is dropped because
            thermal printers are monochrome.
          */
          <div
            id="lab-invoice-content"
            className="bg-white mx-auto shadow-sm text-black print:shadow-none"
            style={{
              width: paperSize,
              padding: '2mm 0 0',
              // Monospace only for the figures, not the whole slip. Setting it
              // globally made every label look like terminal output, which is
              // what gave the old receipt its cramped, unfinished feel.
              fontFamily: "'Segoe UI', Tahoma, Verdana, sans-serif",
              fontSize: paperSize === '58mm' ? '10px' : '11.5px',
              lineHeight: 1.35,
            }}
          >
            <div className="text-center pb-1">
              <div className="font-bold uppercase leading-tight" style={{ fontSize: '1.35em', letterSpacing: '0.02em' }}>
                {hospital.name}
              </div>
              {hospital.address && <div style={{ fontSize: '0.85em' }}>{hospital.address}</div>}
              {hospital.phone && <div style={{ fontSize: '0.85em' }}>{hospital.phone}</div>}
            </div>

            <div
              className="text-center font-bold uppercase"
              style={{ fontSize: '1.05em', letterSpacing: '0.18em', borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '3px 0', margin: '4px 0' }}
            >
              Laboratory Receipt
            </div>

            {/* Patient on the left, receipt identity on the right. Stacked
                label/value rows used six full-width lines for what fits in
                four half-width ones, which matters most on a roll where every
                line is paper. */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="font-bold uppercase" style={{ fontSize: '0.8em', letterSpacing: '0.06em', borderBottom: '1px solid #000', marginBottom: '2px' }}>
                  Patient
                </div>
                {[
                  ['Name', labTest.patientName],
                  ['ID', labTest.patientDisplayId || labTest.patientId],
                  ['Age / Sex', `${labTest.patientAge} / ${labTest.patientGender}`],
                ].map(([label, value]) => (
                  <div key={String(label)} style={{ marginBottom: '1px' }}>
                    <span style={{ color: '#000', fontSize: '0.85em' }}>{label}: </span>
                    <span className="font-semibold break-words">{value}</span>
                  </div>
                ))}
              </div>

              <div style={{ width: '1px', alignSelf: 'stretch', background: '#000' }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="font-bold uppercase" style={{ fontSize: '0.8em', letterSpacing: '0.06em', borderBottom: '1px solid #000', marginBottom: '2px' }}>
                  Invoice
                </div>
                {[
                  ['No', labTest.testNumber],
                  ['Date', formatOnlyDate(new Date(), hospital.timezone, hospital.calendarType)],
                  ['Referred By', labTest.doctorName],
                ].map(([label, value]) => (
                  <div key={String(label)} style={{ marginBottom: '1px' }}>
                    <span style={{ color: '#000', fontSize: '0.85em' }}>{label}: </span>
                    <span className="font-semibold break-words">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="flex justify-between font-bold uppercase"
              style={{ fontSize: '0.85em', letterSpacing: '0.08em', borderTop: '1px solid #000', borderBottom: '1px dashed #000', padding: '3px 0', margin: '6px 0 3px' }}
            >
              <span>Test</span><span>Amount</span>
            </div>

            {invoiceItems.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', padding: '2px 0' }}>
                {/* Name wraps, amount never does. */}
                <span className="break-words" style={{ flex: 1 }}>
                  {idx + 1}. {item.name}
                </span>
                <span className="font-semibold" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {item.price.toFixed(2)}
                </span>
              </div>
            ))}

            <div style={{ borderTop: '1px dashed #000', margin: '5px 0 3px' }} />

            <div className="flex justify-between"><span style={{ color: '#000' }}>Subtotal</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{subtotal.toFixed(2)}</span></div>
            {discountAmount > 0 && (
              <div className="flex justify-between"><span style={{ color: '#000' }}>Discount</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>-{discountAmount.toFixed(2)}</span></div>
            )}
            {tax > 0 && (
              <div className="flex justify-between"><span style={{ color: '#000' }}>Tax</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{tax.toFixed(2)}</span></div>
            )}

            <div
              className="flex justify-between font-bold"
              style={{ fontSize: '1.25em', borderTop: '2px solid #000', marginTop: '4px', paddingTop: '4px' }}
            >
              <span>TOTAL</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{total.toFixed(2)}</span>
            </div>

            {labTest.status === 'unpaid' && (
              <div
                className="text-center font-bold uppercase"
                style={{ letterSpacing: '0.2em', border: '1px solid #000', padding: '3px 0', margin: '7px 0' }}
              >
                Unpaid
              </div>
            )}

            <div className="text-center" style={{ fontSize: '0.82em', borderTop: '1px dashed #000', paddingTop: '4px' }}>
              <div>Please keep this receipt to collect your report.</div>
              <div style={{ marginTop: '2px' }}>Thank you</div>
              <div style={poweredByStyle(true)}>{POWERED_BY_TEXT}</div>
            </div>
          </div>
        ) : (
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
                  Date: <span className="font-medium text-gray-900">{formatOnlyDate(new Date(), hospital.timezone, hospital.calendarType)}</span>
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
        )}
        </div>
      </div>
    </div>
  );
}