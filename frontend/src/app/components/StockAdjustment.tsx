import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Hospital, UserRole } from '../types';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { SlidersHorizontal, RefreshCcw, Save, Search } from 'lucide-react';
import api from '../../api/axios';

interface StockAdjustmentProps {
  hospital: Hospital;
  userRole?: UserRole;
}

export function StockAdjustment({ hospital, userRole = 'admin' }: StockAdjustmentProps) {
  const { t } = useTranslation();
  const { selectedHospitalId, currentHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  const { hasPermission } = useAuth();
  
  const canReconcile = hasPermission('edit_stocks') || hasPermission('manage_stocks');
  
  /**
   * Has this batch actually been counted?
   *
   * Blank is not zero. A row nobody has reached yet must be excluded from the
   * payload entirely, because the endpoint writes whatever quantity it is given.
   */
  const isCounted = (row: any) =>
    (row.physical_qty !== null && row.physical_qty !== undefined && row.physical_qty !== '')
    || (row.physical_bonus !== null && row.physical_bonus !== undefined && row.physical_bonus !== '');

  const [reconcileDate, setReconcileDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  /** medicine::batch of the row currently being written, so only it spins. */
  const [savingRow, setSavingRow] = useState<string | null>(null);
  const [reconcileRows, setReconcileRows] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(false);

  const loadReconciliation = async () => {
    const hospitalId = isAllHospitals ? null : selectedHospitalId || currentHospital.id;
    if (!hospitalId) {
      toast.error('Please select a hospital for stock adjustment');
      return;
    }
    try {
      setLoading(true);
      const { data } = await api.get('/stock-reconciliation', {
        params: {
          date: reconcileDate,
          hospital_id: hospitalId,
        },
      });
      setReconcileRows(data.rows || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load stock adjustment records');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Correct one batch.
   *
   * The same endpoint as the bulk save, given a single item. Correcting one
   * product is the common case -- a breakage, a miscount noticed at the shelf --
   * and it should not require thinking about what else is on the sheet.
   */
  const saveRow = async (row: any) => {
    const hospitalId = isAllHospitals ? null : selectedHospitalId || currentHospital.id;
    if (!hospitalId) {
      toast.error('Please select a hospital for stock adjustment');
      return;
    }
    if (!isCounted(row)) {
      toast.error('Enter the physical quantity for this batch first.');
      return;
    }

    const qty = Number(row.physical_qty || 0);
    const bonus = Number(row.physical_bonus || 0);
    const variance = (qty + bonus) - Number(row.system_total || 0);

    const confirmed = window.confirm(
      `${row.medicine_name}${row.batch_no ? ` (batch ${row.batch_no})` : ''}

`
      + `System: ${row.system_total}   Counted: ${qty + bonus}
`
      + `Change: ${variance > 0 ? '+' : ''}${variance} pieces

`
      + 'Apply this correction?'
    );
    if (!confirmed) return;

    const key = `${row.medicine_id}::${row.batch_no || ''}`;
    setSavingRow(key);
    try {
      await api.post('/stock-reconciliation', {
        date: reconcileDate,
        hospital_id: hospitalId,
        items: [{
          medicine_id: row.medicine_id,
          batch_no: row.batch_no || null,
          physical_qty: qty,
          physical_bonus: bonus,
        }],
      });
      toast.success(`${row.medicine_name} corrected (${variance > 0 ? '+' : ''}${variance})`);
      await loadReconciliation();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to apply the correction');
    } finally {
      setSavingRow(null);
    }
  };

  const saveReconciliation = async () => {
    const hospitalId = isAllHospitals ? null : selectedHospitalId || currentHospital.id;
    if (!hospitalId) {
      toast.error('Please select a hospital for stock adjustment');
      return;
    }
    try {
      setLoading(true);
      // ONLY counted batches are sent.
      //
      // This used to post every row on screen, defaulting an untouched box to
      // 0 -- and the endpoint sets stock to whatever figure it receives. So
      // pressing Save after counting three products wrote every other batch in
      // the hospital down to zero. A blank box means "not counted", and an
      // uncounted batch must never be part of the payload.
      const items = reconcileRows
        .filter((row) => isCounted(row))
        .map((row) => ({
          medicine_id: row.medicine_id,
          batch_no: row.batch_no || null,
          physical_qty: Number(row.physical_qty || 0),
          physical_bonus: Number(row.physical_bonus || 0),
        }));

      if (items.length === 0) {
        toast.error('Nothing counted yet. Enter the physical quantity for at least one batch.');
        return;
      }

      const net = reconcileRows
        .filter((row) => isCounted(row))
        .reduce((sum, row) => sum
          + (Number(row.physical_qty || 0) + Number(row.physical_bonus || 0))
          - Number(row.system_total || 0), 0);

      const confirmed = window.confirm(
        `Apply the counted figures to ${items.length} batch(es)?

`
        + `Net change: ${net > 0 ? '+' : ''}${net} pieces.
`
        + 'Batches you did not count are left untouched.'
      );
      if (!confirmed) return;

      await api.post('/stock-reconciliation', {
        date: reconcileDate,
        hospital_id: hospitalId,
        items,
      });

      toast.success(`Stock adjustment saved for ${items.length} batch(es)`);
      await loadReconciliation();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save stock adjustment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
            Stock Adjustments
          </h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Adjust physical vs. system quantities for {isAllHospitals ? 'All Hospitals' : currentHospital.name}
          </p>
        </div>
        
        <div className="flex items-center justify-end gap-2">
          {userRole === 'super_admin' && (
            <div className="w-48">
              <HospitalSelector
                selectedId={selectedHospitalId}
                onChange={loadReconciliation}
              />
            </div>
          )}
          
          {/* Type-to-filter across the loaded sheet. A hospital carries hundreds
              of batches and a counter works from a shelf, not from row order. */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find medicine or batch..."
              aria-label="Find medicine or batch"
              className="w-56 pl-7 pr-2 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
            />
          </div>

          <input
            type="date"
            value={reconcileDate}
            onChange={(e) => setReconcileDate(e.target.value)}
            className="px-2 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
          />
          <button
            onClick={loadReconciliation}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <RefreshCcw className="w-3.5 h-3.5" />{t('ui.refresh')}</button>
          
          {canReconcile && (
            <button
              onClick={saveReconciliation}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              Save all counted ({reconcileRows.filter(isCounted).length})
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-gray-50/50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-gray-500 sticky top-0">
              <tr>
                <th className="px-4 py-3 font-medium">{t('table.medicine')}</th>
                <th className="px-4 py-3 font-medium">{t('table.batch')}</th>
                <th className="px-4 py-3 font-medium">{t('table.expiry')}</th>
                <th className="px-4 py-3 font-medium">{t('table.systemQty')}</th>
                <th className="px-4 py-3 font-medium">{t('table.systemBonus')}</th>
                <th className="px-4 py-3 font-medium">{t('table.systemTotal')}</th>
                <th className="px-4 py-3 font-medium bg-indigo-50/50 dark:bg-indigo-900/10">{t('table.physicalQty')}</th>
                <th className="px-4 py-3 font-medium bg-indigo-50/50 dark:bg-indigo-900/10">{t('table.physicalBonus')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('table.variance')}</th>
                {canReconcile && <th className="px-4 py-3 font-medium text-right w-20">{t('table.actions')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {reconcileRows.length === 0 ? (
                <tr>
                  <td colSpan={canReconcile ? 10 : 9} className="px-4 py-8 text-center text-gray-500">
                    <p>No adjustment records found.</p>
                    <p className="mt-1 opacity-70">Click Refresh to load system stock values for adjustment.</p>
                  </td>
                </tr>
              ) : (
                reconcileRows
                  .map((row, idx) => ({ row, idx }))
                  .filter(({ row }) => {
                    const term = search.trim().toLowerCase();
                    if (!term) return true;
                    return String(row.medicine_name ?? '').toLowerCase().includes(term)
                      || String(row.batch_no ?? '').toLowerCase().includes(term);
                  })
                  // idx is the row's position in the FULL list, so editing a
                  // filtered view still writes back to the correct batch.
                  .map(({ row, idx }) => {
                  // An uncounted row has no variance to show -- it is not a
                  // shortfall of everything on the shelf, it is simply unknown.
                  const counted = isCounted(row);
                  const physicalTotal = Number(row.physical_qty || 0) + Number(row.physical_bonus || 0);
                  const variance = counted ? physicalTotal - Number(row.system_total || 0) : null;
                  
                  return (
                    <tr key={`${row.medicine_id}-${row.batch_no || 'n/a'}-${idx}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-2 font-medium">{row.medicine_name}</td>
                      <td className="px-4 py-2 text-gray-500">{row.batch_no || '—'}</td>
                      <td className="px-4 py-2 text-gray-500">{row.expiry_date || '—'}</td>
                      <td className="px-4 py-2">{row.system_qty}</td>
                      <td className="px-4 py-2">{row.system_bonus}</td>
                      <td className="px-4 py-2 font-medium">{row.system_total}</td>
                      
                      <td className="px-4 py-2 bg-indigo-50/20 dark:bg-indigo-900/5">
                        <input
                          type="number"
                          min={0}
                          value={row.physical_qty ?? ''}
                          placeholder="—"
                          onChange={(e) => {
                            const value = e.target.value === '' ? '' : Number(e.target.value);
                            setReconcileRows((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], physical_qty: value };
                              return next;
                            });
                          }}
                          disabled={!canReconcile}
                          aria-label="Physical quantity"
                          className="w-20 px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-2 bg-indigo-50/20 dark:bg-indigo-900/5">
                        <input
                          type="number"
                          min={0}
                          value={row.physical_bonus ?? ''}
                          placeholder="—"
                          onChange={(e) => {
                            const value = e.target.value === '' ? '' : Number(e.target.value);
                            setReconcileRows((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], physical_bonus: value };
                              return next;
                            });
                          }}
                          disabled={!canReconcile}
                          aria-label="Physical bonus quantity"
                          className="w-20 px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </td>
                      
                      <td className={`px-4 py-2 text-right font-medium ${
                        variance === null ? 'text-gray-300'
                          : variance < 0 ? 'text-rose-600'
                          : variance > 0 ? 'text-emerald-600'
                          : 'text-gray-500'
                      }`}>
                        {variance === null ? '—' : `${variance > 0 ? '+' : ''}${variance}`}
                      </td>
                      {canReconcile && (
                        <td className="px-4 py-2 text-right">
                          {/* Disabled until this batch has a count, so the button
                              can never write a zero nobody typed. */}
                          <button
                            type="button"
                            onClick={() => saveRow(row)}
                            disabled={!counted || savingRow !== null}
                            title={counted
                              ? 'Apply this batch only'
                              : 'Enter the physical quantity first'}
                            aria-label={`Save adjustment for ${row.medicine_name}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Save className="w-3 h-3" />
                            {savingRow === `${row.medicine_id}::${row.batch_no || ''}` ? '...' : t('ui.save')}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
