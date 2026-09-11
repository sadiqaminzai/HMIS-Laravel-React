import React from 'react';
import { Loader2, Save, X } from 'lucide-react';

/**
 * The controls every Add/Edit dialog shares.
 *
 * Buttons used to be labelled after the thing being created -- "Add Category",
 * "Add Expense", "Create", "Update" -- so the same action wore a different word
 * on every screen and the eye had to read the label to find the save. They are
 * "Save" and "Cancel" now, with icons, and the dialog TITLE says what is being
 * saved. Switching between Add and Edit no longer moves the wording either.
 */

export function CancelButton({
  onClick,
  label = 'Cancel',
  disabled,
}: {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
    >
      <X className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

export function SaveButton({
  pending,
  label = 'Save',
  disabled,
  type = 'submit',
  onClick,
}: {
  pending?: boolean;
  label?: string;
  disabled?: boolean;
  type?: 'submit' | 'button';
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || pending}
      className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      {pending ? 'Saving…' : label}
    </button>
  );
}

/** Cancel on the left, Save on the right, above a divider. Always this order. */
export function ModalFooter({
  onCancel,
  pending,
  saveLabel,
  saveDisabled,
}: {
  onCancel: () => void;
  pending?: boolean;
  saveLabel?: string;
  saveDisabled?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
      <CancelButton onClick={onCancel} disabled={pending} />
      <SaveButton pending={pending} label={saveLabel} disabled={saveDisabled} />
    </div>
  );
}

/**
 * Active / inactive as a switch rather than a two-option dropdown.
 *
 * A select with exactly two values costs a click to open, a click to choose,
 * and gives no indication of state until it is read. A switch shows the state
 * and changes it in one press, which is what a boolean deserves.
 */
export function StatusToggle({
  value,
  onChange,
  activeLabel = 'Active',
  inactiveLabel = 'Inactive',
  hint,
  disabled,
}: {
  value: 'active' | 'inactive';
  onChange: (value: 'active' | 'inactive') => void;
  activeLabel?: string;
  inactiveLabel?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const on = value === 'active';

  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={() => onChange(on ? 'inactive' : 'active')}
        className="inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            on ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
              on ? 'translate-x-[1.125rem]' : 'translate-x-[0.1875rem]'
            }`}
          />
        </span>
        <span
          className={`text-xs font-medium ${
            on ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {on ? activeLabel : inactiveLabel}
        </span>
      </button>
      {hint && <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

/**
 * Created / updated / approved, shown at the foot of a details dialog.
 *
 * Rows with nothing recorded are dropped rather than printed as dashes: a
 * record that was never approved should not show an empty "Approved by" line
 * inviting the reader to wonder who it was.
 */
export function AuditTrail({
  entries,
}: {
  entries: Array<{ label: string; who?: string | null; when?: string | Date | null }>;
}) {
  const shown = entries.filter((entry) => entry.who || entry.when);

  if (shown.length === 0) return null;

  const formatWhen = (when: string | Date | null | undefined) => {
    if (!when) return null;
    const date = when instanceof Date ? when : new Date(when);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
  };

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Record history
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {shown.map((entry) => (
          <div key={entry.label} className="flex items-baseline justify-between gap-2 text-[11px]">
            <dt className="text-gray-500 dark:text-gray-400">{entry.label}</dt>
            <dd className="text-right text-gray-800 dark:text-gray-200">
              {entry.who || '—'}
              {formatWhen(entry.when) && (
                <span className="ml-1 text-gray-400">· {formatWhen(entry.when)}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
