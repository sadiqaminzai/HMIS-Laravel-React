import React from 'react';
import { X, Printer } from 'lucide-react';

/**
 * Shared modal chrome matching the Patient module, so every master-data screen
 * (medicines, suppliers, manufacturers, types) looks the same.
 */

interface ModalOverlayProps {
  open: boolean;
  children: React.ReactNode;
}

export function ModalOverlay({ open, children }: ModalOverlayProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
      {children}
    </div>
  );
}

interface ModalPanelProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  scroll?: boolean;
  className?: string;
  children: React.ReactNode;
}

const SIZES: Record<NonNullable<ModalPanelProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
};

export function ModalPanel({ size = 'lg', scroll = false, className = '', children }: ModalPanelProps) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full ${SIZES[size]} border border-gray-200 dark:border-gray-700 flex flex-col ${
        scroll ? 'max-h-[90vh] overflow-y-auto' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** Plain header used by Add/Edit forms. */
export function FormModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
      <h2 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Coloured header with icon used by read-only Details modals. */
export function DetailModalHeader({
  title,
  icon,
  gradient = 'from-blue-600 to-blue-700',
  onPrint,
  onClose,
}: {
  title: string;
  icon: React.ReactNode;
  gradient?: string;
  onPrint?: () => void;
  onClose: () => void;
}) {
  return (
    <div className={`sticky top-0 bg-gradient-to-r ${gradient} px-6 py-3 flex items-center justify-between rounded-t-lg shadow-md z-10 print:hidden`}>
      <h2 className="text-base font-bold text-white flex items-center gap-2">
        {icon}
        {title}
      </h2>
      <div className="flex items-center gap-2">
        {onPrint && (
          <button
            type="button"
            onClick={onPrint}
            title="Print"
            aria-label="Print"
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <Printer className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          title="Close"
          aria-label="Close"
          className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/** Label/value row used inside Details modals. */
export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-100 dark:border-gray-700/60 last:border-0">
      <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-xs font-semibold text-gray-900 dark:text-white text-right">{value ?? '—'}</span>
    </div>
  );
}
