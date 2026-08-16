import React from 'react';
import { Plus } from 'lucide-react';

interface AddButtonProps {
  onClick: () => void;
  /** Tooltip and accessible name, e.g. "Add ultrasound receipt". */
  label: string;
  className?: string;
}

/**
 * The single "add" affordance.
 *
 * Every screen used to spell out its own wording -- "New Ultrasound Receipt",
 * "Add Ultrasound", "Add New Patient" -- so the same action looked different
 * everywhere and the toolbar grew with the length of the noun. A circled plus
 * with a short, constant label keeps the button one size on every screen; what
 * is being added is already obvious from the page you are on, and the full
 * wording lives in the tooltip for anyone who wants it.
 */
export function AddButton({ onClick, label, className = '' }: AddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`group flex items-center gap-1.5 pl-1 pr-3 py-1 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors text-xs font-medium shadow-sm ${className}`}
    >
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white/20 group-hover:bg-white/30 transition-colors">
        <Plus className="w-3.5 h-3.5" />
      </span>
      Add
    </button>
  );
}
