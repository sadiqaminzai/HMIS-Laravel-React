import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Search, Key, Eye, Trash2, X } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { toast } from 'sonner';
import api from '../../api/axios';
import { useAuth } from '../context/AuthContext';

interface PermissionManagementProps {
  hospital: Hospital;
  userRole: UserRole;
}

interface Permission {
  id: number;
  name: string;
  displayName: string;
  category: string;
  description: string;
  status: 'active' | 'inactive';
  isSystem?: boolean;
}

export function PermissionManagement({ hospital, userRole }: PermissionManagementProps) {
  const { hasPermission } = useAuth();
  const canAdd = hasPermission('add_permissions') || hasPermission('manage_permissions');
  const canEdit = hasPermission('edit_permissions') || hasPermission('manage_permissions');
  const canDelete = hasPermission('delete_permissions') || hasPermission('manage_permissions');
  const canImport = hasPermission('import_permissions') || canAdd || canEdit;
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importKey, setImportKey] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    category: '',
    description: '',
    status: 'active' as const
  });

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const { data } = await api.get('/permissions', { params: { all: 1 } });
      const records: any[] = data.data ?? data;
      setPermissions(records.map((p) => ({
        id: p.id,
        name: p.name,
        displayName: p.display_name ?? p.displayName,
        category: p.category || 'General',
        description: p.description ?? '',
        status: p.status,
        isSystem: p.is_system,
      })));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load permissions');
    }
  };

  const categories = ['all', ...Array.from(new Set(permissions.map(p => p.category)))];

  const filteredPermissions = permissions.filter(p => {
    const matchesSearch = p.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const itemsPerPage = 20;
  const totalPages = Math.max(1, Math.ceil(filteredPermissions.length / itemsPerPage));

  const paginatedPermissions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredPermissions.slice(start, start + itemsPerPage);
  }, [filteredPermissions, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const groupedPermissions = paginatedPermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const handleAdd = () => {
    if (!canAdd) {
      toast.warning('You are not authorized to manage permissions');
      return;
    }
    setFormData({
      name: '',
      displayName: '',
      category: '',
      description: '',
      status: 'active'
    });
    setShowAddModal(true);
  };

  const handleView = (permission: Permission) => {
    setSelectedPermission(permission);
    setShowViewModal(true);
  };

  const handleEdit = (permission: Permission) => {
    if (!canEdit) {
      toast.warning('You are not authorized to manage permissions');
      return;
    }
    setSelectedPermission(permission);
    setFormData({
      name: permission.name,
      displayName: permission.displayName,
      category: permission.category,
      description: permission.description,
      status: permission.status
    });
    setShowEditModal(true);
  };

  const handleDelete = (permission: Permission) => {
    if (!canDelete) {
      toast.warning('You are not authorized to manage permissions');
      return;
    }
    setSelectedPermission(permission);
    setShowDeleteModal(true);
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    api.post('/permissions', {
      name: formData.name.toLowerCase().replace(/\s+/g, '_'),
      display_name: formData.displayName,
      category: formData.category,
      description: formData.description,
      status: formData.status,
    })
      .then(() => {
        toast.success('Permission added successfully.');
        setShowAddModal(false);
        loadPermissions();
      })
      .catch((err) => {
        toast.error(err?.response?.data?.message || 'Failed to add permission');
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPermission) return;
    setSubmitting(true);
    api.put(`/permissions/${selectedPermission.id}`, {
      display_name: formData.displayName,
      category: formData.category,
      description: formData.description,
      status: formData.status,
    })
      .then(() => {
        toast.success('Permission updated successfully.');
        setShowEditModal(false);
        loadPermissions();
      })
      .catch((err) => {
        toast.error(err?.response?.data?.message || 'Failed to update permission');
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  const handleConfirmDelete = () => {
    if (!selectedPermission) return;
    api.delete(`/permissions/${selectedPermission.id}`)
      .then(() => {
        toast.success('Permission deleted successfully.');
        setShowDeleteModal(false);
        loadPermissions();
      })
      .catch((err) => {
        toast.error(err?.response?.data?.message || 'Failed to delete permission');
      });
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!canImport) {
      toast.warning('You are not authorized to import permissions');
      return;
    }

    const formPayload = new FormData();
    formPayload.append('file', file);

    setImporting(true);
    try {
      const { data } = await api.post('/permissions/import', formPayload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const created = Number(data?.created ?? 0);
      const skipped = Number(data?.skipped ?? 0);
      toast.success(`Import complete: ${created} created, ${skipped} skipped.`);
      await loadPermissions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to import permissions');
    } finally {
      setImporting(false);
      setImportKey((previous) => previous + 1);
    }
  };

  const handleDownloadTemplate = async () => {
    if (!canImport && !hasPermission('view_permissions')) {
      toast.warning('You are not authorized to download template');
      return;
    }

    setDownloadingTemplate(true);
    try {
      const response = await api.get('/permissions/template-download', {
        responseType: 'blob',
      });

      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', 'PERMISSIONS_IMPORT_TEMPLATE_GROUPED.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Template file not available on server');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Permission Management</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Define and manage system permissions</p>
        </div>
        {(canAdd || canEdit || canDelete || canImport || hasPermission('view_permissions')) && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
              className="px-3 py-1.5 rounded-lg transition-colors text-xs bg-gray-600 text-white hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {downloadingTemplate ? 'Downloading...' : 'Download Template'}
            </button>
            {canImport && (
              <label className={`px-3 py-1.5 rounded-lg transition-colors text-xs cursor-pointer ${importing ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                {importing ? 'Importing...' : 'Upload Excel/CSV'}
                <input
                  key={importKey}
                  type="file"
                  accept=".xlsx,.csv,.txt"
                  className="hidden"
                  onChange={handleImportFile}
                  disabled={importing}
                />
              </label>
            )}
            {canAdd && (
              <button
                onClick={handleAdd}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Permission
              </button>
            )}
          </div>
        )}
      </div>
      {/* Search and Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search permissions..."
              className="w-full px-3 py-1.5 pl-8 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
            />
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
            ))}
          </select>
        </div>
      {/* Permissions by Category */}
      <div className="space-y-3">
        {Object.entries(groupedPermissions).map(([category, perms]) => (
          <div key={category} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-700 px-3 py-2 border-b border-gray-200 dark:border-gray-600">
              <h3 className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                {category} ({perms.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-700 dark:text-gray-300">Permission</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-700 dark:text-gray-300">Description</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-700 dark:text-gray-300">Status</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {perms.map((permission) => (
                    <tr key={permission.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded flex items-center justify-center">
                            <Key className="w-3 h-3 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white text-xs">{permission.displayName}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{permission.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-xs text-gray-600 dark:text-gray-400">{permission.description}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          permission.status === 'active'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}>
                          {permission.status}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleView(permission)}
                            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="View"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleEdit(permission)}
                              disabled={submitting}
                              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(permission)}
                              className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {filteredPermissions.length > 0 && (
        <div className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
          <span>Showing {paginatedPermissions.length} of {filteredPermissions.length} permissions</span>
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

      {filteredPermissions.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">No permissions found.</p>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Add New Permission</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmitAdd} className="p-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Permission Name</label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. View Dashboard"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Dashboard"
                    required
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Describe what this permission allows..."
                  required
                />
              </div>
              <div className="mb-3">
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
                  Add Permission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedPermission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Permission Details</h2>
              <button onClick={() => setShowViewModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <Key className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">{selectedPermission.displayName}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{selectedPermission.name}</p>
                </div>
              </div>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Category</label>
                  <span className="text-xs text-gray-900 dark:text-white">{selectedPermission.category}</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description</label>
                  <p className="text-xs text-gray-900 dark:text-white">{selectedPermission.description}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                    selectedPermission.status === 'active'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}>
                    {selectedPermission.status}
                  </span>
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
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Edit Permission</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmitEdit} className="p-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Permission Name</label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
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
      {showDeleteModal && selectedPermission && (
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
                Are you sure you want to delete permission <span className="font-semibold text-gray-900 dark:text-white">{selectedPermission.displayName}</span>? This action cannot be undone.
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