import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, CircleDollarSign, Download, HandCoins, Search } from 'lucide-react';
import { toast } from 'sonner';
import { exportLedger, getLedgerSummary, LedgerEntryApi, listLedger } from '../../api/ledger';
import { Hospital, UserRole } from '../types';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';

interface LedgerReportProps {
  hospital: Hospital;
  userRole: UserRole;
}

type DirectionFilter = '' | 'income' | 'expense' | 'adjustment';

const money = (value: number | string) => {
  const n = Number(value || 0);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function LedgerReport({ hospital, userRole }: LedgerReportProps) {
  const { selectedHospitalId, setSelectedHospitalId } = useHospitalFilter(hospital, userRole);

  const [entries, setEntries] = useState<LedgerEntryApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage] = useState(25);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [summary, setSummary] = useState({
    income_total: 0,
    expense_total: 0,
    net_total: 0,
    due_total: 0,
  });

  const baseParams = useMemo(() => {
    const params: Record<string, any> = {
      per_page: perPage,
    };

    if (userRole === 'super_admin' && selectedHospitalId !== 'all') {
      params.hospital_id = selectedHospitalId;
    }
    if (query.trim()) {
      params.search = query.trim();
    }
    if (moduleFilter) {
      params.module = moduleFilter;
    }
    if (statusFilter) {
      params.status = statusFilter;
    }
    if (directionFilter) {
      params.entry_direction = directionFilter;
    }
    if (startDate) {
      params.date_from = startDate;
    }
    if (endDate) {
      params.date_to = endDate;
    }

    return params;
  }, [directionFilter, endDate, moduleFilter, perPage, query, selectedHospitalId, startDate, statusFilter, userRole]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await listLedger({ ...baseParams, page });
        setEntries(res.data || []);
        setLastPage(Math.max(1, Number(res.last_page || 1)));
        setTotal(Number(res.total || 0));
      } catch {
        toast.error('Failed to load ledger entries');
        setEntries([]);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [baseParams, page]);

  useEffect(() => {
    const run = async () => {
      setSummaryLoading(true);
      try {
        const res = await getLedgerSummary(baseParams);
        setSummary(res);
      } catch {
        toast.error('Failed to load ledger summary');
        setSummary({ income_total: 0, expense_total: 0, net_total: 0, due_total: 0 });
      } finally {
        setSummaryLoading(false);
      }
    };

    run();
  }, [baseParams]);

  const applySearch = () => {
    setPage(1);
    setQuery(search);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportLedger(baseParams);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ledger_export_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Ledger CSV exported');
    } catch {
      toast.error('Failed to export ledger CSV');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1300px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ledger & Financial Reporting</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Unified income/expense ledger from transactions and expenses.</p>
      </div>

      <HospitalSelector
        userRole={userRole}
        selectedHospitalId={selectedHospitalId}
        onHospitalChange={(id) => { setSelectedHospitalId(id); setPage(1); }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-900/20 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Income</p>
            <CircleDollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-xl font-semibold text-emerald-800 dark:text-emerald-200">{money(summary.income_total)}</p>
        </div>
        <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-900/20 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-rose-700 dark:text-rose-300">Expense</p>
            <HandCoins className="w-4 h-4 text-rose-600" />
          </div>
          <p className="mt-2 text-xl font-semibold text-rose-800 dark:text-rose-200">{money(summary.expense_total)}</p>
        </div>
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-900/20 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Net</p>
            <BarChart3 className="w-4 h-4 text-blue-600" />
          </div>
          <p className="mt-2 text-xl font-semibold text-blue-800 dark:text-blue-200">{money(summary.net_total)}</p>
        </div>
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-900/20 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Outstanding Due</p>
            <CircleDollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <p className="mt-2 text-xl font-semibold text-amber-800 dark:text-amber-200">{money(summary.due_total)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 items-end">
          <div className="xl:col-span-2">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Search</label>
            <div className="mt-1 flex gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Title, category, source..."
                className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
              />
              <button
                type="button"
                onClick={applySearch}
                className="h-10 px-3 rounded-md bg-blue-600 text-white text-sm inline-flex items-center gap-1"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Module</label>
            <select
              value={moduleFilter}
              onChange={(e) => {
                setPage(1);
                setModuleFilter(e.target.value);
              }}
              className="mt-1 h-10 w-full px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
            >
              <option value="">All</option>
              <option value="appointments">Appointments</option>
              <option value="laboratory">Laboratory</option>
              <option value="room_booking">Room Booking</option>
              <option value="surgery">Surgery</option>
              <option value="pharmacy">Pharmacy</option>
              <option value="expenses">Expenses</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Direction</label>
            <select
              value={directionFilter}
              onChange={(e) => {
                setPage(1);
                setDirectionFilter(e.target.value as DirectionFilter);
              }}
              className="mt-1 h-10 w-full px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
            >
              <option value="">All</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="adjustment">Adjustment</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
              className="mt-1 h-10 w-full px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
            >
              <option value="">All</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="voided">Voided</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setPage(1);
                setStartDate(e.target.value);
              }}
              className="mt-1 h-10 w-full px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setPage(1);
                setEndDate(e.target.value);
              }}
              className="mt-1 h-10 w-full px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
            />
          </div>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          {summaryLoading ? 'Refreshing summary...' : `Showing ${entries.length} rows`} {total ? `of ${total}` : ''}
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="h-9 px-3 rounded-md bg-emerald-600 text-white text-xs inline-flex items-center gap-1 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Module</th>
                <th className="px-3 py-2">Direction</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Net</th>
                <th className="px-3 py-2 text-right">Paid</th>
                <th className="px-3 py-2 text-right">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading ledger entries...</td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No ledger entries found for selected filters.</td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-3 py-2">{entry.posted_at ? new Date(entry.posted_at).toLocaleDateString() : '-'}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900 dark:text-white">{entry.title}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">{entry.category || '-'} | {entry.source_type} #{entry.source_id}</div>
                    </td>
                    <td className="px-3 py-2">{entry.module}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                        entry.entry_direction === 'income'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : entry.entry_direction === 'expense'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}>
                        {entry.entry_direction}
                      </span>
                    </td>
                    <td className="px-3 py-2">{entry.status}</td>
                    <td className="px-3 py-2 text-right">{money(entry.net_amount)}</td>
                    <td className="px-3 py-2 text-right">{money(entry.paid_amount)}</td>
                    <td className="px-3 py-2 text-right">{money(entry.due_amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs">
          <div className="text-gray-500 dark:text-gray-400">Page {page} of {lastPage}</div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= lastPage}
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LedgerReport;
