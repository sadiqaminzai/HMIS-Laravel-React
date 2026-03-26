import React, { useMemo, useRef, useState } from 'react';
import { Eye, FileSpreadsheet, FileText, Pencil, Plus, Search, Trash2, Truck, X, Upload, Download } from 'lucide-react';
import { Hospital, Supplier, UserRole } from '../types';
import { toast } from 'sonner';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { useSuppliers } from '../context/SupplierContext';
import { useHospitals } from '../context/HospitalContext';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface SupplierManagementProps {
  hospital: Hospital;
  userRole?: UserRole;
}

export function SupplierManagement({ hospital, userRole = 'admin' }: SupplierManagementProps) {
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  const { suppliers, addSupplier, updateSupplier, deleteSupplier, loading } = useSuppliers();
  const { hospitals } = useHospitals();
  const { hasPermission } = useAuth();
  const canAdd = hasPermission('add_suppliers') || hasPermission('manage_suppliers');
  const canEdit = hasPermission('edit_suppliers') || hasPermission('manage_suppliers');
  const canDelete = hasPermission('delete_suppliers') || hasPermission('manage_suppliers');
  const canExport = hasPermission('export_suppliers') || hasPermission('manage_suppliers');
  const canPrint = hasPermission('print_suppliers') || hasPermission('manage_suppliers');
  const canImport = hasPermission('import_suppliers') || hasPermission('manage_suppliers');
  const importInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    contactInfo: '',
    address: '',
    hospitalId: currentHospital.id,
  });

  const scopedSuppliers = filterByHospital(suppliers);

  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return scopedSuppliers.filter((s) =>
      s.name.toLowerCase().includes(term) ||
      (s.contactInfo || '').toLowerCase().includes(term) ||
      (s.address || '').toLowerCase().includes(term)
    );
  }, [scopedSuppliers, searchTerm]);

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / itemsPerPage));

  const paginatedSuppliers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSuppliers.slice(start, start + itemsPerPage);
  }, [filteredSuppliers, currentPage]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedHospitalId]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const getHospital = (id: string) => hospitals.find((h) => h.id === id);
  const getHospitalName = (id: string) => getHospital(id)?.name || 'Unknown';

  const loadImageAsDataUrl = async (url?: string) => {
    if (!url) return undefined;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return undefined;
    }
  };

  const exportToExcel = () => {
    const workSheet = XLSX.utils.json_to_sheet(filteredSuppliers.map((s) => ({
      Name: s.name,
      Contact: s.contactInfo || '',
      Address: s.address || '',
      Hospital: getHospitalName(s.hospitalId),
    })));
    const workBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workBook, workSheet, 'Suppliers');
    XLSX.writeFile(workBook, 'Suppliers_List.xlsx');
  };

  const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

  const readField = (row: Record<string, any>, aliases: string[]) => {
    const map = Object.keys(row).reduce<Record<string, any>>((acc, key) => {
      acc[normalizeKey(key)] = row[key];
      return acc;
    }, {});

    for (const alias of aliases) {
      const value = map[normalizeKey(alias)];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  };

  const resolveImportHospitalId = () => {
    if (userRole === 'super_admin') {
      if (!selectedHospitalId || selectedHospitalId === 'all') {
        toast.error('Please select a specific hospital before importing suppliers.');
        return '';
      }
      return selectedHospitalId;
    }
    return currentHospital.id;
  };

  const downloadImportTemplate = () => {
    const templateRows = [
      { name: 'City Pharma Supply', contact_info: '+93-700000001', address: 'Kabul' },
      { name: 'Health Link Traders', contact_info: '+93-700000002', address: 'Herat' },
    ];
    const sheet = XLSX.utils.json_to_sheet(templateRows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'SuppliersTemplate');
    XLSX.writeFile(book, 'Suppliers_Import_Template.xlsx');
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const hospitalId = resolveImportHospitalId();
    if (!hospitalId) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: '' });

      if (!rows.length) {
        toast.error('Import file is empty.');
        return;
      }

      let success = 0;
      let failed = 0;

      for (const row of rows) {
        const name = readField(row, ['name']);
        const contactInfo = readField(row, ['contact_info', 'contactinfo', 'contact']);
        const address = readField(row, ['address']);

        if (!name) {
          failed++;
          continue;
        }

        try {
          await addSupplier({ hospitalId, name, contactInfo, address });
          success++;
        } catch {
          failed++;
        }
      }

      if (success > 0) {
        toast.success(`Suppliers import completed. Success: ${success}${failed ? `, Failed: ${failed}` : ''}`);
      } else {
        toast.error('No suppliers were imported. Please verify template columns and values.');
      }
    } catch {
      toast.error('Failed to read import file. Please upload a valid CSV or XLSX file.');
    }
  };

  const exportToPDF = async () => {
    const doc = new jsPDF();
    const headerY = 20;
    const logoUrl = !isAllHospitals ? getHospital(currentHospital.id)?.logo : undefined;
    const logoDataUrl = await loadImageAsDataUrl(logoUrl);
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', 14, 12, 16, 16);
    }
    doc.setFontSize(18);
    doc.text('Suppliers Report', logoDataUrl ? 34 : 14, headerY);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    if (!isAllHospitals) {
      doc.text(`Hospital: ${currentHospital.name}`, 14, 36);
      doc.text(`Code: ${getHospital(currentHospital.id)?.code || '—'}`, 14, 42);
    }

    autoTable(doc, {
      head: [['Name', 'Contact', 'Address', 'Hospital']],
      body: filteredSuppliers.map((s) => [
        s.name,
        s.contactInfo || '—',
        s.address || '—',
        getHospitalName(s.hospitalId),
      ]),
      startY: isAllHospitals ? 40 : 50,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [66, 139, 202] },
    });

    doc.save('Suppliers_Report.pdf');
  };

  const handleAdd = () => {
    const targetHospitalId = userRole === 'super_admin' && selectedHospitalId !== 'all'
      ? selectedHospitalId
      : currentHospital.id;

    setFormData({
      name: '',
      contactInfo: '',
      address: '',
      hospitalId: targetHospitalId,
    });
    setShowAddModal(true);
  };

  const handleView = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowViewModal(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name,
      contactInfo: supplier.contactInfo || '',
      address: supplier.address || '',
      hospitalId: supplier.hospitalId,
    });
    setShowEditModal(true);
  };

  const handleDelete = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowDeleteModal(true);
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Supplier name is required');
      return;
    }
    setSubmitting(true);
    try {
      await addSupplier(formData);
      setShowAddModal(false);
      toast.success('Supplier added successfully.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add supplier');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    if (!formData.name.trim()) {
      toast.error('Supplier name is required');
      return;
    }
    setSubmitting(true);
    try {
      await updateSupplier({ id: selectedSupplier.id, ...formData });
      setShowEditModal(false);
      toast.success('Supplier updated successfully.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update supplier');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedSupplier) return;
    try {
      await deleteSupplier(selectedSupplier.id);
      setShowDeleteModal(false);
      toast.success('Supplier deleted successfully.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete supplier');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Supplier Management</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">Manage suppliers for {isAllHospitals ? 'All Hospitals' : currentHospital.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search suppliers..."
              className="w-48 pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          {canExport && (
            <button onClick={exportToExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs font-medium shadow-sm" title="Export to Excel">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
          )}
          {canExport && (
            <button onClick={exportToPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs font-medium shadow-sm" title="Export to PDF">
              <FileText className="w-3.5 h-3.5" />
              PDF
            </button>
          )}
          {canImport && (
            <>
              <button
                onClick={downloadImportTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors text-xs font-medium shadow-sm"
                title="Download import template"
              >
                <Download className="w-3.5 h-3.5" />
                Template
              </button>
              <button
                onClick={() => importInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-md hover:bg-violet-700 transition-colors text-xs font-medium shadow-sm"
                title="Import suppliers"
              >
                <Upload className="w-3.5 h-3.5" />
                Import
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleImportFile}
                className="hidden"
              />
            </>
          )}
          {canAdd && (
            <button onClick={handleAdd} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium shadow-sm">
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          )}
        </div>
      </div>

      <HospitalSelector userRole={userRole} selectedHospitalId={selectedHospitalId} onHospitalChange={setSelectedHospitalId} />

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="overflow-x-auto rounded-t-lg max-h-[calc(100vh-220px)] overflow-y-auto">
          <table className="w-full text-left border-collapse relative">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Name</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Contact</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Address</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Hospital</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSuppliers.length > 0 ? (
                paginatedSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/30 rounded-md flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
                          <Truck className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <span className="text-xs font-semibold text-gray-900 dark:text-white">{supplier.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{supplier.contactInfo || '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{supplier.address || '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{getHospitalName(supplier.hospitalId)}</td>
                    <td className="px-4 py-2 text-xs text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleView(supplier)} className="p-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-200" title="View">
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button onClick={() => handleEdit(supplier)} className="p-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-200" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(supplier)} className="p-1.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-200" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    {loading ? 'Loading suppliers...' : 'No suppliers found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span>
            Showing <strong>{paginatedSuppliers.length}</strong> of <strong>{filteredSuppliers.length}</strong> suppliers {isAllHospitals ? '(all hospitals)' : `for ${currentHospital.name}`}
          </span>
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
      </div>

      {/* View Modal */}
      <div className={`fixed inset-0 z-50 ${showViewModal ? 'flex' : 'hidden'} items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Supplier Details</h3>
            <div className="flex items-center gap-2">
              {canPrint && (
                <button
                  onClick={() => setTimeout(() => window.print(), 100)}
                  className="px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                >
                  Print
                </button>
              )}
              <button onClick={() => setShowViewModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <style>
            {`
              @media print {
                body * { visibility: hidden; }
                #supplier-print-view, #supplier-print-view * { visibility: visible; }
                #supplier-print-view {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  min-height: 100%;
                  padding: 40px;
                  background: white;
                  display: block !important;
                }
                @page { margin: 0; }
              }
            `}
          </style>
          <div id="supplier-print-view" className="hidden">
            {selectedSupplier && (
              <div className="space-y-6">
                <div className="flex items-start justify-between border-b-2 border-gray-800 pb-4">
                  <div className="flex items-center gap-4">
                    {getHospital(selectedSupplier.hospitalId)?.logo && (
                      <img
                        src={getHospital(selectedSupplier.hospitalId)?.logo}
                        alt="Hospital Logo"
                        className="w-16 h-16 object-contain"
                      />
                    )}
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">Supplier Record</h1>
                      <p className="text-sm text-gray-600">Hospital: {getHospitalName(selectedSupplier.hospitalId)}</p>
                      <p className="text-sm text-gray-600">Code: {getHospital(selectedSupplier.hospitalId)?.code || '—'}</p>
                    </div>
                  </div>
                  <div className="text-right text-gray-600 text-sm">
                    <p>Printed on</p>
                    <p className="font-semibold text-gray-900">{new Date().toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6 text-sm">
                  <div>
                    <p className="text-gray-500">Name</p>
                    <p className="font-semibold text-gray-900">{selectedSupplier.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Contact</p>
                    <p className="font-semibold text-gray-900">{selectedSupplier.contactInfo || '—'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500">Address</p>
                    <p className="font-semibold text-gray-900">{selectedSupplier.address || '—'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {selectedSupplier && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Name</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedSupplier.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Contact</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedSupplier.contactInfo || '—'}</p>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Address</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedSupplier.address || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Hospital</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{getHospitalName(selectedSupplier.hospitalId)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      <div className={`fixed inset-0 z-50 ${showAddModal ? 'flex' : 'hidden'} items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Add Supplier</h3>
            <button onClick={() => setShowAddModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form className="p-4 space-y-4" onSubmit={handleSubmitAdd}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1">Supplier Name <span className="text-red-500">*</span></label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  title="Supplier Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Contact Info</label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  title="Contact Info"
                  value={formData.contactInfo}
                  onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Address</label>
                <textarea
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  title="Address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                />
              </div>
              {userRole === 'super_admin' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Hospital</label>
                  <select
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    title="Hospital"
                    value={formData.hospitalId}
                    onChange={(e) => setFormData({ ...formData, hospitalId: e.target.value })}
                    required
                  >
                    <option value="">Select hospital</option>
                    {hospitals.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700">Cancel</button>
              <button type="submit" disabled={submitting} className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed">
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Edit Modal */}
      <div className={`fixed inset-0 z-50 ${showEditModal ? 'flex' : 'hidden'} items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Edit Supplier</h3>
            <button onClick={() => setShowEditModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form className="p-4 space-y-4" onSubmit={handleSubmitEdit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1">Supplier Name <span className="text-red-500">*</span></label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  title="Supplier Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Contact Info</label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  title="Contact Info"
                  value={formData.contactInfo}
                  onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Address</label>
                <textarea
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  title="Address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                />
              </div>
              {userRole === 'super_admin' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Hospital</label>
                  <select
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    title="Hospital"
                    value={formData.hospitalId}
                    onChange={(e) => setFormData({ ...formData, hospitalId: e.target.value })}
                    required
                  >
                    <option value="">Select hospital</option>
                    {hospitals.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowEditModal(false)} className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700">Cancel</button>
              <button type="submit" disabled={submitting} className="px-3 py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed">
                {submitting ? 'Saving...' : 'Update'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Delete Modal */}
      <div className={`fixed inset-0 z-50 ${showDeleteModal ? 'flex' : 'hidden'} items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Delete Supplier</h3>
            <button onClick={() => setShowDeleteModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-3 text-sm text-gray-700 dark:text-gray-200">
            <p>Are you sure you want to delete <strong>{selectedSupplier?.name}</strong>? This action cannot be undone.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowDeleteModal(false)} className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700">Cancel</button>
              <button onClick={handleConfirmDelete} className="px-3 py-2 text-sm rounded-md bg-rose-600 text-white hover:bg-rose-700">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
