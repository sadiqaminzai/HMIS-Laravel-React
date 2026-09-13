import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Trash2 } from 'lucide-react';

/** One study or service on a receipt, as the form holds it. */
export interface ReceiptLine {
  /** The catalogue entry billed, or '' for a free-text line. */
  catalogueId: string;
  /** Copied from the catalogue when added, so a later rename cannot alter the bill. */
  name: string;
  /** Kept as text so the input can be cleared while typing. */
  fee: string;
}

/** The fields every catalogue this editor serves has in common. */
export interface ReceiptCatalogueEntry {
  id: number;
  name: string;
  description?: string | null;
  price: number | string;
  is_active: boolean;
}

interface ReceiptLinesEditorProps {
  catalogue: ReceiptCatalogueEntry[];
  lines: ReceiptLine[];
  onChange: (lines: ReceiptLine[]) => void;
  /** Without it every fee is the catalogue price; the server enforces the same. */
  canSetFee: boolean;
  /** Singular noun for one line: "study", "service". */
  itemLabel: string;
  placeholder: string;
  emptyCatalogueMessage: string;
  freeTextPlaceholder: string;
  feePermissionName: string;
}

const money = (value: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

/** The second, grey line under a catalogue entry: its description and its price. */
const describe = (entry: ReceiptCatalogueEntry) =>
  [
    entry.description?.trim() || null,
    Number(entry.price || 0) > 0 ? `${money(Number(entry.price))} AFN` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

const plural = (noun: string, count: number) =>
  count === 1 ? noun : noun.endsWith('y') ? `${noun.slice(0, -1)}ies` : `${noun}s`;

/**
 * The studies or services on one receipt.
 *
 * A patient sent for two films used to need two receipts, because a receipt
 * could name only one study. This lists as many as the visit needs.
 *
 * The picker is a checklist rather than a "pick one, add it" box: each entry
 * shows whether it is already on the receipt, and clicking it again takes it
 * off. The one-at-a-time picker let the same study be added twice -- and billed
 * twice -- with nothing on screen to say so. The server refuses a repeated
 * entry as well.
 *
 * The fee on each line is the catalogue price and is read-only for anyone
 * without the desk's Set Fee right -- the server applies the same rule, so the
 * disabled input is a courtesy, not the control.
 */
export function ReceiptLinesEditor({
  catalogue,
  lines,
  onChange,
  canSetFee,
  itemLabel,
  placeholder,
  emptyCatalogueMessage,
  freeTextPlaceholder,
  feePermissionName,
}: ReceiptLinesEditorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const [freeText, setFreeText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(catalogue.map((entry) => [String(entry.id), entry])), [catalogue]);
  const pickable = useMemo(() => catalogue.filter((entry) => entry.is_active), [catalogue]);
  const selectedIds = useMemo(
    () => new Set(lines.map((line) => line.catalogueId).filter(Boolean)),
    [lines]
  );
  const total = lines.reduce((sum, line) => sum + Math.max(0, Number(line.fee || 0)), 0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return pickable;
    return pickable.filter((entry) =>
      entry.name.toLowerCase().includes(needle)
      || (entry.description ?? '').toLowerCase().includes(needle)
    );
  }, [pickable, query]);

  useEffect(() => {
    setHighlighted(0);
  }, [query, open]);

  // Clicking outside closes the list, as the other pickers on the form do.
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

  // Keep the highlighted row in view while arrowing through a long catalogue.
  useEffect(() => {
    if (!open) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-index="${highlighted}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, open]);

  /** On if it is off, off if it is on -- never a second copy. */
  const toggle = (entry: ReceiptCatalogueEntry) => {
    const id = String(entry.id);
    if (selectedIds.has(id)) {
      onChange(lines.filter((line) => line.catalogueId !== id));
    } else {
      onChange([...lines, { catalogueId: id, name: entry.name, fee: Number(entry.price || 0).toFixed(2) }]);
    }
  };

  const addFreeText = () => {
    const name = freeText.trim();
    if (!name) return;
    // Free-text lines have no id, so a repeat is caught by name instead.
    if (lines.some((line) => !line.catalogueId && line.name.trim().toLowerCase() === name.toLowerCase())) {
      setFreeText('');
      return;
    }
    onChange([...lines, { catalogueId: '', name, fee: '0.00' }]);
    setFreeText('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlighted((prev) => Math.min(prev + 1, Math.max(0, filtered.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((prev) => Math.max(prev - 1, 0));
    } else if (event.key === 'Enter') {
      // Only swallow Enter while the list is open, so it still submits otherwise.
      if (open && filtered[highlighted]) {
        event.preventDefault();
        toggle(filtered[highlighted]);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  const update = (index: number, fee: string) =>
    onChange(lines.map((line, i) => (i === index ? { ...line, fee } : line)));

  const remove = (index: number) => onChange(lines.filter((_, i) => i !== index));

  const inputClass =
    'w-full px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all';

  const summary = selectedIds.size > 0
    ? `${selectedIds.size} ${plural(itemLabel, selectedIds.size)} selected - search to add more`
    : placeholder;

  return (
    <div className="space-y-2">
      {pickable.length > 0 ? (
        <div ref={containerRef} className="relative">
          <input
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            autoComplete="off"
            value={query}
            placeholder={summary}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            className="w-full px-2 py-1.5 pr-8 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />

          {open && (
            <div
              ref={listRef}
              role="listbox"
              aria-multiselectable="true"
              className="absolute z-40 mt-1 w-full max-h-60 overflow-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg"
            >
              <div className="sticky top-0 flex items-center justify-between px-2 py-1 text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <span>Tick to add, untick to remove</span>
                <span className="tabular-nums">{selectedIds.size} / {pickable.length} selected</span>
              </div>
              {filtered.map((entry, index) => {
                const checked = selectedIds.has(String(entry.id));
                const meta = describe(entry);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    role="option"
                    aria-selected={checked}
                    data-index={index}
                    onMouseEnter={() => setHighlighted(index)}
                    onMouseDown={(event) => {
                      // mousedown, not click: the input's blur would close the list first.
                      event.preventDefault();
                      toggle(entry);
                    }}
                    className={`w-full flex items-start gap-2 text-left px-2 py-1.5 text-xs ${
                      index === highlighted
                        ? 'bg-blue-50 dark:bg-blue-900/30'
                        : checked
                          ? 'bg-blue-50/50 dark:bg-blue-900/10'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                        checked
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-700'
                      }`}
                    >
                      {checked && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-gray-900 dark:text-white ${checked ? 'font-semibold' : ''}`}>
                        {entry.name}
                      </span>
                      {meta && (
                        <span className="block truncate text-[10px] text-gray-500 dark:text-gray-400">{meta}</span>
                      )}
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-2 py-2 text-xs text-gray-500">No {itemLabel} matches</div>
              )}
            </div>
          )}
        </div>
      ) : (
        // An empty catalogue keeps the desk working: type the name instead.
        <div className="flex gap-2">
          <input
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addFreeText();
              }
            }}
            placeholder={freeTextPlaceholder}
            className={inputClass}
          />
          <button
            type="button"
            onClick={addFreeText}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      )}
      {pickable.length === 0 && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400">{emptyCatalogueMessage}</p>
      )}

      <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        {lines.length === 0 ? (
          <p className="px-3 py-3 text-xs text-center text-gray-500 dark:text-gray-400">
            No {itemLabel} added yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {lines.map((line, index) => {
              const entry = line.catalogueId ? byId.get(line.catalogueId) : undefined;
              return (
                <li key={`${line.catalogueId || line.name}-${index}`} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="w-5 text-[10px] text-gray-400 tabular-nums">{index + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
                      {line.name}
                      {entry && !entry.is_active && (
                        <span className="ml-1 text-[10px] font-normal text-amber-600">(inactive)</span>
                      )}
                    </div>
                    {entry?.description?.trim() && (
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{entry.description}</div>
                    )}
                  </div>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.fee}
                    onChange={(e) => update(index, e.target.value)}
                    onBlur={() => update(index, line.fee === '' ? '0.00' : Number(line.fee || 0).toFixed(2))}
                    disabled={!canSetFee}
                    title={canSetFee ? undefined : `The catalogue price applies; changing it requires the ${feePermissionName} permission`}
                    aria-label={`Fee for ${line.name}`}
                    className="w-24 px-2 py-1 text-xs text-right tabular-nums rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title={`Remove this ${itemLabel}`}
                    aria-label={`Remove ${line.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {lines.length > 0 && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700 text-xs">
            <span className="text-gray-600 dark:text-gray-400">
              {lines.length} {plural(itemLabel, lines.length)}
            </span>
            <span className="font-semibold text-gray-900 dark:text-white tabular-nums">{money(total)}</span>
          </div>
        )}
      </div>
      {!canSetFee && lines.length > 0 && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400">Fees are the catalogue price.</p>
      )}
    </div>
  );
}
