import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Wallet,
  BadgeDollarSign,
  CircleAlert,
  RotateCcw,
  Settings2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Hospital, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import {
  FinanceDocApi,
  FinanceDocType,
  FinanceQuery,
  FinanceSummary,
  PaymentStatus,
  exportFinanceDocs,
  getFinanceSummary,
  listFinanceDocs,
  recordFinancePayment,
  updateFinanceStatus,
} from '../api/pharmacyFinance';

interface PharmacyFinanceProps {
  hospital: Hospital;
  userRole: UserRole;
}

const PER_PAGE = 25;

/** Document type -> label key and the permission that reveals it. */
const DOC_TYPES: Array<{ type: FinanceDocType; key: string; permission: string }> = [
  { type: 'sales', key: 'finance.invoices', permission: 'view_finance_sales' },
  { type: 'purchase', key: 'finance.purchases', permission: 'view_finance_purchases' },
  { type: 'sales_return', key: 'finance.returnIn', permission: 'view_finance_sales_returns' },
  { type: 'purchase_return', key: 'finance.returnOut', permission: 'view_finance_purchase_returns' },
];

const statusStyles: Record<PaymentStatus, string> = {
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  pending: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

const money = (value: number | string | null | undefined) =>
  Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const safeDate = (value?: string | null, pattern = 'MMM dd, yyyy') => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : format(parsed, pattern);
};

export function PharmacyFinance({ hospital, userRole }: PharmacyFinanceProps) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, isAllHospitals } =
    useHospitalFilter(hospital, userRole);

  const [docs, setDocs] = useState<FinanceDocApi[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const [payDoc, setPayDoc] = useState<FinanceDocApi | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', method: '', reference: '', note: '' });
  const [termsDoc, setTermsDoc] = useState<FinanceDocApi | null>(null);
  const [termsForm, setTermsForm] = useState({ status: '' as '' | PaymentStatus, dueDate: '', note: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManage = hasPermission('manage_finance');
  const canRecordPayments = hasPermission('record_finance_payments') || canManage;
  const canEditTerms = hasPermission('edit_finance_payment_status') || canManage;
  const canExport = hasPermission('export_finance') || canManage;

  /** Only the tabs this user is permitted to see. */
  const visibleTypes = useMemo(
    () => DOC_TYPES.filter((d) => canManage || hasPermission(d.permission)),
    [canManage, hasPermission]
  );

  const [activeType, setActiveType] = useState<FinanceDocType | null>(null);

  useEffect(() => {
    if (!activeType && visibleTypes.length > 0) {
      setActiveType(visibleTypes[0].type);
    }
  }, [visibleTypes, activeType]);

  const scopedHospitalId = useMemo(() => {
    if (userRole !== 'super_admin') return undefined;
    return isAllHospitals ? undefined : currentHospital.id;
  }, [userRole, isAllHospitals, currentHospital.id]);

  const query: FinanceQuery = useMemo(
    () => ({
      trx_type: activeType ?? undefined,
      payment_status: statusFilter,
      search,
      start_date: startDate,
      end_date: endDate,
      overdue_only: overdueOnly,
      hospital_id: scopedHospitalId,
    }),
    [activeType, statusFilter, search, startDate, endDate, overdueOnly, scopedHospitalId]
  );

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const loadData = useCallback(async () => {
    if (!activeType) return;
    setLoading(true);
    try {
      const [pageResult, summaryResult] = await Promise.all([
        listFinanceDocs({ ...query, page, per_page: PER_PAGE }),
        getFinanceSummary({ ...query, trx_type: undefined }),
      ]);
      setDocs(pageResult.data ?? []);
      setLastPage(pageResult.last_page ?? 1);
      setTotal(pageResult.total ?? 0);
      setSummary(summaryResult);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load finance records');
    } finally {
      setLoading(false);
    }
  }, [query, page, activeType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setOverdueOnly(false);
  };

  /* ------------------------------- Actions -------------------------------- */

  const openPayModal = (doc: FinanceDocApi) => {
    setPayDoc(doc);
    setPayForm({
      amount: String(Number(doc.due_amount ?? 0).toFixed(2)),
      method: doc.payment_method ?? '',
      reference: doc.payment_reference ?? '',
      note: '',
    });
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payDoc || isSubmitting) return;

    const amount = Number(payForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid payment amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      await recordFinancePayment(payDoc.id, {
        amount,
        payment_method: payForm.method || undefined,
        payment_reference: payForm.reference || undefined,
        finance_note: payForm.note || undefined,
      });
      toast.success('Payment recorded');
      setPayDoc(null);
      await loadData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTermsModal = (doc: FinanceDocApi) => {
    setTermsDoc(doc);
    setTermsForm({
      status: doc.payment_status,
      dueDate: doc.payment_due_date ? doc.payment_due_date.slice(0, 10) : '',
      note: doc.finance_note ?? '',
    });
  };

  const submitTerms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsDoc || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await updateFinanceStatus(termsDoc.id, {
        payment_status: termsForm.status || undefined,
        payment_due_date: termsForm.dueDate || null,
        finance_note: termsForm.note || null,
      });
      toast.success('Payment terms updated');
      setTermsDoc(null);
      await loadData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update payment terms');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchExportRows = async () => {
    const rows = await exportFinanceDocs(query);
    if (!rows.length) toast.info('There is nothing to export for the current filters.');
    return rows;
  };

  const handleExportExcel = async () => {
    try {
      const rows = await fetchExportRows();
      if (!rows.length) return;
      const sheet = XLSX.utils.json_to_sheet(
        rows.map((row) => ({
          'Doc #': row.serial_no,
          Type: row.trx_type,
          Date: safeDate(row.created_at),
          Party: row.patient_name || row.supplier_name || '—',
          Total: Number(row.grand_total ?? 0),
          Paid: Number(row.paid_amount ?? 0),
          Due: Number(row.due_amount ?? 0),
          Status: row.payment_status,
          'Due Date': safeDate(row.payment_due_date),
          Method: row.payment_method ?? '—',
          Reference: row.payment_reference ?? '—',
          'Settled By': row.settled_by ?? '—',
        }))
      );
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Pharmacy Finance');
      XLSX.writeFile(workbook, `Pharmacy_Finance_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success('Exported to Excel');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to export');
    }
  };

  const handleExportPDF = async () => {
    try {
      const rows = await fetchExportRows();
      if (!rows.length) return;
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(14);
      doc.text('Pharmacy Finance Report', 14, 18);
      doc.setFontSize(9);
      doc.text(
        `${isAllHospitals ? 'All Hospitals' : currentHospital.name} • ${format(new Date(), 'MMM dd, yyyy HH:mm')} • ${rows.length} documents`,
        14,
        24
      );
      autoTable(doc, {
        startY: 30,
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [37, 99, 235] },
        head: [['Doc #', 'Type', 'Date', 'Party', 'Total', 'Paid', 'Due', 'Status', 'Due Date']],
        body: rows.map((row) => [
          row.serial_no,
          row.trx_type,
          safeDate(row.created_at),
          row.patient_name || row.supplier_name || '—',
          money(row.grand_total),
          money(row.paid_amount),
          money(row.due_amount),
          row.payment_status,
          safeDate(row.payment_due_date),
        ]),
      });
      doc.save(`Pharmacy_Finance_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('Exported to PDF');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to export');
    }
  };

  /* --------------------------------- View --------------------------------- */

  const inputClass =
    'px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none';

  if (visibleTypes.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        <Wallet className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm font-medium">{t('finance.noAccess')}</p>
      </div>
    );
  }

  const activeSummary = activeType ? summary?.by_type?.[activeType] : undefined;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h1 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BadgeDollarSign className="w-4 h-4 text-blue-600" />
            {t('finance.title')}
          </h1>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {isAllHospitals ? 'All Hospitals' : currentHospital.name} • {total} {t('finance.documents')}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={`${t('common.search')}...`}
              className="w-56 pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          {canExport && (
            <>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs font-medium shadow-sm"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs font-medium shadow-sm"
              >
                <FileText className="w-3.5 h-3.5" />
                PDF
              </button>
            </>
          )}
        </div>
      </div>

      <HospitalSelector
        userRole={userRole}
        selectedHospitalId={selectedHospitalId}
        onHospitalChange={setSelectedHospitalId}
      />

      {/* Summary cards for the active document type */}
      {activeSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <SummaryCard label={t('finance.totalAmount')} value={money(activeSummary.total_amount)} tone="neutral" />
          <SummaryCard label={t('finance.paidAmount')} value={money(activeSummary.paid_amount)} tone="positive" />
          <SummaryCard label={t('finance.dueAmount')} value={money(activeSummary.due_amount)} tone="negative" />
          <SummaryCard
            label={t('finance.outstandingDocs')}
            value={`${activeSummary.pending_count + activeSummary.partial_count}`}
            tone="warning"
          />
        </div>
      )}

      {/* Document type tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {visibleTypes.map((docType) => (
          <button
            key={docType.type}
            onClick={() => setActiveType(docType.type)}
            className={`px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeType === docType.type
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t(docType.key)}
            {summary?.by_type?.[docType.type] ? ` (${summary.by_type[docType.type].document_count})` : ''}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            title={t('finance.paymentStatus')}
            aria-label={t('finance.paymentStatus')}
            className={inputClass}
          >
            <option value="all">{t('finance.allStatuses')}</option>
            <option value="pending">{t('finance.status.pending')}</option>
            <option value="partial">{t('finance.status.partial')}</option>
            <option value="paid">{t('finance.status.paid')}</option>
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            title={t('auditLog.fromDate')}
            aria-label={t('auditLog.fromDate')}
            className={inputClass}
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            title={t('auditLog.toDate')}
            aria-label={t('auditLog.toDate')}
            className={inputClass}
          />

          <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 px-2">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            {t('finance.overdueOnly')}
          </label>

          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t('auditLog.clearFilters')}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-700/50 uppercase font-medium text-gray-500 dark:text-gray-300">
              <tr>
                <th className="px-3 py-2">{t('finance.document')}</th>
                <th className="px-3 py-2">{t('finance.party')}</th>
                <th className="px-3 py-2">{t('finance.totalAmount')}</th>
                <th className="px-3 py-2">{t('finance.paidAmount')}</th>
                <th className="px-3 py-2">{t('finance.dueAmount')}</th>
                <th className="px-3 py-2">{t('common.status')}</th>
                <th className="px-3 py-2">{t('finance.dueDate')}</th>
                <th className="px-3 py-2 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {t('common.loading')}
                  </td>
                </tr>
              )}

              {!loading &&
                docs.map((doc) => {
                  const overdue =
                    Number(doc.due_amount ?? 0) > 0 &&
                    doc.payment_due_date &&
                    new Date(doc.payment_due_date) < new Date();

                  return (
                    <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="font-mono text-[10px] text-gray-400">#{doc.serial_no}</span>
                          <span className="text-gray-900 dark:text-white">{safeDate(doc.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 max-w-[180px] truncate">
                        {doc.patient_name || doc.supplier_name || '—'}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{money(doc.grand_total)}</td>
                      <td className="px-3 py-2 text-emerald-700 dark:text-emerald-400">{money(doc.paid_amount)}</td>
                      <td className={`px-3 py-2 font-medium ${Number(doc.due_amount) > 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                        {money(doc.due_amount)}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${statusStyles[doc.payment_status]}`}>
                          {t(`finance.status.${doc.payment_status}`)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={overdue ? 'text-rose-600 dark:text-rose-400 font-medium inline-flex items-center gap-1' : ''}>
                          {overdue && <CircleAlert className="w-3 h-3" />}
                          {safeDate(doc.payment_due_date)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {canRecordPayments && Number(doc.due_amount ?? 0) > 0 && (
                            <button
                              onClick={() => openPayModal(doc)}
                              className="px-2 py-1 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                              title={t('finance.recordPayment')}
                            >
                              {t('finance.pay')}
                            </button>
                          )}
                          {canEditTerms && (
                            <button
                              onClick={() => openTermsModal(doc)}
                              className="p-1.5 text-gray-600 hover:bg-gray-100 bg-gray-50 dark:bg-gray-700 dark:text-gray-300 rounded-md transition-colors"
                              title={t('finance.editTerms')}
                            >
                              <Settings2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

              {!loading && docs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-2">
                        <Wallet className="w-5 h-5 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium">{t('finance.noDocuments')}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {lastPage > 1 && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {page} / {lastPage} • {total}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                title={t('ui.previous')}
                aria-label="Previous page"
                className="p-1 px-2 rounded hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed border border-transparent"
              >
                <ChevronLeft className="w-3 h-3 rtl:rotate-180" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                disabled={page === lastPage}
                title={t('ui.next')}
                aria-label="Next page"
                className="p-1 px-2 rounded hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed border border-transparent"
              >
                <ChevronRight className="w-3 h-3 rtl:rotate-180" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Record payment modal */}
      {payDoc && (
        <ModalShell title={t('finance.recordPayment')} onClose={() => setPayDoc(null)}>
          <form onSubmit={submitPayment} className="p-5 space-y-3">
            <div className="bg-gray-50 dark:bg-gray-900/40 rounded-md p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('finance.document')}</span>
                <span className="font-medium text-gray-900 dark:text-white">#{payDoc.serial_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('finance.totalAmount')}</span>
                <span className="font-medium text-gray-900 dark:text-white">{money(payDoc.grand_total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('finance.dueAmount')}</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">{money(payDoc.due_amount)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                {t('finance.amount')} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={payForm.amount}
                onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))}
                className={`${inputClass} w-full`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                  {t('finance.method')}
                </label>
                <input
                  list="financePaymentMethods"
                  value={payForm.method}
                  onChange={(e) => setPayForm((p) => ({ ...p, method: e.target.value }))}
                  placeholder="Cash, Bank..."
                  className={`${inputClass} w-full`}
                />
                <datalist id="financePaymentMethods">
                  <option value="Cash" />
                  <option value="Bank Transfer" />
                  <option value="Cheque" />
                  <option value="Credit Card" />
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                  {t('finance.reference')}
                </label>
                <input
                  value={payForm.reference}
                  onChange={(e) => setPayForm((p) => ({ ...p, reference: e.target.value }))}
                  className={`${inputClass} w-full`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                {t('finance.note')}
              </label>
              <textarea
                rows={2}
                value={payForm.note}
                onChange={(e) => setPayForm((p) => ({ ...p, note: e.target.value }))}
                className={`${inputClass} w-full resize-none`}
              />
            </div>

            <ModalActions onCancel={() => setPayDoc(null)} submitting={isSubmitting} label={t('finance.recordPayment')} />
          </form>
        </ModalShell>
      )}

      {/* Payment terms modal */}
      {termsDoc && (
        <ModalShell title={t('finance.editTerms')} onClose={() => setTermsDoc(null)}>
          <form onSubmit={submitTerms} className="p-5 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                {t('finance.paymentStatus')}
              </label>
              <select
                value={termsForm.status}
                onChange={(e) => setTermsForm((p) => ({ ...p, status: e.target.value as PaymentStatus }))}
                title={t('finance.paymentStatus')}
                aria-label={t('finance.paymentStatus')}
                className={`${inputClass} w-full`}
              >
                <option value="pending">{t('finance.status.pending')}</option>
                <option value="partial">{t('finance.status.partial')}</option>
                <option value="paid">{t('finance.status.paid')}</option>
              </select>
              <p className="text-[10px] text-gray-500 mt-1">{t('finance.statusHint')}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                {t('finance.dueDate')}
              </label>
              <input
                type="date"
                value={termsForm.dueDate}
                onChange={(e) => setTermsForm((p) => ({ ...p, dueDate: e.target.value }))}
                title={t('finance.dueDate')}
                aria-label={t('finance.dueDate')}
                className={`${inputClass} w-full`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                {t('finance.note')}
              </label>
              <textarea
                rows={2}
                value={termsForm.note}
                onChange={(e) => setTermsForm((p) => ({ ...p, note: e.target.value }))}
                className={`${inputClass} w-full resize-none`}
              />
            </div>

            <ModalActions onCancel={() => setTermsDoc(null)} submitting={isSubmitting} label={t('common.save')} />
          </form>
        </ModalShell>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'positive' | 'negative' | 'warning' }) {
  const tones: Record<string, string> = {
    neutral: 'text-gray-900 dark:text-white',
    positive: 'text-emerald-600 dark:text-emerald-400',
    negative: 'text-rose-600 dark:text-rose-400',
    warning: 'text-amber-600 dark:text-amber-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-lg font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} title={t('ui.close')} aria-label={t('ui.close')} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onCancel, submitting, label }: { onCancel: () => void; submitting: boolean; label: string }) {
  const { t } = useTranslation();

  return (
    <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
      <button
        type="button"
        onClick={onCancel}
        className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        {t('common.cancel')}
      </button>
      <button
        type="submit"
        disabled={submitting}
        className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {submitting ? `${t('common.loading')}` : label}
      </button>
    </div>
  );
}
