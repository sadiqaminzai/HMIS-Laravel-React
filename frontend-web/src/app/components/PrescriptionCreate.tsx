import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Plus, Save, Printer, Trash2, Pill } from 'lucide-react';
import { Hospital, Patient, Medicine, Doctor, UserRole } from '../types';
import { doseOptions, durationOptions, instructionOptions } from '../data/mockData';
import { PrescriptionPrint } from './PrescriptionPrint';
import { useSettings } from '../context/SettingsContext';
import { toast } from '../utils/toast';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { usePatients } from '../context/PatientContext';
import { useDoctors } from '../context/DoctorContext';
import { useMedicines } from '../context/MedicineContext';
import { usePrescriptions } from '../context/PrescriptionContext';
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
}

const formatMedicineDisplay = (brand: string, generic?: string, type?: string, strength?: string, includeStrength: boolean = true) => {
  const parts = [brand || '', generic ? `(${generic})` : null];
  if (includeStrength && strength) parts.push(strength);
  if (type) parts.push(type);
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
};

export function PrescriptionCreate({ hospital, currentUser }: PrescriptionCreateProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const editPrescriptionData = location.state?.editPrescriptionData;

  // Hospital filtering for super_admin with "All Hospitals" support (but for create, we use currentHospital as the target)
  const userRole = currentUser.role as UserRole;
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  const { settings, getDefaultToWalkIn } = useSettings();
  const { patients } = usePatients();
  const { doctors } = useDoctors();
  const { medicines: inventory } = useMedicines();
  const { addPrescription, updatePrescription } = usePrescriptions();

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
  const [isWalkIn, setIsWalkIn] = useState(settings.defaultToWalkIn || false);
  const [walkInPatient, setWalkInPatient] = useState({
    name: '',
    age: '',
    gender: 'male'
  });

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

  // Auto-assign logged-in doctor if user is a doctor
  useEffect(() => {
    if (currentUser.role === 'doctor' && currentUser.doctorId) {
      // Compare as strings to ensure type consistency
      const loggedInDoctor = doctors.find(d => String(d.id) === String(currentUser.doctorId));
      if (loggedInDoctor) {
        setSelectedDoctor(loggedInDoctor);
      }
    }
  }, [currentUser.role, currentUser.doctorId, doctors]);

  // Honor hospital-specific default walk-in preference from settings
  useEffect(() => {
    const defaultWalkIn = getDefaultToWalkIn(currentHospital.id) || settings.defaultToWalkIn || false;
    setIsWalkIn(defaultWalkIn);
    if (defaultWalkIn && walkInDefaultPatient) {
      setSelectedPatient(walkInDefaultPatient);
      setPatientSearch(walkInDefaultPatient.name);
    }
  }, [currentHospital.id, getDefaultToWalkIn, settings.defaultToWalkIn, walkInDefaultPatient]);

  // Populate form when editing existing prescription
  useEffect(() => {
    if (editPrescriptionData) {
      // Find and set the patient
      const patient = patients.find(p => p.id === editPrescriptionData.patientId);
      if (patient) {
        setSelectedPatient(patient);
        setPatientSearch(patient.name);
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
          dose: med.dose || '1-0-1',
          duration: med.duration || '5 days',
          instruction: med.instruction || 'after_meal',
          quantity: med.quantity || 0,
          type: medType
        };
      });
      
      setMedicines(medicineRows);
    }
  }, [editPrescriptionData, patients, doctors, inventory]);

  // Filter patients based on search and current hospital
  const filteredPatients = patients.filter(p =>
    p.hospitalId === currentHospital.id &&
    (p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
     p.patientId.toLowerCase().includes(patientSearch.toLowerCase()))
  );

  // Reset highlighted index when filtered patients change
  useEffect(() => {
    setHighlightedPatientIndex(0);
  }, [patientSearch]);

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    setPatientSearch(patient.name);
    setShowPatientDropdown(false);
    
    // Auto-fill doctor if patient has referred doctor
    if (patient.referredDoctorId) {
      const doctor = doctors.find(d => d.id === patient.referredDoctorId);
      if (doctor) setSelectedDoctor(doctor);
    }

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
    if (type === 'walkin' && currentUser.role === 'doctor' && currentUser.doctorId) {
      const loggedInDoctor = doctors.find(d => String(d.id) === String(currentUser.doctorId));
      if (loggedInDoctor) {
        setSelectedDoctor(loggedInDoctor);
      }
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
      dose: '1-0-1',
      duration: '5 days',
      instruction: 'after_meal',
      quantity: 10
    };
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

  const handleMedicineSearch = (rowId: string, searchTerm: string) => {
    updateMedicineRow(rowId, 'brandName', searchTerm);
    
    // Auto-complete if exact match found
    const medicine = inventory.find(m =>
      m.hospitalId === hospital.id &&
      m.status === 'active' &&
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
        type: medType
      });
    }
  };

  const handleSave = async () => {
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
    const isAdminOrSuperAdmin = currentUser.role === 'super_admin' || currentUser.role === 'admin';
    
    let doctor = selectedDoctor;
    
    // If user is a doctor, ALWAYS use their associated doctor profile
    if (currentUser.role === 'doctor' && currentUser.doctorId) {
      const loggedInDoctor = doctors.find(d => String(d.id) === String(currentUser.doctorId));
      if (loggedInDoctor) {
        doctor = loggedInDoctor;
      }
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
      medicineName: m.brandName,
      strength: m.strength,
      dose: m.dose || '1-0-1',
      duration: m.duration || '5 days',
      instruction: (m.instruction as any) || 'after_meal',
      quantity: m.quantity || 0,
      type: (m as any).type,
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
  };

  const handlePrint = () => {
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
          <button
            onClick={handleSave}
            disabled={!selectedPatient || medicines.length === 0}
            className="px-2.5 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-1 font-medium text-xs"
          >
            <Save className="w-3 h-3" />
            Save Prescription
          </button>
          <button
            onClick={handlePrint}
            disabled={!selectedPatient || medicines.length === 0}
            className="px-2.5 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-1 font-medium text-xs"
          >
            <Printer className="w-3 h-3" />
            Print
          </button>
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
              {showPatientDropdown && filteredPatients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredPatients.map((patient, index) => (
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
                  ))}
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
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1.5">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Medicines</h2>
            <button
              onClick={addMedicineRow}
              className="w-7 h-7 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
              title="Add Medicine"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable table container - only show scrollbar when 5+ medicines */}
          <div className={`overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg ${
            medicines.length >= 5 ? 'max-h-[240px] overflow-y-auto' : 'overflow-y-visible'
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
                    hospital={hospital}
                    medicineOptions={inventory}
                    onUpdate={updateMedicineRow}
                    onUpdateBatch={updateMedicineRowBatch}
                    onRemove={removeMedicineRow}
                    onMedicineSearch={handleMedicineSearch}
                    onAddNew={addMedicineRow}
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
          hospital={hospital}
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
          prescriptionNumber={`RX-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`}
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
  onUpdate: (rowId: string, field: keyof MedicineRow, value: any) => void;
  onUpdateBatch: (rowId: string, updates: Partial<MedicineRow>) => void;
  onRemove: (rowId: string) => void;
  onMedicineSearch: (rowId: string, searchTerm: string) => void;
  onAddNew: () => void;
}

function MedicineRowComponent({ medicine, index, hospital, medicineOptions, onUpdate, onUpdateBatch, onRemove, onMedicineSearch, onAddNew }: MedicineRowProps) {
  const [showMedicineDropdown, setShowMedicineDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState(medicine.brandName);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const medicineInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update searchTerm when medicine.brandName changes from parent
  React.useEffect(() => {
    setSearchTerm(medicine.brandName);
  }, [medicine.brandName]);

  const filteredMedicines = medicineOptions.filter(m =>
    m.hospitalId === hospital.id &&
    m.status === 'active' &&
    searchTerm.length > 0 &&
    (m.brandName.toLowerCase().includes(searchTerm.toLowerCase()) ||
     m.genericName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'quantity') {
        onAddNew();
      }
    } else if (e.key === 'Escape') {
      setShowMedicineDropdown(false);
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
      type: medType
    });
    
    setShowMedicineDropdown(false);
    // Focus on next field (dose)
    setTimeout(() => {
      const nextInput = medicineInputRef.current?.closest('tr')?.querySelector('select');
      if (nextInput) (nextInput as HTMLSelectElement).focus();
    }, 100);
  };

  return (
    <tr className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <td className="py-0.5 px-2">
        <div className="relative">
          <input
            ref={medicineInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              const value = e.target.value;
              setSearchTerm(value);
              onMedicineSearch(medicine.rowId, value);
              setShowMedicineDropdown(true);
            }}
            onFocus={() => setShowMedicineDropdown(true)}
            onBlur={() => {
              // Delay to allow click on dropdown items
              setTimeout(() => setShowMedicineDropdown(false), 250);
            }}
            onKeyDown={(e) => handleKeyDown(e, 'medicine')}
            placeholder="Type medicine name..."
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-800 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            autoComplete="off"
          />
          {showMedicineDropdown && searchTerm.length > 0 && (
            <div 
              ref={dropdownRef}
              className="fixed bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded-lg shadow-2xl overflow-hidden"
              style={{
                top: medicineInputRef.current ? 
                  medicineInputRef.current.getBoundingClientRect().bottom + window.scrollY + 4 : 0,
                left: medicineInputRef.current ? 
                  medicineInputRef.current.getBoundingClientRect().left + window.scrollX : 0,
                width: medicineInputRef.current ? 
                  medicineInputRef.current.getBoundingClientRect().width : 300,
                maxHeight: '280px',
                minHeight: '60px',
                zIndex: 99999
              }}
            >
              {filteredMedicines.length > 0 ? (
                <div className="overflow-y-auto" style={{ maxHeight: '280px' }}>
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
                        <div className="font-semibold text-xs text-gray-900 dark:text-white">{med.brandName}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                          {med.genericName} • {med.strength}
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
            </div>
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
        <select
          value={medicine.instruction}
          onChange={(e) => onUpdate(medicine.rowId, 'instruction', e.target.value as any)}
          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          {instructionOptions.map(inst => (
            <option key={inst.value} value={inst.value}>{inst.label}</option>
          ))}
        </select>
      </td>
      <td className="py-0.5 px-2">
        <input
          type="number"
          value={medicine.quantity}
          onChange={(e) => onUpdate(medicine.rowId, 'quantity', parseInt(e.target.value) || 0)}
          onKeyDown={(e) => handleKeyDown(e, 'quantity')}
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