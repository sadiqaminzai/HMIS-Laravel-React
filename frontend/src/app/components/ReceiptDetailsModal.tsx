import React, { useEffect } from 'react';
import { CalendarDays, FileText, Printer, Receipt, Stethoscope, User, Wallet, X } from 'lucide-react';
import { AuditTrail } from './ui/FormControls';

export interface ReceiptDetailsItem {
  name: string;
  /** The catalogue description, typically the hospital's own wording. */
  description?: string | null;
  fee: number | string;
}

export interface ReceiptDetails {
  /** e.g. "X-Ray Receipt". */
  title: string;
  receiptNo: string | number;
  /** Already formatted in the hospital's timezone and calendar. */
  date: string;
  paymentStatus: string;
  patient?: {
    name?: string | null;
    patient_id?: string | null;
    age?: number | string | null;
    gender?: string | null;
    phone?: string | null;
  } | null;
  doctorName?: string | null;
  referredBy?: string | null;
  /** What was billed; the label above the list ("Studies", "Exam"). */
  itemsLabel: string;
  items: ReceiptDetailsItem[];
  fee: number | string;
  discountAmount?: number | string | null;
  discountPercentage?: number | string | null;
  fullWaiver?: boolean;
  netAmount: number | string;
  paidAmount?: number | string | null;
  paymentMethod?: string | null;
  notes?: string | null;
  /** Desk-specific facts shown beside the doctor, e.g. an exam's status. */
  extra?: Array<{ label: string; value: React.ReactNode }>;
  history: Array<{ label: string; who?: string | null; when?: string | Date | null }>;
}

interface ReceiptDetailsModalProps {
  details: ReceiptDetails | null;
  onClose: () => void;
  /** Shown only when the user may print. */
  onPrint?: () => void;
}

const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value ?? 0));

const STATUS_STYLE: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  unpaid: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-0.5 truncate text-xs font-medium text-gray-900 dark:text-white">{children}</dd>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
        {icon}
        {title}
      </h4>
      {children}
    </section>
  );
}

/**
 * Everything about one radiology receipt, read-only, as a card.
 *
 * The receipt list shows a row's headline -- patient, type, amount, status --
 * and a printed receipt shows only what a patient needs. Neither told the desk
 * the study descriptions, the payment method, or who raised, changed and
 * collected the receipt and when; that meant opening the edit form, which is
 * a different right and the wrong place to look. This is the place to look.
 *
 * Shared by Ultrasound, X-Ray and ECG so the three desks read the same.
 */
export function ReceiptDetailsModal({ details, onClose, onPrint }: ReceiptDetailsModalProps) {
  useEffect(() => {
    if (!details) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [details, onClose]);

  if (!details) return null;

  const discount = Number(details.discountAmount ?? 0);
  const percent = Number(details.discountPercentage ?? 0);
  const net = Number(details.netAmount ?? 0);
  const paid = Number(details.paidAmount ?? 0);
  const balance = Math.max(0, Math.round((net - paid) * 100) / 100);
  const status = String(details.paymentStatus || 'unpaid').toLowerCase();
  const patient = details.patient;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-details-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-gray-50 shadow-2xl dark:bg-gray-900">
        {/* Header band: what this is, its number, and whether it is settled. */}
        <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <Receipt className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 id="receipt-details-title" className="truncate text-sm font-bold">{details.title}</h3>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-blue-100">
                <span>Receipt #{details.receiptNo}</span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {details.date}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLE[status] ?? STATUS_STYLE.unpaid}`}>
              {status}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-white/80 hover:bg-white/15 hover:text-white"
              title="Close"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Section icon={<User className="h-3.5 w-3.5" />} title="Patient">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                <div className="col-span-2">
                  <Field label="Name">{patient?.name || '—'}</Field>
                </div>
                <Field label="Patient ID">{patient?.patient_id || '—'}</Field>
                <Field label="Phone">{patient?.phone || '—'}</Field>
                <Field label="Age">{patient?.age ?? '—'}</Field>
                <Field label="Gender"><span className="capitalize">{patient?.gender || '—'}</span></Field>
              </dl>
            </Section>

            <Section icon={<Stethoscope className="h-3.5 w-3.5" />} title="Clinical">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                <div className="col-span-2">
                  <Field label="Doctor">{details.doctorName || '—'}</Field>
                </div>
                <div className="col-span-2">
                  <Field label="Referred By">{details.referredBy || '—'}</Field>
                </div>
                {(details.extra ?? []).map((row) => (
                  <Field key={row.label} label={row.label}>{row.value}</Field>
                ))}
              </dl>
            </Section>
          </div>

          <Section icon={<FileText className="h-3.5 w-3.5" />} title={details.itemsLabel}>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {details.items.map((item, index) => (
                <li key={`${item.name}-${index}`} className="flex items-start gap-3 py-1.5">
                  <span className="w-5 pt-0.5 text-[10px] tabular-nums text-gray-400">{index + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-gray-900 dark:text-white">{item.name}</div>
                    {item.description?.trim() && (
                      <div dir="auto" className="mt-0.5 whitespace-pre-line text-[11px] text-gray-500 dark:text-gray-400">
                        {item.description}
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-medium tabular-nums text-gray-900 dark:text-white">{money(item.fee)}</span>
                </li>
              ))}
              {details.items.length === 0 && (
                <li className="py-2 text-xs text-gray-500">Nothing recorded.</li>
              )}
            </ul>
          </Section>

          <Section icon={<Wallet className="h-3.5 w-3.5" />} title="Payment">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <dl className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Fee</dt>
                  <dd className="tabular-nums text-gray-900 dark:text-white">{money(details.fee)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">
                    Discount
                    {details.fullWaiver ? ' (full waiver)' : percent > 0 ? ` (${percent}%)` : ''}
                  </dt>
                  <dd className={`tabular-nums ${discount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
                    {discount > 0 ? `-${money(discount)}` : money(0)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-1 text-sm font-bold dark:border-gray-700">
                  <dt className="text-gray-900 dark:text-white">Net</dt>
                  <dd className="tabular-nums text-emerald-600 dark:text-emerald-400">{money(net)} AFN</dd>
                </div>
              </dl>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-md bg-gray-50 p-2 dark:bg-gray-900/40">
                <Field label="Paid">{money(paid)}</Field>
                <Field label="Balance">
                  <span className={balance > 0 ? 'text-red-600 dark:text-red-400' : ''}>{money(balance)}</span>
                </Field>
                <Field label="Method"><span className="capitalize">{details.paymentMethod || '—'}</span></Field>
                <Field label="Status"><span className="capitalize">{status}</span></Field>
              </dl>
            </div>
          </Section>

          {details.notes?.trim() && (
            <Section icon={<FileText className="h-3.5 w-3.5" />} title="Notes">
              <p dir="auto" className="whitespace-pre-line text-xs text-gray-800 dark:text-gray-200">{details.notes}</p>
            </Section>
          )}

          <AuditTrail entries={details.history} />
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <X className="h-3.5 w-3.5" />
            Close
          </button>
          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
