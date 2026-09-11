import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

/**
 * The house table header.
 *
 * Patient Management set the pattern -- uppercase, tracked, sticky, the whole
 * cell clickable with a sort arrow that shows direction -- and every other
 * table had drifted into its own smaller, lighter variant. This is that header,
 * extracted so the reports and the account registers stop inventing their own.
 */

export const TABLE_HEAD_CLASS =
  'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 sticky top-0 z-10 shadow-sm';

export function SortIcon({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-50" />;
  return direction === 'asc' ? (
    <ArrowUp className="w-3 h-3 text-blue-600 dark:text-blue-400" />
  ) : (
    <ArrowDown className="w-3 h-3 text-blue-600 dark:text-blue-400" />
  );
}

interface ThProps {
  children: React.ReactNode;
  /** Omit to render a plain, unsortable header cell. */
  onSort?: () => void;
  active?: boolean;
  direction?: 'asc' | 'desc';
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export function Th({
  children,
  onSort,
  active = false,
  direction = 'asc',
  align = 'left',
  className = '',
}: ThProps) {
  const alignment =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

  const base = `px-4 py-2.5 text-xs font-semibold uppercase tracking-wider ${
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  } ${className}`;

  if (!onSort) {
    return <th className={base}>{children}</th>;
  }

  return (
    <th
      onClick={onSort}
      className={`${base} cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-700`}
    >
      {/* The arrow lives inside the flex row rather than floated, so a long
          header wraps with its arrow instead of orphaning it. */}
      <div className={`flex items-center gap-1.5 ${alignment}`}>
        {children}
        <SortIcon active={active} direction={direction} />
      </div>
    </th>
  );
}

/** Row shell: zebra-free, but with the same hover the patient table uses. */
export const TR_CLASS = 'hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors';

/** Standard body cell padding, matched to the header above it. */
export const TD_CLASS = 'px-4 py-2 text-xs text-gray-800 dark:text-gray-200';
