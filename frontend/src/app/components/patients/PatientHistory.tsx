import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import {
  Activity,
  BedDouble,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  FlaskConical,
  HeartPulse,
  Loader2,
  Package,
  Phone,
  Scissors,
  ScanLine,
  Search,
  Smile,
  Stethoscope,
  User,
  X,
} from 'lucide-react';
import { Hospital, UserRole } from '../../types';
import { formatMoneyIn, formatNumberIn } from '../../utils/money';
import { StatusBadge } from '../ui/StatusBadge';
import { TABLE_HEAD_CLASS, Th, TR_CLASS } from '../ui/DataTable';
import { SearchableSelect, type SearchableOption } from '../SearchableSelect';
import { Modal } from '../accounts/MoneyEntryManagement';
import { CancelButton } from '../ui/FormControls';
import {
  getPatientHistory,
  getPatientHistoryEvent,
  searchPatients,
  type PatientHistoryEvent,
  type PatientHistoryEventDetail,
  type PatientHistoryResponse,
  type PatientSearchResult,
} from '../../api/patientHistory';

/**
 * A patient's whole record, on one page.
 *
 * Answering "what has this patient had done here" used to mean opening
 * Appointments, then Lab, then Radiology, then Surgery, then Admissions, and
 * reading nine date columns. This assembles all of them into a single sortable
 * table, newest first.
 *
 * Two ways in, because two habits exist: type a name or phone into the search,
 * or open the A-Z list and pick. Both feed the same selection.
 *
 * Deliberately read-only. Editing a lab order belongs on the lab screen, which
 * owns its validation; a history page that could also change things would be
 * two screens wearing one hat.
 */

const PAGE_SIZE = 50;

const MODULE_STYLE: Record<string, { icon: React.ReactNode; chip: string }> = {
  Appointment: {
    icon: <CalendarDays className="h-3 w-3" />,
    chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  Laboratory: {
    icon: <FlaskConical className="h-3 w-3" />,
    chip: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  },
  'X-Ray': {
    icon: <ScanLine className="h-3 w-3" />,
    chip: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  },
  Ultrasound: {
    icon: <Activity className="h-3 w-3" />,
    chip: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  },
  Surgery: {
    icon: <Scissors className="h-3 w-3" />,
    chip: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
  'Room Booking': {
    icon: <BedDouble className="h-3 w-3" />,
    chip: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  },
  Prescription: {
    icon: <ClipboardList className="h-3 w-3" />,
    chip: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  },
  Pharmacy: {
    icon: <Package className="h-3 w-3" />,
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  Dental: {
    icon: <Smile className="h-3 w-3" />,
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  ECG: {
    icon: <HeartPulse className="h-3 w-3" />,
    chip: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
};

const fallbackStyle = {
  icon: <ClipboardList className="h-3 w-3" />,
  chip: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

const styleFor = (module: string) => MODULE_STYLE[module] ?? fallbackStyle;

const safeDate = (value: string | null) => {
  if (!value) return null;
  try {
    return parseISO(value.replace(' ', 'T'));
  } catch {
    return null;
  }
};

/** "2072 · 0700798915 · 19 Y · Female" — the grey second line on a patient. */
const patientMeta = (patient: { patient_id: string; phone: string | null; age: number | null; gender: string | null }) =>
  [patient.patient_id, patient.phone, patient.age != null ? `${patient.age} Y` : null, patient.gender]
    .filter(Boolean)
    .join(' · ');

type SortKey = 'date' | 'module' | 'title' | 'doctor_name' | 'net_amount' | 'status';

interface PatientHistoryProps {
  hospital: Hospital;
  userRole: UserRole;
}

export function PatientHistory({ hospital }: PatientHistoryProps) {
  const { i18n } = useTranslation();
  const currency = 'AFN';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PatientSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [directory, setDirectory] = useState<PatientSearchResult[]>([]);
  const [selected, setSelected] = useState<PatientSearchResult | null>(null);

  const [history, setHistory] = useState<PatientHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The row whose record is open in the detail modal, and what the server
  // returned for it. Kept apart so the modal can show the row's own heading
  // while the detail is still loading.
  const [detailOf, setDetailOf] = useState<PatientHistoryEvent | null>(null);
  const [detail, setDetail] = useState<PatientHistoryEventDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [moduleFilter, setModuleFilter] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const money = (value: number) => formatMoneyIn(value, currency, i18n.language);

  /*
   * The A-Z list backing the dropdown.
   *
   * Loaded once per hospital and sorted by name, so the combo can be opened and
   * browsed without typing. The typed search still hits the server, because
   * this first page is not the whole register.
   */
  useEffect(() => {
    let cancelled = false;

    searchPatients({ hospital_id: Number(hospital.id), per_page: 1000 })
      .then((rows) => {
        if (cancelled) return;
        setDirectory([...rows].sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => {
        if (!cancelled) setDirectory([]);
      });

    return () => {
      cancelled = true;
    };
  }, [hospital.id]);

  // Debounced so typing a name does not fire a request per keystroke against a
  // 2,000-row patient table.
  const debounce = useRef<number | undefined>(undefined);

  useEffect(() => {
    const term = query.trim();

    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    window.clearTimeout(debounce.current);

    debounce.current = window.setTimeout(() => {
      searchPatients({ hospital_id: Number(hospital.id), search: term })
        .then((rows) => setResults([...rows].sort((a, b) => a.name.localeCompare(b.name))))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);

    return () => window.clearTimeout(debounce.current);
  }, [query, hospital.id]);

  useEffect(() => {
    if (!selected) {
      setHistory(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getPatientHistory(selected.id)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch((caught: any) => {
        if (cancelled) return;
        setError(
          caught?.response?.status === 403
            ? 'This patient belongs to another hospital.'
            : caught?.response?.data?.message || 'Could not load this history.'
        );
        setHistory(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    if (!detailOf || !selected) {
      setDetail(null);
      setDetailError(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);

    getPatientHistoryEvent(selected.id, detailOf.id)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((caught: any) => {
        if (!cancelled) {
          setDetailError(caught?.response?.data?.message || 'Could not load this record.');
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [detailOf, selected]);

  const choose = (patient: PatientSearchResult | null) => {
    setDetailOf(null);
    setSelected(patient);
    setModuleFilter('');
    setSortKey('date');
    setSortDir('desc');
    setPage(1);
    setQuery('');
    setResults([]);
  };

  /** The dropdown's options: every patient, A-Z, with the grey detail line. */
  const directoryOptions: SearchableOption[] = useMemo(
    () =>
      directory.map((patient) => ({
        value: String(patient.id),
        label: patient.name,
        meta: patientMeta(patient),
      })),
    [directory]
  );

  const filteredRows = useMemo(() => {
    if (!history) return [];
    return moduleFilter ? history.rows.filter((row) => row.module === moduleFilter) : history.rows;
  }, [history, moduleFilter]);

  const sortedRows = useMemo(() => {
    // Copied before sorting: Array.prototype.sort mutates, and these rows come
    // from state.
    return [...filteredRows].sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case 'net_amount':
          comparison = a.net_amount - b.net_amount;
          break;
        case 'date': {
          const left = safeDate(a.date)?.getTime() ?? 0;
          const right = safeDate(b.date)?.getTime() ?? 0;
          comparison = left - right;
          break;
        }
        default:
          comparison = String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''));
      }

      return sortDir === 'asc' ? comparison : -comparison;
    });
  }, [filteredRows, sortKey, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [moduleFilter, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleRows = sortedRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Dates and money read most usefully largest-first.
      setSortDir(key === 'date' || key === 'net_amount' ? 'desc' : 'asc');
    }
  };

  const header = (label: string, key: SortKey, align: 'left' | 'right' = 'left') => (
    <Th onSort={() => toggleSort(key)} active={sortKey === key} direction={sortDir} align={align}>
      {label}
    </Th>
  );

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Patient History</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Every visit, test, scan, operation and prescription for one patient — {hospital.name}
        </p>
      </div>

      {/* ----------------------------------------------- search + directory */}
      <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-3 md:flex-row">
          {/* Type-to-search, hitting the server: finds anyone in the register. */}
          <div className="md:w-3/4">
            <label className="mb-1 block text-[11px] font-medium text-gray-600 dark:text-gray-400">
              Search by name, patient ID or phone
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Start typing to search…"
                className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
              )}
            </div>
          </div>

          {/* The A-Z list, for browsing rather than searching. */}
          <div className="md:w-1/4">
            <label className="mb-1 block text-[11px] font-medium text-gray-600 dark:text-gray-400">
              Or pick from the list (A–Z)
            </label>
            <SearchableSelect
              value={selected ? String(selected.id) : ''}
              options={directoryOptions}
              onChange={(value) =>
                choose(directory.find((patient) => String(patient.id) === value) ?? null)
              }
              placeholder="Select patient"
              emptyMessage="No patients found"
            />
          </div>
        </div>

        {query.trim().length >= 2 && results.length > 0 && (
          <ul className="mt-2 max-h-60 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {results.map((patient) => (
              <li key={patient.id}>
                <button
                  type="button"
                  onClick={() => choose(patient)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {patient.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-gray-900 dark:text-white">
                      {patient.name}
                    </span>
                    <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
                      {patientMeta(patient)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {query.trim().length >= 2 && !searching && results.length === 0 && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">No patient matched that search.</p>
        )}
      </div>

      {!selected && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-600 dark:bg-gray-800">
          <User className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Choose a patient to see their history
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Their appointments, lab orders, x-rays, ultrasounds, surgeries, admissions, prescriptions
            and medicine purchases appear here in one list.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {selected && loading && (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {history && !loading && (
        <>
          {/* --------------------------------------------------- profile */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  {history.patient.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-base font-bold text-gray-900 dark:text-white">
                    {history.patient.name}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                    <span>ID #{history.patient.patient_id}</span>
                    {history.patient.age != null && <span>{history.patient.age} years</span>}
                    {history.patient.gender && <span className="capitalize">{history.patient.gender}</span>}
                    {history.patient.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {history.patient.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => choose(null)}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 sm:grid-cols-4 dark:border-gray-700">
              {[
                { label: 'Events', value: formatNumberIn(history.summary.events, i18n.language) },
                { label: 'Modules Used', value: formatNumberIn(history.summary.modules, i18n.language) },
                { label: 'Total Billed', value: money(history.summary.billed) },
                {
                  label: 'First / Last Visit',
                  value:
                    history.summary.first_visit && history.summary.last_visit
                      ? `${format(safeDate(history.summary.first_visit)!, 'dd MMM yy')} – ${format(
                          safeDate(history.summary.last_visit)!,
                          'dd MMM yy'
                        )}`
                      : '—',
                },
              ].map((card) => (
                <div key={card.label}>
                  <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {card.label}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                    {card.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {history.meta.skipped_modules.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              Could not read: {history.meta.skipped_modules.join(', ')}. Everything else below is
              complete.
            </div>
          )}

          {/* ---------------------------------------------- module filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setModuleFilter('')}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                moduleFilter === ''
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              All ({history.summary.events})
            </button>
            {Object.entries(history.meta.by_module).map(([module, count]) => {
              const style = styleFor(module);
              const active = moduleFilter === module;
              return (
                <button
                  key={module}
                  type="button"
                  onClick={() => setModuleFilter(active ? '' : module)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    active ? 'bg-blue-600 text-white' : style.chip
                  }`}
                >
                  {style.icon}
                  {module} ({count})
                </button>
              );
            })}
          </div>

          {/* ------------------------------------------------- the records */}
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className={TABLE_HEAD_CLASS}>
                  <tr>
                    <Th>#</Th>
                    {header('Date', 'date')}
                    {header('Module', 'module')}
                    {header('Details', 'title')}
                    {header('Doctor', 'doctor_name')}
                    <Th>Reference</Th>
                    {header('Status', 'status')}
                    <Th>Payment</Th>
                    {header('Amount', 'net_amount', 'right')}
                    <Th align="center">View</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {visibleRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center">
                        <ClipboardList className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
                        <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                          No records for this patient
                        </p>
                      </td>
                    </tr>
                  )}

                  {visibleRows.map((event: PatientHistoryEvent, index) => {
                    const style = styleFor(event.module);
                    const when = safeDate(event.date);

                    return (
                      <tr key={event.id} className={TR_CLASS}>
                        <td className="px-4 py-2 text-xs text-gray-400">
                          {(safePage - 1) * PAGE_SIZE + index + 1}
                        </td>
                        <td className="px-4 py-2 text-xs whitespace-nowrap text-gray-800 dark:text-gray-200">
                          {when ? (
                            <>
                              {format(when, 'dd MMM yyyy')}
                              <span className="ml-1 text-[10px] text-gray-400">{format(when, 'HH:mm')}</span>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.chip}`}
                          >
                            {style.icon}
                            {event.module}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs font-medium text-gray-900 dark:text-white">
                          {event.title}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">
                          {event.doctor_name ? (
                            <span className="inline-flex items-center gap-1">
                              <Stethoscope className="h-3 w-3 text-gray-400" />
                              {event.doctor_name}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                          {event.reference || '—'}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          <StatusBadge status={event.status} />
                        </td>
                        <td className="px-4 py-2 text-xs">
                          <StatusBadge status={event.payment_status} />
                        </td>
                        {/* Prescriptions carry no charge of their own -- the
                            medicine is billed on the pharmacy sale -- so a 0.00
                            would read as "free" rather than "not applicable". */}
                        <td className="px-4 py-2 text-right text-xs font-semibold tabular-nums text-gray-900 dark:text-white">
                          {event.net_amount > 0 ? money(event.net_amount) : '—'}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => setDetailOf(event)}
                            title={`View this ${event.module} record`}
                            className="rounded p-1 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-4 py-2 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-400">
              <div>
                {sortedRows.length > 0
                  ? `Showing ${(safePage - 1) * PAGE_SIZE + 1}-${Math.min(
                      safePage * PAGE_SIZE,
                      sortedRows.length
                    )} of ${sortedRows.length}`
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
        </>
      )}

      {/* ------------------------------------------------- record detail */}
      {detailOf && (
        <Modal
          title={`${detailOf.module} — ${detailOf.title}`}
          onClose={() => setDetailOf(null)}
          width="max-w-3xl"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  styleFor(detailOf.module).chip
                }`}
              >
                {styleFor(detailOf.module).icon}
                {detailOf.module}
              </span>
              {safeDate(detailOf.date) && (
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {format(safeDate(detailOf.date)!, 'dd MMM yyyy HH:mm')}
                </span>
              )}
              <StatusBadge status={detailOf.status} />
              <StatusBadge status={detailOf.payment_status} />
              {detailOf.net_amount > 0 && (
                <span className="ml-auto text-sm font-bold text-blue-600 dark:text-blue-400">
                  {money(detailOf.net_amount)}
                </span>
              )}
            </div>

            {detailLoading && (
              <div className="py-10 text-center">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
              </div>
            )}

            {detailError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                {detailError}
              </div>
            )}

            {detail && !detailLoading && (
              <>
                {detail.fields.length > 0 && (
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg bg-gray-50 p-3 sm:grid-cols-2 dark:bg-gray-900/50">
                    {detail.fields.map((field) => (
                      <div key={field.label}>
                        <dt className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          {field.label}
                        </dt>
                        {/* Pre-wrapped: the server turns stored paragraph markup
                            into newlines, and a diagnosis reads as written. */}
                        <dd className="mt-0.5 whitespace-pre-wrap text-xs font-medium text-gray-900 dark:text-white">
                          {field.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                {detail.items && (
                  <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className={TABLE_HEAD_CLASS}>
                          <tr>
                            <Th>#</Th>
                            {detail.items.columns.map((column) => (
                              <Th key={column}>{column}</Th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {detail.items.rows.map((row, index) => (
                            <tr key={index} className={TR_CLASS}>
                              <td className="px-4 py-2 text-xs text-gray-400">{index + 1}</td>
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={cellIndex}
                                  className="px-4 py-2 text-xs text-gray-800 dark:text-gray-200"
                                >
                                  {cell ?? '—'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {detail.fields.length === 0 && !detail.items && (
                  <p className="py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                    This record has no further detail to show.
                  </p>
                )}
              </>
            )}

            <div className="flex justify-end border-t border-gray-200 pt-3 dark:border-gray-700">
              <CancelButton onClick={() => setDetailOf(null)} label="Close" />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default PatientHistory;
