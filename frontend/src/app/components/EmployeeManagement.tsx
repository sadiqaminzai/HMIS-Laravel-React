import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Search, X, Upload } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { useEmployees } from '../context/EmployeeContext';
import { useDepartments } from '../context/DepartmentContext';
import { useDesignations } from '../context/DesignationContext';
import { useShifts } from '../context/ShiftContext';
import { useAuth } from '../context/AuthContext';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { toast } from 'sonner';

interface EmployeeManagementProps {
  hospital: Hospital;
  userRole: UserRole;
}

export function EmployeeManagement({ hospital, userRole }: EmployeeManagementProps) {
  const { t } = useTranslation();
  const { employees, addEmployee, updateEmployee, deleteEmployee, loading } = useEmployees();
  const { departments } = useDepartments();
  const { designations } = useDesignations();
  const { shifts } = useShifts();
  const { hasPermission } = useAuth();
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital } = useHospitalFilter(hospital, userRole);

  const canAdd = hasPermission('add_employees') || hasPermission('manage_employees');
  const canEdit = hasPermission('edit_employees') || hasPermission('manage_employees');
  const canDelete = hasPermission('delete_employees') || hasPermission('manage_employees');

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const itemsPerPage = 10;

  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [contractFile, setContractFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    hospitalId: currentHospital.id,
    departmentId: '',
    designationId: '',
    firstName: '',
    lastName: '',
    gender: 'male' as 'male' | 'female' | 'other',
    dateOfBirth: '',
    phone: '',
    email: '',
    joiningDate: new Date().toISOString().slice(0, 10),
    employmentType: 'permanent' as 'permanent' | 'contract' | 'temporary' | 'intern',
    basicSalary: '',
    status: 'active' as 'active' | 'inactive' | 'terminated',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });

  const scopedEmployees = useMemo(() => filterByHospital(employees), [employees, filterByHospital]);
  const scopedDepartments = useMemo(() => filterByHospital(departments), [departments, filterByHospital]);
  const scopedDesignations = useMemo(() => filterByHospital(designations), [designations, filterByHospital]);
  const scopedShifts = useMemo(() => filterByHospital(shifts), [shifts, filterByHospital]);

  const filtered = useMemo(
    () => scopedEmployees.filter((employee) => {
      const search = searchTerm.toLowerCase();
      return (
        employee.fullName.toLowerCase().includes(search) ||
        employee.employeeCode.toLowerCase().includes(search) ||
        (employee.email || '').toLowerCase().includes(search) ||
        (employee.phone || '').toLowerCase().includes(search) ||
        employee.status.toLowerCase().includes(search)
      );
    }),
    [scopedEmployees, searchTerm]
  );

  const paginatedEmployees = useMemo(() => {
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
      toast.warning('You are not authorized to add employees');
      return;
    }

    setEditingId(null);
    setProfileImageFile(null);
    setContractFile(null);
    setFormData({
      hospitalId: currentHospital.id,
      departmentId: '',
      designationId: '',
      shiftId: '',
      firstName: '',
      lastName: '',
      gender: 'male',
      dateOfBirth: '',
      phone: '',
      email: '',
      joiningDate: new Date().toISOString().slice(0, 10),
      employmentType: 'permanent',
      basicSalary: '',
      status: 'active',
      address: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
    });
    setShowModal(true);
  };

  const openEdit = (id: string) => {
    if (!canEdit) {
      toast.warning('You are not authorized to edit employees');
      return;
    }

    const record = employees.find((e) => e.id === id);
    if (!record) return;

    setEditingId(record.id);
    setProfileImageFile(null);
    setContractFile(null);
    setFormData({
      hospitalId: record.hospitalId,
      departmentId: record.departmentId || '',
      designationId: record.designationId || '',
      shiftId: record.shiftId || '',
      firstName: record.firstName,
      lastName: record.lastName,
      gender: record.gender,
      dateOfBirth: record.dateOfBirth ? record.dateOfBirth.toISOString().slice(0, 10) : '',
      phone: record.phone || '',
      email: record.email || '',
      joiningDate: record.joiningDate.toISOString().slice(0, 10),
      employmentType: record.employmentType,
      basicSalary: String(record.basicSalary || ''),
      status: record.status,
      address: record.address || '',
      emergencyContactName: record.emergencyContactName || '',
      emergencyContactPhone: record.emergencyContactPhone || '',
    });
    setShowModal(true);
  };

  const onDelete = async (id: string) => {
    if (!canDelete) {
      toast.warning('You are not authorized to delete employees');
      return;
    }

    const confirmed = window.confirm('Delete this employee?');
    if (!confirmed) return;

    try {
      await deleteEmployee(id);
      toast.success('Employee deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete employee');
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting) return;
    if (userRole === 'super_admin' && !formData.hospitalId) {
      toast.error('Please select hospital');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        hospitalId: formData.hospitalId,
        departmentId: formData.departmentId || undefined,
        designationId: formData.designationId || undefined,
        shiftId: formData.shiftId || undefined,
        firstName: formData.firstName,
        lastName: formData.lastName,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth) : undefined,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        joiningDate: new Date(formData.joiningDate),
        employmentType: formData.employmentType,
        basicSalary: Number(formData.basicSalary || 0),
        status: formData.status,
        address: formData.address || undefined,
        emergencyContactName: formData.emergencyContactName || undefined,
        emergencyContactPhone: formData.emergencyContactPhone || undefined,
      };

      if (editingId) {
        await updateEmployee({
          id: editingId,
          ...payload,
          profileImageFile,
          contractDocumentFile: contractFile,
        });
        toast.success('Employee updated');
      } else {
        const created = await addEmployee({
          ...payload,
          profileImageFile,
          contractDocumentFile: contractFile,
        });
        if (!created) return;
        toast.success('Employee added');
      }

      setShowModal(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save employee');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1300px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Employees</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Employee registration and profile management.</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-[10px] text-sm font-medium flex items-center gap-2 shadow-sm transition-all focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search employees..."
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
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.code')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.name')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.department')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.designation')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.joiningDate')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.shift')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.salary')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.status')}</th>
                <th className="px-3 py-2.5 text-xs font-medium text-center">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedEmployees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/40 transition-colors border-b border-gray-100 dark:border-gray-800/50">
                  <td className="px-3 py-2.5 text-xs font-medium font-mono text-xs text-gray-600 dark:text-gray-300">{employee.employeeCode || '-'}</td>
                  <td className="px-3 py-2.5 text-xs font-medium font-medium text-gray-900 dark:text-white">{employee.fullName}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{employee.department?.name || '-'}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{employee.designation?.name || '-'}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{employee.joiningDate.toLocaleDateString()}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{employee.shift?.name || '-'}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{employee.basicSalary.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-xs font-medium">
                    <span className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold ${employee.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : employee.status === 'terminated'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {employee.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-medium">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => openEdit(employee.id)}
                        className="p-2.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-blue-600 hover:bg-blue-100"
                        title={t('ui.edit')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(employee.id)}
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
                    No employees found
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
                {editingId ? t('ui.editEmployee') : 'Add New Employee'}
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
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">Hospital Assignment</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.hospital')}</label>
                    <div className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 px-3.5 py-2 text-sm text-gray-700 dark:text-gray-200">
                      {currentHospital.name}
                    </div>
                  </div>
                </div>
              )}

              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">{t('ui.personalInformation')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">First Name</label>
                    <input
                      value={formData.firstName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                      placeholder="e.g. John"
                      title="First name"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Last Name</label>
                    <input
                      value={formData.lastName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                      placeholder="e.g. Doe"
                      title="Last name"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.gender')}</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData((prev) => ({ ...prev, gender: e.target.value as 'male' | 'female' | 'other' }))}
                      title={t('ui.gender')}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="male">{t('ui.male')}</option>
                      <option value="female">{t('ui.female')}</option>
                      <option value="other">{t('ui.other')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.dateOfBirth')}</label>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                      title="Date of birth"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Employment Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">Employment Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.department')}</label>
                    <select
                      value={formData.departmentId}
                      onChange={(e) => setFormData((prev) => ({ ...prev, departmentId: e.target.value }))}
                      title={t('ui.department')}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="">Select Department</option>
                      {scopedDepartments.map((department) => (
                        <option key={department.id} value={department.id}>{department.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Designation</label>
                    <select
                      value={formData.designationId}
                      onChange={(e) => setFormData((prev) => ({ ...prev, designationId: e.target.value }))}
                      title="Designation"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="">Select Designation</option>
                      {scopedDesignations
                        .filter((designation) => !formData.departmentId || designation.departmentId === formData.departmentId)
                        .map((designation) => (
                          <option key={designation.id} value={designation.id}>{designation.name}</option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.shift')}</label>
                    <select
                      value={formData.shiftId}
                      onChange={(e) => setFormData((prev) => ({ ...prev, shiftId: e.target.value }))}
                      title={t('ui.shift')}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="">Select Shift</option>
                      {scopedShifts
                        .filter((shift) => shift.status === 'active')
                        .map((shift) => (
                          <option key={shift.id} value={shift.id}>{shift.name} ({shift.startTime}-{shift.endTime})</option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Employment Type</label>
                    <select
                      value={formData.employmentType}
                      onChange={(e) => setFormData((prev) => ({ ...prev, employmentType: e.target.value as 'permanent' | 'contract' | 'temporary' | 'intern' }))}
                      title="Employment type"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="permanent">Permanent</option>
                      <option value="contract">Contract</option>
                      <option value="temporary">Temporary</option>
                      <option value="intern">Intern</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Joining Date</label>
                    <input
                      type="date"
                      value={formData.joiningDate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, joiningDate: e.target.value }))}
                      title="Joining date"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Basic Salary</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.basicSalary}
                      onChange={(e) => setFormData((prev) => ({ ...prev, basicSalary: e.target.value }))}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.status')}</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' | 'terminated' }))}
                      title="Employee status"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="active">{t('ui.active')}</option>
                      <option value="inactive">{t('ui.inactive')}</option>
                      <option value="terminated">Terminated</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">{t('ui.contactInformation')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.phone')}</label>
                    <input
                      value={formData.phone}
                      onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="+1 (555) 000-0000"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.email')}</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="employee@hospital.com"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Emergency Contact</label>
                    <input
                      value={formData.emergencyContactName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, emergencyContactName: e.target.value }))}
                      placeholder={t('ui.name')}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Emergency Phone</label>
                    <input
                      value={formData.emergencyContactPhone}
                      onChange={(e) => setFormData((prev) => ({ ...prev, emergencyContactPhone: e.target.value }))}
                      placeholder={t('ui.phone')}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Full Address</label>
                    <textarea
                      rows={2}
                      value={formData.address}
                      onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                      placeholder="Street address, city, state, zip"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">Documents</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.profileImage')}</label>
                    <label className="w-full flex items-center justify-end gap-3 px-3.5 py-2.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors bg-white dark:bg-gray-800">
                      <Upload className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-300 truncate font-medium">
                        {profileImageFile ? profileImageFile.name : 'Upload image...'}
                      </span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => setProfileImageFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Contract Document</label>
                    <label className="w-full flex items-center justify-end gap-3 px-3.5 py-2.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors bg-white dark:bg-gray-800">
                      <Upload className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-300 truncate font-medium">
                        {contractFile ? contractFile.name : 'Upload document...'}
                      </span>
                      <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(e) => setContractFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
              <button 
                type="button" 
                onClick={() => setShowModal(false)} 
                className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs"
              >{t('ui.cancel')}</button>
              <button 
                type="submit" 
                disabled={submitting} 
                className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md transition-colors font-medium text-xs shadow-sm flex items-center justify-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('ui.saving')}
                  </>
                ) : (
                  editingId ? t('ui.saveChanges') : 'Create Employee'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

