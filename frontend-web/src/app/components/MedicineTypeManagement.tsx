import React, { useRef, useState } from 'react';
import { Plus, Eye, Edit, Trash2, X, Pill, Search, Printer, FileText, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown, Upload, Download } from 'lucide-react';
import { Hospital, MedicineType, UserRole } from '../types';
import { toast } from 'sonner';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useMedicineTypes } from '../context/MedicineTypeContext';
import { useHospitals } from '../context/HospitalContext';
import { useAuth } from '../context/AuthContext';

interface MedicineTypeManagementProps {
  hospital: Hospital;
  userRole?: UserRole;
}

export function MedicineTypeManagement({ hospital, userRole = 'admin' }: MedicineTypeManagementProps) {
  // Hospital filtering for super_admin with "All Hospitals" support
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  const { medicineTypes, addMedicineType, updateMedicineType, deleteMedicineType, loading } = useMedicineTypes();
  const { hospitals } = useHospitals();
  const { hasPermission } = useAuth();
  const canAdd = hasPermission('add_medicine_types') || hasPermission('manage_medicine_types');
  const canEdit = hasPermission('edit_medicine_types') || hasPermission('manage_medicine_types');
  const canDelete = hasPermission('delete_medicine_types') || hasPermission('manage_medicine_types');
  const canExport = hasPermission('export_medicine_types') || hasPermission('manage_medicine_types');
  const canPrint = hasPermission('print_medicine_types') || hasPermission('manage_medicine_types');
  const canImport = hasPermission('import_medicine_types') || hasPermission('manage_medicine_types');
  const importInputRef = useRef<HTMLInputElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'view' | 'edit' | 'delete'>('add');
  const [selectedMedicineType, setSelectedMedicineType] = useState<MedicineType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  
  // Sorting state
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active' as 'active' | 'inactive',
    hospitalId: currentHospital.id // Add hospital selection
  });

  const getHospital = (id: string) => hospitals.find(h => h.id === id);
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

  const scopedMedicineTypes = filterByHospital(medicineTypes);

  const filteredMedicineTypes = scopedMedicineTypes.filter(mt =>
    mt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (mt.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    mt.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort medicine types
  const sortedMedicineTypes = [...filteredMedicineTypes].sort((a: any, b: any) => {
    const aValue = a[sortField]?.toString().toLowerCase() || '';
    const bValue = b[sortField]?.toString().toLowerCase() || '';
    
    if (sortDirection === 'asc') {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  });

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(sortedMedicineTypes.length / itemsPerPage));

  const paginatedMedicineTypes = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedMedicineTypes.slice(start, start + itemsPerPage);
  }, [sortedMedicineTypes, currentPage]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedHospitalId]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
    const workSheet = XLSX.utils.json_to_sheet(sortedMedicineTypes.map(mt => ({
      Name: mt.name,
      Description: mt.description,
      Status: mt.status,
      Hospital: getHospitalName(mt.hospitalId)
    })));
    const workBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workBook, workSheet, "MedicineTypes");
    XLSX.writeFile(workBook, "MedicineTypes_List.xlsx");
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
        toast.error('Please select a specific hospital before importing medicine types.');
        return '';
      }
      return selectedHospitalId;
    }
    return currentHospital.id;
  };

  const downloadImportTemplate = () => {
    const templateRows = [
      { name: 'Tablet', description: 'Oral solid dosage form', status: 'active' },
      { name: 'Syrup', description: 'Liquid dosage form', status: 'inactive' },
    ];
    const sheet = XLSX.utils.json_to_sheet(templateRows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'MedicineTypeTemplate');
    XLSX.writeFile(book, 'MedicineTypes_Import_Template.xlsx');
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
      const failureReasons: Record<string, number> = {};
      const seenNames = new Set<string>();

      const addFailureReason = (reason: string) => {
        failureReasons[reason] = (failureReasons[reason] ?? 0) + 1;
      };

      const parseStatus = (rawValue: string): 'active' | 'inactive' => {
        const value = rawValue.trim().toLowerCase();
        if (['inactive', '0', 'false', 'no', 'disabled'].includes(value)) {
          return 'inactive';
        }
        return 'active';
      };

      for (const row of rows) {
        const name = readField(row, ['name', 'medicine_type', 'medicinetype', 'type_name', 'typename', 'type']);
        const description = readField(row, ['description']);
        const statusRaw = readField(row, ['status']);
        const status = parseStatus(statusRaw);
        const normalizedName = name.toLowerCase().trim();

        if (!name) {
          failed++;
          addFailureReason('Missing required name column (accepted: name, medicine_type, type_name).');
          continue;
        }

        if (seenNames.has(normalizedName)) {
          failed++;
          addFailureReason(`Duplicate name in file: ${name}`);
          continue;
        }
        seenNames.add(normalizedName);

        try {
          await addMedicineType({ hospitalId, name, description, status });
          success++;
        } catch (error: any) {
          failed++;
          const apiMessage = error?.response?.data?.message;
          const validationItems = error?.response?.data?.errors
            ? Object.values(error.response.data.errors).flat().join(' ')
            : '';

          if (validationItems) {
            addFailureReason(String(validationItems));
          } else if (apiMessage) {
            addFailureReason(String(apiMessage));
          } else {
            addFailureReason('Unknown API validation error while creating medicine type.');
          }
        }
      }

      if (success > 0) {
        toast.success(`Medicine type import completed. Success: ${success}${failed ? `, Failed: ${failed}` : ''}`);
      } else {
        const topReasons = Object.entries(failureReasons)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([reason, count]) => `${reason}${count > 1 ? ` (${count})` : ''}`)
          .join(' | ');

        toast.error(
          topReasons
            ? `No medicine types were imported. ${topReasons}`
            : 'No medicine types were imported. Please verify template columns and values.'
        );
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

    // Add title
    doc.setFontSize(18);
    doc.text('Medicine Types Report', logoDataUrl ? 34 : 14, headerY);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    if (!isAllHospitals) {
      doc.text(`Hospital: ${currentHospital.name}`, 14, 36);
      doc.text(`Code: ${getHospital(currentHospital.id)?.code || '—'}`, 14, 42);
    }

    // Create table
    autoTable(doc, {
      head: [['Name', 'Description', 'Status']],
      body: sortedMedicineTypes.map(mt => [
        mt.name,
        mt.description || '-',
        mt.status
      ]),
      startY: isAllHospitals ? 40 : 50,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [66, 139, 202] }
    });

    doc.save('MedicineTypes_Report.pdf');
  };

  const handleAdd = () => {
    setModalMode('add');
    const targetHospitalId = userRole === 'super_admin' && selectedHospitalId !== 'all'
      ? selectedHospitalId
      : currentHospital.id;
    setFormData({ name: '', description: '', status: 'active', hospitalId: targetHospitalId });
    setShowModal(true);
  };

  const handleView = (medicineType: MedicineType) => {
    setModalMode('view');
    setSelectedMedicineType(medicineType);
    setShowModal(true);
  };

  const handleEdit = (medicineType: MedicineType) => {
    setModalMode('edit');
    setSelectedMedicineType(medicineType);
    setFormData({
      name: medicineType.name,
      description: medicineType.description || '',
      status: medicineType.status,
      hospitalId: medicineType.hospitalId
    });
    setShowModal(true);
  };

  const handleDelete = (medicineType: MedicineType) => {
    setModalMode('delete');
    setSelectedMedicineType(medicineType);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (!formData.name.trim()) {
        toast.error('Please enter medicine type name');
        return;
      }

      if (modalMode === 'add') {
        await addMedicineType({
          hospitalId: formData.hospitalId,
          name: formData.name,
          description: formData.description,
          status: formData.status,
        });
        toast.success('Medicine type added successfully');
      } else if (modalMode === 'edit' && selectedMedicineType) {
        await updateMedicineType({
          id: selectedMedicineType.id,
          hospitalId: formData.hospitalId,
          name: formData.name,
          description: formData.description,
          status: formData.status,
        });
        toast.success('Medicine type updated successfully');
      }

      setShowModal(false);
      const resetHospitalId = userRole === 'super_admin' && selectedHospitalId !== 'all'
        ? selectedHospitalId
        : currentHospital.id;
      setFormData({ name: '', description: '', status: 'active', hospitalId: resetHospitalId });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save medicine type');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = () => {
    if (!selectedMedicineType) return;
    deleteMedicineType(selectedMedicineType.id)
      .then(() => {
        toast.success('Medicine type deleted successfully');
        setShowModal(false);
      })
      .catch((err: any) => {
        toast.error(err?.response?.data?.message || 'Failed to delete medicine type');
      });
  };

  return (
    <div className="space-y-3">
      {/* Compact Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Medicine Types</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Manage medicine type categories for {isAllHospitals ? 'All Hospitals' : currentHospital.name}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Compact Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search types..."
              className="w-48 pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Action Buttons */}
          {canExport && (
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs font-medium shadow-sm"
              title="Export to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
          )}
          {canExport && (
            <button
              onClick={exportToPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs font-medium shadow-sm"
              title="Export to PDF"
            >
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
                title="Import medicine types"
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
            <button
              onClick={handleAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          )}
        </div>
      </div>

      {/* Hospital Selector for Super Admin */}
      <HospitalSelector 
        userRole={userRole}
        selectedHospitalId={selectedHospitalId}
        onHospitalChange={setSelectedHospitalId}
      />

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="overflow-x-auto rounded-t-lg max-h-[calc(100vh-220px)] overflow-y-auto">
          <table className="w-full text-left border-collapse relative">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
              <tr>
                <th onClick={() => handleSort('name')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Name
                    {renderSortIcon('name')}
                  </div>
                </th>
                <th onClick={() => handleSort('description')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Description
                    {renderSortIcon('description')}
                  </div>
                </th>
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
              {sortedMedicineTypes.length > 0 ? (
                paginatedMedicineTypes.map((medicineType) => (
                  <tr key={medicineType.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center">
                          <Pill className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="text-xs font-semibold text-gray-900 dark:text-white">{medicineType.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400 truncate max-w-xs">
                      {medicineType.description || '-'}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                        medicineType.status === 'active'
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                          : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                      }`}>
                        {medicineType.status.charAt(0).toUpperCase() + medicineType.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleView(medicineType)}
                          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                          title="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => handleEdit(medicineType)}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(medicineType)}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
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
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                        <Search className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium">No medicine types found</p>
                      <p className="text-xs mt-1">Try adjusting your search terms</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer with totals */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 rounded-b-lg flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
          <span>Total Records: <span className="font-semibold text-gray-900 dark:text-white">{filteredMedicineTypes.length}</span></span>
          <div className="flex items-center gap-3">
            <span>Showing {paginatedMedicineTypes.length} of {sortedMedicineTypes.length} types</span>
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm transition-all">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md border border-gray-200 dark:border-gray-700 shadow-2xl">
            
            {/* View Modal Header */}
            {modalMode === 'view' && selectedMedicineType && (
               <>
                <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 flex items-center justify-between rounded-t-lg shadow-md z-10 print:hidden">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Pill className="w-4 h-4" />
                    Medicine Type Details
                  </h2>
                  <div className="flex items-center gap-2">
                    {canPrint && (
                      <button
                        onClick={() => setTimeout(() => window.print(), 100)}
                        className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        title="Print"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setShowModal(false)}
                      className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                      title="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Print Styles */}
                <style>
                  {`
                    @media print {
                      body * {
                        visibility: hidden;
                      }
                      #medtype-print-view, #medtype-print-view * {
                        visibility: visible;
                      }
                      #medtype-print-view {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: auto;
                        min-height: 100%;
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
                <div id="medtype-print-view" className="hidden">
                  <div className="flex items-start justify-between mb-8 border-b-2 border-gray-800 pb-6">
                    <div className="flex items-center gap-6">
                      <div className="w-24 h-24 bg-blue-100 rounded-lg flex items-center justify-center border border-blue-200">
                        <Pill className="w-12 h-12 text-blue-600" />
                      </div>
                      <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">{selectedMedicineType.name}</h1>
                        <span className={`px-3 py-1 rounded text-sm font-bold uppercase tracking-wide border ${
                          selectedMedicineType.status === 'active'
                            ? 'text-green-700 border-green-700 bg-green-50'
                            : 'text-red-700 border-red-700 bg-red-50'
                        }`}>
                          {selectedMedicineType.status}
                        </span>
                      </div>
                    </div>
                    <div className="text-right text-gray-500">
                      <p className="text-sm">Report Generated</p>
                      <p className="font-bold text-gray-900 text-lg">{new Date().toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="border border-gray-300 rounded-lg p-6 bg-gray-50/50">
                    <h3 className="font-bold text-lg text-gray-900 border-b border-gray-300 pb-3 mb-4">
                      Description
                    </h3>
                    <p className="text-gray-900 text-base leading-relaxed">
                      {selectedMedicineType.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="fixed bottom-0 left-0 right-0 border-t border-gray-300 pt-4 pb-10 flex justify-between items-center text-sm text-gray-500 px-10 bg-white">
                    <p>Medicine Type Record</p>
                    <p>Page 1 of 1</p>
                  </div>
                </div>

                {/* Screen Content for View Mode */}
                <div className="p-4 print:hidden space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center border border-blue-200 dark:border-blue-800">
                      <Pill className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5">{selectedMedicineType.name}</h3>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                        selectedMedicineType.status === 'active'
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                          : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                      }`}>
                        {selectedMedicineType.status.charAt(0).toUpperCase() + selectedMedicineType.status.slice(1)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                    <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Description</label>
                    <p className="text-xs text-gray-900 dark:text-white leading-relaxed">
                      {selectedMedicineType.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Audit Information */}
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2 border-b border-gray-200 dark:border-gray-600 pb-1.5">
                      System Information
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created By</label>
                        <p className="text-xs text-gray-900 dark:text-white font-medium">{selectedMedicineType.createdBy || '-'}</p>
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created At</label>
                        <p className="text-xs text-gray-900 dark:text-white font-medium">
                          {selectedMedicineType.createdAt ? new Date(selectedMedicineType.createdAt).toLocaleString() : '-'}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Updated By</label>
                        <p className="text-xs text-gray-900 dark:text-white font-medium">{selectedMedicineType.updatedBy || '-'}</p>
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Updated At</label>
                        <p className="text-xs text-gray-900 dark:text-white font-medium">
                          {selectedMedicineType.updatedAt ? new Date(selectedMedicineType.updatedAt).toLocaleString() : '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
                    <button
                        onClick={() => setShowModal(false)}
                        className="w-full py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-xs shadow-sm"
                    >
                        Close
                    </button>
                  </div>
                </div>
               </>
            )}

            {/* Standard Header for Add/Edit/Delete */}
            {modalMode !== 'view' && (
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  {modalMode === 'add' && 'Add Medicine Type'}
                  {modalMode === 'edit' && 'Edit Medicine Type'}
                  {modalMode === 'delete' && 'Delete Medicine Type'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Delete Content */}
            {modalMode === 'delete' && (
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Are you sure you want to delete <strong>{selectedMedicineType?.name}</strong>? This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs font-medium shadow-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            {/* Add/Edit Form */}
            {(modalMode === 'add' || modalMode === 'edit') && (
              <form onSubmit={handleSubmit} className="p-4 space-y-3">
                {/* Hospital Selection for Super Admin */}
                {userRole === 'super_admin' && (
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                      Hospital <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.hospitalId}
                      onChange={(e) => setFormData({ ...formData, hospitalId: e.target.value })}
                      className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                      title="Hospital"
                      required
                    >
                      {hospitals.map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    title="Medicine Type Name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                    title="Description"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                    title="Status"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-xs shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Saving...' : modalMode === 'add' ? 'Add' : 'Save'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}