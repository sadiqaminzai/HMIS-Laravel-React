import React, { useMemo, useState } from 'react';
import { Printer, Wallet, RotateCcw, Loader2 } from 'lucide-react';
import { Hospital } from '../types';
import { UltrasoundExamApi, payUltrasoundExam, reverseUltrasoundPayment } from '../api/ultrasound';
import { POWERED_BY_TEXT } from '../utils/receiptBranding';
import { formatOnlyDate } from '../utils/date';

interface Props {
  hospital: Hospital;
  exams: UltrasoundExamApi[];
  paperSize: string;
  canTakePayment: boolean;
  canReversePayment: boolean;
  canPrintReceipt: boolean;
  onChanged: () => void;
}

const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(value ?? 0)
  );

const paymentStyles: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  unpaid: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

/**
 * The reception counter's view of ultrasound.
 *
 * Deliberately separate from the exam list: the person taking the fee needs the
 * bill, the payment state and the receipt, and has no business in the clinical
 * report. The specialist's tab shows only exams this one has settled.
 */
export function UltrasoundReceipts({
  hospital,
  exams,
  paperSize,
  canTakePayment,
  canReversePayment,
  canPrintReceipt,
  onChanged,
}: Props) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payingExam, setPayingExam] = useState<UltrasoundExamApi | null>(null);
  const [method, setMethod] = useState('cash');

  const isThermal = paperSize !== 'a4' && paperSize !== 'a5';

  const outstanding = useMemo(
    () => exams.filter((exam) => exam.payment_status !== 'paid').length,
    [exams]
  );

  const takePayment = async (exam: UltrasoundExamApi) => {
    setBusyId(exam.id);
    setError(null);
    try {
      await payUltrasoundExam(exam.id, {
        paid_amount: Number(exam.fee ?? 0),
        payment_method: method,
      });
      setPayingExam(null);
      onChanged();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Payment failed.');
    } finally {
      setBusyId(null);
    }
  };

  const reverse = async (exam: UltrasoundExamApi) => {
    // The backend requires a reason; asking for it here keeps the reversal
    // auditable rather than sending a placeholder.
    const reason = window.prompt('Reason for reversing this payment:');
    if (!reason) return;

    setBusyId(exam.id);
    setError(null);
    try {
      await reverseUltrasoundPayment(exam.id, reason);
      onChanged();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not reverse the payment.');
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Thermal receipt, in a window of its own so the application's stylesheet
   * cannot impose its page size.
   */
  const printReceipt = (exam: UltrasoundExamApi) => {
    const win = window.open('', '_blank', 'width=420,height=640');
    if (!win) {
      window.alert('Please allow pop-ups for this site to print the receipt.');
      return;
    }

    const receiptNo = String(exam.receipt_number || exam.sequence_id || exam.id).replace(/^US-/, '');
    const paid = exam.payment_status === 'paid';

    win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>Ultrasound Receipt</title>
    <style>
      @page { size: ${isThermal ? `${paperSize} auto` : 'A4'}; margin: 0; }
      * { box-sizing: border-box; }
      html, body { width: ${isThermal ? paperSize : 'auto'}; margin: 0; padding: 0; background: #fff; }
      body { font-family: 'Segoe UI', Tahoma, Verdana, sans-serif; color: #000; font-size: ${isThermal ? '10.5px' : '12px'}; line-height: 1.3; padding: ${isThermal ? '2mm 0 0' : '12mm'}; }
      .center { text-align: center; }
      .name { font-size: 1.3em; font-weight: 700; text-transform: uppercase; line-height: 1.15; }
      .sub { font-size: 0.85em; }
      .title { text-align: center; font-weight: 700; text-transform: uppercase; font-size: 0.9em; letter-spacing: 0.12em; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 2px 0; margin: 3px 0; }
      .cols { display: flex; gap: 4px; align-items: flex-start; }
      .col { flex: 1; min-width: 0; }
      .col-head { font-weight: 700; text-transform: uppercase; font-size: 0.72em; letter-spacing: 0.05em; border-bottom: 1px solid #000; margin-bottom: 2px; }
      .k { color: #000; font-size: 0.78em; }
      .v { color: #000; font-weight: 600; font-size: 0.85em; overflow-wrap: anywhere; }
      .sep { width: 1px; align-self: stretch; background: #000; }
      .line { display: flex; justify-content: space-between; padding: 2px 0; font-size: 0.9em; }
      .total { display: flex; justify-content: space-between; font-weight: 700; font-size: 1.1em; border-top: 2px solid #000; margin-top: 6px; padding-top: 4px; }
      .foot { text-align: center; font-size: 0.78em; border-top: 1px dashed #000; padding-top: 4px; margin-top: 6px; }
      .brand { text-align: center; font-style: italic; font-weight: 600; font-size: 9px; color: #000; margin-top: 4px; }
    </style>
  </head>
  <body>
    <div class="center">
      <div class="name">${hospital.name || ''}</div>
      ${hospital.address ? `<div class="sub">${hospital.address}</div>` : ''}
      ${hospital.phone ? `<div class="sub">${hospital.phone}</div>` : ''}
    </div>

    <div class="title">Ultrasound Receipt</div>

    <div class="cols">
      <div class="col">
        <div class="col-head">Patient</div>
        <div><span class="k">Name: </span><span class="v">${exam.patient?.name ?? '-'}</span></div>
        <div><span class="k">ID: </span><span class="v">${exam.patient?.patient_id ?? exam.patient_id}</span></div>
        <div><span class="k">Age / Sex: </span><span class="v">${exam.patient?.age ?? '-'} / ${exam.patient?.gender ?? '-'}</span></div>
        <div><span class="k">Referred By: </span><span class="v">${exam.referred_by || exam.doctor?.name || '-'}</span></div>
      </div>
      <div class="sep"></div>
      <div class="col">
        <div class="col-head">Receipt</div>
        <div><span class="k">No: </span><span class="v">${receiptNo}</span></div>
        <div><span class="k">Date: </span><span class="v">${formatOnlyDate(new Date().toISOString(), hospital.timezone, hospital.calendarType)}</span></div>
        ${paid ? '' : '<div><span class="k">Status: </span><span class="v">Unpaid</span></div>'}
      </div>
    </div>

    <div class="line" style="margin-top:6px;border-top:1px solid #000;padding-top:4px">
      <span class="v">${exam.ultrasound_type?.name ?? 'Ultrasound'}</span>
      <span class="v">${money(exam.fee)}</span>
    </div>

    <div class="total"><span>TOTAL</span><span>${money(exam.fee)}</span></div>

    ${paid ? '' : '<div style="text-align:center;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;border:1px solid #000;padding:2px 0;margin:6px 0;font-size:0.9em">Unpaid</div>'}

    <div class="foot">
      <div>Please keep this receipt for your examination.</div>
      <div class="brand">${POWERED_BY_TEXT}</div>
    </div>
    <script>
      window.onload = function () {
        setTimeout(function () { window.focus(); window.print(); window.close(); }, 250);
      };
    </script>
  </body>
</html>`);
    win.document.close();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {error && <p className="px-4 py-2 text-xs text-red-600">{error}</p>}

      {outstanding > 0 && (
        <p className="px-4 py-2 text-xs text-amber-700 dark:text-amber-400 border-b border-gray-200 dark:border-gray-700">
          {outstanding} exam{outstanding === 1 ? '' : 's'} awaiting payment.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
          <thead className="bg-gray-50 dark:bg-gray-700/50 uppercase font-medium text-gray-500 dark:text-gray-300">
            <tr>
              <th className="px-4 py-2">Receipt / Date</th>
              <th className="px-4 py-2">Patient</th>
              <th className="px-4 py-2">Ultrasound Type</th>
              <th className="px-4 py-2 text-right">Fee</th>
              <th className="px-4 py-2">Payment</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {exams.map((exam) => (
              <tr key={exam.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="px-4 py-2">
                  <div className="font-mono text-[10px] text-gray-400">
                    {String(exam.receipt_number || exam.sequence_id || exam.id).replace(/^US-/, '')}
                  </div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {formatOnlyDate(exam.examined_at, hospital.timezone, hospital.calendarType)}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="font-semibold text-gray-900 dark:text-white uppercase">
                    {exam.patient?.name ?? '-'}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {exam.patient?.age ?? '-'} Y / {exam.patient?.gender ?? '-'}
                  </div>
                </td>
                <td className="px-4 py-2">{exam.ultrasound_type?.name ?? '-'}</td>
                <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">
                  {money(exam.fee)}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                      paymentStyles[exam.payment_status] ?? paymentStyles.unpaid
                    }`}
                  >
                    {exam.payment_status}
                  </span>
                  {exam.paid_by && (
                    <div className="text-[10px] text-gray-500 mt-0.5">by {exam.paid_by}</div>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end gap-1">
                    {canTakePayment && exam.payment_status !== 'paid' && (
                      <button
                        onClick={() => setPayingExam(exam)}
                        disabled={busyId === exam.id}
                        className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-md transition-colors"
                        title="Take payment"
                      >
                        {busyId === exam.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Wallet className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                    {canPrintReceipt && (
                      <button
                        onClick={() => printReceipt(exam)}
                        className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                        title="Print receipt"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canReversePayment && exam.payment_status === 'paid' && (
                      <button
                        onClick={() => reverse(exam)}
                        disabled={busyId === exam.id}
                        className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-md transition-colors"
                        title="Reverse payment"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {exams.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No ultrasound receipts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {payingExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-sm p-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Take Payment</h3>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {payingExam.patient?.name} &mdash; {payingExam.ultrasound_type?.name}
            </p>
            <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">{money(payingExam.fee)}</p>

            <label className="block mt-3 text-xs text-gray-600 dark:text-gray-300">
              Payment Method
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-white"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="transfer">Transfer</option>
              </select>
            </label>

            {Number(payingExam.fee ?? 0) <= 0 && (
              <p className="mt-2 text-xs text-amber-600">
                This exam has no fee set. Set the fee on the exam before taking payment.
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPayingExam(null)}
                className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => takePayment(payingExam)}
                disabled={busyId === payingExam.id || Number(payingExam.fee ?? 0) <= 0}
                className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                Confirm &amp; Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
