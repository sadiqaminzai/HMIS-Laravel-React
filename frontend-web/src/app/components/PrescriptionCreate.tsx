import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Plus, Save, Printer, Trash2, Pill } from 'lucide-react';
import { Hospital, Patient, Medicine, Doctor, UserRole } from '../types';
import { doseOptions, durationOptions, instructionOptions } from '../data/mockData';
import api from '../../api/axios';
import { PrescriptionPrint } from './PrescriptionPrint';
import { useSettings } from '../context/SettingsContext';
import { toast } from '../utils/toast';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { usePatients } from '../context/PatientContext';
import { useDoctors } from '../context/DoctorContext';
import { useMedicines } from '../context/MedicineContext';
import { usePrescriptions } from '../context/PrescriptionContext';
import { useAppointments } from '../context/AppointmentContext';
import { useAuth } from '../context/AuthContext';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import '../../styles/quill-custom.css';

import { useLocation, useNavigate } from 'react-router-dom';

interface PrescriptionCreateProps {
  hospital: Hospital;
  currentUser: { id?: string; name: string; email: string; role: string; doctorId?: string };
}

interface MedicineRow extends Medicine {
  rowId: string;
  isTemporary?: boolean;
}

const formatMedicineDisplay = (brand: string, generic?: string, type?: string, strength?: string, includeStrength: boolean = true) => {
  const parts = [];
  if (type) parts.push(type);
  if (brand) parts.push(brand);
  if (generic) parts.push(`(${generic})`);
  if (includeStrength && strength) parts.push(strength);
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
};

const toMaxLength = (value: string | undefined | null, max = 255) => {
  if (!value) return '';
  return String(value).slice(0, max);
};

export function PrescriptionCreate({ hospital, currentUser }: PrescriptionCreateProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const editPrescriptionData = location.state?.editPrescriptionData;

  // Hospital filtering for super_admin with "All Hospitals" support (but for create, we use currentHospital as the target)
  const userRole = currentUser.role as UserRole;
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  const { settings, getDefaultToWalkIn, getShowOutOfStockMedicines, loadHospitalSetting } = useSettings();
  const { hasPermission } = useAuth();
  const { patients } = usePatients();
  const { doctors } = useDoctors();
  const { medicines: inventory } = useMedicines();
  const { addPrescription, updatePrescription } = usePrescriptions();
  const { appointments } = useAppointments();

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [medicines, setMedicines] = useState<MedicineRow[]>([]);
  const [diagnosis, setDiagnosis] = useState('');
  const [advice, setAdvice] = useState('');
  const [showPrint, setShowPrint] = useState(false);
  const [currentRowIndex, setCurrentRowIndex] = useState(0);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [highlightedPatientIndex, setHighlightedPatientIndex] = useState(0);
  const [openMedicineDropdownRowId, setOpenMedicineDropdownRowId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isWalkIn, setIsWalkIn] = useState(settings.defaultToWalkIn || false);
  const [walkInPatient, setWalkInPatient] = useState({
    name: '',
    age: '',
    gender: 'male'
  });

  const isEditMode = Boolean(editPrescriptionData?.id);
  const canCreatePrescription = hasPermission('create_prescription') || hasPermission('add_prescriptions') || hasPermission('manage_prescriptions');
  const canEditPrescription = hasPermission('edit_prescriptions') || hasPermission('manage_prescriptions');
  const canPrintPrescription = hasPermission('print_prescriptions') || hasPermission('manage_prescriptions');
  const canSavePrescription = isEditMode ? canEditPrescription : canCreatePrescription;

  const insertDiagnosisBlock = (html: string) => {
    setDiagnosis((prev) => (prev ? `${prev}<br/>${html}` : html));
  };

  const insertDiagnosisLabel = (label: string, value: string = '') => {
    const html = `<strong>${label}</strong>${value ? ` ${value}` : ''}`;
    insertDiagnosisBlock(html);
  };

  const insertDiagnosisTemplate = () => {
    const doctorName = selectedDoctor?.name ? ` ${selectedDoctor.name}` : '';
    const template = [
      '<strong>H/O</strong>',
      '<strong>C/C</strong>',
      '<strong>BP</strong>',
      '<strong>Weight</strong>',
      `<strong>Doctor</strong>${doctorName}`
    ].join('<br/>');
    insertDiagnosisBlock(template);
  };

  const walkInDefaultPatient = useMemo(
    () => patients.find((p) => p.hospitalId === currentHospital.id && p.patientId?.toUpperCase().startsWith('WALKIN')),
    [patients, currentHospital.id]
  );

  useEffect(() => {
    if (userRole === 'super_admin' && editPrescriptionData?.hospitalId) {
      setSelectedHospitalId(editPrescriptionData.hospitalId);
    }
  }, [userRole, editPrescriptionData?.hospitalId, setSelectedHospitalId]);

  const patientInputRef = useRef<HTMLInputElement>(null);
  const medicinesScrollRef = useRef<HTMLDivElement>(null);
  const shouldScrollMedicinesToBottomRef = useRef(false);

  const fallbackLoggedInDoctor: Doctor | null = useMemo(() => {
    const role = String(currentUser.role || '').toLowerCase();
    if (role !== 'doctor') return null;
    const id = currentUser.doctorId || currentUser.id;
    if (!id) return null;
    return {
      id: String(id),
      hospitalId: String(currentHospital.id),
      name: currentUser.name,
      specialization: '',
      registrationNumber: '',
      consultationFee: 0,
      email: currentUser.email,
      phone: '',
      status: 'active',
      image: '',
      signature: '',
      availability: [],
    };
  }, [currentHospital.id, currentUser.doctorId, currentUser.email, currentUser.id, currentUser.name, currentUser.role]);

  // Auto-assign logged-in doctor if user is a doctor
  useEffect(() => {
    if (String(currentUser.role || '').toLowerCase() !== 'doctor') return;

    // After the "doctors are users" migration, appointment/prescription doctorId is users.id.
    const loggedInDoctorId = currentUser.id;
    if (!loggedInDoctorId) return;

    // Compare as strings to ensure type consistency
    const loggedInDoctor = doctors.find((d) => String(d.id) === String(loggedInDoctorId));
    if (loggedInDoctor) {
      setSelectedDoctor(loggedInDoctor);
    } else if (fallbackLoggedInDoctor) {
      setSelectedDoctor(fallbackLoggedInDoctor);
    }
  }, [currentUser.id, currentUser.role, doctors, fallbackLoggedInDoctor]);

  // Honor hospital-specific default walk-in preference from settings
  useEffect(() => {
    if (editPrescriptionData) return;
    const defaultWalkIn = getDefaultToWalkIn(currentHospital.id) || settings.defaultToWalkIn || false;
    setIsWalkIn(defaultWalkIn);
    if (defaultWalkIn && walkInDefaultPatient) {
      setSelectedPatient(walkInDefaultPatient);
      setPatientSearch(walkInDefaultPatient.name);
    }
  }, [currentHospital.id, editPrescriptionData, getDefaultToWalkIn, settings.defaultToWalkIn, walkInDefaultPatient]);

  useEffect(() => {
    loadHospitalSetting(currentHospital.id);
  }, [currentHospital.id, loadHospitalSetting]);

  useEffect(() => {
    if (!shouldScrollMedicinesToBottomRef.current) return;
    const container = medicinesScrollRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
      shouldScrollMedicinesToBottomRef.current = false;
    });
  }, [medicines.length]);

  // Populate form when editing existing prescription
  useEffect(() => {
    if (editPrescriptionData) {
      const isWalkInEdit = Boolean(editPrescriptionData.isWalkIn) || !editPrescriptionData.patientId;

      setIsWalkIn(isWalkInEdit);

      if (isWalkInEdit) {
        const walkInSerial = editPrescriptionData.walkInPatientId || `WALKIN-${editPrescriptionData.id || Date.now()}`;
        const tempPatient: Patient = {
          id: `WALKIN-${walkInSerial}`,
          hospitalId: currentHospital.id,
          patientId: String(walkInSerial),
          name: editPrescriptionData.patientName || 'Walk-in Patient',
          age: Number(editPrescriptionData.patientAge ?? 0),
          gender: (editPrescriptionData.patientGender || 'male').toString().toLowerCase() as Patient['gender'],
          contact: '',
          address: '',
          bloodGroup: '',
          allergies: [],
          medicalHistory: '',
          status: 'active',
          createdAt: new Date().toISOString(),
        };

        setSelectedPatient(tempPatient);
        setPatientSearch(editPrescriptionData.patientName || '');
        setWalkInPatient({
          name: editPrescriptionData.patientName || '',
          age: String(editPrescriptionData.patientAge ?? ''),
          gender: (editPrescriptionData.patientGender || 'male').toString().toLowerCase(),
        });
      } else {
        // Find and set the patient
        const patient = patients.find(p => p.id === editPrescriptionData.patientId);
        if (patient) {
          setSelectedPatient(patient);
          setPatientSearch(patient.name);
        }
      }

      // Find and set the doctor
      const doctor = doctors.find(d => d.id === editPrescriptionData.doctorId);
      if (doctor) {
        setSelectedDoctor(doctor);
      }

      // Set diagnosis and advice
      setDiagnosis(editPrescriptionData.diagnosis || '');
      setAdvice(editPrescriptionData.advice || '');

      // Convert medicines to medicine rows
      const medicineRows: MedicineRow[] = editPrescriptionData.medicines.map((med: any) => {
        const originalMed = inventory.find(m => m.id === med.medicineId || m.brandName === med.medicineName);
        const medType = (med as any).type || (originalMed as any)?.type || '';
        const brand = originalMed?.brandName || med.medicineName;
        const generic = originalMed?.genericName;
        const strength = originalMed?.strength || med.strength || '';
        const displayName = formatMedicineDisplay(brand, generic, medType, strength, true);

        return {
          rowId: Date.now().toString() + Math.random().toString(),
          medicineId: med.medicineId || '',
          brandName: displayName,
          genericName: generic || '',
          strength,
          dose: med.dose ?? '',
          duration: med.duration ?? '',
          instruction: med.instruction ?? '',
          quantity: med.quantity ?? 0,
          type: medType,
          isTemporary: !originalMed && !med.medicineId
        };
      });
      
      setMedicines(medicineRows);
    }
  }, [editPrescriptionData, patients, doctors, inventory]);

  const eligiblePatientIds = useMemo(() => {
    const role = String(currentUser.role || '').toLowerCase();

    // Doctors: only patients with *scheduled* appointments for that logged-in doctor.
    if (role === 'doctor') {
      const doctorIdCandidates = [currentUser.id, currentUser.doctorId, selectedDoctor?.id]
        .filter(Boolean)
        .map((id) => String(id));

      if (doctorIdCandidates.length === 0) return new Set<string>();

      return new Set(
        appointments
          .filter(
            (a) =>
              String(a.hospitalId) === String(currentHospital.id) &&
              String(a.status).toLowerCase() === 'scheduled' &&
              doctorIdCandidates.includes(String(a.doctorId))
          )
          .map((a) => String(a.patientId))
      );
    }

    // Admin/Super Admin: all hospital patients who have any *scheduled* appointment (any doctor).
    return new Set(
      appointments
        .filter(
          (a) =>
            String(a.hospitalId) === String(currentHospital.id) &&
            String(a.status).toLowerCase() === 'scheduled'
        )
        .map((a) => String(a.patientId))
    );
  }, [appointments, currentHospital.id, currentUser.doctorId, currentUser.id, currentUser.role, selectedDoctor?.id]);

  // Filter patients based on search and current hospital.
  // Doctors/Admins: only show patients that have scheduled appointments.
  const filteredPatients = patients.filter((p) => {
    if (String(p.hospitalId) !== String(currentHospital.id)) return false;

    const search = patientSearch.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(search) ||
      p.patientId.toLowerCase().includes(search);

    if (!matchesSearch) return false;

    return eligiblePatientIds.has(String(p.id));
  });

  // Reset highlighted index when filtered patients change
  useEffect(() => {
    setHighlightedPatientIndex(0);
  }, [patientSearch]);

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    setPatientSearch(patient.name);
    setShowPatientDropdown(false);

    // Auto-add first medicine row
    if (medicines.length === 0) {
      addMedicineRow();
    }
  };

  const handleWalkInConfirm = () => {
    if (!walkInPatient.name || !walkInPatient.age) {
      toast.error('Please enter walk-in patient name and age');
      return;
    }

    // Create a temporary walk-in patient object
    const tempPatient: Patient = {
      id: 'WALKIN-' + Date.now(),
      hospitalId: hospital.id,
      patientId: 'WALKIN-' + Date.now().toString().slice(-6),
      name: walkInPatient.name,
      age: parseInt(walkInPatient.age),
      gender: walkInPatient.gender as Patient['gender'],
      contact: '',
      address: '',
      bloodGroup: '',
      allergies: [],
      medicalHistory: '',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    setSelectedPatient(tempPatient);
    
    // Auto-add first medicine row
    if (medicines.length === 0) {
      addMedicineRow();
    }
  };

  const handleTogglePatientType = (type: 'existing' | 'walkin') => {
    setIsWalkIn(type === 'walkin');
    setSelectedPatient(null);
    setPatientSearch('');
    setWalkInPatient({ name: '', age: '', gender: 'male' });
    if (type === 'walkin' && walkInDefaultPatient) {
      setSelectedPatient(walkInDefaultPatient);
      setPatientSearch(walkInDefaultPatient.name);
    }
    
    // Auto-assign logged-in doctor for walk-in patients if user is a doctor
    if (type === 'walkin' && String(currentUser.role || '').toLowerCase() === 'doctor') {
      const loggedInDoctor = doctors.find((d) => String(d.id) === String(currentUser.id));
      if (loggedInDoctor) setSelectedDoctor(loggedInDoctor);
      else if (fallbackLoggedInDoctor) setSelectedDoctor(fallbackLoggedInDoctor);
    } else if (type === 'walkin' && (currentUser.role === 'super_admin' || currentUser.role === 'admin')) {
      // Clear doctor for admin/super_admin creating walk-in prescriptions
      setSelectedDoctor(null);
    }
  };

  const addMedicineRow = () => {
    const newRow: MedicineRow = {
      rowId: Date.now().toString(),
      medicineId: '',
      brandName: '',
      genericName: '',
      strength: '',
      dose: '',
      duration: '',
      instruction: '',
      quantity: 0,
      isTemporary: false
    };
    shouldScrollMedicinesToBottomRef.current = true;
    setMedicines([...medicines, newRow]);
  };

  const addTemporaryMedicineRow = () => {
    const newRow: MedicineRow = {
      rowId: Date.now().toString(),
      medicineId: '',
      brandName: '',
      genericName: '',
      strength: '',
      dose: '',
      duration: '',
      instruction: '',
      quantity: 0,
      isTemporary: true
    };
    shouldScrollMedicinesToBottomRef.current = true;
    setMedicines([...medicines, newRow]);
  };

  const removeMedicineRow = (rowId: string) => {
    setMedicines(medicines.filter(m => m.rowId !== rowId));
  };

  const updateMedicineRow = (rowId: string, field: keyof MedicineRow, value: any) => {
    setMedicines(medicines.map(m => {
      if (m.rowId === rowId) {
        const updated = { ...m, [field]: value };
        
        // Auto-calculate quantity when dose or duration changes
        if (field === 'dose' || field === 'duration') {
          const dose = field === 'dose' ? value : m.dose;
          const duration = field === 'duration' ? value : m.duration;
          updated.quantity = calculateQuantity(dose, duration);
        }
        
        return updated;
      }
      return m;
    }));
  };

  // Batch update multiple fields at once to avoid React state batching issues
  const updateMedicineRowBatch = (rowId: string, updates: Partial<MedicineRow>) => {
    setMedicines(medicines.map(m => {
      if (m.rowId === rowId) {
        return { ...m, ...updates };
      }
      return m;
    }));
  };

  const calculateQuantity = (dose: string, duration: string): number => {
    let dosePerDay = 0;
    
    // Check for standard X-X-X format
    if (dose.includes('-')) {
      dosePerDay = dose.split('-').reduce((sum, val) => {
        const num = parseFloat(val);
        return sum + (isNaN(num) ? 0 : num);
      }, 0);
    } else {
      // Basic text parsing
      const lowerDose = dose.toLowerCase();
      if (lowerDose.includes('once') || lowerDose === 'od' || lowerDose === 'stat') dosePerDay = 1;
      else if (lowerDose.includes('twice') || lowerDose === 'bid') dosePerDay = 2;
      else if (lowerDose.includes('thrice') || lowerDose === 'tid') dosePerDay = 3;
      else if (lowerDose.includes('four') || lowerDose === 'qid') dosePerDay = 4;
    }

    let days = 0;
    const lowerDuration = duration.toLowerCase();
    const num = parseInt(duration) || 1; // Default to 1 if number not found but keyword matches

    if (lowerDuration.includes('month')) {
      days = num * 30;
    } else if (lowerDuration.includes('week')) {
      days = num * 7;
    } else if (lowerDuration.includes('year')) {
      days = num * 365;
    } else if (lowerDuration.includes('day')) {
      days = parseInt(duration) || 0;
    } else if (lowerDuration.includes('continue')) {
      days = 15; // Default assumption for 'continue' if calculation needed
    } else {
      // Try just parsing the number
      days = parseInt(duration) || 0;
    }

    if (dosePerDay === 0 || days === 0) return 0;
    
    return Math.ceil(dosePerDay * days);
  };

  const role = String(currentUser.role || '').toLowerCase();
  const hideOutOfStockForDoctors = role === 'doctor' && !getShowOutOfStockMedicines(currentHospital.id);

  const handleMedicineSearch = (rowId: string, searchTerm: string) => {
    updateMedicineRow(rowId, 'brandName', searchTerm);
    
    // Auto-complete if exact match found
    const medicine = inventory.find(m =>
      m.hospitalId === currentHospital.id &&
      m.status === 'active' &&
      (!hideOutOfStockForDoctors || (m.stock ?? 0) > 0) &&
      m.brandName.toLowerCase() === searchTerm.toLowerCase()
    );
    
    if (medicine) {
      const medType = medicine.type || '';
      const displayName = formatMedicineDisplay(medicine.brandName, medicine.genericName, medType, medicine.strength, true);
      // Use batch update to ensure all fields are updated together
      updateMedicineRowBatch(rowId, {
        medicineId: medicine.id,
        brandName: displayName,
        genericName: medicine.genericName || '',
        strength: medicine.strength || '',
        type: medType,
        isTemporary: false
      });
    }
  };

  const handleSave = async () => {
    if (!canSavePrescription) {
      toast.error(isEditMode ? 'You are not authorized to edit prescriptions' : 'You are not authorized to create prescriptions');
      return;
    }

    if (isSaving) return;
    if (medicines.length === 0) {
      toast.error('Add at least one medicine');
      return;
    }

    let patient: Patient | null = selectedPatient;

    const isWalkInMode = isWalkIn || !selectedPatient;
    if (isWalkInMode) {
      if (!walkInPatient.name || !walkInPatient.age) {
        toast.error('Enter walk-in patient name and age');
        return;
      }
      patient = null; // force null so backend treats as walk-in
    }

    if (!patient && !isWalkInMode) {
      toast.error('Please select a patient');
      return;
    }

    const hospitalDoctors = doctors.filter((d) => d.hospitalId === currentHospital.id);
    
    // For walk-in patients created by admin/super_admin, doctor can be null
    // For doctors, use logged-in doctor for walk-in prescriptions
    const role = String(currentUser.role || '').toLowerCase();
    const isAdminOrSuperAdmin = role === 'super_admin' || role === 'admin';
    
    let doctor = selectedDoctor;
    
    // If user is a doctor, ALWAYS use their associated doctor profile
    if (role === 'doctor') {
      const loggedInDoctor = currentUser.id
        ? doctors.find((d) => String(d.id) === String(currentUser.id))
        : null;
      doctor = loggedInDoctor || fallbackLoggedInDoctor || doctor;
    }
    
    // Fallback to first hospital doctor if no doctor selected (for non-admin users)
    if (!doctor && !isAdminOrSuperAdmin) {
      doctor = hospitalDoctors[0] || null;
    }
    
    if (!doctor && !isAdminOrSuperAdmin) {
      toast.error('Please select a doctor');
      return;
    }

    const payloadMedicines = medicines.map((m) => ({
      // Keep medicineId nullable so validation doesn't fail when a free-text brand is used
      medicineId: m.medicineId || '',
      medicineName: toMaxLength(m.brandName, 255),
      strength: toMaxLength(m.strength, 255),
      dose: toMaxLength(m.dose, 255),
      duration: toMaxLength(m.duration, 255),
      instruction: toMaxLength(m.instruction as any, 255),
      quantity: m.quantity || 0,
      type: toMaxLength((m as any).type, 255),
    }));

    const payload = {
      hospitalId: currentHospital.id,
      patientId: isWalkInMode ? null : patient?.id || null,
      isWalkIn: isWalkInMode,
      patientName: isWalkInMode ? walkInPatient.name : patient?.name || '',
      patientAge: Number(isWalkInMode ? walkInPatient.age || 0 : patient?.age ?? 0),
      patientGender: (isWalkInMode ? walkInPatient.gender : patient?.gender || 'other').toString().toLowerCase(),
      doctorId: doctor?.id || null,
      doctorName: doctor?.name || '',
      diagnosis,
      medicines: payloadMedicines,
      advice,
      createdBy: currentUser.name,
    };

    try {
      setIsSaving(true);
      if (editPrescriptionData?.id) {
        await updatePrescription({ id: editPrescriptionData.id, ...payload });
      } else {
        const created = await addPrescription(payload);
        if (!created) return;
      }

      navigate('/prescriptions');
      setSelectedPatient(null);
      setSelectedDoctor(null);
      setPatientSearch('');
      setMedicines([]);
      setDiagnosis('');
      setAdvice('');
      setShowPrint(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    if (!canPrintPrescription) {
      toast.error('You are not authorized to print prescriptions');
      return;
    }

    if (!selectedPatient || medicines.length === 0) {
      alert('Please complete the prescription before printing');
      return;
    }
    setShowPrint(true);
  };

  const handlePatientSearchKeyDown = (e: React.KeyboardEvent) => {
    if (showPatientDropdown && filteredPatients.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedPatientIndex((prev) =>
          prev < filteredPatients.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedPatientIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredPatients[highlightedPatientIndex]) {
          handlePatientSelect(filteredPatients[highlightedPatientIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowPatientDropdown(false);
      }
    }
  };

  return (
    <div className="space-y-2 max-w-[95%] mx-auto">
      {/* Header with Title and Actions - Sticky */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 pt-0.5 pb-1.5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">Create Prescription</h2>
          <p className="text-xs text-gray-600 mt-0.5">
            Creating for {isAllHospitals ? 'selected hospital' : currentHospital.name}
          </p>
        </div>
        <div className="flex gap-1.5">
          {canSavePrescription && (
            <button
              onClick={handleSave}
              disabled={isSaving || medicines.length === 0 || (!isWalkIn && !selectedPatient)}
              className="px-2.5 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-1 font-medium text-xs"
            >
              <Save className="w-3 h-3" />
              {isSaving ? 'Saving...' : isEditMode ? 'Update Prescription' : 'Save Prescription'}
            </button>
          )}
          {canPrintPrescription && (
            <button
              onClick={handlePrint}
              disabled={medicines.length === 0 || (!isWalkIn && !selectedPatient)}
              className="px-2.5 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-1 font-medium text-xs"
            >
              <Printer className="w-3 h-3" />
              Print
            </button>
          )}
        </div>
      </div>

      {/* Hospital Selector for Super Admin */}
      {userRole === 'super_admin' && (
        <HospitalSelector 
          userRole={userRole}
          selectedHospitalId={selectedHospitalId}
          onHospitalChange={(hospitalId) => {
            setSelectedHospitalId(hospitalId);
            // Reset form when hospital changes
            setSelectedPatient(null);
            setSelectedDoctor(null);
            setPatientSearch('');
            setMedicines([]);
            setDiagnosis('');
            setAdvice('');
          }}
        />
      )}

      {/* Patient Information - Two Column Compact Layout */}
      <div className="grid grid-cols-[35%_65%] gap-2">
        {/* LEFT COLUMN - Patient Selection or Walk-in */}
        <div className="bg-white border border-gray-200 rounded-lg p-1.5">
          {/* Toggle between Search Patient and Walk-in Patient */}
          <div className="flex gap-1 mb-1.5 bg-gray-100 rounded-md p-0.5">
            <button
              onClick={() => handleTogglePatientType('existing')}
              className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
                !isWalkIn
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Search Patient
            </button>
            <button
              onClick={() => handleTogglePatientType('walkin')}
              className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
                isWalkIn
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Walk-in Patient
            </button>
          </div>

          {!isWalkIn ? (
            /* Search Existing Patient */
            <div className="relative">
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Patient <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  ref={patientInputRef}
                  type="text"
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setShowPatientDropdown(true);
                  }}
                  onFocus={() => setShowPatientDropdown(true)}
                  onKeyDown={handlePatientSearchKeyDown}
                  className="w-full pl-9 pr-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Type patient name or ID..."
                />
              </div>
              
              {/* Patient Dropdown */}
              {showPatientDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredPatients.length > 0 ? (
                    filteredPatients.map((patient, index) => (
                      <div
                        key={patient.id}
                        onClick={() => handlePatientSelect(patient)}
                        className={`px-3 py-2 cursor-pointer transition-colors ${
                          index === highlightedPatientIndex
                            ? 'bg-blue-50 border-l-2 border-blue-500'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-medium text-sm text-gray-900">{patient.name}</div>
                        <div className="text-xs text-gray-500">
                          {patient.patientId} • Age: {patient.age} • {patient.gender}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-gray-500">
                      No scheduled patients found
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Walk-in Patient Form */
            <div className="space-y-1.5">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={walkInPatient.name}
                  onChange={(e) => setWalkInPatient({ ...walkInPatient, name: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter patient name"
                  aria-label="Walk-in patient name"
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Age <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={walkInPatient.age}
                    onChange={(e) => setWalkInPatient({ ...walkInPatient, age: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Age"
                    aria-label="Walk-in patient age"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={walkInPatient.gender}
                    onChange={(e) => setWalkInPatient({ ...walkInPatient, gender: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Walk-in patient gender"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleWalkInConfirm}
                className="w-full px-2 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Confirm & Continue
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN - Diagnosis */}
        <div className="bg-white border border-gray-200 rounded-lg p-1.5">
          <label className="block text-xs font-medium text-gray-700 mb-0.5">Diagnosis / Chief Complaint</label>
          <div className="flex flex-wrap gap-1 mb-1">
            <button
              type="button"
              onClick={insertDiagnosisTemplate}
              className="px-2 py-0.5 text-[11px] rounded border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
            >
              Insert Template
            </button>
            <button
              type="button"
              onClick={() => insertDiagnosisLabel('H/O')}
              className="px-2 py-0.5 text-[11px] rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              H/O
            </button>
            <button
              type="button"
              onClick={() => insertDiagnosisLabel('C/C')}
              className="px-2 py-0.5 text-[11px] rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              C/C
            </button>
            <button
              type="button"
              onClick={() => insertDiagnosisLabel('BP')}
              className="px-2 py-0.5 text-[11px] rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              BP
            </button>
            <button
              type="button"
              onClick={() => insertDiagnosisLabel('Weight')}
              className="px-2 py-0.5 text-[11px] rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Weight
            </button>
            <button
              type="button"
              onClick={() => insertDiagnosisLabel('Doctor', selectedDoctor?.name || '')}
              className="px-2 py-0.5 text-[11px] rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Doctor
            </button>
          </div>
          <ReactQuill
            value={diagnosis}
            onChange={setDiagnosis}
            placeholder="Enter patient diagnosis, chief complaint, or medical condition..."
            className="custom-quill-editor"
            theme="snow"
            modules={{
              toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
              ]
            }}
          />
        </div>
      </div>

      {/* Medicine Entry Table */}
      {selectedPatient && (
        <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1.5 relative ${openMedicineDropdownRowId ? 'z-30' : 'z-10'}`}>
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Medicines</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={addTemporaryMedicineRow}
                className="px-2.5 py-1.5 flex items-center justify-center bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors text-xs font-medium"
                title="Add Temporary Medicine"
              >
                <Pill className="w-3.5 h-3.5 mr-1" />
                Manual
              </button>
              <button
                onClick={addMedicineRow}
                className="w-7 h-7 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                title="Add Medicine"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable table container - only show scrollbar when 5+ medicines */}
          <div ref={medicinesScrollRef} className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto ${
            medicines.length >= 5
              ? `${openMedicineDropdownRowId ? 'max-h-[420px]' : 'max-h-[240px]'} overflow-y-auto`
              : 'overflow-y-visible'
          }`}>
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-10">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-700 dark:text-gray-300 w-[25%]">Medicine Name</th>
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-700 dark:text-gray-300 w-[10%]">Strength</th>
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-700 dark:text-gray-300 w-[15%]">Dose</th>
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-700 dark:text-gray-300 w-[15%]">Duration</th>
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-700 dark:text-gray-300 w-[15%]">Instruction</th>
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-700 dark:text-gray-300 w-[10%]">Qty</th>
                  <th className="py-1.5 px-2 w-[10%]"></th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800">
                {medicines.map((medicine, index) => (
                  <MedicineRowComponent
                    key={medicine.rowId}
                    medicine={medicine}
                    index={index}
                    hospital={currentHospital}
                    medicineOptions={inventory}
                    hideOutOfStock={hideOutOfStockForDoctors}
                    onUpdate={updateMedicineRow}
                    onUpdateBatch={updateMedicineRowBatch}
                    onRemove={removeMedicineRow}
                    onMedicineSearch={handleMedicineSearch}
                    onAddNew={addMedicineRow}
                    onDropdownToggle={(open) =>
                      setOpenMedicineDropdownRowId(open ? medicine.rowId : null)
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>

          {medicines.length === 0 && (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              <Pill className="w-8 h-8 mx-auto mb-1.5 text-gray-300 dark:text-gray-500" />
              <p className="text-xs">No medicines added yet. Click + to start.</p>
            </div>
          )}
        </div>
      )}

      {/* Advice Section */}
      {selectedPatient && medicines.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1.5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Advice & Instructions</h2>
          <ReactQuill
            value={advice}
            onChange={setAdvice}
            placeholder="Enter advice and instructions for the patient..."
            className="custom-quill-editor"
            theme="snow"
            modules={{
              toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
              ]
            }}
          />
        </div>
      )}

      {/* Print Modal */}
      {showPrint && selectedPatient && (
        <PrescriptionPrint
          hospital={currentHospital}
          patient={selectedPatient}
          doctor={selectedDoctor || doctors[0]}
          medicines={medicines.map(m => {
            const originalMed = inventory.find(med => med.id === m.medicineId);
            return {
              ...m,
              medicineName: m.brandName,
              type: m.type,
              genericName: originalMed?.genericName || m.genericName || '',
              brandName: originalMed?.brandName || m.brandName
            };
          })}
          diagnosis={diagnosis}
          advice={advice}
          prescriptionNumber={editPrescriptionData?.prescriptionNumber || `RX-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  );
}

// Medicine Row Component with keyboard navigation
interface MedicineRowProps {
  medicine: MedicineRow;
  index: number;
  hospital: Hospital;
  medicineOptions: Medicine[];
  hideOutOfStock: boolean;
  onUpdate: (rowId: string, field: keyof MedicineRow, value: any) => void;
  onUpdateBatch: (rowId: string, updates: Partial<MedicineRow>) => void;
  onRemove: (rowId: string) => void;
  onMedicineSearch: (rowId: string, searchTerm: string) => void;
  onAddNew: () => void;
  onDropdownToggle: (open: boolean) => void;
}

function MedicineRowComponent({ medicine, index, hospital, medicineOptions, hideOutOfStock, onUpdate, onUpdateBatch, onRemove, onMedicineSearch, onAddNew, onDropdownToggle }: MedicineRowProps) {
  const [showMedicineDropdown, setShowMedicineDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState(medicine.brandName);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [remoteMedicines, setRemoteMedicines] = useState<Medicine[]>([]);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const medicineInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updateDropdownPosition = React.useCallback(() => {
    if (showMedicineDropdown && medicineInputRef.current) {
      const rect = medicineInputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        zIndex: 99999,
      });
    }
  }, [showMedicineDropdown]);

  React.useEffect(() => {
    if (showMedicineDropdown) {
      updateDropdownPosition();
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
      return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true);
        window.removeEventListener('resize', updateDropdownPosition);
      };
    }
  }, [showMedicineDropdown, updateDropdownPosition]);

  // Update searchTerm when medicine.brandName changes from parent
  React.useEffect(() => {
    setSearchTerm(medicine.brandName);
  }, [medicine.brandName]);

  const localMatches = medicineOptions.filter(m =>
    m.hospitalId === hospital.id &&
    m.status === 'active' &&
    (!hideOutOfStock || (m.stock ?? 0) > 0) &&
    searchTerm.length > 0 &&
    (m.brandName.toLowerCase().includes(searchTerm.toLowerCase()) ||
     m.genericName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredMedicines = localMatches.length > 0 ? localMatches : remoteMedicines;


  // Fetch remote suggestions when local cache has no matches
  React.useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 2 || localMatches.length > 0) {
      setRemoteMedicines([]);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/medicines', {
          params: {
            search: term,
            hospital_id: hospital.id,
          },
        });
        if (!active) return;
        const records: any[] = data.data ?? data;
        const mapped = records.map((m) => ({
          id: String(m.id),
          hospitalId: String(m.hospital_id),
          manufacturerId: String(m.manufacturer_id),
          medicineTypeId: String(m.medicine_type_id),
          brandName: m.brand_name ?? '',
          genericName: m.generic_name ?? '',
          strength: m.strength ?? '',
          type: m.type ?? m.medicine_type?.name ?? m.medicine_type_name ?? '',
          stock: typeof m.stock === 'number' ? m.stock : (m.stock ? Number(m.stock) : undefined),
          status: (m.status ?? 'active') as Medicine['status'],
          createdAt: m.created_at ? new Date(m.created_at) : undefined,
          updatedAt: m.updated_at ? new Date(m.updated_at) : undefined,
        })) as Medicine[];
        const filtered = hideOutOfStock
          ? mapped.filter((m) => (m.stock ?? 0) > 0)
          : mapped;
        setRemoteMedicines(filtered);
      } catch {
        if (active) setRemoteMedicines([]);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [hospital.id, localMatches.length, searchTerm, hideOutOfStock]);

  // Reset highlighted index when filtered medicines change
  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredMedicines.length]);

  // Scroll to highlighted item
  React.useEffect(() => {
    if (dropdownRef.current && filteredMedicines.length > 0) {
      const highlightedElement = dropdownRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [highlightedIndex, filteredMedicines.length]);

  const handleKeyDown = (e: React.KeyboardEvent, field: string) => {
    if (field === 'medicine' && showMedicineDropdown && filteredMedicines.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => 
          prev < filteredMedicines.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredMedicines[highlightedIndex]) {
          handleSelectMedicine(filteredMedicines[highlightedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowMedicineDropdown(false);
        onDropdownToggle(false);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'quantity') {
        onAddNew();
      }
    } else if (e.key === 'Escape') {
      setShowMedicineDropdown(false);
      onDropdownToggle(false);
    }
  };

  const handleSelectMedicine = (med: Medicine) => {
    const medType = med.type || '';
    const displayName = formatMedicineDisplay(med.brandName, med.genericName, medType, med.strength, true);
    setSearchTerm(displayName);
    
    // Use batch update to ensure all fields are updated together
    onUpdateBatch(medicine.rowId, {
      medicineId: med.id,
      brandName: displayName,
      genericName: med.genericName || '',
      strength: med.strength || '',
      type: medType,
      isTemporary: false
    });
    
    setShowMedicineDropdown(false);
    onDropdownToggle(false);
    // Focus on next field (dose)
    setTimeout(() => {
      const nextInput = medicineInputRef.current?.closest('tr')?.querySelector('select');
      if (nextInput) (nextInput as HTMLSelectElement).focus();
    }, 100);
  };

  const getInstructionLabel = (value: string) => {
    return instructionOptions.find((opt) => opt.value === value)?.label || value;
  };

  const normalizeInstructionValue = (value: string) => {
    const match = instructionOptions.find((opt) => opt.label === value);
    return match ? match.value : value;
  };

  return (
    <tr className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <td className="py-0.5 px-2">
        <div className="relative">
          {medicine.isTemporary && (
            <span className="absolute -top-2 right-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800">
              Manual
            </span>
          )}
          <input
            ref={medicineInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              const value = e.target.value;
              setSearchTerm(value);
              onMedicineSearch(medicine.rowId, value);
              setShowMedicineDropdown(true);
              onDropdownToggle(true);

              const currentInput = medicineInputRef.current;
              if (currentInput) {
                currentInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
              }
            }}
            onFocus={() => {
              setShowMedicineDropdown(true);
              onDropdownToggle(true);

              const currentInput = medicineInputRef.current;
              if (currentInput) {
                currentInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
              }
            }}
            onBlur={() => {
              // Delay to allow click on dropdown items
              setTimeout(() => {
                setShowMedicineDropdown(false);
                onDropdownToggle(false);
              }, 250);
            }}
            onKeyDown={(e) => handleKeyDown(e, 'medicine')}
            placeholder="Type medicine name..."
            aria-label="Medicine search"
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-800 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            autoComplete="off"
          />
          {showMedicineDropdown && searchTerm.length > 0 && createPortal(
            <div
              ref={dropdownRef}
              style={dropdownStyle}
              className="bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded-lg shadow-2xl overflow-hidden max-h-[280px] min-h-[60px]"
            >
              {filteredMedicines.length > 0 ? (
                <div className="overflow-y-auto max-h-[280px]">
                  {filteredMedicines.map((med, idx) => {
                    const isHighlighted = idx === highlightedIndex;
                    return (
                      <button
                        key={med.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevent blur
                          handleSelectMedicine(med);
                        }}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        className={`w-full px-3 py-2 text-left border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors cursor-pointer ${
                          isHighlighted 
                            ? 'bg-blue-100 dark:bg-blue-900/50' 
                            : 'hover:bg-blue-50 dark:hover:bg-blue-900/30'
                        }`}
                        data-index={idx}
                      >
                        <div className="font-semibold text-xs text-gray-900 dark:text-white">
                          {formatMedicineDisplay(med.brandName, med.genericName, med.type, med.strength)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
                  <div className="mb-1 font-medium">No medicines found for "{searchTerm}"</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">Try a different search term</div>
                </div>
              )}
            </div>,
            document.body
          )}
        </div>
      </td>
      <td className="py-0.5 px-2">
        <input
          type="text"
          value={medicine.strength}
          onChange={(e) => onUpdate(medicine.rowId, 'strength', e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="Auto-filled or enter"
        />
      </td>
      <td className="py-0.5 px-2">
        <input
          list={`dose-options-${medicine.rowId}`}
          value={medicine.dose}
          onChange={(e) => onUpdate(medicine.rowId, 'dose', e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="Select/Type"
        />
        <datalist id={`dose-options-${medicine.rowId}`}>
          {doseOptions.map(dose => (
            <option key={dose} value={dose} />
          ))}
        </datalist>
      </td>
      <td className="py-0.5 px-2">
        <input
          list={`duration-options-${medicine.rowId}`}
          value={medicine.duration}
          onChange={(e) => onUpdate(medicine.rowId, 'duration', e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="Select/Type"
        />
        <datalist id={`duration-options-${medicine.rowId}`}>
          {durationOptions.map(duration => (
            <option key={duration} value={duration} />
          ))}
        </datalist>
      </td>
      <td className="py-0.5 px-2">
        <input
          list={`instruction-options-${medicine.rowId}`}
          value={getInstructionLabel(medicine.instruction)}
          onChange={(e) => onUpdate(medicine.rowId, 'instruction', normalizeInstructionValue(e.target.value) as any)}
          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          aria-label="Medicine instruction"
          placeholder="Select/Type"
        />
        <datalist id={`instruction-options-${medicine.rowId}`}>
          {instructionOptions.map(inst => (
            <option key={inst.value} value={inst.label} />
          ))}
        </datalist>
      </td>
      <td className="py-0.5 px-2">
        <input
          type="number"
          value={medicine.quantity}
          onChange={(e) => onUpdate(medicine.rowId, 'quantity', parseInt(e.target.value) || 0)}
          onKeyDown={(e) => handleKeyDown(e, 'quantity')}
          aria-label="Medicine quantity"
          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </td>
      <td className="py-0.5 px-2 text-center">
        <button
          onClick={() => onRemove(medicine.rowId)}
          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
          title="Remove medicine"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}