import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Search, UserCog, Eye, Trash2, X, FileText, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import api from '../../api/axios';
import { useAuth } from '../context/AuthContext';

interface UserManagementProps {
  hospital: Hospital;
  userRole: UserRole;
}

type ManagedUser = {
  id: number;
  hospitalId: number | null;
  hospitalName?: string;
  isDoctor?: boolean;
  phone?: string | null;
  specialization?: string | null;
  registrationNumber?: string | null;
  consultationFee?: number | null;
  doctorStatus?: 'active' | 'inactive' | null;
  name: string;
  email: string;
  role: UserRole;
  roleId?: number | null;
  status: 'active' | 'inactive';
};

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
};

const roleColors: Record<string, string> = {
  super_admin: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
};

type RoleOption = {
  id: number;
  name: string;
  displayName: string;
};

export function UserManagement({ hospital, userRole }: UserManagementProps) {
  const { hasPermission } = useAuth();
  const canAddUsers = hasPermission('add_users') || hasPermission('manage_users');
  const canEditUsers = hasPermission('edit_users') || hasPermission('manage_users');
  const canDeleteUsers = hasPermission('delete_users') || hasPermission('manage_users');
  const canExportUsers = hasPermission('export_users') || hasPermission('manage_users');
  const canViewUsers = hasPermission('view_users') || canAddUsers || canEditUsers || canDeleteUsers;
  const canViewRoles = hasPermission('view_roles') || hasPermission('manage_roles');
  const isSuperAdmin = userRole === 'super_admin';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHospitalFilter, setSelectedHospitalFilter] = useState<string>('all');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [hospitals, setHospitals] = useState<{ id: number; name: string }[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  
  // Sorting state
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    roleId: '' as string,
    hospitalId: hospital.id as string | number | null,
    status: 'active' as const,
    password: '',
    phone: '',
    specialization: '',
    registrationNumber: '',
    consultationFee: '' as string | number,
    doctorStatus: 'active' as 'active' | 'inactive',
  });
  const canManageTarget = (target: ManagedUser) => {
    if (target.role === 'super_admin' && userRole !== 'super_admin') return false;
    return true;
  };

  const getHospitalName = (hospitalId: number | null | undefined) => {
    if (!hospitalId) return 'All Hospitals';
    const hosp = hospitals.find((h) => h.id === hospitalId);
    return hosp ? hosp.name : 'Unknown';
  };

  const getRoleLabel = (roleName: string) => roleLabels[roleName] ?? roleName;
  const getRoleColor = (roleName: string) =>
    roleColors[roleName] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200';

  const selectedRoleName = useMemo(() => {
    if (!formData.roleId) return '';
    const id = Number(formData.roleId);
    const match = roleOptions.find((r) => r.id === id);
    return match?.name ?? '';
  }, [formData.roleId, roleOptions]);

  const effectiveIsDoctor = selectedRoleName === 'doctor';

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getRoleLabel(String(u.role)).toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.status.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesHospital = selectedHospitalFilter === 'all' || `${u.hospitalId ?? ''}` === selectedHospitalFilter;
      const matchesRole = selectedRoleFilter === 'all' || u.role === selectedRoleFilter;

      return matchesSearch && matchesHospital && matchesRole;
    });
  }, [users, searchTerm, selectedHospitalFilter, selectedRoleFilter]);

  const sortedUsers = useMemo(() => {
    const copy = [...filteredUsers];
    return copy.sort((a: any, b: any) => {
      const aValue = a[sortField]?.toString().toLowerCase() || '';
      const bValue = b[sortField]?.toString().toLowerCase() || '';
      return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    });
  }, [filteredUsers, sortDirection, sortField]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-blue-600 dark:text-blue-400" />
      : <ArrowDown className="w-3 h-3 text-blue-600 dark:text-blue-400" />;
  };

  const exportToExcel = () => {
    const workSheet = XLSX.utils.json_to_sheet(sortedUsers.map(u => ({
      Name: u.name,
      Email: u.email,
      Role: getRoleLabel(String(u.role)),
      Status: u.status,
      Hospital: getHospitalName(u.hospitalId)
    })));
    const workBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workBook, workSheet, 'Users');
    XLSX.writeFile(workBook, 'Users_List.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Users Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    if (userRole !== 'super_admin') {
      doc.text(`Hospital: ${hospital.name}`, 14, 36);
    }

    autoTable(doc, {
      head: [['Name', 'Email', 'Role', 'Status', 'Hospital']],
      body: sortedUsers.map(u => [
        u.name,
        u.email,
        getRoleLabel(String(u.role)),
        u.status,
        getHospitalName(u.hospitalId)
      ]),
      startY: userRole !== 'super_admin' ? 46 : 40,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [66, 139, 202] }
    });

    doc.save('Users_Report.pdf');
  };

  useEffect(() => {
    if (userRole === 'super_admin') {
      loadHospitals();
    } else {
      const idNumber = Number(hospital.id);
      setHospitals([{ id: isNaN(idNumber) ? 0 : idNumber, name: hospital.name }]);
      setSelectedHospitalFilter(`${hospital.id}`);
    }
  }, [hospital.id, hospital.name, userRole]);

  useEffect(() => {
    if (!canViewUsers) {
      setAccessDenied(true);
      setUsers([]);
      return;
    }
    setAccessDenied(false);
    loadUsers();
  }, [searchTerm, selectedRoleFilter, selectedHospitalFilter]);

  useEffect(() => {
    const targetHospitalId = userRole === 'super_admin'
      ? String(formData.hospitalId ?? hospital.id)
      : String(hospital.id);

    if (!targetHospitalId || targetHospitalId === 'null' || targetHospitalId === 'undefined') return;
    if (canViewRoles) {
      loadRoleOptions(targetHospitalId);
    } else {
      setRoleOptions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, formData.hospitalId, hospital.id, canViewRoles]);

  const loadHospitals = async () => {
    try {
      const { data } = await api.get('/hospitals');
      const records: any[] = data.data ?? data;
      setHospitals(records.map((h) => ({ id: h.id, name: h.name })));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load hospitals');
      }
    }
  };

  const loadRoleOptions = async (hospitalId: string) => {
    try {
      const params = userRole === 'super_admin' ? { hospital_id: hospitalId } : undefined;
      const { data } = await api.get('/roles', { params });
      const records: any[] = data.data ?? data;
      setRoleOptions(records.map((r) => ({
        id: r.id,
        name: r.name,
        displayName: r.display_name ?? r.displayName,
      })));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load roles');
      }
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      if (searchTerm) params.search = searchTerm;
      if (selectedRoleFilter !== 'all') params.role = selectedRoleFilter;
      if (userRole === 'super_admin' && selectedHospitalFilter !== 'all') params.hospital_id = selectedHospitalFilter;

      const { data } = await api.get('/users', { params });
      const records: any[] = data.data ?? data;
      setUsers(records.map((u) => ({
        id: u.id,
        hospitalId: u.hospital_id ?? null,
        hospitalName: u.hospital?.name,
        isDoctor: Boolean(u.is_doctor),
        phone: u.phone ?? null,
        specialization: u.specialization ?? null,
        registrationNumber: u.registration_number ?? null,
        consultationFee: u.consultation_fee ?? null,
        doctorStatus: u.doctor_status ?? null,
        name: u.name,
        email: u.email,
        role: u.role,
        roleId: u.role_id ?? null,
        status: u.is_active ? 'active' : 'inactive',
      })));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403) {
        setAccessDenied(true);
        setUsers([]);
        return;
      }
      if (status !== 401) {
        toast.error(err?.response?.data?.message || 'Failed to load users');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    if (!canAddUsers) {
      toast.warning('You are not authorized to manage users');
      return;
    }

    if (isSuperAdmin) {
      // Hospitals may have been created/updated in another screen; refresh before showing the modal.
      void loadHospitals();
    }
    setFormData({
      name: '',
      email: '',
      roleId: '',
      // Super admin must explicitly choose the target hospital for tenant users.
      hospitalId: isSuperAdmin ? '' : hospital.id,
      status: 'active',
      password: '',
      phone: '',
      specialization: '',
      registrationNumber: '',
      consultationFee: '',
      doctorStatus: 'active',
    });
    setShowAddModal(true);
  };

  const handleView = (user: ManagedUser) => {
    setSelectedUser(user);
    setShowViewModal(true);
  };

  const handleEdit = (user: ManagedUser) => {
    if (!canEditUsers) {
      toast.warning('You are not authorized to manage users');
      return;
    }
    if (!canManageTarget(user)) {
      toast.warning('Not authorized to edit this user');
      return;
    }

    if (isSuperAdmin) {
      // Ensure dropdown has the latest hospitals list.
      void loadHospitals();
    }
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      roleId: user.roleId ? String(user.roleId) : '',
      hospitalId: user.hospitalId ?? hospital.id,
      status: user.status,
      password: '',
      phone: user.phone ?? '',
      specialization: user.specialization ?? '',
      registrationNumber: user.registrationNumber ?? '',
      consultationFee: user.consultationFee ?? '',
      doctorStatus: user.doctorStatus ?? 'active',
    });
    setShowEditModal(true);
  };

  const handleDelete = (user: ManagedUser) => {
    if (!canDeleteUsers) {
      toast.warning('You are not authorized to manage users');
      return;
    }
    if (!canManageTarget(user)) {
      toast.warning('Not authorized to delete this user');
      return;
    }
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAddUsers) {
      toast.warning('You are not authorized to manage users');
      return;
    }

    if (!formData.roleId) {
      toast.error('Please select a role');
      return;
    }

    if (userRole === 'super_admin' && !formData.hospitalId) {
      toast.error('Please select a hospital');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/users', {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role_id: Number(formData.roleId),
        hospital_id: formData.hospitalId ? Number(formData.hospitalId) : null,
        is_active: formData.status === 'active',
        phone: effectiveIsDoctor ? (formData.phone || null) : null,
        specialization: effectiveIsDoctor ? (formData.specialization || null) : null,
        registration_number: effectiveIsDoctor ? (formData.registrationNumber || null) : null,
        consultation_fee: effectiveIsDoctor
          ? (formData.consultationFee === '' ? null : Number(formData.consultationFee))
          : null,
        doctor_status: effectiveIsDoctor ? formData.doctorStatus : null,
      });
      toast.success('User added successfully');
      setShowAddModal(false);
      await loadUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!canEditUsers) {
      toast.warning('You are not authorized to manage users');
      return;
    }

    if (!formData.roleId) {
      toast.error('Please select a role');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: formData.name,
        email: formData.email,
        role_id: Number(formData.roleId),
        hospital_id: formData.hospitalId ? Number(formData.hospitalId) : null,
        is_active: formData.status === 'active',
        phone: effectiveIsDoctor ? (formData.phone || null) : null,
        specialization: effectiveIsDoctor ? (formData.specialization || null) : null,
        registration_number: effectiveIsDoctor ? (formData.registrationNumber || null) : null,
        consultation_fee: effectiveIsDoctor
          ? (formData.consultationFee === '' ? null : Number(formData.consultationFee))
          : null,
        doctor_status: effectiveIsDoctor ? formData.doctorStatus : null,
      };
      if (formData.password) payload.password = formData.password;

      await api.put(`/users/${selectedUser.id}`, payload);
      toast.success('User updated successfully');
      setShowEditModal(false);
      await loadUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedUser) return;
    if (!canDeleteUsers) {
      toast.warning('You are not authorized to manage users');
      return;
    }
    setSubmitting(true);
    try {
      await api.delete(`/users/${selectedUser.id}`);
      toast.success('User deleted successfully');
      setShowDeleteModal(false);
      await loadUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      {accessDenied ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-200">
          You don’t have permission to view users.
        </div>
      ) : null}
      {/* Compact Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">User Management</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">Manage system users and permissions</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Compact Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users..."
              aria-label="Search users"
              className="w-48 pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Super Admin Filters */}
          {userRole === 'super_admin' && (
            <>
              <select
                value={selectedHospitalFilter}
                onChange={(e) => setSelectedHospitalFilter(e.target.value)}
                aria-label="Filter by hospital"
                className="px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-md text-xs focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Hospitals</option>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                aria-label="Filter by role"
                className="px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-md text-xs focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Roles</option>
                {Object.entries(roleLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </>
          )}

          {/* Action Buttons */}
          {canExportUsers && (
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs font-medium shadow-sm"
              title="Export to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
          )}
          {canExportUsers && (
            <button
              onClick={exportToPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs font-medium shadow-sm"
              title="Export to PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              PDF
            </button>
          )}
          {canAddUsers && (
            <button
              onClick={handleAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add User
            </button>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="overflow-x-auto overflow-y-auto rounded-t-lg max-h-[calc(100vh-220px)]">
          <table className="w-full text-left border-collapse relative">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
              <tr>
                <th onClick={() => handleSort('name')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Name
                    {renderSortIcon('name')}
                  </div>
                </th>
                <th onClick={() => handleSort('email')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Email
                    {renderSortIcon('email')}
                  </div>
                </th>
                <th onClick={() => handleSort('role')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Role
                    {renderSortIcon('role')}
                  </div>
                </th>
                {userRole === 'super_admin' && (
                  <th onClick={() => handleSort('hospitalId')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-center gap-1.5">
                      Hospital
                      {renderSortIcon('hospitalId')}
                    </div>
                  </th>
                )}
                <th onClick={() => handleSort('status')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Status
                    {renderSortIcon('status')}
                  </div>
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedUsers.length > 0 ? (
                sortedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-md flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
                          <UserCog className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <span className="font-semibold text-gray-900 dark:text-white text-xs">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-[10px] text-gray-700 dark:text-gray-300">{user.email}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${getRoleColor(String(user.role))}`}>
                        {getRoleLabel(String(user.role))}
                      </span>
                    </td>
                    {userRole === 'super_admin' && (
                      <td className="px-4 py-2 text-[10px] text-gray-600 dark:text-gray-400">
                        {getHospitalName(user.hospitalId)}
                      </td>
                    )}
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                        user.status === 'active'
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                          : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                      }`}>
                        {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleView(user)}
                          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                          title="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEditUsers && (
                          <button
                            onClick={() => handleEdit(user)}
                            disabled={!canManageTarget(user)}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteUsers && (
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={!canManageTarget(user)}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={userRole === 'super_admin' ? 6 : 5} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                        <Search className="w-6 h-6 text-gray-400 opacity-50" />
                      </div>
                      <p className="text-sm font-medium">No users found</p>
                      <p className="text-xs mt-1">Try adjusting your search filters</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer with totals */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 rounded-b-lg flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
          <span>Total Users: <span className="font-semibold text-gray-900 dark:text-white">{filteredUsers.length}</span></span>
          <span>Showing {sortedUsers.length} of {users.length} users</span>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                {showAddModal ? 'Add New User' : 'Edit User Details'}
              </h2>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }} 
                aria-label="Close"
                title="Close"
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={showAddModal ? handleSubmitAdd : handleSubmitEdit} className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Full Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    aria-label="Full Name"
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    aria-label="Email"
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Role <span className="text-red-500">*</span></label>
                  <select
                    value={formData.roleId}
                    onChange={(e) => {
                      const nextRoleId = e.target.value;
                      const nextRoleName = roleOptions.find((r) => String(r.id) === nextRoleId)?.name ?? '';
                      const isDoctorRole = nextRoleName === 'doctor';
                      setFormData({
                        ...formData,
                        roleId: nextRoleId,
                        phone: isDoctorRole ? formData.phone : '',
                        specialization: isDoctorRole ? formData.specialization : '',
                        registrationNumber: isDoctorRole ? formData.registrationNumber : '',
                        consultationFee: isDoctorRole ? formData.consultationFee : '',
                        doctorStatus: isDoctorRole ? formData.doctorStatus : 'active',
                      });
                    }}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                    aria-label="Role"
                    required
                    disabled={userRole === 'super_admin' && !formData.hospitalId}
                  >
                    <option value="">Select role</option>
                    {roleOptions.map((r) => (
                      <option key={r.id} value={r.id}>{r.displayName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Status <span className="text-red-500">*</span></label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                    aria-label="Status"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Hospital Selection - Only for Super Admin and NOT for super_admin role */}
              {userRole === 'super_admin' && selectedRoleName !== 'super_admin' && (
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Hospital <span className="text-red-500">*</span></label>
                  <select
                    value={formData.hospitalId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hospitalId: e.target.value,
                        roleId: '',
                        phone: '',
                        specialization: '',
                        registrationNumber: '',
                        consultationFee: '',
                        doctorStatus: 'active',
                      })
                    }
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                    aria-label="Hospital"
                    required
                  >
                    <option value="">Select hospital</option>
                    {hospitals.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3" />

              {effectiveIsDoctor && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Phone</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      aria-label="Phone"
                      className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Specialization</label>
                    <input
                      type="text"
                      value={formData.specialization}
                      onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                      aria-label="Specialization"
                      className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Registration Number</label>
                    <input
                      type="text"
                      value={formData.registrationNumber}
                      onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                      aria-label="Registration Number"
                      className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Consultation Fee</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.consultationFee}
                      onChange={(e) => setFormData({ ...formData, consultationFee: e.target.value })}
                      aria-label="Consultation Fee"
                      className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Doctor Status</label>
                    <select
                      value={formData.doctorStatus}
                      onChange={(e) => setFormData({ ...formData, doctorStatus: e.target.value as 'active' | 'inactive' })}
                      className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                      aria-label="Doctor Status"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              )}
              {showAddModal && (
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Password <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    aria-label="Password"
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                    minLength={8}
                  />
                </div>
              )}
              {showEditModal && (
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Password (leave blank to keep)</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    aria-label="Password"
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    minLength={8}
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                  }}
                  className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-xs shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : showAddModal ? 'Create' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          {/* Robust Print Styles */}
          <style>
            {`
              @media print {
                body * {
                  visibility: hidden;
                }
                #user-print-view, #user-print-view * {
                  visibility: visible;
                }
                #user-print-view {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  height: 100%;
                  z-index: 9999;
                  background: white;
                  display: block !important;
                  padding: 40px;
                }
                @page {
                  size: auto;
                  margin: 0;
                }
              }
            `}
          </style>

          {/* Print View Container */}
          <div id="user-print-view" className="hidden">
            <div className="flex items-start justify-between mb-8 border-b-2 border-gray-800 pb-6">
              <div className="flex items-center gap-6">
                {selectedUser.image ? (
                  <img src={selectedUser.image} alt={selectedUser.name} className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
                ) : (
                  <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                    <UserCog className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{selectedUser.name}</h1>
                  <div className="flex items-center gap-3">
                    <span className="text-lg text-gray-600 font-medium">
                      {selectedUser.email}
                    </span>
                    <span className={`px-3 py-1 rounded text-sm font-bold uppercase tracking-wide border ${
                      selectedUser.status === 'active'
                        ? 'text-green-700 border-green-700 bg-green-50'
                        : 'text-red-700 border-red-700 bg-red-50'
                    }`}>
                      {selectedUser.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right text-gray-500">
                <p className="text-sm">Report Generated</p>
                <p className="font-bold text-gray-900 text-lg">{new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* Print Content Grid */}
            <div className="border border-gray-300 rounded-lg p-6 bg-gray-50/50">
              <h3 className="font-bold text-lg text-gray-900 border-b border-gray-300 pb-3 mb-4">
                User Details
              </h3>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Role</label>
                  <p className="text-gray-900 font-bold text-xl">{getRoleLabel(String(selectedUser.role))}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Hospital</label>
                  <p className="text-gray-900 font-medium text-base">{getHospitalName(selectedUser.hospitalId)}</p>
                </div>
              </div>
            </div>

            {/* Print Footer */}
            <div className="fixed bottom-0 left-0 right-0 border-t border-gray-300 pt-4 pb-10 flex justify-between items-center text-sm text-gray-500 px-10 bg-white">
              <p>User Management System Record</p>
              <p>Page 1 of 1</p>
            </div>
          </div>

          {/* Screen Modal */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 print:hidden">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 flex items-center justify-between rounded-t-lg shadow-md z-10">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <UserCog className="w-4 h-4" />
                User Details
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center border border-indigo-200 dark:border-indigo-800 shadow-sm">
                  <UserCog className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedUser.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-medium flex items-center gap-1.5 mt-1">
                    {selectedUser.email}
                  </p>
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Role</label>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${getRoleColor(String(selectedUser.role))}`}>
                      {getRoleLabel(String(selectedUser.role))}
                    </span>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Status</label>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      selectedUser.status === 'active'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                    }`}>
                      {selectedUser.status.charAt(0).toUpperCase() + selectedUser.status.slice(1)}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Hospital</label>
                    <p className="text-xs font-medium text-gray-900 dark:text-white">{getHospitalName(selectedUser.hospitalId)}</p>
                  </div>

                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 px-5 py-3 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="w-full py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-xs shadow-sm"
                >
                  Close Detail View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6 text-center border border-gray-200 dark:border-gray-700">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete User</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete <strong>{selectedUser?.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}