import React, { useState, useEffect, useMemo } from 'react';
import { Database, Download, Trash2, RefreshCw, HardDrive, Settings, Save, Clock, Archive } from 'lucide-react';
import api from '../../api/axios';
import { toast } from '../utils/toast';
import { Hospital, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';

interface Backup {
  name: string;
  size: number;
  created_at: number;
  formatted_size: string;
  formatted_date: string;
}

interface BackupSettings {
  enabled: boolean;
  time: string;
  retention: number;
}

interface BackupManagementProps {
  hospital: Hospital | null;
  userRole?: UserRole;
}

export function BackupManagement({ hospital, userRole = 'admin' }: BackupManagementProps) {
  const { hasPermission } = useAuth();
  const canViewBackups = hasPermission('view_backups') || hasPermission('manage_backups') || hasPermission('manage_hospital_settings');
  const canAddBackups = hasPermission('add_backups') || hasPermission('manage_backups') || hasPermission('manage_hospital_settings');
  const canEditBackups = hasPermission('edit_backups') || hasPermission('manage_backups') || hasPermission('manage_hospital_settings');
  const canDeleteBackups = hasPermission('delete_backups') || hasPermission('manage_backups') || hasPermission('manage_hospital_settings');
  const canDownloadBackups = hasPermission('export_backups') || hasPermission('view_backups') || hasPermission('manage_backups') || hasPermission('manage_hospital_settings');
  const [backups, setBackups] = useState<Backup[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [settings, setSettings] = useState<BackupSettings>({
    enabled: true,
    time: '02:00',
    retention: 30,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Load data
  useEffect(() => {
    if (!hospital || !canViewBackups) return;
    loadBackups();
    loadSettings();
  }, [hospital?.id, userRole, canViewBackups]);

  const resolveHospitalParams = () => {
    if (!hospital || userRole !== 'super_admin') {
      return undefined;
    }
    return { hospital_id: hospital.id };
  };

  const loadBackups = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/backups', {
        params: resolveHospitalParams(),
      });
      setBackups(data);
    } catch (error: any) {
      console.error('Failed to load backups:', error);
      toast.error(error?.response?.data?.message || 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const { data } = await api.get('/backups/settings', {
        params: resolveHospitalParams(),
      });
      setSettings({
        enabled: Boolean(data.enabled),
        time: data.time || '02:00',
        retention: Number(data.retention ?? 30),
      });
    } catch (error: any) {
      console.error('Failed to load backup settings:', error);
      // Don't show error toast on load to keep UI clean
    }
  };

  const handleCreateBackup = async () => {
    try {
      setCreating(true);
      const { data } = await api.post('/backups', null, {
        params: resolveHospitalParams(),
      });
      toast.success(data.message || 'Backup created successfully');
      await loadBackups();
    } catch (error: any) {
      console.error('Failed to create backup:', error);
      toast.error(error?.response?.data?.message || 'Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      const { data } = await api.put('/backups/settings', settings, {
        params: resolveHospitalParams(),
      });
      setSettings({
        enabled: Boolean(data.enabled),
        time: data.time || '02:00',
        retention: Number(data.retention ?? 30),
      });
      toast.success('Settings saved');
      setShowSettings(false);
    } catch (error: any) {
      console.error('Failed to update backup settings:', error);
      toast.error(error?.response?.data?.message || 'Failed to update settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      const response = await api.get(`/backups/${filename}/download`, {
        responseType: 'blob',
        params: resolveHospitalParams(),
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Failed to download backup:', error);
      toast.error(error?.response?.data?.message || 'Failed to download backup');
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Delete backup "${filename}"?`)) return;

    try {
      await api.delete(`/backups/${filename}`, {
        params: resolveHospitalParams(),
      });
      toast.success('Backup deleted');
      await loadBackups(); // Refresh list
    } catch (error: any) {
      console.error('Failed to delete backup:', error);
      toast.error(error?.response?.data?.message || 'Failed to delete backup');
    }
  };

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(backups.length / itemsPerPage));

  const paginatedBackups = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return backups.slice(start, start + itemsPerPage);
  }, [backups, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Backups
        </h2>
        <div className="flex items-center gap-2">
          {canEditBackups && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-md transition-colors ${
                showSettings 
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="Backup Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={loadBackups}
            disabled={loading || !canViewBackups}
            className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {canAddBackups && (
            <button
              onClick={handleCreateBackup}
              disabled={creating || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5" />
              {creating ? 'Creating...' : 'Create'}
            </button>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row items-end gap-3">
             <div className="flex-1 w-full sm:max-w-xs">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Schedule Time</label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="time"
                  value={settings.time}
                  onChange={(e) => setSettings(prev => ({ ...prev, time: e.target.value }))}
                  aria-label="Backup schedule time"
                  className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="flex-1 w-full sm:max-w-xs">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Retention (Days)</label>
              <div className="relative">
                <Archive className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.retention}
                  onChange={(e) => setSettings(prev => ({ ...prev, retention: parseInt(e.target.value) || 1 }))}
                  aria-label="Backup retention days"
                  className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
             <div className="pb-2 flex items-center gap-2">
               <input
                 type="checkbox"
                 id="auto-backup"
                 checked={settings.enabled}
                 onChange={(e) => setSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                 className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
               />
               <label htmlFor="auto-backup" className="text-sm text-gray-700 dark:text-gray-300 select-none cursor-pointer">Auto-Backup</label>
             </div>
             {canEditBackups && (
               <div className="ml-auto flex items-center">
                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 dark:bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-800 dark:hover:bg-gray-500 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save
                  </button>
               </div>
             )}
          </div>
        </div>
      )}

      {/* Backups List */}
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">File Name</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Date</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Size</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {backups.length === 0 && !loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  <p>No backups found</p>
                </td>
              </tr>
            ) : (
              paginatedBackups.map((backup) => (
                <tr key={backup.name} className="group hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                      <span className="font-medium text-gray-700 dark:text-gray-200 truncate max-w-[200px]" title={backup.name}>
                        {backup.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {backup.formatted_date}
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400 font-mono text-xs">
                    {backup.formatted_size}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {canDownloadBackups && (
                        <button
                          onClick={() => handleDownload(backup.name)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      {canDeleteBackups && (
                        <button
                          onClick={() => handleDelete(backup.name)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
            {loading && (
              <tr>
                 <td colSpan={4} className="px-4 py-8 text-center bg-gray-50/50 dark:bg-gray-800/50">
                    <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                 </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!loading && backups.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
          <span>
            Showing {paginatedBackups.length} of {backups.length}
          </span>
          <div className="flex items-center gap-2">
            <button
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
  );
}
