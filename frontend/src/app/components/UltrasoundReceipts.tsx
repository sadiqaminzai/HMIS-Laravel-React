import React, { useMemo, useState } from 'react';
import { Printer, Wallet, RotateCcw, Loader2, Receipt, ScanLine, Trash2 } from 'lucide-react';
import { Hospital } from '../types';
import { UltrasoundExamApi, payUltrasoundExam, reverseUltrasoundPayment, deleteUltrasoundExam } from '../api/ultrasound';
import { toast } from 'sonner';
import { POWERED_BY_TEXT } from '../utils/receiptBranding';
import { ReturnPaymentDialog } from './ReturnPaymentDialog';
import { ReceiptDetailsModal, ReceiptDetails } from './ReceiptDetailsModal';
import { formatOnlyDate } from '../utils/date';
import {
  CellNumber,
  CellStack,
  DataTableBody,
  DataTableCard,
  DataTableHead,
  EditIcon,
  ViewIcon,
  RowIcon,
  TableAction,
  TableEmpty,
  TablePill,
  Th,
  Tr,
  usePagination,
  useTableSort,
} from './DataTable';

interface Props {
  hospital: Hospital;
  exams: UltrasoundExamApi[];
  paperSize: string;
  canTakePayment: boolean;
  canReversePayment: boolean;
  canPrintReceipt: boolean;
  canDelete: boolean;
  /** Edit Receipt: corrects the receipt, never the report. */
  canEdit: boolean;
  onEdit: (exam: UltrasoundExamApi) => void;
  onChanged: () => void;
}

const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(value ?? 0)
  );

/** Payment state to pill colour, shared with the X-Ray desk. */
const paymentTone = (status: string): 'green' | 'amber' | 'red' =>
  status === 'paid' ? 'green' : status === 'partial' ? 'amber' : 'red';

/**
 * What the patient owes: the fee less any discount.
 *
 * The desk used to collect, print and total the gross fee, so a discounted
 * exam was charged in full and printed without its discount.
 */
const payable = (exam: UltrasoundExamApi) => Number(exam.net_amount ?? exam.fee ?? 0);

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
  canDelete,
  canEdit,
  onEdit,
  onChanged,
}: Props) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingExam, setDeletingExam] = useState<UltrasoundExamApi | null>(null);
  const [payingExam, setPayingExam] = useState<UltrasoundExamApi | null>(null);
  const [method, setMethod] = useState('cash');

  const isThermal = paperSize !== 'a4' && paperSize !== 'a5';

  const outstanding = useMemo(
    () => exams.filter((exam) => exam.payment_status !== 'paid').length,
    [exams]
  );

  // Sorted and paged like every other listing. Newest first by default, which
  // is what a counter wants: the receipt just raised is the one being settled.
  const sort = useTableSort<any>(exams, 'created_at', 'desc');
  const { page, setPage, totalPages, pageRows } = usePagination<any>(sort.rows, 20);

  const takePayment = async (exam: UltrasoundExamApi) => {
    setBusyId(exam.id);
    setError(null);
    try {
      await payUltrasoundExam(exam.id, {
        paid_amount: payable(exam),
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

  const confirmDelete = async () => {
    if (!deletingExam) return;
    setBusyId(deletingExam.id);
    setError(null);
    try {
      await deleteUltrasoundExam(deletingExam.id);
      const label = deletingExam.patient?.name
        ? `Receipt #${deletingExam.id} (${deletingExam.patient.name}) deleted`
        : `Receipt #${deletingExam.id} deleted`;
      setDeletingExam(null);
      onChanged();
      // Says so out loud: the row simply vanishing from the list looks the
      // same as the click not registering.
      toast.success(label);
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to delete the receipt';
      setError(message);
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  };

  // The exam open in the read-only details card.
  const [viewingExam, setViewingExam] = useState<UltrasoundExamApi | null>(null);

  /** Everything the details card shows, from the exam and its type. */
  const detailsFor = (exam: UltrasoundExamApi): ReceiptDetails => ({
    title: 'Ultrasound Receipt',
    receiptNo: String(exam.receipt_number || exam.sequence_id || exam.id).replace(/^US-/, ''),
    date: formatOnlyDate(exam.examined_at, hospital.timezone, hospital.calendarType),
    paymentStatus: exam.payment_status,
    patient: exam.patient,
    doctorName: exam.doctor?.name,
    referredBy: exam.referred_by,
    itemsLabel: 'Exam',
    items: [{
      name: exam.ultrasound_type?.name ?? 'Ultrasound',
      description: exam.ultrasound_type?.description,
      fee: exam.fee,
    }],
    fee: exam.fee,
    discountAmount: exam.discount_amount,
    discountPercentage: exam.discount_percentage,
    fullWaiver: Boolean(exam.discount_enabled),
    netAmount: payable(exam),
    paidAmount: exam.paid_amount,
    paymentMethod: exam.payment_method,
    notes: exam.clinical_notes,
    // The report itself stays with the radiologist's tab; the card only says
    // where the exam stands and who finished it.
    extra: [
      { label: 'Exam Status', value: <span className="capitalize">{exam.status}</span> },
    ],
    history: [
      { label: 'Created', who: exam.created_by, when: exam.created_at },
      { label: 'Last updated', who: exam.updated_by, when: exam.updated_at },
      { label: 'Payment taken', who: exam.paid_by, when: exam.paid_at },
      { label: 'Report completed', who: exam.completed_by, when: exam.completed_at },
    ],
  });

  // The exam whose payment is being returned, while the dialog asks.
  const [returningExam, setReturningExam] = useState<UltrasoundExamApi | null>(null);

  /** Put a collected payment back, once the dialog has a reason for it. */
  const confirmReturn = async (reason: string) => {
    if (!returningExam) return;
    const exam = returningExam;

    setBusyId(exam.id);
    setError(null);
    try {
      await reverseUltrasoundPayment(exam.id, reason);
      setReturningExam(null);
      onChanged();
      toast.success('Payment returned');
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Could not return the payment.';
      setError(message);
      toast.error(message);
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
    const discount = Number(exam.discount_amount ?? 0);
    const percent = Number(exam.discount_percentage ?? 0);

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

    ${discount > 0 ? `<div class="line"><span class="v">Discount${percent > 0 ? ` (${percent}%)` : ''}</span><span class="v">-${money(discount)}</span></div>` : ''}

    <div class="total"><span>TOTAL</span><span>${money(payable(exam))}</span></div>

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
    <div className="space-y-3">
      {error && <p className="px-1 text-xs text-red-600">{error}</p>}

      {outstanding > 0 && (
        <p className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {outstanding} exam{outstanding === 1 ? '' : 's'} awaiting payment.
        </p>
      )}

      <DataTableCard
        total={exams.length}
        shown={pageRows.length}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noun="receipts"
        maxHeight="calc(100vh - 320px)"
      >
        <DataTableHead>
          <Th sort={sort} field="examined_at">Receipt / Date</Th>
          <Th>Patient</Th>
          <Th>Ultrasound Type</Th>
          <Th sort={sort} field="fee" align="right">Fee</Th>
          <Th align="right">Discount</Th>
          <Th sort={sort} field="net_amount" align="right">Net</Th>
          <Th sort={sort} field="payment_status">Payment</Th>
          <Th align="center">Actions</Th>
        </DataTableHead>
        <DataTableBody>
          {(pageRows as UltrasoundExamApi[]).map((exam) => (
            <Tr key={exam.id}>
              <td className="px-4 py-2">
                <div className="flex items-center gap-3">
                  <RowIcon tone="blue">
                    <Receipt className="w-4 h-4" />
                  </RowIcon>
                  <CellStack
                    primary={formatOnlyDate(exam.examined_at, hospital.timezone, hospital.calendarType)}
                    secondary={`#${String(exam.receipt_number || exam.sequence_id || exam.id).replace(/^US-/, '')}`}
                  />
                </div>
              </td>
              <td className="px-4 py-2">
                <CellStack
                  primary={exam.patient?.name ?? '-'}
                  secondary={`${exam.patient?.age ?? '-'} Y / ${exam.patient?.gender ?? '-'}`}
                />
              </td>
              <td className="px-4 py-2">
                <TablePill tone="purple">{exam.ultrasound_type?.name ?? '-'}</TablePill>
              </td>
              <td className="px-4 py-2 text-right">
                <CellNumber>{money(exam.fee)}</CellNumber>
              </td>
              <td className="px-4 py-2 text-right">
                {Number(exam.discount_amount ?? 0) > 0 ? (
                  <span className="text-[10px] font-medium text-orange-600 dark:text-orange-400">
                    {money(exam.discount_amount)}
                    {Number(exam.discount_percentage ?? 0) > 0 && ` (${Number(exam.discount_percentage)}%)`}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 py-2 text-right">
                <CellNumber tone="money">{money(payable(exam))}</CellNumber>
              </td>
              <td className="px-4 py-2">
                <TablePill tone={paymentTone(exam.payment_status)}>{exam.payment_status}</TablePill>
                {exam.paid_by && (
                  <div className="text-[10px] text-gray-500 mt-0.5">by {exam.paid_by}</div>
                )}
              </td>
              <td className="px-4 py-2 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  {canTakePayment && exam.payment_status !== 'paid' && (
                    <TableAction
                      tone="success"
                      title="Take payment"
                      disabled={busyId === exam.id}
                      onClick={() => setPayingExam(exam)}
                    >
                      {busyId === exam.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Wallet className="w-3.5 h-3.5" />
                      )}
                    </TableAction>
                  )}
                  <TableAction tone="view" title="View details" onClick={() => setViewingExam(exam)}>
                    <ViewIcon />
                  </TableAction>
                  {canPrintReceipt && (
                    <TableAction tone="edit" title="Print receipt" onClick={() => printReceipt(exam)}>
                      <Printer className="w-3.5 h-3.5" />
                    </TableAction>
                  )}
                  {canEdit && (
                    <TableAction tone="primary" title="Edit receipt" onClick={() => onEdit(exam)}>
                      <EditIcon />
                    </TableAction>
                  )}
                  {canReversePayment && exam.payment_status === 'paid' && (
                    <TableAction
                      tone="delete"
                      title="Reverse payment"
                      disabled={busyId === exam.id}
                      onClick={() => setReturningExam(exam)}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </TableAction>
                  )}
                  {/* Gated on delete_ultrasound_exams. Confirmed first: a
                      receipt is a financial record and the row gives no other
                      way back once it is gone. */}
                  {canDelete && (
                    <TableAction
                      tone="delete"
                      title="Delete receipt"
                      disabled={busyId === exam.id}
                      onClick={() => setDeletingExam(exam)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </TableAction>
                  )}
                </div>
              </td>
            </Tr>
          ))}

          {exams.length === 0 && (
            <TableEmpty
              colSpan={8}
              message="No ultrasound receipts yet"
              hint="Receipts appear here once reception raises one."
              icon={<ScanLine className="w-6 h-6 text-gray-400" />}
            />
          )}
        </DataTableBody>
      </DataTableCard>

      <ReceiptDetailsModal
        details={viewingExam ? detailsFor(viewingExam) : null}
        onClose={() => setViewingExam(null)}
        onPrint={viewingExam && canPrintReceipt ? () => printReceipt(viewingExam) : undefined}
      />

      <ReturnPaymentDialog
        open={Boolean(returningExam)}
        patientName={returningExam?.patient?.name}
        itemName={returningExam?.ultrasound_type?.name}
        receiptNo={returningExam ? String(returningExam.receipt_number || returningExam.sequence_id || returningExam.id).replace(/^US-/, '') : null}
        amount={Number(returningExam?.paid_amount ?? returningExam?.net_amount ?? returningExam?.fee ?? 0)}
        paidBy={returningExam?.paid_by}
        busy={Boolean(returningExam && busyId === returningExam.id)}
        onCancel={() => setReturningExam(null)}
        onConfirm={confirmReturn}
      />

      {payingExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-sm p-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Take Payment</h3>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {payingExam.patient?.name} &mdash; {payingExam.ultrasound_type?.name}
            </p>
            {Number(payingExam.discount_amount ?? 0) > 0 && (
              <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                Fee {money(payingExam.fee)} less discount {money(payingExam.discount_amount)}
                {Number(payingExam.discount_percentage ?? 0) > 0 && ` (${Number(payingExam.discount_percentage)}%)`}
              </p>
            )}
            <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">{money(payable(payingExam))}</p>

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

            {payable(payingExam) <= 0 && (
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
                disabled={busyId === payingExam.id || payable(payingExam) <= 0}
                className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                Confirm &amp; Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deleting a receipt removes a financial record, so it asks first and
          names what is going -- the row it came from is already gone from the
          screen by the time anyone notices a mistake. */}
      {deletingExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-sm p-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Delete Receipt</h3>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Receipt #{deletingExam.id} &mdash; {deletingExam.patient?.name}
              {deletingExam.ultrasound_type?.name ? ` (${deletingExam.ultrasound_type.name})` : ''}
            </p>
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              This cannot be undone.
              {deletingExam.payment_status === 'paid'
                ? ' This receipt is marked paid; deleting it removes the record of that payment.'
                : ''}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeletingExam(null)}
                className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={busyId === deletingExam.id}
                className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {busyId === deletingExam.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
