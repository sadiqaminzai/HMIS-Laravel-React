import React, { useCallback, useEffect, useState } from 'react';
import type { ReportEnvelope } from '../../api/pharmacyReports';

/**
 * The pieces every report tab needs: a fetch hook and the filter controls.
 *
 * These started inside PharmacyReports. The clinical and money desks ask for
 * exactly the same things -- a date range, a loading state, an error message --
 * so they live here rather than being copied into each page and drifting.
 */

/**
 * Runs one report endpoint and keeps its state.
 *
 * The fetch is keyed on a serialised copy of the params rather than the object
 * itself: the caller builds a fresh object every render, and depending on the
 * object identity would refetch on every keystroke anywhere on the page.
 */
export function useReport<TRow>(
  fetcher: (params: any) => Promise<ReportEnvelope<TRow>>,
  params: Record<string, any>
) {
  const [data, setData] = useState<ReportEnvelope<TRow>>({ rows: [], summary: {}, meta: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const key = JSON.stringify(params);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetcher(JSON.parse(key)));
    } catch (caught: any) {
      setError(
        caught?.response?.status === 403
          ? 'You do not have permission to view this report.'
          : caught?.response?.data?.message || 'Could not load this report. Please try again.'
      );
      setData({ rows: [], summary: {}, meta: {} });
    } finally {
      setLoading(false);
    }
    // `fetcher` is a module-level function and stable; `key` is the real input.
  }, [key, fetcher]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...data, loading, error, reload: load };
}

export const inputClass =
  'rounded-md border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white';

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600 dark:text-gray-400">
      {label}
      {children}
    </label>
  );
}

export function DateRangeFilter({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  return (
    <>
      <Field label="From">
        <input type="date" value={from} onChange={(e) => onFrom(e.target.value)} className={inputClass} />
      </Field>
      <Field label="To">
        <input type="date" value={to} onChange={(e) => onTo(e.target.value)} className={inputClass} />
      </Field>
    </>
  );
}

/**
 * A day-count filter with presets AND a free number box.
 *
 * The presets cover what a pharmacist asks for most days; the box exists
 * because "60 days" and "45 days" are just as reasonable a question and a
 * dropdown that cannot express them forces the wrong report to be run twice.
 * Selecting a preset fills the box, and typing in the box deselects the preset,
 * so there is only ever one answer on screen.
 */
export function DaysWindowFilter({
  days,
  onChange,
  presets = [30, 60, 90, 180, 365],
  label = 'Window (days)',
}: {
  days: number;
  onChange: (days: number) => void;
  presets?: number[];
  label?: string;
}) {
  // Held separately from `days` so the box can be empty mid-typing without the
  // report immediately refetching for NaN days.
  const [draft, setDraft] = useState(String(days));

  useEffect(() => {
    setDraft(String(days));
  }, [days]);

  const commit = (raw: string) => {
    const parsed = Number(raw);
    if (raw === '' || !Number.isFinite(parsed) || parsed < 1) {
      setDraft(String(days));
      return;
    }
    onChange(Math.min(Math.round(parsed), 3650));
  };

  return (
    <Field label={label}>
      <div className="flex items-center gap-1">
        <select
          value={presets.includes(days) ? String(days) : ''}
          onChange={(e) => e.target.value && onChange(Number(e.target.value))}
          className={inputClass}
        >
          <option value="">Custom</option>
          {presets.map((preset) => (
            <option key={preset} value={preset}>
              Next {preset} days
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={3650}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit((e.target as HTMLInputElement).value);
            }
          }}
          title="Type any number of days"
          className={`${inputClass} w-20`}
        />
      </div>
    </Field>
  );
}

/**
 * Doctor filter, sitting after the date range because the period is what makes
 * a report and the doctor is what makes it personal.
 *
 * Options carry their row count, which is not decoration: this hospital has
 * several doctor records with identical names, and "Habiba Habib Adil (10)"
 * versus "Habiba Habib Adil (2)" is the only thing on screen telling them apart.
 */
export function DoctorFilter({
  doctors,
  value,
  onChange,
  loading,
}: {
  doctors: Array<{ id: number; name: string; entries: number }>;
  value: number | undefined;
  onChange: (id: number | undefined) => void;
  loading?: boolean;
}) {
  return (
    <Field label="Doctor">
      <select
        value={value === undefined ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        disabled={loading}
        className={inputClass}
      >
        <option value="">All Doctors</option>
        {doctors.map((doctor) => (
          <option key={doctor.id} value={doctor.id}>
            {doctor.name} ({doctor.entries})
          </option>
        ))}
      </select>
    </Field>
  );
}
