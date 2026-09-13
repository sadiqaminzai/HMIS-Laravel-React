import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, RotateCcw, X } from 'lucide-react';

interface ReturnPaymentDialogProps {
  /** Null keeps the dialog closed. */
  open: boolean;
  patientName?: string | null;
  /** What was billed: the study, service or exam type. */
  itemName?: string | null;
  receiptNo?: string | number | null;
  amount: number;
  paidBy?: string | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

const money = (value: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

/**
 * "Are you sure?" before a collected payment is put back.
 *
 * The desks used the browser's own prompt for this, which the browser pins to
 * the top of the window, styles however it likes, and dismisses on Enter with
 * whatever was half-typed. Returning money is the one action on these desks
 * that erases a record of cash taken, so it gets a proper centred dialog that
 * says exactly which receipt and how much, and will not proceed without a
 * reason -- the backend refuses one anyway.
 */
export function ReturnPaymentDialog({
  open,
  patientName,
  itemName,
  receiptNo,
  amount,
  paidBy,
  busy = false,
  onCancel,
  onConfirm,
}: ReturnPaymentDialogProps) {
  const [reason, setReason] = useState('');
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  // A fresh reason every time it opens, and the cursor already in the field.
  useEffect(() => {
    if (!open) return;
    setReason('');
    const timer = setTimeout(() => reasonRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const trimmed = reason.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed || busy) return;
    onConfirm(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="return-payment-title"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-lg bg-white shadow-2xl dark:bg-gray-800"
      >
        <div className="flex items-start gap-3 px-5 pt-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="return-payment-title" className="text-sm font-bold text-gray-900 dark:text-white">
              Return this payment?
            </h3>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              Are you sure? The receipt will go back to <span className="font-semibold">Unpaid</span> and
              the collected amount will be removed from today&apos;s takings.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50"
            title="Close"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <dl className="mx-5 mt-4 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs dark:border-gray-700 dark:bg-gray-700/30">
          {patientName && (
            <>
              <dt className="text-gray-500 dark:text-gray-400">Patient</dt>
              <dd className="font-medium text-gray-900 dark:text-white truncate">{patientName}</dd>
            </>
          )}
          {itemName && (
            <>
              <dt className="text-gray-500 dark:text-gray-400">For</dt>
              <dd className="font-medium text-gray-900 dark:text-white truncate">{itemName}</dd>
            </>
          )}
          {receiptNo !== undefined && receiptNo !== null && receiptNo !== '' && (
            <>
              <dt className="text-gray-500 dark:text-gray-400">Receipt No</dt>
              <dd className="font-medium text-gray-900 dark:text-white">#{receiptNo}</dd>
            </>
          )}
          {paidBy && (
            <>
              <dt className="text-gray-500 dark:text-gray-400">Collected by</dt>
              <dd className="font-medium text-gray-900 dark:text-white truncate">{paidBy}</dd>
            </>
          )}
          <dt className="text-gray-500 dark:text-gray-400">Amount</dt>
          <dd className="font-bold text-red-600 dark:text-red-400 tabular-nums">{money(amount)} AFN</dd>
        </dl>

        <div className="px-5 mt-4">
          <label htmlFor="return-payment-reason" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            id="return-payment-reason"
            ref={reasonRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={255}
            required
            disabled={busy}
            placeholder="e.g. Patient refunded, exam cancelled"
            className="w-full px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-red-500 outline-none disabled:opacity-60"
          />
          <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">Kept with the receipt for the audit trail.</p>
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
          <button
            type="submit"
            disabled={!trimmed || busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            {busy ? 'Returning…' : 'Yes, Return Payment'}
          </button>
        </div>
      </form>
    </div>
  );
}
