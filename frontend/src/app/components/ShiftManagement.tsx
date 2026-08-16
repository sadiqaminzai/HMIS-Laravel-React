import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { useShifts } from '../context/ShiftContext';
import { useAuth } from '../context/AuthContext';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { toast } from 'sonner';
import { AddButton } from './AddButton';

interface ShiftManagementProps {
  hospital: Hospital;
  userRole: UserRole;
}

export function ShiftManagement({ hospital, userRole }: ShiftManagementProps) {
  const { t } = useTranslation();
  const { shifts, addShift, updateShift, deleteShift, loading } = useShifts();
  const { hasPermission } = useAuth();
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital } = useHospitalFilter(hospital, userRole);

  const canAdd = hasPermission('add_shifts') || hasPermission('manage_shifts');
  const canEdit = hasPermission('edit_shifts') || hasPermission('manage_shifts');
  const canDelete = hasPermission('delete_shifts') || hasPermission('manage_shifts');

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const itemsPerPage = 10;
  const [formData, setFormData] = useState({
    hospitalId: currentHospital.id,
    name: '',
    code: '',
    startTime: '09:00',
    endTime: '17:00',
    graceMinutes: '0',
    status: 'active' as 'active' | 'inactive',
    description: '',
  });

  const scopedShifts = useMemo(() => filterByHospital(shifts), [shifts, filterByHospital]);
  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return scopedShifts;

    return scopedShifts.filter((shift) =>
      [shift.name, shift.code || '', shift.description || '', shift.startTime, shift.endTime]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [scopedShifts, searchTerm]);

  const paginatedShifts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  }, [filtered, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));

  React.useEffect(() => {
    setFormData((prev) => ({ ...prev, hospitalId: currentHospital.id }));
  }, [currentHospital.id]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedHospitalId]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const openAdd = () => {
    if (!canAdd) {
      toast.warning('You are not authorized to add shifts');
      return;
    }

    setEditingId(null);
    setFormData({
      hospitalId: currentHospital.id,
      name: '',
      code: '',
      startTime: '09:00',
      endTime: '17:00',
      graceMinutes: '0',
      status: 'active',
      description: '',
    });
    setShowModal(true);
  };

  const openEdit = (id: string) => {
    if (!canEdit) {
      toast.warning('You are not authorized to edit shifts');
      return;
    }

    const record = shifts.find((shift) => shift.id === id);
    if (!record) return;

    setEditingId(record.id);
    setFormData({
      hospitalId: record.hospitalId,
      name: record.name,
      code: record.code || '',
      startTime: record.startTime,
      endTime: record.endTime,
      graceMinutes: String(record.graceMinutes ?? 0),
      status: record.status,
      description: record.description || '',
    });
    setShowModal(true);
  };

  const onDelete = async (id: string) => {
    if (!canDelete) {
      toast.warning('You are not authorized to delete shifts');
      return;
    }

    const confirmed = window.confirm('Delete this shift?');
    if (!confirmed) return;

    try {
      await deleteShift(id);
      toast.success('Shift deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete shift');
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (userRole === 'super_admin' && !formData.hospitalId) {
      toast.error('Please select hospital');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Shift name is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        hospitalId: formData.hospitalId,
        name: formData.name.trim(),
        code: formData.code.trim() || undefined,
        startTime: formData.startTime,
        endTime: formData.endTime,
        graceMinutes: Number(formData.graceMinutes || 0),
        status: formData.status,
        description: formData.description.trim() || undefined,
      };

      if (editingId) {
        await updateShift({ id: editingId, ...payload });
        toast.success('Shift updated');
      } else {
        const created = await addShift(payload);
        if (!created) return;
        toast.success('Shift created');
      }

      setShowModal(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save shift');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1300px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shifts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage shift timings and assign them to employees.</p>
        </div>
        <AddButton onClick={openAdd} label={'Add Shift'} />
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search shifts..."
            className="w-full pl-10 pr-4 py-2.5 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          />
        </div>
        <HospitalSelector
          userRole={userRole}
          selectedHospitalId={selectedHospitalId}
          onHospitalChange={setSelectedHospitalId}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-[12px] border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[900px]">
            <thead className="bg-gray-50/80 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 font-semibold sticky top-0 backdrop-blur-sm z-10">
              <tr>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.name')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.code')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.start')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.end')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.grace')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.status')}</th>
                <th className="px-3 py-2.5 text-xs font-medium text-center">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedShifts.map((shift) => (
                <tr key={shift.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/40 transition-colors border-b border-gray-100 dark:border-gray-800/50">
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-900 dark:text-white font-medium">{shift.name}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{shift.code || '-'}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{shift.startTime}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{shift.endTime}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{shift.graceMinutes ?? 0} min</td>
                  <td className="px-3 py-2.5 text-xs font-medium">
                    <span className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold ${shift.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {shift.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-medium">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => openEdit(shift.id)}
                        className="p-2.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-blue-600 hover:bg-blue-100"
                        title={t('ui.edit')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(shift.id)}
                        className="p-2.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-red-600 hover:bg-red-100"
                        title={t('ui.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                    No shifts found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
            <div className="text-xs text-gray-500 dark:text-gray-400">Page {currentPage} of {totalPages}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >{t('ui.previous')}</button>
              <button
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >{t('ui.next')}</button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 transition-all">
          <form onSubmit={onSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between rounded-t-lg sticky top-0 z-10">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                {editingId ? 'Edit Shift' : 'Add Shift'}
                {userRole === 'super_admin' && (
                  <span className="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">- {currentHospital.name}</span>
                )}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors" title={t('ui.close')}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 space-y-2">
              {userRole === 'super_admin' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.hospital')}</label>
                  <div className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 px-3.5 py-2 text-sm text-gray-700 dark:text-gray-200">
                    {currentHospital.name}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">Shift Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Shift Name</label>
                    <input
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                      title="Shift name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.code')}</label>
                    <input
                      value={formData.code}
                      onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                      title="Shift code"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Start Time</label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData((prev) => ({ ...prev, startTime: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                      title="Shift start time"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">End Time</label>
                    <input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData((prev) => ({ ...prev, endTime: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                      title="Shift end time"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Grace Minutes</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.graceMinutes}
                      onChange={(e) => setFormData((prev) => ({ ...prev, graceMinutes: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                      title="Shift grace minutes"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.status')}</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                      title="Shift status"
                    >
                      <option value="active">{t('ui.active')}</option>
                      <option value="inactive">{t('ui.inactive')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.description')}</label>
                    <textarea
                      rows={2}
                      value={formData.description}
                      onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                      title="Shift description"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs">{t('ui.cancel')}</button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md transition-colors font-medium text-xs shadow-sm flex items-center justify-center gap-1.5"
              >
                {submitting ? 'Saving...' : editingId ? 'Update Shift' : 'Create Shift'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
