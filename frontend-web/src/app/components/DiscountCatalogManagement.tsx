import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, X, Loader2 } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { useHospitals } from '../context/HospitalContext';
import { useAuth } from '../context/AuthContext';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { toast } from 'sonner';
import api from '../../api/axios';

interface DiscountCatalogManagementProps {
  hospital: Hospital;
  userRole: UserRole;
}

interface DiscountTypeOption {
  id: string;
  hospitalId: string;
  name: string;
}

interface DiscountItem {
  id: string;
  hospitalId: string;
  name: string;
  discountTypeId: string;
  discountTypeName: string;
  amount: number;
  currency: string;
  isActive: boolean;
}

export function DiscountCatalogManagement({ hospital, userRole }: DiscountCatalogManagementProps) {
  const { selectedHospitalId, setSelectedHospitalId, currentHospital } = useHospitalFilter(hospital, userRole);
  const { hospitals } = useHospitals();
  const { hasPermission } = useAuth();

  const canAdd = hasPermission('add_discounts') || hasPermission('manage_discounts');
  const canEdit = hasPermission('edit_discounts') || hasPermission('manage_discounts');
  const canDelete = hasPermission('delete_discounts') || hasPermission('manage_discounts');

  const [rows, setRows] = useState<DiscountItem[]>([]);
  const [typeOptions, setTypeOptions] = useState<DiscountTypeOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<DiscountItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    hospitalId: currentHospital.id,
    name: '',
    discountTypeId: '',
    amount: '0',
    currency: 'AFN',
    isActive: true,
  });

  const resolveTargetHospitalId = useCallback(() => {
    if (userRole === 'super_admin' && selectedHospitalId !== 'all') {
      return selectedHospitalId;
    }
    return currentHospital.id;
  }, [currentHospital.id, selectedHospitalId, userRole]);

  const loadTypeOptions = useCallback(async () => {
    try {
      const params: Record<string, any> = { per_page: 200, is_active: 1 };
      if (userRole === 'super_admin') {
        if (selectedHospitalId !== 'all') {
          params.hospital_id = selectedHospitalId;
        }
      } else {
        params.hospital_id = currentHospital.id;
      }

      const res = await api.get('/discount-types', { params });
      const data = (res.data?.data ?? []) as any[];
      setTypeOptions(
        data.map((row) => ({
          id: String(row.id),
          hospitalId: String(row.hospital_id),
          name: String(row.name ?? ''),
        }))
      );
    } catch {
      setTypeOptions([]);
    }
  }, [currentHospital.id, selectedHospitalId, userRole]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { per_page: 200 };
      if (searchTerm.trim()) params.search = searchTerm.trim();

      if (userRole === 'super_admin') {
        if (selectedHospitalId !== 'all') params.hospital_id = selectedHospitalId;
      } else {
        params.hospital_id = currentHospital.id;
      }

      const res = await api.get('/discounts', { params });
      const data = (res.data?.data ?? []) as any[];
      setRows(
        data.map((row) => ({
          id: String(row.id),
          hospitalId: String(row.hospital_id),
          name: String(row.name ?? ''),
          discountTypeId: String(row.discount_type_id),
          discountTypeName: String(row.type?.name ?? row.discount_type_id ?? ''),
          amount: Number(row.amount ?? 0),
          currency: String(row.currency ?? 'AFN'),
          isActive: Boolean(row.is_active),
        }))
      );
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to load discount catalog';
      toast.error(String(message));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [currentHospital.id, searchTerm, selectedHospitalId, userRole]);

  useEffect(() => {
    loadTypeOptions();
    loadRows();
  }, [loadRows, loadTypeOptions]);

  useEffect(() => {
    setForm((prev) => {
      const nextHospitalId = resolveTargetHospitalId();
      const availableTypes = typeOptions.filter((t) => t.hospitalId === nextHospitalId);
      const keepType = availableTypes.some((t) => t.id === prev.discountTypeId);

      return {
        ...prev,
        hospitalId: nextHospitalId,
        discountTypeId: keepType ? prev.discountTypeId : (availableTypes[0]?.id ?? ''),
      };
    });
  }, [typeOptions, resolveTargetHospitalId]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => {
      return (
        row.name.toLowerCase().includes(term) ||
        row.discountTypeName.toLowerCase().includes(term) ||
        row.currency.toLowerCase().includes(term)
      );
    });
  }, [rows, searchTerm]);

  const typeOptionsForForm = useMemo(() => {
    if (userRole !== 'super_admin' || form.hospitalId === 'all') return typeOptions;
    return typeOptions.filter((t) => t.hospitalId === form.hospitalId);
  }, [form.hospitalId, typeOptions, userRole]);

  const resetForm = () => {
    const hospitalId = resolveTargetHospitalId();
    const defaultType = typeOptions.find((t) => t.hospitalId === hospitalId)?.id ?? '';

    setEditing(null);
    setForm({
      hospitalId,
      name: '',
      discountTypeId: defaultType,
      amount: '0',
      currency: 'AFN',
      isActive: true,
    });
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (row: DiscountItem) => {
    setEditing(row);
    setForm({
      hospitalId: row.hospitalId,
      name: row.name,
      discountTypeId: row.discountTypeId,
      amount: String(row.amount),
      currency: row.currency,
      isActive: row.isActive,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.warning('Discount name is required');
      return;
    }

    if (!form.discountTypeId) {
      toast.warning('Discount type is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        name: form.name.trim(),
        discount_type_id: Number(form.discountTypeId),
        amount: Number(form.amount || 0),
        currency: form.currency.trim().toUpperCase() || 'AFN',
        is_active: form.isActive,
      };
      if (userRole === 'super_admin') payload.hospital_id = Number(form.hospitalId);

      if (editing) {
        await api.patch(`/discounts/${editing.id}`, payload);
        toast.success('Discount updated successfully');
      } else {
        await api.post('/discounts', payload);
        toast.success('Discount created successfully');
      }

      closeModal();
      await Promise.all([loadTypeOptions(), loadRows()]);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        Object.values(error?.response?.data?.errors || {}).flat()[0] ||
        'Failed to save discount';
      toast.error(String(message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row: DiscountItem) => {
    if (!window.confirm(`Delete discount "${row.name}"?`)) return;

    try {
      await api.delete(`/discounts/${row.id}`);
      toast.success('Discount deleted successfully');
      await loadRows();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to delete discount';
      toast.error(String(message));
    }
  };

  const getHospitalName = (hospitalId: string) => hospitals.find((h) => h.id === hospitalId)?.name || 'Unknown';

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Discount Catalog</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Manage discount entries with amount and currency.</p>
        </div>
        {canAdd && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            Add Discount
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative w-full md:max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search discounts..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm pl-9 pr-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
        <HospitalSelector userRole={userRole} selectedHospitalId={selectedHospitalId} onHospitalChange={setSelectedHospitalId} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading discount catalog...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/40">
                <tr className="text-left text-gray-600 dark:text-gray-300">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Discount Type</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  {selectedHospitalId === 'all' && <th className="px-4 py-3 font-semibold">Hospital</th>}
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{row.name}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.discountTypeName}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.amount.toFixed(2)} {row.currency}</td>
                    {selectedHospitalId === 'all' && <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{getHospitalName(row.hospitalId)}</td>}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {canEdit && (
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => openEditModal(row)}
                            className="p-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            title="Delete"
                            onClick={() => handleDelete(row)}
                            className="p-1.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={selectedHospitalId === 'all' ? 6 : 5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                      No discount entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-2xl">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{editing ? 'Edit Discount' : 'Add Discount'}</h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3">
              {userRole === 'super_admin' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Hospital <span className="text-red-500">*</span></label>
                  <select
                    value={form.hospitalId}
                    onChange={(e) => {
                      const nextHospitalId = e.target.value;
                      const nextType = typeOptions.find((t) => t.hospitalId === nextHospitalId)?.id ?? '';
                      setForm((prev) => ({ ...prev, hospitalId: nextHospitalId, discountTypeId: nextType }));
                    }}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                    title="Hospital"
                  >
                    {hospitals.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Discount Name <span className="text-red-500">*</span></label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g. Employee Family Package"
                  maxLength={191}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Discount Type <span className="text-red-500">*</span></label>
                <select
                  value={form.discountTypeId}
                  onChange={(e) => setForm((prev) => ({ ...prev, discountTypeId: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                  title="Discount Type"
                >
                  {typeOptionsForForm.length === 0 && <option value="">No discount type available</option>}
                  {typeOptionsForForm.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Amount <span className="text-red-500">*</span></label>
                  <input
                    value={form.amount}
                    onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    type="number"
                    min={0}
                    step="0.01"
                    title="Amount"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Currency <span className="text-red-500">*</span></label>
                  <input
                    value={form.currency}
                    onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white uppercase"
                    maxLength={10}
                    title="Currency"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                    title="Active"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Active
                </label>
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
