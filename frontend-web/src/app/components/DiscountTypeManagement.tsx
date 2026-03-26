import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, X, Loader2 } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { useHospitals } from '../context/HospitalContext';
import { useAuth } from '../context/AuthContext';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { toast } from 'sonner';
import api from '../../api/axios';

interface DiscountTypeManagementProps {
  hospital: Hospital;
  userRole: UserRole;
}

interface DiscountTypeRow {
  id: string;
  hospitalId: string;
  name: string;
  isActive: boolean;
}

export function DiscountTypeManagement({ hospital, userRole }: DiscountTypeManagementProps) {
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  const { hospitals } = useHospitals();
  const { hasPermission } = useAuth();

  const canAdd = hasPermission('add_discounts') || hasPermission('manage_discounts');
  const canEdit = hasPermission('edit_discounts') || hasPermission('manage_discounts');
  const canDelete = hasPermission('delete_discounts') || hasPermission('manage_discounts');

  const [rows, setRows] = useState<DiscountTypeRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<DiscountTypeRow | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    hospitalId: currentHospital.id,
    name: '',
    isActive: true,
  });

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      hospitalId: userRole === 'super_admin' && selectedHospitalId !== 'all' ? selectedHospitalId : currentHospital.id,
    }));
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

      const res = await api.get('/discount-types', { params });
      const data = (res.data?.data ?? []) as any[];
      setRows(
        data.map((row) => ({
          id: String(row.id),
          hospitalId: String(row.hospital_id),
          name: String(row.name ?? ''),
          isActive: Boolean(row.is_active),
        }))
      );
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to load discount types';
      toast.error(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [currentHospital.id, searchTerm, selectedHospitalId, userRole]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(term));
  }, [rows, searchTerm]);

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / itemsPerPage));

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRows.slice(start, start + itemsPerPage);
  }, [filteredRows, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedHospitalId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const resetForm = () => {
    setEditing(null);
    setForm({
      hospitalId: userRole === 'super_admin' && selectedHospitalId !== 'all' ? selectedHospitalId : currentHospital.id,
      name: '',
      isActive: true,
    });
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (row: DiscountTypeRow) => {
    setEditing(row);
    setForm({
      hospitalId: row.hospitalId,
      name: row.name,
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
      toast.warning('Discount type name is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        name: form.name.trim(),
        is_active: form.isActive,
      };
      if (userRole === 'super_admin') payload.hospital_id = Number(form.hospitalId);

      if (editing) {
        await api.patch(`/discount-types/${editing.id}`, payload);
        toast.success('Discount type updated successfully');
      } else {
        await api.post('/discount-types', payload);
        toast.success('Discount type created successfully');
      }

      closeModal();
      await loadRows();
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        Object.values(error?.response?.data?.errors || {}).flat()[0] ||
        'Failed to save discount type';
      toast.error(String(message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row: DiscountTypeRow) => {
    if (!window.confirm(`Delete discount type "${row.name}"?`)) return;

    try {
      await api.delete(`/discount-types/${row.id}`);
      toast.success('Discount type deleted successfully');
      await loadRows();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to delete discount type';
      toast.error(String(message));
    }
  };

  const getHospitalName = (hospitalId: string) => hospitals.find((h) => h.id === hospitalId)?.name || 'Unknown';

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Discount Types</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Manage discount type categories used in appointments and billing.</p>
        </div>
        {canAdd && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            Add Discount Type
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative w-full md:max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search discount types..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm pl-9 pr-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
        <HospitalSelector userRole={userRole} selectedHospitalId={selectedHospitalId} onHospitalChange={setSelectedHospitalId} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading discount types...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/40">
                <tr className="text-left text-gray-600 dark:text-gray-300">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  {isAllHospitals && <th className="px-4 py-3 font-semibold">Hospital</th>}
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{row.name}</td>
                    {isAllHospitals && <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{getHospitalName(row.hospitalId)}</td>}
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
                    <td colSpan={isAllHospitals ? 4 : 3} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                      No discount types found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredRows.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
            <span>
              Showing {paginatedRows.length} of {filteredRows.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
              >
                Prev
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-2xl">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{editing ? 'Edit Discount Type' : 'Add Discount Type'}</h2>
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
                    onChange={(e) => setForm((prev) => ({ ...prev, hospitalId: e.target.value }))}
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
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Discount Type Name <span className="text-red-500">*</span></label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g. Insurance, Corporate, Special"
                  maxLength={191}
                  required
                />
              </div>

              <div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
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
