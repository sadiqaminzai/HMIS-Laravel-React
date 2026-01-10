export type UserRole = 'super_admin' | 'admin' | 'doctor' | 'receptionist' | 'pharmacist' | 'lab_technician';

export interface Hospital {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  license: string;
  licenseIssueDate: string;
  licenseExpiryDate: string;
  status: 'active' | 'suspended';
  timezone?: string;
  calendarType?: 'gregorian' | 'shamsi';
  logo?: string;
  brandColor?: string;
  createdAt?: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface DoctorAvailability {
  day: string; // 'Monday', 'Tuesday', etc.
  startTime: string; // '09:00'
  endTime: string; // '17:00'
  isAvailable: boolean;
}

export interface Doctor {
  id: string;
  hospitalId: string;
  name: string;
  specialization: string;
  registrationNumber: string;
  phone: string;
  email: string;
  status: 'active' | 'inactive';
  image?: string;
  signature?: string; // Digital signature image
  availability?: DoctorAvailability[];
  consultationFee: number;
  createdAt?: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface Patient {
  id: string;
  hospitalId: string;
  patientId: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  phone: string;
  address: string;
  referredDoctorId?: string;
  createdAt: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
  status?: 'active' | 'inactive';
  image?: string;
}

export interface Manufacturer {
  id: string;
  hospitalId: string;
  name: string;
  licenseNumber: string;
  country: string;
  status: 'active' | 'inactive';
  createdAt?: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface MedicineType {
  id: string;
  hospitalId: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  createdAt?: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface Medicine {
  id: string;
  hospitalId: string;
  brandName: string;
  genericName: string;
  strength: string;
  form: 'tablet' | 'capsule' | 'syrup' | 'injection' | 'cream' | 'drops';
  manufacturerId: string;
  medicineTypeId: string;
  dosage?: string;
  type?: string;
  price?: number;
  stock?: number;
  status: 'active' | 'inactive';
  createdAt?: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface PrescriptionMedicine {
  medicineId: string;
  medicineName: string;
  strength: string;
  dose: string;
  duration: string;
  instruction: 'before_meal' | 'after_meal' | 'with_meal' | 'empty_stomach';
  quantity: number;
  type?: string; // e.g. Tablet, Syrup, Injection
}

export interface Prescription {
  id: string;
  hospitalId: string;
  prescriptionNumber: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  doctorId: string;
  doctorName: string;
  diagnosis?: string;
  medicines: PrescriptionMedicine[];
  advice: string;
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
  status?: 'active' | 'cancelled';
  qrCode?: string; // QR code data
}

export interface User {
  id: string;
  hospitalId: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  password?: string; // Added for auth simulation
  doctorId?: string; // Links to Doctor entity if user is a doctor
  createdAt?: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
}

// New interfaces for Appointments
export interface Appointment {
  id: string;
  hospitalId: string;
  appointmentNumber: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  doctorId: string;
  doctorName: string;
  appointmentDate: Date;
  appointmentTime: string;
  reason: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
}

// New interfaces for Lab Tests
export interface LabTest {
  id: string;
  hospitalId: string;
  testNumber: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  doctorId: string;
  doctorName: string;
  selectedTests: string[]; // Array of TestTemplate IDs
  testName: string; // Comma-separated test names for display
  testType: string;
  instructions?: string;
  status: 'unpaid' | 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'normal' | 'urgent' | 'stat';
  sampleCollectedAt?: Date;
  reportedAt?: Date;
  testResults?: TestResult[]; // Results for each parameter
  remarks?: string;
  assignedTo?: string; // Lab Technician ID
  assignedToName?: string;
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
}

// Result for each parameter
export interface TestResult {
  testTemplateId: string;
  testName: string;
  parameterName: string;
  unit: string;
  normalRange: string;
  result: string;
  remarks?: string;
}

// Lab Test Template/Definition (Master Data)
export interface TestTemplate {
  id: string;
  hospitalId: string;
  testCode: string;
  testName: string;
  testType: string;
  category: string;
  description?: string;
  sampleType: string; // Blood, Urine, Stool, etc.
  parameters: TestParameter[];
  price: number;
  duration: string; // Expected turnaround time (e.g., "24 hours", "2-3 days")
  instructions?: string; // Pre-test instructions for patients
  status: 'active' | 'inactive';
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface TestParameter {
  parameterName: string;
  unit: string;
  normalRange: string;
  description?: string;
}

// Patient Medical History
export interface MedicalHistory {
  id: string;
  patientId: string;
  condition: string;
  diagnosedDate: Date;
  status: 'active' | 'resolved';
  notes?: string;
}

// Patient ID Card Data
export interface PatientIDCard {
  patientId: string;
  hospitalName: string;
  hospitalLogo?: string;
  patientName: string;
  age: number;
  gender: string;
  bloodGroup?: string;
  emergencyContact: string;
  qrCode: string;
  issuedDate: Date;
}