import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Wallet, RefreshCw, X, ArrowUp, ArrowDown, ArrowUpDown, Undo2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Hospital, UserRole } from '../types';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { ModalOverlay, ModalPanel } from './ui/ModalParts';
import {
  listPendingPayments,
  settlePendingCharge,
  reversePendingCharge,
  PendingCharge,
  GrandTotal,
  ModuleTally,
  PharmacyBreakdown,
  SortColumn,
} from '../../api/paymentCollection';
import { useAuth } from '../context/AuthContext';
import { buildReportHtml, dateTime, localStamp, money } from '../utils/paymentCollectionReport';

interface PaymentCollectionProps {
  hospital: Hospital;
  userRole?: UserRole;
}

// Fifty rows is about a screenful at this density; everything beyond it is
// reachable by paging rather than being cut off.
const PER_PAGE = 50;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return localStamp(d);
};

const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return localStamp(d);
};

/**
 * One module's money, at a glance.
 *
 * The headline is what was billed; paid and due sit under it in small type
 * because the collector's question is "how much, and how much of it is still
 * owed" -- three equal-weight figures would make that harder to read, not
 * easier.
 */
function StatPanel({
  title,
  meta,
  total,
  paid,
  due,
  note,
  emphasis = false,
}: {
  title: string;
  meta: string;
  total: number;
  paid: number;
  due: number;
  note?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-1 min-w-[124px] ${
        emphasis
          ? 'border-blue-300 dark:border-blue-700 bg-blue-50/60 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 truncate">
          {title}
        </span>
        <span className="text-[8px] text-gray-400 whitespace-nowrap">{meta}</span>
      </div>
      <div className="text-sm font-semibold tabular-nums leading-tight text-gray-900 dark:text-white">
        {money(total)}
      </div>
      <div className="text-[8px] leading-tight tabular-nums whitespace-nowrap">
        <span className="text-emerald-600 dark:text-emerald-400">{money(paid)}</span>
        <span className="text-gray-400"> paid · </span>
        <span className="text-rose-600 dark:text-rose-400">{money(due)}</span>
        <span className="text-gray-400"> due</span>
      </div>
      {note && (
        <div className="text-[8px] leading-tight text-gray-400 tabular-nums whitespace-nowrap">{note}</div>
      )}
    </div>
  );
}

/**
 * The money collector's desk.
 *
 * One queue for every unpaid charge in the hospital, because that is the shape
 * of the job: a patient arrives with a slip or a name, not with a module, and
 * may owe for a consultation and a lab test at the same window. The alternative
 * -- module, then submenu, then page, six times over -- is what makes the queue
 * long.
 *
 * Which modules appear is decided by the API from the user's collection
 * permissions, never by this component: a pharmacy-only cashier is served
 * pharmacy invoices and never learns the rest exist.
 */
export function PaymentCollection({ hospital, userRole = 'admin' }: PaymentCollectionProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { selectedHospitalId, setSelectedHospitalId, currentHospital } = useHospitalFilter(hospital, userRole);

  const [charges, setCharges] = useState<PendingCharge[]>([]);
  const [modules, setModules] = useState<ModuleTally[]>([]);
  const [summary, setSummary] = useState({
    due_total: 0,
    due_total_all: 0,
    entries: 0,
    collected_in_range: 0,
    collected_today: 0,
  });

  // The window on screen, defaulting to the whole of today. A counter is
  // reconciled per shift as often as per day, so both ends carry a time rather
  // than a bare date -- and both are sent to the server, which decides the
  // window and echoes back what it applied.
  const [from, setFrom] = useState(() => startOfToday());
  const [to, setTo] = useState(() => endOfToday());
  const [breakdown, setBreakdown] = useState<PharmacyBreakdown | null>(null);
  const [grandTotal, setGrandTotal] = useState<GrandTotal>({ entries: 0, total_amount: 0, paid_amount: 0, due_amount: 0 });
  const [printing, setPrinting] = useState(false);
  const [activeModule, setActiveModule] = useState<string>('');
  const [search, setSearch] = useState('');
  // Newest first, and the API keeps unpaid rows above settled ones whatever
  // column is chosen -- this is a work queue before it is a report.
  const [sort, setSort] = useState<SortColumn>('date');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(false);
  const [settling, setSettling] = useState<PendingCharge | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [busy, setBusy] = useState(false);
  const [reversing, setReversing] = useState<PendingCharge | null>(null);
  const [reason, setReason] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPendingPayments({
        hospital_id: currentHospital.id,
        module: activeModule || undefined,
        search: search.trim() || undefined,
        sort,
        direction,
        per_page: PER_PAGE,
        page,
        from,
        to,
      });
      setCharges(res.data);
      setModules(res.modules);
      setSummary(res.summary);
      setBreakdown(res.pharmacy_breakdown ?? null);
      setGrandTotal(res.grand_total);
      setMeta(res.meta ?? { current_page: 1, last_page: 1, total: res.data.length });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load pending payments');
    } finally {
      setLoading(false);
    }
  }, [currentHospital.id, activeModule, search, sort, direction, page, from, to]);

  // Debounced so typing a patient name does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  /**
   * Clicking a header sorts by it; clicking the same one again reverses.
   * Amount and date open on descending -- the biggest debt and the newest
   * charge are what a collector looks for first.
   */
  useEffect(() => { setPage(1); }, [activeModule, search, sort, direction, currentHospital.id, from, to]);

  const toggleSort = (column: SortColumn) => {
    if (sort === column) {
      setDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(column);
      setDirection(column === 'amount' || column === 'date' ? 'desc' : 'asc');
    }
  };

  const openReverse = (charge: PendingCharge) => {
    setReversing(charge);
    setReason('');
  };

  const confirmReverse = async () => {
    if (!reversing) return;
    // Lab and ultrasound reject a reversal without one, and every module is
    // better off recording why money was put back.
    if (!reason.trim()) {
      toast.error('Please give a reason for the reversal.');
      return;
    }
    setBusy(true);
    try {
      await reversePendingCharge(reversing, reason.trim());
      toast.success('Payment reversed');
      setReversing(null);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message
        || (err?.response?.status === 403
          ? 'You do not have permission to reverse payments for this module.'
          : 'Failed to reverse payment'));
    } finally {
      setBusy(false);
    }
  };

  const openSettle = (charge: PendingCharge) => {
    setSettling(charge);
    setAmount(String(charge.due_amount));
    setMethod('cash');
  };

  const confirmSettle = async () => {
    if (!settling) return;
    setBusy(true);
    try {
      await settlePendingCharge(settling, {
        amount: settling.supports_partial ? Number(amount) : undefined,
        paymentMethod: method,
      });
      toast.success(`Collected ${money(settling.supports_partial ? Number(amount) : settling.due_amount)}`);
      setSettling(null);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message
        || (err?.response?.status === 403
          ? 'You do not have permission to collect for this module.'
          : 'Failed to record payment'));
    } finally {
      setBusy(false);
    }
  };

  /**
   * The handover sheet.
   *
   * Every row in the range, not just the page on screen -- a report that stops
   * at row 50 cannot be signed for. The list is re-fetched at full depth rather
   * than printed from component state for that reason.
   */
  const printReport = async () => {
    setPrinting(true);
    try {
      const rows: PendingCharge[] = [];
      let pageNo = 1;
      let lastPage = 1;
      do {
        const res = await listPendingPayments({
          hospital_id: currentHospital.id,
          module: activeModule || undefined,
          search: search.trim() || undefined,
          sort,
          direction,
          per_page: 200,
          page: pageNo,
          from,
          to,
        });
        rows.push(...res.data);
        lastPage = res.meta?.last_page ?? 1;
        pageNo += 1;
        // A malformed paginator must not spin forever.
      } while (pageNo <= lastPage && pageNo <= 50);

      const win = window.open('', '_blank', 'width=1000,height=700');
      if (!win) {
        toast.error('Please allow pop-ups for this site to print the report.');
        return;
      }
      win.document.write(buildReportHtml({
        hospital: currentHospital,
        rows,
        breakdown,
        modules,
        grandTotal,
        from,
        to,
        submittedBy: user?.name || '—',
        // Never "All modules": the figures cover exactly the modules this user
        // may collect for, so the sheet has to name them. Someone signing a
        // handover needs to know whether Lab and Ultrasound are in the total
        // or not.
        moduleLabel: activeModule
          ? (modules.find((m) => m.module === activeModule)?.label ?? activeModule)
          : (modules.map((m) => m.label).join(', ') || '—'),
      }));
      win.document.close();
      win.focus();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not build the report');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="space-y-3">
      <HospitalSelector userRole={userRole} selectedHospitalId={selectedHospitalId} onHospitalChange={setSelectedHospitalId} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Collection</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Every unpaid charge you are permitted to settle, in one place.
          </p>
        </div>
        {/* The reconciliation figures, at the top right where the two summary
            tiles used to be. Those tiles were dropped rather than moved: they
            reported one module's outstanding and one collector's takings, which
            these panels already cover per module and in more useful detail.

            One panel per module the user may actually collect for, so the strip
            is the shape of their own job rather than the hospital's whole
            revenue. Pharmacy is the exception: its money is two opposite things
            -- sales in, purchases out -- and a single figure spanning both is
            not an amount anyone hands over. */}
        <div className="flex flex-wrap items-stretch gap-1.5 justify-end">
          <StatPanel
            title="Totals"
            meta={`${grandTotal.entries} doc${grandTotal.entries === 1 ? '' : 's'}`}
            total={grandTotal.total_amount}
            paid={grandTotal.paid_amount}
            due={grandTotal.due_amount}
            emphasis
          />

          {modules
            // Pharmacy is represented by its own two panels below.
            .filter((m) => !(m.module === 'pharmacy' && breakdown))
            .map((m) => (
              <StatPanel
                key={m.module}
                title={m.label}
                meta={`${m.entries} doc${m.entries === 1 ? '' : 's'}`}
                total={m.total_amount}
                paid={m.paid_amount}
                due={m.due_amount}
              />
            ))}

          {breakdown && (['sales', 'purchase'] as const).map((family) => {
            const t = breakdown.totals[family];
            const invoice = breakdown.types.find((ty) => ty.family === family && ty.sign === 1);
            const ret = breakdown.types.find((ty) => ty.family === family && ty.sign === -1);
            return (
              <StatPanel
                key={family}
                title={family === 'sales' ? 'Pharmacy Sales' : 'Pharmacy Purchase'}
                meta={`${t.entries} doc${t.entries === 1 ? '' : 's'}`}
                total={t.total_amount}
                paid={t.paid_amount}
                due={t.due_amount}
                // Returns net off their own family, so the arithmetic behind the
                // headline is visible without opening another screen.
                note={`${money(invoice?.total_amount ?? 0)} − ${money(ret?.total_amount ?? 0)}`}
              />
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient name, code, phone or reference..."
            className="w-full pl-8 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs"
          />
        </div>

        {/* datetime-local, not date: the hour is the point. A shift that ends at
            17:00 is not the same window as the calendar day around it. */}
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-0.5" htmlFor="pc-from">From</label>
          <input
            id="pc-from"
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-2 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-0.5" htmlFor="pc-to">To</label>
          <input
            id="pc-to"
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-2 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs text-gray-900 dark:text-white"
          />
        </div>

        {/* Beside the range they act on. The preset buttons that used to sit
            here were removed: the window opens on today already, and any other
            period is what the two inputs to the left are for. */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={printReport}
            disabled={printing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 disabled:opacity-50"
            title="Print the handover report for this date range"
          >
            <Printer className={`w-3.5 h-3.5 ${printing ? 'animate-pulse' : ''}`} />
            {printing ? 'Preparing...' : 'Print Report'}
          </button>
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200"
            title={t('ui.refresh')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {t('ui.refresh')}
          </button>
        </div>
      </div>

      {/* Module chips: the per-module view, as a filter on one queue rather than
          six destinations to choose between before searching. */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveModule('')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
            activeModule === ''
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
          }`}
        >
          All ({summary.entries})
        </button>
        {modules.map((m) => (
          <button
            key={m.module}
            onClick={() => setActiveModule(activeModule === m.module ? '' : m.module)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              activeModule === m.module
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
            }`}
          >
            {m.label} ({m.entries}) · {money(m.due_total)}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 dark:bg-gray-700/40 text-gray-700 dark:text-gray-200">
            <tr>
              {([
                ['code', 'Patient Code', 'w-28'],
                ['name', 'Name', ''],
                ['phone', 'Phone', 'w-32'],
                ['reference', 'Reference', 'w-44'],
                ['module', 'Module', 'w-36'],
                ['status', 'Payment', 'w-24'],
                ['amount', 'Amount Due', 'w-28 text-right'],
                ['date', 'Date', 'w-28'],
              ] as [SortColumn, string, string][]).map(([column, label, width]) => (
                <th key={column} className={`px-3 py-2 whitespace-nowrap ${width}`}>
                  <button
                    type="button"
                    onClick={() => toggleSort(column)}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider leading-tight text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                    title={`Sort by ${label}`}
                  >
                    {label}
                    {sort === column
                      ? (direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
                      : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                  </button>
                </th>
              ))}
              <th className="px-3 py-2 w-32 text-right text-[10px] font-semibold uppercase tracking-wider leading-tight text-gray-600 dark:text-gray-300">Action</th>
            </tr>
          </thead>
          <tbody>
            {charges.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                  Nothing found{search ? ' for this search' : ''}.
                </td>
              </tr>
            )}

            {charges.map((row) => {
              const isPending = row.payment_status === 'pending';
              return (
                <tr
                  key={`${row.source_type}-${row.source_id}`}
                  className="border-t border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/20"
                >
                  <td className="px-3 py-1.5 text-gray-500">{row.patient_code || '-'}</td>
                  <td className="px-3 py-1.5 font-medium text-gray-900 dark:text-white">
                    {row.patient_name || '-'}
                    {/* Flagged because it changes what the cashier can look up:
                        a walk-in has no hospital record to cross-check. */}
                    {row.is_walk_in && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        Walk-in
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300">{row.patient_phone || '-'}</td>
                  <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300">{row.reference}</td>
                  <td className="px-3 py-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      {row.module_label}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      isPending
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    }`}>
                      {isPending ? 'Pending' : 'Paid'}
                    </span>
                  </td>
                  <td className={`px-3 py-1.5 text-right font-semibold ${isPending ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                    {isPending ? money(row.due_amount) : money(row.net_amount)}
                  </td>
                  <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">
                    {row.effective_at ?? row.posted_at ? dateTime((row.effective_at ?? row.posted_at)!) : '-'}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {isPending ? (
                      <button
                        onClick={() => openSettle(row)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-700"
                      >
                        <Wallet className="w-3 h-3" />
                        Collect
                      </button>
                    ) : row.can_reverse ? (
                      <button
                        onClick={() => openReverse(row)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-rose-300 text-rose-700 dark:text-rose-300 dark:border-rose-700 text-[11px] font-medium hover:bg-rose-50 dark:hover:bg-rose-900/20"
                        title="Put this payment back to pending"
                      >
                        <Undo2 className="w-3 h-3" />
                        Reverse
                      </button>
                    ) : (
                      <span className="text-[10px] text-gray-400">Settled</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-gray-500 dark:text-gray-400">
        <span>
          {meta.total === 0
            ? 'No records'
            : <>Showing <span className="font-medium text-gray-700 dark:text-gray-200">{(meta.current_page - 1) * PER_PAGE + 1}–{Math.min(meta.current_page * PER_PAGE, meta.total)}</span> of <span className="font-medium text-gray-700 dark:text-gray-200">{meta.total}</span></>}
        </span>

        {/* One segmented control rather than five loose buttons: at this size
            separate bordered boxes read as clutter next to the table. */}
        {meta.last_page > 1 && (
          <div className="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden">
            {([
              ['«', () => setPage(1), meta.current_page <= 1],
              ['‹', () => setPage((p) => Math.max(1, p - 1)), meta.current_page <= 1],
            ] as [string, () => void, boolean][]).map(([label, onClick, disabled], i) => (
              <button
                key={i}
                onClick={onClick}
                disabled={disabled}
                className="px-2 py-1 border-r border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                {label}
              </button>
            ))}
            <span className="px-2.5 py-1 text-gray-700 dark:text-gray-200 tabular-nums">
              {meta.current_page} / {meta.last_page}
            </span>
            {([
              ['›', () => setPage((p) => Math.min(meta.last_page, p + 1)), meta.current_page >= meta.last_page],
              ['»', () => setPage(meta.last_page), meta.current_page >= meta.last_page],
            ] as [string, () => void, boolean][]).map(([label, onClick, disabled], i) => (
              <button
                key={i}
                onClick={onClick}
                disabled={disabled}
                className="px-2 py-1 border-l border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {reversing && (
        <ModalOverlay open>
          <ModalPanel size="sm">
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Reverse payment</h2>
              <button onClick={() => !busy && setReversing(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="text-xs text-gray-600 dark:text-gray-300">
                <div className="font-semibold text-gray-900 dark:text-white">{reversing.patient_name || reversing.reference}</div>
                <div>{reversing.module_label} · {reversing.reference}</div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Amount to put back</span>
                <span className="font-semibold text-gray-900 dark:text-white">{money(reversing.net_amount)}</span>
              </div>

              <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
                This charge returns to pending and the amount leaves the collector's
                day total. The reason is kept against your name.
              </div>

              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                  Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  maxLength={255}
                  placeholder="e.g. collected against the wrong patient"
                  className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 p-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setReversing(null)}
                disabled={busy}
                className="flex-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300"
              >
                {t('ui.cancel')}
              </button>
              <button
                onClick={confirmReverse}
                disabled={busy || !reason.trim()}
                className="flex-1 px-3 py-1.5 text-xs bg-rose-600 text-white rounded-md font-medium hover:bg-rose-700 disabled:opacity-60"
              >
                {busy ? 'Reversing...' : 'Reverse payment'}
              </button>
            </div>
          </ModalPanel>
        </ModalOverlay>
      )}

      {settling && (
        <ModalOverlay open>
          <ModalPanel size="sm">
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Collect payment</h2>
              <button onClick={() => !busy && setSettling(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="text-xs text-gray-600 dark:text-gray-300">
                <div className="font-semibold text-gray-900 dark:text-white">{settling.patient_name || settling.title}</div>
                <div>{settling.module_label} · {settling.title}</div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Amount due</span>
                <span className="font-semibold text-gray-900 dark:text-white">{money(settling.due_amount)}</span>
              </div>

              {/* An amount box only where the module can actually record a part
                  payment; elsewhere it would promise something the document
                  cannot store. */}
              {settling.supports_partial ? (
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Amount received</label>
                  <input
                    type="number"
                    min={0}
                    max={settling.due_amount}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs"
                  />
                  <p className="mt-1 text-[10px] text-gray-500">Part payment is allowed for this module.</p>
                </div>
              ) : (
                <p className="text-[10px] text-gray-500">
                  This module is settled in full; the whole amount will be recorded.
                </p>
              )}

              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  title="Payment method"
                  className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank transfer</option>
                  <option value="mobile">Mobile money</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 p-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setSettling(null)}
                disabled={busy}
                className="flex-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300"
              >
                {t('ui.cancel')}
              </button>
              <button
                onClick={confirmSettle}
                disabled={busy}
                className="flex-1 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-md font-medium hover:bg-emerald-700 disabled:opacity-60"
              >
                {busy ? 'Recording...' : 'Confirm'}
              </button>
            </div>
          </ModalPanel>
        </ModalOverlay>
      )}
    </div>
  );
}
