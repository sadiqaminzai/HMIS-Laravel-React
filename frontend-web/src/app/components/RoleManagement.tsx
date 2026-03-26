import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Search, Shield, Eye, Trash2, X } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { toast } from 'sonner';
import api from '../../api/axios';
import { useAuth } from '../context/AuthContext';

interface RoleManagementProps {
  hospital: Hospital;
  userRole: UserRole;
}

interface Role {
  id: number;
  name: string;
  displayName: string;
  description: string;
  permissions: number[];
  status: 'active' | 'inactive';
  isSystem?: boolean;
}

interface PermissionOption {
  id: number;
  name: string;
  displayName: string;
  category: string;
}

export function RoleManagement({ hospital, userRole }: RoleManagementProps) {
  const { hasPermission } = useAuth();
  const canAdd = hasPermission('add_roles') || hasPermission('manage_roles');
  const canEdit = hasPermission('edit_roles') || hasPermission('manage_roles');
  const canDelete = hasPermission('delete_roles') || hasPermission('manage_roles');
  const canViewRoles = hasPermission('view_roles') || canAdd || canEdit || canDelete;
  const canLoadPermissionOptions =
    canAdd || canEdit || hasPermission('view_permissions') || hasPermission('manage_permissions');
  const isSuperAdmin = userRole === 'super_admin';
  const [hospitals, setHospitals] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>(hospital?.id ? String(hospital.id) : '');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<PermissionOption[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    permissions: [] as number[],
    status: 'active' as const
  });

  useEffect(() => {
    if (!canViewRoles) {
      return;
    }

    if (canLoadPermissionOptions) {
      loadPermissions();
    }
    if (isSuperAdmin) {
      loadHospitals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!canViewRoles) {
      return;
    }
    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHospitalId, isSuperAdmin, canViewRoles]);

  useEffect(() => {
    if (!isSuperAdmin && hospital?.id) {
      setSelectedHospitalId(String(hospital.id));
    }
  }, [hospital?.id, isSuperAdmin]);

  const loadHospitals = async () => {
    try {
      const { data } = await api.get('/hospitals');
      const records: any[] = data.data ?? data;
      const mapped = records.map((h) => ({ id: h.id, name: h.name }));
      setHospitals(mapped);
      // If there's no selection yet, default to the first hospital.
      if (!selectedHospitalId && mapped.length > 0) {
        setSelectedHospitalId(String(mapped[0].id));
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load hospitals');
    }
  };

  const loadPermissions = async () => {
    try {
      const { data } = await api.get('/permissions', { params: { status: 'active', all: 1 } });
      const records: PermissionOption[] = data.data ?? data;
      setPermissions(records.map((p) => ({
        id: p.id,
        name: p.name,
        displayName: (p as any).display_name ?? p.displayName,
        category: (p as any).category ?? '',
      })));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load permissions');
    }
  };

  const loadRoles = async () => {
    if (!canViewRoles) {
      return;
    }
    try {
      const params = isSuperAdmin
        ? (selectedHospitalId ? { hospital_id: selectedHospitalId } : undefined)
        : undefined;
      const { data } = await api.get('/roles', { params });
      const records: any[] = data.data ?? data;
      setRoles(records.map((r) => ({
        id: r.id,
        name: r.name,
        displayName: r.display_name ?? r.displayName,
        description: r.description,
        permissions: (r.permissions || []).map((p: any) => p.id),
        status: r.status,
        isSystem: r.is_system,
      })));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load roles');
    }
  };

  const filteredRoles = roles.filter(r =>
    r.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const visibleRoles = filteredRoles;

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(visibleRoles.length / itemsPerPage));

  const paginatedRoles = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return visibleRoles.slice(start, start + itemsPerPage);
  }, [visibleRoles, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedHospitalId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleAdd = () => {
    if (!canAdd) {
      toast.warning('Only super admins can manage roles');
      return;
    }
    if (isSuperAdmin && !selectedHospitalId) {
      toast.error('Please select a hospital first');
      return;
    }
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
    if (!canEdit) {
      toast.warning('You are not authorized to manage roles');
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
    if (!canDelete) {
      toast.warning('You are not authorized to manage roles');
      return;
    }
    setSelectedRole(role);
    setShowDeleteModal(true);
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isSuperAdmin && !selectedHospitalId) {
        toast.error('Please select a hospital first');
        return;
      }
      setSubmitting(true);
      await api.post('/roles', {
        name: formData.name.toLowerCase().replace(/\s+/g, '_'),
        display_name: formData.displayName,
        description: formData.description,
        status: formData.status,
        permission_ids: formData.permissions,
        ...(isSuperAdmin ? { hospital_id: Number(selectedHospitalId) } : {}),
      });
      setShowAddModal(false);
      await loadRoles();
      toast.success('Role added successfully.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add role');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    try {
      setSubmitting(true);
      await api.put(`/roles/${selectedRole.id}`, {
        display_name: formData.displayName,
        description: formData.description,
        status: formData.status,
        permission_ids: formData.permissions,
      });
      setShowEditModal(false);
      await loadRoles();
      toast.success('Role updated successfully.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update role');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedRole) return;
    try {
      await api.delete(`/roles/${selectedRole.id}`);
      setShowDeleteModal(false);
      await loadRoles();
      toast.success('Role deleted successfully.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete role');
    }
  };

  const togglePermission = (permissionId: number) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const groupedPermissions = permissions.reduce((acc: Record<string, PermissionOption[]>, perm) => {
    const category = perm.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(perm);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {!canViewRoles ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-200">
          You don’t have permission to view roles.
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Role Management</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Define and manage user roles</p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 dark:text-gray-400">Hospital</span>
              <select
                value={selectedHospitalId}
                onChange={(e) => setSelectedHospitalId(e.target.value)}
                className="px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select hospital</option>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
          )}
          {canAdd && (
            <button
              onClick={handleAdd}
              disabled={isSuperAdmin && !selectedHospitalId}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Role
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          placeholder="Search roles..."
          className="w-full px-3 py-1.5 pl-8 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
        />
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
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
              {paginatedRoles.map((role) => (
                <tr key={role.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                        <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-xs">{role.displayName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <span className="text-xs text-gray-600 dark:text-gray-400">{role.description}</span>
                  </td>
                  <td className="py-2 px-3">
                    <span className="text-xs text-gray-900 dark:text-white">{role.permissions.length} permissions</span>
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
                          {(canEdit || canDelete) && (
                            <>
                              {canEdit && (
                                <button
                                  onClick={() => handleEdit(role)}
                                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => handleDelete(role)}
                                  className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {visibleRoles.length > 0 && (
          <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
            <span>Showing {paginatedRoles.length} of {visibleRoles.length} roles</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
              >
                Prev
              </button>
              <span>Page {currentPage} of {totalPages}</span>
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
                            <span className="text-xs text-gray-700 dark:text-gray-300">{perm.displayName || perm.name}</span>
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
                  disabled={submitting}
                  className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : 'Add Role'}
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
                  <div className="flex flex-wrap gap-1.5">
                    {selectedRole.permissions.map((permId) => {
                      const perm = permissions.find(p => p.id === permId);
                      return perm ? (
                        <span key={permId} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                          {perm.displayName || perm.name}
                        </span>
                      ) : null;
                    })}
                  </div>
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
                  disabled={submitting}
                  className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
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