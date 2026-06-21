import React, { useMemo, useState } from 'react';
import { Search, Calendar, Eye, FileText, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Hospital, UserRole } from '../types';
import { usePrescriptions } from '../context/PrescriptionContext';
import { usePatients } from '../context/PatientContext';
import { useDoctors } from '../context/DoctorContext';
import { useMedicines } from '../context/MedicineContext';
import { useHospitals } from '../context/HospitalContext';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { formatDate } from '../utils/date';
import { PrescriptionPrint } from './PrescriptionPrint';

interface NextVisitPatientsListProps {
  hospital: Hospital;
  userRole: UserRole;
  currentUser?: { id: string; name: string; email: string; role: UserRole; doctorId?: string };
}

const patientKey = (p: any) => {
  if (p.patientId) return `P-${p.patientId}`;
  if (p.walkInPatientId) return `W-${p.walkInPatientId}`;
  return `N-${String(p.patientName || '').toLowerCase()}`;
};

export function NextVisitPatientsList({ hospital, userRole, currentUser }: NextVisitPatientsListProps) {
  const { prescriptions } = usePrescriptions();
  const { patients } = usePatients();
  const { doctors } = useDoctors();
  const { medicines } = useMedicines();
  const { hospitals } = useHospitals();

  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null);

  const hospitalFiltered = useMemo(() => filterByHospital(prescriptions), [filterByHospital, prescriptions]);

  const doctorFiltered = useMemo(() => {
    if (userRole === 'doctor' && currentUser?.doctorId) {
      return hospitalFiltered.filter((p) => p.doctorId === currentUser.doctorId);
    }
    return hospitalFiltered;
  }, [hospitalFiltered, userRole, currentUser]);

  const latestByPatient = useMemo(() => {
    const sorted = [...doctorFiltered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const map = new Map<string, any>();
    sorted.forEach((p) => {
      const key = patientKey(p);
      if (!map.has(key)) map.set(key, p);
    });
    return map;
  }, [doctorFiltered]);

  const rows = useMemo(() => {
    const list = doctorFiltered
      .filter((p) => p.nextVisitDate)
      .map((p) => {
        const key = patientKey(p);
        const lastPrescription = latestByPatient.get(key);
        return {
          ...p,
          lastPrescription,
        };
      });

    return list
      .filter((p) => {
        const s = searchTerm.toLowerCase().trim();
        if (!s) return true;
        return (
          p.patientName.toLowerCase().includes(s) ||
          p.doctorName.toLowerCase().includes(s) ||
          p.prescriptionNumber.toLowerCase().includes(s) ||
          p.lastPrescription?.prescriptionNumber?.toLowerCase?.().includes(s)
        );
      })
      .sort((a, b) => {
        const dateA = a.nextVisitDate ? new Date(a.nextVisitDate).getTime() : 0;
        const dateB = b.nextVisitDate ? new Date(b.nextVisitDate).getTime() : 0;
        return dateA - dateB;
      });
  }, [doctorFiltered, latestByPatient, searchTerm]);

  const exportToExcel = () => {
    const dataToExport = rows.map((row) => ({
      'Patient Name': row.patientName,
      'Patient Age': row.patientAge,
      'Gender': row.patientGender,
      'Doctor': row.doctorName,
      'Current Rx #': row.prescriptionNumber,
      'Current Rx Date': formatDate(row.createdAt, currentHospital.timezone, currentHospital.calendarType),
      'Next Visit': row.nextVisitDate ? formatDate(row.nextVisitDate, currentHospital.timezone, currentHospital.calendarType) : '-',
      'Last Rx #': row.lastPrescription?.prescriptionNumber || '-',
      'Last Rx Date': row.lastPrescription?.createdAt
        ? formatDate(row.lastPrescription.createdAt, currentHospital.timezone, currentHospital.calendarType)
        : '-',
      Hospital: hospitals.find((h) => h.id === row.hospitalId)?.name || 'Unknown',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Next Visit Patients');
    XLSX.writeFile(workbook, 'Next_Visit_Patients.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('Next Visit Patients', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${formatDate(new Date(), currentHospital.timezone, currentHospital.calendarType)}`, 14, 27);
    if (!isAllHospitals) {
      doc.text(`Hospital: ${currentHospital.name}`, 14, 33);
    }

    autoTable(doc, {
      head: [['Patient', 'Doctor', 'Current Rx', 'Next Visit', 'Last Rx']],
      body: rows.map((row) => [
        row.patientName,
        row.doctorName,
        row.prescriptionNumber,
        row.nextVisitDate ? formatDate(row.nextVisitDate, currentHospital.timezone, currentHospital.calendarType) : '-',
        row.lastPrescription?.prescriptionNumber || '-',
      ]),
      startY: isAllHospitals ? 32 : 38,
      styles: { fontSize: 8, cellPadding: 3 },
    });

    doc.save('Next_Visit_Patients.pdf');
  };

  const openLastPrescription = (row: any) => {
    if (!row?.lastPrescription) return;
    const prescription = row.lastPrescription;
    const patient = prescription.patientId
      ? patients.find((p) => p.id === prescription.patientId)
      : {
          id: 'walkin',
          patientId: prescription.walkInPatientId || 'WALKIN',
          name: prescription.patientName,
          age: prescription.patientAge,
          gender: prescription.patientGender,
          hospitalId: prescription.hospitalId,
        };
    const doctor = doctors.find((d) => d.id === prescription.doctorId);
    if (!doctor) return;
    setSelectedPrescription({ ...prescription, patient, doctor });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Next Visit Patients</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Patients scheduled for follow-up visit
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search patient, doctor, RX..."
              className="w-52 pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs font-medium"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </button>

          <button
            onClick={exportToPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs font-medium"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF
          </button>
        </div>
      </div>

      <HospitalSelector userRole={userRole} selectedHospitalId={selectedHospitalId} onHospitalChange={setSelectedHospitalId} />

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
            <tr>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Patient</th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Doctor</th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Current Rx</th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Next Visit</th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Last Prescription</th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={`${row.id}-${row.nextVisitDate || 'none'}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-2">
                    <div className="text-xs font-medium text-gray-900 dark:text-white">{row.patientName}</div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400">{row.patientAge}Y • {row.patientGender}</div>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{row.doctorName}</td>
                  <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{row.prescriptionNumber}</td>
                  <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      {row.nextVisitDate ? formatDate(row.nextVisitDate, currentHospital.timezone, currentHospital.calendarType) : '-'}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">
                    <div>{row.lastPrescription?.prescriptionNumber || '-'}</div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400">
                      {row.lastPrescription?.createdAt
                        ? formatDate(row.lastPrescription.createdAt, currentHospital.timezone, currentHospital.calendarType)
                        : '-'}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => openLastPrescription(row)}
                      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-md"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Last
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  No patients with next visit scheduled.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedPrescription && (
        <PrescriptionPrint
          hospital={hospital}
          patient={selectedPrescription.patient || patients.find((p) => p.id === selectedPrescription.patientId)}
          doctor={selectedPrescription.doctor || doctors.find((d) => d.id === selectedPrescription.doctorId)}
          medicines={selectedPrescription.medicines.map((med: any) => {
            const originalMed = medicines.find((m) => m.id === med.medicineId || m.brandName === med.medicineName);
            return {
              ...med,
              type: med.type || originalMed?.type || '',
              genericName: originalMed?.genericName || med.genericName || '',
              brandName: originalMed?.brandName || med.brandName || med.medicineName,
              strength: med.strength || originalMed?.strength || '',
            };
          })}
          advice={selectedPrescription.advice}
          prescriptionNumber={selectedPrescription.prescriptionNumber}
          diagnosis={selectedPrescription.diagnosis}
          nextVisitDate={selectedPrescription.nextVisitDate ? new Date(selectedPrescription.nextVisitDate) : null}
          prescriptionDate={new Date(selectedPrescription.createdAt)}
          createdBy={selectedPrescription.createdBy}
          updatedAt={selectedPrescription.updatedAt ? new Date(selectedPrescription.updatedAt) : undefined}
          updatedBy={selectedPrescription.updatedBy}
          verificationToken={selectedPrescription.verificationToken}
          onClose={() => setSelectedPrescription(null)}
          viewOnly
        />
      )}
    </div>
  );
}
