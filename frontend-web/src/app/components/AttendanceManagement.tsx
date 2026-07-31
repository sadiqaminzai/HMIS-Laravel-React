import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Search, X, Download, Upload } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { useEmployeeAttendances } from '../context/EmployeeAttendanceContext';
import { useEmployees } from '../context/EmployeeContext';
import { useDepartments } from '../context/DepartmentContext';
import { useShifts } from '../context/ShiftContext';
import { useAuth } from '../context/AuthContext';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { toast } from 'sonner';

interface AttendanceManagementProps {
  hospital: Hospital;
  userRole: UserRole;
}

export function AttendanceManagement({ hospital, userRole }: AttendanceManagementProps) {
  const { t } = useTranslation();
  const {
    attendances,
    addAttendance,
    bulkAddAttendance,
    updateAttendance,
    deleteAttendance,
    exportAttendanceCsv,
    importAttendanceCsv,
    loading,
  } = useEmployeeAttendances();
  const { employees } = useEmployees();
  const { departments } = useDepartments();
  const { shifts } = useShifts();
  const { hasPermission } = useAuth();
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital } = useHospitalFilter(hospital, userRole);

  const canAdd = hasPermission('add_employee_attendances') || hasPermission('manage_employee_attendances');
  const canEdit = hasPermission('edit_employee_attendances') || hasPermission('manage_employee_attendances');
  const canDelete = hasPermission('delete_employee_attendances') || hasPermission('manage_employee_attendances');

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [bulkCurrentPage, setBulkCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const itemsPerPage = 10;
  const bulkItemsPerPage = 8;

  const [formData, setFormData] = useState({
    hospitalId: currentHospital.id,
    departmentId: '',
    employeeId: '',
    shiftId: '',
    attendanceDate: new Date().toISOString().slice(0, 10),
    checkInTime: '',
    checkOutTime: '',
    status: 'present' as 'present' | 'absent' | 'leave' | 'half_day' | 'holiday',
    notes: '',
  });

  const [bulkForm, setBulkForm] = useState({
    hospitalId: currentHospital.id,
    departmentId: 'all',
    shiftId: '',
    attendanceDate: new Date().toISOString().slice(0, 10),
    checkInTime: '',
    checkOutTime: '',
    status: 'present' as 'present' | 'absent' | 'leave' | 'half_day' | 'holiday',
    notes: '',
  });
  const [departmentAttendanceMap, setDepartmentAttendanceMap] = useState<Record<string, 'present' | 'absent'>>({});

  const scopedAttendances = useMemo(() => filterByHospital(attendances), [attendances, filterByHospital]);
  const scopedEmployees = useMemo(() => filterByHospital(employees), [employees, filterByHospital]);
  const scopedDepartments = useMemo(() => filterByHospital(departments), [departments, filterByHospital]);
  const scopedShifts = useMemo(() => filterByHospital(shifts), [shifts, filterByHospital]);

  const bulkEmployees = useMemo(() => {
    if (bulkForm.departmentId === 'all') {
      return scopedEmployees.filter((employee) => employee.status === 'active');
    }

    if (!bulkForm.departmentId) {
      return [];
    }

    return scopedEmployees.filter(
      (employee) => employee.status === 'active' && employee.departmentId === bulkForm.departmentId
    );
  }, [scopedEmployees, bulkForm.departmentId]);

  const filteredSingleEmployees = useMemo(() => {
    if (!formData.departmentId) {
      return scopedEmployees;
    }

    return scopedEmployees.filter((employee) => employee.departmentId === formData.departmentId);
  }, [scopedEmployees, formData.departmentId]);

  const filtered = useMemo(
    () => scopedAttendances.filter((attendance) => {
      const search = searchTerm.toLowerCase();
      return (
        (attendance.employee?.fullName || '').toLowerCase().includes(search) ||
        (attendance.employee?.employeeCode || '').toLowerCase().includes(search) ||
        attendance.status.toLowerCase().includes(search) ||
        (attendance.notes || '').toLowerCase().includes(search)
      );
    }),
    [scopedAttendances, searchTerm]
  );

  const paginatedAttendances = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  }, [filtered, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));

  const paginatedBulkEmployees = useMemo(() => {
    const startIndex = (bulkCurrentPage - 1) * bulkItemsPerPage;
    return bulkEmployees.slice(startIndex, startIndex + bulkItemsPerPage);
  }, [bulkEmployees, bulkCurrentPage]);

  const bulkTotalPages = Math.max(1, Math.ceil(bulkEmployees.length / bulkItemsPerPage));

  React.useEffect(() => {
    setFormData((prev) => ({ ...prev, hospitalId: currentHospital.id }));
    setBulkForm((prev) => ({ ...prev, hospitalId: currentHospital.id }));
  }, [currentHospital.id]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedHospitalId]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  React.useEffect(() => {
    setBulkCurrentPage(1);
  }, [bulkForm.departmentId, selectedHospitalId, showBulkModal]);

  React.useEffect(() => {
    if (bulkCurrentPage > bulkTotalPages) {
      setBulkCurrentPage(bulkTotalPages);
    }
  }, [bulkCurrentPage, bulkTotalPages]);

  React.useEffect(() => {
    if (!bulkForm.departmentId) {
      setDepartmentAttendanceMap({});
      return;
    }

    const filteredEmployees = bulkForm.departmentId === 'all'
      ? scopedEmployees.filter((employee) => employee.status === 'active')
      : scopedEmployees.filter(
          (employee) => employee.status === 'active' && employee.departmentId === bulkForm.departmentId
        );

    const departmentEmployeeStatusMap = filteredEmployees.reduce<Record<string, 'present' | 'absent'>>((acc, employee) => {
        acc[employee.id] = 'present';
        return acc;
      }, {});

    setDepartmentAttendanceMap(departmentEmployeeStatusMap);
  }, [bulkForm.departmentId, scopedEmployees]);

  const openAdd = () => {
    if (!canAdd) {
      toast.warning('You are not authorized to add attendance records');
      return;
    }

    setEditingId(null);
    setFormData({
      hospitalId: currentHospital.id,
      departmentId: '',
      employeeId: '',
      shiftId: '',
      attendanceDate: new Date().toISOString().slice(0, 10),
      checkInTime: '',
      checkOutTime: '',
      status: 'present',
      notes: '',
    });
    setShowModal(true);
  };

  const openEdit = (id: string) => {
    if (!canEdit) {
      toast.warning('You are not authorized to edit attendance records');
      return;
    }

    const record = attendances.find((a) => a.id === id);
    if (!record) return;

    setEditingId(record.id);
    setFormData({
      hospitalId: record.hospitalId,
      departmentId: record.employee?.departmentId || '',
      employeeId: record.employeeId,
      shiftId: record.shiftId || '',
      attendanceDate: record.attendanceDate.toISOString().slice(0, 10),
      checkInTime: record.checkInTime || '',
      checkOutTime: record.checkOutTime || '',
      status: record.status,
      notes: record.notes || '',
    });
    setShowModal(true);
  };

  const openBulkAdd = () => {
    if (!canAdd) {
      toast.warning('You are not authorized to add attendance records');
      return;
    }

    setBulkForm({
      hospitalId: currentHospital.id,
      departmentId: 'all',
      shiftId: '',
      attendanceDate: new Date().toISOString().slice(0, 10),
      checkInTime: '',
      checkOutTime: '',
      status: 'present',
      notes: '',
    });
    setDepartmentAttendanceMap({});
    setShowBulkModal(true);
  };

  const onDelete = async (id: string) => {
    if (!canDelete) {
      toast.warning('You are not authorized to delete attendance records');
      return;
    }

    const confirmed = window.confirm('Delete this attendance record?');
    if (!confirmed) return;

    try {
      await deleteAttendance(id);
      toast.success('Attendance record deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete attendance record');
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting) return;

    if (userRole === 'super_admin' && !formData.hospitalId) {
      toast.error('Please select hospital');
      return;
    }

    if (!formData.employeeId) {
      toast.error('Please select employee');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        hospitalId: formData.hospitalId,
        employeeId: formData.employeeId,
        shiftId: formData.shiftId || undefined,
        attendanceDate: new Date(formData.attendanceDate),
        checkInTime: formData.checkInTime || undefined,
        checkOutTime: formData.checkOutTime || undefined,
        status: formData.status,
        notes: formData.notes || undefined,
      };

      if (editingId) {
        await updateAttendance({ id: editingId, ...payload });
        toast.success('Attendance updated');
      } else {
        const created = await addAttendance(payload);
        if (!created) return;
        toast.success('Attendance added');
      }

      setShowModal(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const onBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (bulkSubmitting) return;
    if (userRole === 'super_admin' && !bulkForm.hospitalId) {
      toast.error('Please select hospital');
      return;
    }

    if (!bulkForm.departmentId) {
      toast.error('Please select department for bulk attendance');
      return;
    }

    if (bulkEmployees.length === 0) {
      toast.error('No employees found in selected department');
      return;
    }

    const entries = bulkEmployees.map((employee) => {
      const status = departmentAttendanceMap[employee.id] ?? 'present';
      const isPresent = status === 'present';
      return {
        employeeId: employee.id,
        status,
        shiftId: bulkForm.shiftId || undefined,
        checkInTime: isPresent ? bulkForm.checkInTime || undefined : undefined,
        checkOutTime: isPresent ? bulkForm.checkOutTime || undefined : undefined,
        notes: bulkForm.notes || undefined,
      };
    });

    setBulkSubmitting(true);
    try {
      const count = await bulkAddAttendance({
        hospitalId: bulkForm.hospitalId,
        departmentId: bulkForm.departmentId === 'all' ? undefined : bulkForm.departmentId,
        shiftId: bulkForm.shiftId || undefined,
        attendanceDate: bulkForm.attendanceDate,
        checkInTime: bulkForm.checkInTime || undefined,
        checkOutTime: bulkForm.checkOutTime || undefined,
        status: bulkForm.status,
        notes: bulkForm.notes || undefined,
        entries,
      });

      toast.success(`Bulk attendance saved for ${count} employees`);
      setShowBulkModal(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save bulk attendance');
    } finally {
      setBulkSubmitting(false);
    }
  };

  const onExport = async () => {
    try {
      await exportAttendanceCsv({
        hospitalId: currentHospital.id,
      });
      toast.success('Attendance CSV exported');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Export failed');
    }
  };

  const onImport = async (file: File | null) => {
    if (!file) return;

    try {
      const result = await importAttendanceCsv(file, { hospitalId: currentHospital.id });
      toast.success(`Import done. Success: ${result.success}, Failed: ${result.failed}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Import failed');
    }
  };

  const setBulkEmployeeStatus = (id: string, status: 'present' | 'absent') => {
    setDepartmentAttendanceMap((prev) => ({
      ...prev,
      [id]: status,
    }));
  };

  const selectAllBulkEmployees = () => {
    setDepartmentAttendanceMap((prev) => {
      const next = { ...prev };
      bulkEmployees.forEach((employee) => {
        next[employee.id] = 'present';
      });
      return next;
    });
  };

  const unselectAllBulkEmployees = () => {
    setDepartmentAttendanceMap((prev) => {
      const next = { ...prev };
      bulkEmployees.forEach((employee) => {
        next[employee.id] = 'absent';
      });
      return next;
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-[1300px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Single entry, department-wise bulk attendance, and CSV import/export.</p>
        </div>
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-2">
          <button
            onClick={openAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-[10px] text-sm font-medium flex items-center gap-2 shadow-sm transition-all focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Attendance
          </button>
          <button
            onClick={openBulkAdd}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-sm font-medium"
          >
            Bulk Department-wise
          </button>
          <button
            onClick={onExport}
            className="bg-slate-700 hover:bg-slate-800 text-white px-3.5 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />{t('ui.exportCsv')}</button>
          <label className="bg-orange-600 hover:bg-orange-700 text-white px-3.5 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" />
            Import CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                onImport(file);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            title="Search attendance"
            placeholder="Search attendance..."
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
          <table className="w-full text-left text-sm min-w-[980px]">
            <thead className="bg-gray-50/80 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 font-semibold sticky top-0 backdrop-blur-sm z-10">
              <tr>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.date')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.employee')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.department')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.shift')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.status')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.checkIn')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.checkOut')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.notes')}</th>
                <th className="px-3 py-2.5 text-xs font-medium text-center">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedAttendances.map((attendance) => (
                <tr key={attendance.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/40 transition-colors border-b border-gray-100 dark:border-gray-800/50">
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{attendance.attendanceDate.toLocaleDateString()}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-900 dark:text-white font-medium">
                    <div>{attendance.employee?.fullName || '-'}</div>
                    <div className="text-xs text-gray-500">{attendance.employee?.employeeCode || ''}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{attendance.employee?.departmentName || '-'}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{attendance.shift?.name || '-'}</td>
                  <td className="px-3 py-2.5 text-xs font-medium">
                    <span className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold ${attendance.status === 'present'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : attendance.status === 'absent'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                      {attendance.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{attendance.checkInTime || '-'}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{attendance.checkOutTime || '-'}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{attendance.notes || '-'}</td>
                  <td className="px-3 py-2.5 text-xs font-medium">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => openEdit(attendance.id)}
                        className="p-2.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-blue-600 hover:bg-blue-100"
                        title={t('ui.edit')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(attendance.id)}
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
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                    No attendance records found
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
                {editingId ? 'Edit Attendance' : t('ui.addAttendance')}
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
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">Attendance Record</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.department')}</label>
                <select
                  value={formData.departmentId}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      departmentId: e.target.value,
                      employeeId: '',
                    }))
                  }
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title={t('ui.department')}
                >
                  <option value="">All Departments</option>
                  {scopedDepartments
                    .filter((department) => department.status === 'active')
                    .map((department) => (
                      <option key={department.id} value={department.id}>{department.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.employee')}</label>
                <select
                  value={formData.employeeId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, employeeId: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title={t('ui.employee')}
                  required
                >
                  <option value="">{t('ui.selectEmployee')}</option>
                  {filteredSingleEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.fullName} ({employee.employeeCode || 'N/A'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.shift')}</label>
                <select
                  value={formData.shiftId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, shiftId: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title={t('ui.shift')}
                >
                  <option value="">Employee default shift</option>
                  {scopedShifts
                    .filter((shift) => shift.status === 'active')
                    .map((shift) => (
                      <option key={shift.id} value={shift.id}>{shift.name} ({shift.startTime}-{shift.endTime})</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Attendance Date</label>
                <input
                  type="date"
                  value={formData.attendanceDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, attendanceDate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title="Attendance date"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.status')}</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as typeof formData.status }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title="Attendance status"
                >
                  <option value="present">{t('ui.present')}</option>
                  <option value="absent">{t('ui.absent')}</option>
                  <option value="leave">Leave</option>
                  <option value="half_day">Half Day</option>
                  <option value="holiday">Holiday</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.notes')}</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title="Attendance notes"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Check In Time</label>
                <input
                  type="time"
                  value={formData.checkInTime}
                  onChange={(e) => setFormData((prev) => ({ ...prev, checkInTime: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title="Check-in time"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Check Out Time</label>
                <input
                  type="time"
                  value={formData.checkOutTime}
                  onChange={(e) => setFormData((prev) => ({ ...prev, checkOutTime: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title="Check-out time"
                />
              </div>

              </div>
            </div>
          </div>

            <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs">{t('ui.cancel')}</button>
              <button type="submit" disabled={submitting} className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md transition-colors font-medium text-xs shadow-sm flex items-center justify-center gap-1.5">
                {submitting ? 'Saving...' : editingId ? t('ui.update') : t('ui.create')}
              </button>
            </div>
          </form>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 transition-all">
          <form onSubmit={onBulkSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between rounded-t-lg sticky top-0 z-10">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Bulk Attendance (Department-wise)
                {userRole === 'super_admin' && (
                  <span className="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">- {currentHospital.name}</span>
                )}
              </h2>
              <button type="button" onClick={() => setShowBulkModal(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors" title={t('ui.close')}>
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
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">Bulk Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.department')}</label>
                <select
                  value={bulkForm.departmentId}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, departmentId: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title="Bulk department"
                  required
                >
                  <option value="all">All Departments</option>
                  {scopedDepartments
                    .filter((department) => department.status === 'active')
                    .map((department) => (
                      <option key={department.id} value={department.id}>{department.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.shift')}</label>
                <select
                  value={bulkForm.shiftId}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, shiftId: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title="Bulk shift"
                >
                  <option value="">Employee default shift</option>
                  {scopedShifts
                    .filter((shift) => shift.status === 'active')
                    .map((shift) => (
                      <option key={shift.id} value={shift.id}>{shift.name} ({shift.startTime}-{shift.endTime})</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Attendance Date</label>
                <input
                  type="date"
                  value={bulkForm.attendanceDate}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, attendanceDate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title="Bulk attendance date"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.status')}</label>
                <select
                  value={bulkForm.status}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, status: e.target.value as typeof bulkForm.status }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title="Bulk attendance status"
                >
                  <option value="present">{t('ui.present')}</option>
                  <option value="absent">{t('ui.absent')}</option>
                  <option value="leave">Leave</option>
                  <option value="half_day">Half Day</option>
                  <option value="holiday">Holiday</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Check In Time</label>
                <input
                  type="time"
                  value={bulkForm.checkInTime}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, checkInTime: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title="Bulk check-in time"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Check Out Time</label>
                <input
                  type="time"
                  value={bulkForm.checkOutTime}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, checkOutTime: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title="Bulk check-out time"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.notes')}</label>
                <textarea
                  rows={2}
                  value={bulkForm.notes}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title="Bulk attendance notes"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-700 dark:text-gray-300">
                    Employees ({bulkEmployees.filter((employee) => (departmentAttendanceMap[employee.id] ?? 'present') === 'present').length} present)
                  </label>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={selectAllBulkEmployees} className="text-xs text-blue-600 hover:underline">
                      Mark all present
                    </button>
                    <button type="button" onClick={unselectAllBulkEmployees} className="text-xs text-gray-600 hover:underline dark:text-gray-300">
                      Mark all absent
                    </button>
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700/40 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold text-gray-700 dark:text-gray-200">{t('table.employee')}</th>
                        <th className="px-3 py-2.5 font-semibold text-gray-700 dark:text-gray-200">{t('table.code')}</th>
                        <th className="px-3 py-2.5 font-semibold text-gray-700 dark:text-gray-200 text-right">{t('table.status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {paginatedBulkEmployees.map((employee) => (
                        <tr key={employee.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{employee.fullName}</td>
                          <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">{employee.employeeCode || 'N/A'}</td>
                          <td className="px-3 py-2.5 text-right">
                            <select
                              value={departmentAttendanceMap[employee.id] ?? 'present'}
                              onChange={(e) => setBulkEmployeeStatus(employee.id, e.target.value as 'present' | 'absent')}
                              className="w-[110px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                              title={`Attendance status for ${employee.fullName}`}
                            >
                              <option value="present">{t('ui.present')}</option>
                              <option value="absent">{t('ui.absent')}</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {bulkEmployees.length === 0 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 p-2">No active employees found for this filter.</div>
                  )}
                </div>
                {bulkTotalPages > 1 && (
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Page {bulkCurrentPage} of {bulkTotalPages}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBulkCurrentPage((page) => Math.max(1, page - 1))}
                        disabled={bulkCurrentPage === 1}
                        className="px-2 py-1 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >{t('ui.previous')}</button>
                      <button
                        type="button"
                        onClick={() => setBulkCurrentPage((page) => Math.min(bulkTotalPages, page + 1))}
                        disabled={bulkCurrentPage === bulkTotalPages}
                        className="px-2 py-1 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >{t('ui.next')}</button>
                    </div>
                  </div>
                )}
              </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
              <button type="button" onClick={() => setShowBulkModal(false)} className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs">{t('ui.cancel')}</button>
              <button type="submit" disabled={bulkSubmitting} className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md transition-colors font-medium text-xs shadow-sm flex items-center justify-center gap-1.5">
                {bulkSubmitting ? t('ui.saving') : 'Save Bulk Attendance'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

