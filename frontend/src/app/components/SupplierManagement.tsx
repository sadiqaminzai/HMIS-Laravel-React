import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, FileSpreadsheet, FileText, Pencil, Plus, Search, Trash2, Truck, X, Upload, Download } from 'lucide-react';
import { Hospital, Supplier, UserRole } from '../types';
import { DetailModalHeader } from './ui/ModalParts';
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
  const { t } = useTranslation();
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
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
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

  const sortedSuppliers = useMemo(() => {
    const dir = sortDirection === 'asc' ? 1 : -1;
    const valueOf = (s: Supplier) => {
      switch (sortField) {
        case 'contactInfo': return (s.contactInfo || '').toLowerCase();
        case 'address': return (s.address || '').toLowerCase();
        // Looked up inline: getHospitalName is declared further down the component,
        // and this memo body runs during render before that binding exists.
        case 'hospital': return (hospitals.find((h) => h.id === s.hospitalId)?.name || '').toLowerCase();
        default: return (s.name || '').toLowerCase();
      }
    };
    return [...filteredSuppliers].sort((a, b) => valueOf(a).localeCompare(valueOf(b)) * dir);
  }, [filteredSuppliers, sortField, sortDirection, hospitals]);

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(sortedSuppliers.length / itemsPerPage));

  const paginatedSuppliers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedSuppliers.slice(start, start + itemsPerPage);
  }, [sortedSuppliers, currentPage]);

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
    const workSheet = XLSX.utils.json_to_sheet(sortedSuppliers.map((s) => ({
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
      body: sortedSuppliers.map((s) => [
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
            <button onClick={exportToExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs font-medium shadow-sm" title={t('ui.exportToExcel')}>
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
          )}
          {canExport && (
            <button onClick={exportToPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs font-medium shadow-sm" title={t('ui.exportToPdf')}>
              <FileText className="w-3.5 h-3.5" />
              PDF
            </button>
          )}
          {canImport && (
            <>
              <button
                onClick={downloadImportTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors text-xs font-medium shadow-sm"
                title={t('ui.downloadImportTemplate')}
              >
                <Download className="w-3.5 h-3.5" />{t('ui.template')}</button>
              <button
                onClick={() => importInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-md hover:bg-violet-700 transition-colors text-xs font-medium shadow-sm"
                title="Import suppliers"
              >
                <Upload className="w-3.5 h-3.5" />{t('ui.import')}</button>
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
              <Plus className="w-3.5 h-3.5" />{t('ui.add')}</button>
          )}
        </div>
      </div>

      <HospitalSelector userRole={userRole} selectedHospitalId={selectedHospitalId} onHospitalChange={setSelectedHospitalId} />

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="overflow-x-auto rounded-t-lg max-h-[calc(100vh-220px)] overflow-y-auto">
          <table className="w-full text-left border-collapse relative">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
              <tr>
                {([
                  ['name', 'Name'],
                  ['contactInfo', 'Contact'],
                  ['address', 'Address'],
                  ['hospital', 'Hospital'],
                ] as const).map(([field, label]) => (
                  <th
                    key={field}
                    onClick={() => handleSort(field)}
                    className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      {label}
                      {renderSortIcon(field)}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-center">{t('table.actions')}</th>
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
                        <button onClick={() => handleView(supplier)} className="p-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-200" title={t('ui.view')}>
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button onClick={() => handleEdit(supplier)} className="p-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-200" title={t('ui.edit')}>
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(supplier)} className="p-1.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-200" title={t('ui.delete')}>
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
            >{t('ui.prev')}</button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >{t('ui.next')}</button>
          </div>
        </div>
      </div>

      {/* View Modal */}
      <div className={`fixed inset-0 z-50 ${showViewModal ? 'flex' : 'hidden'} items-center justify-center bg-black/50 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
          <DetailModalHeader
            title="Supplier Details"
            icon={<Truck className="w-4 h-4" />}
            gradient="from-teal-600 to-teal-700"
            onPrint={canPrint ? () => setTimeout(() => window.print(), 100) : undefined}
            onClose={() => setShowViewModal(false)}
          />
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
                  <div className="flex items-center gap-3">
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
                    <p className="text-gray-500">{t('ui.name')}</p>
                    <p className="font-semibold text-gray-900">{selectedSupplier.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Contact</p>
                    <p className="font-semibold text-gray-900">{selectedSupplier.contactInfo || '—'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500">{t('ui.address')}</p>
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
                  <p className="text-gray-500 dark:text-gray-400 text-xs">{t('ui.name')}</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedSupplier.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Contact</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedSupplier.contactInfo || '—'}</p>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">{t('ui.address')}</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedSupplier.address || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">{t('ui.hospital')}</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{getHospitalName(selectedSupplier.hospitalId)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      <div className={`fixed inset-0 z-50 ${showAddModal ? 'flex' : 'hidden'} items-center justify-center bg-black/50 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Add Supplier</h2>
            <button type="button" onClick={() => setShowAddModal(false)} aria-label={t('ui.close')} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form className="p-4 space-y-3" onSubmit={handleSubmitAdd}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5 flex items-center gap-1">{t('ui.supplierName')}<span className="text-red-500">*</span></label>
                <input
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title={t('ui.supplierName')}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.contactInfo')}</label>
                <input
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title={t('ui.contactInfo')}
                  value={formData.contactInfo}
                  onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.address')}</label>
                <textarea
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title={t('ui.address')}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                />
              </div>
              {userRole === 'super_admin' && (
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.hospital')}</label>
                  <select
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    title={t('ui.hospital')}
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
            <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs">{t('ui.cancel')}</button>
              <button type="submit" disabled={submitting} className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-xs disabled:opacity-60 disabled:cursor-not-allowed">
                {submitting ? t('ui.saving') : t('ui.save')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Edit Modal */}
      <div className={`fixed inset-0 z-50 ${showEditModal ? 'flex' : 'hidden'} items-center justify-center bg-black/50 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Edit Supplier</h2>
            <button type="button" onClick={() => setShowEditModal(false)} aria-label={t('ui.close')} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form className="p-4 space-y-3" onSubmit={handleSubmitEdit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5 flex items-center gap-1">{t('ui.supplierName')}<span className="text-red-500">*</span></label>
                <input
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title={t('ui.supplierName')}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.contactInfo')}</label>
                <input
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title={t('ui.contactInfo')}
                  value={formData.contactInfo}
                  onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.address')}</label>
                <textarea
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title={t('ui.address')}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                />
              </div>
              {userRole === 'super_admin' && (
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.hospital')}</label>
                  <select
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    title={t('ui.hospital')}
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
            <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs">{t('ui.cancel')}</button>
              <button type="submit" disabled={submitting} className="px-3 py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed">
                {submitting ? t('ui.saving') : t('ui.update')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Delete Modal */}
      <div className={`fixed inset-0 z-50 ${showDeleteModal ? 'flex' : 'hidden'} items-center justify-center bg-black/50 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Delete Supplier</h3>
            <button onClick={() => setShowDeleteModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label={t('ui.close')}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-3 text-sm text-gray-700 dark:text-gray-200">
            <p>Are you sure you want to delete <strong>{selectedSupplier?.name}</strong>? This action cannot be undone.</p>
            <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs">{t('ui.cancel')}</button>
              <button onClick={handleConfirmDelete} className="px-3 py-2 text-sm rounded-md bg-rose-600 text-white hover:bg-rose-700">{t('ui.delete')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
