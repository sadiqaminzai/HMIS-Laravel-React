import React, { useState } from 'react';
import { Plus, Pencil, Search, Users, Eye, Trash2, X, Upload, Printer, FileText, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown, Image as ImageIcon, CreditCard, QrCode, Download, FileImage } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { mockPatients, mockDoctors } from '../data/mockData';
import { Toast } from './Toast';
import { useSettings } from '../context/SettingsContext';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { useHospitals } from '../context/HospitalContext';
import { formatDate } from '../utils/date';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';

// Helper to convert hex to RGB array for jsPDF
const hexToRgb = (hex?: string): [number, number, number] | null => {
  if (!hex) return null;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : null;
};

interface PatientManagementProps {
  hospital: Hospital;
  userRole?: UserRole;
  currentUser?: { id: string; name: string; email: string; role: UserRole; doctorId?: string };
}

export function PatientManagement({ hospital, userRole = 'admin', currentUser }: PatientManagementProps) {
  const { hospitals: contextHospitals } = useHospitals();
  // Hospital filtering for super_admin with "All Hospitals" support
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  
  // Apply hospital filter first
  const hospitalFiltered = React.useMemo(() => filterByHospital(mockPatients), [filterByHospital]);

  // Then apply doctor filter if applicable
  const doctorFiltered = React.useMemo(() => {
    if (userRole === 'doctor' && currentUser?.doctorId) {
      return hospitalFiltered.filter(p => p.referredDoctorId === currentUser.doctorId);
    }
    return hospitalFiltered;
  }, [hospitalFiltered, userRole, currentUser]);

  const [patients, setPatients] = useState(doctorFiltered);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'danger' } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { getDefaultDoctorId, getPatientIdConfig, generatePatientId } = useSettings();
  
  // Sorting state
  const [sortField, setSortField] = useState<string>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'Male',
    phone: '',
    address: '',
    referredDoctorId: '',
    image: '',
    hospitalId: currentHospital.id // Add hospital selection
  });
  
  // Check if user can delete (only admin and super_admin)
  const canDelete = userRole === 'admin' || userRole === 'super_admin';

  // Update patients when filter dependencies change
  React.useEffect(() => {
    setPatients(doctorFiltered);
  }, [doctorFiltered]);

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.patientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone.includes(searchTerm) ||
    p.gender.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort patients
  const sortedPatients = [...filteredPatients].sort((a: any, b: any) => {
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

  const getDoctorName = (doctorId?: string) => {
    if (!doctorId) return 'N/A';
    const doctor = mockDoctors.find(d => d.id === doctorId);
    return doctor ? doctor.name : 'N/A';
  };

  const exportToExcel = () => {
    const workSheet = XLSX.utils.json_to_sheet(sortedPatients.map(p => ({
      ID: p.patientId,
      Name: p.name,
      Age: p.age,
      Gender: p.gender,
      Phone: p.phone,
      Address: p.address,
      Doctor: getDoctorName(p.referredDoctorId),
      Hospital: contextHospitals.find(h => h.id === p.hospitalId)?.name || 'Unknown'
    })));
    const workBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workBook, workSheet, "Patients");
    XLSX.writeFile(workBook, "Patients_List.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Determine brand color
    const brandRgb = !isAllHospitals && currentHospital.brandColor 
      ? hexToRgb(currentHospital.brandColor) 
      : null;
    const tableHeaderColor = brandRgb || [66, 139, 202]; // Default Blue

    // Add title
    doc.setFontSize(18);
    doc.text('Patients Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${formatDate(new Date(), currentHospital.timezone, currentHospital.calendarType)}`, 14, 30);
    if (!isAllHospitals) {
      doc.text(`Hospital: ${currentHospital.name}`, 14, 36);
    }

    // Create table
    autoTable(doc, {
      head: [['ID', 'Name', 'Age', 'Gender', 'Phone', 'Doctor']],
      body: sortedPatients.map(p => [
        p.patientId,
        p.name,
        p.age,
        p.gender,
        p.phone,
        getDoctorName(p.referredDoctorId)
      ]),
      startY: isAllHospitals ? 40 : 46,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: tableHeaderColor }
    });

    doc.save('Patients_Report.pdf');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        setFormData({ ...formData, image: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdd = () => {
    // Auto-populate with default doctor if configured
    const defaultDoctorId = getDefaultDoctorId(currentHospital.id) || '';
    setFormData({
      name: '',
      age: '',
      gender: 'Male',
      phone: '',
      address: '',
      referredDoctorId: defaultDoctorId,
      image: '',
      hospitalId: currentHospital.id // Add hospital selection
    });
    setImagePreview(null);
    setShowAddModal(true);
  };

  const handleView = (patient: any) => {
    setSelectedPatient(patient);
    setShowViewModal(true);
  };

  const handleEdit = (patient: any) => {
    setSelectedPatient(patient);
    setFormData({
      name: patient.name,
      age: patient.age.toString(),
      gender: patient.gender,
      phone: patient.phone,
      address: patient.address,
      referredDoctorId: patient.referredDoctorId || '',
      image: patient.image || '',
      hospitalId: patient.hospitalId // Add hospital selection
    });
    setImagePreview(patient.image || null);
    setShowEditModal(true);
  };

  const handleDelete = (patient: any) => {
    setSelectedPatient(patient);
    setShowDeleteModal(true);
  };

  const handlePrintIdCard = (patient: any) => {
    setSelectedPatient(patient);
    setShowIdCardModal(true);
  };

  const handleDownloadImage = async () => {
    const element = document.getElementById('patient-id-card-print');
    if (!element) return;
    
    try {
      const dataUrl = await toPng(element, { backgroundColor: '#ffffff' });
      
      const link = document.createElement('a');
      link.download = `${selectedPatient.name.replace(/\s+/g, '_')}_ID_Card.png`;
      link.href = dataUrl;
      link.click();
      setToast({ message: 'ID Card image downloaded successfully.', type: 'success' });
    } catch (error) {
      console.error('Error generating image:', error);
      setToast({ message: 'Failed to generate image', type: 'danger' });
    }
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('patient-id-card-print');
    if (!element) return;
    
    try {
      const dataUrl = await toPng(element, { backgroundColor: '#ffffff' });
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [85.6, 53.98] // CR80 size
      });
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, 85.6, 53.98);
      pdf.save(`${selectedPatient.name.replace(/\s+/g, '_')}_ID_Card.pdf`);
      setToast({ message: 'ID Card PDF downloaded successfully.', type: 'success' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      setToast({ message: 'Failed to generate PDF', type: 'danger' });
    }
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const newPatient = {
      id: (patients.length + 1).toString(),
      patientId: generatePatientId(formData.hospitalId, patients.length), // Use selected hospital from form
      hospitalId: formData.hospitalId, // Use selected hospital from form
      name: formData.name,
      age: parseInt(formData.age, 10),
      gender: formData.gender,
      phone: formData.phone,
      address: formData.address,
      referredDoctorId: formData.referredDoctorId,
      image: formData.image,
      createdAt: new Date()
    };
    setPatients([...patients, newPatient]);
    setShowAddModal(false);
    setToast({ message: 'Patient added successfully.', type: 'success' });
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedPatients = patients.map(p => {
      if (p.id === selectedPatient.id) {
        return {
          ...p,
          name: formData.name,
          age: parseInt(formData.age, 10),
          gender: formData.gender,
          phone: formData.phone,
          address: formData.address,
          referredDoctorId: formData.referredDoctorId,
          image: formData.image,
          hospitalId: formData.hospitalId
        };
      }
      return p;
    });
    setPatients(updatedPatients);
    setShowEditModal(false);
    setToast({ message: 'Patient updated successfully.', type: 'success' });
  };

  const confirmDelete = () => {
    setPatients(patients.filter(p => p.id !== selectedPatient.id));
    setShowDeleteModal(false);
    setToast({ message: 'Patient deleted successfully.', type: 'danger' });
  };

  const hospitalDoctors = mockDoctors.filter(d => d.hospitalId === currentHospital.id);
  const defaultDoctorId = getDefaultDoctorId(currentHospital.id);
  const defaultDoctor = defaultDoctorId ? hospitalDoctors.find(d => d.id === defaultDoctorId) : null;

  return (
    <div className="space-y-3">
      {/* Compact Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Patient Management</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Manage patient records for {isAllHospitals ? 'All Hospitals' : currentHospital.name}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Compact Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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

      {/* Default Doctor Info Banner - Compact */}
      {defaultDoctor && (
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-2 shadow-sm">
          <div className="p-1 bg-blue-100 dark:bg-blue-800/50 rounded-full">
            <Users className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-xs text-blue-900 dark:text-blue-100 font-medium">
            <strong>Default Doctor:</strong> Dr. {defaultDoctor.name} - New patients will be automatically assigned
          </p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="overflow-x-auto rounded-t-lg" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          <table className="w-full text-left border-collapse relative">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
              <tr>
                <th onClick={() => handleSort('patientId')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    ID
                    {renderSortIcon('patientId')}
                  </div>
                </th>
                <th onClick={() => handleSort('name')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Name
                    {renderSortIcon('name')}
                  </div>
                </th>
                <th onClick={() => handleSort('age')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Age
                    {renderSortIcon('age')}
                  </div>
                </th>
                <th onClick={() => handleSort('gender')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Gender
                    {renderSortIcon('gender')}
                  </div>
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Phone</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Doctor</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                        <Users className="w-6 h-6 text-gray-400 opacity-50" />
                      </div>
                      <p className="text-sm font-medium">No patients found</p>
                      <p className="text-xs mt-1">Try adjusting your search terms</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                    <td className="px-4 py-2">
                      <span className="font-mono text-[10px] font-medium bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">
                        {patient.patientId}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                          {patient.image ? (
                            <img src={patient.image} alt={patient.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
                              {patient.name.charAt(0)}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-medium text-gray-900 dark:text-white">{patient.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{patient.age}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        patient.gender === 'Male' 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' 
                          : patient.gender === 'Female'
                            ? 'bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400'
                            : 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400'
                      }`}>
                        {patient.gender}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{patient.phone}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{getDoctorName(patient.referredDoctorId)}</td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handlePrintIdCard(patient)}
                          className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors"
                          title="Print ID Card"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleView(patient)}
                          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                          title="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleEdit(patient)}
                          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(patient)}
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
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer with totals */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 rounded-b-lg flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
          <span>Total Records: <span className="font-semibold text-gray-900 dark:text-white">{filteredPatients.length}</span></span>
          <span>Showing {sortedPatients.length} of {patients.length} patients</span>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                {showAddModal ? 'Add New Patient' : 'Edit Patient Details'}
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
                    {contextHospitals.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Patient Photo - Compact */}
              <div className="bg-gray-50 dark:bg-gray-700/30 p-2 rounded-lg border border-gray-100 dark:border-gray-700 flex items-center gap-3">
                <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 shrink-0">
                    {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                    <ImageIcon className="w-4 h-4 text-gray-400" />
                    )}
                </div>
                <div className="flex-1">
                    <label className="block text-[10px] font-semibold text-gray-700 dark:text-gray-300 mb-0.5">
                    Patient Photo
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
                    </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Full Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Age <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                    placeholder="30"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Gender <span className="text-red-500">*</span></label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                    required
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
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
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={1}
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                  placeholder="Street, City, Country"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                  Assigned Doctor {defaultDoctor && <span className="text-blue-600 dark:text-blue-400 text-[10px] ml-1">(Default: Dr. {defaultDoctor.name})</span>}
                </label>
                <select
                  value={formData.referredDoctorId}
                  onChange={(e) => setFormData({ ...formData, referredDoctorId: e.target.value })}
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                >
                  <option value="">-- Select Doctor --</option>
                  {hospitalDoctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      Dr. {doctor.name} - {doctor.specialization}
                    </option>
                  ))}
                </select>
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
                  {showAddModal ? 'Create' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          {/* Robust Print Styles */}
          <style>
            {`
              @media print {
                body * {
                  visibility: hidden;
                }
                #patient-print-view, #patient-print-view * {
                  visibility: visible;
                }
                #patient-print-view {
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
          <div id="patient-print-view" className="hidden">
            <div className="flex items-start justify-between mb-8 border-b-2 border-gray-800 pb-6">
              <div className="flex items-center gap-6">
                {selectedPatient.image ? (
                  <img src={selectedPatient.image} alt={selectedPatient.name} className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
                ) : (
                  <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                    <Users className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{selectedPatient.name}</h1>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded">
                      ID: {selectedPatient.patientId}
                    </span>
                    <span className={`px-3 py-1 rounded text-sm font-bold uppercase tracking-wide border ${
                      selectedPatient.gender === 'Male'
                        ? 'text-blue-700 border-blue-700 bg-blue-50'
                        : selectedPatient.gender === 'Female'
                          ? 'text-pink-700 border-pink-700 bg-pink-50'
                          : 'text-gray-700 border-gray-700 bg-gray-50'
                    }`}>
                      {selectedPatient.gender}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right text-gray-500">
                <p className="text-sm">Report Generated</p>
                <p className="font-bold text-gray-900 text-lg">{formatDate(new Date(), currentHospital.timezone, currentHospital.calendarType)}</p>
              </div>
            </div>

            {/* Print Content Grid */}
            <div className="grid grid-cols-2 gap-8">
              {/* Personal Info */}
              <div className="border border-gray-300 rounded-lg p-6 bg-gray-50/50">
                <h3 className="font-bold text-lg text-gray-900 border-b border-gray-300 pb-3 mb-4">
                  Personal Information
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Age</label>
                      <p className="text-gray-900 font-medium text-base">{selectedPatient.age} Years</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Phone</label>
                      <p className="text-gray-900 font-medium text-base font-mono">{selectedPatient.phone}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Address</label>
                    <p className="text-gray-900 font-medium text-base">{selectedPatient.address}</p>
                  </div>
                </div>
              </div>

              {/* Medical Info */}
              <div className="border border-gray-300 rounded-lg p-6 bg-gray-50/50">
                <h3 className="font-bold text-lg text-gray-900 border-b border-gray-300 pb-3 mb-4">
                  Medical Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Assigned Doctor</label>
                    <p className="text-gray-900 font-bold text-xl">Dr. {getDoctorName(selectedPatient.referredDoctorId)}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Registration Date</label>
                    <p className="text-gray-900 font-medium text-base">{formatDate(new Date(), currentHospital.timezone, currentHospital.calendarType)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Print Footer */}
            <div className="fixed bottom-0 left-0 right-0 border-t border-gray-300 pt-4 pb-10 flex justify-between items-center text-sm text-gray-500 px-10 bg-white">
              <p>Patient Management System Record</p>
              <p>Page 1 of 1</p>
            </div>
          </div>

          {/* Screen Modal */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700 print:hidden">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 flex items-center justify-between rounded-t-lg shadow-md z-10">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4" />
                Patient Details
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
              {/* Patient Card */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-100 dark:border-blue-800 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden shadow-md ring-2 ring-white dark:ring-gray-600">
                    {selectedPatient.image ? (
                      <img src={selectedPatient.image} alt={selectedPatient.name} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5">
                      {selectedPatient.name}
                    </h3>
                    <p className="text-xs font-mono text-blue-600 dark:text-blue-400 font-semibold bg-blue-100 dark:bg-blue-900/40 inline-block px-2 py-0.5 rounded mb-1.5">
                      ID: {selectedPatient.patientId}
                    </p>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm ${
                          selectedPatient.gender === 'Male'
                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 ring-1 ring-blue-600/20'
                            : selectedPatient.gender === 'Female'
                              ? 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-400 ring-1 ring-pink-600/20'
                              : 'bg-gray-100 dark:bg-gray-900/40 text-gray-700 dark:text-gray-400 ring-1 ring-gray-600/20'
                        }`}>
                          {selectedPatient.gender}
                        </span>
                        
                        {/* Status Badge */}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                          (!selectedPatient.status || selectedPatient.status === 'active')
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-1 ring-green-600/20' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-1 ring-gray-600/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${(!selectedPatient.status || selectedPatient.status === 'active') ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                          {selectedPatient.status || 'Active'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 bg-white dark:bg-gray-700/30 rounded-lg p-3 border border-gray-200 dark:border-gray-600 shadow-sm">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2 border-b border-gray-100 dark:border-gray-600 pb-1.5">
                    Personal Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Age</label>
                      <p className="text-xs text-gray-900 dark:text-white font-medium">
                        {selectedPatient.age} Years
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone</label>
                      <p className="text-xs text-gray-900 dark:text-white font-medium font-mono">
                        {selectedPatient.phone}
                      </p>
                    </div>
                    <div className="md:col-span-2 space-y-0.5">
                      <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Address</label>
                      <p className="text-xs text-gray-900 dark:text-white font-medium">
                        {selectedPatient.address}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 bg-white dark:bg-gray-700/30 rounded-lg p-3 border border-gray-200 dark:border-gray-600 shadow-sm">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2 border-b border-gray-100 dark:border-gray-600 pb-1.5">
                    Medical Assignment
                  </h4>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Assigned Doctor</label>
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-bold">
                      Dr. {getDoctorName(selectedPatient.referredDoctorId)}
                    </p>
                  </div>
                </div>

                {/* Audit Information */}
                <div className="md:col-span-2 bg-white dark:bg-gray-700/30 rounded-lg p-3 border border-gray-200 dark:border-gray-600 shadow-sm">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2 border-b border-gray-100 dark:border-gray-600 pb-1.5">
                    System Information
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created By</label>
                      <p className="text-xs text-gray-900 dark:text-white font-medium">{selectedPatient.createdBy || '-'}</p>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created At</label>
                      <p className="text-xs text-gray-900 dark:text-white font-medium">
                        {selectedPatient.createdAt ? formatDate(selectedPatient.createdAt, currentHospital.timezone, currentHospital.calendarType) : '-'}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Updated By</label>
                      <p className="text-xs text-gray-900 dark:text-white font-medium">{selectedPatient.updatedBy || '-'}</p>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Updated At</label>
                      <p className="text-xs text-gray-900 dark:text-white font-medium">
                        {selectedPatient.updatedAt ? formatDate(selectedPatient.updatedAt, currentHospital.timezone, currentHospital.calendarType) : '-'}
                      </p>
                    </div>
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

      {/* ID Card Modal */}
      {showIdCardModal && selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           <style>
            {`
              @media print {
                body * {
                  visibility: hidden;
                }
                #patient-id-card-print, #patient-id-card-print * {
                  visibility: visible;
                }
                #patient-id-card-print {
                  position: absolute;
                  left: 50%;
                  top: 50%;
                  transform: translate(-50%, -50%);
                  margin: 0;
                  padding: 0;
                  background: white;
                  box-shadow: none;
                  display: block !important;
                  border: 1px solid #ddd;
                }
                @page {
                  size: auto;
                  margin: 0;
                }
              }
            `}
          </style>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 flex items-center justify-between rounded-t-lg shadow-md">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Patient ID Card
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
                  onClick={() => setShowIdCardModal(false)}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 flex justify-center bg-gray-100 dark:bg-gray-900">
               {/* ID Card Container - Visible in Print & Screen */}
               <div id="patient-id-card-print" className="w-[85.6mm] h-[53.98mm] bg-white rounded-xl shadow-lg overflow-hidden relative border border-gray-200 flex flex-col print:shadow-none print:border-0">
                  {/* Card Header */}
                  <div className="h-10 flex items-center justify-between px-3" style={{ backgroundColor: contextHospitals.find(h => h.id === selectedPatient.hospitalId)?.brandColor || '#2563eb' }}>
                     <div className="text-white font-bold text-xs tracking-wide">
                        {contextHospitals.find(h => h.id === selectedPatient.hospitalId)?.name || 'Medical Center'}
                     </div>
                     <div className="text-[8px] text-white/80 uppercase tracking-widest">Patient Card</div>
                  </div>
                  
                  {/* Card Body */}
                  <div className="flex-1 p-3 flex gap-3 relative z-10">
                     {/* Photo Area */}
                     <div className="w-20 h-24 bg-gray-100 rounded-md border border-gray-200 overflow-hidden flex-shrink-0 self-center">
                        {selectedPatient.image ? (
                           <img src={selectedPatient.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                           <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                              <Users className="w-8 h-8" />
                           </div>
                        )}
                     </div>
                     
                     {/* Details */}
                     <div className="flex-1 space-y-1 pt-1">
                        <div>
                           <div className="text-[8px] text-gray-400 uppercase tracking-wider font-semibold">Name</div>
                           <div className="text-sm font-bold text-gray-900 leading-tight">{selectedPatient.name}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-1 mt-1">
                           <div>
                              <div className="text-[7px] text-gray-400 uppercase tracking-wider font-semibold">ID No.</div>
                              <div className="text-xs font-mono font-bold" style={{ color: contextHospitals.find(h => h.id === selectedPatient.hospitalId)?.brandColor || '#2563eb' }}>{selectedPatient.patientId}</div>
                           </div>
                           <div>
                              <div className="text-[7px] text-gray-400 uppercase tracking-wider font-semibold">Gender/Age</div>
                              <div className="text-xs font-medium text-gray-700">{selectedPatient.gender.charAt(0)} / {selectedPatient.age}</div>
                           </div>
                        </div>
                        <div className="mt-1.5">
                           <div className="text-[7px] text-gray-400 uppercase tracking-wider font-semibold">Emergency Contact</div>
                           <div className="text-[10px] font-medium text-gray-700">{selectedPatient.phone}</div>
                        </div>
                     </div>
                  </div>
                  
                  {/* Card Footer / Background Elements */}
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gray-50 border-t border-gray-100 flex items-center justify-between px-3">
                     <div className="text-[6px] text-gray-400 leading-tight max-w-[60%]">
                        {contextHospitals.find(h => h.id === selectedPatient.hospitalId)?.address || '123 Medical Center Drive'}
                     </div>
                     {/* QR Code Placeholder */}
                     <div className="opacity-80">
                         <QrCode className="w-8 h-8 text-gray-800" />
                     </div>
                  </div>
               </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 border-t border-gray-200 dark:border-gray-700 rounded-b-lg flex flex-col gap-3">
               <div className="flex justify-between items-center text-xs text-gray-500">
                 <p>Standard CR80 Size (85.6mm x 54mm)</p>
               </div>
               <div className="flex justify-end gap-2">
                 <button
                    onClick={handleDownloadImage}
                    className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium shadow-sm flex items-center gap-1.5 text-xs"
                 >
                    <FileImage className="w-3.5 h-3.5" />
                    Save Image
                 </button>
                 <button
                    onClick={handleDownloadPDF}
                    className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium shadow-sm flex items-center gap-1.5 text-xs"
                 >
                    <FileText className="w-3.5 h-3.5" />
                    Save PDF
                 </button>
                 <button
                    onClick={() => setTimeout(() => window.print(), 100)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium shadow-sm flex items-center gap-1.5 text-xs"
                 >
                    <Printer className="w-3.5 h-3.5" />
                    Print
                 </button>
               </div>
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
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Patient</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete {selectedPatient?.name}? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
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