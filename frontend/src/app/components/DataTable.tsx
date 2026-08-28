import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Pencil, Search, Trash2 } from 'lucide-react';

/**
 * The shared look of every listing table in ShifaaScript.
 *
 * Doctor Management is the reference design, but its markup lived inline in
 * that one file, so every other module grew its own near-copy: a lighter head,
 * no sticky row, no sort arrows, a different footer, and action buttons two
 * pixels bigger. Nothing was wrong with any of them individually; together the
 * application looked like five products.
 *
 * The chrome lives here now -- card, scroll frame, sticky head, sort arrows,
 * empty state, footer, action buttons and status pills -- while each module
 * keeps writing its own `<tr>`s. A column-config abstraction was deliberately
 * avoided: these tables render badges, two-line cells, struck-through prices
 * and inline switches, and a config format wide enough to express all of that
 * is harder to read than the JSX it replaces.
 */

export type SortDirection = 'asc' | 'desc';

export interface TableSort<T> {
  field: string;
  direction: SortDirection;
  toggle: (field: string) => void;
  rows: T[];
}

/**
 * Sorting state plus the sorted rows.
 *
 * Values are compared by type rather than always as strings: sorting a fee
 * column as text puts 100 before 90, and a date column ends up in alphabetical
 * order of its formatting. Nulls sort last in either direction, so empty cells
 * do not push real data off the first page.
 */
export function useTableSort<T extends Record<string, any>>(
  rows: T[],
  initialField: string,
  initialDirection: SortDirection = 'asc'
): TableSort<T> {
  const [field, setField] = useState<string>(initialField);
  const [direction, setDirection] = useState<SortDirection>(initialDirection);

  const toggle = (next: string) => {
    if (next === field) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setField(next);
    setDirection('asc');
  };

  const sorted = useMemo(() => {
    const factor = direction === 'asc' ? 1 : -1;

    return [...rows].sort((a, b) => {
      const av = a?.[field];
      const bv = b?.[field];

      const aEmpty = av === null || av === undefined || av === '';
      const bEmpty = bv === null || bv === undefined || bv === '';
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;
      if (bEmpty) return -1;

      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
      if (typeof av === 'boolean' && typeof bv === 'boolean') {
        return (Number(av) - Number(bv)) * factor;
      }
      if (av instanceof Date && bv instanceof Date) {
        return (av.getTime() - bv.getTime()) * factor;
      }

      // Numeric strings are common here -- costs and fees arrive as "1200.00"
      // from the API -- so they are compared as numbers rather than text.
      const an = Number(av);
      const bn = Number(bv);
      if (!Number.isNaN(an) && !Number.isNaN(bn) && String(av).trim() !== '' && String(bv).trim() !== '') {
        return (an - bn) * factor;
      }

      return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * factor;
    });
  }, [rows, field, direction]);

  return { field, direction, toggle, rows: sorted };
}

/** Slice helper, so each page does not re-derive the same three lines. */
export function usePagination<T>(rows: T[], perPage = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));

  // Deleting the last row on the last page would otherwise strand the user on
  // an empty page with no way back except paging.
  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageRows = useMemo(
    () => rows.slice((page - 1) * perPage, (page - 1) * perPage + perPage),
    [rows, page, perPage]
  );

  return { page, setPage, totalPages, pageRows };
}

interface ThProps {
  children?: React.ReactNode;
  /** Supply both to make the column sortable. */
  sort?: TableSort<any>;
  field?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export function Th({ children, sort, field, align = 'left', className = '' }: ThProps) {
  const alignment = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : '';
  const base = `px-4 py-2.5 text-xs font-semibold uppercase tracking-wider ${alignment} ${className}`;

  if (!sort || !field) {
    return <th className={base}>{children}</th>;
  }

  const icon =
    sort.field !== field ? (
      <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-50" />
    ) : sort.direction === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-blue-600 dark:text-blue-400" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-600 dark:text-blue-400" />
    );

  const justify =
    align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : '';

  return (
    <th
      onClick={() => sort.toggle(field)}
      className={`${base} cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
    >
      <div className={`flex items-center gap-1.5 ${justify}`}>
        {children}
        {icon}
      </div>
    </th>
  );
}

export function DataTableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
      <tr>{children}</tr>
    </thead>
  );
}

export function DataTableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{children}</tbody>;
}

/** Standard row, so hover and the group-hover hooks behave the same everywhere. */
export function Tr({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <tr className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group ${className}`}>
      {children}
    </tr>
  );
}

export function TableEmpty({
  colSpan,
  message,
  hint,
  icon,
}: {
  colSpan: number;
  message: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
        <div className="flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
            {icon ?? <Search className="w-6 h-6 text-gray-400" />}
          </div>
          <p className="text-sm font-medium">{message}</p>
          <p className="text-xs mt-1">{hint ?? t('ui.tryAdjustingYourSearchTerms')}</p>
        </div>
      </td>
    </tr>
  );
}

export function TableLoading({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
        Loading...
      </td>
    </tr>
  );
}

interface DataTableCardProps {
  children: React.ReactNode;
  /** Rows before pagination; shown as the record count. */
  total: number;
  shown: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Word used in the footer, e.g. "rooms". Falls back to "records". */
  noun?: string;
  /**
   * How much vertical room the frame leaves for everything above it. Pages with
   * a tab strip above the table need a little more than pages without one.
   */
  maxHeight?: string;
}

/**
 * Card, scroll frame and footer.
 *
 * The body scrolls rather than the page so the header row stays visible on a
 * long list -- a technician looking at row 90 should not have to remember what
 * column four was.
 */
export function DataTableCard({
  children,
  total,
  shown,
  page,
  totalPages,
  onPageChange,
  noun,
  maxHeight = 'calc(100vh - 220px)',
}: DataTableCardProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
      <div className="overflow-x-auto rounded-t-lg" style={{ maxHeight, overflowY: 'auto' }}>
        <table className="w-full text-left border-collapse relative">{children}</table>
      </div>

      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 rounded-b-lg flex flex-wrap gap-2 justify-between items-center text-xs text-gray-600 dark:text-gray-400">
        <span>
          Total {noun ? noun.charAt(0).toUpperCase() + noun.slice(1) : 'Records'}:{' '}
          <span className="font-semibold text-gray-900 dark:text-white">{total}</span>
        </span>
        <div className="flex items-center gap-3">
          <span>
            Showing {shown} of {total}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
          >
            {t('ui.prev')}
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
          >
            {t('ui.next')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TableActions({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center gap-1.5">{children}</div>;
}

type ActionTone = 'view' | 'edit' | 'delete' | 'primary' | 'success' | 'warning';

const ACTION_TONES: Record<ActionTone, string> = {
  view: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700',
  edit: 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30',
  delete: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30',
  primary: 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30',
  success: 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30',
  warning: 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30',
};

export function TableAction({
  tone,
  title,
  onClick,
  disabled,
  children,
}: {
  tone: ActionTone;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${ACTION_TONES[tone]}`}
    >
      {children}
    </button>
  );
}

/** The three actions nearly every row has, at the reference size. */
export const ViewIcon = () => <Eye className="w-3.5 h-3.5" />;
export const EditIcon = () => <Pencil className="w-3.5 h-3.5" />;
export const DeleteIcon = () => <Trash2 className="w-3.5 h-3.5" />;

type PillTone = 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'gray';

const PILL_TONES: Record<PillTone, string> = {
  green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800',
  purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-800',
  gray: 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800',
};

export function TablePill({
  tone,
  children,
  title,
  className = '',
}: {
  tone: PillTone;
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${PILL_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Active / inactive, spelled the same way on every screen. */
export function ActivePill({ active }: { active: boolean }) {
  const { t } = useTranslation();
  return <TablePill tone={active ? 'green' : 'red'}>{active ? t('ui.active') : t('ui.inactive')}</TablePill>;
}

/** Square leading cell icon, as the doctor rows use for the avatar. */
export function RowIcon({
  children,
  tone = 'blue',
}: {
  children: React.ReactNode;
  tone?: 'blue' | 'purple' | 'emerald' | 'amber';
}) {
  const tones = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400',
  };

  return (
    <div
      className={`w-8 h-8 rounded-md flex items-center justify-center overflow-hidden flex-shrink-0 border ${tones[tone]}`}
    >
      {children}
    </div>
  );
}

/** Two-line cell: a bold primary line over muted supporting detail. */
export function CellStack({ primary, secondary }: { primary: React.ReactNode; secondary?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="font-semibold text-gray-900 dark:text-white text-xs truncate">{primary}</div>
      {secondary !== undefined && secondary !== null && secondary !== '' && (
        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{secondary}</div>
      )}
    </div>
  );
}

/** Ordinary muted cell text, at the reference size. */
export function CellText({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <span className={`text-[10px] text-gray-600 dark:text-gray-400 ${mono ? 'font-mono' : ''}`}>{children}</span>
  );
}

/** Emphasised figure, for money and counts. */
export function CellNumber({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'money' | 'muted' }) {
  const tones = {
    default: 'text-gray-900 dark:text-gray-300',
    money: 'text-green-600 dark:text-green-400',
    muted: 'text-gray-500 dark:text-gray-400',
  };
  return <span className={`text-[10px] font-medium ${tones[tone]}`}>{children}</span>;
}
