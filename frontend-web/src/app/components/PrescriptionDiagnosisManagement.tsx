import React, { useEffect, useMemo, useState } from 'react';
import { Download, Pencil, Plus, Save, Search, Trash2, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import '../../styles/quill-custom.css';
import api from '../../api/axios';
import { Hospital, UserRole } from '../types';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

interface PrescriptionDiagnosisManagementProps {
  hospital: Hospital;
  userRole?: UserRole;
}

interface PrescriptionDiagnosisTemplate {
  id: string;
  hospitalId: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  createdBy?: string;
  updatedBy?: string;
}

const toPlainText = (html: string) => {
  if (!html) return '';

  const element = document.createElement('div');
  element.innerHTML = html;

  return (element.textContent || element.innerText || '').trim();
};

const normalizeHeader = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

const mapDiagnosis = (record: any): PrescriptionDiagnosisTemplate => ({
  id: String(record.id),
  hospitalId: String(record.hospital_id),
  name: String(record.name ?? ''),
  description: String(record.description ?? ''),
  status: (record.status ?? 'active') as 'active' | 'inactive',
  createdBy: record.created_by ?? undefined,
  updatedBy: record.updated_by ?? undefined,
});

export function PrescriptionDiagnosisManagement({ hospital, userRole = 'admin' }: PrescriptionDiagnosisManagementProps) {
  const { selectedHospitalId, setSelectedHospitalId, currentHospital } = useHospitalFilter(hospital, userRole);
  const { hasPermission } = useAuth();

  const canManage =
    hasPermission('manage_prescription_diagnoses') ||
    hasPermission('add_prescription_diagnoses') ||
    hasPermission('edit_prescription_diagnoses') ||
    hasPermission('delete_prescription_diagnoses') ||
    hasPermission('manage_prescriptions') ||
    hasPermission('add_prescriptions') ||
    hasPermission('edit_prescriptions') ||
    hasPermission('delete_prescriptions');

  const [templates, setTemplates] = useState<PrescriptionDiagnosisTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importKey, setImportKey] = useState(0);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const itemsPerPage = 10;

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setStatus('active');
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/prescription-diagnoses', {
        params: {
          hospital_id: currentHospital.id,
        },
      });

      const records: any[] = data.data ?? data;
      setTemplates(records.map(mapDiagnosis));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load diagnosis templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [currentHospital.id]);

  const filteredTemplates = useMemo(() => {
    const term = search.trim().toLowerCase();

    return templates.filter((template) => {
      const matchesStatus = statusFilter === 'all' || template.status === statusFilter;
      if (!matchesStatus) return false;

      if (!term) return true;

      return (
        template.name.toLowerCase().includes(term) ||
        toPlainText(template.description).toLowerCase().includes(term) ||
        template.status.toLowerCase().includes(term)
      );
    });
  }, [templates, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTemplates.length / itemsPerPage));
  const paginatedTemplates = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTemplates.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTemplates, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, currentHospital.id]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startEdit = (template: PrescriptionDiagnosisTemplate) => {
    setEditingId(template.id);
    setName(template.name);
    setDescription(template.description || '');
    setStatus(template.status);
  };

  const handleSave = async () => {
    if (!canManage) {
      toast.error('You are not authorized to manage diagnosis templates');
      return;
    }

    if (!name.trim()) {
      toast.error('Diagnosis name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        hospital_id: currentHospital.id,
        name: name.trim(),
        description: description.trim() || null,
        status,
      };

      if (editingId) {
        await api.put(`/prescription-diagnoses/${editingId}`, payload);
        toast.success('Diagnosis template updated');
      } else {
        await api.post('/prescription-diagnoses', payload);
        toast.success('Diagnosis template created');
      }

      await loadTemplates();
      resetForm();
    } catch (error: any) {
      const validation = error?.response?.data?.errors;
      const validationMessage = validation ? Object.values(validation).flat().join(' ') : null;
      toast.error(validationMessage || error?.response?.data?.message || 'Failed to save diagnosis template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!canManage) {
      toast.error('You are not authorized to delete diagnosis templates');
      return;
    }

    if (!window.confirm('Delete this diagnosis template?')) return;

    try {
      await api.delete(`/prescription-diagnoses/${templateId}`);
      toast.success('Diagnosis template deleted');
      if (editingId === templateId) {
        resetForm();
      }
      await loadTemplates();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete diagnosis template');
    }
  };

  const handleExport = () => {
    const rows = filteredTemplates.map((template) => ({
      Name: template.name,
      DescriptionHtml: template.description || '',
      DescriptionText: toPlainText(template.description || ''),
      Status: template.status,
    }));

    const sheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Name: '', DescriptionHtml: '', DescriptionText: '', Status: '' }]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Diagnoses');

    const hospitalName = currentHospital.name.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    XLSX.writeFile(book, `Prescription_Diagnoses_${hospitalName || 'Hospital'}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const rows = [
      {
        Name: 'Hypertension',
        DescriptionHtml: '<p><strong>Clinical Notes:</strong> Persistent elevated blood pressure.</p><p>Monitor BP regularly and reduce salt intake.</p>',
        Status: 'active',
      },
      {
        Name: 'Gastritis',
        DescriptionHtml: '<p><strong>C/C:</strong> Epigastric pain and bloating.</p><p>Avoid spicy food and take medicine after meal.</p>',
        Status: 'active',
      },
    ];

    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Template');
    XLSX.writeFile(book, 'Prescription_Diagnoses_Template.xlsx');
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!canManage) {
      toast.error('You are not authorized to import diagnosis templates');
      return;
    }

    setImporting(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        toast.error('Import file is empty');
        return;
      }

      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

      if (!rawRows.length) {
        toast.error('No rows found in import file');
        return;
      }

      const existingByName = new Map<string, PrescriptionDiagnosisTemplate>();
      templates.forEach((template) => {
        existingByName.set(template.name.trim().toLowerCase(), template);
      });

      let created = 0;
      let updated = 0;
      let invalid = 0;
      let failed = 0;

      for (const rawRow of rawRows) {
        const normalizedRow: Record<string, string> = {};

        Object.entries(rawRow).forEach(([key, value]) => {
          normalizedRow[normalizeHeader(key)] = String(value ?? '').trim();
        });

        const rowName =
          normalizedRow.name ||
          normalizedRow.diagnosis ||
          normalizedRow.diagnosis_name ||
          normalizedRow.title ||
          '';

        const rowDescription =
          normalizedRow.descriptionhtml ||
          normalizedRow.description ||
          normalizedRow.diagnosis_description ||
          normalizedRow.details ||
          normalizedRow.content ||
          '';

        const rowStatus = String(normalizedRow.status || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active';

        if (!rowName.trim()) {
          invalid++;
          continue;
        }

        const payload = {
          hospital_id: currentHospital.id,
          name: rowName.trim(),
          description: rowDescription || null,
          status: rowStatus,
        };

        const key = rowName.trim().toLowerCase();
        const existing = existingByName.get(key);

        try {
          if (existing) {
            await api.put(`/prescription-diagnoses/${existing.id}`, payload);
            updated++;
          } else {
            const { data } = await api.post('/prescription-diagnoses', payload);
            const createdTemplate = mapDiagnosis(data.data ?? data);
            existingByName.set(key, createdTemplate);
            created++;
          }
        } catch {
          failed++;
        }
      }

      await loadTemplates();
      toast.success(`Import completed: ${created} created, ${updated} updated, ${invalid} invalid, ${failed} failed`);
    } catch {
      toast.error('Failed to import diagnosis templates');
    } finally {
      setImporting(false);
      setImportKey((previous) => previous + 1);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Prescription Diagnoses</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Manage reusable diagnosis templates for {currentHospital.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            Template
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          {canManage && (
            <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors text-xs font-medium cursor-pointer ${importing ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-orange-600 text-white hover:bg-orange-700'}`}>
              <Upload className="w-3.5 h-3.5" />
              {importing ? 'Importing...' : 'Import'}
              <input
                key={importKey}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImportFile}
                disabled={importing}
              />
            </label>
          )}
          <button
            onClick={resetForm}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            New Diagnosis
          </button>
        </div>
      </div>

      <HospitalSelector userRole={userRole} selectedHospitalId={selectedHospitalId} onHospitalChange={setSelectedHospitalId} />

      <div className="grid grid-cols-1 xl:grid-cols-[34%_66%] gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search diagnoses..."
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
              title="Filter diagnosis status"
              className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="max-h-[62vh] overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 z-10">
                <tr>
                  <th className="px-3 py-2 text-xs font-semibold uppercase">Diagnosis</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase">Status</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-xs text-gray-500">Loading...</td>
                  </tr>
                ) : paginatedTemplates.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-xs text-gray-500">No diagnosis templates found</td>
                  </tr>
                ) : (
                  paginatedTemplates.map((template) => (
                    <tr key={template.id} className="border-t border-gray-100 dark:border-gray-700 align-top">
                      <td className="px-3 py-2">
                        <div className="text-xs font-medium text-gray-900 dark:text-white">{template.name}</div>
                        <div className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{toPlainText(template.description || '') || 'No description'}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${template.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-700'}`}>
                          {template.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => startEdit(template)}
                            className="p-1.5 rounded text-blue-600 hover:bg-blue-50"
                            title="Edit diagnosis"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(template.id)}
                            className="p-1.5 rounded text-red-600 hover:bg-red-50"
                            title="Delete diagnosis"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
            <span>{filteredTemplates.length} total</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40"
              >
                Prev
              </button>
              <span>Page {currentPage} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {editingId ? 'Edit Diagnosis Template' : 'Create Diagnosis Template'}
            </h2>
            {!canManage && <span className="text-[11px] text-amber-600">View-only access</span>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Diagnosis Name</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Hypertension"
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!canManage}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <ReactQuill
              value={description}
              onChange={setDescription}
              placeholder="Enter diagnosis details, chief complaint, and clinical notes..."
              className="custom-quill-editor"
              theme="snow"
              modules={{
                toolbar: [
                  ['bold', 'italic', 'underline'],
                  [{ list: 'ordered' }, { list: 'bullet' }],
                ],
              }}
              readOnly={!canManage}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as 'active' | 'inactive')}
              title="Diagnosis status"
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!canManage}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !canManage}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-xs font-medium"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-xs"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
