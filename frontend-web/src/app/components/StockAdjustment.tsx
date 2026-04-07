import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Hospital, UserRole } from '../types';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { SlidersHorizontal, RefreshCcw, Save } from 'lucide-react';
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
  
  const [reconcileDate, setReconcileDate] = useState(() => new Date().toISOString().slice(0, 10));
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

  const saveReconciliation = async () => {
    const hospitalId = isAllHospitals ? null : selectedHospitalId || currentHospital.id;
    if (!hospitalId) {
      toast.error('Please select a hospital for stock adjustment');
      return;
    }
    try {
      setLoading(true);
      await api.post('/stock-reconciliation', {
        date: reconcileDate,
        hospital_id: hospitalId,
        items: reconcileRows.map((row) => ({
          medicine_id: row.medicine_id,
          batch_no: row.batch_no || null,
          physical_qty: row.physical_qty ?? 0,
          physical_bonus: row.physical_bonus ?? 0,
        })),
      });

      toast.success('Stock adjustment saved successfully');
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
            <RefreshCcw className="w-3.5 h-3.5" />
            Refresh
          </button>
          
          {canReconcile && (
            <button
              onClick={saveReconciliation}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              Save Adjustments
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-gray-50/50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-gray-500 sticky top-0">
              <tr>
                <th className="px-4 py-3 font-medium">Medicine</th>
                <th className="px-4 py-3 font-medium">Batch</th>
                <th className="px-4 py-3 font-medium">Expiry Date</th>
                <th className="px-4 py-3 font-medium">System Qty</th>
                <th className="px-4 py-3 font-medium">System Bonus</th>
                <th className="px-4 py-3 font-medium">System Total</th>
                <th className="px-4 py-3 font-medium bg-indigo-50/50 dark:bg-indigo-900/10">Physical Qty</th>
                <th className="px-4 py-3 font-medium bg-indigo-50/50 dark:bg-indigo-900/10">Physical Bonus</th>
                <th className="px-4 py-3 font-medium text-right">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {reconcileRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    <p>No adjustment records found.</p>
                    <p className="mt-1 opacity-70">Click Refresh to load system stock values for adjustment.</p>
                  </td>
                </tr>
              ) : (
                reconcileRows.map((row, idx) => {
                  const safePhysicalQty = Number(row.physical_qty || 0);
                  const safePhysicalBonus = Number(row.physical_bonus || 0);
                  const physicalTotal = safePhysicalQty + safePhysicalBonus;
                  const variance = physicalTotal - Number(row.system_total || 0);
                  
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
                          value={row.physical_qty ?? 0}
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
                          value={row.physical_bonus ?? 0}
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
                      
                      <td className={`px-4 py-2 text-right font-medium ${variance < 0 ? 'text-rose-600' : variance > 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                        {variance > 0 ? '+' : ''}{variance}
                      </td>
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
