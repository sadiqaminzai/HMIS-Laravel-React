import React, { useState } from 'react';
import { Calendar, Clock, Plus, Edit, Trash2, X, Search, CheckCircle, XCircle, AlertCircle, Printer, FileText, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Hospital, Appointment, UserRole, Patient, Doctor } from '../types';
import { mockPatients, mockDoctors, mockHospitals } from '../data/mockData';
import { Toast } from './Toast';
import { useSettings } from '../context/SettingsContext';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { formatDate, formatOnlyDate } from '../utils/date';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface AppointmentManagementProps {
  hospital: Hospital;
  userRole: UserRole;
  currentUser?: { id: string; name: string; email: string; role: UserRole; doctorId?: string };
}

// Mock appointments data
const generateMockAppointments = (hospitalId: string): Appointment[] => [
  {
    id: '1',
    hospitalId,
    appointmentNumber: 'APT-2026-001',
    patientId: 'P001',
    patientName: 'Ahmed Khan',
    patientAge: 35,
    patientGender: 'male',
    doctorId: '1',
    doctorName: 'Dr. John Smith',
    appointmentDate: new Date('2026-01-08'),
    appointmentTime: '10:00 AM',
    reason: 'Regular Checkup',
    status: 'cancelled',
    notes: 'Patient requested cancellation',
    createdAt: new Date(),
    createdBy: 'admin1'
  },
  {
    id: '2',
    hospitalId,
    appointmentNumber: 'APT-2026-002',
    patientId: 'P002',
    patientName: 'Fatima Ali',
    patientAge: 28,
    patientGender: 'female',
    doctorId: '2',
    doctorName: 'Dr. Sarah Johnson',
    appointmentDate: new Date('2026-01-08'),
    appointmentTime: '11:30 AM',
    reason: 'Follow-up Consultation',
    status: 'completed',
    createdAt: new Date(),
    createdBy: 'receptionist1'
  },
  {
    id: '3',
    hospitalId,
    appointmentNumber: 'APT-2026-003',
    patientId: 'P003',
    patientName: 'Omar Hassan',
    patientAge: 45,
    patientGender: 'male',
    doctorId: '1',
    doctorName: 'Dr. John Smith',
    appointmentDate: new Date('2026-01-07'),
    appointmentTime: '02:00 PM',
    reason: 'Blood Pressure Check',
    status: 'completed',
    notes: 'Patient stable',
    createdAt: new Date(),
    createdBy: 'receptionist1'
  },
  {
    id: '4',
    hospitalId,
    appointmentNumber: 'APT-2026-004',
    patientId: 'P004',
    patientName: 'Zainab Malik',
    patientAge: 32,
    patientGender: 'female',
    doctorId: '3',
    doctorName: 'Dr. Michael Chen',
    appointmentDate: new Date('2026-01-09'),
    appointmentTime: '09:00 AM',
    reason: 'Diabetes Follow-up',
    status: 'scheduled',
    notes: 'Bring previous lab reports',
    createdAt: new Date(),
    createdBy: 'receptionist1'
  },
  {
    id: '5',
    hospitalId,
    appointmentNumber: 'APT-2026-005',
    patientId: 'P005',
    patientName: 'Ibrahim Siddiqui',
    patientAge: 52,
    patientGender: 'male',
    doctorId: '1',
    doctorName: 'Dr. John Smith',
    appointmentDate: new Date('2026-01-09'),
    appointmentTime: '10:30 AM',
    reason: 'Cardiac Assessment',
    status: 'scheduled',
    createdAt: new Date(),
    createdBy: 'receptionist1'
  },
  {
    id: '6',
    hospitalId,
    appointmentNumber: 'APT-2026-006',
    patientId: 'P002',
    patientName: 'Fatima Ali',
    patientAge: 28,
    patientGender: 'female',
    doctorId: '3',
    doctorName: 'Dr. Michael Chen',
    appointmentDate: new Date('2026-01-09'),
    appointmentTime: '03:00 PM',
    reason: 'General Consultation',
    status: 'scheduled',
    createdAt: new Date(),
    createdBy: 'receptionist1'
  }
];

export function AppointmentManagement({ hospital, userRole, currentUser }: AppointmentManagementProps) {
  // Hospital filtering for super_admin with "All Hospitals" support
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>(generateMockAppointments(currentHospital.id));
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'danger' } | null>(null);
  const [openStatusDropdown, setOpenStatusDropdown] = useState<string | null>(null);
  const { getDefaultDoctorId } = useSettings();
  
  // Sorting state
  const [sortField, setSortField] = useState<string>('appointmentDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [formData, setFormData] = useState({
    patientId: '',
    doctorId: '',
    appointmentDate: '',
    appointmentTime: '',
    reason: '',
    notes: '',
    hospitalId: currentHospital.id // Add hospital selection
  });

  // Update appointments when hospital changes
  React.useEffect(() => {
    if (isAllHospitals) {
      // Load appointments from all hospitals with unique IDs
      const allAppointments = mockHospitals.flatMap((h, hospitalIndex) => 
        generateMockAppointments(h.id).map((appointment, appointmentIndex) => ({
          ...appointment,
          // Make IDs unique across hospitals by prefixing with hospital index
          id: `${hospitalIndex}-${appointment.id}`
        }))
      );
      setAppointments(allAppointments);
    } else {
      setAppointments(generateMockAppointments(currentHospital.id));
    }
  }, [currentHospital.id, isAllHospitals]);

  // Get hospital-specific patients and doctors (or all if viewing all hospitals)
  const hospitalPatients = filterByHospital(mockPatients);
  const hospitalDoctors = filterByHospital(mockDoctors);

  // Filter appointments based on user role
  const getFilteredAppointments = () => {
    let filtered = appointments;
    
    // Role-based filtering
    if (userRole === 'doctor') {
      let doctorIdToFilter = '';
      
      if (currentUser?.doctorId) {
        doctorIdToFilter = currentUser.doctorId;
      } else if (currentUser?.id) {
        // Fallback: try to find by email if doctorId not set
        const doctorByEmail = hospitalDoctors.find(d => d.email === currentUser.email);
        if (doctorByEmail) {
          doctorIdToFilter = doctorByEmail.id;
        }
      }
      
      if (doctorIdToFilter) {
        filtered = filtered.filter(apt => apt.doctorId === doctorIdToFilter);
      }
    }
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(apt =>
        apt.appointmentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.doctorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.status.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Sorting logic
    return filtered.sort((a, b) => {
      let aValue: any = a[sortField as keyof Appointment];
      let bValue: any = b[sortField as keyof Appointment];

      // Handle nested properties or special fields if necessary, but direct access works for flat props
      if (sortField === 'appointmentDate') {
        aValue = a.appointmentDate.getTime();
        bValue = b.appointmentDate.getTime();
      } else {
        aValue = aValue?.toString().toLowerCase() || '';
        bValue = bValue?.toString().toLowerCase() || '';
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  };

  const filteredAppointments = getFilteredAppointments();

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
    const workSheet = XLSX.utils.json_to_sheet(filteredAppointments.map(apt => ({
      AppointmentNo: apt.appointmentNumber,
      Patient: apt.patientName,
      Doctor: apt.doctorName,
      Date: formatDate(apt.appointmentDate, currentHospital.timezone, currentHospital.calendarType),
      Time: apt.appointmentTime,
      Reason: apt.reason,
      Status: apt.status,
      Hospital: mockHospitals.find(h => h.id === apt.hospitalId)?.name || 'Unknown'
    })));
    const workBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workBook, workSheet, "Appointments");
    XLSX.writeFile(workBook, "Appointments_List.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text('Appointments Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${formatDate(new Date(), currentHospital.timezone, currentHospital.calendarType)}`, 14, 30);
    if (!isAllHospitals) {
      doc.text(`Hospital: ${currentHospital.name}`, 14, 36);
    }

    // Create table
    autoTable(doc, {
      head: [['Apt #', 'Patient', 'Doctor', 'Date', 'Time', 'Status']],
      body: filteredAppointments.map(apt => [
        apt.appointmentNumber,
        apt.patientName,
        apt.doctorName,
        formatDate(apt.appointmentDate, currentHospital.timezone, currentHospital.calendarType),
        apt.appointmentTime,
        apt.status
      ]),
      startY: isAllHospitals ? 40 : 46,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [66, 139, 202] }
    });

    doc.save('Appointments_Report.pdf');
  };

  const handlePrint = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setShowPrintModal(true);
  };

  const formatAppointmentNumber = (aptNumber: string) => {
    // Format: APT-2026-001 -> APT-2026-00001
    const parts = aptNumber.split('-');
    if (parts.length === 3) {
      const num = parts[2];
      return `${parts[0]}-${parts[1]}-${num.padStart(5, '0')}`;
    }
    return aptNumber;
  };

  const formatPatientId = (patientId: string) => {
    // Format: P004 -> P00004
    if (patientId.startsWith('P')) {
      const num = patientId.substring(1);
      return `P${num.padStart(5, '0')}`;
    }
    return patientId;
  };

  const checkAvailability = (doctorId: string, dateStr: string, timeStr: string) => {
    if (!doctorId || !dateStr) return { available: true };
    const doctor = hospitalDoctors.find(d => d.id === doctorId);
    if (!doctor || !doctor.availability) return { available: true };
    
    const date = new Date(dateStr);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const daySchedule = doctor.availability.find(d => d.day === dayName);
    
    if (!daySchedule || !daySchedule.isAvailable) {
      return { available: false, reason: `Doctor is not available on ${dayName}s` };
    }
    
    if (timeStr) {
       if (timeStr < daySchedule.startTime || timeStr > daySchedule.endTime) {
         return { available: false, reason: `Available hours: ${daySchedule.startTime} - ${daySchedule.endTime}` };
       }
    }
    return { available: true };
  };

  const handleAdd = () => {
    // Validate availability
    const availability = checkAvailability(formData.doctorId, formData.appointmentDate, formData.appointmentTime);
    if (!availability.available) {
      setToast({ message: availability.reason || 'Doctor not available', type: 'danger' });
      return;
    }

    const newAppointment: Appointment = {
      id: Date.now().toString(),
      hospitalId: formData.hospitalId, // Use selected hospital from form
      appointmentNumber: `APT-${new Date().getFullYear()}-${String(appointments.length + 1).padStart(3, '0')}`,
      patientId: formData.patientId,
      patientName: hospitalPatients.find(p => p.id === formData.patientId)?.name || '',
      patientAge: hospitalPatients.find(p => p.id === formData.patientId)?.age || 0,
      patientGender: hospitalPatients.find(p => p.id === formData.patientId)?.gender || 'male',
      doctorId: formData.doctorId,
      doctorName: hospitalDoctors.find(d => d.id === formData.doctorId)?.name || '',
      appointmentDate: new Date(formData.appointmentDate),
      appointmentTime: formData.appointmentTime,
      reason: formData.reason,
      status: 'scheduled',
      notes: formData.notes,
      createdAt: new Date(),
      createdBy: 'currentUser'
    };
    
    setAppointments([newAppointment, ...appointments]);
    setShowAddModal(false);
    resetForm();
    setToast({ message: 'Appointment scheduled successfully.', type: 'success' });
  };

  const handleEdit = () => {
    if (!selectedAppointment) return;

    // Validate availability
    const availability = checkAvailability(formData.doctorId, formData.appointmentDate, formData.appointmentTime);
    if (!availability.available) {
      setToast({ message: availability.reason || 'Doctor not available', type: 'danger' });
      return;
    }
    
    setAppointments(appointments.map(apt =>
      apt.id === selectedAppointment.id
        ? {
            ...apt,
            patientId: formData.patientId,
            patientName: hospitalPatients.find(p => p.id === formData.patientId)?.name || '',
            patientAge: hospitalPatients.find(p => p.id === formData.patientId)?.age || 0,
            patientGender: hospitalPatients.find(p => p.id === formData.patientId)?.gender || 'male',
            doctorId: formData.doctorId,
            doctorName: hospitalDoctors.find(d => d.id === formData.doctorId)?.name || '',
            appointmentDate: new Date(formData.appointmentDate),
            appointmentTime: formData.appointmentTime,
            reason: formData.reason,
            notes: formData.notes
          }
        : apt
    ));
    
    setShowEditModal(false);
    setSelectedAppointment(null);
    resetForm();
    setToast({ message: 'Appointment updated successfully.', type: 'success' });
  };

  const handleDelete = () => {
    if (!selectedAppointment) return;
    setAppointments(appointments.filter(apt => apt.id !== selectedAppointment.id));
    setShowDeleteModal(false);
    setSelectedAppointment(null);
    setToast({ message: 'Appointment deleted successfully.', type: 'success' });
  };

  const handleStatusChange = (aptId: string, newStatus: Appointment['status']) => {
    setAppointments(appointments.map(apt =>
      apt.id === aptId ? { ...apt, status: newStatus } : apt
    ));
    setToast({ message: `Appointment marked as ${newStatus}.`, type: 'success' });
  };

  const resetForm = () => {
    setFormData({
      patientId: '',
      doctorId: '',
      appointmentDate: '',
      appointmentTime: '',
      reason: '',
      notes: '',
      hospitalId: currentHospital.id // Add hospital selection
    });
  };

  const openEditModal = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setFormData({
      patientId: apt.patientId,
      doctorId: apt.doctorId,
      appointmentDate: apt.appointmentDate.toISOString().split('T')[0],
      appointmentTime: apt.appointmentTime,
      reason: apt.reason,
      notes: apt.notes || '',
      hospitalId: apt.hospitalId // Add hospital selection
    });
    setShowEditModal(true);
  };

  const getStatusColor = (status: Appointment['status']) => {
    const colors = {
      scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      no_show: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
    };
    return colors[status];
  };

  const getStatusIcon = (status: Appointment['status']) => {
    const icons = {
      scheduled: <Clock className="w-3 h-3" />,
      completed: <CheckCircle className="w-3 h-3" />,
      cancelled: <XCircle className="w-3 h-3" />,
      no_show: <AlertCircle className="w-3 h-3" />
    };
    return icons[status];
  };

  // Check permissions
  const canCreate = ['super_admin', 'admin', 'receptionist'].includes(userRole);
  const canEdit = ['super_admin', 'admin', 'receptionist'].includes(userRole);
  const canDelete = ['super_admin', 'admin'].includes(userRole);
  const canChangeAnyStatus = ['super_admin', 'admin'].includes(userRole);

  return (
    <div className="space-y-3">
      {/* Compact Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Appointments</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Manage patient appointments for {isAllHospitals ? 'All Hospitals' : currentHospital.name}
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
              placeholder="Search appointments..."
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
          {canCreate && (
            <button
              onClick={() => {
                const defaultDoctorId = getDefaultDoctorId(currentHospital.id) || '';
                setFormData({
                  patientId: '',
                  doctorId: defaultDoctorId,
                  appointmentDate: '',
                  appointmentTime: '',
                  reason: '',
                  notes: '',
                  hospitalId: currentHospital.id // Add hospital selection
                });
                setShowAddModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              New Appointment
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

      {/* Appointments Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="overflow-x-auto rounded-t-lg" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          <table className="w-full text-left border-collapse relative">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
              <tr>
                <th onClick={() => handleSort('appointmentNumber')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Apt #
                    {renderSortIcon('appointmentNumber')}
                  </div>
                </th>
                <th onClick={() => handleSort('patientName')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Patient
                    {renderSortIcon('patientName')}
                  </div>
                </th>
                <th onClick={() => handleSort('doctorName')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Doctor
                    {renderSortIcon('doctorName')}
                  </div>
                </th>
                <th onClick={() => handleSort('appointmentDate')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Date & Time
                    {renderSortIcon('appointmentDate')}
                  </div>
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Reason</th>
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
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                        <Calendar className="w-6 h-6 text-gray-400 opacity-50" />
                      </div>
                      <p className="text-sm font-medium">No appointments found</p>
                      <p className="text-xs mt-1">Try adjusting your search terms</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                    <td className="px-4 py-2">
                      <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 font-mono">{apt.appointmentNumber}</span>
                    </td>
                    <td className="px-4 py-2">
                      <div>
                        <div className="text-xs font-medium text-gray-900 dark:text-white">{apt.patientName}</div>
                        <div className="text-[10px] text-gray-600 dark:text-gray-400">{apt.patientAge}Y • {apt.patientGender}</div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-xs text-gray-900 dark:text-white">{apt.doctorName}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-600 dark:text-gray-400">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(apt.appointmentDate, currentHospital.timezone, currentHospital.calendarType)}</span>
                        <Clock className="w-3 h-3 ml-1" />
                        <span>{apt.appointmentTime}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-xs text-gray-900 dark:text-white truncate max-w-xs">{apt.reason}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="relative">
                        <button
                          onClick={() => {
                            if ((canChangeAnyStatus) || (apt.status === 'scheduled' && canEdit)) {
                              setOpenStatusDropdown(openStatusDropdown === apt.id ? null : apt.id);
                            }
                          }}
                          disabled={!canChangeAnyStatus && (apt.status !== 'scheduled' || !canEdit)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(apt.status)} ${
                            (canChangeAnyStatus || (apt.status === 'scheduled' && canEdit)) 
                              ? 'cursor-pointer hover:ring-1 hover:ring-blue-500 hover:ring-offset-1 dark:hover:ring-offset-gray-800' 
                              : 'cursor-default'
                          }`}
                        >
                          {getStatusIcon(apt.status)}
                          {apt.status.replace('_', ' ').charAt(0).toUpperCase() + apt.status.replace('_', ' ').slice(1)}
                        </button>
                        {((canChangeAnyStatus) || (apt.status === 'scheduled' && canEdit)) && openStatusDropdown === apt.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-10" 
                              onClick={() => setOpenStatusDropdown(null)}
                            />
                            <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-xl p-1 z-20 min-w-[120px]">
                              {apt.status !== 'scheduled' && canChangeAnyStatus && (
                                <button
                                  onClick={() => {
                                    handleStatusChange(apt.id, 'scheduled');
                                    setOpenStatusDropdown(null);
                                  }}
                                  className="block w-full text-left px-2 py-1.5 text-[10px] text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
                                >
                                  Reschedule
                                </button>
                              )}
                              {apt.status === 'scheduled' && (
                                <>
                                  <button
                                    onClick={() => {
                                      handleStatusChange(apt.id, 'completed');
                                      setOpenStatusDropdown(null);
                                    }}
                                    className="block w-full text-left px-2 py-1.5 text-[10px] text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
                                  >
                                    Mark Completed
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleStatusChange(apt.id, 'cancelled');
                                      setOpenStatusDropdown(null);
                                    }}
                                    className="block w-full text-left px-2 py-1.5 text-[10px] text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleStatusChange(apt.id, 'no_show');
                                      setOpenStatusDropdown(null);
                                    }}
                                    className="block w-full text-left px-2 py-1.5 text-[10px] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
                                  >
                                    No Show
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handlePrint(apt)}
                          className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-md transition-colors"
                          title="Print Fees Card"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => openEditModal(apt)}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => {
                              setSelectedAppointment(apt);
                              setShowDeleteModal(true);
                            }}
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
          <span>Total Records: <span className="font-semibold text-gray-900 dark:text-white">{filteredAppointments.length}</span></span>
          <span>Showing {filteredAppointments.length} of {appointments.length} appointments</span>
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
                {showAddModal ? 'New Appointment' : 'Edit Appointment'}
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
            <form onSubmit={(e) => { e.preventDefault(); showAddModal ? handleAdd() : handleEdit(); }} className="p-4 space-y-3">
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
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Patient <span className="text-red-500">*</span></label>
                  <select
                    value={formData.patientId}
                    onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                    required
                  >
                    <option value="">Select Patient</option>
                    {hospitalPatients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.patientId})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Doctor <span className="text-red-500">*</span></label>
                  <select
                    value={formData.doctorId}
                    onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                    required
                  >
                    <option value="">Select Doctor</option>
                    {hospitalDoctors.map(d => (
                      <option key={d.id} value={d.id}>Dr. {d.name} ({d.specialization})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={formData.appointmentDate}
                    onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })}
                    className={`w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border ${
                      checkAvailability(formData.doctorId, formData.appointmentDate, '').available 
                        ? 'border-gray-300 dark:border-gray-600' 
                        : 'border-red-500 focus:ring-red-500'
                    } rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all`}
                    required
                  />
                  {formData.appointmentDate && !checkAvailability(formData.doctorId, formData.appointmentDate, '').available && (
                    <p className="text-[10px] text-red-500 mt-0.5">
                      {checkAvailability(formData.doctorId, formData.appointmentDate, '').reason}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Time <span className="text-red-500">*</span></label>
                  <input
                    type="time"
                    value={formData.appointmentTime}
                    onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
                    className={`w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border ${
                      checkAvailability(formData.doctorId, formData.appointmentDate, formData.appointmentTime).available 
                        ? 'border-gray-300 dark:border-gray-600' 
                        : 'border-red-500 focus:ring-red-500'
                    } rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all`}
                    required
                  />
                  {formData.appointmentTime && !checkAvailability(formData.doctorId, formData.appointmentDate, formData.appointmentTime).available && (
                    <p className="text-[10px] text-red-500 mt-0.5">
                      {checkAvailability(formData.doctorId, formData.appointmentDate, formData.appointmentTime).reason}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Reason for Visit <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g. Regular Checkup"
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                  rows={2}
                  placeholder="Additional notes..."
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
                  {showAddModal ? 'Create' : 'Save'}
                </button>
              </div>
            </form>
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
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Appointment</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete appointment <strong>{selectedAppointment?.appointmentNumber}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Print Fees Card Modal */}
      {showPrintModal && selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           {/* Robust Print Styles */}
          <style>
            {`
              @media print {
                body * {
                  visibility: hidden;
                }
                #fees-card-print, #fees-card-print * {
                  visibility: visible;
                }
                #fees-card-print {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  height: auto !important;
                  margin: 0;
                  padding: 20px;
                  background: white;
                  display: block !important;
                }
                @page {
                  size: auto;
                  margin: 0;
                }
              }
            `}
          </style>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-white">Print Fees Card</h3>
              <button onClick={() => setShowPrintModal(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex justify-center bg-gray-100 dark:bg-gray-900">
              {/* Actual Card to Print */}
              <div id="fees-card-print" className="bg-white p-8 w-full max-w-[148mm] shadow-sm border border-gray-200 text-gray-900">
                 {/* Header */}
                 <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
                    <h1 className="text-2xl font-bold text-gray-900 uppercase">{currentHospital.name}</h1>
                    <p className="text-sm text-gray-600">{currentHospital.address}</p>
                    <p className="text-sm text-gray-600">{currentHospital.phone}</p>
                    <div className="mt-2 inline-block px-4 py-1 bg-blue-600 text-white text-sm font-bold uppercase tracking-wider rounded-full">
                      OPD Appointment Card
                    </div>
                 </div>

                 {/* Content Grid */}
                 <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm mb-6">
                    <div className="col-span-2 flex justify-between items-end border-b border-gray-200 pb-2">
                       <div>
                         <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Appointment No</label>
                         <span className="text-base font-mono font-bold text-gray-900">{formatAppointmentNumber(selectedAppointment.appointmentNumber)}</span>
                       </div>
                       <div className="text-right">
                          <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Date & Time</label>
                          <span className="font-medium text-gray-900">{formatOnlyDate(selectedAppointment.appointmentDate, currentHospital.timezone, currentHospital.calendarType)} | {selectedAppointment.appointmentTime}</span>
                       </div>
                    </div>

                    <div className="col-span-2">
                       <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Patient Details</label>
                       <div className="font-bold text-lg text-gray-900">{selectedAppointment.patientName}</div>
                       <div className="text-gray-600">{selectedAppointment.patientAge} Years / {selectedAppointment.patientGender}</div>
                       <div className="text-xs text-gray-400 mt-1">ID: {formatPatientId(selectedAppointment.patientId)}</div>
                    </div>

                    <div className="col-span-2 mt-2">
                       <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Assigned Doctor</label>
                       <div className="font-bold text-lg text-gray-900">{selectedAppointment.doctorName}</div>
                       <div className="text-gray-600">
                         {hospitalDoctors.find(d => d.id === selectedAppointment.doctorId)?.specialization || 'General Physician'}
                       </div>
                    </div>

                    <div className="col-span-2 border-t-2 border-dashed border-gray-300 pt-4 mt-2">
                       <div className="flex justify-between items-center">
                          <span className="font-bold text-lg uppercase text-gray-700">Consultation Fee</span>
                          <span className="font-bold text-2xl text-gray-900">
                            {(hospitalDoctors.find(d => d.id === selectedAppointment.doctorId)?.consultationFee || 0).toFixed(2)}
                          </span>
                       </div>
                    </div>
                 </div>

                 {/* Footer */}
                 <div className="text-center text-[10px] text-gray-400 mt-8 pt-4 border-t border-gray-100">
                    <p>Printed on: {formatDate(new Date(), currentHospital.timezone, currentHospital.calendarType)}</p>
                    <p>Please bring this card for follow-up visits.</p>
                 </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex justify-end gap-2">
              <button 
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Close
              </button>
              <button 
                onClick={() => window.print()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}