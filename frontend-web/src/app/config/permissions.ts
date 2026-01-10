import { UserRole } from '../types';

// Define all available permissions
export type Permission = 
  // Dashboard
  | 'dashboard.view'
  
  // Hospital Management
  | 'hospitals.view'
  | 'hospitals.create'
  | 'hospitals.edit'
  | 'hospitals.delete'
  | 'hospitals.print'
  
  // Doctor Management
  | 'doctors.view'
  | 'doctors.create'
  | 'doctors.edit'
  | 'doctors.delete'
  | 'doctors.print'
  
  // Patient Management
  | 'patients.view'
  | 'patients.create'
  | 'patients.edit'
  | 'patients.delete'
  | 'patients.print'
  
  // Appointment Management
  | 'appointments.view'
  | 'appointments.create'
  | 'appointments.edit'
  | 'appointments.delete'
  | 'appointments.updateStatus'
  | 'appointments.print'
  
  // Prescription Management
  | 'prescriptions.view'
  | 'prescriptions.create'
  | 'prescriptions.edit'
  | 'prescriptions.delete'
  | 'prescriptions.print'
  
  // Medicine Management
  | 'medicines.view'
  | 'medicines.create'
  | 'medicines.edit'
  | 'medicines.delete'
  | 'medicines.print'
  
  // Medicine Type Management
  | 'medicineTypes.view'
  | 'medicineTypes.create'
  | 'medicineTypes.edit'
  | 'medicineTypes.delete'
  
  // Manufacturer Management
  | 'manufacturers.view'
  | 'manufacturers.create'
  | 'manufacturers.edit'
  | 'manufacturers.delete'
  
  // Lab Test Management
  | 'labTests.view'
  | 'labTests.create'
  | 'labTests.edit'
  | 'labTests.delete'
  | 'labTests.updateStatus'
  | 'labTests.enterResults'
  | 'labTests.print'
  
  // Test Template Management
  | 'testTemplates.view'
  | 'testTemplates.create'
  | 'testTemplates.edit'
  | 'testTemplates.delete'
  
  // User Management
  | 'users.view'
  | 'users.create'
  | 'users.edit'
  | 'users.delete'
  
  // Role Management
  | 'roles.view'
  | 'roles.create'
  | 'roles.edit'
  | 'roles.delete'
  
  // Permission Management
  | 'permissions.view'
  | 'permissions.edit'
  
  // Settings
  | 'settings.view'
  | 'settings.edit';

// Role-based permission mapping
export const rolePermissions: Record<UserRole, Permission[]> = {
  super_admin: [
    // Dashboard
    'dashboard.view',
    
    // Hospital Management - Full Access
    'hospitals.view',
    'hospitals.create',
    'hospitals.edit',
    'hospitals.delete',
    'hospitals.print',
    
    // Doctor Management - Full Access
    'doctors.view',
    'doctors.create',
    'doctors.edit',
    'doctors.delete',
    'doctors.print',
    
    // Patient Management - Full Access
    'patients.view',
    'patients.create',
    'patients.edit',
    'patients.delete',
    'patients.print',
    
    // Appointment Management - Full Access
    'appointments.view',
    'appointments.create',
    'appointments.edit',
    'appointments.delete',
    'appointments.updateStatus',
    'appointments.print',
    
    // Prescription Management - Full Access
    'prescriptions.view',
    'prescriptions.create',
    'prescriptions.edit',
    'prescriptions.delete',
    'prescriptions.print',
    
    // Medicine Management - Full Access
    'medicines.view',
    'medicines.create',
    'medicines.edit',
    'medicines.delete',
    'medicines.print',
    
    // Medicine Type Management - Full Access
    'medicineTypes.view',
    'medicineTypes.create',
    'medicineTypes.edit',
    'medicineTypes.delete',
    
    // Manufacturer Management - Full Access
    'manufacturers.view',
    'manufacturers.create',
    'manufacturers.edit',
    'manufacturers.delete',
    
    // Lab Test Management - Full Access
    'labTests.view',
    'labTests.create',
    'labTests.edit',
    'labTests.delete',
    'labTests.updateStatus',
    'labTests.enterResults',
    'labTests.print',
    
    // Test Template Management - Full Access
    'testTemplates.view',
    'testTemplates.create',
    'testTemplates.edit',
    'testTemplates.delete',
    
    // User Management - Full Access
    'users.view',
    'users.create',
    'users.edit',
    'users.delete',
    
    // Role Management - Full Access
    'roles.view',
    'roles.create',
    'roles.edit',
    'roles.delete',
    
    // Permission Management - Full Access
    'permissions.view',
    'permissions.edit',
    
    // Settings - Full Access
    'settings.view',
    'settings.edit',
  ],
  
  admin: [
    // Dashboard
    'dashboard.view',
    
    // Hospital Management - View Only (Their Own Hospital)
    'hospitals.view',
    'hospitals.print',
    
    // Doctor Management - Full Access (Hospital Specific)
    'doctors.view',
    'doctors.create',
    'doctors.edit',
    'doctors.delete',
    'doctors.print',
    
    // Patient Management - Full Access (Hospital Specific)
    'patients.view',
    'patients.create',
    'patients.edit',
    'patients.delete',
    'patients.print',
    
    // Appointment Management - Full Access (Hospital Specific)
    'appointments.view',
    'appointments.create',
    'appointments.edit',
    'appointments.delete',
    'appointments.updateStatus',
    'appointments.print',
    
    // Prescription Management - View, Print (Hospital Specific)
    'prescriptions.view',
    'prescriptions.print',
    
    // Medicine Management - Full Access (Hospital Specific)
    'medicines.view',
    'medicines.create',
    'medicines.edit',
    'medicines.delete',
    'medicines.print',
    
    // Medicine Type Management - Full Access (Hospital Specific)
    'medicineTypes.view',
    'medicineTypes.create',
    'medicineTypes.edit',
    'medicineTypes.delete',
    
    // Manufacturer Management - Full Access (Hospital Specific)
    'manufacturers.view',
    'manufacturers.create',
    'manufacturers.edit',
    'manufacturers.delete',
    
    // Lab Test Management - View, Status Update, Print (Hospital Specific)
    'labTests.view',
    'labTests.updateStatus',
    'labTests.print',
    
    // Test Template Management - Full Access (Hospital Specific)
    'testTemplates.view',
    'testTemplates.create',
    'testTemplates.edit',
    'testTemplates.delete',
    
    // User Management - Full Access (Hospital Specific)
    'users.view',
    'users.create',
    'users.edit',
    'users.delete',
    
    // Role Management - View Only
    'roles.view',
    
    // Settings - Full Access
    'settings.view',
    'settings.edit',
  ],
  
  doctor: [
    // Dashboard
    'dashboard.view',
    
    // Doctor Management - View Only
    'doctors.view',
    
    // Patient Management - View and Create Only
    'patients.view',
    'patients.create',
    'patients.edit',
    'patients.print',
    
    // Appointment Management - View and Update Status
    'appointments.view',
    'appointments.updateStatus',
    'appointments.print',
    
    // Prescription Management - Full Access (Own Prescriptions)
    'prescriptions.view',
    'prescriptions.create',
    'prescriptions.edit',
    'prescriptions.delete',
    'prescriptions.print',
    
    // Medicine Management - View Only
    'medicines.view',
    
    // Lab Test Management - Create, View, Print
    'labTests.view',
    'labTests.create',
    'labTests.print',
    
    // Test Template Management - View Only
    'testTemplates.view',
    
    // Settings - View and Edit (Own Profile)
    'settings.view',
    'settings.edit',
  ],
  
  receptionist: [
    // Dashboard
    'dashboard.view',
    
    // Doctor Management - View Only (Cannot Delete)
    'doctors.view',
    'doctors.print',
    
    // Patient Management - Create, Edit, View (Cannot Delete)
    'patients.view',
    'patients.create',
    'patients.edit',
    'patients.print',
    
    // Appointment Management - Full Access
    'appointments.view',
    'appointments.create',
    'appointments.edit',
    'appointments.delete',
    'appointments.updateStatus',
    'appointments.print',
    
    // Prescription Management - View Only
    'prescriptions.view',
    'prescriptions.print',
    
    // Lab Test Management - View and Print
    'labTests.view',
    'labTests.print',
    
    // Settings - View Only
    'settings.view',
  ],
  
  pharmacist: [
    // Dashboard
    'dashboard.view',
    
    // Patient Management - View Only
    'patients.view',
    
    // Prescription Management - View and Print Only
    'prescriptions.view',
    'prescriptions.print',
    
    // Medicine Management - Full Access
    'medicines.view',
    'medicines.create',
    'medicines.edit',
    'medicines.delete',
    'medicines.print',
    
    // Medicine Type Management - Full Access
    'medicineTypes.view',
    'medicineTypes.create',
    'medicineTypes.edit',
    'medicineTypes.delete',
    
    // Manufacturer Management - Full Access
    'manufacturers.view',
    'manufacturers.create',
    'manufacturers.edit',
    'manufacturers.delete',
    
    // Settings - View and Edit (Own Profile)
    'settings.view',
    'settings.edit',
  ],
  
  lab_technician: [
    // Dashboard
    'dashboard.view',
    
    // Patient Management - View Only
    'patients.view',
    
    // Lab Test Management - View, Update Status, Enter Results, Print
    'labTests.view',
    'labTests.updateStatus',
    'labTests.enterResults',
    'labTests.print',
    
    // Test Template Management - View and Create
    'testTemplates.view',
    'testTemplates.create',
    'testTemplates.edit',
    
    // Settings - View and Edit (Own Profile)
    'settings.view',
    'settings.edit',
  ],
};

// Helper function to check if a role has a specific permission
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

// Helper function to get all permissions for a role
export function getRolePermissions(role: UserRole): Permission[] {
  return rolePermissions[role] ?? [];
}

// Helper function to check multiple permissions (requires all)
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

// Helper function to check multiple permissions (requires at least one)
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

// Module-level permission checks
export const modulePermissions = {
  canAccessDashboard: (role: UserRole) => hasPermission(role, 'dashboard.view'),
  
  canAccessHospitals: (role: UserRole) => hasPermission(role, 'hospitals.view'),
  canManageHospitals: (role: UserRole) => hasPermission(role, 'hospitals.create'),
  
  canAccessDoctors: (role: UserRole) => hasPermission(role, 'doctors.view'),
  canManageDoctors: (role: UserRole) => hasPermission(role, 'doctors.create'),
  
  canAccessPatients: (role: UserRole) => hasPermission(role, 'patients.view'),
  canManagePatients: (role: UserRole) => hasPermission(role, 'patients.create'),
  
  canAccessAppointments: (role: UserRole) => hasPermission(role, 'appointments.view'),
  canManageAppointments: (role: UserRole) => hasPermission(role, 'appointments.create'),
  
  canAccessPrescriptions: (role: UserRole) => hasPermission(role, 'prescriptions.view'),
  canCreatePrescriptions: (role: UserRole) => hasPermission(role, 'prescriptions.create'),
  
  canAccessMedicines: (role: UserRole) => hasPermission(role, 'medicines.view'),
  canManageMedicines: (role: UserRole) => hasPermission(role, 'medicines.create'),
  
  canAccessLabTests: (role: UserRole) => hasPermission(role, 'labTests.view'),
  canManageLabTests: (role: UserRole) => hasPermission(role, 'labTests.create'),
  
  canAccessTestTemplates: (role: UserRole) => hasPermission(role, 'testTemplates.view'),
  canManageTestTemplates: (role: UserRole) => hasPermission(role, 'testTemplates.create'),
  
  canAccessUsers: (role: UserRole) => hasPermission(role, 'users.view'),
  canManageUsers: (role: UserRole) => hasPermission(role, 'users.create'),
  
  canAccessSettings: (role: UserRole) => hasPermission(role, 'settings.view'),
};
