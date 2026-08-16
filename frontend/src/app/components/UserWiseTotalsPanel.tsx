import React, { useCallback, useEffect, useState } from 'react';
import { Printer, Loader2, RefreshCw } from 'lucide-react';
import { Hospital } from '../types';
import { printHandoverReport } from '../utils/handoverPrint';

interface Column {
  key: string;
  label: string;
}

interface UserRow {
  user_name: string;
  amounts: Record<string, number>;
  total_amount: number;
}

interface ByUserData {
  from: string;
  to: string;
  currency: string;
  generated_at: string;
  columns: Column[];
  users: UserRow[];
  grand_total: number;
}

interface Props {
  hospital: Hospital;
  /** Defaults for the range, taken from whatever the dashboard is showing. */
  defaultFrom: string;
  defaultTo: string;
  fetchByUser: (from: string, to: string) => Promise<ByUserData>;
}

/**
 * Who collected what, over a chosen range.
 *
 * Shifts mean several people take money against the same revenue areas in a
 * day, so a single hospital-wide figure cannot be signed for by one person.
 * Each row prints its own handover sheet naming that collector.
 *
 * The columns are whichever revenue areas the viewer is permitted to see, and
 * which users appear is decided by the backend -- staff see only themselves.
 */
export function UserWiseTotalsPanel({ hospital, defaultFrom, defaultTo, fetchByUser }: Props) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [data, setData] = useState<ByUserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextFrom: string, nextTo: string) => {
      setLoading(true);
      setError(null);
      try {
        setData(await fetchByUser(nextFrom, nextTo));
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Could not load user totals.');
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [fetchByUser]
  );

  // Follow the dashboard's range until the user picks their own.
  useEffect(() => {
    setFrom(defaultFrom);
    setTo(defaultTo);
    load(defaultFrom, defaultTo);
  }, [defaultFrom, defaultTo, load]);

  const money = (value: number) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

  const printFor = (row: UserRow) => {
    if (!data) return;
    printHandoverReport({
      hospitalName: hospital.name || '',
      hospitalAddress: hospital.address,
      hospitalPhone: hospital.phone,
      from: data.from,
      to: data.to,
      submittedBy: row.user_name,
      generatedAt: data.generated_at,
      currency: data.currency,
      lines: data.columns
        .map((column) => ({ label: column.label, amount: row.amounts[column.key] ?? 0 }))
        // A revenue area this person did not collect for is noise on a sheet
        // they have to sign.
        .filter((line) => line.amount !== 0),
      totalAmount: row.total_amount,
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
        <div>
          <h3 className="text-xs font-semibold text-gray-900 dark:text-white">User-Wise Totals</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Collections per user for the selected range. Print a handover sheet for each.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-900 dark:text-white"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-900 dark:text-white"
          />
          <button
            onClick={() => load(from, to)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Apply
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {data && data.users.length === 0 && !loading && (
        <p className="text-xs text-gray-500 dark:text-gray-400">No collections recorded for this range.</p>
      )}

      {data && data.users.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="py-1.5 pr-2">User</th>
                {data.columns.map((column) => (
                  <th key={column.key} className="py-1.5 px-2 text-right whitespace-nowrap">{column.label}</th>
                ))}
                <th className="py-1.5 px-2 text-right">Total</th>
                <th className="py-1.5 pl-2" />
              </tr>
            </thead>
            <tbody>
              {data.users.map((row) => (
                <tr key={row.user_name} className="border-b border-gray-100 dark:border-gray-700/60">
                  <td className="py-1.5 pr-2 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                    {row.user_name}
                  </td>
                  {data.columns.map((column) => (
                    <td key={column.key} className="py-1.5 px-2 text-right text-gray-700 dark:text-gray-300">
                      {money(row.amounts[column.key] ?? 0)}
                    </td>
                  ))}
                  <td className="py-1.5 px-2 text-right font-semibold text-gray-900 dark:text-white">
                    {money(row.total_amount)}
                  </td>
                  <td className="py-1.5 pl-2 text-right">
                    <button
                      onClick={() => printFor(row)}
                      className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                      title={`Print handover for ${row.user_name}`}
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-2 font-bold text-gray-900 dark:text-white">Total</td>
                {data.columns.map((column) => (
                  <td key={column.key} className="pt-2 text-right font-semibold text-gray-900 dark:text-white">
                    {money(data.users.reduce((sum, row) => sum + (row.amounts[column.key] ?? 0), 0))}
                  </td>
                ))}
                <td className="pt-2 text-right font-bold text-gray-900 dark:text-white">{money(data.grand_total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
