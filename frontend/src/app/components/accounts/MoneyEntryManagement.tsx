import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  Printer,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import { AddButton } from '../AddButton';
import { TabActionsSlot } from '../TabbedModulePage';
import { formatMoneyIn } from '../../utils/money';
import { TABLE_HEAD_CLASS, Th, TR_CLASS } from '../ui/DataTable';
import { StatusBadge } from '../ui/StatusBadge';
import { AuditTrail, CancelButton, ModalFooter } from '../ui/FormControls';
import { SearchableSelect, type SearchableOption } from '../SearchableSelect';

/**
 * The expense / other-income register.
 *
 * One screen for both. They are the same document with the sign flipped -- a
 * dated, categorised, referenced amount with a receipt attached -- and keeping
 * two copies is how they drifted apart: expenses grew a print button, other
 * income grew a different column order, and neither had a View modal.
 *
 * Modelled on Medicine Management, which is the house CRUD pattern: a search
 * that narrows as you type, sortable headers, and one row of icon actions
 * (view, print, edit, delete) rather than a mixture of inline buttons and
 * links.
 */

export type MoneyEntryStatus = 'approved' | 'pending' | 'rejected';

export interface MoneyEntryView {
  id: string;
  hospitalId: string;
  categoryId: string;
  sequenceId: number;
  title: string;
  amount: number;
  date: Date;
  paymentMethod?: string;
  reference?: string;
  documentUrl?: string | null;
  notes?: string;
  status: MoneyEntryStatus;
  categoryName?: string;
  /** Who touched the record and when, shown at the foot of the details modal. */
  createdBy?: string | null;
  createdAt?: string | Date | null;
  updatedBy?: string | null;
  updatedAt?: string | Date | null;
  approvedBy?: string | null;
  approvedAt?: string | Date | null;
  rejectedBy?: string | null;
  rejectedAt?: string | Date | null;
}

export interface MoneyEntryFormValues {
  categoryId: string;
  title: string;
  amount: string;
  date: string;
  paymentMethod: string;
  reference: string;
  notes: string;
}

export interface MoneyCategoryOption {
  id: string;
  name: string;
  hospitalId: string;
}

export interface MoneyEntryAdapter {
  /** Screen wording. */
  labels: {
    singular: string;
    plural: string;
    dateLabel: string;
    addLabel: string;
    amountLabel: string;
  };
  /**
   * Permission names gating each action on this register.
   *
   * Approving is separated from editing on purpose: typing an expense in and
   * signing it off are different jobs, and the person who spends the money
   * should not be the one who approves it. Printing and exporting are separate
   * again -- an export is the whole book leaving the building.
   */
  permissions: {
    view: string[];
    add: string[];
    edit: string[];
    delete: string[];
    approve: string[];
    print: string[];
    /** Choosing a date other than today — which period the row lands in. */
    editDate: string[];
  };
  entries: MoneyEntryView[];
  categories: MoneyCategoryOption[];
  loading: boolean;
  currency: string;
  language: string;
  hospitalId: string;
  hospitalName: string;
  save: (args: {
    id?: string;
    values: MoneyEntryFormValues;
    amount: number;
    status: MoneyEntryStatus;
    documentFile: File | null;
  }) => Promise<boolean>;
  setStatus: (entry: MoneyEntryView, status: MoneyEntryStatus) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Opens the module's existing print view. */
  print?: (entry: MoneyEntryView) => void;
}

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Credit Card', 'Cheque', 'Mobile Money'];
const PAGE_SIZE = 15;

const inputClass =
  'w-full rounded-md border border-gray-300 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-900 transition-all focus:border-transparent focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

const labelClass = 'mb-0.5 block text-[11px] font-medium text-gray-700 dark:text-gray-300';

const emptyForm = (): MoneyEntryFormValues => ({
  categoryId: '',
  title: '',
  amount: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  paymentMethod: '',
  reference: '',
  notes: '',
});

export function MoneyEntryManagement({ adapter }: { adapter: MoneyEntryAdapter }) {
  const { hasPermission } = useAuth();
  const { labels, currency, language } = adapter;

  const canAdd = adapter.permissions.add.some(hasPermission);
  const canEdit = adapter.permissions.edit.some(hasPermission);
  const canDelete = adapter.permissions.delete.some(hasPermission);
  const canApprove = adapter.permissions.approve.some(hasPermission);
  const canPrint = adapter.permissions.print.some(hasPermission);
  const canEditDate = adapter.permissions.editDate.some(hasPermission);

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'date' | 'title' | 'category' | 'amount' | 'status'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MoneyEntryView | null>(null);
  const [viewing, setViewing] = useState<MoneyEntryView | null>(null);
  const [deleting, setDeleting] = useState<MoneyEntryView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Synchronous ref lock. The `submitting` state alone cannot stop two clicks
  // landing in the same frame -- both read the old false -- which posted the
  // entry twice.
  const { submitting: locked, guard } = useSubmitGuard();
  const [removing, setRemoving] = useState(false);
  const [form, setForm] = useState<MoneyEntryFormValues>(emptyForm);
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const categories = useMemo(
    () => adapter.categories.filter((category) => category.hospitalId === adapter.hospitalId),
    [adapter.categories, adapter.hospitalId]
  );

  const categoryOptions: SearchableOption[] = useMemo(
    () => categories.map((category) => ({ value: category.id, label: category.name })),
    [categories]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const scoped = adapter.entries.filter((entry) => entry.hospitalId === adapter.hospitalId);

    if (!term) return scoped;

    return scoped.filter((entry) =>
      [entry.title, entry.reference, entry.notes, entry.categoryName, entry.paymentMethod, entry.status]
        .some((field) => String(field ?? '').toLowerCase().includes(term))
    );
  }, [adapter.entries, adapter.hospitalId, search]);

  const sorted = useMemo(() => {
    // Copied before sorting: Array.prototype.sort mutates, and this array is
    // derived from context state.
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title, undefined, { numeric: true });
          break;
        case 'category':
          comparison = (a.categoryName ?? '').localeCompare(b.categoryName ?? '');
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        default:
          comparison = a.date.getTime() - b.date.getTime();
      }
      return sortDir === 'asc' ? comparison : -comparison;
    });
  }, [filtered, sortKey, sortDir]);

  // A search that shrinks the list below the current page would otherwise
  // leave the user staring at an empty table on page 4 of 2.
  useEffect(() => {
    setPage(1);
  }, [search, sortKey, sortDir, adapter.hospitalId]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const total = useMemo(() => sorted.reduce((sum, entry) => sum + entry.amount, 0), [sorted]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'date' || key === 'amount' ? 'desc' : 'asc');
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setDocumentFile(null);
    setFormOpen(true);
  };

  const openEdit = (entry: MoneyEntryView) => {
    setEditing(entry);
    setForm({
      categoryId: entry.categoryId,
      title: entry.title,
      amount: String(entry.amount),
      date: format(entry.date, 'yyyy-MM-dd'),
      paymentMethod: entry.paymentMethod ?? '',
      reference: entry.reference ?? '',
      notes: entry.notes ?? '',
    });
    setDocumentFile(null);
    setFormOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const amount = Number(form.amount);
    if (!form.categoryId) {
      toast.error('Choose a category');
      return;
    }
    if (!form.title.trim()) {
      toast.error('Enter a title');
      return;
    }
    // Zero is rejected as well as negative: a zero-amount entry is almost
    // always a half-finished form, and it would sit in the totals as a row
    // that changes nothing.
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter an amount greater than zero');
      return;
    }

    setSubmitting(true);
    try {
      const ok = await adapter.save({
        id: editing?.id,
        values: form,
        amount,
        // Editing never silently re-approves: the row keeps the status it had,
        // and status is changed deliberately from the row's own actions.
        status: editing ? editing.status : 'pending',
        documentFile,
      });

      if (ok) {
        toast.success(editing ? `${labels.singular} updated` : `${labels.singular} added`);
        setFormOpen(false);
        setEditing(null);
        setDocumentFile(null);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || `Failed to save ${labels.singular.toLowerCase()}`);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setRemoving(true);
    try {
      await adapter.remove(deleting.id);
      toast.success(`${labels.singular} deleted`);
      setDeleting(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete');
    } finally {
      setRemoving(false);
    }
  };

  const changeStatus = async (entry: MoneyEntryView, status: MoneyEntryStatus) => {
    try {
      await adapter.setStatus(entry, status);
      toast.success(`Marked ${status}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not change status');
    }
  };

  const money = (value: number) => formatMoneyIn(value, currency, language);

  const SortHeader = ({
    label,
    sortBy,
    align = 'left',
  }: {
    label: string;
    sortBy: typeof sortKey;
    align?: 'left' | 'right';
  }) => (
    <Th onSort={() => toggleSort(sortBy)} active={sortKey === sortBy} direction={sortDir} align={align}>
      {label}
    </Th>
  );

  return (
    <div className="space-y-3">
      {/* Search and Add ride in the tab bar when embedded, so the page does not
          grow a second header strip below the tabs. */}
      <TabActionsSlot>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${labels.plural.toLowerCase()}...`}
              className="w-56 rounded-md border border-gray-300 py-1.5 pl-8 pr-2 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
          {canAdd && <AddButton onClick={openAdd} label={labels.addLabel} />}
        </div>
      </TabActionsSlot>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: labels.plural, value: String(sorted.length), tone: 'text-gray-900 dark:text-white' },
          { label: 'Total', value: money(total), tone: 'text-blue-600 dark:text-blue-400' },
          {
            label: 'Pending',
            value: String(sorted.filter((entry) => entry.status === 'pending').length),
            tone: 'text-amber-600 dark:text-amber-400',
          },
          {
            label: 'Approved',
            value: String(sorted.filter((entry) => entry.status === 'approved').length),
            tone: 'text-emerald-600 dark:text-emerald-400',
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {card.label}
            </div>
            <div className={`mt-0.5 text-sm font-semibold ${card.tone}`}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className={TABLE_HEAD_CLASS}>
              <tr>
                <Th>#</Th>
                <SortHeader label={labels.dateLabel} sortBy="date" />
                <SortHeader label="Title" sortBy="title" />
                <SortHeader label="Category" sortBy="category" />
                <Th>Method</Th>
                <Th>Reference</Th>
                <SortHeader label={labels.amountLabel} sortBy="amount" align="right" />
                <SortHeader label="Status" sortBy="status" />
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {adapter.loading && (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-gray-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}

              {!adapter.loading && visible.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center">
                    <FileText className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
                    <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                      No {labels.plural.toLowerCase()} found
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {search ? 'Try a different search term.' : `Add your first ${labels.singular.toLowerCase()} to get started.`}
                    </p>
                  </td>
                </tr>
              )}

              {!adapter.loading &&
                visible.map((entry) => (
                  <tr key={entry.id} className={TR_CLASS}>
                    <td className="px-4 py-2 text-xs text-gray-400">{entry.sequenceId}</td>
                    <td className="px-4 py-2 text-xs text-gray-800 dark:text-gray-200">
                      {format(entry.date, 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-2 text-xs font-medium text-gray-900 dark:text-white">
                      <span className="inline-flex items-center gap-1">
                        {entry.title}
                        {entry.documentUrl && (
                          <Paperclip className="h-3 w-3 text-gray-400" aria-label="Has attachment" />
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">
                      {entry.categoryName || '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">
                      {entry.paymentMethod || '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">{entry.reference || '—'}</td>
                    <td className="px-4 py-2 text-xs text-right font-semibold tabular-nums text-gray-900 dark:text-white">
                      {money(entry.amount)}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setViewing(entry)}
                          title="View details"
                          className="rounded p-1 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {canApprove && entry.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => changeStatus(entry, 'approved')}
                              title="Approve"
                              className="rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => changeStatus(entry, 'rejected')}
                              title="Reject"
                              className="rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}

                        {canPrint && adapter.print && (
                          <button
                            type="button"
                            onClick={() => adapter.print?.(entry)}
                            title="Print voucher"
                            className="rounded p-1 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEdit(entry)}
                            title="Edit"
                            className="rounded p-1 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/30"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeleting(entry)}
                            title="Delete"
                            className="rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-400">
          <div>
            {sorted.length > 0
              ? `Showing ${(safePage - 1) * PAGE_SIZE + 1}-${Math.min(safePage * PAGE_SIZE, sorted.length)} of ${sorted.length}`
              : '0 rows'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage <= 1}
              className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 disabled:opacity-40 dark:border-gray-600"
            >
              <ChevronLeft className="h-3 w-3" /> Prev
            </button>
            <span>
              {safePage} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={safePage >= pageCount}
              className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 disabled:opacity-40 dark:border-gray-600"
            >
              Next <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------ add / edit modal */}
      {formOpen && (
        <Modal
          title={`${editing ? 'Edit' : 'Add'} ${labels.singular}`}
          onClose={() => setFormOpen(false)}
        >
          <form onSubmit={guard(submit)} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className={labelClass}>Category *</label>
                {/* Type-to-filter rather than a plain select: a hospital can
                    accumulate dozens of categories, and scrolling a native
                    dropdown to find one is the slowest thing on this form. */}
                <SearchableSelect
                  value={form.categoryId}
                  options={categoryOptions}
                  onChange={(categoryId) => setForm((prev) => ({ ...prev, categoryId }))}
                  placeholder="Select category"
                  emptyMessage="No categories found"
                  required
                />
                {categories.length === 0 && (
                  <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                    No categories yet — add one on the Categories tab first.
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass}>{labels.dateLabel} *</label>
                {/*
                  The date decides which period the money lands in, so changing
                  it is its own permission. Without it the field is fixed at
                  today, which is the right answer for almost every entry --
                  read-only rather than hidden, so the value is still visible.
                */}
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                  readOnly={!canEditDate}
                  disabled={!canEditDate}
                  title={
                    canEditDate
                      ? undefined
                      : 'You do not have permission to file this under a different date.'
                  }
                  className={`${inputClass} disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-800`}
                  required
                />
                {!canEditDate && (
                  <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                    Fixed to today. Ask an administrator for the date-edit right to change it.
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder={`What is this ${labels.singular.toLowerCase()} for?`}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>{labels.amountLabel} *</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Payment Method</label>
                <input
                  list="moneyEntryPaymentMethods"
                  value={form.paymentMethod}
                  onChange={(e) => setForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                  placeholder="Cash"
                  className={inputClass}
                />
                <datalist id="moneyEntryPaymentMethods">
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className={labelClass}>Reference</label>
                <input
                  type="text"
                  value={form.reference}
                  onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))}
                  placeholder="Invoice or voucher number"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Attachment</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
                  className={`${inputClass} file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-2 file:py-0.5 file:text-[11px] file:text-blue-700`}
                />
                {editing?.documentUrl && !documentFile && (
                  <a
                    href={editing.documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <Paperclip className="h-3 w-3" /> Current attachment
                  </a>
                )}
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>Notes</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            <ModalFooter onCancel={() => setFormOpen(false)} pending={submitting || locked} />
          </form>
        </Modal>
      )}

      {/* ------------------------------------------------------ view modal */}
      {viewing && (
        <Modal title={`${labels.singular} Details`} onClose={() => setViewing(null)}>
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{viewing.title}</div>
                <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                  {viewing.categoryName || 'Uncategorised'} · #{viewing.sequenceId}
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-bold text-blue-600 dark:text-blue-400">
                  {money(viewing.amount)}
                </div>
                <StatusBadge status={viewing.status} size="md" className="mt-0.5" />
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {[
                [labels.dateLabel, format(viewing.date, 'dd MMM yyyy')],
                ['Payment Method', viewing.paymentMethod || '—'],
                ['Reference', viewing.reference || '—'],
                ['Hospital', adapter.hospitalName],
              ].map(([term, value]) => (
                <div key={term}>
                  <dt className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {term}
                  </dt>
                  <dd className="mt-0.5 font-medium text-gray-900 dark:text-white">{value}</dd>
                </div>
              ))}
            </dl>

            {viewing.notes && (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Notes
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-xs text-gray-800 dark:text-gray-200">
                  {viewing.notes}
                </p>
              </div>
            )}

            {viewing.documentUrl && <DocumentPreview url={viewing.documentUrl} />}

            <AuditTrail
              entries={[
                { label: 'Created by', who: viewing.createdBy, when: viewing.createdAt },
                { label: 'Updated by', who: viewing.updatedBy, when: viewing.updatedAt },
                { label: 'Approved by', who: viewing.approvedBy, when: viewing.approvedAt },
                { label: 'Rejected by', who: viewing.rejectedBy, when: viewing.rejectedAt },
              ]}
            />

            <div className="flex justify-end gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
              {canPrint && adapter.print && (
                <button
                  type="button"
                  onClick={() => adapter.print?.(viewing)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    const target = viewing;
                    setViewing(null);
                    openEdit(target);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ---------------------------------------------------- delete modal */}
      {deleting && (
        <Modal title={`Delete ${labels.singular}`} onClose={() => setDeleting(null)} width="max-w-md">
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
              <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <div className="text-xs text-red-800 dark:text-red-200">
                <p className="font-semibold">This cannot be undone.</p>
                <p className="mt-0.5">
                  “{deleting.title}” for {money(deleting.amount)} on{' '}
                  {format(deleting.date, 'dd MMM yyyy')} will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <CancelButton onClick={() => setDeleting(null)} disabled={removing} />
              <button
                type="button"
                onClick={confirmDelete}
                disabled={removing}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {removing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/**
 * The attached receipt, shown rather than linked.
 *
 * The point of attaching a scan to an expense is so someone approving it can
 * SEE the receipt. A link that opens a new tab loses the row you were looking
 * at, so an image renders in place and opens full size on click; a PDF gets an
 * embedded viewer, since browsers render those natively and an <img> would show
 * a broken icon. Anything else falls back to a download row, because guessing
 * at an unknown type is how you get an empty grey box.
 */
function DocumentPreview({ url }: { url: string }) {
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);

  // The extension is read off the path only -- a query string on a signed URL
  // would otherwise make every file look like an unknown type.
  const extension = (url.split('?')[0].split('#')[0].split('.').pop() ?? '').toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension);
  const isPdf = extension === 'pdf';

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-1.5 dark:border-gray-700">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
          <Paperclip className="h-3.5 w-3.5" /> Attachment
        </span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          <ExternalLink className="h-3 w-3" /> Open original
        </a>
      </div>

      <div className="bg-gray-50 p-2 dark:bg-gray-900/40">
        {isImage && !failed && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            title="Click to enlarge"
            className="block w-full cursor-zoom-in"
          >
            <img
              src={url}
              alt="Attached document"
              onError={() => setFailed(true)}
              className="mx-auto max-h-64 rounded object-contain"
            />
          </button>
        )}

        {isPdf && <iframe src={url} title="Attached document" className="h-72 w-full rounded bg-white" />}

        {(failed || (!isImage && !isPdf)) && (
          <div className="flex items-center gap-2 px-1 py-3 text-xs text-gray-600 dark:text-gray-300">
            <FileText className="h-4 w-4 shrink-0 text-gray-400" />
            {failed
              ? 'This attachment could not be displayed. Open the original to view it.'
              : `A .${extension || 'file'} attachment is on record. Open the original to view it.`}
          </div>
        )}
      </div>

      {/* Lightbox. Rendered above the details modal, and closing it returns to
          that modal rather than to the table. */}
      {expanded && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setExpanded(false)}
          role="presentation"
        >
          <img
            src={url}
            alt="Attached document, full size"
            className="max-h-full max-w-full rounded object-contain"
          />
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Close preview"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

/** The one modal shell these screens use, so all four dialogs match. */
export function Modal({
  title,
  onClose,
  children,
  width = 'max-w-2xl',
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  // Escape closes the dialog. Without it the only way out of a full-screen
  // overlay is finding the X, which is the complaint every modal gets.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
      <div className={`w-full ${width} rounded-xl bg-white shadow-xl dark:bg-gray-800`}>
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-3">{children}</div>
      </div>
    </div>
  );
}
