import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Building2, X, Search, Eye, FileText, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown, Printer } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useHospitals } from '../context/HospitalContext';
import api from '../../api/axios';
import { useAuth } from '../context/AuthContext';

interface HospitalManagementProps {
  userRole: UserRole;
}

type ManagedHospital = Hospital & { id: string };

export function HospitalManagement({ userRole }: HospitalManagementProps) {
  const { hospitals, addHospital, updateHospital, deleteHospital, refresh, loading } = useHospitals();
  const { hasPermission } = useAuth();
  const canAdd = hasPermission('add_hospitals') || hasPermission('manage_hospitals');
  const canEdit = hasPermission('edit_hospitals') || hasPermission('manage_hospitals');
  const canDelete = hasPermission('delete_hospitals') || hasPermission('manage_hospitals');
  const canExport = hasPermission('export_hospitals') || hasPermission('manage_hospitals');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Sorting state
  const [sortField, setSortField] = useState<keyof Hospital>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: '',
    license: '',
    licenseIssueDate: '',
    licenseExpiryDate: '',
    status: 'active' as 'active' | 'suspended',
    logo: '',
    logoFile: null as File | null,
    brandColor: '#2563eb'
  });

  useEffect(() => {
    refresh();
  }, []);

  const filteredHospitals = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    return hospitals.filter((hospital) =>
      [
        hospital.name,
        hospital.code,
        hospital.address,
        hospital.phone,
        hospital.email,
        hospital.license,
        hospital.status,
      ]
        .filter(Boolean)
        .some((field) => field?.toString().toLowerCase().includes(search))
    );
  }, [hospitals, searchTerm]);

  const sortedHospitals = useMemo(() => {
    const copy = [...filteredHospitals];
    const normalize = (value: unknown) => {
      if (value === null || value === undefined) return '';
      if (value instanceof Date) return value.toISOString();
      return value.toString().toLowerCase();
    };

    return copy.sort((a, b) => {
      const aValue = normalize(a[sortField as keyof Hospital]);
      const bValue = normalize(b[sortField as keyof Hospital]);
      return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    });
  }, [filteredHospitals, sortDirection, sortField]);

  const handleSort = (field: keyof Hospital) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: keyof Hospital) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-blue-600 dark:text-blue-400" />
      : <ArrowDown className="w-3 h-3 text-blue-600 dark:text-blue-400" />;
  };

  const handleAdd = () => {
    if (!canAdd) {
      toast.warning('You are not authorized to manage hospitals.');
      return;
    }
    setModalMode('add');
    setFormData({
      name: '',
      code: '',
      address: '',
      phone: '',
      email: '',
      license: '',
      licenseIssueDate: '',
      licenseExpiryDate: '',
      status: 'active',
      logo: '',
      logoFile: null,
      brandColor: '#2563eb'
    });
    setSelectedHospital(null);
    setIsModalOpen(true);
  };

  const handleEdit = (hospital: Hospital) => {
    if (!canEdit) {
      toast.warning('You are not authorized to manage hospitals.');
      return;
    }
    setModalMode('edit');
    setFormData({
      name: hospital.name,
      code: hospital.code,
      address: hospital.address,
      phone: hospital.phone,
      email: hospital.email,
      license: hospital.license,
      licenseIssueDate: hospital.licenseIssueDate,
      licenseExpiryDate: hospital.licenseExpiryDate,
      status: hospital.status,
      logo: hospital.logo || '',
      logoFile: null,
      brandColor: hospital.brandColor || '#2563eb'
    });
    setSelectedHospital(hospital);
    setIsModalOpen(true);
  };

  const handleDelete = (hospital: Hospital) => {
    if (!canDelete) {
      toast.warning('You are not authorized to manage hospitals.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${hospital.name}?`)) return;
    setSubmitting(true);
    deleteHospital(hospital.id)
      .then(() => toast.success('Hospital deleted successfully'))
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to delete hospital'))
      .finally(() => setSubmitting(false));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if ((modalMode === 'add' && !canAdd) || (modalMode === 'edit' && !canEdit)) {
      toast.warning('You are not authorized to manage hospitals.');
      return;
    }

    setSubmitting(true);
    const payload = {
      name: formData.name,
      code: formData.code,
      address: formData.address,
      phone: formData.phone,
      email: formData.email,
      license: formData.license,
      licenseIssueDate: formData.licenseIssueDate,
      licenseExpiryDate: formData.licenseExpiryDate,
      status: formData.status,
      logo: formData.logo,
      logoFile: formData.logoFile,
      brandColor: formData.brandColor,
    };

    const action = modalMode === 'add'
      ? addHospital(payload)
      : selectedHospital
        ? updateHospital({ ...payload, id: selectedHospital.id })
        : Promise.resolve();

    action
      .then(() => {
        toast.success(`Hospital ${modalMode === 'add' ? 'added' : 'updated'} successfully`);
        setIsModalOpen(false);
      })
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to save hospital'))
      .finally(() => setSubmitting(false));
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleView = (hospital: Hospital) => {
    setSelectedHospital(hospital);
    setIsViewModalOpen(true);
  };

  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
  };

  const exportToExcel = () => {
    const workSheet = XLSX.utils.json_to_sheet(sortedHospitals.map(h => ({
      ID: h.id,
      Name: h.name,
      Code: h.code,
      Address: h.address,
      Phone: h.phone,
      Email: h.email,
      License: h.license,
      'License Issue': h.licenseIssueDate,
      'License Expiry': h.licenseExpiryDate,
      Status: h.status
    })));
    const workBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workBook, workSheet, "Hospitals");
    XLSX.writeFile(workBook, "Hospitals_List.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text('Hospitals Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

    // Create table
    autoTable(doc, {
      head: [['ID', 'Name', 'Code', 'Contact', 'License', 'Status']],
      body: sortedHospitals.map(h => [
        h.id,
        h.name,
        h.code,
        `${h.phone}\n${h.email}`,
        `${h.license}\nExp: ${h.licenseExpiryDate}`,
        h.status
      ]),
      startY: 40,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [66, 139, 202] }
    });

    doc.save('Hospitals_Report.pdf');
  };

  return (
    <div className="space-y-3">
      {/* Compact Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Hospital Management</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">Manage all registered hospitals</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Compact Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search hospitals..."
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
          {canAdd && (
            <button
              onClick={handleAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors text-xs font-medium shadow-sm bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="overflow-x-auto rounded-t-lg" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
              <tr>
                <th onClick={() => handleSort('name')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Hospital
                    {renderSortIcon('name')}
                  </div>
                </th>
                <th onClick={() => handleSort('code')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Code
                    {renderSortIcon('code')}
                  </div>
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">
                  Contact
                </th>
                <th onClick={() => handleSort('license')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    License Info
                    {renderSortIcon('license')}
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
              {sortedHospitals.length > 0 ? (
                sortedHospitals.map((hospital) => (
                  <tr key={hospital.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center flex-shrink-0 border border-blue-200 dark:border-blue-800">
                          <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-white text-xs truncate">{hospital.name}</div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{hospital.address}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-[10px] font-mono border border-gray-200 dark:border-gray-600">
                        {hospital.code}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="space-y-0.5">
                        <div className="text-xs text-gray-900 dark:text-white">{hospital.phone}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{hospital.email}</div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="space-y-0.5">
                        <div className="text-xs text-gray-900 dark:text-white font-medium">{hospital.license}</div>
                        <div className="flex gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                          <span>Iss: {hospital.licenseIssueDate}</span>
                          <span>Exp: {hospital.licenseExpiryDate}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                        hospital.status === 'active'
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                          : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                      }`}>
                        {hospital.status.charAt(0).toUpperCase() + hospital.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleEdit(hospital)}
                          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(hospital)}
                          className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleView(hospital)}
                          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                          title="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                        <Search className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium">No hospitals found</p>
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
          <span>Total Records: <span className="font-semibold text-gray-900 dark:text-white">{filteredHospitals.length}</span></span>
          <span>Showing {sortedHospitals.length} of {hospitals.length} hospitals</span>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                {modalMode === 'add' ? 'Add New Hospital' : 'Edit Hospital Details'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Hospital Name */}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                      Hospital Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full pl-8 pr-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="e.g. City General Hospital"
                      />
                    </div>
                  </div>

                  {/* Hospital Code */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                      Hospital Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="e.g. CGH001"
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'suspended' })}
                      className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>

                  {/* Brand Color */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                      Brand Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.brandColor}
                        onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                        className="h-8 w-10 rounded border border-gray-300 dark:border-gray-600 bg-transparent p-0"
                        title="Brand Color"
                      />
                      <input
                        type="text"
                        value={formData.brandColor}
                        onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                        className="flex-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs uppercase font-mono"
                        placeholder="#000000"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  {/* Logo Upload */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                      Logo (image upload)
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden bg-gray-50 dark:bg-gray-700 flex items-center justify-center">
                        {formData.logo ? (
                          <img src={formData.logo} alt="Logo preview" className="w-full h-full object-contain" />
                        ) : (
                          <Building2 className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          if (file) {
                            setFormData((prev) => ({
                              ...prev,
                              logoFile: file,
                              logo: URL.createObjectURL(file),
                            }));
                          } else {
                            setFormData((prev) => ({
                              ...prev,
                              logoFile: null,
                              logo: selectedHospital?.logo || '',
                            }));
                          }
                        }}
                        className="flex-1 text-xs text-gray-700 dark:text-gray-200 file:mr-3 file:px-2 file:py-1.5 file:border file:border-gray-300 dark:file:border-gray-600 file:rounded-md file:bg-white dark:file:bg-gray-700 file:text-xs file:text-gray-700 dark:file:text-gray-200"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="+1 234 567 8900"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="hospital@example.com"
                    />
                  </div>

                  {/* Address */}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                      Full Address <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows={1}
                      className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                      placeholder="Building, Street, City, Country"
                    />
                  </div>

                  {/* License Section */}
                  <div className="md:col-span-2 pt-1 border-t border-gray-100 dark:border-gray-700/50">
                    <h3 className="text-[10px] font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                      License Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-1">
                        <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                          License Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.license}
                          onChange={(e) => setFormData({ ...formData, license: e.target.value })}
                          className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                          placeholder="LIC-2024-XXX"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                          Issue Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={formData.licenseIssueDate}
                          onChange={(e) => setFormData({ ...formData, licenseIssueDate: e.target.value })}
                          className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                          Expiry Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={formData.licenseExpiryDate}
                          onChange={(e) => setFormData({ ...formData, licenseExpiryDate: e.target.value })}
                          className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-xs shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : modalMode === 'add' ? 'Create' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {isViewModalOpen && selectedHospital && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          {/* Robust Print Styles */}
          <style>
            {`
              @media print {
                body * {
                  visibility: hidden;
                }
                #hospital-print-view, #hospital-print-view * {
                  visibility: visible;
                }
                #hospital-print-view {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  height: 100%;
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

          {/* Print View Container - Hidden on screen via CSS class, visible on print via ID style */}
          <div id="hospital-print-view" className="hidden">
            <div className="flex items-start justify-between mb-8 border-b-2 border-gray-800 pb-6">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 overflow-hidden">
                  {selectedHospital.logo ? (
                    <img src={selectedHospital.logo} alt={selectedHospital.name} className="w-full h-full object-contain" />
                  ) : (
                    <Building2 className="w-12 h-12 text-gray-400" />
                  )}
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{selectedHospital.name}</h1>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded">
                      {selectedHospital.code}
                    </span>
                    <span className={`px-3 py-1 rounded text-sm font-bold uppercase tracking-wide border ${
                      selectedHospital.status === 'active'
                        ? 'text-green-700 border-green-700 bg-green-50'
                        : 'text-red-700 border-red-700 bg-red-50'
                    }`}>
                      {selectedHospital.status}
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
              {/* Contact Info */}
              <div className="border border-gray-300 rounded-lg p-6 bg-gray-50/50">
                <h3 className="font-bold text-lg text-gray-900 border-b border-gray-300 pb-3 mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5" /> Contact Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Address</label>
                    <p className="text-gray-900 font-medium text-base">{selectedHospital.address}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Phone</label>
                      <p className="text-gray-900 font-medium text-base font-mono">{selectedHospital.phone}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email</label>
                      <p className="text-gray-900 font-medium text-base">{selectedHospital.email}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* License Info */}
              <div className="border border-gray-300 rounded-lg p-6 bg-gray-50/50">
                <h3 className="font-bold text-lg text-gray-900 border-b border-gray-300 pb-3 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" /> License Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">License Number</label>
                    <p className="text-gray-900 font-bold text-xl font-mono">{selectedHospital.license}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Issued Date</label>
                      <p className="text-gray-900 font-medium text-base">{selectedHospital.licenseIssueDate}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Expiry Date</label>
                      <p className="text-gray-900 font-medium text-base">{selectedHospital.licenseExpiryDate}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Print Footer */}
            <div className="fixed bottom-0 left-0 right-0 border-t border-gray-300 pt-4 pb-10 flex justify-between items-center text-sm text-gray-500 px-10 bg-white">
              <p>Hospital Management System Record</p>
              <p>Page 1 of 1</p>
            </div>
          </div>

          {/* Screen Modal - Hidden on Print */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700 print:hidden">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 flex items-center justify-between rounded-t-lg shadow-md z-10">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Hospital Details
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
                  onClick={handleCloseViewModal}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-5">
              {/* Hospital Header Card */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-5 border border-blue-100 dark:border-blue-800 shadow-sm">
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden shadow-md ring-4 ring-white dark:ring-gray-600">
                    {selectedHospital.logo ? (
                      <img src={selectedHospital.logo} alt={selectedHospital.name} className="w-full h-full object-contain" />
                    ) : (
                      <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                      {selectedHospital.name}
                    </h3>
                    <p className="text-xs font-mono text-blue-600 dark:text-blue-400 font-semibold bg-blue-100 dark:bg-blue-900/40 inline-block px-2 py-0.5 rounded mb-2">
                      {selectedHospital.code}
                    </p>
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm ${
                        selectedHospital.status === 'active'
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 ring-1 ring-green-600/20'
                          : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 ring-1 ring-red-600/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedHospital.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        {selectedHospital.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Contact Information Card */}
                <div className="md:col-span-2 bg-white dark:bg-gray-700/30 rounded-lg p-4 border border-gray-200 dark:border-gray-600 shadow-sm">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2 border-b border-gray-100 dark:border-gray-600 pb-2">
                    <Building2 className="w-3.5 h-3.5 text-blue-500" />
                    Contact & Location
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Address</label>
                      <p className="text-xs text-gray-900 dark:text-white font-medium">
                        {selectedHospital.address}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone</label>
                        <p className="text-xs text-gray-900 dark:text-white font-medium font-mono">
                          {selectedHospital.phone}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</label>
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer">
                          {selectedHospital.email}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* License Information Card */}
                <div className="md:col-span-2 bg-white dark:bg-gray-700/30 rounded-lg p-4 border border-gray-200 dark:border-gray-600 shadow-sm">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2 border-b border-gray-100 dark:border-gray-600 pb-2">
                    <FileText className="w-3.5 h-3.5 text-purple-500" />
                    License Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">License Number</label>
                      <p className="text-xs text-gray-900 dark:text-white font-bold font-mono bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded inline-block">
                        {selectedHospital.license}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Issued Date</label>
                      <p className="text-xs text-gray-900 dark:text-white font-medium">
                        {selectedHospital.licenseIssueDate}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Expiry Date</label>
                      <p className="text-xs text-gray-900 dark:text-white font-medium text-red-600 dark:text-red-400">
                        {selectedHospital.licenseExpiryDate}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Audit Information */}
                <div className="md:col-span-2 bg-white dark:bg-gray-700/30 rounded-lg p-4 border border-gray-200 dark:border-gray-600 shadow-sm">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2 border-b border-gray-100 dark:border-gray-600 pb-2">
                    System Information
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created By</label>
                      <p className="text-xs text-gray-900 dark:text-white font-medium">{selectedHospital.createdBy || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created At</label>
                      <p className="text-xs text-gray-900 dark:text-white font-medium">
                        {selectedHospital.createdAt ? new Date(selectedHospital.createdAt).toLocaleString() : '-'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Updated By</label>
                      <p className="text-xs text-gray-900 dark:text-white font-medium">{selectedHospital.updatedBy || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Updated At</label>
                      <p className="text-xs text-gray-900 dark:text-white font-medium">
                        {selectedHospital.updatedAt ? new Date(selectedHospital.updatedAt).toLocaleString() : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700/50 px-5 py-3 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
              <button
                onClick={handleCloseViewModal}
                className="w-full py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-xs shadow-sm"
              >
                Close Detail View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}