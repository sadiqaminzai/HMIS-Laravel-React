import React, { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, Search, Loader2, AlertTriangle } from 'lucide-react';
import { formatMoneyIn, formatNumberIn } from '../../utils/money';
import { TABLE_HEAD_CLASS, Th, TR_CLASS } from '../ui/DataTable';

/**
 * One table, six reports.
 *
 * Every pharmacy report answers with { rows, summary, meta }, so the searching,
 * sorting, paging, totalling and exporting belong here once rather than being
 * copied into each tab. A tab supplies its columns, its filter controls and its
 * rows; everything below the filter bar is this component's job.
 */

export type ColumnKind = 'text' | 'number' | 'currency' | 'date' | 'percent';

export interface ReportColumn<TRow> {
  key: string;
  label: string;
  kind?: ColumnKind;
  /** Sum this column into the totals row. Only meaningful for number/currency. */
  total?: boolean;
  /** Custom cell. The exports use `value` instead, never this. */
  render?: (row: TRow) => React.ReactNode;
  /**
   * The raw value used for sorting, searching and exporting. Defaults to
   * row[key]. Define it whenever `render` shows something other than the
   * underlying field, or the Excel file will disagree with the screen.
   */
  value?: (row: TRow) => string | number | null | undefined;
}

export interface ReportSummaryItem {
  label: string;
  value: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}

interface ReportTableProps<TRow> {
  title: string;
  hospitalName: string;
  /** "1 Sep 2026 - 11 Sep 2026", or "As at 11 Sep 2026" for a stock snapshot. */
  periodLabel: string;
  columns: ReportColumn<TRow>[];
  rows: TRow[];
  summary?: ReportSummaryItem[];
  loading?: boolean;
  error?: string | null;
  /** Filter controls for this particular report, rendered above the table. */
  filters?: React.ReactNode;
  /** Extra class on a row, e.g. to tint expired batches red. */
  rowClassName?: (row: TRow) => string;
  emptyMessage?: string;
  currency?: string;
  language?: string;
}

const TONE_CLASSES: Record<string, string> = {
  default: 'text-gray-900 dark:text-white',
  good: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-red-600 dark:text-red-400',
};

const PAGE_SIZES = [25, 50, 100, 250];

export function ReportTable<TRow extends Record<string, any>>({
  title,
  hospitalName,
  periodLabel,
  columns,
  rows,
  summary = [],
  loading = false,
  error = null,
  filters,
  rowClassName,
  emptyMessage = 'No rows matched this report.',
  currency = 'AFN',
  language = 'en',
}: ReportTableProps<TRow>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  // A filter change can shrink the result below the current page, which would
  // otherwise leave the user staring at an empty table on page 7 of 3.
  useEffect(() => {
    setPage(1);
  }, [rows, search, pageSize]);

  const rawValue = (row: TRow, column: ReportColumn<TRow>) =>
    column.value ? column.value(row) : row[column.key];

  const isNumeric = (column: ReportColumn<TRow>) =>
    column.kind === 'number' || column.kind === 'currency' || column.kind === 'percent';

  const formatValue = (value: any, column: ReportColumn<TRow>, forExport = false): string => {
    if (value === null || value === undefined || value === '') return forExport ? '' : '-';

    switch (column.kind) {
      case 'currency':
        return forExport
          ? String(Number(value).toFixed(2))
          : formatMoneyIn(Number(value) || 0, currency, language);
      case 'number':
        return forExport ? String(value) : formatNumberIn(Number(value) || 0, language, 0);
      case 'percent':
        return `${formatNumberIn(Number(value) || 0, language, 2)}%`;
      default:
        return String(value);
    }
  };

  const searched = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((row) =>
      columns.some((column) => String(rawValue(row, column) ?? '').toLowerCase().includes(term))
    );
  }, [rows, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return searched;
    const column = columns.find((c) => c.key === sortKey);
    if (!column) return searched;

    // Copied before sorting: Array.prototype.sort mutates, and `rows` is the
    // parent's state.
    return [...searched].sort((a, b) => {
      const left = rawValue(a, column);
      const right = rawValue(b, column);

      // Nulls sort last in both directions -- a blank expiry date is not
      // "earliest", it is unknown, and floating it to the top of an expiry
      // report would bury the batch that actually expires next.
      if (left === null || left === undefined) return 1;
      if (right === null || right === undefined) return -1;

      const comparison = isNumeric(column)
        ? (Number(left) || 0) - (Number(right) || 0)
        : String(left).localeCompare(String(right), undefined, { numeric: true });

      return sortDir === 'asc' ? comparison : -comparison;
    });
  }, [searched, sortKey, sortDir, columns]);

  const totals = useMemo(() => {
    const result: Record<string, number> = {};
    columns.filter((c) => c.total).forEach((column) => {
      // Totals cover every row the filters left, not just the page on screen:
      // a "total" that changes when you turn the page is a bug report waiting
      // to happen.
      result[column.key] = sorted.reduce((sum, row) => sum + (Number(rawValue(row, column)) || 0), 0);
    });
    return result;
  }, [sorted, columns]);

  const hasTotals = columns.some((c) => c.total);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visible = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const fileBaseName = () =>
    `${title}_${hospitalName}_${new Date().toISOString().slice(0, 10)}`
      .replace(/[^a-z0-9_-]+/gi, '_')
      .toLowerCase();

  /** Exports cover every filtered row, never just the visible page. */
  const exportRows = () =>
    sorted.map((row, index) => {
      const record: Record<string, string> = { 'S/N': String(index + 1) };
      columns.forEach((column) => {
        record[column.label] = formatValue(rawValue(row, column), column, true);
      });
      return record;
    });

  const exportToExcel = async () => {
    const XLSX = await import('xlsx');

    const data = exportRows();
    if (hasTotals) {
      const totalsRow: Record<string, string> = { 'S/N': 'Totals' };
      columns.forEach((column) => {
        totalsRow[column.label] = column.total ? formatValue(totals[column.key], column, true) : '';
      });
      data.push(totalsRow);
    }

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(data), 'Report');
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet([
        { Field: 'Report', Value: title },
        { Field: 'Hospital', Value: hospitalName },
        { Field: 'Period', Value: periodLabel },
        { Field: 'Rows', Value: String(sorted.length) },
        ...summary.map((item) => ({ Field: item.label, Value: item.value })),
      ]),
      'Summary'
    );

    XLSX.writeFile(book, `${fileBaseName()}.xlsx`);
  };

  const exportToPdf = async () => {
    const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const autoTable = autoTableModule.default;

    // Landscape: these reports run to eight or nine columns, and portrait
    // squeezes a product name down to an unreadable stub.
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(15);
    doc.text(title, 14, 16);
    doc.setFontSize(9);
    doc.text(`Hospital: ${hospitalName}`, 14, 22);
    doc.text(periodLabel, 14, 27);
    if (summary.length) {
      doc.text(summary.map((item) => `${item.label}: ${item.value}`).join('    '), 14, 32);
    }

    autoTable(doc, {
      startY: summary.length ? 36 : 31,
      head: [['S/N', ...columns.map((c) => c.label)]],
      body: sorted.map((row, index) => [
        String(index + 1),
        ...columns.map((column) => formatValue(rawValue(row, column), column, true)),
      ]),
      foot: hasTotals
        ? [['Totals', ...columns.map((c) => (c.total ? formatValue(totals[c.key], c, true) : ''))]]
        : undefined,
      styles: { fontSize: 7.5, cellPadding: 1.8 },
      headStyles: { fillColor: [37, 99, 235] },
      footStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
      didDrawPage: () => {
        doc.setFontSize(8);
        doc.text(
          `Page ${doc.getCurrentPageInfo().pageNumber} of ${doc.getNumberOfPages()}`,
          doc.internal.pageSize.width - 35,
          doc.internal.pageSize.height - 8
        );
      },
    });

    doc.save(`${fileBaseName()}.pdf`);
  };

  return (
    <div className="space-y-3">
      {/* Filters + exports */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-end gap-3">{filters}</div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search rows..."
              className="w-48 rounded-md border border-gray-300 py-1.5 pl-8 pr-2 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={exportToExcel}
            disabled={!sorted.length}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </button>
          <button
            type="button"
            onClick={exportToPdf}
            disabled={!sorted.length}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
          >
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Headline figures */}
      {summary.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {summary.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {item.label}
              </div>
              <div className={`mt-0.5 text-sm font-semibold ${TONE_CLASSES[item.tone ?? 'default']}`}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className={TABLE_HEAD_CLASS}>
              <tr>
                <Th>#</Th>
                {columns.map((column) => (
                  <Th
                    key={column.key}
                    onSort={() => toggleSort(column.key)}
                    active={sortKey === column.key}
                    direction={sortDir}
                    align={isNumeric(column) ? 'right' : 'left'}
                  >
                    {column.label}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-3 py-10 text-center text-gray-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}

              {!loading && visible.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="px-3 py-10 text-center text-gray-500 dark:text-gray-400"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )}

              {!loading &&
                visible.map((row, index) => (
                  <tr
                    key={`${(safePage - 1) * pageSize + index}`}
                    className={`${TR_CLASS} ${rowClassName?.(row) ?? ''}`}
                  >
                    <td className="px-4 py-2 text-xs text-gray-400">{(safePage - 1) * pageSize + index + 1}</td>
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-4 py-2 text-xs text-gray-800 dark:text-gray-200 ${
                          isNumeric(column) ? 'text-right tabular-nums' : 'text-left'
                        }`}
                      >
                        {column.render
                          ? column.render(row)
                          : formatValue(rawValue(row, column), column)}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>

            {hasTotals && !loading && sorted.length > 0 && (
              <tfoot className="bg-gray-900 text-white">
                <tr>
                  <td className="px-3 py-2 font-semibold">Totals</td>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-3 py-2 font-semibold ${
                        isNumeric(column) ? 'text-right tabular-nums' : 'text-left'
                      }`}
                    >
                      {column.total ? formatValue(totals[column.key], column) : ''}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-400">
          <div>
            {sorted.length > 0
              ? `Showing ${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, sorted.length)} of ${sorted.length}`
              : '0 rows'}
            {search && rows.length !== sorted.length && ` (filtered from ${rows.length})`}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="rounded border border-gray-300 px-1.5 py-1 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage <= 1}
              className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40 dark:border-gray-600"
            >
              Prev
            </button>
            <span>
              {safePage} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={safePage >= pageCount}
              className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40 dark:border-gray-600"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
