import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

export interface SearchableOption {
  value: string;
  /** Shown in the field once chosen and matched against while typing. */
  label: string;
  /** Optional second line, e.g. a patient ID or phone number. Also searched. */
  meta?: string;
}

interface SearchableSelectProps {
  id?: string;
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  title?: string;
  className?: string;
  emptyMessage?: string;
}

/**
 * A type-to-filter replacement for a plain <select>.
 *
 * A native select is unusable once a hospital has thousands of patients: there
 * is no way to search it, only scroll. This keeps the same value/onChange
 * contract so it drops into existing forms, and supports keyboard entry
 * (arrows, Enter, Escape) because reception staff work faster without a mouse.
 */
export function SearchableSelect({
  id,
  value,
  options,
  onChange,
  placeholder = 'Search...',
  disabled = false,
  required = false,
  title,
  className = '',
  emptyMessage = 'No matches found',
}: SearchableSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(needle) ||
      (option.meta ?? '').toLowerCase().includes(needle)
    );
  }, [options, query]);

  // Clicking outside cancels the search rather than leaving a stale query in
  // the box that no longer reflects what is actually selected.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    setHighlighted(0);
  }, [query, open]);

  const commit = (option: SearchableOption) => {
    onChange(option.value);
    setQuery('');
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlighted((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((prev) => Math.max(prev - 1, 0));
    } else if (event.key === 'Enter') {
      // Only swallow Enter while choosing, so it still submits the form otherwise.
      if (open && filtered[highlighted]) {
        event.preventDefault();
        commit(filtered[highlighted]);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  const displayValue = open ? query : (selected?.label ?? '');

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        id={id}
        ref={inputRef}
        type="text"
        title={title}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        placeholder={selected && !open ? selected.label : placeholder}
        value={displayValue}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className="w-full px-2 py-1.5 pr-12 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      />

      {/* Mirrors the value for native form validation, since the visible input
          intentionally holds the search text rather than the chosen id. */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value}
          onChange={() => {}}
          className="absolute left-2 bottom-0 h-0 w-0 opacity-0 pointer-events-none"
        />
      )}

      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        {selected && !disabled && (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => {
              onChange('');
              setQuery('');
              inputRef.current?.focus();
            }}
            className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 pointer-events-none" />
      </div>

      {open && !disabled && (
        <div className="absolute z-40 mt-1 w-full max-h-52 overflow-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
          {filtered.map((option, index) => (
            <button
              key={option.value}
              type="button"
              onMouseEnter={() => setHighlighted(index)}
              onMouseDown={(event) => {
                // mousedown, not click: the input's blur would close the list first.
                event.preventDefault();
                commit(option);
              }}
              className={`w-full text-left px-2 py-1.5 text-xs ${
                index === highlighted
                  ? 'bg-blue-50 dark:bg-blue-900/30'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              } ${option.value === value ? 'font-semibold' : ''}`}
            >
              <div className="text-gray-900 dark:text-white truncate">{option.label}</div>
              {option.meta && (
                <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{option.meta}</div>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-2 py-2 text-xs text-gray-500">{emptyMessage}</div>
          )}
        </div>
      )}
    </div>
  );
}
