import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  Eye,
  RotateCcw,
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
  AuditLogApi,
  AuditLogFilterOptions,
  AuditLogQuery,
  exportAuditLogs,
  getAuditLogFilters,
  listAuditLogs,
} from '../api/auditLogs';

interface AuditLogManagementProps {
  hospital: Hospital;
  userRole: UserRole;
}

const PER_PAGE = 25;

const actionStyles: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  delete: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  restore: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  login: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  logout: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  login_failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  password_change: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  print: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  export: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
};

const humanise = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const safeDate = (value?: string | null, pattern = 'MMM dd, yyyy HH:mm:ss') => {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : format(parsed, pattern);
};

/** Render a values snapshot as a compact "key: value" list. */
const summariseValues = (values: Record<string, any> | null | undefined, limit = 6): string => {
  if (!values || typeof values !== 'object') return '—';
  const entries = Object.entries(values).filter(([key]) => !['created_at', 'updated_at'].includes(key));
  if (entries.length === 0) return '—';
  return entries
    .slice(0, limit)
    .map(([key, value]) => `${key}: ${value === null || value === '' ? '—' : String(value)}`)
    .join(', ') + (entries.length > limit ? ` … (+${entries.length - limit} more)` : '');
};

export function AuditLogManagement({ hospital, userRole }: AuditLogManagementProps) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, isAllHospitals } =
    useHospitalFilter(hospital, userRole);

  const [logs, setLogs] = useState<AuditLogApi[]>([]);
  const [options, setOptions] = useState<AuditLogFilterOptions>({ modules: [], actions: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<AuditLogApi | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const canExport = hasPermission('export_audit_logs') || hasPermission('manage_audit_logs');

  const scopedHospitalId = useMemo(() => {
    if (userRole !== 'super_admin') return undefined;
    return isAllHospitals ? undefined : currentHospital.id;
  }, [userRole, isAllHospitals, currentHospital.id]);

  const query: AuditLogQuery = useMemo(
    () => ({
      search,
      module: moduleFilter,
      action: actionFilter,
      user_id: userFilter,
      start_date: startDate,
      end_date: endDate,
      hospital_id: scopedHospitalId,
    }),
    [search, moduleFilter, actionFilter, userFilter, startDate, endDate, scopedHospitalId]
  );

  // Debounce the search box so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAuditLogs({ ...query, page, per_page: PER_PAGE });
      setLogs(result.data ?? []);
      setLastPage(result.last_page ?? 1);
      setTotal(result.total ?? 0);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    getAuditLogFilters({ hospital_id: scopedHospitalId })
      .then(setOptions)
      .catch(() => setOptions({ modules: [], actions: [], users: [] }));
  }, [scopedHospitalId]);

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setModuleFilter('all');
    setActionFilter('all');
    setUserFilter('all');
    setStartDate('');
    setEndDate('');
  };

  /** Flatten the current result set (all pages) for file export. */
  const fetchExportRows = async (): Promise<AuditLogApi[]> => {
    const rows = await exportAuditLogs(query);
    if (!rows.length) {
      toast.info('There is nothing to export for the current filters.');
    }
    return rows;
  };

  const handleExportExcel = async () => {
    try {
      const rows = await fetchExportRows();
      if (!rows.length) return;

      const sheet = XLSX.utils.json_to_sheet(
        rows.map((row) => ({
          'Date & Time': safeDate(row.created_at),
          User: row.user_name ?? '—',
          Role: row.user_role ? humanise(row.user_role) : '—',
          Module: row.module,
          Action: humanise(row.action),
          'Record ID': row.record_id ?? '—',
          Record: row.record_label ?? '—',
          'Previous Value': summariseValues(row.old_values, 20),
          'New Value': summariseValues(row.new_values, 20),
          'IP Address': row.ip_address ?? '—',
          Browser: row.user_agent ?? '—',
          Description: row.description ?? '—',
        }))
      );

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Audit Log');
      XLSX.writeFile(workbook, `Audit_Log_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success('Audit log exported to Excel');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to export audit log');
    }
  };

  const handleExportPDF = async () => {
    try {
      const rows = await fetchExportRows();
      if (!rows.length) return;

      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(14);
      doc.text('Audit Log Report', 14, 18);
      doc.setFontSize(9);
      doc.text(
        `${isAllHospitals ? 'All Hospitals' : currentHospital.name} • Generated ${format(new Date(), 'MMM dd, yyyy HH:mm')} • ${rows.length} entries`,
        14,
        24
      );

      autoTable(doc, {
        startY: 30,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [37, 99, 235] },
        head: [['Date & Time', 'User', 'Role', 'Module', 'Action', 'Record', 'IP Address', 'Details']],
        body: rows.map((row) => [
          safeDate(row.created_at),
          row.user_name ?? '—',
          row.user_role ? humanise(row.user_role) : '—',
          row.module,
          humanise(row.action),
          row.record_label ?? row.record_id ?? '—',
          row.ip_address ?? '—',
          row.description ?? summariseValues(row.new_values, 4),
        ]),
      });

      doc.save(`Audit_Log_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('Audit log exported to PDF');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to export audit log');
    }
  };

  const selectClass =
    'px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none';

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            {t('auditLog.title')}
          </h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {t('auditLog.subtitle')} — {isAllHospitals ? 'All Hospitals' : currentHospital.name} • {total} {t('auditLog.entries')}
          </p>
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
                title={t('ui.exportToExcel')}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs font-medium shadow-sm"
                title={t('ui.exportToPdf')}
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

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            title="Module filter"
            aria-label="Module filter"
            className={selectClass}
          >
            <option value="all">{t('auditLog.allModules')}</option>
            {options.modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            title="Action filter"
            aria-label="Action filter"
            className={selectClass}
          >
            <option value="all">{t('auditLog.allActions')}</option>
            {options.actions.map((a) => (
              <option key={a} value={a}>
                {humanise(a)}
              </option>
            ))}
          </select>

          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            title="User filter"
            aria-label="User filter"
            className={selectClass}
          >
            <option value="all">{t('auditLog.allUsers')}</option>
            {options.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? `User #${u.id}`}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            title="From date"
            aria-label="From date"
            className={selectClass}
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            title="To date"
            aria-label="To date"
            className={selectClass}
          />

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
                <th className="px-3 py-2 whitespace-nowrap">{t('auditLog.dateTime')}</th>
                <th className="px-3 py-2">{t('auditLog.user')} / {t('auditLog.role')}</th>
                <th className="px-3 py-2">{t('auditLog.module')}</th>
                <th className="px-3 py-2">{t('auditLog.action')}</th>
                <th className="px-3 py-2">{t('auditLog.record')}</th>
                <th className="px-3 py-2">{t('auditLog.ipAddress')} / {t('auditLog.browser')}</th>
                <th className="px-3 py-2 text-center">{t('auditLog.details')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {t('common.loading')}
                  </td>
                </tr>
              )}

              {!loading &&
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900 dark:text-white">
                      {safeDate(log.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col max-w-[160px]">
                        <span className="font-medium text-gray-900 dark:text-white truncate">
                          {log.user_name ?? 'System'}
                        </span>
                        <span className="text-[10px] text-gray-500 truncate">
                          {log.user_role ? humanise(log.user_role) : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">{log.module}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase whitespace-nowrap ${
                          actionStyles[log.action] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {humanise(log.action)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col max-w-[180px]">
                        <span className="text-gray-900 dark:text-white truncate">{log.record_label ?? '—'}</span>
                        {log.record_id && (
                          <span className="font-mono text-[10px] text-gray-400">#{log.record_id}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col max-w-[160px]">
                        <span className="font-mono text-[10px] text-gray-600 dark:text-gray-300">
                          {log.ip_address ?? '—'}
                        </span>
                        <span className="text-[10px] text-gray-400 truncate" title={log.user_agent ?? ''}>
                          {log.user_agent ?? '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => setDetail(log)}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 rounded-md transition-colors"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}

              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-2">
                        <ShieldCheck className="w-5 h-5 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium">{t('auditLog.noEntries')}</p>
                      <p className="text-xs mt-0.5">Try adjusting the filters or the date range</p>
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
              Page {page} of {lastPage} • {total} entries
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                title={t('ui.previousPage')}
                aria-label={t('ui.previousPage')}
                className="p-1 px-2 rounded hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
              >
                <ChevronLeft className="w-3 h-3 rtl:rotate-180" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                disabled={page === lastPage}
                title={t('ui.nextPage')}
                aria-label={t('ui.nextPage')}
                className="p-1 px-2 rounded hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
              >
                <ChevronRight className="w-3 h-3 rtl:rotate-180" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Audit Entry #{detail.id}</h3>
              <button
                onClick={() => setDetail(null)}
                title={t('ui.close')}
                aria-label={t('ui.close')}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3 text-xs">
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Date & Time" value={safeDate(detail.created_at)} />
                <Field label="User" value={detail.user_name ?? 'System'} />
                <Field label={t('ui.role')} value={detail.user_role ? humanise(detail.user_role) : '—'} />
                <Field label={t('ui.module')} value={detail.module} />
                <Field label="Action" value={humanise(detail.action)} />
                <Field label="Record ID" value={detail.record_id ?? '—'} />
                <Field label="Record" value={detail.record_label ?? '—'} />
                <Field label="IP Address" value={detail.ip_address ?? '—'} />
                <Field label="Method / URL" value={`${detail.method ?? '—'} ${detail.url ?? ''}`} />
                <Field label="Browser" value={detail.user_agent ?? '—'} />
              </dl>

              {detail.description && (
                <div>
                  <p className="font-semibold text-gray-500 dark:text-gray-400 uppercase text-[10px] mb-1">{t('ui.description')}</p>
                  <p className="text-gray-800 dark:text-gray-200">{detail.description}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ValueBlock label="Previous Value" values={detail.old_values} />
                <ValueBlock label="New Value" values={detail.new_values} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-gray-500 dark:text-gray-400 uppercase text-[10px]">{label}</dt>
      <dd className="text-gray-900 dark:text-white break-words">{value}</dd>
    </div>
  );
}

function ValueBlock({ label, values }: { label: string; values: Record<string, any> | null }) {
  return (
    <div>
      <p className="font-semibold text-gray-500 dark:text-gray-400 uppercase text-[10px] mb-1">{label}</p>
      {values && Object.keys(values).length > 0 ? (
        <pre className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-md p-2 text-[10px] overflow-x-auto whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">
          {JSON.stringify(values, null, 2)}
        </pre>
      ) : (
        <p className="text-gray-400">—</p>
      )}
    </div>
  );
}
