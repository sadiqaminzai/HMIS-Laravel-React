import React, { useState, useRef, useEffect, useMemo } from 'react';
import { calculatePrescriptionQuantity } from '../utils/prescriptionQuantity';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { Search, X, Plus, Save, Printer, Trash2, Pill, ChevronDown } from 'lucide-react';
import { Hospital, Patient, Medicine, Doctor, UserRole, PrescriptionMedicine, MedicineSet } from '../types';
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

interface MedicineRow {
  rowId: string;
  medicineId: string;
  brandName: string;
  genericName: string;
  strength: string;
  dose: string;
  duration: string;
  instruction: PrescriptionMedicine['instruction'];
  quantity: number;
  type?: string;
  groupKey?: string;
  groupLabel?: string;
  groupOrder?: number;
  isTemporary?: boolean;
}

interface DiagnosisTemplate {
  id: string;
  hospitalId: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
}

const formatMedicineDisplay = (brand: string, generic?: string, type?: string, strength?: string, includeStrength: boolean = true) => {
  const parts = [];
  if (type) parts.push(type);
  if (brand) parts.push(brand);
  if (generic) parts.push(`(${generic})`);
  if (includeStrength && strength) parts.push(strength);
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
};

const createMedicineRowId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const toMaxLength = (value: string | undefined | null, max = 255) => {
  if (!value) return '';
  return String(value).slice(0, max);
};

const stripTrailingStrengthTokens = (value: string | undefined | null, strength: string | undefined | null) => {
  const text = String(value ?? '').trim();
  const strengthText = String(strength ?? '').trim();

  if (!text || !strengthText) return text;

  const escapedStrength = strengthText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?:\\s+${escapedStrength})+$`, 'i');

  return text.replace(pattern, '').trim();
};

const toDateInputValue = (value?: Date | string | null) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeWalkInGender = (value?: string | null): 'male' | 'female' => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'female' || normalized === 'f') return 'female';
  return 'male';
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function PrescriptionCreate({ hospital, currentUser }: PrescriptionCreateProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const editPrescriptionData = location.state?.editPrescriptionData;

  // Hospital filtering for super_admin with "All Hospitals" support (but for create, we use currentHospital as the target)
  const userRole = currentUser.role as UserRole;
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  const { settings, getDefaultToWalkIn, getDefaultPrescriptionNextVisit, getShowOutOfStockMedicines, loadHospitalSetting } = useSettings();
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
  const [hasNextVisit, setHasNextVisit] = useState(false);
  const [nextVisitDate, setNextVisitDate] = useState('');
  const [nextVisitQuickKey, setNextVisitQuickKey] = useState<string | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [currentRowIndex, setCurrentRowIndex] = useState(0);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [highlightedPatientIndex, setHighlightedPatientIndex] = useState(0);
  const [openMedicineDropdownRowId, setOpenMedicineDropdownRowId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isWalkIn, setIsWalkIn] = useState(settings.defaultToWalkIn || false);
  const [medicineSets, setMedicineSets] = useState<MedicineSet[]>([]);
  const [selectedMedicineSetId, setSelectedMedicineSetId] = useState('');
  const [medicineSetSearch, setMedicineSetSearch] = useState('');
  const [showMedicineSetDropdown, setShowMedicineSetDropdown] = useState(false);
  const [highlightedMedicineSetIndex, setHighlightedMedicineSetIndex] = useState(0);
  const [isLoadingMedicineSets, setIsLoadingMedicineSets] = useState(false);
  const [diagnosisTemplates, setDiagnosisTemplates] = useState<DiagnosisTemplate[]>([]);
  const [isLoadingDiagnosisTemplates, setIsLoadingDiagnosisTemplates] = useState(false);
  const [selectedDiagnosisTemplateId, setSelectedDiagnosisTemplateId] = useState('');
  const [diagnosisTemplateSearch, setDiagnosisTemplateSearch] = useState('');
  const [showDiagnosisTemplateDropdown, setShowDiagnosisTemplateDropdown] = useState(false);
  const [highlightedDiagnosisTemplateIndex, setHighlightedDiagnosisTemplateIndex] = useState(0);
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
    // No Doctor line: the prescribing doctor is already on the letterhead, so
    // repeating the name inside the diagnosis only spent a line.
    const template = [
      '<strong>H/O</strong>',
      '<strong>Vital Signs</strong>',
      '<strong>C/C</strong>',
      '<strong>BP</strong>',
      '<strong>Weight</strong>'
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
  const treatmentSetContainerRef = useRef<HTMLDivElement>(null);
  const diagnosisTemplateContainerRef = useRef<HTMLDivElement>(null);
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
    const defaultNextVisit = getDefaultPrescriptionNextVisit(currentHospital.id) || false;
    setIsWalkIn(defaultWalkIn);
    setHasNextVisit(defaultNextVisit);
    if (!defaultNextVisit) {
      setNextVisitDate('');
      setNextVisitQuickKey(null);
    }
    if (defaultWalkIn && walkInDefaultPatient) {
      setSelectedPatient(walkInDefaultPatient);
      setPatientSearch(walkInDefaultPatient.name);
    }
  }, [currentHospital.id, editPrescriptionData, getDefaultToWalkIn, getDefaultPrescriptionNextVisit, settings.defaultToWalkIn, walkInDefaultPatient]);

  useEffect(() => {
    loadHospitalSetting(currentHospital.id);
  }, [currentHospital.id, loadHospitalSetting]);

  useEffect(() => {
    let active = true;

    const loadMedicineSets = async () => {
      setIsLoadingMedicineSets(true);
      try {
        const { data } = await api.get('/medicine-sets', {
          params: {
            hospital_id: currentHospital.id,
            status: 'active',
          },
        });

        if (!active) return;

        const records: any[] = data.data ?? data;
        const mapped: MedicineSet[] = records.map((set) => ({
          id: String(set.id),
          hospitalId: String(set.hospital_id),
          name: set.name ?? '',
          description: set.description ?? '',
          status: (set.status ?? 'active') as MedicineSet['status'],
          items: (set.items ?? []).map((item: any) => ({
            id: String(item.id),
            medicineSetId: String(item.medicine_set_id),
            medicineId: item.medicine_id ? String(item.medicine_id) : undefined,
            medicineName: item.medicine_name ?? '',
            strength: item.strength ?? '',
            dose: item.dose ?? '',
            duration: item.duration ?? '',
            instruction: (item.instruction ?? '') as PrescriptionMedicine['instruction'],
            quantity: Number(item.quantity ?? 0),
            type: item.type ?? '',
            sortOrder: Number(item.sort_order ?? 0),
          })),
        }));

        setMedicineSets(mapped);
      } catch {
        if (active) {
          setMedicineSets([]);
        }
      } finally {
        if (active) {
          setIsLoadingMedicineSets(false);
        }
      }
    };

    loadMedicineSets();

    return () => {
      active = false;
    };
  }, [currentHospital.id]);

  useEffect(() => {
    let active = true;

    const loadDiagnosisTemplates = async () => {
      setIsLoadingDiagnosisTemplates(true);
      try {
        const { data } = await api.get('/prescription-diagnoses', {
          params: {
            hospital_id: currentHospital.id,
            status: 'active',
          },
        });

        if (!active) return;

        const records: any[] = data.data ?? data;
        const mapped: DiagnosisTemplate[] = records.map((template) => ({
          id: String(template.id),
          hospitalId: String(template.hospital_id),
          name: String(template.name ?? ''),
          description: String(template.description ?? ''),
          status: (template.status ?? 'active') as DiagnosisTemplate['status'],
        }));

        setDiagnosisTemplates(mapped);
      } catch {
        if (active) {
          setDiagnosisTemplates([]);
        }
      } finally {
        if (active) {
          setIsLoadingDiagnosisTemplates(false);
        }
      }
    };

    loadDiagnosisTemplates();

    return () => {
      active = false;
    };
  }, [currentHospital.id]);

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
          phone: '',
          address: '',
          status: 'active',
          createdAt: new Date(),
        };

        setSelectedPatient(tempPatient);
        setPatientSearch(editPrescriptionData.patientName || '');
        setWalkInPatient({
          name: editPrescriptionData.patientName || '',
          age: String(editPrescriptionData.patientAge ?? ''),
          gender: normalizeWalkInGender(editPrescriptionData.patientGender),
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
      const editNextVisit = toDateInputValue(editPrescriptionData.nextVisit);
      setHasNextVisit(Boolean(editNextVisit));
      setNextVisitDate(editNextVisit);
      setNextVisitQuickKey(null);

      // Convert medicines to medicine rows
      const medicineRows: MedicineRow[] = editPrescriptionData.medicines.map((med: any) => {
        const originalMed = inventory.find(m => m.id === med.medicineId || m.brandName === med.medicineName);
        const medType = (med as any).type || (originalMed as any)?.type || '';
        const brand = originalMed?.brandName || med.medicineName;
        const generic = originalMed?.genericName;
        const strength = originalMed?.strength || med.strength || '';
        const normalizedBrand = stripTrailingStrengthTokens(brand, strength);
        const displayName = formatMedicineDisplay(normalizedBrand, generic, medType, strength, true);

        return {
          rowId: createMedicineRowId(),
          medicineId: med.medicineId || '',
          brandName: displayName,
          genericName: generic || '',
          strength,
          dose: med.dose ?? '',
          duration: med.duration ?? '',
          instruction: med.instruction ?? '',
          quantity: med.quantity ?? 0,
          type: medType,
          groupKey: (med as any).groupKey,
          groupLabel: (med as any).groupLabel,
          groupOrder: (med as any).groupOrder,
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
  const getPatientSearchDisplay = (patient: Patient) =>
    `${patient.name} ${patient.patientId ? `(${patient.patientId})` : ''}${patient.phone ? ` - ${patient.phone}` : ''}`.trim();

  const filteredPatients = patients.filter((p) => {
    if (String(p.hospitalId) !== String(currentHospital.id)) return false;

    const search = patientSearch.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(search) ||
      p.patientId.toLowerCase().includes(search) ||
      String(p.phone || '').toLowerCase().includes(search);

    if (!matchesSearch) return false;

    return eligiblePatientIds.has(String(p.id));
  });

  // Reset highlighted index when filtered patients change
  useEffect(() => {
    setHighlightedPatientIndex(0);
  }, [patientSearch]);

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    setPatientSearch(getPatientSearchDisplay(patient));
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
      phone: '',
      address: '',
      status: 'active',
      createdAt: new Date(),
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

  const setQuickNextVisit = (quickKey: '3d' | '5d' | '7d' | '14d' | '1m') => {
    const next = new Date();

    if (quickKey === '1m') {
      next.setMonth(next.getMonth() + 1);
    } else {
      const days = Number(quickKey.replace('d', ''));
      next.setDate(next.getDate() + days);
    }

    setHasNextVisit(true);
    setNextVisitQuickKey(quickKey);
    setNextVisitDate(toDateInputValue(next));
  };

  /** Focusable cells of one row, left to right. */
  const rowCells = (row: Element | null): HTMLElement[] =>
    row
      ? Array.from(row.querySelectorAll<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]), select:not([disabled])'
        ))
      : [];

  const focusCell = (rowIndex: number, colIndex: number): boolean => {
    const row = medicinesScrollRef.current?.querySelector(`[data-grid-row="${rowIndex}"]`) ?? null;
    const cells = rowCells(row);
    if (!cells.length) return false;

    // Clamp: a row may legitimately have fewer cells than the one moved from.
    const cell = cells[Math.min(colIndex, cells.length - 1)];
    cell?.focus();
    if (cell instanceof HTMLInputElement) cell.select?.();
    return Boolean(cell);
  };

  /**
   * Spreadsheet keys for the medicine grid.
   *
   * The same map the pharmacy invoice uses, because the same people work both
   * screens: up and down walk a column, left and right step between cells once
   * the caret reaches the edge of the text, and Enter moves down -- adding a
   * row when there is none below -- rather than submitting.
   */
  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, index: number) => {
    // The medicine box owns its own arrows and Enter while its list is open.
    if (event.defaultPrevented) return;
    if (event.altKey || event.metaKey) return;

    const target = event.target as HTMLElement;

    // Ctrl+Up/Down walks rows from anywhere, including out of a dropdown whose
    // plain arrows are busy changing its value.
    if (event.ctrlKey) {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      const ctrlRow = target.closest('[data-grid-row]');
      const ctrlCol = rowCells(ctrlRow).indexOf(target);
      if (ctrlCol === -1) return;
      event.preventDefault();
      focusCell(index + (event.key === 'ArrowDown' ? 1 : -1), ctrlCol);
      return;
    }

    if (target.tagName === 'BUTTON') return;

    const row = target.closest('[data-grid-row]');
    const cells = rowCells(row);
    const col = cells.indexOf(target);
    if (col === -1) return;

    const lastRow = medicines.length - 1;
    const input = target as HTMLInputElement;
    const isTextCell = target.tagName === 'INPUT' && input.type !== 'number';

    // selectionStart throws on number inputs in some browsers, so it is only
    // consulted for the text cells that actually need caret awareness.
    const atStart = !isTextCell || (input.selectionStart === 0 && input.selectionEnd === 0);
    const atEnd = !isTextCell
      || (input.selectionStart === input.value.length && input.selectionEnd === input.value.length);

    const isSelect = target.tagName === 'SELECT';

    switch (event.key) {
      case 'ArrowDown':
        if (isSelect) return;
        event.preventDefault();
        focusCell(index + 1, col);
        return;

      case 'ArrowUp':
        if (isSelect) return;
        event.preventDefault();
        focusCell(index - 1, col);
        return;

      case 'ArrowLeft':
        if (!atStart || col === 0) return;
        event.preventDefault();
        cells[col - 1]?.focus();
        if (cells[col - 1] instanceof HTMLInputElement) (cells[col - 1] as HTMLInputElement).select?.();
        return;

      case 'ArrowRight':
        if (!atEnd || col === cells.length - 1) return;
        event.preventDefault();
        cells[col + 1]?.focus();
        if (cells[col + 1] instanceof HTMLInputElement) (cells[col + 1] as HTMLInputElement).select?.();
        return;

      case 'Enter':
        // Never submits. A grid that saves on Enter files the prescription
        // halfway through writing it.
        event.preventDefault();
        if (index === lastRow) {
          addMedicineRow();
          // The new row renders after this tick.
          window.setTimeout(() => focusCell(index + 1, 0), 0);
        } else {
          focusCell(index + 1, col);
        }
        return;

      default:
    }
  };

  const addMedicineRow = () => {
    const newRow: MedicineRow = {
      rowId: createMedicineRowId(),
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
    setMedicines((prev) => [...prev, newRow]);
  };

  const addTemporaryMedicineRow = () => {
    const newRow: MedicineRow = {
      rowId: createMedicineRowId(),
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
    setMedicines((prev) => [...prev, newRow]);
  };

  const addMedicineSetRows = () => {
    if (!selectedMedicineSetId) {
      toast.error('Select a treatment set first');
      return;
    }

    const selectedSet = medicineSets.find((set) => set.id === selectedMedicineSetId);
    if (!selectedSet || selectedSet.items.length === 0) {
      toast.error('Selected treatment set has no medicines');
      return;
    }

    const groupKey = `set-${Date.now()}`;
    const appendedRows: MedicineRow[] = selectedSet.items
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item, index) => {
        const matchedInventoryMedicine = item.medicineId
          ? inventory.find((invMedicine) => invMedicine.id === item.medicineId)
          : inventory.find(
              (invMedicine) =>
                String(invMedicine.hospitalId) === String(currentHospital.id) &&
                invMedicine.brandName.toLowerCase() === item.medicineName.toLowerCase()
            );

        const brand = matchedInventoryMedicine?.brandName || item.medicineName;
        const generic = matchedInventoryMedicine?.genericName || '';
        const medType = item.type || matchedInventoryMedicine?.type || '';
        const strength = item.strength || matchedInventoryMedicine?.strength || '';

        return {
          rowId: `${createMedicineRowId()}-${index}`,
          medicineId: matchedInventoryMedicine?.id || item.medicineId || '',
          brandName: formatMedicineDisplay(brand, generic, medType, strength, true),
          genericName: generic,
          strength,
          dose: item.dose || '',
          duration: item.duration || '',
          instruction: item.instruction || '',
          quantity: Number(item.quantity ?? 0),
          type: medType,
          groupKey,
          groupLabel: selectedSet.name,
          groupOrder: Number(item.sortOrder ?? index),
          isTemporary: !matchedInventoryMedicine && !item.medicineId,
        };
      });

    shouldScrollMedicinesToBottomRef.current = true;
    setMedicines((prev) => [...prev, ...appendedRows]);
    toast.success(`${selectedSet.name} added`);
  };

  const filteredMedicineSets = useMemo(() => {
    const term = medicineSetSearch.trim().toLowerCase();
    if (!term) return medicineSets;
    return medicineSets.filter((set) => set.name.toLowerCase().includes(term));
  }, [medicineSetSearch, medicineSets]);

  const filteredDiagnosisTemplates = useMemo(() => {
    const term = diagnosisTemplateSearch.trim().toLowerCase();
    if (!term) return diagnosisTemplates;

    return diagnosisTemplates.filter((template) => {
      const descriptionText = template.description
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

      return template.name.toLowerCase().includes(term) || descriptionText.includes(term);
    });
  }, [diagnosisTemplateSearch, diagnosisTemplates]);

  const handleSelectMedicineSet = (set: MedicineSet) => {
    setSelectedMedicineSetId(set.id);
    setMedicineSetSearch(set.name);
    setShowMedicineSetDropdown(false);
  };

  const buildDiagnosisContentFromTemplate = (template: DiagnosisTemplate) => {
    const nameHtml = `<p><strong>${escapeHtml(template.name)}</strong></p>`;
    const descriptionHtml = (template.description || '').trim();

    return descriptionHtml ? `${nameHtml}${descriptionHtml}` : nameHtml;
  };

  const handleSelectDiagnosisTemplate = (template: DiagnosisTemplate) => {
    const selectedTemplateHtml = buildDiagnosisContentFromTemplate(template);
    setSelectedDiagnosisTemplateId(template.id);
    setDiagnosisTemplateSearch(template.name);
    setDiagnosis((previousDiagnosis) => {
      const previousText = previousDiagnosis
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!previousText) {
        return selectedTemplateHtml;
      }

      return `${previousDiagnosis}<p><br></p>${selectedTemplateHtml}`;
    });
    setShowDiagnosisTemplateDropdown(false);
  };

  const handleMedicineSetSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showMedicineSetDropdown) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setShowMedicineSetDropdown(true);
        setHighlightedMedicineSetIndex(0);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedMedicineSetIndex((prev) =>
        prev < filteredMedicineSets.length - 1 ? prev + 1 : prev
      );
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedMedicineSetIndex((prev) => (prev > 0 ? prev - 1 : 0));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredMedicineSets[highlightedMedicineSetIndex]) {
        handleSelectMedicineSet(filteredMedicineSets[highlightedMedicineSetIndex]);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setShowMedicineSetDropdown(false);
    }
  };

  const handleDiagnosisTemplateSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDiagnosisTemplateDropdown) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setShowDiagnosisTemplateDropdown(true);
        setHighlightedDiagnosisTemplateIndex(0);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedDiagnosisTemplateIndex((prev) =>
        prev < filteredDiagnosisTemplates.length - 1 ? prev + 1 : prev
      );
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedDiagnosisTemplateIndex((prev) => (prev > 0 ? prev - 1 : 0));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredDiagnosisTemplates[highlightedDiagnosisTemplateIndex]) {
        handleSelectDiagnosisTemplate(filteredDiagnosisTemplates[highlightedDiagnosisTemplateIndex]);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setShowDiagnosisTemplateDropdown(false);
    }
  };

  useEffect(() => {
    const selectedSet = medicineSets.find((set) => set.id === selectedMedicineSetId);
    if (selectedSet) {
      setMedicineSetSearch(selectedSet.name);
    }
  }, [selectedMedicineSetId, medicineSets]);

  useEffect(() => {
    const selectedTemplate = diagnosisTemplates.find((template) => template.id === selectedDiagnosisTemplateId);
    if (selectedTemplate) {
      setDiagnosisTemplateSearch(selectedTemplate.name);
    }
  }, [selectedDiagnosisTemplateId, diagnosisTemplates]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!treatmentSetContainerRef.current?.contains(event.target as Node)) {
        setShowMedicineSetDropdown(false);
      }

      if (!diagnosisTemplateContainerRef.current?.contains(event.target as Node)) {
        setShowDiagnosisTemplateDropdown(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const removeMedicineRow = (rowId: string) => {
    setMedicines((prev) => prev.filter((m) => m.rowId !== rowId));
  };

  const updateMedicineRow = (rowId: string, field: keyof MedicineRow, value: any) => {
    setMedicines((prev) => prev.map((m) => {
      if (String(m.rowId) === String(rowId)) {
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
    setMedicines((prev) => prev.map((m) => {
      if (String(m.rowId) === String(rowId)) {
        return { ...m, ...updates };
      }
      return m;
    }));
  };

  /** The shared rule, so Treatment Sets computes quantities identically. */
  const calculateQuantity = (dose: string, duration: string): number =>
    calculatePrescriptionQuantity(dose, duration);

  const role = String(currentUser.role || '').toLowerCase();
  const hideOutOfStockForDoctors = role === 'doctor' && !getShowOutOfStockMedicines(currentHospital.id);

  const handleMedicineSearch = (rowId: string, searchTerm: string) => {
    updateMedicineRow(rowId, 'brandName', searchTerm);
    
    // Auto-complete if exact match found
    const medicine = inventory.find(m =>
      String(m.hospitalId) === String(currentHospital.id) &&
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

    if (hasNextVisit && !nextVisitDate) {
      toast.error('Please select next visit date');
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
      medicineName: toMaxLength(stripTrailingStrengthTokens(m.brandName, m.strength), 255),
      strength: toMaxLength(m.strength, 255),
      dose: toMaxLength(m.dose, 255),
      duration: toMaxLength(m.duration, 255),
      instruction: toMaxLength(m.instruction as any, 255) as PrescriptionMedicine['instruction'],
      quantity: m.quantity || 0,
      type: toMaxLength((m as any).type, 255),
      groupKey: m.groupKey,
      groupLabel: toMaxLength(m.groupLabel, 255) || undefined,
      groupOrder: m.groupOrder,
    }));

    const payload = {
      hospitalId: currentHospital.id,
      patientId: isWalkInMode ? null : patient?.id || null,
      isWalkIn: isWalkInMode,
      patientName: isWalkInMode ? walkInPatient.name : patient?.name || '',
      patientAge: Number(isWalkInMode ? walkInPatient.age || 0 : patient?.age ?? 0),
      patientGender: (isWalkInMode ? walkInPatient.gender : patient?.gender || 'other').toString().toLowerCase(),
      doctorId: doctor?.id || editPrescriptionData?.doctorId || '',
      doctorName: doctor?.name || editPrescriptionData?.doctorName || '',
      diagnosis,
      nextVisit: hasNextVisit ? nextVisitDate : null,
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
      setHasNextVisit(false);
      setNextVisitDate('');
      setNextVisitQuickKey(null);
      setSelectedMedicineSetId('');
      setMedicineSetSearch('');
      setSelectedDiagnosisTemplateId('');
      setDiagnosisTemplateSearch('');
      setShowPrint(false);
    } catch (error: any) {
      const validation = error?.response?.data?.errors;
      const validationMessage = validation ? Object.values(validation).flat().join(' ') : null;
      const fallbackMessage = error?.response?.data?.message || 'Failed to save prescription';
      toast.error(validationMessage || fallbackMessage);
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

  /**
   * Document shortcuts: Ctrl+S saves, Ctrl+P saves and prints.
   *
   * The same two the pharmacy invoice uses -- the prescribers here also work
   * that screen, and a key that means "save" on one and nothing on the other
   * is worse than no shortcut at all. Safe wherever the cursor is: nobody
   * types either into a medicine name.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const commandKey = event.ctrlKey || event.metaKey;
      if (!commandKey || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key !== 's' && key !== 'p') return;

      event.preventDefault();
      if (isSaving) return;

      if (key === 'p') {
        if (!canPrintPrescription) {
          toast.error('You are not authorized to print prescriptions');
          return;
        }
        handlePrint();
        return;
      }

      if (!canSavePrescription) {
        toast.error('You are not authorized to save prescriptions');
        return;
      }
      void handleSave();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div className="space-y-2 max-w-[95%] mx-auto">
      {/* Header with Title and Actions - Sticky */}
      {/* The bar is sticky, so in dark mode a hard white ground sat over the
          page as a bright strip with a near-black title on it. */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 pt-0.5 pb-1.5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Create Prescription</h2>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
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
              {isSaving ? 'Saving...' : isEditMode ? 'Update' : 'Save'}
            </button>
          )}
          {canPrintPrescription && (
            <button
              onClick={handlePrint}
              disabled={medicines.length === 0 || (!isWalkIn && !selectedPatient)}
              className="px-2.5 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-1 font-medium text-xs"
            >
              <Printer className="w-3 h-3" />{t('ui.print')}</button>
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
            setHasNextVisit(false);
            setNextVisitDate('');
            setNextVisitQuickKey(null);
            setSelectedMedicineSetId('');
            setMedicineSetSearch('');
            setSelectedDiagnosisTemplateId('');
            setDiagnosisTemplateSearch('');
          }}
        />
      )}

      {/* Patient and diagnosis: two compact toolbars, not two tall panels. */}
      <div className="grid grid-cols-1 xl:grid-cols-[40%_60%] gap-2">
        {/* LEFT COLUMN - Patient Selection or Walk-in */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5">
          {/* Three rows: the patient type, then the identity fields, then
              Confirm. Stacked rather than strung along one line -- this column
              has the height to spare, and the fields get their full width. */}
          <div className="space-y-1.5">
            {/* Row 1: which kind of patient. */}
            <div className="flex bg-gray-100 dark:bg-gray-900/60 rounded p-0.5">
              <button
                onClick={() => handleTogglePatientType('existing')}
                className={`flex-1 px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                  !isWalkIn
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Existing (Registered)
              </button>
              <button
                onClick={() => handleTogglePatientType('walkin')}
                className={`flex-1 px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                  isWalkIn
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Walk-in
              </button>
            </div>

            {!isWalkIn ? (
              /* Row 2 for a registered patient: the one field that identifies them. */
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  ref={patientInputRef}
                  type="text"
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setShowPatientDropdown(true);
                    setHighlightedPatientIndex(0);
                  }}
                  onFocus={() => {
                    setShowPatientDropdown(true);
                    setHighlightedPatientIndex(0);
                  }}
                  onBlur={() => setTimeout(() => {
                    setShowPatientDropdown(false);
                    setHighlightedPatientIndex(-1);
                  }, 200)}
                  onKeyDown={handlePatientSearchKeyDown}
                  aria-label="Patient"
                  className="w-full pl-7 pr-2 h-7 text-[11px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Patient name, ID or phone..."
                />
            {/* Patient Dropdown */}
            {showPatientDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredPatients.length > 0 ? (
                  filteredPatients.map((patient, index) => (
                    <div
                      key={patient.id}
                      onMouseEnter={() => setHighlightedPatientIndex(index)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handlePatientSelect(patient);
                      }}
                      className={`px-3 py-2 cursor-pointer transition-colors ${
                        index === highlightedPatientIndex
                          ? 'bg-blue-50 dark:bg-blue-900/40 border-l-2 border-blue-500'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/60'
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-white">{patient.name}</div>
                      <div className="text-xs text-gray-500">
                        {patient.patientId} • Age: {patient.age} • {patient.gender}
                      </div>
                      {patient.phone && (
                        <div className="text-xs text-gray-500">{patient.phone}</div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                    No scheduled patients found
                  </div>
                )}
              </div>
            )}
              </div>
            ) : (
              <>
                {/* Row 2: who the patient is. */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={walkInPatient.name}
                    onChange={(e) => setWalkInPatient({ ...walkInPatient, name: e.target.value })}
                    className="flex-1 min-w-0 px-2 h-7 text-[11px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Patient name *"
                    aria-label="Walk-in patient name"
                  />
                  <input
                    type="number"
                    value={walkInPatient.age}
                    onChange={(e) => setWalkInPatient({ ...walkInPatient, age: e.target.value })}
                    className="w-16 shrink-0 px-2 h-7 text-[11px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Age *"
                    aria-label="Walk-in patient age"
                  />
                  <select
                    value={walkInPatient.gender}
                    onChange={(e) => setWalkInPatient({ ...walkInPatient, gender: e.target.value })}
                    className="w-20 shrink-0 px-1 h-7 text-[11px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    aria-label="Walk-in patient gender"
                  >
                    <option value="male">{t('ui.male')}</option>
                    <option value="female">{t('ui.female')}</option>
                  </select>
                </div>
                {/* Row 3: the commit. */}
                <button
                  onClick={handleWalkInConfirm}
                  className="w-full px-2.5 h-7 bg-blue-600 text-white text-[11px] font-medium rounded hover:bg-blue-700 transition-colors"
                >
                  Confirm &amp; Continue
                </button>
              </>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN - Diagnosis */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5">
          {/* Label, template picker and the quick-insert chips share one line:
              they are all shortcuts into the same editor below. */}
          <div className="flex items-center gap-2 mb-1">
          <span className="shrink-0 text-[11px] font-semibold text-gray-700 dark:text-gray-200">Diagnosis / C.C.</span>
          <div ref={diagnosisTemplateContainerRef} className="relative w-56 shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={diagnosisTemplateSearch}
                onChange={(e) => {
                  const value = e.target.value;
                  setDiagnosisTemplateSearch(value);
                  setSelectedDiagnosisTemplateId('');
                  setShowDiagnosisTemplateDropdown(true);
                  setHighlightedDiagnosisTemplateIndex(0);
                }}
                onFocus={() => {
                  setShowDiagnosisTemplateDropdown(true);
                  setHighlightedDiagnosisTemplateIndex(0);
                }}
                onKeyDown={handleDiagnosisTemplateSearchKeyDown}
                className="w-full pl-7 pr-2 h-7 text-[11px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Template..."
                title="Search diagnosis template"
              />
            </div>
            {showDiagnosisTemplateDropdown && (
              <div className="absolute z-40 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-52 overflow-y-auto">
                {isLoadingDiagnosisTemplates ? (
                  <div className="px-2.5 py-1.5 text-xs text-gray-500">Loading templates...</div>
                ) : filteredDiagnosisTemplates.length > 0 ? (
                  filteredDiagnosisTemplates.map((template, index) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleSelectDiagnosisTemplate(template)}
                      className={`w-full px-2.5 py-1.5 text-left text-xs transition-colors ${
                        index === highlightedDiagnosisTemplateIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium">{template.name}</div>
                      <div className="text-[11px] text-gray-500 truncate">{template.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || 'No description'}</div>
                    </button>
                  ))
                ) : (
                  <div className="px-2.5 py-1.5 text-xs text-gray-500">No diagnosis templates found</div>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={insertDiagnosisTemplate}
              className="px-1.5 h-6 text-[10px] rounded border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60"
            >
              Insert Template
            </button>
            <button
              type="button"
              onClick={() => insertDiagnosisLabel('H/O')}
              className="px-1.5 h-6 text-[10px] rounded border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              H/O
            </button>
            <button
              type="button"
              onClick={() => insertDiagnosisLabel('Vital Signs')}
              className="px-1.5 h-6 text-[10px] rounded border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Vital Signs
            </button>
            <button
              type="button"
              onClick={() => insertDiagnosisLabel('C/C')}
              className="px-1.5 h-6 text-[10px] rounded border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              C/C
            </button>
            <button
              type="button"
              onClick={() => insertDiagnosisLabel('BP')}
              className="px-1.5 h-6 text-[10px] rounded border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              BP
            </button>
            <button
              type="button"
              onClick={() => insertDiagnosisLabel('Weight')}
              className="px-1.5 h-6 text-[10px] rounded border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Weight
            </button>
          </div>
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
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">Medicines</h2>
            <div className="flex items-center gap-2">
              <div ref={treatmentSetContainerRef} className="relative min-w-[220px]">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={medicineSetSearch}
                    onChange={(e) => {
                      const value = e.target.value;
                      setMedicineSetSearch(value);
                      setSelectedMedicineSetId('');
                      setShowMedicineSetDropdown(true);
                      setHighlightedMedicineSetIndex(0);
                    }}
                    onFocus={() => {
                      setShowMedicineSetDropdown(true);
                      setHighlightedMedicineSetIndex(0);
                    }}
                    onKeyDown={handleMedicineSetSearchKeyDown}
                    className="w-full pl-7 pr-2 h-7 text-[11px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Search treatment set..."
                    title="Search treatment set"
                  />
                </div>
                {showMedicineSetDropdown && (
                  <div className="absolute z-40 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-52 overflow-y-auto">
                    {filteredMedicineSets.length > 0 ? (
                      filteredMedicineSets.map((set, index) => (
                        <button
                          key={set.id}
                          type="button"
                          onClick={() => handleSelectMedicineSet(set)}
                          className={`w-full px-2.5 py-1.5 text-left text-xs transition-colors ${
                            index === highlightedMedicineSetIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {set.name}
                        </button>
                      ))
                    ) : (
                      <div className="px-2.5 py-1.5 text-xs text-gray-500">No treatment sets found</div>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={addMedicineSetRows}
                disabled={!selectedMedicineSetId || isLoadingMedicineSets}
                className="px-2.5 h-7 flex items-center justify-center bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-[11px] font-medium"
                title="Add selected treatment set"
              >
                Add Set
              </button>
              <button
                onClick={addTemporaryMedicineRow}
                className="px-2.5 h-7 flex items-center justify-center bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors text-[11px] font-medium"
                title="Add Temporary Medicine"
              >
                <Pill className="w-3.5 h-3.5 mr-1" />{t('ui.manual')}</button>
              <button
                onClick={addMedicineRow}
                className="w-7 h-7 flex items-center justify-center bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                title={t('ui.addMedicine')}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <style>{`
            /* Cells sit flush and share a single hairline, the way a spreadsheet
               draws its grid -- the old rounded, individually-outlined boxes put
               gutters between every value and made a six-column row read as six
               separate little forms. */
            .rx-cell { border-radius: 0; }
            .rx-cell:focus { outline: 2px solid rgb(37 99 235); outline-offset: -2px; position: relative; z-index: 1; }
            .rx-row td { padding: 0; }
            .rx-gutter { width: 2rem; background: rgb(243 244 246); border-right: 1px solid rgb(229 231 235);
                         border-bottom: 1px solid rgb(229 231 235); }
            /* The row under the cursor, findable at a glance on a long script. */
            .rx-row:focus-within .rx-cell { background: rgb(239 246 255); }
            .rx-row:focus-within .rx-gutter { background: rgb(191 219 254); color: rgb(30 64 175); font-weight: 600; }
            .rx-row:hover .rx-cell:not(:focus) { background: rgb(249 250 251); }
            /* Number spinners steal width a quantity column cannot spare. */
            .rx-cell[type=number]::-webkit-inner-spin-button,
            .rx-cell[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
            .rx-kbd { display:inline-block; min-width:1.1rem; padding:0 3px; border:1px solid rgb(203 213 225);
                      border-bottom-width:2px; border-radius:3px; background:#fff; color:rgb(71 85 105);
                      font:inherit; font-size:9px; line-height:14px; text-align:center; }
          `}</style>
          {/* Scrollable table container - only show scrollbar when 5+ medicines */}
          <div ref={medicinesScrollRef} className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto ${
            medicines.length >= 5
              ? `${openMedicineDropdownRowId ? 'max-h-[420px]' : 'max-h-[240px]'} overflow-y-auto`
              : 'overflow-y-visible'
          }`}>
            <table className="w-full table-fixed border-collapse">
              <thead className="sticky top-0 bg-gray-100 dark:bg-gray-900 z-10">
                <tr>
                  {/* Strength has no column of its own: the medicine name
                      already carries it ("Capsules Zetro (Azithromycin) 250mg"),
                      so a separate box repeated the same value and cost the
                      name the width it needed. */}
                  <th className="py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 border-b border-gray-300 dark:border-gray-600 px-0 text-center w-8">#</th>
                  <th className="py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 border-b border-gray-300 dark:border-gray-600 px-1.5 text-left w-[36%]">{t('table.medicineName')}</th>
                  <th className="py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 border-b border-gray-300 dark:border-gray-600 px-1.5 text-left w-[15%]">{t('table.dose')}</th>
                  <th className="py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 border-b border-gray-300 dark:border-gray-600 px-1.5 text-left w-[15%]">{t('table.duration')}</th>
                  <th className="py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 border-b border-gray-300 dark:border-gray-600 px-1.5 text-left w-[19%]">{t('table.instruction')}</th>
                  <th className="py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 border-b border-gray-300 dark:border-gray-600 px-1.5 text-right w-[9%]">{t('table.qty')}</th>
                  <th className="py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 border-b border-gray-300 dark:border-gray-600 px-0 w-9"><span className="sr-only">Remove</span></th>
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
                    onRowKeyDown={handleRowKeyDown}
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

          <div className="hidden md:flex items-center gap-3 mt-1.5 pt-1.5 border-t border-gray-200 dark:border-gray-700 text-[10px] text-gray-500 dark:text-gray-400">
            <span><kbd className="rx-kbd">&#8593;&#8595;</kbd> row</span>
            <span><kbd className="rx-kbd">&#8592;&#8594;</kbd> cell</span>
            <span><kbd className="rx-kbd">&#8595;</kbd> opens Dose / Duration / Instruction list</span>
            <span><kbd className="rx-kbd">Ctrl</kbd>+<kbd className="rx-kbd">&#8593;&#8595;</kbd> row from a list</span>
            <span><kbd className="rx-kbd">Enter</kbd> next / new row</span>
            {canSavePrescription && <span><kbd className="rx-kbd">Ctrl</kbd>+<kbd className="rx-kbd">S</kbd> save</span>}
            {canPrintPrescription && <span><kbd className="rx-kbd">Ctrl</kbd>+<kbd className="rx-kbd">P</kbd> save + print</span>}
          </div>
        </div>
      )}

      {selectedPatient && medicines.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-2">
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

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">Next Visit?</span>
              <button
                type="button"
                onClick={() => setHasNextVisit(true)}
                className={`px-2 py-1 text-xs rounded border ${hasNextVisit ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'}`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasNextVisit(false);
                  setNextVisitDate('');
                  setNextVisitQuickKey(null);
                }}
                className={`px-2 py-1 text-xs rounded border ${!hasNextVisit ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'}`}
              >
                No
              </button>
            </div>

            {hasNextVisit && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Next Visit:</div>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setQuickNextVisit('3d')} className={`px-2 py-1 text-xs rounded border ${nextVisitQuickKey === '3d' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'}`}>3 Days</button>
                  <button type="button" onClick={() => setQuickNextVisit('5d')} className={`px-2 py-1 text-xs rounded border ${nextVisitQuickKey === '5d' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'}`}>5 Days</button>
                  <button type="button" onClick={() => setQuickNextVisit('7d')} className={`px-2 py-1 text-xs rounded border ${nextVisitQuickKey === '7d' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'}`}>7 Days</button>
                  <button type="button" onClick={() => setQuickNextVisit('14d')} className={`px-2 py-1 text-xs rounded border ${nextVisitQuickKey === '14d' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'}`}>14 Days</button>
                  <button type="button" onClick={() => setQuickNextVisit('1m')} className={`px-2 py-1 text-xs rounded border ${nextVisitQuickKey === '1m' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'}`}>1 Month</button>
                  <button
                    type="button"
                    onClick={() => setNextVisitQuickKey('custom')}
                    className={`px-2 py-1 text-xs rounded border ${nextVisitQuickKey === 'custom' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'}`}
                  >
                    Custom
                  </button>
                </div>

                <div>
                  <input
                    type="date"
                    value={nextVisitDate}
                    onChange={(e) => {
                      setNextVisitDate(e.target.value);
                      setNextVisitQuickKey('custom');
                    }}
                    title="Next visit date"
                    className="px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
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
              groupKey: m.groupKey,
              groupLabel: m.groupLabel,
              groupOrder: m.groupOrder,
              genericName: originalMed?.genericName || m.genericName || '',
              brandName: originalMed?.brandName || m.brandName
            };
          })}
          diagnosis={diagnosis}
          advice={advice}
          nextVisit={hasNextVisit && nextVisitDate ? new Date(nextVisitDate) : null}
          prescriptionNumber={editPrescriptionData?.prescriptionNumber || `RX-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  );
}

// Medicine Row Component with keyboard navigation
/**
 * A dropdown cell for the medicine grid: Dose, Duration, Instruction.
 *
 * These were native <datalist> inputs, which look like a dropdown but cannot be
 * opened from the keyboard -- the arrow key fell through to the grid and moved
 * the cursor to the next row instead, so the list was reachable only by mouse.
 * This is the same combobox pattern the medicine name cell already uses:
 * ArrowDown opens it, the arrows walk it, Enter takes the highlighted option,
 * Escape closes it. Free text is still allowed; the list is a shortcut, not a
 * constraint, because prescribers write doses the list has never seen.
 */
interface GridComboProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  ariaLabel: string;
  /** Widen the list beyond the cell when the options are long sentences. */
  wide?: boolean;
}

function GridCombo({ value, onChange, options, placeholder, ariaLabel, wide }: GridComboProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const blurTimer = useRef<number | null>(null);

  // Typing filters the list, but only once the text differs from a value that
  // was already chosen -- otherwise re-opening a filled cell would show a list
  // of exactly one option, its own value.
  const [typed, setTyped] = useState<string | null>(null);
  const filter = typed ?? '';
  const shown = filter
    ? options.filter((option) => option.toLowerCase().includes(filter.toLowerCase()))
    : options;

  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const place = () => {
    const box = inputRef.current?.getBoundingClientRect();
    if (!box) return;
    const width = wide ? Math.max(box.width, 240) : box.width;
    const belowRoom = window.innerHeight - box.bottom;
    const height = Math.min(240, shown.length * 26 + 8);
    // Flip above when the cell is near the foot of the window: a grid this
    // dense usually has its last rows there.
    const top = belowRoom < height + 12 ? box.top - height - 2 : box.bottom + 2;
    const left = Math.min(box.left, window.innerWidth - width - 8);
    // Returning the same object when nothing moved: this runs on every render,
    // and a fresh object each time would re-render forever.
    setRect((current) =>
      current && current.top === top && current.left === left && current.width === width
        ? current
        : { top, left, width }
    );
  };

  useEffect(() => {
    if (!open) return;
    place();
    const reposition = () => place();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  });

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, highlighted]);

  const openList = () => {
    setTyped(null);
    setHighlighted(Math.max(0, options.indexOf(value)));
    setOpen(true);
  };

  const commit = (option: string) => {
    onChange(option);
    setTyped(null);
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey || event.metaKey) return; // Ctrl+arrows still walk rows.

    if (!open) {
      // Opening is the whole point: without this the grid handler sees the
      // arrow and jumps a row.
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        openList();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlighted((current) => (shown.length ? (current + 1) % shown.length : 0));
        return;
      case 'ArrowUp':
        event.preventDefault();
        setHighlighted((current) => (shown.length ? (current - 1 + shown.length) % shown.length : 0));
        return;
      case 'Enter':
        // Only swallow Enter when there is something to take. On an empty
        // filter it falls through to the grid, which moves to the next row.
        if (shown[highlighted]) {
          event.preventDefault();
          commit(shown[highlighted]);
        } else {
          setOpen(false);
        }
        return;
      case 'Tab':
        if (shown[highlighted] && typed) commit(shown[highlighted]);
        setOpen(false);
        return;
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        setTyped(null);
        return;
      default:
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={typed ?? value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        onChange={(event) => {
          setTyped(event.target.value);
          onChange(event.target.value);
          setHighlighted(0);
          setOpen(true);
        }}
        onFocus={() => {
          if (blurTimer.current) window.clearTimeout(blurTimer.current);
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => {
            setOpen(false);
            setTyped(null);
          }, 150);
        }}
        onKeyDown={handleKeyDown}
        className="rx-cell w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-1.5 pr-5 py-0.5 text-[11px] h-7 text-gray-900 dark:text-white placeholder-gray-400"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={"Open " + ariaLabel + " list"}
        onMouseDown={(event) => {
          event.preventDefault();
          if (open) {
            setOpen(false);
          } else {
            inputRef.current?.focus();
            openList();
          }
        }}
        className="absolute right-0 top-0 h-7 w-5 flex items-center justify-center text-gray-400 hover:text-gray-600"
      >
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && rect && shown.length > 0 && createPortal(
        <div
          ref={listRef}
          className="fixed z-[99999] bg-white dark:bg-gray-800 border border-blue-500 rounded shadow-xl overflow-y-auto max-h-[240px] py-0.5"
          style={{ top: rect.top, left: rect.left, width: rect.width }}
        >
          {shown.map((option, idx) => (
            <button
              key={option}
              type="button"
              data-active={idx === highlighted}
              onMouseDown={(event) => {
                event.preventDefault();
                commit(option);
              }}
              onMouseEnter={() => setHighlighted(idx)}
              className={`w-full px-2 py-0.5 text-left text-[11px] ${
                idx === highlighted
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100'
                  : 'text-gray-700 dark:text-gray-200'
              }`}
            >
              {option}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

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
  /** Spreadsheet keys, owned by the parent so every row shares one map. */
  onRowKeyDown?: (event: React.KeyboardEvent<HTMLTableRowElement>, index: number) => void;
}

function MedicineRowComponent({ medicine, index, hospital, medicineOptions, hideOutOfStock, onUpdate, onUpdateBatch, onRemove, onMedicineSearch, onAddNew, onDropdownToggle, onRowKeyDown }: MedicineRowProps) {
  const { t } = useTranslation();
  const [showMedicineDropdown, setShowMedicineDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState(medicine.brandName);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [remoteMedicines, setRemoteMedicines] = useState<Medicine[]>([]);
  const medicineInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<number | null>(null);

  const clearBlurTimeout = React.useCallback(() => {
    if (blurTimeoutRef.current !== null) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      clearBlurTimeout();
    };
  }, [clearBlurTimeout]);

  const updateDropdownPosition = React.useCallback(() => {
    if (showMedicineDropdown && medicineInputRef.current && dropdownRef.current) {
      const rect = medicineInputRef.current.getBoundingClientRect();
      dropdownRef.current.style.top = `${rect.bottom + 4}px`;
      dropdownRef.current.style.left = `${rect.left}px`;
      dropdownRef.current.style.width = `${rect.width}px`;
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

  const mapApiMedicine = (m: any): Medicine => ({
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
  });

  const medicineMatchesTerm = (m: Medicine, term: string) => {
    const normalizedTerm = term.trim().toLowerCase();
    if (!normalizedTerm) return true;

    const searchableText = [
      m.brandName,
      m.genericName,
      m.type,
      m.strength,
      formatMedicineDisplay(m.brandName, m.genericName, m.type, m.strength),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchableText.includes(normalizedTerm);
  };

  const shouldIncludeByStock = (m: Medicine) => {
    if (!hideOutOfStock) return true;
    if (typeof m.stock === 'number') return m.stock > 0;

    // Some API responses omit stock; rely on cached stock when available.
    const cached = medicineOptions.find(
      (localMedicine) =>
        String(localMedicine.id) === String(m.id) &&
        String(localMedicine.hospitalId) === String(hospital.id)
    );

    if (cached && typeof cached.stock === 'number') {
      return cached.stock > 0;
    }

    return true;
  };

  const localMatches = medicineOptions
    .filter((m) =>
      String(m.hospitalId) === String(hospital.id) &&
      m.status === 'active' &&
      shouldIncludeByStock(m) &&
      medicineMatchesTerm(m, searchTerm)
    )
    .slice(0, 120);

  const filteredMedicines = localMatches.length > 0 ? localMatches : remoteMedicines;
  const displayedMedicines = filteredMedicines.slice(0, 50);


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
        let mapped = records.map(mapApiMedicine) as Medicine[];

        // Fallback: if backend search returns nothing, fetch the first page and apply broader client matching
        // (helps with terms such as dosage form/type like "cap").
        if (mapped.length === 0) {
          const allResponse = await api.get('/medicines', {
            params: {
              hospital_id: hospital.id,
              per_page: 200,
              status: 'active',
            },
          });

          if (!active) return;
          const allRecords: any[] = allResponse.data.data ?? allResponse.data;
          mapped = allRecords.map(mapApiMedicine).filter((m) => medicineMatchesTerm(m, term));
        }

        const filtered = mapped.filter((m) => shouldIncludeByStock(m));
        setRemoteMedicines(filtered);
      } catch {
        if (active) setRemoteMedicines([]);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [hospital.id, localMatches.length, searchTerm, hideOutOfStock, medicineOptions]);

  // Reset highlighted index when filtered medicines change
  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [displayedMedicines.length]);

  // Scroll to highlighted item
  React.useEffect(() => {
    if (dropdownRef.current && displayedMedicines.length > 0) {
      const highlightedElement = dropdownRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [highlightedIndex, displayedMedicines.length]);

  const handleKeyDown = (e: React.KeyboardEvent, field: string) => {
    if (field === 'medicine' && showMedicineDropdown && displayedMedicines.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => 
          prev < displayedMedicines.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (displayedMedicines[highlightedIndex]) {
          handleSelectMedicine(displayedMedicines[highlightedIndex]);
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

  const instructionLabels = useMemo(() => instructionOptions.map((opt) => opt.label), []);

  const getInstructionLabel = (value: string) => {
    return instructionOptions.find((opt) => opt.value === value)?.label || value;
  };

  const normalizeInstructionValue = (value: string) => {
    const match = instructionOptions.find((opt) => opt.label === value);
    return match ? match.value : value;
  };

  return (
    <tr
      data-grid-row={index}
      onKeyDown={(event) => onRowKeyDown?.(event, index)}
      className="rx-row"
    >
      {/* Row number, the way a spreadsheet numbers its rows -- it also gives
          the eye a fixed left edge to track along a long prescription. */}
      <td className="rx-gutter text-center text-[10px] tabular-nums text-gray-400 select-none">
        {index + 1}
      </td>
      <td className="p-0">
        <div className="relative">
          {medicine.isTemporary && (
            <span className="absolute -top-2 right-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800">{t('ui.manual')}</span>
          )}
          <input
            ref={medicineInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              const value = e.target.value;
              clearBlurTimeout();
              setSearchTerm(value);
              onMedicineSearch(medicine.rowId, value);
              setShowMedicineDropdown(true);
              onDropdownToggle(true);
              setHighlightedIndex(0);

              const currentInput = medicineInputRef.current;
              if (currentInput) {
                currentInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
              }
            }}
            onFocus={() => {
              clearBlurTimeout();
              setShowMedicineDropdown(true);
              onDropdownToggle(true);
              setHighlightedIndex(0);

              const currentInput = medicineInputRef.current;
              if (currentInput) {
                currentInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
              }
            }}
            onBlur={() => {
              clearBlurTimeout();
              blurTimeoutRef.current = window.setTimeout(() => {
                setShowMedicineDropdown(false);
                onDropdownToggle(false);
                setHighlightedIndex(-1);
                blurTimeoutRef.current = null;
              }, 200);
            }}
            onKeyDown={(e) => handleKeyDown(e, 'medicine')}
            placeholder="Type medicine name..."
            aria-label="Medicine search"
            className="rx-cell w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-0.5 text-[11px] h-7 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            autoComplete="off"
          />
          {showMedicineDropdown && createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-[99999] bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded-lg shadow-2xl overflow-hidden max-h-[280px] min-h-[60px]"
            >
              {displayedMedicines.length > 0 ? (
                <div className="overflow-y-auto max-h-[280px]">
                  {displayedMedicines.map((med, idx) => {
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
      <td className="p-0">
        <GridCombo
          value={medicine.dose}
          onChange={(value) => onUpdate(medicine.rowId, 'dose', value)}
          options={doseOptions}
          ariaLabel="Dose"
          placeholder="Dose"
        />
      </td>
      <td className="p-0">
        <GridCombo
          value={medicine.duration}
          onChange={(value) => onUpdate(medicine.rowId, 'duration', value)}
          options={durationOptions}
          ariaLabel="Duration"
          placeholder="Duration"
        />
      </td>
      <td className="p-0">
        <GridCombo
          value={getInstructionLabel(medicine.instruction)}
          onChange={(value) => onUpdate(medicine.rowId, 'instruction', normalizeInstructionValue(value) as any)}
          options={instructionLabels}
          ariaLabel="Instruction"
          placeholder="Instruction"
          wide
        />
      </td>
      <td className="p-0">
        <input
          type="number"
          value={medicine.quantity}
          onChange={(e) => onUpdate(medicine.rowId, 'quantity', parseInt(e.target.value) || 0)}
          onKeyDown={(e) => handleKeyDown(e, 'quantity')}
          aria-label="Medicine quantity"
          className="rx-cell w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-0.5 text-[11px] h-7 text-right tabular-nums text-gray-900 dark:text-white"
        />
      </td>
      <td className="p-0 text-center">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onRemove(medicine.rowId)}
          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          title="Remove medicine"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}
