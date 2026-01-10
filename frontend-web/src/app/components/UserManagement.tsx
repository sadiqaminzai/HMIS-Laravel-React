import React, { useState } from 'react';
import { Plus, Pencil, Search, UserCog, Eye, Trash2, X, Upload, Image as ImageIcon, Printer, FileText, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Hospital, UserRole, User } from '../types';
import { Toast } from './Toast';
import { mockUsers, mockDoctors } from '../data/mockData';
import { mockHospitals } from '../data/mockData';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface UserManagementProps {
  hospital: Hospital;
  userRole: UserRole;
}

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  doctor: 'Doctor',
  receptionist: 'Receptionist',
  pharmacist: 'Pharmacist',
  lab_technician: 'Lab Technician'
};

const roleColors: Record<UserRole, string> = {
  super_admin: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  admin: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  doctor: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  receptionist: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  pharmacist: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
  lab_technician: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
};

export function UserManagement({ hospital, userRole }: UserManagementProps) {
  // For super_admin: show all users from all hospitals
  // For admin: only show users from their hospital (excluding super_admin users)
  let initialUsers = userRole === 'super_admin' 
    ? mockUsers  // Super admin sees all users
    : mockUsers.filter(u => 
        (u.hospitalId === hospital.id || u.hospitalId === '0') && 
        u.role !== 'super_admin'  // Admin cannot see super_admin users
      );

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHospitalFilter, setSelectedHospitalFilter] = useState('all');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'danger' } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Sorting state
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'receptionist' as UserRole,
    hospitalId: hospital.id,
    status: 'active' as const,
    image: '',
    doctorId: ''
  });

  // Get hospital name by ID
  const getHospitalName = (hospitalId: string) => {
    if (hospitalId === '0') return 'All Hospitals';
    const hosp = mockHospitals.find(h => h.id === hospitalId);
    return hosp ? hosp.name : 'Unknown';
  };

  // Filtered users with search, hospital, and role filters
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roleLabels[u.role].toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.status.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesHospital = selectedHospitalFilter === 'all' || u.hospitalId === selectedHospitalFilter;
    const matchesRole = selectedRoleFilter === 'all' || u.role === selectedRoleFilter;
    
    return matchesSearch && matchesHospital && matchesRole;
  });

  // Sort users
  const sortedUsers = [...filteredUsers].sort((a: any, b: any) => {
    const aValue = a[sortField]?.toString().toLowerCase() || '';
    const bValue = b[sortField]?.toString().toLowerCase() || '';
    
    if (sortDirection === 'asc') {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  });

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
      Role: roleLabels[u.role],
      Status: u.status,
      Hospital: getHospitalName(u.hospitalId)
    })));
    const workBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workBook, workSheet, "Users");
    XLSX.writeFile(workBook, "Users_List.xlsx");
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
        roleLabels[u.role],
        u.status,
        getHospitalName(u.hospitalId)
      ]),
      startY: userRole !== 'super_admin' ? 46 : 40,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [66, 139, 202] }
    });

    doc.save('Users_Report.pdf');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        setFormData({ ...formData, image: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdd = () => {
    setFormData({
      name: '',
      email: '',
      role: 'receptionist',
      hospitalId: hospital.id,
      status: 'active',
      image: '',
      doctorId: ''
    });
    setImagePreview(null);
    setShowAddModal(true);
  };

  const handleView = (user: User) => {
    setSelectedUser(user);
    setShowViewModal(true);
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
      status: user.status,
      image: user.image || '',
      doctorId: user.doctorId || ''
    });
    setImagePreview(user.image || null);
    setShowEditModal(true);
  };

  const handleDelete = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser = {
      id: `${users.length + 1}`,
      hospitalId: formData.hospitalId,
      name: formData.name,
      email: formData.email,
      role: formData.role,
      status: formData.status,
      image: formData.image,
      doctorId: formData.role === 'doctor' ? formData.doctorId : undefined
    };
    setUsers([...users, newUser]);
    setShowAddModal(false);
    setImagePreview(null);
    setToast({ message: 'User added successfully.', type: 'success' });
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedUsers = users.map(u => {
      if (u.id === selectedUser?.id) {
        return {
          ...u,
          name: formData.name,
          email: formData.email,
          role: formData.role,
          hospitalId: formData.hospitalId,
          status: formData.status,
          image: formData.image,
          doctorId: formData.role === 'doctor' ? formData.doctorId : undefined
        };
      }
      return u;
    });
    setUsers(updatedUsers);
    setShowEditModal(false);
    setImagePreview(null);
    setToast({ message: 'User updated successfully.', type: 'success' });
  };

  const handleConfirmDelete = () => {
    const updatedUsers = users.filter(u => u.id !== selectedUser?.id);
    setUsers(updatedUsers);
    setShowDeleteModal(false);
    setToast({ message: 'User deleted successfully.', type: 'success' });
  };

  return (
    <div className="space-y-3">
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
              className="w-48 pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Super Admin Filters */}
          {userRole === 'super_admin' && (
            <>
              <select
                value={selectedHospitalFilter}
                onChange={(e) => setSelectedHospitalFilter(e.target.value)}
                className="px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-md text-xs focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Hospitals</option>
                {mockHospitals.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
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
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs font-medium shadow-sm"
            title="Export to Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs font-medium shadow-sm"
            title="Export to PDF"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add User
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="overflow-x-auto rounded-t-lg" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
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
                        <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-md flex items-center justify-center overflow-hidden border border-indigo-200 dark:border-indigo-800">
                          {user.image ? (
                            <img src={user.image} alt={user.name} className="w-full h-full object-cover" />
                          ) : (
                            <UserCog className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          )}
                        </div>
                        <span className="font-semibold text-gray-900 dark:text-white text-xs">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-[10px] text-gray-700 dark:text-gray-300">{user.email}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${roleColors[user.role]}`}>
                        {roleLabels[user.role]}
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
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Role <span className="text-red-500">*</span></label>
                  <select
                    value={formData.role}
                    onChange={(e) => {
                      const newRole = e.target.value as UserRole;
                      setFormData({ 
                        ...formData, 
                        role: newRole,
                        hospitalId: newRole === 'super_admin' ? '0' : (userRole === 'super_admin' ? hospital.id : hospital.id)
                      });
                    }}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                  >
                    <option value="receptionist">Receptionist</option>
                    <option value="doctor">Doctor</option>
                    <option value="pharmacist">Pharmacist</option>
                    <option value="admin">Admin</option>
                    <option value="lab_technician">Lab Technician</option>
                    {userRole === 'super_admin' && <option value="super_admin">Super Admin</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Status <span className="text-red-500">*</span></label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Doctor Selection (Only if Role is Doctor) */}
              {formData.role === 'doctor' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                    Link to Doctor Profile <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.doctorId}
                    onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}
                    className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    required={formData.role === 'doctor'}
                  >
                    <option value="">Select a Doctor Profile...</option>
                    {mockDoctors
                      .filter(d => d.hospitalId === formData.hospitalId && d.status === 'active')
                      .map(doctor => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.name} ({doctor.specialization}) - {doctor.registrationNumber}
                        </option>
                      ))
                    }
                  </select>
                  <p className="text-[9px] text-blue-600 dark:text-blue-400 mt-1">
                    Linking this user account to a Doctor profile ensures they see their assigned patients and appointments.
                  </p>
                </div>
              )}

              {/* Hospital Selection - Only for Super Admin and NOT for super_admin role */}
              {userRole === 'super_admin' && formData.role !== 'super_admin' && (
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Hospital <span className="text-red-500">*</span></label>
                  <select
                    value={formData.hospitalId}
                    onChange={(e) => setFormData({ ...formData, hospitalId: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                    required
                  >
                    {mockHospitals.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Show info message when Super Admin role is selected */}
              {userRole === 'super_admin' && formData.role === 'super_admin' && (
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md">
                  <p className="text-[10px] text-purple-700 dark:text-purple-300">
                    <span className="font-semibold">Note:</span> Super Admin users have access to all hospitals.
                  </p>
                </div>
              )}
              
              {/* User Image - Compact */}
              <div className="bg-gray-50 dark:bg-gray-700/30 p-2 rounded-lg border border-gray-100 dark:border-gray-700 flex items-center gap-3">
                <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 shrink-0">
                    {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                    <ImageIcon className="w-4 h-4 text-gray-400" />
                    )}
                </div>
                <div className="flex-1">
                    <label className="block text-[10px] font-semibold text-gray-700 dark:text-gray-300 mb-0.5">
                    User Image
                    </label>
                    <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm font-medium text-[10px]">
                        <Upload className="w-3 h-3" />
                        Choose
                        <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        />
                    </label>
                    </div>
                </div>
              </div>

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
                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-xs shadow-sm"
                >
                  {showAddModal ? 'Create' : 'Save'}
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
                  <p className="text-gray-900 font-bold text-xl">{roleLabels[selectedUser.role]}</p>
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
                  onClick={() => setTimeout(() => window.print(), 100)}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                  title="Print"
                >
                  <Printer className="w-4 h-4" />
                </button>
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
                <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center overflow-hidden border border-indigo-200 dark:border-indigo-800 shadow-sm">
                  {selectedUser.image ? (
                    <img src={selectedUser.image} alt={selectedUser.name} className="w-full h-full object-cover" />
                  ) : (
                    <UserCog className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                  )}
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
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${roleColors[selectedUser.role]}`}>
                      {roleLabels[selectedUser.role]}
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

                  {/* Show Doctor Link Info if applicable */}
                  {selectedUser.role === 'doctor' && selectedUser.doctorId && (
                    <div className="col-span-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <label className="block text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
                        Linked Doctor Profile
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                          <UserCog className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        </div>
                        <p className="text-xs font-medium text-gray-900 dark:text-white">
                          {mockDoctors.find(d => d.id === selectedUser.doctorId)?.name || 'Unknown Doctor'} 
                          <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">
                             (ID: {selectedUser.doctorId})
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
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
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}