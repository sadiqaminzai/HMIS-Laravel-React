import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Search, Stethoscope, Eye, Trash2, X, Upload, Image as ImageIcon, Printer, FileText, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown, Clock, Check } from 'lucide-react';
import { Hospital, UserRole, DoctorAvailability, Doctor } from '../types';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { useDoctors } from '../context/DoctorContext';
import { useHospitals } from '../context/HospitalContext';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';

interface DoctorManagementProps {
  hospital: Hospital;
  userRole?: UserRole;
}

export function DoctorManagement({ hospital, userRole = 'admin' }: DoctorManagementProps) {
  // Hospital filtering for super_admin with "All Hospitals" support
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  const { hospitals } = useHospitals();
  const { doctors, addDoctor, updateDoctor, deleteDoctor } = useDoctors();
  const { hasPermission } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<string>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    specialization: '',
    registrationNumber: '',
    consultationFee: 0,
    status: 'active' as const,
    image: '',
    signature: '',
    imageFile: null as File | null,
    signatureFile: null as File | null,
    hospitalId: currentHospital.id, // Add hospital selection
    availability: [
      { day: 'Saturday', startTime: '09:00', endTime: '17:00', isAvailable: true },
      { day: 'Sunday', startTime: '09:00', endTime: '17:00', isAvailable: true },
      { day: 'Monday', startTime: '09:00', endTime: '17:00', isAvailable: true },
      { day: 'Tuesday', startTime: '09:00', endTime: '17:00', isAvailable: true },
      { day: 'Wednesday', startTime: '09:00', endTime: '17:00', isAvailable: true },
      { day: 'Thursday', startTime: '09:00', endTime: '13:00', isAvailable: true },
      { day: 'Friday', startTime: '00:00', endTime: '00:00', isAvailable: false },
    ] as DoctorAvailability[]
  });

  // Scope doctors to selected hospital (or all if super admin)
  const scopedDoctors = useMemo(
    () => filterByHospital(doctors),
    [doctors, filterByHospital]
  );

  const canAdd = hasPermission('add_doctors') || hasPermission('manage_doctors');
  const canEdit = hasPermission('edit_doctors') || hasPermission('manage_doctors');
  const canDelete = hasPermission('delete_doctors') || hasPermission('manage_doctors');
  const canExport = hasPermission('export_doctors') || hasPermission('manage_doctors');
  const canPrint = hasPermission('print_doctors') || hasPermission('manage_doctors');

  // Filter doctors by search term
  const filteredDoctors = scopedDoctors.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.specialization.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort doctors
  const sortedDoctors = [...filteredDoctors].sort((a: any, b: any) => {
    const aValue = a[sortField]?.toString().toLowerCase() || '';
    const bValue = b[sortField]?.toString().toLowerCase() || '';
    
    if (sortDirection === 'asc') {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  });

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(sortedDoctors.length / itemsPerPage));

  const paginatedDoctors = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedDoctors.slice(start, start + itemsPerPage);
  }, [sortedDoctors, currentPage]);

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
    const workSheet = XLSX.utils.json_to_sheet(sortedDoctors.map(d => ({
      ID: d.id,
      Name: d.name,
      Specialization: d.specialization,
      Registration: d.registrationNumber,
      'Consultation Fee': d.consultationFee,
      Email: d.email,
      Phone: d.phone,
      Status: d.status,
      Hospital: hospitals.find(h => h.id === d.hospitalId)?.name || 'Unknown'
    })));
    const workBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workBook, workSheet, "Doctors");
    XLSX.writeFile(workBook, "Doctors_List.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text('Doctors Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    if (!isAllHospitals) {
      doc.text(`Hospital: ${currentHospital.name}`, 14, 36);
    }

    // Create table
    autoTable(doc, {
      head: [['Name', 'Specialization', 'Reg. No', 'Fee', 'Contact', 'Status']],
      body: sortedDoctors.map(d => [
        d.name,
        d.specialization,
        d.registrationNumber,
        d.consultationFee?.toString() || '0',
        `${d.phone}\n${d.email}`,
        d.status
      ]),
      startY: isAllHospitals ? 40 : 46,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [66, 139, 202] }
    });

    doc.save('Doctors_Report.pdf');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setImagePreview(URL.createObjectURL(file));
      setFormData({ ...formData, imageFile: file, image: URL.createObjectURL(file) });
    }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setSignaturePreview(URL.createObjectURL(file));
      setFormData({ ...formData, signatureFile: file, signature: URL.createObjectURL(file) });
    }
  };

  const handleAdd = () => {
    if (!canAdd) {
      toast.warning('You are not authorized to manage doctors');
      return;
    }
    setFormData({
      name: '',
      email: '',
      phone: '',
      specialization: '',
      registrationNumber: '',
      consultationFee: 0,
      status: 'active' as const,
      image: '',
      signature: '',
      imageFile: null,
      signatureFile: null,
      hospitalId: currentHospital.id, // Add hospital selection
      availability: [
        { day: 'Saturday', startTime: '09:00', endTime: '17:00', isAvailable: true },
        { day: 'Sunday', startTime: '09:00', endTime: '17:00', isAvailable: true },
        { day: 'Monday', startTime: '09:00', endTime: '17:00', isAvailable: true },
        { day: 'Tuesday', startTime: '09:00', endTime: '17:00', isAvailable: true },
        { day: 'Wednesday', startTime: '09:00', endTime: '17:00', isAvailable: true },
        { day: 'Thursday', startTime: '09:00', endTime: '13:00', isAvailable: true },
        { day: 'Friday', startTime: '00:00', endTime: '00:00', isAvailable: false },
      ]
    });
    setImagePreview(null);
    setSignaturePreview(null);
    setShowAddModal(true);
  };

  const handleView = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setShowViewModal(true);
  };

  const handleEdit = (doctor: Doctor) => {
    if (!canEdit) {
      toast.warning('You are not authorized to manage doctors');
      return;
    }
    setSelectedDoctor(doctor);
    setFormData({
      name: doctor.name,
      email: doctor.email,
      phone: doctor.phone,
      specialization: doctor.specialization,
      registrationNumber: doctor.registrationNumber,
      consultationFee: doctor.consultationFee || 0,
      status: doctor.status,
      image: doctor.image || '',
      signature: doctor.signature || '',
      imageFile: null,
      signatureFile: null,
      hospitalId: doctor.hospitalId,
      availability: doctor.availability || [
        { day: 'Saturday', startTime: '09:00', endTime: '17:00', isAvailable: true },
        { day: 'Sunday', startTime: '09:00', endTime: '17:00', isAvailable: true },
        { day: 'Monday', startTime: '09:00', endTime: '17:00', isAvailable: true },
        { day: 'Tuesday', startTime: '09:00', endTime: '17:00', isAvailable: true },
        { day: 'Wednesday', startTime: '09:00', endTime: '17:00', isAvailable: true },
        { day: 'Thursday', startTime: '09:00', endTime: '13:00', isAvailable: true },
        { day: 'Friday', startTime: '00:00', endTime: '00:00', isAvailable: false },
      ]
    });
    setImagePreview(doctor.image || null);
    setSignaturePreview(doctor.signature || null);
    setShowEditModal(true);
  };

  const handleDelete = (doctor: Doctor) => {
    if (!canDelete) {
      toast.warning('You are not authorized to manage doctors');
      return;
    }
    setSelectedDoctor(doctor);
    setShowDeleteModal(true);
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdd) {
      toast.warning('You are not authorized to manage doctors');
      return;
    }
    setFormSubmitting(true);
    const payload = {
      hospitalId: currentHospital.id,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      specialization: formData.specialization,
      registrationNumber: formData.registrationNumber,
      consultationFee: Number(formData.consultationFee),
      status: formData.status,
      availability: formData.availability,
      imageFile: formData.imageFile,
      signatureFile: formData.signatureFile,
    };
    addDoctor(payload)
      .then(() => {
        toast.success('Doctor added successfully');
        setShowAddModal(false);
        setImagePreview(null);
        setSignaturePreview(null);
      })
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to add doctor'))
      .finally(() => setFormSubmitting(false));
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !selectedDoctor) {
      toast.warning('You are not authorized to manage doctors');
      return;
    }
    setFormSubmitting(true);
    const payload = {
      id: selectedDoctor.id,
      hospitalId: selectedDoctor.hospitalId,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      specialization: formData.specialization,
      registrationNumber: formData.registrationNumber,
      consultationFee: Number(formData.consultationFee),
      status: formData.status,
      availability: formData.availability,
      imageFile: formData.imageFile,
      signatureFile: formData.signatureFile,
    };
    updateDoctor(payload)
      .then(() => {
        toast.success('Doctor updated successfully');
        setShowEditModal(false);
        setImagePreview(null);
        setSignaturePreview(null);
      })
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to update doctor'))
      .finally(() => setFormSubmitting(false));
  };

  const handleConfirmDelete = () => {
    if (!canDelete || !selectedDoctor) {
      toast.warning('Not allowed');
      return;
    }
    setFormSubmitting(true);
    deleteDoctor(selectedDoctor.id)
      .then(() => toast.success('Doctor deleted successfully'))
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to delete doctor'))
      .finally(() => {
        setFormSubmitting(false);
        setShowDeleteModal(false);
      });
  };

  return (
    <div className="space-y-3">
      {/* Compact Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Doctor Management</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Manage doctors for {isAllHospitals ? 'All Hospitals' : currentHospital.name}
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
              placeholder="Search doctors..."
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

      {/* Doctors Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="overflow-x-auto rounded-t-lg" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          <table className="w-full text-left border-collapse relative">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
              <tr>
                <th onClick={() => handleSort('name')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Doctor
                    {renderSortIcon('name')}
                  </div>
                </th>
                <th onClick={() => handleSort('specialization')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Specialization
                    {renderSortIcon('specialization')}
                  </div>
                </th>
                <th onClick={() => handleSort('registrationNumber')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Registration No.
                    {renderSortIcon('registrationNumber')}
                  </div>
                </th>
                <th onClick={() => handleSort('consultationFee')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Fees
                    {renderSortIcon('consultationFee')}
                  </div>
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Contact</th>
                <th onClick={() => handleSort('status')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Status
                    {renderSortIcon('status')}
                  </div>
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-center">Signature</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedDoctors.length > 0 ? (
                paginatedDoctors.map((doctor) => (
                  <tr key={doctor.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center overflow-hidden flex-shrink-0 border border-blue-200 dark:border-blue-800">
                          {doctor.image ? (
                            <img src={doctor.image} alt={doctor.name} className="w-full h-full object-cover" />
                          ) : (
                            <Stethoscope className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-white text-xs truncate">{doctor.name}</div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{doctor.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className="px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded text-[10px] font-medium border border-purple-100 dark:border-purple-800">
                        {doctor.specialization}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-[10px] font-mono text-gray-600 dark:text-gray-400">{doctor.registrationNumber}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-[10px] font-medium text-gray-900 dark:text-gray-300">{doctor.consultationFee}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-[10px] text-gray-600 dark:text-gray-400">{doctor.phone}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                        doctor.status === 'active'
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                          : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                      }`}>
                        {doctor.status.charAt(0).toUpperCase() + doctor.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex justify-center">
                        {doctor.signature ? (
                          <span className="flex items-center justify-center w-5 h-5 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400 text-[10px]" title="Signature uploaded">
                            ✓
                          </span>
                        ) : (
                          <span className="flex items-center justify-center w-5 h-5 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-400 dark:text-gray-500 text-[10px]" title="No signature">
                            −
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleView(doctor)}
                          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                          title="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => handleEdit(doctor)}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(doctor)}
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
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                        <Search className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium">No doctors found</p>
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
          <span>Total Records: <span className="font-semibold text-gray-900 dark:text-white">{filteredDoctors.length}</span></span>
          <div className="flex items-center gap-3">
            <span>Showing {paginatedDoctors.length} of {sortedDoctors.length}</span>
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

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 py-6 overflow-y-auto transition-all">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                {showAddModal ? 'Add New Doctor' : 'Edit Doctor Details'}
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
                    {hospitals.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Profile Image - Compact */}
                <div className="md:col-span-2 bg-gray-50 dark:bg-gray-700/30 p-2 rounded-lg border border-gray-100 dark:border-gray-700 flex items-center gap-3">
                   <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 shrink-0">
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-semibold text-gray-700 dark:text-gray-300 mb-0.5">
                        Profile Image
                      </label>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm font-medium text-[10px]">
                          <Upload className="w-3 h-3" />
                          Choose
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                        </label>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">Max 2MB</span>
                      </div>
                    </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                    placeholder="Dr. John Doe"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                    placeholder="doctor@example.com"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Phone <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                    placeholder="+1 234 567 8900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Consultation Fee <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="0"
                    value={formData.consultationFee}
                    onChange={(e) => setFormData({ ...formData, consultationFee: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                    placeholder="1500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Specialization <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.specialization}
                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                    placeholder="Cardiology"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Registration Number <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.registrationNumber}
                    onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                    placeholder="REG-2024-001"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Status <span className="text-red-500">*</span></label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Availability Schedule */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <h3 className="text-xs font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Availability Schedule
                </h3>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {formData.availability.map((slot, index) => (
                    <div key={slot.day} className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs bg-gray-50 dark:bg-gray-700/30 p-1.5 rounded-md border border-gray-100 dark:border-gray-700">
                      <div className="sm:w-20 font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={slot.isAvailable}
                          onChange={(e) => {
                            const newAvailability = [...formData.availability];
                            newAvailability[index].isAvailable = e.target.checked;
                            setFormData({ ...formData, availability: newAvailability });
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        {slot.day}
                      </div>
                      
                      {slot.isAvailable ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="time"
                            value={slot.startTime}
                            onChange={(e) => {
                              const newAvailability = [...formData.availability];
                              newAvailability[index].startTime = e.target.value;
                              setFormData({ ...formData, availability: newAvailability });
                            }}
                            className="px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-[10px]"
                          />
                          <span className="text-gray-500 dark:text-gray-400">-</span>
                          <input
                            type="time"
                            value={slot.endTime}
                            onChange={(e) => {
                              const newAvailability = [...formData.availability];
                              newAvailability[index].endTime = e.target.value;
                              setFormData({ ...formData, availability: newAvailability });
                            }}
                            className="px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-[10px]"
                          />
                        </div>
                      ) : (
                        <div className="flex-1 text-gray-400 dark:text-gray-500 italic text-[10px]">
                          Not Available
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Signature Upload - Compact */}
              <div className="bg-gray-50 dark:bg-gray-700/30 p-2 rounded-lg border border-gray-100 dark:border-gray-700 flex items-center gap-3">
                  <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 shrink-0">
                    {signaturePreview ? (
                      <img src={signaturePreview} alt="Signature" className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-[8px] text-gray-400 text-center leading-tight">No Sig</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-semibold text-gray-700 dark:text-gray-300 mb-0.5">
                      Digital Signature
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm font-medium text-[10px]">
                        <Upload className="w-3 h-3" />
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleSignatureUpload}
                          className="hidden"
                        />
                      </label>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">Required for prescriptions</span>
                    </div>
                  </div>
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
                  disabled={formSubmitting}
                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-xs shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {formSubmitting ? 'Saving...' : showAddModal ? 'Create' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal with Print */}
      {showViewModal && selectedDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          {/* Robust Print Styles */}
          <style>
            {`
              @media print {
                body * {
                  visibility: hidden;
                }
                #doctor-print-view, #doctor-print-view * {
                  visibility: visible;
                }
                #doctor-print-view {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  height: auto !important;
                  min-height: 100vh;
                  overflow: visible !important;
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
          <div id="doctor-print-view" className="hidden">
            <div className="flex items-start justify-between mb-8 border-b-2 border-gray-800 pb-6">
              <div className="flex items-center gap-6">
                {selectedDoctor.image ? (
                  <img src={selectedDoctor.image} alt={selectedDoctor.name} className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
                ) : (
                  <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                    <Stethoscope className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{selectedDoctor.name}</h1>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded">
                      {selectedDoctor.registrationNumber}
                    </span>
                    <span className="text-lg text-blue-600 font-medium">
                      {selectedDoctor.specialization}
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
            <div className="grid grid-cols-2 gap-8 mb-8">
              {/* Contact Info */}
              <div className="border border-gray-300 rounded-lg p-6 bg-gray-50/50">
                <h3 className="font-bold text-lg text-gray-900 border-b border-gray-300 pb-3 mb-4">
                  Contact Information
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Phone</label>
                      <p className="text-gray-900 font-medium text-base font-mono">{selectedDoctor.phone}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email</label>
                      <p className="text-gray-900 font-medium text-base">{selectedDoctor.email}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Status</label>
                    <span className={`px-2 py-1 rounded text-sm font-bold uppercase tracking-wide border ${
                      selectedDoctor.status === 'active'
                        ? 'text-green-700 border-green-700 bg-green-50'
                        : 'text-red-700 border-red-700 bg-red-50'
                    }`}>
                      {selectedDoctor.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Professional Info */}
              <div className="border border-gray-300 rounded-lg p-6 bg-gray-50/50">
                <h3 className="font-bold text-lg text-gray-900 border-b border-gray-300 pb-3 mb-4">
                  Professional Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Registration</label>
                    <p className="text-gray-900 font-bold text-xl font-mono">{selectedDoctor.registrationNumber}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Consultation Fee</label>
                    <p className="text-gray-900 font-bold text-xl font-mono">{selectedDoctor.consultationFee || 0}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Signature On File</label>
                    <div className="p-3 bg-white border border-gray-200 rounded text-center">
                        {selectedDoctor.signature ? (
                           <img src={selectedDoctor.signature} alt="Signature" className="h-12 object-contain mx-auto" />
                        ) : (
                            <span className="text-gray-400 italic">No signature available</span>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Availability Schedule (Print) */}
            {selectedDoctor.availability && (
              <div className="border border-gray-300 rounded-lg p-6 bg-gray-50/50 mb-8">
                <h3 className="font-bold text-lg text-gray-900 border-b border-gray-300 pb-3 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Availability Schedule
                </h3>
                <div className="grid grid-cols-7 gap-2">
                  {selectedDoctor.availability.map((slot: DoctorAvailability) => (
                    <div key={slot.day} className={`p-2 rounded border text-center ${slot.isAvailable ? 'bg-white border-green-200' : 'bg-gray-100 border-gray-200'}`}>
                      <div className="text-xs font-bold uppercase tracking-wider mb-1 text-gray-500">{slot.day.substring(0, 3)}</div>
                      {slot.isAvailable ? (
                        <div className="text-sm font-bold text-gray-900">
                          {slot.startTime}<br/><span className="text-gray-400 text-xs font-normal">to</span><br/>{slot.endTime}
                        </div>
                      ) : (
                        <div className="text-sm font-medium text-red-500 italic py-2">Off</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Print Footer */}
            <div className="fixed bottom-0 left-0 right-0 border-t border-gray-300 pt-4 pb-10 flex justify-between items-center text-sm text-gray-500 px-10 bg-white">
              <p>Doctor Management System Record</p>
              <p>Page 1 of 1</p>
            </div>
          </div>

          {/* Screen Modal */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700 print:hidden">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 flex items-center justify-between rounded-t-lg shadow-md z-10">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Stethoscope className="w-4 h-4" />
                Doctor Details
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
                  onClick={() => setShowViewModal(false)}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Doctor Card */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-100 dark:border-blue-800 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden shadow-md ring-2 ring-white dark:ring-gray-600">
                    {selectedDoctor.image ? (
                      <img src={selectedDoctor.image} alt={selectedDoctor.name} className="w-full h-full object-cover" />
                    ) : (
                      <Stethoscope className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5">
                      {selectedDoctor.name}
                    </h3>
                    <p className="text-xs font-mono text-blue-600 dark:text-blue-400 font-semibold bg-blue-100 dark:bg-blue-900/40 inline-block px-2 py-0.5 rounded mb-1.5">
                      {selectedDoctor.registrationNumber}
                    </p>
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm ${
                        selectedDoctor.status === 'active'
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 ring-1 ring-green-600/20'
                          : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 ring-1 ring-red-600/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedDoctor.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        {selectedDoctor.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 bg-white dark:bg-gray-700/30 rounded-lg p-3 border border-gray-200 dark:border-gray-600 shadow-sm">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2 border-b border-gray-100 dark:border-gray-600 pb-1.5">
                    Professional Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Specialization</label>
                      <p className="text-xs text-gray-900 dark:text-white font-medium">
                        {selectedDoctor.specialization}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone</label>
                      <p className="text-xs text-gray-900 dark:text-white font-medium font-mono">
                        {selectedDoctor.phone}
                      </p>
                    </div>
                    <div className="md:col-span-2 space-y-0.5">
                      <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</label>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer">
                        {selectedDoctor.email}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Availability Schedule (Screen View) */}
              {selectedDoctor.availability && (
                <div className="md:col-span-2 bg-white dark:bg-gray-700/30 rounded-lg p-3 border border-gray-200 dark:border-gray-600 shadow-sm">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2 border-b border-gray-100 dark:border-gray-600 pb-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Availability Schedule
                  </h4>
                  <div className="space-y-1.5">
                    {selectedDoctor.availability.map((slot: DoctorAvailability) => (
                      <div key={slot.day} className={`flex items-center justify-between text-[10px] p-1.5 rounded border ${slot.isAvailable ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
                        <span className={`font-medium ${slot.isAvailable ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>{slot.day}</span>
                        {slot.isAvailable ? (
                          <span className="font-mono text-green-700 dark:text-green-400 font-semibold">{slot.startTime} - {slot.endTime}</span>
                        ) : (
                          <span className="text-red-500 dark:text-red-400 italic">Not Available</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-gray-700/30 rounded-lg p-3 border border-gray-200 dark:border-gray-600 shadow-sm">
                 <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2 border-b border-gray-100 dark:border-gray-600 pb-1.5">
                    Digital Signature
                 </h4>
                 <div className="flex justify-center p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 border-dashed">
                    {selectedDoctor.signature ? (
                       <img src={selectedDoctor.signature} alt="Signature" className="h-10 object-contain" />
                    ) : (
                       <span className="text-xs text-gray-400 italic">No signature uploaded</span>
                    )}
                 </div>
              </div>

              {/* Audit Information */}
              <div className="bg-white dark:bg-gray-700/30 rounded-lg p-3 border border-gray-200 dark:border-gray-600 shadow-sm">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2 border-b border-gray-100 dark:border-gray-600 pb-1.5">
                  System Information
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created By</label>
                    <p className="text-xs text-gray-900 dark:text-white font-medium">{selectedDoctor.createdBy || '-'}</p>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created At</label>
                    <p className="text-xs text-gray-900 dark:text-white font-medium">
                      {selectedDoctor.createdAt ? new Date(selectedDoctor.createdAt).toLocaleString() : '-'}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Updated By</label>
                    <p className="text-xs text-gray-900 dark:text-white font-medium">{selectedDoctor.updatedBy || '-'}</p>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Updated At</label>
                    <p className="text-xs text-gray-900 dark:text-white font-medium">
                      {selectedDoctor.updatedAt ? new Date(selectedDoctor.updatedAt).toLocaleString() : '-'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 px-5 py-3 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
              <button
                onClick={() => setShowViewModal(false)}
                className="w-full py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-xs shadow-sm"
              >
                Close Detail View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6 text-center border border-gray-200 dark:border-gray-700">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Doctor</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete {selectedDoctor?.name}? This action cannot be undone.
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