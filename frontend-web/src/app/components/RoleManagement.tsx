import React, { useState } from 'react';
import { Plus, Pencil, Search, Shield, Eye, Trash2, X } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { toast } from 'sonner';

interface RoleManagementProps {
  hospital: Hospital;
  userRole: UserRole;
}

interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
  status: 'active' | 'inactive';
  isSystem?: boolean;
}

export function RoleManagement({ hospital, userRole }: RoleManagementProps) {
  const initialRoles: Role[] = [
    {
      id: '1',
      name: 'super_admin',
      displayName: 'Super Admin',
      description: 'Full system access across all hospitals',
      permissions: ['all'],
      status: 'active',
      isSystem: true
    },
    {
      id: '2',
      name: 'admin',
      displayName: 'Admin',
      description: 'Hospital administrator with full hospital access',
      permissions: ['manage_users', 'manage_doctors', 'manage_patients', 'manage_prescriptions', 'manage_medicines', 'view_reports'],
      status: 'active',
      isSystem: true
    },
    {
      id: '3',
      name: 'doctor',
      displayName: 'Doctor',
      description: 'Medical doctor who creates prescriptions',
      permissions: ['create_prescription', 'view_patients', 'view_medicines'],
      status: 'active',
      isSystem: true
    },
    {
      id: '4',
      name: 'pharmacist',
      displayName: 'Pharmacist',
      description: 'Pharmacy staff who manages medicines',
      permissions: ['manage_medicines', 'view_prescriptions', 'dispense_medicines'],
      status: 'active',
      isSystem: true
    },
    {
      id: '5',
      name: 'staff',
      displayName: 'Staff',
      description: 'Reception and support staff',
      permissions: ['register_patients', 'view_patients', 'schedule_appointments'],
      status: 'active',
      isSystem: true
    }
  ];

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roles, setRoles] = useState(initialRoles);
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    permissions: [] as string[],
    status: 'active' as const
  });

  const availablePermissions = [
    { id: 'manage_users', name: 'Manage Users', category: 'User Management' },
    { id: 'manage_doctors', name: 'Manage Doctors', category: 'User Management' },
    { id: 'manage_patients', name: 'Manage Patients', category: 'Patient Management' },
    { id: 'register_patients', name: 'Register Patients', category: 'Patient Management' },
    { id: 'view_patients', name: 'View Patients', category: 'Patient Management' },
    { id: 'create_prescription', name: 'Create Prescription', category: 'Prescription' },
    { id: 'view_prescriptions', name: 'View Prescriptions', category: 'Prescription' },
    { id: 'manage_prescriptions', name: 'Manage Prescriptions', category: 'Prescription' },
    { id: 'manage_medicines', name: 'Manage Medicines', category: 'Pharmacy' },
    { id: 'view_medicines', name: 'View Medicines', category: 'Pharmacy' },
    { id: 'dispense_medicines', name: 'Dispense Medicines', category: 'Pharmacy' },
    { id: 'view_reports', name: 'View Reports', category: 'Reports' },
    { id: 'manage_reports', name: 'Manage Reports', category: 'Reports' },
    { id: 'schedule_appointments', name: 'Schedule Appointments', category: 'Appointments' },
  ];

  const filteredRoles = roles.filter(r =>
    r.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // If current user is admin (not super_admin), hide super_admin role
  const visibleRoles = userRole === 'admin' 
    ? filteredRoles.filter(r => r.name !== 'super_admin')
    : filteredRoles;

  const handleAdd = () => {
    setFormData({
      name: '',
      displayName: '',
      description: '',
      permissions: [],
      status: 'active'
    });
    setShowAddModal(true);
  };

  const handleView = (role: Role) => {
    setSelectedRole(role);
    setShowViewModal(true);
  };

  const handleEdit = (role: Role) => {
    if (role.isSystem) {
      toast.warning('System roles cannot be edited.');
      return;
    }
    setSelectedRole(role);
    setFormData({
      name: role.name,
      displayName: role.displayName,
      description: role.description,
      permissions: role.permissions,
      status: role.status
    });
    setShowEditModal(true);
  };

  const handleDelete = (role: Role) => {
    if (role.isSystem) {
      toast.warning('System roles cannot be deleted.');
      return;
    }
    setSelectedRole(role);
    setShowDeleteModal(true);
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const newRole: Role = {
      id: `${roles.length + 1}`,
      name: formData.name.toLowerCase().replace(/\s+/g, '_'),
      displayName: formData.displayName,
      description: formData.description,
      permissions: formData.permissions,
      status: formData.status,
      isSystem: false
    };
    setRoles([...roles, newRole]);
    setShowAddModal(false);
    toast.success('Role added successfully.');
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedRoles = roles.map(r => {
      if (r.id === selectedRole?.id) {
        return {
          ...r,
          displayName: formData.displayName,
          description: formData.description,
          permissions: formData.permissions,
          status: formData.status
        };
      }
      return r;
    });
    setRoles(updatedRoles);
    setShowEditModal(false);
    toast.success('Role updated successfully.');
  };

  const handleConfirmDelete = () => {
    const updatedRoles = roles.filter(r => r.id !== selectedRole?.id);
    setRoles(updatedRoles);
    setShowDeleteModal(false);
    toast.success('Role deleted successfully.');
  };

  const togglePermission = (permissionId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const groupedPermissions = availablePermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, typeof availablePermissions>);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Role Management</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Define and manage user roles</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Role
        </button>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <div className="relative max-w-md">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search roles..."
            className="w-full px-3 py-1.5 pl-8 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
        </div>
      </div>

      {/* Roles Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-700 dark:text-gray-300">Role</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-700 dark:text-gray-300">Description</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-700 dark:text-gray-300">Permissions</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRoles.map((role) => (
                <tr key={role.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                        <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-xs">{role.displayName}</div>
                        {role.isSystem && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">(System)</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <span className="text-xs text-gray-600 dark:text-gray-400">{role.description}</span>
                  </td>
                  <td className="py-2 px-3">
                    <span className="text-xs text-gray-900 dark:text-white">
                      {role.permissions.includes('all') ? 'All Permissions' : `${role.permissions.length} permissions`}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      role.status === 'active'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}>
                      {role.status}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleView(role)}
                        className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="View"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleEdit(role)}
                        className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        title="Edit"
                        disabled={role.isSystem}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(role)}
                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Delete"
                        disabled={role.isSystem}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {visibleRoles.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-xs">
            <p>No roles found.</p>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Add New Role</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmitAdd} className="p-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Role Name</label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Manager"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Describe the role..."
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</label>
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 max-h-64 overflow-y-auto">
                  {Object.entries(groupedPermissions).map(([category, perms]) => (
                    <div key={category} className="mb-3 last:mb-0">
                      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{category}</h4>
                      <div className="space-y-1">
                        {perms.map((perm) => (
                          <label key={perm.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={formData.permissions.includes(perm.id)}
                              onChange={() => togglePermission(perm.id)}
                              className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-xs text-gray-700 dark:text-gray-300">{perm.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Role Details</h2>
              <button onClick={() => setShowViewModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">{selectedRole.displayName}</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{selectedRole.description}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Role ID</label>
                  <span className="text-xs text-gray-900 dark:text-white">{selectedRole.name}</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                    selectedRole.status === 'active'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}>
                    {selectedRole.status}
                  </span>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</label>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {selectedRole.permissions.includes('all') ? (
                    <p className="text-xs text-gray-900 dark:text-white">All System Permissions</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedRole.permissions.map((permId) => {
                        const perm = availablePermissions.find(p => p.id === permId);
                        return perm ? (
                          <span key={permId} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                            {perm.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setShowViewModal(false)}
                className="w-full px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Edit Role</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmitEdit} className="p-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Role Name</label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</label>
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 max-h-64 overflow-y-auto">
                  {Object.entries(groupedPermissions).map(([category, perms]) => (
                    <div key={category} className="mb-3 last:mb-0">
                      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{category}</h4>
                      <div className="space-y-1">
                        {perms.map((perm) => (
                          <label key={perm.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={formData.permissions.includes(perm.id)}
                              onChange={() => togglePermission(perm.id)}
                              className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-xs text-gray-700 dark:text-gray-300">{perm.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Confirm Delete</h2>
              <button onClick={() => setShowDeleteModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to delete role <span className="font-semibold text-gray-900 dark:text-white">{selectedRole.displayName}</span>? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}