import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Hospital, UserRole } from '../types';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { useMedicines } from '../context/MedicineContext';
import { formatQuantityInSaleUnit, medicineDisplayName } from '../utils/medicineUnits';
import {
  CellNumber,
  CellStack,
  CellText,
  DataTableBody,
  DataTableCard,
  DataTableHead,
  RowIcon,
  TableEmpty,
  TableLoading,
  Th,
  Tr,
  usePagination,
  useTableSort,
} from './DataTable';
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
  const { medicines } = useMedicines();
  
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

  const getMedicineById = (id: any) => medicines.find((m) => String(m.id) === String(id));

  /** Falls back to the name the endpoint sent when the product is not loaded. */
  const displayNameFor = (row: any) => {
    const medicine = getMedicineById(row.medicine_id);
    return medicine ? medicineDisplayName(medicine) : (row.medicine_name || 'Unknown');
  };

  /** Piece counts expressed in the product's own selling unit. */
  const inSaleUnit = (pieces: any, medicineId: any) =>
    formatQuantityInSaleUnit(Number(pieces || 0), getMedicineById(medicineId)).text;

  /**
   * The sheet, sortable and searchable, with each row remembering its position
   * in the full list.
   *
   * `idx` is that original position and is what the physical-count inputs write
   * back to. Sorting or filtering the view must never renumber it, or a count
   * typed against one batch would be saved against another.
   */
  const adjustmentRows = useMemo(() => reconcileRows.map((row, idx) => {
    const medicine = getMedicineById(row.medicine_id);
    return {
      row,
      idx,
      medicineName: medicine ? medicineDisplayName(medicine) : (row.medicine_name || 'Unknown'),
      batchNo: row.batch_no || '',
      expiry: row.expiry_date || '',
      // Sorted on the converted figure, so the order matches what is displayed.
      systemQty: formatQuantityInSaleUnit(Number(row.system_qty || 0), medicine).value,
      systemBonus: formatQuantityInSaleUnit(Number(row.system_bonus || 0), medicine).value,
      systemTotal: formatQuantityInSaleUnit(Number(row.system_total || 0), medicine).value,
    };
  }), [reconcileRows, medicines]);

  const searchedAdjustments = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return adjustmentRows;
    return adjustmentRows.filter((entry) =>
      entry.medicineName.toLowerCase().includes(term)
      || String(entry.row.medicine_name ?? '').toLowerCase().includes(term)
      || entry.batchNo.toLowerCase().includes(term));
  }, [adjustmentRows, search]);

  const sort = useTableSort<any>(searchedAdjustments, 'medicineName');
  const { page, setPage, totalPages, pageRows: pagedAdjustments } = usePagination<any>(sort.rows, 50);

  useEffect(() => {
    setPage(1);
  }, [search, reconcileDate, selectedHospitalId, setPage]);

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
   * Load as soon as the tab is opened.
   *
   * The sheet used to arrive empty with "Click Refresh to load" on it, which
   * made an extra click mandatory before any work could start -- and looked
   * like the screen was broken. Refresh stays, for re-reading after a change
   * elsewhere, but is no longer the way in.
   */
  useEffect(() => {
    loadReconciliation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHospitalId, currentHospital.id, reconcileDate, isAllHospitals]);

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

      <DataTableCard
        total={searchedAdjustments.length}
        shown={pagedAdjustments.length}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noun="batches"
        maxHeight="calc(100vh - 320px)"
      >
        <DataTableHead>
          {/* Only the settled columns sort. The physical-count inputs and the
              variance derived from them deliberately do not: re-ordering rows
              under a cursor mid-count is how a figure ends up on the wrong
              batch. */}
          <Th sort={sort} field="medicineName">{t('table.medicine')}</Th>
          <Th sort={sort} field="batchNo">{t('table.batch')}</Th>
          <Th sort={sort} field="expiry">{t('table.expiry')}</Th>
          <Th sort={sort} field="systemQty">{t('table.systemQty')}</Th>
          <Th sort={sort} field="systemBonus">{t('table.systemBonus')}</Th>
          <Th sort={sort} field="systemTotal">{t('table.systemTotal')}</Th>
          <Th className="bg-indigo-50/50 dark:bg-indigo-900/10">{t('table.physicalQty')}</Th>
          <Th className="bg-indigo-50/50 dark:bg-indigo-900/10">{t('table.physicalBonus')}</Th>
          <Th align="right">{t('table.variance')}</Th>
          {canReconcile && <Th align="right">{t('table.actions')}</Th>}
        </DataTableHead>
        <DataTableBody>
          {loading ? (
            <TableLoading colSpan={canReconcile ? 10 : 9} />
          ) : pagedAdjustments.length === 0 ? (
            <TableEmpty
              colSpan={canReconcile ? 10 : 9}
              message="No adjustment records found"
              hint={search ? undefined : 'Nothing to count for this hospital and date.'}
              icon={<SlidersHorizontal className="w-6 h-6 text-gray-400" />}
            />
          ) : (
            pagedAdjustments.map(({ row, idx }: any) => {

                  // An uncounted row has no variance to show -- it is not a
                  // shortfall of everything on the shelf, it is simply unknown.
                  const counted = isCounted(row);
                  const physicalTotal = Number(row.physical_qty || 0) + Number(row.physical_bonus || 0);
                  const variance = counted ? physicalTotal - Number(row.system_total || 0) : null;
                  
                  return (
                    <Tr key={`${row.medicine_id}-${row.batch_no || 'n/a'}-${idx}`}>
                      {/* Brand + strength + form, and counts in the unit the
                          pharmacy handles -- the same figures the Stocks tab
                          shows, so a count sheet and a stock list agree. */}
                      {/* Brand + strength + form, and counts in the unit the
                          pharmacy handles -- the same figures the Stocks tab
                          shows, so a count sheet and a stock list agree. */}
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          <RowIcon tone="amber">
                            <SlidersHorizontal className="w-4 h-4" />
                          </RowIcon>
                          <CellStack primary={displayNameFor(row)} />
                        </div>
                      </td>
                      <td className="px-4 py-2"><CellText mono>{row.batch_no || '—'}</CellText></td>
                      <td className="px-4 py-2"><CellText>{row.expiry_date || '—'}</CellText></td>
                      <td className="px-4 py-2" title={`${row.system_qty} pieces`}><CellNumber>{inSaleUnit(row.system_qty, row.medicine_id)}</CellNumber></td>
                      <td className="px-4 py-2" title={`${row.system_bonus} pieces`}><CellNumber tone="muted">{inSaleUnit(row.system_bonus, row.medicine_id)}</CellNumber></td>
                      <td className="px-4 py-2" title={`${row.system_total} pieces`}><CellNumber tone="money">{inSaleUnit(row.system_total, row.medicine_id)}</CellNumber></td>
                      
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
                    </Tr>
                  );
                })
          )}
        </DataTableBody>
      </DataTableCard>

    </div>
  );
}
