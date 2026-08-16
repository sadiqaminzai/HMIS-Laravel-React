import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, Plus, Edit, Trash2, X, Search, CheckCircle, XCircle, AlertCircle, Printer, FileText, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown, ToggleRight, Eye } from 'lucide-react';
import { Hospital, Appointment, UserRole, Patient, Doctor } from '../types';
import { Toast } from './Toast';
import { useSubmitGuard } from '../hooks/useSubmitGuard';
import { SearchableSelect } from './SearchableSelect';
import { useSettings } from '../context/SettingsContext';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { formatDate, formatOnlyDate, getISODateInTimeZone, getTimeInTimeZone, getWeekdayFromDateString } from '../utils/date';
import { usePatients } from '../context/PatientContext';
import { useDoctors } from '../context/DoctorContext';
import { useAppointments } from '../context/AppointmentContext';
import { useHospitals } from '../context/HospitalContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { poweredByHtml } from '../utils/receiptBranding';
import { AddButton } from './AddButton';

interface AppointmentManagementProps {
  hospital: Hospital;
  userRole: UserRole;
  currentUser?: { id: string; name: string; email: string; role: UserRole; doctorId?: string };
}

const truncateText = (value: string, maxLength: number): string => {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 3)}...`;
};


/** Grouped block in the details modal. */
function ViewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700/40 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
        {title}
      </div>
      <div className="px-3 py-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4">{children}</div>
    </div>
  );
}

/** Label/value pair; renders a dash rather than nothing when a value is absent. */
function ViewRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 border-b border-gray-100 dark:border-gray-700/60 last:border-0">
      <span className="text-[11px] text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
      <span className="text-xs font-medium text-gray-900 dark:text-white text-right min-w-0 break-words">
        {value ? value : '—'}
      </span>
    </div>
  );
}

const formatDoctorOptionLabel = (doctor: Doctor): string => {
  const cleanedName = String(doctor.name || '').replace(/^dr\.?\s*/i, '').trim();
  const nameLabel = cleanedName ? `Dr. ${cleanedName}` : 'Doctor';
  const specialization = String(doctor.specialization || '').trim();

  if (!specialization) return nameLabel;
  return `${nameLabel} (${truncateText(specialization, 52)})`;
};

const toDateInputValue = (value?: Date | string | null): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function AppointmentManagement({ hospital, userRole, currentUser }: AppointmentManagementProps) {
  const { t } = useTranslation();
  
      const doctorNeedsLinking =
        currentUser?.role === 'doctor' &&
        (currentUser.doctorId === null || currentUser.doctorId === undefined || `${currentUser.doctorId}`.trim() === '');
  // Hospital filtering for super_admin with "All Hospitals" support
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  const { patients } = usePatients();
  const { doctors } = useDoctors();
  const { appointments, refresh, addAppointment, updateAppointment, deleteAppointment } = useAppointments();
  const { hospitals } = useHospitals();
  const { hasPermission } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'danger' } | null>(null);
  const [openStatusDropdown, setOpenStatusDropdown] = useState<string | null>(null);
  // Ref-backed: two clicks in one frame cannot both pass the check, which
  // is how duplicate appointments were being created on a slow connection.
  const { submitting, guard } = useSubmitGuard();
  const { getDefaultDoctorId, getPrintPaperSize, loadHospitalSetting } = useSettings();
  
  // Sorting state
  const [sortField, setSortField] = useState<string>('appointmentDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const today = (tz: string = currentHospital.timezone || 'Asia/Kabul') => getISODateInTimeZone(tz);
  const nowTime = (tz: string = currentHospital.timezone || 'Asia/Kabul') => getTimeInTimeZone(tz);

  const [formData, setFormData] = useState({
    patientId: '',
    doctorId: '',
    appointmentDate: today(),
    appointmentTime: '',
    reason: '',
    notes: '',
    hospitalId: currentHospital.id,
    originalFeeAmount: '',
    discountEnabled: false,
    discountAmount: '',
    paymentStatus: 'paid' as NonNullable<Appointment['paymentStatus']>,
  });

  const calculateTotals = () => {
    const original = Math.max(0, Number(formData.originalFeeAmount || 0));
    const manualDiscount = Math.max(0, Number(formData.discountAmount || 0));
    const discount = formData.discountEnabled ? original : Math.min(original, manualDiscount);
    const total = Math.max(0, original - discount);
    return { original, discount, total };
  };

  const feePreview = calculateTotals();
  React.useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get hospital-specific patients and doctors (or all if viewing all hospitals)
  // Newest patient first: reception almost always books for someone just
  // registered, so the most recent record should be at the top of the list.
  const hospitalPatients = [...filterByHospital(patients)].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    // Fall back to id so records with no timestamp still order predictably.
    return Number(b.id) - Number(a.id);
  });
  const hospitalDoctors = filterByHospital(doctors);

  const patientOptions = hospitalPatients.map((p) => ({
    value: p.id,
    label: p.name,
    meta: [p.patientId, p.phone].filter(Boolean).join('  \u00b7  '),
  }));

  const doctorOptions = hospitalDoctors.map((d) => ({
    value: d.id,
    label: formatDoctorOptionLabel(d),
    meta: [d.specialization, d.registrationNumber].filter(Boolean).join('  \u00b7  '),
  }));
  const patientsById = React.useMemo(() => {
    return new Map(patients.map((patient) => [String(patient.id), patient]));
  }, [patients]);

  const getAppointmentPatientPhone = (apt: Appointment) =>
    String(apt.patientPhone || patientsById.get(String(apt.patientId))?.phone || '').trim();

  // Filter appointments based on hospital and user role
  const getFilteredAppointments = () => {
    let filtered = filterByHospital(appointments);
    
    // Role-based filtering
    if (userRole === 'doctor') {
      // Doctors are users now; appointment.doctorId is users.id.
      const doctorUserId = currentUser?.id ? String(currentUser.id) : '';
      filtered = doctorUserId ? filtered.filter((apt) => String(apt.doctorId) === doctorUserId) : [];
    }
    
    // Search filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter((apt) => {
        const dateLabel = formatOnlyDate(apt.appointmentDate, currentHospital.timezone, currentHospital.calendarType).toLowerCase();
        const timeLabel = String(apt.appointmentTime || '').toLowerCase();
        const patientPhone = getAppointmentPatientPhone(apt).toLowerCase();
        return (
          apt.appointmentNumber.toLowerCase().includes(q) ||
          apt.patientName.toLowerCase().includes(q) ||
          patientPhone.includes(q) ||
          apt.doctorName.toLowerCase().includes(q) ||
          apt.status.toLowerCase().includes(q) ||
          dateLabel.includes(q) ||
          timeLabel.includes(q)
        );
      });
    }
    
    // Sorting logic
    return filtered.sort((a, b) => {
      let aValue: any = a[sortField as keyof Appointment];
      let bValue: any = b[sortField as keyof Appointment];

      // Handle nested properties or special fields if necessary, but direct access works for flat props
      if (sortField === 'appointmentDate') {
        const aTime = String(a.appointmentTime || '00:00').slice(0, 5);
        const bTime = String(b.appointmentTime || '00:00').slice(0, 5);
        aValue = new Date(`${toDateInputValue(a.appointmentDate)}T${aTime || '00:00'}`).getTime();
        bValue = new Date(`${toDateInputValue(b.appointmentDate)}T${bTime || '00:00'}`).getTime();
      } else if (sortField === 'createdAt' || sortField === 'updatedAt') {
        aValue = aValue instanceof Date ? aValue.getTime() : (aValue ? new Date(aValue).getTime() : 0);
        bValue = bValue instanceof Date ? bValue.getTime() : (bValue ? new Date(bValue).getTime() : 0);
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
  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredAppointments.length / itemsPerPage));

  const paginatedAppointments = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAppointments.slice(start, start + itemsPerPage);
  }, [filteredAppointments, currentPage]);

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
    const workSheet = XLSX.utils.json_to_sheet(filteredAppointments.map(apt => ({
      AppointmentNo: apt.appointmentNumber,
      Patient: apt.patientName,
      Doctor: apt.doctorName,
      Date: formatOnlyDate(apt.appointmentDate, currentHospital.timezone, currentHospital.calendarType),
      Time: apt.appointmentTime || '-',
      Reason: apt.reason,
      OriginalFee: apt.originalFeeAmount ?? 0,
      Discount: apt.discountAmount ?? 0,
      TotalFee: apt.totalAmount ?? Math.max(0, (apt.originalFeeAmount ?? 0) - (apt.discountAmount ?? 0)),
      PaymentStatus: apt.paymentStatus ?? 'pending',
      Status: apt.status,
      Hospital: hospitals.find(h => h.id === apt.hospitalId)?.name || 'Unknown'
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
      head: [['Apt #', 'Patient', 'Doctor', 'Date', 'Time', 'Original', 'Discount', 'Total', 'Status']],
      body: filteredAppointments.map(apt => [
        apt.appointmentNumber,
        apt.patientName,
        apt.doctorName,
        formatOnlyDate(apt.appointmentDate, currentHospital.timezone, currentHospital.calendarType),
        apt.appointmentTime || '-',
        String((apt.originalFeeAmount ?? 0).toFixed(2)),
        String((apt.discountAmount ?? 0).toFixed(2)),
        String((apt.totalAmount ?? Math.max(0, (apt.originalFeeAmount ?? 0) - (apt.discountAmount ?? 0))).toFixed(2)),
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

  const handlePrintFeesCard = () => {
    if (!selectedAppointment) {
      setToast({ message: 'Fees card is not ready for printing.', type: 'danger' });
      return;
    }

    // Paper size comes from Settings > General > Print Paper Size (Appointment / OPD Bill).
    const opdSize = getPrintPaperSize(selectedAppointment.hospitalId || currentHospital.id, 'appointment_receipt');
    const opdIsA4 = opdSize === 'a4';
    const opdPageSize = opdIsA4 ? 'A4' : `${opdSize} auto`;
    const opdBodyWidth = opdIsA4
      ? 'auto'
      : opdSize === '58mm' ? '54mm' : opdSize === '76mm' ? '72mm' : '76mm';

    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) {
      setToast({ message: 'Unable to open print window. Please allow pop-ups.', type: 'warning' });
      return;
    }

    const doctorSpecialization = hospitalDoctors.find(d => d.id === selectedAppointment.doctorId)?.specialization || 'General Physician';
    const totalAmount = selectedAppointment.totalAmount ?? Math.max(0, (selectedAppointment.originalFeeAmount ?? 0) - (selectedAppointment.discountAmount ?? 0));
    const patientDisplayId = selectedAppointment.patientDisplayId || formatPatientId(selectedAppointment.patientId);
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>OPD Appointment Card</title>
          <style>
              @page { size: ${opdPageSize}; margin: ${opdIsA4 ? '10mm' : '0'}; }
              /* Patient left, doctor/appointment right. The stacked version
                 repeated a label on every line and ran to eleven rows; this
                 says the same in five, which on a roll is five fewer lines of
                 paper per patient. */
              .two-col { display: flex; gap: ${opdIsA4 ? '16px' : '6px'}; align-items: flex-start; margin-top: 6px; }
              .two-col .col { flex: 1; min-width: 0; }
              .two-col .col-sep { width: 1px; align-self: stretch; background: #000; }
              .two-col .col-head {
                font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
                font-size: ${opdIsA4 ? '12px' : '10px'};
                border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 3px;
              }
              .two-col .col-row { display: flex; flex-direction: column; margin-bottom: 3px; }
              .two-col .k { color: #000; font-size: ${opdIsA4 ? '11px' : '9px'}; text-transform: uppercase; letter-spacing: 0.04em; }
              .two-col .v { color: #000; font-weight: 600; word-break: break-word; }
              body {
                  margin: 0;
                  padding: 2mm;
                  font-family: Arial, sans-serif;
                  width: ${opdBodyWidth};
                  color: #000; 
                  font-size: 11px; 
                  line-height: 1.3; 
                  background: #fff; 
              }
              .card-wrapper { padding-bottom: 2mm; page-break-inside: avoid; break-inside: avoid; }
              * { color: #000 !important; opacity: 1 !important; }
              .text-center { text-align: center; }
              .font-bold { font-weight: bold; }
              .text-lg { font-size: 14px; }
              .text-xl { font-size: 16px; }
              .mt-2 { margin-top: 4px; }
              .mt-4 { margin-top: 8px; }
              .mb-2 { margin-bottom: 4px; }
              .mb-4 { margin-bottom: 8px; }
              .uppercase { text-transform: uppercase; }
              .dashed-line { border-top: 1px dashed #000; margin: 6px 0; }
              .flex-between { display: flex; justify-content: space-between; }
              .label { font-weight: bold; width: 45%; }
              .val { width: 55%; text-align: right; }
          </style>
      </head>
      <body>
            <div class="card-wrapper">
          <div class="text-center mb-4">
              <div class="font-bold text-xl uppercase">${currentHospital.name}</div>
              ${currentHospital.address ? `<div>${currentHospital.address}</div>` : ''}
              ${currentHospital.phone ? `<div>${currentHospital.phone}</div>` : ''}
              <div class="font-bold mt-2 uppercase">OPD Appointment Card</div>
          </div>

          <div class="two-col">
              <div class="col">
                  <div class="col-head">Patient Details</div>
                  <div class="col-row"><span class="k">Name</span><span class="v">${selectedAppointment.patientName}</span></div>
                  <div class="col-row"><span class="k">ID</span><span class="v">${patientDisplayId}</span></div>
                  <div class="col-row"><span class="k">Age / Gender</span><span class="v">${selectedAppointment.patientAge} Y / ${selectedAppointment.patientGender}</span></div>
                  ${(() => {
                    // Appointments do not always carry the phone; the helper
                    // falls back to the patient record, same as the list view.
                    const phone = getAppointmentPatientPhone(selectedAppointment);
                    return phone ? `<div class="col-row"><span class="k">Contact</span><span class="v">${phone}</span></div>` : '';
                  })()}
              </div>

              <div class="col-sep"></div>

              <div class="col">
                  <div class="col-head">Appointment</div>
                  <div class="col-row"><span class="k">Doctor</span><span class="v">${selectedAppointment.doctorName}</span></div>
                  <div class="col-row"><span class="k">Specialization</span><span class="v">${doctorSpecialization}</span></div>
                  <div class="col-row"><span class="k">Token No</span><span class="v">${formatAppointmentNumber(selectedAppointment.appointmentNumber)}</span></div>
                  <div class="col-row"><span class="k">Date</span><span class="v">${formatOnlyDate(selectedAppointment.appointmentDate, currentHospital.timezone, currentHospital.calendarType)}</span></div>
                  ${selectedAppointment.appointmentTime
                    ? `<div class="col-row"><span class="k">Time</span><span class="v">${selectedAppointment.appointmentTime}</span></div>`
                    : ''}
              </div>
          </div>

          <div class="dashed-line"></div>

          <div class="flex-between mt-2">
              <span class="label">Original Fee:</span>
              <span class="val">${(selectedAppointment.originalFeeAmount ?? 0).toFixed(2)} ${selectedAppointment.currency ?? 'AFN'}</span>
          </div>
          <div class="flex-between mt-2">
              <span class="label">Discount:</span>
              <span class="val">${(selectedAppointment.discountAmount ?? 0).toFixed(2)}</span>
          </div>
          <div class="flex-between mt-2 font-bold text-lg">
              <span class="label">Payable Total:</span>
              <span class="val">${totalAmount.toFixed(2)}</span>
          </div>

          <div class="dashed-line"></div>

          <div class="text-center mt-2 mb-2" style="font-size: 11px; page-break-inside: avoid; break-inside: avoid;">
              <div>Printed on: ${formatDate(new Date(), currentHospital.timezone, currentHospital.calendarType)}</div>
              <div class="mt-1">Please bring this card for follow-up visits.</div>
              ${poweredByHtml(!opdIsA4)}
          </div>
        </div>
        <script>
            window.onload = function() {
                setTimeout(function() {
                    window.print();
                    window.close();
                }, 250);
            }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const formatAppointmentNumber = (aptNumber: string) => {
    // Normalize to APT-{hospitalId}-{year}-{seq5}
    const parts = aptNumber.split('-');
    if (parts.length >= 4) {
      const hospitalId = parts[1];
      const rawYear = parts[2];
      const year = rawYear.slice(0, 4); // strip timestamp if present
      const seq = parts[parts.length - 1];
      return `APT-${hospitalId}-${year}-${seq.padStart(5, '0')}`;
    }
    if (parts.length === 3) {
      const seq = parts[2];
      return `${parts[0]}-${parts[1]}-${seq.padStart(5, '0')}`;
    }
    return aptNumber;
  };

  const formatPatientId = (patientId: string) => {
    if (!patientId) return '-';
    if (/[^0-9]/.test(patientId) && !/^P\d+$/i.test(patientId)) return patientId;
    const normalized = patientId.startsWith('P') ? patientId.substring(1) : patientId;
    return normalized.padStart(5, '0');
  };

  const checkAvailability = (doctorId: string, dateStr: string, timeStr: string) => {
    if (!doctorId || !dateStr) return { available: true };
    const doctor = hospitalDoctors.find(d => d.id === doctorId);
    if (!doctor || !doctor.availability) return { available: true };

    const normalizeTime = (value?: string) => {
      if (!value) return '';
      const trimmed = value.trim();
      // Convert "hh:mm AM/PM" to 24h
      const match = trimmed.match(/^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i);
      if (match) {
        let hours = Number(match[1]);
        const minutes = match[2];
        const meridiem = match[3].toUpperCase();
        if (meridiem === 'PM' && hours < 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;
        return `${String(hours).padStart(2, '0')}:${minutes}`;
      }
      return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
    };

    const dayName = getWeekdayFromDateString(dateStr);
    const daySchedule = doctor.availability.find(d => String(d.day || '').toLowerCase() === dayName.toLowerCase());

    if (!daySchedule || !daySchedule.isAvailable) {
      return { available: false, reason: `Doctor is not available on ${dayName}s` };
    }

    if (timeStr) {
      const from = normalizeTime(daySchedule.startTime);
      const to = normalizeTime(daySchedule.endTime);
      const selected = normalizeTime(timeStr);

      // If schedule times are missing or both are 00:00, skip time validation.
      if (!from || !to || (from === '00:00' && to === '00:00')) {
        return { available: true };
      }

      if (selected && (selected < from || selected > to)) {
        return { available: false, reason: `Available hours: ${from} - ${to}` };
      }
    }
    return { available: true };
  };

  const handleAdd = guard(async () => {
    if (!canCreate) {
      setToast({ message: 'You are not authorized to schedule appointments.', type: 'warning' });
      return;
    }
    // Validate availability
    const availability = checkAvailability(formData.doctorId, formData.appointmentDate, formData.appointmentTime);
    if (!availability.available) {
      setToast({ message: availability.reason || 'Doctor not available', type: 'danger' });
      return;
    }
    const patient = hospitalPatients.find(p => p.id === formData.patientId);
    const appointmentDate = formData.appointmentDate || today();
    const appointmentTime = formData.appointmentTime?.trim() || '';
    await addAppointment({
      hospitalId: formData.hospitalId,
      patientId: formData.patientId,
      doctorId: formData.doctorId,
      appointmentDate,
      appointmentTime,
      reason: formData.reason,
      status: 'scheduled',
      notes: formData.notes,
      originalFeeAmount: feePreview.original,
      discountEnabled: formData.discountEnabled,
      discountAmount: feePreview.discount,
      totalAmount: feePreview.total,
      currency: 'AFN',
      paymentStatus: formData.paymentStatus,
      patientName: patient?.name,
      patientAge: patient?.age,
      patientGender: patient?.gender,
    }).then(() => {
      setShowAddModal(false);
      resetForm();
      setToast({ message: 'Appointment scheduled successfully.', type: 'success' });
    }).catch((err: any) => {
      setToast({ message: err?.response?.data?.message || 'Failed to schedule appointment.', type: 'danger' });
    });
  });

  const handleEdit = guard(async () => {
    if (!selectedAppointment) return;

    if (!canEdit) {
      setToast({ message: 'You are not authorized to manage appointments.', type: 'warning' });
      return;
    }

    // Validate availability
    const availability = checkAvailability(formData.doctorId, formData.appointmentDate, formData.appointmentTime);
    if (!availability.available) {
      setToast({ message: availability.reason || 'Doctor not available', type: 'danger' });
      return;
    }
    
    const patient = hospitalPatients.find(p => p.id === formData.patientId);
    const appointmentDate = formData.appointmentDate || today();
    const appointmentTime = formData.appointmentTime?.trim() || '';
    await updateAppointment({
      id: selectedAppointment.id,
      hospitalId: formData.hospitalId,
      patientId: formData.patientId,
      doctorId: formData.doctorId,
      appointmentDate,
      appointmentTime,
      reason: formData.reason,
      notes: formData.notes,
      originalFeeAmount: feePreview.original,
      discountEnabled: formData.discountEnabled,
      discountAmount: feePreview.discount,
      totalAmount: feePreview.total,
      currency: 'AFN',
      paymentStatus: formData.paymentStatus,
      patientName: patient?.name,
      patientAge: patient?.age,
      patientGender: patient?.gender,
      status: selectedAppointment.status,
    }).then(() => {
      setShowEditModal(false);
      setSelectedAppointment(null);
      resetForm();
      setToast({ message: 'Appointment updated successfully.', type: 'success' });
    }).catch((err: any) => {
      setToast({ message: err?.response?.data?.message || 'Failed to update appointment.', type: 'danger' });
    });
  });

  const handleDelete = () => {
    if (!selectedAppointment) return;
    if (!canDelete) {
      setToast({ message: 'You are not authorized to manage appointments.', type: 'warning' });
      return;
    }
    deleteAppointment(selectedAppointment.id)
      .then(() => {
        setShowDeleteModal(false);
        setSelectedAppointment(null);
        setToast({ message: 'Appointment deleted successfully.', type: 'success' });
      })
      .catch((err: any) => {
        setToast({ message: err?.response?.data?.message || 'Failed to delete appointment.', type: 'danger' });
      });
  };

  const handleStatusChange = (aptId: string, newStatus: Appointment['status']) => {
    const target = appointments.find(a => a.id === aptId);
    if (!target) return;

    if (!canChangeAnyStatus) {
      setToast({ message: 'You are not authorized to change appointment status.', type: 'warning' });
      return;
    }

    updateAppointment({
      id: aptId,
      status: newStatus,
      hospitalId: target.hospitalId,
      doctorId: target.doctorId,
      patientId: target.patientId,
      patientName: target.patientName,
      patientAge: target.patientAge,
      patientGender: target.patientGender,
      appointmentDate: target.appointmentDate,
      appointmentTime: target.appointmentTime,
      reason: target.reason,
      notes: target.notes,
      originalFeeAmount: target.originalFeeAmount,
      discountEnabled: target.discountEnabled,
      discountAmount: target.discountAmount,
      totalAmount: target.totalAmount,
      currency: target.currency,
      paymentStatus: target.paymentStatus,
    })
      .then(() => setToast({ message: `Appointment marked as ${newStatus}.`, type: 'success' }))
      .catch((err: any) => setToast({ message: err?.response?.data?.message || 'Failed to update status.', type: 'danger' }));
  };

  const handlePaymentStatusToggle = (apt: Appointment) => {
    const nextPaymentStatus: NonNullable<Appointment['paymentStatus']> =
      apt.paymentStatus === 'paid' ? 'pending' : 'paid';

    updateAppointment({
      id: apt.id,
      hospitalId: apt.hospitalId,
      patientId: apt.patientId,
      doctorId: apt.doctorId,
      patientName: apt.patientName,
      patientAge: apt.patientAge,
      patientGender: apt.patientGender,
      appointmentDate: apt.appointmentDate,
      appointmentTime: apt.appointmentTime,
      reason: apt.reason,
      notes: apt.notes,
      status: apt.status,
      originalFeeAmount: apt.originalFeeAmount,
      discountEnabled: apt.discountEnabled,
      discountAmount: apt.discountAmount,
      totalAmount: apt.totalAmount,
      currency: apt.currency,
      paymentStatus: nextPaymentStatus,
    })
      .then(() => setToast({ message: `Payment marked as ${nextPaymentStatus}.`, type: 'success' }))
      .catch((err: any) => setToast({ message: err?.response?.data?.message || 'Failed to update payment status.', type: 'danger' }));
  };

  const resetForm = () => {
    setFormData({
      patientId: '',
      doctorId: '',
      appointmentDate: today(),
    appointmentTime: '',
      reason: '',
      notes: '',
      hospitalId: currentHospital.id,
      originalFeeAmount: '',
      discountEnabled: false,
      discountAmount: '',
      paymentStatus: 'paid',
    });
  };

  const openEditModal = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setFormData({
      patientId: apt.patientId,
      doctorId: apt.doctorId,
      appointmentDate: toDateInputValue(apt.appointmentDate),
      appointmentTime: apt.appointmentTime || '',
      reason: apt.reason,
      notes: apt.notes || '',
      hospitalId: apt.hospitalId,
      originalFeeAmount: String(apt.originalFeeAmount ?? ''),
      discountEnabled: Boolean(apt.discountEnabled ?? false),
      discountAmount: String(apt.discountAmount ?? ''),
      paymentStatus: apt.paymentStatus ?? 'paid',
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
  const canCreate = hasPermission('add_appointments') || hasPermission('schedule_appointments') || hasPermission('manage_appointments');
  const canEdit = hasPermission('edit_appointments') || hasPermission('manage_appointments');
  const canDelete = hasPermission('delete_appointments') || hasPermission('manage_appointments');
  const canExport = hasPermission('export_appointments') || hasPermission('manage_appointments');
  const canPrint = hasPermission('print_appointments') || hasPermission('manage_appointments');
  const canChangeAnyStatus = hasPermission('update_appointment_status') || hasPermission('manage_appointments');
  // Fee concessions and payment state are privileged; the backend strips these
  // values too, so disabling the inputs here is purely a UX affordance.
  const canApplyDiscount = hasPermission('add_discounts') || hasPermission('edit_discounts') || hasPermission('manage_discounts');
  const canSetPaymentStatus = hasPermission('manage_appointment_payments') || hasPermission('manage_appointments');
  // Changing the headline fee moves money exactly as a discount does, so it is
  // gated rather than left open to whoever can book an appointment.
  const canSetOriginalFee = hasPermission('override_appointment_fee')
    || hasPermission('manage_appointment_payments')
    || hasPermission('manage_appointments');
  const canCollectFee = hasPermission('manage_appointment_payments') || hasPermission('manage_appointments');
  const canReverseFee = hasPermission('reverse_appointment_payment') || hasPermission('manage_appointments');
  const canTogglePayment = canCollectFee || canReverseFee;

  return (
    <div className="space-y-3">
      {/* Compact Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">{t('modules.appointmentsTitle')}</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {t('modules.appointmentsSubtitle')} {isAllHospitals ? t('modules.allHospitals') : currentHospital.name}
          </p>
        </div>
  
                {doctorNeedsLinking && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    This doctor account isn’t linked to a Doctor profile yet (missing doctorId), so no appointments can be shown.
                    Please log out and log back in. If it still persists, an admin should ensure the user email matches the Doctor email.
                  </div>
                )}
        
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
              placeholder="Search name, phone, doctor..."
              className="w-48 pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Action Buttons */}
          {canExport && (
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs font-medium shadow-sm"
              title={t('ui.exportToExcel')}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
          )}
          {canExport && (
            <button
              onClick={exportToPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs font-medium shadow-sm"
              title={t('ui.exportToPdf')}
            >
              <FileText className="w-3.5 h-3.5" />
              PDF
            </button>
          )}
          {canCreate && (
            <AddButton
              onClick={() => {
                const defaultDoctorId = getDefaultDoctorId(currentHospital.id) || '';
                const defaultDoctor = hospitalDoctors.find((d) => d.id === defaultDoctorId);
                setFormData({
                  patientId: '',
                  doctorId: defaultDoctorId,
                  appointmentDate: today(),
                  appointmentTime: '',
                  reason: '',
                  notes: '',
                  hospitalId: currentHospital.id,
                  originalFeeAmount: defaultDoctor ? String(defaultDoctor.consultationFee ?? 0) : '',
                  discountEnabled: false,
                  discountAmount: '',
                  paymentStatus: 'paid',
                });
                setShowAddModal(true);
              }}
              label="New Appointment"
            />
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
        <div className="overflow-x-auto rounded-t-lg max-h-[calc(100vh-220px)] overflow-y-auto min-h-[360px]">
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
                    {t('table.patient')}
                    {renderSortIcon('patientName')}
                  </div>
                </th>
                <th onClick={() => handleSort('doctorName')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    {t('table.doctor')}
                    {renderSortIcon('doctorName')}
                  </div>
                </th>
                <th onClick={() => handleSort('appointmentDate')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    {t('table.dateTime')}
                    {renderSortIcon('appointmentDate')}
                  </div>
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">{t('table.reason')}</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">{t('table.fees')}</th>
                <th onClick={() => handleSort('status')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    {t('table.status')}
                    {renderSortIcon('status')}
                  </div>
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                        <Calendar className="w-6 h-6 text-gray-400 opacity-50" />
                      </div>
                      <p className="text-sm font-medium">No appointments found</p>
                      <p className="text-xs mt-1">{t('ui.tryAdjustingYourSearchTerms')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedAppointments.map((apt) => {
                  const patientPhone = getAppointmentPatientPhone(apt);

                  return (
                  <tr key={apt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                    <td className="px-4 py-2">
                      <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 font-mono">{apt.appointmentNumber}</span>
                    </td>
                    <td className="px-4 py-2">
                      <div>
                        <div className="text-xs font-medium text-gray-900 dark:text-white">{apt.patientName}</div>
                        <div className="text-[10px] text-gray-600 dark:text-gray-400">{apt.patientAge}Y • {apt.patientGender}</div>
                        {patientPhone && (
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">{patientPhone}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-xs text-gray-900 dark:text-white">{apt.doctorName}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-600 dark:text-gray-400">
                        <Calendar className="w-3 h-3" />
                        <span>{formatOnlyDate(apt.appointmentDate, currentHospital.timezone, currentHospital.calendarType)}</span>
                        <Clock className="w-3 h-3 ml-1" />
                        <span>{apt.appointmentTime || 'No time'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-xs text-gray-900 dark:text-white truncate max-w-xs">{apt.reason}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-[10px] leading-4 text-gray-700 dark:text-gray-300">
                        <div>Original: {(apt.originalFeeAmount ?? 0).toFixed(2)} {apt.currency ?? 'AFN'}</div>
                        <div>Discount: {(apt.discountAmount ?? 0).toFixed(2)}</div>
                        <div>Payment: {(apt.paymentStatus ?? 'pending').toUpperCase()}</div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          Total: {(apt.totalAmount ?? Math.max(0, (apt.originalFeeAmount ?? 0) - (apt.discountAmount ?? 0))).toFixed(2)}
                        </div>
                      </div>
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
                                  >{t('ui.markCompleted')}</button>
                                  <button
                                    onClick={() => {
                                      handleStatusChange(apt.id, 'cancelled');
                                      setOpenStatusDropdown(null);
                                    }}
                                    className="block w-full text-left px-2 py-1.5 text-[10px] text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
                                  >{t('ui.cancel')}</button>
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
                          onClick={() => {
                            setSelectedAppointment(apt);
                            setShowViewModal(true);
                          }}
                          className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60 rounded-md transition-colors"
                          title={t('ui.view')}
                          aria-label={t('ui.view')}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canTogglePayment && (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={apt.paymentStatus === 'paid'}
                            onClick={() => handlePaymentStatusToggle(apt)}
                            disabled={apt.paymentStatus === 'paid' ? !canReverseFee : !canCollectFee}
                            title={
                              apt.paymentStatus === 'paid'
                                ? (canReverseFee ? 'Reverse fee to pending' : 'Fee collected')
                                : (canCollectFee ? 'Mark fee collected' : 'Fee pending')
                            }
                            aria-label={apt.paymentStatus === 'paid' ? 'Reverse fee to pending' : 'Mark fee collected'}
                            className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors ${
                              apt.paymentStatus === 'paid' ? 'bg-emerald-500' : 'bg-amber-400'
                            } disabled:cursor-default disabled:opacity-70`}
                          >
                            <span
                              className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                                apt.paymentStatus === 'paid' ? 'translate-x-4' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        )}
                        {canPrint && (
                          <button
                            onClick={() => handlePrint(apt)}
                            className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-md transition-colors"
                            title="Print Fees Card"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => openEditModal(apt)}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                            title={t('ui.edit')}
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
                            title={t('ui.delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer with totals */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 rounded-b-lg flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
          <span>Total Records: <span className="font-semibold text-gray-900 dark:text-white">{filteredAppointments.length}</span></span>
          <div className="flex items-center gap-3">
            <span>Showing {paginatedAppointments.length} of {filteredAppointments.length}</span>
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
                {showAddModal ? t('ui.newAppointment') : 'Edit Appointment'}
              </h2>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }} 
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                aria-label={t('ui.close')}
                title={t('ui.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); showAddModal ? handleAdd() : handleEdit(); }} className="p-4 space-y-3">
              {/* Hospital Selection for Super Admin */}
              {userRole === 'super_admin' && (
                <div>
                  <label htmlFor="appointment-hospital" className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.hospital')}<span className="text-red-500">*</span>
                  </label>
                  <select
                    id="appointment-hospital"
                    value={formData.hospitalId}
                    onChange={(e) => setFormData({ ...formData, hospitalId: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    title={t('ui.hospital')}
                    required
                  >
                    {hospitals.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="appointment-patient" className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.patient')}<span className="text-red-500">*</span></label>
                  <SearchableSelect
                    id="appointment-patient"
                    value={formData.patientId}
                    options={patientOptions}
                    onChange={(patientId) => setFormData({ ...formData, patientId })}
                    placeholder={t('ui.selectPatient')}
                    title={t('ui.patient')}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="appointment-doctor" className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.doctor')}<span className="text-red-500">*</span></label>
                  <SearchableSelect
                    id="appointment-doctor"
                    value={formData.doctorId}
                    options={doctorOptions}
                    onChange={(nextDoctorId) => {
                      const nextDoctor = hospitalDoctors.find((d) => d.id === nextDoctorId);
                      setFormData({
                        ...formData,
                        doctorId: nextDoctorId,
                        // Prefill the consultation fee, but never overwrite a fee
                        // the user has already typed.
                        originalFeeAmount:
                          formData.originalFeeAmount === '' || Number(formData.originalFeeAmount) === 0
                            ? String(nextDoctor?.consultationFee ?? 0)
                            : formData.originalFeeAmount,
                      });
                    }}
                    placeholder={t('ui.selectDoctor')}
                    title={t('ui.doctor')}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="appointment-date" className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.date')}<span className="text-red-500">*</span></label>
                  <input
                    id="appointment-date"
                    type="date"
                    value={formData.appointmentDate}
                    onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })}
                    className={`w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border ${
                      checkAvailability(formData.doctorId, formData.appointmentDate, '').available 
                        ? 'border-gray-300 dark:border-gray-600' 
                        : 'border-red-500 focus:ring-red-500'
                    } rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all`}
                    title="Appointment date"
                    required
                  />
                  {formData.appointmentDate && !checkAvailability(formData.doctorId, formData.appointmentDate, '').available && (
                    <p className="text-[10px] text-red-500 mt-0.5">
                      {checkAvailability(formData.doctorId, formData.appointmentDate, '').reason}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="appointment-time" className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Time</label>
                  <input
                    id="appointment-time"
                    type="time"
                    value={formData.appointmentTime}
                    onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
                    className={`w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border ${
                      checkAvailability(formData.doctorId, formData.appointmentDate, formData.appointmentTime).available 
                        ? 'border-gray-300 dark:border-gray-600' 
                        : 'border-red-500 focus:ring-red-500'
                    } rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all`}
                    title="Appointment time"
                  />
                  {formData.appointmentTime && !checkAvailability(formData.doctorId, formData.appointmentDate, formData.appointmentTime).available && (
                    <p className="text-[10px] text-red-500 mt-0.5">
                      {checkAvailability(formData.doctorId, formData.appointmentDate, formData.appointmentTime).reason}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
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
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.originalFee')}</label>
                  {/* Overriding the consultation fee is a pricing decision, the
                      same class of action as applying a discount, so it rides
                      the same permission. Reception keeps the doctor's fee. */}
                  <input
                    title="Original fee"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.originalFeeAmount}
                    onChange={(e) => setFormData({ ...formData, originalFeeAmount: e.target.value })}
                    disabled={!canSetOriginalFee}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {!canSetOriginalFee && (
                    <p className="text-[10px] text-gray-500 mt-0.5">{t('ui.noFeeOverridePermission')}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Discount Amount</label>
                  <input
                    title="Discount amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.discountAmount}
                    onChange={(e) => setFormData({ ...formData, discountAmount: e.target.value })}
                    disabled={formData.discountEnabled || !canApplyDiscount}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {!canApplyDiscount && (
                    <p className="text-[10px] text-gray-500 mt-0.5">{t('ui.noDiscountPermission')}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.paymentStatus')}</label>
                  <select
                    value={formData.paymentStatus}
                    onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as NonNullable<Appointment['paymentStatus']> })}
                    disabled={!canSetPaymentStatus}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    title="Payment status"
                  >
                    <option value="pending">pending</option>
                    <option value="partial">partial</option>
                    <option value="paid">paid</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                  {!canSetPaymentStatus && (
                    <p className="text-[10px] text-gray-500 mt-0.5">{t('ui.noPaymentPermission')}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1.5 bg-gray-50 dark:bg-gray-700/30">
                <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={formData.discountEnabled}
                    onChange={(e) => setFormData({ ...formData, discountEnabled: e.target.checked })}
                    disabled={!canApplyDiscount}
                    className="disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  Full waiver (100% discount)
                </label>
                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                  Total: {feePreview.total.toFixed(2)} AFN
                </span>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.notes')}</label>
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
                >{t('ui.cancel')}</button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-xs shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : showAddModal ? t('ui.create') : t('ui.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appointment Details */}
      {showViewModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('ui.appointmentDetails')} #{selectedAppointment.appointmentNumber || selectedAppointment.id}
                </h3>
              </div>
              <button
                onClick={() => { setShowViewModal(false); setSelectedAppointment(null); }}
                className="p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label={t('ui.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto overflow-x-hidden">
              <ViewSection title={t('ui.patient')}>
                <ViewRow label={t('ui.name')} value={selectedAppointment.patientName} />
                <ViewRow label={t('ui.age')} value={`${selectedAppointment.patientAge} / ${selectedAppointment.patientGender}`} />
                <ViewRow label={t('ui.phone')} value={selectedAppointment.patientPhone} />
                <ViewRow label={t('ui.patientId')} value={selectedAppointment.patientDisplayId} />
              </ViewSection>

              <ViewSection title={t('ui.appointment')}>
                <ViewRow label={t('ui.doctor')} value={selectedAppointment.doctorName} />
                <ViewRow
                  label={t('ui.date')}
                  value={formatOnlyDate(selectedAppointment.appointmentDate, currentHospital.timezone, currentHospital.calendarType)}
                />
                <ViewRow label={t('ui.time')} value={selectedAppointment.appointmentTime || '\u2014'} />
                <ViewRow label={t('ui.reason')} value={selectedAppointment.reason} />
                <ViewRow label={t('ui.status')} value={selectedAppointment.status.replace('_', ' ')} />
                <ViewRow label={t('ui.notes')} value={selectedAppointment.notes} />
              </ViewSection>

              <ViewSection title={t('ui.fees')}>
                <ViewRow
                  label={t('ui.originalFee')}
                  value={`${(selectedAppointment.originalFeeAmount ?? 0).toFixed(2)} ${selectedAppointment.currency ?? 'AFN'}`}
                />
                <ViewRow label={t('ui.discount')} value={(selectedAppointment.discountAmount ?? 0).toFixed(2)} />
                <ViewRow
                  label={t('ui.total')}
                  value={(selectedAppointment.totalAmount
                    ?? Math.max(0, (selectedAppointment.originalFeeAmount ?? 0) - (selectedAppointment.discountAmount ?? 0))
                  ).toFixed(2)}
                />
                <ViewRow label={t('ui.paymentStatus')} value={(selectedAppointment.paymentStatus ?? 'pending').toUpperCase()} />
              </ViewSection>

              {/* The audit trail: the first thing asked about when a waived fee
                  or an unexpected booking is queried. */}
              <ViewSection title={t('ui.systemInformation')}>
                <ViewRow label={t('ui.createdBy')} value={selectedAppointment.createdBy} />
                <ViewRow
                  label={t('ui.createdAt')}
                  value={selectedAppointment.createdAt
                    ? formatDate(selectedAppointment.createdAt, currentHospital.timezone, currentHospital.calendarType)
                    : undefined}
                />
                <ViewRow label={t('ui.updatedBy')} value={selectedAppointment.updatedBy} />
                <ViewRow
                  label={t('ui.updatedAt')}
                  value={selectedAppointment.updatedAt
                    ? formatDate(selectedAppointment.updatedAt, currentHospital.timezone, currentHospital.calendarType)
                    : undefined}
                />
              </ViewSection>
            </div>

            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              {canPrint && (
                <button
                  onClick={() => handlePrint(selectedAppointment)}
                  className="px-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 inline-flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> {t('ui.print')}
                </button>
              )}
              <button
                onClick={() => { setShowViewModal(false); setSelectedAppointment(null); }}
                className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >{t('ui.close')}</button>
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
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Appointment</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete appointment <strong>{selectedAppointment?.appointmentNumber}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
              >{t('ui.cancel')}</button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium shadow-sm"
              >{t('ui.delete')}</button>
            </div>
          </div>
        </div>
      )}
      {/* Print Fees Card Modal */}
      {showPrintModal && selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           {/* Robust Print Styles */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-white">Print Fees Card</h3>
              <button
                onClick={() => setShowPrintModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label={t('ui.close')}
                title={t('ui.close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex justify-center bg-gray-100 dark:bg-gray-900">
              {/* Actual Card to Print */}
              <div id="fees-card-print" className="bg-gray-100 p-2 w-full max-w-[148mm] shadow-sm border border-gray-200 text-gray-900 print:max-w-none print:w-[148mm] print:break-inside-avoid print:page-break-inside-avoid print:m-0 mx-auto">
                 <div className="bg-white p-4 border border-gray-300 rounded print:border-black">
                     {/* Header */}
                     <div className="text-center border-b border-gray-800 pb-2 mb-2">
                        <h1 className="text-xl font-bold text-gray-900 uppercase leading-tight">{currentHospital.name}</h1>
                        <p className="text-xs text-gray-600 leading-tight mt-1">{currentHospital.address}</p>
                        <p className="text-xs text-gray-600 leading-tight">{currentHospital.phone}</p>
                        <div className="mt-1 inline-block px-3 py-0.5 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-full print:bg-white print:text-black print:border print:border-black">
                          OPD Appointment Card
                        </div>
                     </div>

                     {/* Content Grid */}
                     <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-3">
                        <div className="col-span-2 flex justify-between items-end border-b border-gray-200 pb-1 mb-1">
                           <div>
                             <label className="text-[9px] text-gray-500 uppercase font-bold block leading-none mb-0.5">Appointment No</label>
                             <span className="text-sm font-mono font-bold text-gray-900">{formatAppointmentNumber(selectedAppointment.appointmentNumber)}</span>
                           </div>
                           <div className="text-right">
                              <label className="text-[9px] text-gray-500 uppercase font-bold block leading-none mb-0.5">Date & Time</label>
                              <span className="font-bold text-gray-900">{formatOnlyDate(selectedAppointment.appointmentDate, currentHospital.timezone, currentHospital.calendarType)} | {selectedAppointment.appointmentTime || 'No time'}</span>
                           </div>
                        </div>

                        <div className="col-span-1">
                           <label className="text-[9px] text-gray-500 uppercase font-bold block leading-none mb-0.5">{t('ui.patientDetails')}</label>
                           <div className="font-bold text-sm text-gray-900">{selectedAppointment.patientName}</div>
                           <div className="text-[10px] text-gray-600">{selectedAppointment.patientAge} Yrs / {selectedAppointment.patientGender}</div>
                          <div className="text-[9px] text-gray-400 mt-0.5">ID: {selectedAppointment.patientDisplayId || formatPatientId(selectedAppointment.patientId)}</div>
                        </div>

                        <div className="col-span-1 text-right">
                           <label className="text-[9px] text-gray-500 uppercase font-bold block leading-none mb-0.5">Assigned Doctor</label>
                           <div className="font-bold text-sm text-gray-900">{selectedAppointment.doctorName}</div>
                           <div className="text-[10px] text-gray-600">
                             {hospitalDoctors.find(d => d.id === selectedAppointment.doctorId)?.specialization || 'General Physician'}
                           </div>
                        </div>

                        <div className="col-span-2 border border-gray-200 bg-white rounded p-2 mt-1 print:border-black print:bg-white print:break-inside-avoid print:page-break-inside-avoid shadow-sm print:shadow-none">
                           <div className="space-y-1">
                             <div className="flex justify-between items-center text-gray-700">
                               <span className="font-bold text-[10px] uppercase">Original Fee</span>
                               <span className="font-semibold text-xs">{(selectedAppointment.originalFeeAmount ?? 0).toFixed(2)} {selectedAppointment.currency ?? 'AFN'}</span>
                             </div>
                             <div className="flex justify-between items-center text-gray-700">
                               <span className="font-bold text-[10px] uppercase">{t('ui.discount')}</span>
                               <span className="font-semibold text-xs">{(selectedAppointment.discountAmount ?? 0).toFixed(2)}</span>
                             </div>
                             <div className="flex justify-between items-center border-t border-gray-200 pt-1 mt-1">
                               <span className="font-bold text-xs uppercase text-gray-900 leading-none">Payable Total</span>
                               <span className="font-bold text-sm text-gray-900 leading-none">
                                 {(selectedAppointment.totalAmount ?? Math.max(0, (selectedAppointment.originalFeeAmount ?? 0) - (selectedAppointment.discountAmount ?? 0))).toFixed(2)}
                               </span>
                             </div>
                           </div>
                        </div>
                     </div>

                     {/* Footer */}
                     <div className="text-center text-[8px] text-gray-500 mt-2 pt-2 border-t border-gray-200 print:text-black">
                        <p>Printed on: {formatDate(new Date(), currentHospital.timezone, currentHospital.calendarType)}</p>
                        <p>Please bring this card for follow-up visits.</p>
                     </div>
                 </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex justify-end gap-2">
              <button 
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >{t('ui.close')}</button>
              <button 
                onClick={handlePrintFeesCard}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />{t('ui.print')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
