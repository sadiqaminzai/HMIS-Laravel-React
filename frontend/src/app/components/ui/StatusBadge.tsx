import React from 'react';

/**
 * One badge for every status in the application.
 *
 * "paid", "pending", "completed", "sample_collected", "active", "rejected" were
 * each being styled wherever they happened to be rendered, so the same word
 * looked different on two screens and an unfamiliar status fell back to plain
 * grey text with an underscore still in it. Statuses are matched by meaning
 * here, once.
 */

type Tone = 'good' | 'warn' | 'bad' | 'info' | 'neutral';

const TONE_CLASS: Record<Tone, string> = {
  good: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  warn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  bad: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  neutral: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

/**
 * Status -> tone, by what the word MEANS rather than which module wrote it.
 *
 * Keys are compared lowercased with spaces and hyphens folded to underscores,
 * so "Sample Collected", "sample-collected" and "sample_collected" are one
 * entry rather than three.
 */
const TONE_BY_STATUS: Record<string, Tone> = {
  // settled / finished
  paid: 'good',
  completed: 'good',
  approved: 'good',
  active: 'good',
  delivered: 'good',
  verified: 'good',
  discharged: 'good',
  closed: 'good',
  collected: 'good',

  // in flight
  pending: 'warn',
  partial: 'warn',
  partially_paid: 'warn',
  processing: 'warn',
  in_progress: 'warn',
  sample_collected: 'warn',
  scheduled: 'warn',
  admitted: 'warn',
  draft: 'warn',
  unpaid: 'warn',
  due: 'warn',

  // gone wrong
  rejected: 'bad',
  cancelled: 'bad',
  canceled: 'bad',
  failed: 'bad',
  overdue: 'bad',
  expired: 'bad',
  voided: 'bad',
  refunded: 'bad',

  // informational
  booked: 'info',
  confirmed: 'info',
  reserved: 'info',
  new: 'info',

  inactive: 'neutral',
};

const normalise = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, '_');

/** "sample_collected" -> "Sample Collected". */
export const humaniseStatus = (value: string) =>
  String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

export function statusTone(status: string | null | undefined): Tone {
  if (!status) return 'neutral';
  return TONE_BY_STATUS[normalise(String(status))] ?? 'neutral';
}

interface StatusBadgeProps {
  status: string | null | undefined;
  /** Overrides the looked-up tone when the caller knows better. */
  tone?: Tone;
  /** Shown instead of the humanised status, e.g. an amount. */
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({ status, tone, label, size = 'sm', className = '' }: StatusBadgeProps) {
  if (!status && !label) {
    return <span className="text-gray-400">—</span>;
  }

  const resolved = tone ?? statusTone(status);
  const padding = size === 'md' ? 'px-2.5 py-1 text-[11px]' : 'px-2 py-0.5 text-[10px]';

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full font-semibold capitalize ${padding} ${TONE_CLASS[resolved]} ${className}`}
    >
      {label ?? humaniseStatus(String(status))}
    </span>
  );
}

export default StatusBadge;
