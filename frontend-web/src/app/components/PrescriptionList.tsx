import React, { useState, useEffect } from 'react';
import { Eye, Printer, Trash2, Search, Calendar, X, Edit, ArrowUp, ArrowDown, ArrowUpDown, FileText, FileSpreadsheet } from 'lucide-react';
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

interface PrescriptionListProps {
  hospital: Hospital;
  userRole: UserRole;
  currentUser?: { id: string; name: string; email: string; role: UserRole; doctorId?: string };
}

type SortField = 'prescriptionNumber' | 'patientName' | 'doctorName' | 'createdAt' | 'medicines';
type SortDirection = 'asc' | 'desc';

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

export function PrescriptionList({ hospital, userRole, currentUser }: PrescriptionListProps) {
  const navigate = useNavigate();
  const { prescriptions, deletePrescription } = usePrescriptions();
  const { patients } = usePatients();
  const { doctors } = useDoctors();
  const { hospitals: hospitalDirectory } = useHospitals();
  const { medicines: inventory } = useMedicines();
  // Hospital filtering for super_admin with "All Hospitals" support
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  
  const [searchTerm, setSearchTerm] = useState('');
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

  // Update prescriptions when filter dependencies change
  React.useEffect(() => {
    setVisiblePrescriptions(doctorFiltered);
  }, [doctorFiltered]);

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

  // Check if user can edit a prescription
  const canEditPrescription = (prescription: any): boolean => {
    // Super Admin and Admin can always edit
    if (userRole === 'super_admin' || userRole === 'admin') {
      return true;
    }
    
    // Doctor can only edit prescriptions created today
    if (userRole === 'doctor') {
      return isPrescriptionCreatedToday(prescription.createdAt);
    }
    
    // Other roles cannot edit
    return false;
  };

  const filteredPrescriptions = visiblePrescriptions.filter(p =>
    p.prescriptionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.doctorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const sortedPrescriptions = filteredPrescriptions.sort((a, b) => {
    if (sortField === 'createdAt') {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
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

  // Export to Excel
  const exportToExcel = () => {
    const dataToExport = sortedPrescriptions.map((prescription) => ({
      'Prescription #': prescription.prescriptionNumber,
      'Patient Name': prescription.patientName,
      'Age': prescription.patientAge,
      'Gender': prescription.patientGender,
      'Doctor': prescription.doctorName,
      'Date': formatDate(prescription.createdAt, currentHospital.timezone, currentHospital.calendarType),
      'Medicines Count': prescription.medicines.length,
      'Diagnosis': prescription.diagnosis?.replace(/<[^>]*>/g, '') || '',
      'Advice': prescription.advice?.replace(/<[^>]*>/g, '') || '',
      'Hospital': hospitalDirectory.find(h => h.id === prescription.hospitalId)?.name || 'Unknown'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Prescriptions');
    XLSX.writeFile(workbook, "Prescriptions_List.xlsx");
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
    doc.text('Prescriptions Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${formatDate(new Date(), currentHospital.timezone, currentHospital.calendarType)}`, 14, 30);
    if (!isAllHospitals) {
      doc.text(`Hospital: ${currentHospital.name}`, 14, 36);
    }

    autoTable(doc, {
      head: [['Rx #', 'Patient', 'Doctor', 'Date', 'Meds']],
      body: sortedPrescriptions.map(p => [
        p.prescriptionNumber,
        p.patientName,
        p.doctorName,
        formatDate(p.createdAt, currentHospital.timezone, currentHospital.calendarType),
        p.medicines.length
      ]),
      startY: isAllHospitals ? 40 : 46,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: tableHeaderColor }
    });

    doc.save('Prescriptions_Report.pdf');
  };

  // Export Single Prescription to PDF
  const handleExportSinglePDF = (prescription: any) => {
    const doc = new jsPDF();
    const hospitalInfo = hospitalDirectory.find(h => h.id === prescription.hospitalId) || hospital;
    const patientInfo = patients.find(p => p.id === prescription.patientId) || prescription.patient;
    
    // Get brand color or use defaults
    const brandRgb = hexToRgb(hospitalInfo.brandColor);
    const primaryColor = brandRgb || [41, 128, 185]; // Default Header Blue
    const tableHeaderColor = brandRgb || [66, 139, 202]; // Default Table Blue

    // --- Header ---
    doc.setFontSize(22);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(hospitalInfo.name, 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(hospitalInfo.address, 105, 26, { align: 'center' });
    doc.text(`Phone: ${hospitalInfo.phone} | Email: ${hospitalInfo.email}`, 105, 31, { align: 'center' });
    
    doc.setLineWidth(0.5);
    doc.setDrawColor(200);
    doc.line(14, 36, 196, 36);

    // --- Patient & Doctor Info ---
    doc.setFontSize(10);
    doc.setTextColor(0);
    
    const yInfo = 45;
    
    // Left: Patient
    doc.setFont("helvetica", "bold");
    doc.text("Patient Details", 14, yInfo);
    doc.setFont("helvetica", "normal");
    doc.text(`Name: ${prescription.patientName}`, 14, yInfo + 6);
    doc.text(`Age/Gender: ${prescription.patientAge}Y / ${prescription.patientGender}`, 14, yInfo + 11);
    doc.text(`Patient ID: ${patientInfo?.patientId || 'N/A'}`, 14, yInfo + 16);

    // Right: Doctor
    doc.setFont("helvetica", "bold");
    doc.text("Doctor Details", 120, yInfo);
    doc.setFont("helvetica", "normal");
    doc.text(`Dr. ${prescription.doctorName}`, 120, yInfo + 6);
    doc.text(`Rx #: ${prescription.prescriptionNumber}`, 120, yInfo + 11);
    doc.text(`Date: ${formatDate(prescription.createdAt, hospitalInfo.timezone, hospitalInfo.calendarType)}`, 120, yInfo + 16);

    let currentY = yInfo + 25;

    // --- Diagnosis ---
    const stripHtml = (html: string) => {
       const tmp = document.createElement("DIV");
       tmp.innerHTML = html;
       return tmp.textContent || tmp.innerText || "";
    };

    if (prescription.diagnosis) {
        doc.setFont("helvetica", "bold");
        doc.text("Diagnosis:", 14, currentY);
        doc.setFont("helvetica", "normal");
        
        const diagnosisText = stripHtml(prescription.diagnosis);
        const diagnosisLines = doc.splitTextToSize(diagnosisText, 180);
        doc.text(diagnosisLines, 14, currentY + 6);
        currentY += (diagnosisLines.length * 5) + 12;
    }

    // --- Medicines Table ---
    const tableBody = prescription.medicines.map((med: any) => {
        const originalMed = inventory.find(m => m.id === med.medicineId || m.brandName === med.medicineName);
        const medType = med.type || originalMed?.type || '';
        const displayName = medType && !med.medicineName.includes(medType)
          ? `${med.medicineName} ${medType}`
          : med.medicineName;
            
        return [
            displayName,
            med.strength,
            med.dose,
            med.duration,
            instructionOptions.find(opt => opt.value === med.instruction)?.label || med.instruction,
            med.quantity
        ];
    });

    autoTable(doc, {
        startY: currentY,
        head: [['Medicine', 'Strength', 'Dose', 'Duration', 'Instruction', 'Qty']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: tableHeaderColor, textColor: 255 },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 60 }, // Medicine Name
            1: { cellWidth: 25 },
            2: { cellWidth: 25 },
            3: { cellWidth: 25 },
            4: { cellWidth: 30 },
            5: { cellWidth: 15, halign: 'center' }
        },
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // --- Advice ---
    if (prescription.advice) {
        doc.setFont("helvetica", "bold");
        doc.text("Advice / Instructions:", 14, currentY);
        doc.setFont("helvetica", "normal");
        
        const adviceText = stripHtml(prescription.advice);
        const adviceLines = doc.splitTextToSize(adviceText, 180);
        doc.text(adviceLines, 14, currentY + 6);
        currentY += (adviceLines.length * 5) + 15;
    } else {
        currentY += 15;
    }

    // --- Footer ---
    if (currentY > 250) {
        doc.addPage();
        currentY = 40;
    }
    
    // Signature
    doc.setFontSize(10);
    doc.text("Doctor's Signature", 160, currentY + 20, { align: 'center' });
    doc.line(140, currentY + 15, 180, currentY + 15);
    
    // Disclaimer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("This is a computer-generated prescription.", 105, 285, { align: 'center' });

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
            Manage prescriptions for {isAllHospitals ? 'All Hospitals' : currentHospital.name}
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
              placeholder="Search prescriptions..."
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
        </div>
      </div>

      {/* Hospital Selector for Super Admin */}
      <HospitalSelector 
        userRole={userRole}
        selectedHospitalId={selectedHospitalId}
        onHospitalChange={setSelectedHospitalId}
      />

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
              {sortedPrescriptions.length > 0 ? (
                sortedPrescriptions.map((prescription) => (
                  <tr key={prescription.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
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
                    <td className="px-4 py-2">
                      <div className="text-xs font-medium text-gray-900 dark:text-white">{prescription.patientName}</div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">{prescription.patientAge}Y • {prescription.patientGender}</div>
                    </td>
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
                        <button
                          onClick={() => handlePrintPrescription(prescription)}
                          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                          title="Print"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleExportSinglePDF(prescription)}
                          className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                          title="Download PDF"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        {canEditPrescription(prescription) && (
                          <button
                            onClick={() => navigate('/prescriptions/create', { state: { editPrescriptionData: prescription } })}
                            className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-md transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(userRole === 'super_admin' || userRole === 'admin') && (
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
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
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
        
        {/* Footer with totals */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 rounded-b-lg flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
          <span>Total Records: <span className="font-semibold text-gray-900 dark:text-white">{filteredPrescriptions.length}</span></span>
          <span>Showing {sortedPrescriptions.length} of {visiblePrescriptions.length} prescriptions</span>
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
          hospital={hospital}
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
          createdBy={selectedPrescription.createdBy}
          updatedAt={selectedPrescription.updatedAt ? new Date(selectedPrescription.updatedAt) : undefined}
          updatedBy={selectedPrescription.updatedBy}
          onClose={() => setShowPrint(false)}
        />
      )}

      {showViewModal && selectedPrescription && (
        <PrescriptionPrint
          hospital={hospital}
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
          createdBy={selectedPrescription.createdBy}
          updatedAt={selectedPrescription.updatedAt ? new Date(selectedPrescription.updatedAt) : undefined}
          updatedBy={selectedPrescription.updatedBy}
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
