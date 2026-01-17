import React, { useState } from 'react';
import { Plus, Eye, Edit, Trash2, X, Pill, Search, Printer, FileText, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
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
  const canManage = hasPermission('manage_medicine_types');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'view' | 'edit' | 'delete'>('add');
  const [selectedMedicineType, setSelectedMedicineType] = useState<MedicineType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
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

  const getHospitalName = (id: string) => hospitals.find(h => h.id === id)?.name || 'Unknown';

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

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text('Medicine Types Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    if (!isAllHospitals) {
      doc.text(`Hospital: ${currentHospital.name}`, 14, 36);
    }

    // Create table
    autoTable(doc, {
      head: [['Name', 'Description', 'Status']],
      body: sortedMedicineTypes.map(mt => [
        mt.name,
        mt.description || '-',
        mt.status
      ]),
      startY: isAllHospitals ? 40 : 46,
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
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search types..."
              className="w-48 pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

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
          {canManage && (
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
                sortedMedicineTypes.map((medicineType) => (
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
                        {canManage && (
                          <button
                            onClick={() => handleEdit(medicineType)}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canManage && (
                          <button
                            onClick={() => handleDelete(medicineType)}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(medicineType)}
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
          <span>Showing {sortedMedicineTypes.length} of {scopedMedicineTypes.length} types</span>
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
                    <button
                      onClick={() => setTimeout(() => window.print(), 100)}
                      className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                      title="Print"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
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