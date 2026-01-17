import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, FileSpreadsheet, FileText, Pencil, Pill, Plus, Search, Trash2, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { useMedicines } from '../context/MedicineContext';
import { useManufacturers } from '../context/ManufacturerContext';
import { useMedicineTypes } from '../context/MedicineTypeContext';
import { useHospitals } from '../context/HospitalContext';
import { useAuth } from '../context/AuthContext';
import { Hospital, Medicine, UserRole } from '../types';

interface MedicineManagementProps {
  hospital: Hospital;
  userRole?: UserRole;
}

type SortField = 'brandName' | 'genericName' | 'medicineType' | 'strength';

export function MedicineManagement({ hospital, userRole = 'admin' }: MedicineManagementProps) {
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  const { medicines, addMedicine, updateMedicine, deleteMedicine, loading } = useMedicines();
  const { manufacturers } = useManufacturers();
  const { medicineTypes } = useMedicineTypes();
  const { hospitals } = useHospitals();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_medicines');

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [sortField, setSortField] = useState<SortField>('brandName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [formData, setFormData] = useState({
    brandName: '',
    genericName: '',
    strength: '',
    medicineTypeId: '',
    manufacturerId: '',
    status: 'active' as 'active' | 'inactive',
    hospitalId: currentHospital.id,
  });

  const scopedMedicines = filterByHospital(medicines);
  const scopedManufacturers = filterByHospital(manufacturers);
  const scopedMedicineTypes = filterByHospital(medicineTypes);

  const getHospitalName = (id: string) => hospitals.find((h) => h.id === id)?.name || 'Unknown';
  const getMedicineTypeName = (id: string) => scopedMedicineTypes.find((t) => t.id === id)?.name || 'N/A';
  const getManufacturerName = (id: string) => scopedManufacturers.find((m) => m.id === id)?.name || 'N/A';

  const filteredMedicines = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return scopedMedicines.filter((m) =>
      m.brandName.toLowerCase().includes(term) ||
      m.genericName.toLowerCase().includes(term) ||
      getMedicineTypeName(m.medicineTypeId).toLowerCase().includes(term) ||
      getManufacturerName(m.manufacturerId).toLowerCase().includes(term)
    );
  }, [scopedMedicines, searchTerm, scopedManufacturers, scopedMedicineTypes]);

  const sortedMedicines = useMemo(() => {
    const sortValue = (m: Medicine) => {
      switch (sortField) {
        case 'brandName':
          return m.brandName.toLowerCase();
        case 'genericName':
          return m.genericName.toLowerCase();
        case 'medicineType':
          return getMedicineTypeName(m.medicineTypeId).toLowerCase();
        case 'strength':
          return (m.strength || '').toLowerCase();
        default:
          return '';
      }
    };
    return [...filteredMedicines].sort((a, b) => {
      const aVal = sortValue(a);
      const bVal = sortValue(b);
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDirection === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filteredMedicines, sortField, sortDirection, scopedMedicineTypes, scopedManufacturers]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-60" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 text-blue-600 dark:text-blue-400" />
      : <ArrowDown className="w-3 h-3 text-blue-600 dark:text-blue-400" />;
  };

  const exportToExcel = () => {
    const workSheet = XLSX.utils.json_to_sheet(sortedMedicines.map((m) => ({
      BrandName: m.brandName,
      GenericName: m.genericName,
      Strength: m.strength,
      Type: getMedicineTypeName(m.medicineTypeId),
      Manufacturer: getManufacturerName(m.manufacturerId),
      Status: m.status,
      Hospital: getHospitalName(m.hospitalId),
    })));
    const workBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workBook, workSheet, 'Medicines');
    XLSX.writeFile(workBook, 'Medicines_List.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Medicines Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    if (!isAllHospitals) {
      doc.text(`Hospital: ${currentHospital.name}`, 14, 36);
    }

    autoTable(doc, {
      head: [['Brand', 'Generic', 'Strength', 'Type', 'Manufacturer', 'Status']],
      body: sortedMedicines.map((m) => [
        m.brandName,
        m.genericName,
        m.strength,
        getMedicineTypeName(m.medicineTypeId),
        getManufacturerName(m.manufacturerId),
        m.status,
      ]),
      startY: isAllHospitals ? 40 : 46,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [66, 139, 202] },
    });

    doc.save('Medicines_Report.pdf');
  };

  const handleAdd = () => {
    const targetHospitalId = userRole === 'super_admin' && selectedHospitalId !== 'all'
      ? selectedHospitalId
      : currentHospital.id;
    setFormData({
      brandName: '',
      genericName: '',
      strength: '',
      medicineTypeId: '',
      manufacturerId: '',
      status: 'active',
      hospitalId: targetHospitalId,
    });
    setShowAddModal(true);
  };

  const handleView = (medicine: Medicine) => {
    setSelectedMedicine(medicine);
    setShowViewModal(true);
  };

  const handleEdit = (medicine: Medicine) => {
    setSelectedMedicine(medicine);
    setFormData({
      brandName: medicine.brandName,
      genericName: medicine.genericName,
      strength: medicine.strength || '',
      medicineTypeId: medicine.medicineTypeId,
      manufacturerId: medicine.manufacturerId,
      status: medicine.status,
      hospitalId: medicine.hospitalId,
    });
    setShowEditModal(true);
  };

  const handleDelete = (medicine: Medicine) => {
    setSelectedMedicine(medicine);
    setShowDeleteModal(true);
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.brandName.trim()) {
      toast.error('Brand name is required');
      return;
    }
    setSubmitting(true);
    try {
      await addMedicine({
        hospitalId: formData.hospitalId,
        brandName: formData.brandName,
        genericName: formData.genericName,
        strength: formData.strength,
        medicineTypeId: formData.medicineTypeId,
        manufacturerId: formData.manufacturerId,
        status: formData.status,
      });
      setShowAddModal(false);
      toast.success('Medicine added successfully.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add medicine');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedicine) return;
    if (!formData.brandName.trim()) {
      toast.error('Brand name is required');
      return;
    }
    setSubmitting(true);
    try {
      await updateMedicine({
        id: selectedMedicine.id,
        hospitalId: formData.hospitalId,
        brandName: formData.brandName,
        genericName: formData.genericName,
        strength: formData.strength,
        medicineTypeId: formData.medicineTypeId,
        manufacturerId: formData.manufacturerId,
        status: formData.status,
      });
      setShowEditModal(false);
      toast.success('Medicine updated successfully.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update medicine');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedMedicine) return;
    try {
      await deleteMedicine(selectedMedicine.id);
      setShowDeleteModal(false);
      toast.success('Medicine deleted successfully.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete medicine');
    }
  };

  const hospitalSpecificTypes = scopedMedicineTypes.filter((t) => t.hospitalId === formData.hospitalId && t.status === 'active');
  const hospitalSpecificManufacturers = scopedManufacturers.filter((m) => m.hospitalId === formData.hospitalId);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Medicine Management</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">Manage medicine inventory for {isAllHospitals ? 'All Hospitals' : currentHospital.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search medicines..."
              className="w-48 pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <button onClick={exportToExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs font-medium shadow-sm" title="Export to Excel">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </button>
          <button onClick={exportToPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs font-medium shadow-sm" title="Export to PDF">
            <FileText className="w-3.5 h-3.5" />
            PDF
          </button>
          {canManage && (
            <button onClick={handleAdd} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium shadow-sm">
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          )}
        </div>
      </div>

      <HospitalSelector userRole={userRole} selectedHospitalId={selectedHospitalId} onHospitalChange={setSelectedHospitalId} />

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="overflow-x-auto rounded-t-lg" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          <table className="w-full text-left border-collapse relative">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
              <tr>
                <th onClick={() => handleSort('brandName')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">Brand Name {renderSortIcon('brandName')}</div>
                </th>
                <th onClick={() => handleSort('genericName')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">Generic Name {renderSortIcon('genericName')}</div>
                </th>
                <th onClick={() => handleSort('strength')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">Strength {renderSortIcon('strength')}</div>
                </th>
                <th onClick={() => handleSort('medicineType')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">Type {renderSortIcon('medicineType')}</div>
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Manufacturer</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedMedicines.length > 0 ? (
                sortedMedicines.map((medicine) => (
                  <tr key={medicine.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-md flex items-center justify-center border border-green-200 dark:border-green-800">
                          <Pill className="w-3 h-3 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-xs font-semibold text-gray-900 dark:text-white">{medicine.brandName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{medicine.genericName}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{medicine.strength || '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{getMedicineTypeName(medicine.medicineTypeId)}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{getManufacturerName(medicine.manufacturerId)}</td>
                    <td className="px-4 py-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${medicine.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200'
                      }`}>
                        {medicine.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleView(medicine)} className="p-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-200" title="View">
                          <Eye className="w-4 h-4" />
                        </button>
                        {canManage && (
                          <button onClick={() => handleEdit(medicine)} className="p-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-200" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canManage && (
                          <button onClick={() => handleDelete(medicine)} className="p-1.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-200" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    {loading ? 'Loading medicines...' : 'No medicines found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span>
            Showing <strong>{sortedMedicines.length}</strong> of <strong>{scopedMedicines.length}</strong> medicines {isAllHospitals ? '(all hospitals)' : `for ${currentHospital.name}`}
          </span>
        </div>
      </div>

      {/* View Modal */}
      <div className={`fixed inset-0 z-50 ${showViewModal ? 'flex' : 'hidden'} items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Medicine Details</h3>
            <button onClick={() => setShowViewModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {selectedMedicine && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Brand</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedMedicine.brandName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Generic</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedMedicine.genericName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Strength</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedMedicine.strength || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Type</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{getMedicineTypeName(selectedMedicine.medicineTypeId)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Manufacturer</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{getManufacturerName(selectedMedicine.manufacturerId)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Hospital</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{getHospitalName(selectedMedicine.hospitalId)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Status</p>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${selectedMedicine.status === 'active'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200'
                  }`}>
                    {selectedMedicine.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      <div className={`fixed inset-0 z-50 ${showAddModal ? 'flex' : 'hidden'} items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Add Medicine</h3>
            <button onClick={() => setShowAddModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form className="p-4 space-y-4 max-h-[70vh] overflow-y-auto" onSubmit={handleSubmitAdd}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1">Brand Name <span className="text-red-500">*</span></label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  value={formData.brandName}
                  onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Generic Name</label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  value={formData.genericName}
                  onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Strength</label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  value={formData.strength}
                  onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Type</label>
                <select
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  value={formData.medicineTypeId}
                  onChange={(e) => setFormData({ ...formData, medicineTypeId: e.target.value })}
                  required
                >
                  <option value="">Select type</option>
                  {hospitalSpecificTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Manufacturer</label>
                <select
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  value={formData.manufacturerId}
                  onChange={(e) => setFormData({ ...formData, manufacturerId: e.target.value })}
                >
                  <option value="">Select manufacturer</option>
                  {hospitalSpecificManufacturers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Status</label>
                <select
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              {userRole === 'super_admin' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Hospital</label>
                  <select
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
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
              <button
                type="submit"
                disabled={submitting}
                className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Edit Modal */}
      <div className={`fixed inset-0 z-50 ${showEditModal ? 'flex' : 'hidden'} items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Edit Medicine</h3>
            <button onClick={() => setShowEditModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form className="p-4 space-y-4 max-h-[70vh] overflow-y-auto" onSubmit={handleSubmitEdit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1">Brand Name <span className="text-red-500">*</span></label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  value={formData.brandName}
                  onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Generic Name</label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  value={formData.genericName}
                  onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Strength</label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  value={formData.strength}
                  onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Type</label>
                <select
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  value={formData.medicineTypeId}
                  onChange={(e) => setFormData({ ...formData, medicineTypeId: e.target.value })}
                  required
                >
                  <option value="">Select type</option>
                  {hospitalSpecificTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Manufacturer</label>
                <select
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  value={formData.manufacturerId}
                  onChange={(e) => setFormData({ ...formData, manufacturerId: e.target.value })}
                >
                  <option value="">Select manufacturer</option>
                  {hospitalSpecificManufacturers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Status</label>
                <select
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              {userRole === 'super_admin' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Hospital</label>
                  <select
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
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
              <button
                type="submit"
                disabled={submitting}
                className="px-3 py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
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
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Delete Medicine</h3>
            <button onClick={() => setShowDeleteModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-3 text-sm text-gray-700 dark:text-gray-200">
            <p>Are you sure you want to delete <strong>{selectedMedicine?.brandName}</strong>? This action cannot be undone.</p>
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