import React, { useState } from 'react';
import { Plus, Pencil, Search, Pill, Eye, Trash2, X, Printer, FileText, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { mockMedicines, mockManufacturers, mockMedicineTypes, mockHospitals } from '../data/mockData';
import { toast } from 'sonner';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface MedicineManagementProps {
  hospital: Hospital;
  userRole?: UserRole;
}

export function MedicineManagement({ hospital, userRole = 'admin' }: MedicineManagementProps) {
  // Hospital filtering for super_admin with "All Hospitals" support
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<any>(null);
  
  const [medicines, setMedicines] = useState(filterByHospital(mockMedicines));
  
  // Sorting state
  const [sortField, setSortField] = useState<string>('brandName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [formData, setFormData] = useState({
    brandName: '',
    genericName: '',
    dosage: '',
    type: '',
    manufacturerId: '',
    price: '',
    stock: '',
    hospitalId: currentHospital.id // Add hospital selection
  });

  // Update medicines when hospital changes
  React.useEffect(() => {
    setMedicines(filterByHospital(mockMedicines));
  }, [selectedHospitalId, isAllHospitals]);

  // Filter medicines by search term
  const filteredMedicines = medicines.filter(m =>
    m.brandName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort medicines
  const sortedMedicines = [...filteredMedicines].sort((a: any, b: any) => {
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

  const getManufacturerName = (manufacturerId: string) => {
    const manufacturer = mockManufacturers.find(m => m.id === manufacturerId);
    return manufacturer ? manufacturer.name : 'Unknown';
  };

  const exportToExcel = () => {
    const workSheet = XLSX.utils.json_to_sheet(sortedMedicines.map(m => ({
      BrandName: m.brandName,
      GenericName: m.genericName,
      Dosage: m.dosage,
      Type: m.type,
      Manufacturer: getManufacturerName(m.manufacturerId),
      Price: m.price,
      Stock: m.stock,
      Hospital: mockHospitals.find(h => h.id === m.hospitalId)?.name || 'Unknown'
    })));
    const workBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workBook, workSheet, "Medicines");
    XLSX.writeFile(workBook, "Medicines_List.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text('Medicines Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    if (!isAllHospitals) {
      doc.text(`Hospital: ${currentHospital.name}`, 14, 36);
    }

    // Create table
    autoTable(doc, {
      head: [['Brand Name', 'Generic Name', 'Dosage', 'Type', 'Manufacturer', 'Price', 'Stock']],
      body: sortedMedicines.map(m => [
        m.brandName,
        m.genericName,
        m.dosage,
        m.type,
        getManufacturerName(m.manufacturerId),
        m.price.toFixed(2),
        m.stock
      ]),
      startY: isAllHospitals ? 40 : 46,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [66, 139, 202] }
    });

    doc.save('Medicines_Report.pdf');
  };

  const handleAdd = () => {
    setFormData({
      brandName: '',
      genericName: '',
      dosage: '',
      type: '',
      manufacturerId: '',
      price: '',
      stock: '',
      hospitalId: currentHospital.id // Add hospital selection
    });
    setShowAddModal(true);
  };

  const handleView = (medicine: any) => {
    setSelectedMedicine(medicine);
    setShowViewModal(true);
  };

  const handleEdit = (medicine: any) => {
    setSelectedMedicine(medicine);
    setFormData({
      brandName: medicine.brandName,
      genericName: medicine.genericName,
      dosage: medicine.dosage,
      type: medicine.type,
      manufacturerId: medicine.manufacturerId,
      price: medicine.price.toString(),
      stock: medicine.stock.toString(),
      hospitalId: medicine.hospitalId // Load existing hospital
    });
    setShowEditModal(true);
  };

  const handleDelete = (medicine: any) => {
    setSelectedMedicine(medicine);
    setShowDeleteModal(true);
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const newMedicine = {
      id: `med${medicines.length + 1}`,
      hospitalId: formData.hospitalId, // Use selected hospital from form
      brandName: formData.brandName,
      genericName: formData.genericName,
      dosage: formData.dosage,
      type: formData.type,
      manufacturerId: formData.manufacturerId,
      price: parseFloat(formData.price),
      stock: parseInt(formData.stock, 10)
    };
    setMedicines([...medicines, newMedicine]);
    setShowAddModal(false);
    toast.success('Medicine added successfully.');
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedMedicines = medicines.map(m => {
      if (m.id === selectedMedicine.id) {
        return {
          ...m,
          hospitalId: formData.hospitalId, // Use selected hospital from form
          brandName: formData.brandName,
          genericName: formData.genericName,
          dosage: formData.dosage,
          type: formData.type,
          manufacturerId: formData.manufacturerId,
          price: parseFloat(formData.price),
          stock: parseInt(formData.stock, 10)
        };
      }
      return m;
    });
    setMedicines(updatedMedicines);
    setShowEditModal(false);
    toast.success('Medicine updated successfully.');
  };

  const handleConfirmDelete = () => {
    const updatedMedicines = medicines.filter(m => m.id !== selectedMedicine.id);
    setMedicines(updatedMedicines);
    setShowDeleteModal(false);
    toast.success('Medicine deleted successfully.');
  };

  return (
    <div className="space-y-3">
      {/* Compact Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Medicine Management</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Manage medicine inventory for {isAllHospitals ? 'All Hospitals' : currentHospital.name}
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
              placeholder="Search medicines..."
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
          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
      </div>

      {/* Hospital Selector for Super Admin */}
      <HospitalSelector 
        userRole={userRole}
        selectedHospitalId={selectedHospitalId}
        onHospitalChange={setSelectedHospitalId}
      />

      {/* Medicines Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="overflow-x-auto rounded-t-lg" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          <table className="w-full text-left border-collapse relative">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
              <tr>
                <th onClick={() => handleSort('brandName')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Brand Name
                    {renderSortIcon('brandName')}
                  </div>
                </th>
                <th onClick={() => handleSort('genericName')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Generic Name
                    {renderSortIcon('genericName')}
                  </div>
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Dosage</th>
                <th onClick={() => handleSort('type')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Type
                    {renderSortIcon('type')}
                  </div>
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Manufacturer</th>
                <th onClick={() => handleSort('price')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Price
                    {renderSortIcon('price')}
                  </div>
                </th>
                <th onClick={() => handleSort('stock')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Stock
                    {renderSortIcon('stock')}
                  </div>
                </th>
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
                    <td className="px-4 py-2 text-[10px] text-gray-700 dark:text-gray-300">{medicine.genericName}</td>
                    <td className="px-4 py-2 text-[10px] text-gray-700 dark:text-gray-300">{medicine.dosage}</td>
                    <td className="px-4 py-2">
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-medium border border-blue-200 dark:border-blue-800">
                        {medicine.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[10px] text-gray-700 dark:text-gray-300">{getManufacturerName(medicine.manufacturerId)}</td>
                    <td className="px-4 py-2 text-xs font-medium text-gray-900 dark:text-white">{medicine.price.toFixed(2)}</td>
                    <td className="px-4 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                        medicine.stock > 50
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                          : medicine.stock > 20
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                      }`}>
                        {medicine.stock}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleView(medicine)}
                          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                          title="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleEdit(medicine)}
                          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(medicine)}
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
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                        <Search className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium">No medicines found</p>
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
          <span>Total Records: <span className="font-semibold text-gray-900 dark:text-white">{filteredMedicines.length}</span></span>
          <span>Showing {sortedMedicines.length} of {medicines.length} medicines</span>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                {showAddModal ? 'Add New Medicine' : 'Edit Medicine'}
              </h2>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }} 
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={showAddModal ? handleSubmitAdd : handleSubmitEdit} className="p-4 space-y-3">
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
                    {mockHospitals.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Brand Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.brandName}
                    onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Generic Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.genericName}
                    onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Dosage <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.dosage}
                    onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                    placeholder="e.g., 500mg"
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Type <span className="text-red-500">*</span></label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                    required
                  >
                    <option value="">Select Type</option>
                    {mockMedicineTypes.filter(t => t.hospitalId === currentHospital.id && t.status === 'active').map(type => (
                      <option key={type.id} value={type.name}>{type.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Manufacturer <span className="text-red-500">*</span></label>
                  <select
                    value={formData.manufacturerId}
                    onChange={(e) => setFormData({ ...formData, manufacturerId: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                    required
                  >
                    <option value="">Select Manufacturer</option>
                    {mockManufacturers.filter(m => m.hospitalId === currentHospital.id).map(manufacturer => (
                      <option key={manufacturer.id} value={manufacturer.id}>{manufacturer.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Price <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Stock Quantity <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                  }}
                  className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-xs shadow-sm"
                >
                  {showAddModal ? 'Add' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedMedicine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          {/* Robust Print Styles */}
          <style>
            {`
              @media print {
                body * {
                  visibility: hidden;
                }
                #medicine-print-view, #medicine-print-view * {
                  visibility: visible;
                }
                #medicine-print-view {
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
          <div id="medicine-print-view" className="hidden">
            <div className="flex items-start justify-between mb-8 border-b-2 border-gray-800 pb-6">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-green-100 rounded-lg flex items-center justify-center border border-green-200">
                  <Pill className="w-12 h-12 text-green-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{selectedMedicine.brandName}</h1>
                  <div className="flex items-center gap-3">
                    <span className="text-lg text-gray-600 font-medium">
                      {selectedMedicine.genericName}
                    </span>
                    <span className="px-3 py-1 rounded text-sm font-bold uppercase tracking-wide border border-blue-700 bg-blue-50 text-blue-700">
                      {selectedMedicine.type}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right text-gray-500">
                <p className="text-sm">Report Generated</p>
                <p className="font-bold text-gray-900 text-lg">{new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* Print Content Grid */}
            <div className="grid grid-cols-2 gap-8">
              <div className="border border-gray-300 rounded-lg p-6 bg-gray-50/50">
                <h3 className="font-bold text-lg text-gray-900 border-b border-gray-300 pb-3 mb-4">
                  Product Details
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Dosage</label>
                      <p className="text-gray-900 font-medium text-base">{selectedMedicine.dosage}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Stock</label>
                      <p className="text-gray-900 font-medium text-base">{selectedMedicine.stock} Units</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Price</label>
                    <p className="text-gray-900 font-bold text-xl">${selectedMedicine.price.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-300 rounded-lg p-6 bg-gray-50/50">
                <h3 className="font-bold text-lg text-gray-900 border-b border-gray-300 pb-3 mb-4">
                  Manufacturer Info
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Manufacturer</label>
                    <p className="text-gray-900 font-medium text-base">{getManufacturerName(selectedMedicine.manufacturerId)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Print Footer */}
            <div className="fixed bottom-0 left-0 right-0 border-t border-gray-300 pt-4 pb-10 flex justify-between items-center text-sm text-gray-500 px-10 bg-white">
              <p>Medicine Inventory System Record</p>
              <p>Page 1 of 1</p>
            </div>
          </div>

          {/* Screen Modal */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 print:hidden">
            <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-700 px-6 py-3 flex items-center justify-between rounded-t-lg shadow-md z-10">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Pill className="w-4 h-4" />
                Medicine Details
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
                  onClick={() => setShowViewModal(false)}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center border border-green-200 dark:border-green-800 shadow-sm">
                  <Pill className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{selectedMedicine.brandName}</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium flex items-center gap-1 mt-0.5">
                    {selectedMedicine.genericName}
                  </p>
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Type</label>
                    <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-medium">
                      {selectedMedicine.type}
                    </span>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Dosage</label>
                    <p className="text-xs font-medium text-gray-900 dark:text-white">{selectedMedicine.dosage}</p>
                  </div>
                  <div>
                    <div className="mb-4">
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Price</label>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">{selectedMedicine.price.toFixed(2)}</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Manufacturer</label>
                      <p className="text-xs font-medium text-gray-900 dark:text-white">{getManufacturerName(selectedMedicine.manufacturerId)}</p>
                    </div>
                  </div>
                  <div>
                    <div className="mb-4">
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Stock</label>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        selectedMedicine.stock > 50
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : selectedMedicine.stock > 20
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      }`}>
                        {selectedMedicine.stock} Units
                      </span>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Status</label>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                        selectedMedicine.status === 'active' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedMedicine.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                        {selectedMedicine.status || 'Active'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Audit Information */}
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 border border-gray-100 dark:border-gray-700 shadow-sm">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2 border-b border-gray-200 dark:border-gray-600 pb-1.5">
                  System Information
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created By</label>
                    <p className="text-xs text-gray-900 dark:text-white font-medium">{selectedMedicine.createdBy || '-'}</p>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created At</label>
                    <p className="text-xs text-gray-900 dark:text-white font-medium">
                      {selectedMedicine.createdAt ? new Date(selectedMedicine.createdAt).toLocaleString() : '-'}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Updated By</label>
                    <p className="text-xs text-gray-900 dark:text-white font-medium">{selectedMedicine.updatedBy || '-'}</p>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Updated At</label>
                    <p className="text-xs text-gray-900 dark:text-white font-medium">
                      {selectedMedicine.updatedAt ? new Date(selectedMedicine.updatedAt).toLocaleString() : '-'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="w-full py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-xs shadow-sm"
                >
                  Close Detail View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6 text-center border border-gray-200 dark:border-gray-700">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Medicine</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete {selectedMedicine?.brandName}? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}