import React, { useState, useEffect } from 'react';
import { Eye, Printer, Trash2, Search, Calendar, X, Edit, ArrowUp, ArrowDown, ArrowUpDown, FileText, FileSpreadsheet, ChevronLeft, ChevronRight, ChevronFirst, ChevronLast } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import { PrescriptionPrint } from './PrescriptionPrint';
import { Toast } from './Toast';
import { instructionOptions } from '../data/mockData';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { formatDate } from '../utils/date';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { useNavigate } from 'react-router-dom';
import { usePrescriptions } from '../context/PrescriptionContext';
import { usePatients } from '../context/PatientContext';
import { useDoctors } from '../context/DoctorContext';
import { useHospitals } from '../context/HospitalContext';
import { useMedicines } from '../context/MedicineContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

interface PrescriptionListProps {
  hospital: Hospital;
  userRole: UserRole;
  currentUser?: { id: string; name: string; email: string; role: UserRole; doctorId?: string };
}

type SortField = 'prescriptionNumber' | 'patientName' | 'doctorName' | 'createdAt' | 'nextVisit' | 'medicines';
type SortDirection = 'asc' | 'desc';

const PDF_FONT_NAME = 'NotoSans';
const PDF_FONT_FILE = 'NotoSansArabic-Regular.ttf';
const PDF_FONT_URL = `/fonts/${PDF_FONT_FILE}`;
let cachedPdfFont: string | null = null;

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const ensurePdfFont = async (doc: jsPDF) => {
  if (cachedPdfFont) {
    doc.addFileToVFS(PDF_FONT_FILE, cachedPdfFont);
    doc.addFont(PDF_FONT_FILE, PDF_FONT_NAME, 'normal');
    doc.setFont(PDF_FONT_NAME);
    return PDF_FONT_NAME;
  }

  try {
    const res = await fetch(PDF_FONT_URL);
    if (!res.ok) throw new Error('font not found');
    const buffer = await res.arrayBuffer();
    cachedPdfFont = arrayBufferToBase64(buffer);
    doc.addFileToVFS(PDF_FONT_FILE, cachedPdfFont);
    doc.addFont(PDF_FONT_FILE, PDF_FONT_NAME, 'normal');
    doc.setFont(PDF_FONT_NAME);
    return PDF_FONT_NAME;
  } catch {
    doc.setFont('helvetica');
    return 'helvetica';
  }
};

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

// Helper: Resolve asset URL (from PrescriptionPrint)
const resolveAssetUrl = (path?: string | null): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace('/api', '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const withStorage = normalized.startsWith('/storage/') ? normalized : `/storage${normalized}`;
  return `${base}${withStorage}`;
};

// Helper: Load image as Base64 for PDF
const loadImage = (url: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

export function PrescriptionList({ hospital, userRole, currentUser }: PrescriptionListProps) {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { loadHospitalSetting, getPrescriptionPrintAssetSettings } = useSettings();
  const { prescriptions, deletePrescription } = usePrescriptions();
  const { patients } = usePatients();
  const { doctors } = useDoctors();
  const { hospitals: hospitalDirectory } = useHospitals();
  const { medicines: inventory } = useMedicines();
  // Hospital filtering for super_admin with "All Hospitals" support
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showNextVisitOnly, setShowNextVisitOnly] = useState(false);
  const [nextVisitStatusFilter, setNextVisitStatusFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming' | 'thisWeek'>('all');
  const [nextVisitDoctorFilter, setNextVisitDoctorFilter] = useState<string>('all');
  const [nextVisitFrom, setNextVisitFrom] = useState('');
  const [nextVisitTo, setNextVisitTo] = useState('');
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Apply hospital filter first
  const hospitalFiltered = React.useMemo(() => 
    filterByHospital(prescriptions),
  [filterByHospital, prescriptions]);
  
  // Then apply doctor filter if applicable
  const doctorFiltered = React.useMemo(() => {
    if (userRole === 'doctor' && currentUser?.doctorId) {
      return hospitalFiltered.filter(p => p.doctorId === currentUser.doctorId);
    }
    return hospitalFiltered;
  }, [hospitalFiltered, userRole, currentUser]);

  const [visiblePrescriptions, setVisiblePrescriptions] = useState(doctorFiltered);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'danger' } | null>(null);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc'); // Default: newest first
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Update prescriptions when filter dependencies change
  React.useEffect(() => {
    setVisiblePrescriptions(doctorFiltered);
    setCurrentPage(1); // Reset to page 1 when filters change
  }, [doctorFiltered]);

  // Reset page when search term changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  React.useEffect(() => {
    setCurrentPage(1);
    if (showNextVisitOnly) {
      setSortField('nextVisit');
      setSortDirection('asc');
    } else {
      setNextVisitStatusFilter('all');
      setNextVisitDoctorFilter('all');
      setNextVisitFrom('');
      setNextVisitTo('');
    }
  }, [showNextVisitOnly]);

  // Helper function to check if a prescription was created today
  const isPrescriptionCreatedToday = (prescriptionDate: Date): boolean => {
    const today = new Date();
    const presDate = new Date(prescriptionDate);
    return (
      today.getFullYear() === presDate.getFullYear() &&
      today.getMonth() === presDate.getMonth() &&
      today.getDate() === presDate.getDate()
    );
  };

  const canManagePrescriptions = hasPermission('manage_prescriptions');
  const canCreatePrescriptions = hasPermission('create_prescription') || hasPermission('add_prescriptions') || canManagePrescriptions;
  const canEditPrescriptions = hasPermission('edit_prescriptions') || canManagePrescriptions;
  const canDeletePrescriptions = hasPermission('delete_prescriptions') || canManagePrescriptions;
  const canExportPrescriptions = hasPermission('export_prescriptions') || canManagePrescriptions;
  const canPrintPrescriptions = hasPermission('print_prescriptions') || canManagePrescriptions;

  // Check if user can edit a prescription
  const canEditPrescription = (prescription: any): boolean => {
    // Manage permission allows editing any prescription
    if (canEditPrescriptions) {
      return true;
    }
    
    // Creator roles can only edit prescriptions created today
    if (canCreatePrescriptions && userRole === 'doctor') {
      return isPrescriptionCreatedToday(prescription.createdAt);
    }
    
    // Other roles cannot edit
    return false;
  };

  const patientKeyForPrescription = (prescription: any) => {
    if (prescription.patientId) {
      return `patient:${prescription.patientId}`;
    }
    if (prescription.walkInPatientId) {
      return `walkin:${prescription.walkInPatientId}`;
    }
    return `walkin-name:${String(prescription.patientName || '').trim().toLowerCase()}`;
  };

  const sortedByDateDesc = React.useMemo(() => {
    return [...visiblePrescriptions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [visiblePrescriptions]);

  const previousPrescriptionById = React.useMemo(() => {
    const grouped = new Map<string, any[]>();

    sortedByDateDesc.forEach((prescription) => {
      const key = patientKeyForPrescription(prescription);
      const list = grouped.get(key) || [];
      list.push(prescription);
      grouped.set(key, list);
    });

    const result = new Map<string, any | null>();
    grouped.forEach((list) => {
      list.forEach((current, index) => {
        result.set(current.id, list[index + 1] || null);
      });
    });

    return result;
  }, [sortedByDateDesc]);

  const basePrescriptions = React.useMemo(
    () => (showNextVisitOnly ? visiblePrescriptions.filter((p) => Boolean(p.nextVisit)) : visiblePrescriptions),
    [showNextVisitOnly, visiblePrescriptions]
  );

  const filteredPrescriptions = basePrescriptions.filter((p) => {
    const search = searchTerm.toLowerCase();
    const previous = previousPrescriptionById.get(p.id);

    const nextVisitDate = p.nextVisit ? new Date(p.nextVisit) : null;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(todayStart.getDate() + 7);

    const matchesStatus = !showNextVisitOnly || nextVisitStatusFilter === 'all'
      ? true
      : (() => {
          if (!nextVisitDate) return false;
          if (nextVisitStatusFilter === 'overdue') return nextVisitDate < todayStart;
          if (nextVisitStatusFilter === 'today') return nextVisitDate >= todayStart && nextVisitDate < tomorrowStart;
          if (nextVisitStatusFilter === 'upcoming') return nextVisitDate >= todayStart;
          if (nextVisitStatusFilter === 'thisWeek') return nextVisitDate >= todayStart && nextVisitDate < weekEnd;
          return true;
        })();

    const matchesDoctor = !showNextVisitOnly || nextVisitDoctorFilter === 'all'
      ? true
      : p.doctorId === nextVisitDoctorFilter;

    const fromDate = nextVisitFrom ? new Date(`${nextVisitFrom}T00:00:00`) : null;
    const toDate = nextVisitTo ? new Date(`${nextVisitTo}T23:59:59`) : null;
    const matchesDateRange = !showNextVisitOnly || (!fromDate && !toDate)
      ? true
      : !!nextVisitDate && (!fromDate || nextVisitDate >= fromDate) && (!toDate || nextVisitDate <= toDate);

    const matchesSearch =
      p.prescriptionNumber.toLowerCase().includes(search) ||
      p.patientName.toLowerCase().includes(search) ||
      p.doctorName.toLowerCase().includes(search) ||
      (p.nextVisit ? formatDate(p.nextVisit, currentHospital.timezone, currentHospital.calendarType).toLowerCase().includes(search) : false) ||
      (showNextVisitOnly && previous?.prescriptionNumber ? previous.prescriptionNumber.toLowerCase().includes(search) : false);

    return matchesStatus && matchesDoctor && matchesDateRange && matchesSearch;
  });

  const nextVisitDoctorOptions = React.useMemo(() => {
    const ids = new Set(basePrescriptions.map((p) => p.doctorId));
    return doctors.filter((d) => ids.has(d.id));
  }, [basePrescriptions, doctors]);

  const handleViewPrescription = (prescription: any) => {
    const patient = prescription.patientId
      ? patients.find(p => p.id === prescription.patientId)
      : {
          id: 'walkin',
          patientId: prescription.walkInPatientId || 'WALKIN',
          name: prescription.patientName,
          age: prescription.patientAge,
          gender: prescription.patientGender,
          hospitalId: prescription.hospitalId,
        };
    const doctor = doctors.find(d => d.id === prescription.doctorId);
    if (doctor) {
      setSelectedPrescription({ ...prescription, patient, doctor });
      setShowViewModal(true);
    }
  };

  const handlePrintPrescription = (prescription: any) => {
    const patient = prescription.patientId
      ? patients.find(p => p.id === prescription.patientId)
      : {
          id: 'walkin',
          patientId: prescription.walkInPatientId || 'WALKIN',
          name: prescription.patientName,
          age: prescription.patientAge,
          gender: prescription.patientGender,
          hospitalId: prescription.hospitalId,
        };
    const doctor = doctors.find(d => d.id === prescription.doctorId);
    if (doctor) {
      setSelectedPrescription({ ...prescription, patient, doctor });
      setShowPrint(true);
    }
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-blue-600 dark:text-blue-400" />
      : <ArrowDown className="w-3 h-3 text-blue-600 dark:text-blue-400" />;
  };

  const sortedPrescriptions = [...filteredPrescriptions].sort((a, b) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);

    if (sortField === 'createdAt') {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    } else if (sortField === 'nextVisit') {
      const dateA = a.nextVisit ? new Date(a.nextVisit).getTime() : 0;
      const dateB = b.nextVisit ? new Date(b.nextVisit).getTime() : 0;

      if (showNextVisitOnly && sortDirection === 'asc') {
        const rank = (timestamp: number) => {
          const date = new Date(timestamp);
          if (date >= todayStart && date < tomorrowStart) return 0; // today first
          if (date >= tomorrowStart) return 1; // upcoming next
          return 2; // overdue last
        };

        const rankA = rank(dateA);
        const rankB = rank(dateB);
        if (rankA !== rankB) return rankA - rankB;
      }

      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    } else if (sortField === 'prescriptionNumber') {
      return sortDirection === 'asc' ? a.prescriptionNumber.localeCompare(b.prescriptionNumber) : b.prescriptionNumber.localeCompare(a.prescriptionNumber);
    } else if (sortField === 'patientName') {
      return sortDirection === 'asc' ? a.patientName.localeCompare(b.patientName) : b.patientName.localeCompare(a.patientName);
    } else if (sortField === 'doctorName') {
      return sortDirection === 'asc' ? a.doctorName.localeCompare(b.doctorName) : b.doctorName.localeCompare(a.doctorName);
    } else if (sortField === 'medicines') {
      return sortDirection === 'asc' ? a.medicines.length - b.medicines.length : b.medicines.length - a.medicines.length;
    }
    return 0;
  });

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedPrescriptions = sortedPrescriptions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedPrescriptions.length / itemsPerPage);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    const dataToExport = sortedPrescriptions.map((prescription) => ({
      'Prescription #': prescription.prescriptionNumber,
      'Patient Name': prescription.patientName,
      'Age': prescription.patientAge,
      'Gender': prescription.patientGender,
      'Doctor': prescription.doctorName,
      'Date': formatDate(prescription.createdAt, currentHospital.timezone, currentHospital.calendarType),
      'Next Visit': prescription.nextVisit ? formatDate(prescription.nextVisit, currentHospital.timezone, currentHospital.calendarType) : '-',
      'Last Prescription #': previousPrescriptionById.get(prescription.id)?.prescriptionNumber || '-',
      'Last Prescription Date': previousPrescriptionById.get(prescription.id)?.createdAt
        ? formatDate(previousPrescriptionById.get(prescription.id).createdAt, currentHospital.timezone, currentHospital.calendarType)
        : '-',
      'Medicines Count': prescription.medicines.length,
      'Diagnosis': prescription.diagnosis?.replace(/<[^>]*>/g, '') || '',
      'Advice': prescription.advice?.replace(/<[^>]*>/g, '') || '',
      'Hospital': hospitalDirectory.find(h => h.id === prescription.hospitalId)?.name || 'Unknown'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, showNextVisitOnly ? 'Next Visits' : 'Prescriptions');
    XLSX.writeFile(workbook, showNextVisitOnly ? 'Next_Visit_Patients_List.xlsx' : 'Prescriptions_List.xlsx');
    setToast({ message: 'Exported to Excel successfully!', type: 'success' });
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Determine brand color for list export (only if specific hospital selected)
    const brandRgb = !isAllHospitals && currentHospital.brandColor 
      ? hexToRgb(currentHospital.brandColor) 
      : null;
    const tableHeaderColor = brandRgb || [66, 139, 202]; // Default Blue

    doc.setFontSize(18);
    doc.text(showNextVisitOnly ? 'Next Visit Patients Report' : 'Prescriptions Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${formatDate(new Date(), currentHospital.timezone, currentHospital.calendarType)}`, 14, 30);
    if (!isAllHospitals) {
      doc.text(`Hospital: ${currentHospital.name}`, 14, 36);
    }

    autoTable(doc, {
      head: showNextVisitOnly
        ? [['Patient', 'Next Visit', 'Last Rx #', 'Last Rx Date', 'Doctor']]
        : [['Rx #', 'Patient', 'Doctor', 'Date', 'Next Visit', 'Meds']],
      body: sortedPrescriptions.map(p => {
        const previous = previousPrescriptionById.get(p.id);
        if (showNextVisitOnly) {
          return [
            p.patientName,
            p.nextVisit ? formatDate(p.nextVisit, currentHospital.timezone, currentHospital.calendarType) : '-',
            previous?.prescriptionNumber || '-',
            previous?.createdAt ? formatDate(previous.createdAt, currentHospital.timezone, currentHospital.calendarType) : '-',
            p.doctorName,
          ];
        }

        return [
          p.prescriptionNumber,
          p.patientName,
          p.doctorName,
          formatDate(p.createdAt, currentHospital.timezone, currentHospital.calendarType),
          p.nextVisit ? formatDate(p.nextVisit, currentHospital.timezone, currentHospital.calendarType) : '-',
          p.medicines.length,
        ];
      }),
      startY: isAllHospitals ? 40 : 46,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: tableHeaderColor }
    });

    doc.save(showNextVisitOnly ? 'Next_Visit_Patients_Report.pdf' : 'Prescriptions_Report.pdf');
  };

  // Helper to get instruction label
  const getInstructionLabel = (value: string) => {
    return instructionOptions.find(opt => opt.value === value)?.label || value;
  };

  const formatMedicineForPrint = (med: any, inventory: any[]) => {
    const originalMed = inventory.find(m => m.id === med.medicineId || m.brandName === med.medicineName);
    
    // Fallback values
    const brandName = med.brandName || med.medicineName || '';
    const genericName = med.genericName || originalMed?.genericName || '';
    const type = (med.type || originalMed?.type || '').trim();
    const strength = (med.strength || '').trim();

    // Start with type
    let displayName = type;

    // Add Brand Name
    if (brandName && !displayName.toLowerCase().includes(brandName.toLowerCase())) {
        displayName += ` ${brandName}`;
    }

    // Add generic name in parentheses
    if (genericName && !displayName.toLowerCase().includes(genericName.toLowerCase())) {
      displayName += ` (${genericName})`;
    }

    // Add strength
    if (strength && !displayName.toLowerCase().includes(strength.toLowerCase())) {
      displayName += ` ${strength}`;
    }

    return displayName.replace(/\s+/g, ' ').trim();
  };

  // Export Single Prescription to PDF (Refined Design)
  const handleExportSinglePDF = async (prescription: any) => {
    const doc = new jsPDF();
    const pdfFont = await ensurePdfFont(doc);
    const hospitalInfo = hospitalDirectory.find(h => h.id === prescription.hospitalId) || hospital;
    const patientInfo = patients.find(p => p.id === prescription.patientId) || prescription.patient;
    const doctorInfo = doctors.find(d => d.id === prescription.doctorId) || prescription.doctor;
    
    // Load Settings
    await loadHospitalSetting(hospitalInfo.id);
    const printAssetSettings = getPrescriptionPrintAssetSettings(hospitalInfo.id);

    // Load Images
    const logoUrl = resolveAssetUrl(hospitalInfo.logo);
    const signatureUrl = resolveAssetUrl(doctorInfo?.signature);
    const logoBase64 = logoUrl ? await loadImage(logoUrl) : null;
    const signatureBase64 = signatureUrl ? await loadImage(signatureUrl) : null;

    // Colors
    const brandColor = hospitalInfo.brandColor || '#3b82f6'; 
    const brandRgb = hexToRgb(brandColor) || [59, 130, 246];
    
    // Convert RGB array to hex string for jsPDF
    const brandHex = `#${((1 << 24) + (brandRgb[0] << 16) + (brandRgb[1] << 8) + brandRgb[2]).toString(16).slice(1)}`;

    const gray50 = '#f9fafb';
    const gray200 = '#e5e7eb';
    const blue50 = '#eff6ff';
    const blue200 = '#bfdbfe';
    const textGray900 = '#111827';
    const textGray600 = '#4b5563';
    const textBlue900 = '#1e3a8a';

    const pageWidth = doc.internal.pageSize.width;
    const margin = 14;
    const usableWidth = pageWidth - (margin * 2);

    // --- Header ---
    let currentY = 15;

    // Hospital Name (Left)
    doc.setFont(pdfFont, "bold");
    doc.setFontSize(22);
    doc.setTextColor(textGray900);
    doc.text(hospitalInfo.name, margin, currentY);
    
    // Logo (Right)
    const logoSize = Math.min(printAssetSettings.logoHeight || 20, 25);
    const logoX = pageWidth - margin - logoSize;
    const logoY = currentY - 10;
    
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', logoX, logoY, printAssetSettings.logoWidth || logoSize, printAssetSettings.logoHeight || logoSize, undefined, 'FAST');
    } else {
      // Fallback Rx
      doc.setFontSize(30);
      doc.setTextColor(brandHex);
      doc.text("Rx", pageWidth - margin - 15, currentY + 5);
    }

    currentY += 8;

    // Contact Info (Phone | Email)
    doc.setFont(pdfFont, "normal");
    doc.setFontSize(9);
    doc.setTextColor(textGray600);
    const contactText = [];
    if (hospitalInfo.phone) contactText.push(`Phone: ${hospitalInfo.phone}`);
    if (hospitalInfo.email) contactText.push(`Email: ${hospitalInfo.email}`);
    doc.text(contactText.join('   '), margin, currentY);

    currentY += 8;
    
    // "PATIENT PRESCRIPTION" Label
    doc.setFont(pdfFont, "bold");
    doc.setFontSize(10);
    doc.setTextColor(brandHex); 
    doc.text("PATIENT PRESCRIPTION", margin, currentY);

    currentY += 3;
    
    // Separator Line
    doc.setDrawColor(brandHex);
    doc.setLineWidth(0.8);
    doc.line(margin, currentY, pageWidth - margin, currentY);

    currentY += 10;

    // --- Info Cards (Side-by-Side) ---
    const cardGap = 6;
    const cardWidth = (usableWidth - cardGap) / 2;
    const cardHeight = 42; // Increased slightly for spacing

    // Patient Card Background
    doc.setFillColor(gray50);
    doc.setDrawColor(gray200);
    doc.setLineWidth(0.1);
    doc.roundedRect(margin, currentY, cardWidth, cardHeight, 1, 1, 'FD');

    // Doctor Card Background
    doc.setFillColor(blue50);
    doc.setDrawColor(blue200);
    doc.roundedRect(margin + cardWidth + cardGap, currentY, cardWidth, cardHeight, 1, 1, 'FD');

    // Headers
    const pX = margin + 4;
    const pY = currentY + 7;
    const dX = margin + cardWidth + cardGap + 4;
    const dY = currentY + 7;

    doc.setFontSize(8);
    doc.setFont(pdfFont, "bold");
    doc.setTextColor(textBlue900);
    
    doc.text("PATIENT INFORMATION", pX, pY);
    doc.setDrawColor(gray200);
    doc.line(pX, pY + 2, pX + cardWidth - 8, pY + 2);

    doc.text("DOCTOR INFORMATION", dX, dY);
    doc.setDrawColor(blue200);
    doc.line(dX, dY + 2, dX + cardWidth - 8, dY + 2);

    // Fields Helper
    const drawField = (label: string, value: string, x: number, y: number, maxWidth?: number) => {
        doc.setFont(pdfFont, "bold");
        doc.setFontSize(7);
        doc.setTextColor(textBlue900);
        doc.text(label, x, y);
        
        doc.setFont(pdfFont, "normal");
        doc.setFontSize(9); // Increased value size slightly
        doc.setTextColor(textGray900);
        
        // Handle wrapping if maxWidth provided
        if (maxWidth) {
             const lines = doc.splitTextToSize(value, maxWidth);
             doc.text(lines, x, y + 4);
        } else {
             doc.text(value, x, y + 4);
        }
    };

    // Patient Data (Grid)
    const row1 = pY + 10;
    const row2 = pY + 22;
    const pCol2 = pX + (cardWidth / 2);

    drawField("Name", prescription.patientName, pX, row1);
    drawField("Patient ID", patientInfo?.patientId || prescription.walkInPatientId || '-', pCol2, row1);
    drawField("Age / Gender", `${prescription.patientAge} Y / ${prescription.patientGender}`, pX, row2);
    drawField("Date", formatDate(prescription.createdAt, hospitalInfo.timezone, hospitalInfo.calendarType), pCol2, row2);

    // Doctor Data (Grid + Wrap)
    const dCol2 = dX + (cardWidth / 2);
    
    drawField("Doctor Name", prescription.doctorName, dX, row1);
    drawField("Reg. No", doctorInfo?.registrationNumber || '-', dCol2, row1);
    
    // Specialization (Wrapped)
    // Max width is column width minus padding
    const specMaxWidth = (cardWidth / 2) - 4; 
    drawField("Specialization", doctorInfo?.specialization || '-', dX, row2, (cardWidth - 8)); // Use full width for spec if needed or half?
    // Actually spec often long, lets give it full width on next row or keep in grid but wrap
    // Screenshot shows spec on bottom left. 
    // Doctor Name | Reg No
    // Spec | Rx #
    
    // Re-check screenshot:
    // Doctor Name (Row1 Col1) | Reg No (Row1 Col2)
    // Specialization (Row2 Col1) | Rx # (Row2 Col2)
    // Spec wraps badly. 
    
    // We will use wrapping for specialization column
    drawField("Specialization", doctorInfo?.specialization || '-', dX, row2, specMaxWidth);
    
    drawField("Rx #", prescription.prescriptionNumber, dCol2, row2);

    currentY += cardHeight + 12;

    // --- Body Columns ---
    const leftWidth = usableWidth * 0.3;
    const rightWidth = usableWidth * 0.7;
    const colGap = 8;
    
    let leftY = currentY;
    let rightY = currentY;

    const stripHtml = (html: string) => {
       const tmp = document.createElement("DIV");
       tmp.innerHTML = html;
       return tmp.textContent || tmp.innerText || "";
    };

    // --- Left Col: Clinical Record ---
    // "CR" Large Blue Serif
    doc.setFont("times", "bold"); // Serif
    doc.setFontSize(14);
    doc.setTextColor(brandHex);
    doc.text("CR", margin, leftY);
    
    const crWidth = doc.getTextWidth("CR");
    
    doc.setFont(pdfFont, "bold"); // Sans
    doc.setFontSize(9);
    doc.setTextColor(textGray600);
    doc.text("CLINICAL RECORD", margin + crWidth + 4, leftY);

    leftY += 3;
    doc.setDrawColor(gray200);
    doc.setLineWidth(0.5);
    doc.line(margin, leftY, margin + leftWidth - 4, leftY);
    leftY += 6;

    // Diagnosis Content
    const diagnosisText = prescription.diagnosis ? stripHtml(prescription.diagnosis) : "No clinical record";
    doc.setFont(pdfFont, "normal");
    doc.setFontSize(9);
    doc.setTextColor(prescription.diagnosis ? textGray900 : '#9ca3af');
    const diagLines = doc.splitTextToSize(diagnosisText, leftWidth - 4);
    doc.text(diagLines, margin, leftY);
    leftY += (diagLines.length * 5) + 12;

    // --- Left Col: Advice ---
    if (prescription.advice) {
        // Warning Icon + NOTE
        doc.setFont(pdfFont, "bold");
        doc.setFontSize(11);
        doc.setTextColor('#d97706'); // Amber
        doc.text("!", margin +1, leftY);
        
        doc.setFontSize(9);
        doc.setTextColor(textGray600);
        doc.text("NOTE", margin + 10, leftY);

        leftY += 3;
        doc.setDrawColor(gray200);
        doc.line(margin, leftY, margin + leftWidth - 4, leftY);
        leftY += 6;

        doc.setFont(pdfFont, "normal");
        doc.setFontSize(9);
        doc.setTextColor(textGray900);
        const adviceText = stripHtml(prescription.advice);
        const adviceLines = doc.splitTextToSize(adviceText, leftWidth - 4);
        doc.text(adviceLines, margin, leftY);
        leftY += (adviceLines.length * 5);
    }

    // --- Right Col: Medicines Table ---
    const tableX = margin + leftWidth + colGap;

    // Header Bar
    doc.setFillColor(brandHex);
    doc.rect(tableX, rightY - 6, rightWidth - colGap, 9, 'F');

    doc.setFont(pdfFont, "bold");
    doc.setFontSize(9);
    doc.setTextColor("#ffffff");
    doc.text("PRESCRIBED MEDICINES", tableX + 3, rightY);
    
    doc.setFontSize(8);
    doc.text(`${prescription.medicines.length} ITEMS`, tableX + rightWidth - colGap - 18, rightY);

    rightY += 4;

    const tableBody = prescription.medicines.map((med: any, index: number) => {
        return [
            index + 1,
            formatMedicineForPrint(med, inventory),
            med.dose,
            med.duration,
            instructionOptions.find(opt => opt.value === med.instruction)?.label || med.instruction,
            med.quantity
        ];
    });

    autoTable(doc, {
        startY: rightY,
        margin: { left: tableX },
        tableWidth: rightWidth - colGap,
        head: [['#', 'Medicine Name', 'Dosage', 'Duration', 'Instr.', 'Qty']],
        body: tableBody,
        theme: 'plain', // Custom styling
        headStyles: { 
            fillColor: gray50, 
            textColor: textGray600, 
            fontStyle: 'bold', 
            lineWidth: 0.1,
            lineColor: gray200,
            fontSize: 8,
            cellPadding: 3
        },
        styles: { 
            fontSize: 8, 
            cellPadding: 3, 
            font: pdfFont,
            textColor: textGray900,
            lineWidth: 0.1,
            lineColor: gray200
        },
        columnStyles: {
            0: { cellWidth: 8, halign: 'center', textColor: '#9ca3af' },
            1: { cellWidth: 'auto', fontStyle: 'bold' }, // Name bold
            2: { cellWidth: 20, cellPadding: {top: 3, bottom: 3, left: 2, right: 2} }, // Dosage
            3: { cellWidth: 15 },
            4: { cellWidth: 22 },
            5: { cellWidth: 10, halign: 'center' }
        },
        didParseCell: (data) => {
            // Style Dosage like a badge? Hard in generic autotable, but we can assume text
        }
    });

    rightY = (doc as any).lastAutoTable.finalY + 10;
    currentY = Math.max(leftY, rightY);

    // --- Footer & Signatures ---
    if (currentY > 230) {
        doc.addPage();
        currentY = 40;
    } else {
        currentY = Math.max(currentY, 230); 
    }

    const sigY = 255;

    // QR Code
    doc.setDrawColor(gray200);
    doc.rect(margin, sigY, 22, 22); 
    // To actually render a QR code image we'd need a library to generate base64 QR on fly (like qrcode)
    // For now we use placeholder text or fetch if possible.
    // 'qrcode' lib is imported as QRCode.toDataURL(text)
    try {
        const qrData = JSON.stringify({
            id: prescription.id,
            rx: prescription.prescriptionNumber
        });
        const qrUrl = await QRCode.toDataURL(qrData, { margin: 1, width: 80 });
        doc.addImage(qrUrl, 'PNG', margin + 1, sigY + 1, 20, 20);
    } catch(e) {
        // Fallback
    }

    doc.setFontSize(6);
    doc.setTextColor(textGray600);
    doc.text("SCAN TO VERIFY", margin, sigY + 25);

    // Doctor Signature
    const sigW = printAssetSettings.signatureWidth || 40;
    const sigH = printAssetSettings.signatureHeight || 20;
    const sigX = usableWidth - sigW;

    if (signatureBase64) {
        doc.addImage(signatureBase64, 'PNG', sigX, sigY, sigW, sigH, undefined, 'FAST');
    }
    
    // Line under signature
    doc.setDrawColor(textGray900);
    doc.setLineWidth(0.5);
    doc.line(usableWidth - 40, sigY + 15, usableWidth, sigY + 15);
    
    doc.setFontSize(9);
    doc.setFont(pdfFont, "bold");
    doc.setTextColor(textGray900);
    doc.text(doctorInfo?.name || '', usableWidth - 20, sigY + 20, { align: "center" });
    
    doc.setFontSize(7);
    doc.setFont(pdfFont, "normal");
    doc.setTextColor(textGray600);
    doc.text("DOCTOR'S SIGNATURE", usableWidth - 20, sigY + 24, { align: "center" });

    // Legal Footer
    doc.setFontSize(7);
    doc.setTextColor('#9ca3af');
    doc.text(`${hospitalInfo.name} • ${hospitalInfo.address || ''}`, pageWidth / 2, 280, { align: 'center' });
    doc.text(`License No: ${hospitalInfo.license || ''}`, pageWidth / 2, 283, { align: 'center' });
    doc.text("Powered by: Soft Care IT Solutions", pageWidth / 2, 287, { align: 'center' });

    doc.save(`Prescription_${prescription.prescriptionNumber}.pdf`);
  };

  const handleDeletePrescription = (prescription: any) => {
    setSelectedPrescription(prescription);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedPrescription) return;
    await deletePrescription(selectedPrescription.id);
    setShowDeleteModal(false);
    setSelectedPrescription(null);
    setToast({ message: 'Prescription deleted successfully.', type: 'success' });
  };

  return (
    <div className="space-y-3">
      {/* Compact Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Prescriptions</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {showNextVisitOnly ? 'Next visit patients list' : `Manage prescriptions for ${isAllHospitals ? 'All Hospitals' : currentHospital.name}`}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-md p-0.5">
            <button
              type="button"
              onClick={() => setShowNextVisitOnly(false)}
              className={`px-2.5 py-1 text-xs rounded ${!showNextVisitOnly ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-700 dark:text-gray-300'}`}
            >
              All Prescriptions
            </button>
            <button
              type="button"
              onClick={() => setShowNextVisitOnly(true)}
              className={`px-2.5 py-1 text-xs rounded ${showNextVisitOnly ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-700 dark:text-gray-300'}`}
            >
              Next Visit Patients
            </button>
          </div>

          {/* Compact Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={showNextVisitOnly ? 'Search next visit patients...' : 'Search prescriptions...'}
              className="w-48 pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Action Buttons */}
          {canExportPrescriptions && (
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs font-medium shadow-sm"
              title="Export to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
          )}
          {canExportPrescriptions && (
            <button
              onClick={exportToPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs font-medium shadow-sm"
              title="Export to PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              PDF
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

      {showNextVisitOnly && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <select
              value={nextVisitStatusFilter}
              onChange={(e) => setNextVisitStatusFilter(e.target.value as any)}
              title="Next visit status filter"
              className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="overdue">Overdue</option>
              <option value="today">Today</option>
              <option value="upcoming">Upcoming</option>
              <option value="thisWeek">This Week</option>
            </select>

            <select
              value={nextVisitDoctorFilter}
              onChange={(e) => setNextVisitDoctorFilter(e.target.value)}
              title="Doctor filter"
              className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Doctors</option>
              {nextVisitDoctorOptions.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
              ))}
            </select>

            <input
              type="date"
              value={nextVisitFrom}
              onChange={(e) => setNextVisitFrom(e.target.value)}
              title="Next visit from date"
              className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            />

            <input
              type="date"
              value={nextVisitTo}
              onChange={(e) => setNextVisitTo(e.target.value)}
              title="Next visit to date"
              className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            />

            <button
              type="button"
              onClick={() => {
                setNextVisitStatusFilter('all');
                setNextVisitDoctorFilter('all');
                setNextVisitFrom('');
                setNextVisitTo('');
              }}
              className="px-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Prescriptions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="overflow-x-auto rounded-t-lg" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          <table className="w-full text-left border-collapse relative">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
              <tr>
                <th onClick={() => handleSort('prescriptionNumber')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Rx #
                    {renderSortIcon('prescriptionNumber')}
                  </div>
                </th>
                <th onClick={() => handleSort('createdAt')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Date
                    {renderSortIcon('createdAt')}
                  </div>
                </th>
                <th onClick={() => handleSort('nextVisit')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Next Visit
                    {renderSortIcon('nextVisit')}
                  </div>
                </th>
                <th onClick={() => handleSort('patientName')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Patient
                    {renderSortIcon('patientName')}
                  </div>
                </th>
                {showNextVisitOnly && (
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Last Rx</th>
                )}
                <th onClick={() => handleSort('doctorName')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Doctor
                    {renderSortIcon('doctorName')}
                  </div>
                </th>
                <th onClick={() => handleSort('medicines')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-center transition-colors">
                  <div className="flex items-center justify-center gap-1.5">
                    Medicines
                    {renderSortIcon('medicines')}
                  </div>
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedPrescriptions.length > 0 ? (
                paginatedPrescriptions.map((prescription) => {
                  const nextVisitDate = prescription.nextVisit ? new Date(prescription.nextVisit) : null;
                  const now = new Date();
                  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  const tomorrowStart = new Date(todayStart);
                  tomorrowStart.setDate(todayStart.getDate() + 1);
                  const isTodayVisit = Boolean(nextVisitDate && nextVisitDate >= todayStart && nextVisitDate < tomorrowStart);

                  return (
                  <tr
                    key={prescription.id}
                    className={`${isTodayVisit ? 'bg-amber-50/80 dark:bg-amber-900/20' : ''} hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group`}
                  >
                    <td className="px-4 py-2">
                      <span className="font-mono text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800">
                        {prescription.prescriptionNumber}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {formatDate(prescription.createdAt, currentHospital.timezone, currentHospital.calendarType)}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {prescription.nextVisit ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border ${isTodayVisit ? 'border-amber-300 text-amber-800 bg-amber-100 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300 font-semibold' : 'border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'}`}>
                          {isTodayVisit && <span className="mr-1">Today:</span>}
                          {formatDate(prescription.nextVisit, currentHospital.timezone, currentHospital.calendarType)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-xs font-medium text-gray-900 dark:text-white">{prescription.patientName}</div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">{prescription.patientAge}Y • {prescription.patientGender}</div>
                    </td>
                    {showNextVisitOnly && (
                      <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">
                        {previousPrescriptionById.get(prescription.id)?.prescriptionNumber ? (
                          <div>
                            <div className="font-mono text-[10px]">{previousPrescriptionById.get(prescription.id).prescriptionNumber}</div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400">
                              {formatDate(previousPrescriptionById.get(prescription.id).createdAt, currentHospital.timezone, currentHospital.calendarType)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{prescription.doctorName}</td>
                    <td className="px-4 py-2 text-center">
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-gray-100 dark:bg-gray-700 rounded-full text-[10px] font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                        {prescription.medicines.length}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleViewPrescription(prescription)}
                          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                          title="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canPrintPrescriptions && (
                          <button
                            onClick={() => handlePrintPrescription(prescription)}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                            title="Print"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canPrintPrescriptions && (
                          <button
                            onClick={() => handleExportSinglePDF(prescription)}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                            title="Download PDF"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canEditPrescription(prescription) && (
                          <button
                            onClick={() => navigate('/prescriptions/create', { state: { editPrescriptionData: prescription } })}
                            className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-md transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeletePrescriptions && (
                          <button
                            onClick={() => handleDeletePrescription(prescription)}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )})
              ) : (
                <tr>
                  <td colSpan={showNextVisitOnly ? 8 : 7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                        <Search className="w-6 h-6 text-gray-400 opacity-50" />
                      </div>
                      <p className="text-sm font-medium">No prescriptions found</p>
                      <p className="text-xs mt-1">Try adjusting your search terms</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer with totals and pagination */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 rounded-b-lg flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-4">
             <span>
              Showing <span className="font-semibold text-gray-900 dark:text-white">{indexOfFirstItem + 1}</span> to <span className="font-semibold text-gray-900 dark:text-white">{Math.min(indexOfLastItem, sortedPrescriptions.length)}</span> of <span className="font-semibold text-gray-900 dark:text-white">{sortedPrescriptions.length}</span> results
             </span>
             <div className="flex items-center gap-2">
               <span>Rows per page:</span>
               <select 
                 value={itemsPerPage} 
                 onChange={(e) => {
                   setItemsPerPage(Number(e.target.value));
                   setCurrentPage(1);
                 }}
                 title="Rows per page"
                 className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
               >
                 <option value={10}>10</option>
                 <option value={20}>20</option>
                 <option value={50}>50</option>
                 <option value={100}>100</option>
               </select>
             </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="First Page"
            >
              <ChevronFirst className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-1 mx-2">
              <span className="font-medium text-gray-900 dark:text-white">Page {currentPage}</span>
              <span>of {totalPages}</span>
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Last Page"
            >
              <ChevronLast className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-sm border border-gray-200 dark:border-gray-700 p-5 text-center">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Prescription</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete prescription <span className="font-semibold text-gray-900 dark:text-white">{selectedPrescription?.prescriptionNumber}</span>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium text-xs shadow-md"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Print & View Modals */}
      {showPrint && selectedPrescription && (
        <PrescriptionPrint
          hospital={hospitalDirectory.find(h => h.id === selectedPrescription.hospitalId) || hospital}
          patient={selectedPrescription.patient || patients.find(p => p.id === selectedPrescription.patientId)}
          doctor={selectedPrescription.doctor || doctors.find(d => d.id === selectedPrescription.doctorId)}
          medicines={selectedPrescription.medicines.map((med: any) => {
            const originalMed = inventory.find(m => m.id === med.medicineId || m.brandName === med.medicineName);
            return {
              ...med,
              type: med.type || originalMed?.type || '',
              genericName: originalMed?.genericName || med.genericName || '',
              brandName: originalMed?.brandName || med.brandName || med.medicineName,
              strength: med.strength || originalMed?.strength || ''
            };
          })}
          advice={selectedPrescription.advice}
          prescriptionNumber={selectedPrescription.prescriptionNumber}
          diagnosis={selectedPrescription.diagnosis}
          prescriptionDate={new Date(selectedPrescription.createdAt)}
          nextVisit={selectedPrescription.nextVisit ? new Date(selectedPrescription.nextVisit) : null}
          createdBy={selectedPrescription.createdBy}
          updatedAt={selectedPrescription.updatedAt ? new Date(selectedPrescription.updatedAt) : undefined}
          updatedBy={selectedPrescription.updatedBy}
          verificationToken={selectedPrescription.verificationToken}
          onClose={() => setShowPrint(false)}
        />
      )}

      {showViewModal && selectedPrescription && (
        <PrescriptionPrint
          hospital={hospitalDirectory.find(h => h.id === selectedPrescription.hospitalId) || hospital}
          patient={selectedPrescription.patient || patients.find(p => p.id === selectedPrescription.patientId)}
          doctor={selectedPrescription.doctor || doctors.find(d => d.id === selectedPrescription.doctorId)}
          medicines={selectedPrescription.medicines.map((med: any) => {
            const originalMed = inventory.find(m => m.id === med.medicineId || m.brandName === med.medicineName);
            return {
              ...med,
              type: med.type || originalMed?.type || '',
              genericName: originalMed?.genericName || med.genericName || '',
              brandName: originalMed?.brandName || med.brandName || med.medicineName,
              strength: med.strength || originalMed?.strength || ''
            };
          })}
          advice={selectedPrescription.advice}
          prescriptionNumber={selectedPrescription.prescriptionNumber}
          diagnosis={selectedPrescription.diagnosis}
          prescriptionDate={new Date(selectedPrescription.createdAt)}
          nextVisit={selectedPrescription.nextVisit ? new Date(selectedPrescription.nextVisit) : null}
          createdBy={selectedPrescription.createdBy}
          updatedAt={selectedPrescription.updatedAt ? new Date(selectedPrescription.updatedAt) : undefined}
          updatedBy={selectedPrescription.updatedBy}
          verificationToken={selectedPrescription.verificationToken}
          onClose={() => setShowViewModal(false)}
          viewOnly={true}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
