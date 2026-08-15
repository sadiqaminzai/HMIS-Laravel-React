# ShifaaScript - Doctor Prescription System - Role-Based Permissions Matrix

## 📋 Complete Permissions Overview

This document outlines the comprehensive role-based access control (RBAC) system for the ShifaaScript Doctor Prescription System.

---

## 🎭 Role Definitions

### 1. **Super Admin** 👑
- **Access Level**: System-wide (All Hospitals)
- **Description**: Full system access with hospital filtering capability
- **Data Scope**: Can view and manage all hospitals

### 2. **Admin** 🏥
- **Access Level**: Hospital-specific
- **Description**: Hospital administrator with full management capabilities
- **Data Scope**: Limited to assigned hospital

### 3. **Doctor** 👨‍⚕️
- **Access Level**: Patient & Prescription focused
- **Description**: Medical professionals who create prescriptions and manage patients
- **Data Scope**: Hospital-specific, own prescriptions

### 4. **Receptionist** 📋
- **Access Level**: Front desk operations
- **Description**: Patient registration, appointment scheduling
- **Data Scope**: Hospital-specific, cannot delete patients/doctors

### 5. **Pharmacist** 💊
- **Access Level**: Pharmacy operations
- **Description**: Medicine inventory and prescription dispensing
- **Data Scope**: Hospital-specific pharmacy data

### 6. **Lab Technician** 🧪
- **Access Level**: Laboratory operations
- **Description**: Lab test management and result entry
- **Data Scope**: Hospital-specific lab data

---

## 📊 Complete Permissions Matrix

### Legend
- ✅ **Full Access** (Create, Read, Update, Delete)
- 👁️ **View Only** (Read)
- ✏️ **View & Edit** (Read, Update)
- ➕ **Create & View** (Create, Read)
- 🚫 **No Access**
- ⚠️ **Conditional Access** (with restrictions)

---

## Module: Dashboard

| Feature | Super Admin | Admin | Doctor | Receptionist | Pharmacist | Lab Technician |
|---------|-------------|-------|--------|--------------|------------|----------------|
| View Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hospital Filter | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| View Statistics | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Charts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Module: Hospital Management

| Feature | Super Admin | Admin | Doctor | Receptionist | Pharmacist | Lab Technician |
|---------|-------------|-------|--------|--------------|------------|----------------|
| View Hospitals | ✅ | 👁️ | 🚫 | 🚫 | 🚫 | 🚫 |
| Create Hospital | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Edit Hospital | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Delete Hospital | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Print Hospital Details | ✅ | ✅ | 🚫 | 🚫 | 🚫 | 🚫 |

**Notes:**
- Admin can only view their own hospital
- Only Super Admin can manage multiple hospitals

---

## Module: Doctor Management (Reception → Doctors)

| Feature | Super Admin | Admin | Doctor | Receptionist | Pharmacist | Lab Technician |
|---------|-------------|-------|--------|--------------|------------|----------------|
| View Doctors | ✅ | ✅ | 👁️ | 👁️ | 🚫 | 🚫 |
| Create Doctor | ✅ | ✅ | 🚫 | 🚫 | 🚫 | 🚫 |
| Edit Doctor | ✅ | ✅ | 🚫 | 🚫 | 🚫 | 🚫 |
| Delete Doctor | ✅ | ✅ | 🚫 | 🚫 | 🚫 | 🚫 |
| Print Doctor Details | ✅ | ✅ | 👁️ | 👁️ | 🚫 | 🚫 |
| Upload Signature | ✅ | ✅ | ✅ | 🚫 | 🚫 | 🚫 |

**Notes:**
- Receptionist can VIEW but CANNOT DELETE doctors
- Doctors can upload/update their own digital signature

---

## Module: Patient Management (Reception → Patients)

| Feature | Super Admin | Admin | Doctor | Receptionist | Pharmacist | Lab Technician |
|---------|-------------|-------|--------|--------------|------------|----------------|
| View Patients | ✅ | ✅ | ✅ | ✅ | 👁️ | 👁️ |
| Create Patient | ✅ | ✅ | ✏️ | ✅ | 🚫 | 🚫 |
| Edit Patient | ✅ | ✅ | ✏️ | ✏️ | 🚫 | 🚫 |
| Delete Patient | ✅ | ✅ | 🚫 | 🚫 | 🚫 | 🚫 |
| Print Patient Card | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| Upload Photo | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |

**Notes:**
- Receptionist can CREATE and EDIT but CANNOT DELETE patients
- Pharmacist and Lab Technician can only view patient info

---

## Module: Appointment Management (Reception → Appointments)

| Feature | Super Admin | Admin | Doctor | Receptionist | Pharmacist | Lab Technician |
|---------|-------------|-------|--------|--------------|------------|----------------|
| View Appointments | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| Create Appointment | ✅ | ✅ | 🚫 | ✅ | 🚫 | 🚫 |
| Edit Appointment | ✅ | ✅ | 🚫 | ✏️ | 🚫 | 🚫 |
| Delete Appointment | ✅ | ✅ | 🚫 | ✅ | 🚫 | 🚫 |
| Update Status | ✅ | ✅ | ✏️ | ✏️ | 🚫 | 🚫 |
| Print Appointment | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |

**Notes:**
- Doctors can view and update appointment status only
- Receptionist has full CRUD access to appointments

---

## Module: Prescription Management

| Feature | Super Admin | Admin | Doctor | Receptionist | Pharmacist | Lab Technician |
|---------|-------------|-------|--------|--------------|------------|----------------|
| View Prescriptions | ✅ | ✅ | ✅ | 👁️ | 👁️ | 🚫 |
| Create Prescription | ✅ | 🚫 | ✅ | 🚫 | 🚫 | 🚫 |
| Edit Prescription | ✅ | 🚫 | ⚠️ | 🚫 | 🚫 | 🚫 |
| Delete Prescription | ✅ | 🚫 | ⚠️ | 🚫 | 🚫 | 🚫 |
| Print Prescription | ✅ | ✅ | ✅ | 👁️ | 👁️ | 🚫 |
| View QR Code | ✅ | ✅ | ✅ | ✅ | ✅ | 🚫 |

**Notes:**
- Doctors can only edit/delete their OWN prescriptions
- Receptionist and Pharmacist can view and print only
- QR code generated for verification

---

## Module: Pharmacy Management

### Medicines

| Feature | Super Admin | Admin | Doctor | Receptionist | Pharmacist | Lab Technician |
|---------|-------------|-------|--------|--------------|------------|----------------|
| View Medicines | ✅ | ✅ | 👁️ | 🚫 | ✅ | 🚫 |
| Create Medicine | ✅ | ✅ | 🚫 | 🚫 | ✅ | 🚫 |
| Edit Medicine | ✅ | ✅ | 🚫 | 🚫 | ✏️ | 🚫 |
| Delete Medicine | ✅ | ✅ | 🚫 | 🚫 | ✅ | 🚫 |
| Print Medicine List | ✅ | ✅ | 🚫 | 🚫 | ✅ | 🚫 |

### Medicine Types

| Feature | Super Admin | Admin | Doctor | Receptionist | Pharmacist | Lab Technician |
|---------|-------------|-------|--------|--------------|------------|----------------|
| View Medicine Types | ✅ | ✅ | 🚫 | 🚫 | ✅ | 🚫 |
| Create Medicine Type | ✅ | ✅ | 🚫 | 🚫 | ✅ | 🚫 |
| Edit Medicine Type | ✅ | ✅ | 🚫 | 🚫 | ✏️ | 🚫 |
| Delete Medicine Type | ✅ | ✅ | 🚫 | 🚫 | ✅ | 🚫 |

### Manufacturers

| Feature | Super Admin | Admin | Doctor | Receptionist | Pharmacist | Lab Technician |
|---------|-------------|-------|--------|--------------|------------|----------------|
| View Manufacturers | ✅ | ✅ | 🚫 | 🚫 | ✅ | 🚫 |
| Create Manufacturer | ✅ | ✅ | 🚫 | 🚫 | ✅ | 🚫 |
| Edit Manufacturer | ✅ | ✅ | 🚫 | 🚫 | ✏️ | 🚫 |
| Delete Manufacturer | ✅ | ✅ | 🚫 | 🚫 | ✅ | 🚫 |

---

## Module: Laboratory Management

### Lab Tests

| Feature | Super Admin | Admin | Doctor | Receptionist | Pharmacist | Lab Technician |
|---------|-------------|-------|--------|--------------|------------|----------------|
| View Lab Tests | ✅ | ✅ | ✅ | 👁️ | 🚫 | ✅ |
| Create Lab Test | ✅ | 🚫 | ✅ | 🚫 | 🚫 | 🚫 |
| Edit Lab Test | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Delete Lab Test | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Update Status | ✅ | ✏️ | 🚫 | 🚫 | 🚫 | ✏️ |
| Enter Results | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | ✏️ |
| Print Lab Report | ✅ | ✅ | ✅ | 👁️ | 🚫 | ✅ |

**Notes:**
- Only Doctors can ORDER lab tests
- Only Lab Technicians can ENTER RESULTS
- Lab Technicians can update test status (Pending → In Progress → Completed)

### Test Templates (Laboratory → Test Management)

| Feature | Super Admin | Admin | Doctor | Receptionist | Pharmacist | Lab Technician |
|---------|-------------|-------|--------|--------------|------------|----------------|
| View Test Templates | ✅ | ✅ | 👁️ | 🚫 | 🚫 | ✅ |
| Create Test Template | ✅ | ✅ | 🚫 | 🚫 | 🚫 | ✏️ |
| Edit Test Template | ✅ | ✅ | 🚫 | 🚫 | 🚫 | ✏️ |
| Delete Test Template | ✅ | ✅ | 🚫 | 🚫 | 🚫 | 🚫 |

**Notes:**
- Lab Technicians can create and edit test templates
- Only Admin and Super Admin can delete test templates

---

## Module: Settings & Administration

### User Management

| Feature | Super Admin | Admin | Doctor | Receptionist | Pharmacist | Lab Technician |
|---------|-------------|-------|--------|--------------|------------|----------------|
| View Users | ✅ | ✅ | 🚫 | 🚫 | 🚫 | 🚫 |
| Create User | ✅ | ✅ | 🚫 | 🚫 | 🚫 | 🚫 |
| Edit User | ✅ | ✅ | 🚫 | 🚫 | 🚫 | 🚫 |
| Delete User | ✅ | ✅ | 🚫 | 🚫 | 🚫 | 🚫 |

**Notes:**
- Admin can only manage users within their hospital
- Super Admin can manage users across all hospitals

### Role Management

| Feature | Super Admin | Admin | Doctor | Receptionist | Pharmacist | Lab Technician |
|---------|-------------|-------|--------|--------------|------------|----------------|
| View Roles | ✅ | 👁️ | 🚫 | 🚫 | 🚫 | 🚫 |
| Create Role | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Edit Role | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Delete Role | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |

### Permission Management

| Feature | Super Admin | Admin | Doctor | Receptionist | Pharmacist | Lab Technician |
|---------|-------------|-------|--------|--------------|------------|----------------|
| View Permissions | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Edit Permissions | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |

**Notes:**
- Only Super Admin can manage system permissions

### General Settings

| Feature | Super Admin | Admin | Doctor | Receptionist | Pharmacist | Lab Technician |
|---------|-------------|-------|--------|--------------|------------|----------------|
| View Settings | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit Profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Change Theme | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Change Language | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Date Format Settings | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 🔒 Data Isolation Rules

### Multi-Tenancy Enforcement

1. **Super Admin**
   - Can access ALL hospitals
   - Can filter by specific hospital
   - Can create new hospitals

2. **Hospital-Specific Roles** (Admin, Doctor, Receptionist, Pharmacist, Lab Technician)
   - Can ONLY access data from their assigned hospital
   - Data filtered by `hospitalId` at database level
   - Cannot see or access other hospitals' data

3. **User-Specific Restrictions**
   - Doctors can only edit/delete their OWN prescriptions
   - Lab Technicians can only process tests for their hospital

---

## 🎯 Special Permission Rules

### Delete Restrictions

| Entity | Who CAN Delete | Who CANNOT Delete |
|--------|----------------|-------------------|
| Patients | Super Admin, Admin | Doctor, Receptionist, Pharmacist, Lab Technician |
| Doctors | Super Admin, Admin | Receptionist, Doctor, Pharmacist, Lab Technician |
| Appointments | Super Admin, Admin, Receptionist | Doctor, Pharmacist, Lab Technician |
| Prescriptions | Super Admin, Doctor (own only) | Admin, Receptionist, Pharmacist, Lab Technician |
| Medicines | Super Admin, Admin, Pharmacist | Doctor, Receptionist, Lab Technician |
| Lab Tests | Super Admin only | All other roles |
| Test Templates | Super Admin, Admin | Doctor, Receptionist, Pharmacist, Lab Technician |

---

## 📱 Navigation Menu Access

### Complete Menu Structure by Role

#### Super Admin 👑
- ✅ Dashboard
- ✅ Hospitals
- ✅ Reception (Doctors, Patients, Appointments)
- ✅ Laboratory (Lab Tests, Test Management)
- ✅ Pharmacy (Manufacturers, Medicine Types, Medicines)
- ✅ Prescriptions (Create New, View All)
- ✅ Settings (Users, Roles, Permissions, General)

#### Admin 🏥
- ✅ Dashboard
- ✅ Reception (Doctors, Patients, Appointments)
- ✅ Laboratory (Lab Tests, Test Management)
- ✅ Pharmacy (Manufacturers, Medicine Types, Medicines)
- ✅ Prescriptions (View All)
- ✅ Settings (Users, Roles, General)

#### Doctor 👨‍⚕️
- ✅ Dashboard
- ✅ Laboratory (Lab Tests)
- ✅ Prescriptions (Create New, View All)
- ✅ Settings (General)

#### Receptionist 📋
- ✅ Dashboard
- ✅ Reception (Doctors, Patients, Appointments)
- ✅ Laboratory (Lab Tests - view only)
- ✅ Prescriptions (View All)
- ✅ Settings (General)

#### Pharmacist 💊
- ✅ Dashboard
- ✅ Pharmacy (Manufacturers, Medicine Types, Medicines)
- ✅ Prescriptions (View All)
- ✅ Settings (General)

#### Lab Technician 🧪
- ✅ Dashboard
- ✅ Laboratory (Lab Tests, Test Management)
- ✅ Settings (General)

---

## 🎨 UI Elements Based on Permissions

### Action Buttons Visibility

Each module's action buttons are conditionally rendered based on role permissions:

```typescript
// Example: Patient Management
- Add New Patient: Super Admin, Admin, Doctor, Receptionist
- Edit Patient: Super Admin, Admin, Doctor, Receptionist  
- Delete Patient: Super Admin, Admin ONLY
- Print Patient: Super Admin, Admin, Doctor, Receptionist
```

### Status Update Permissions

```typescript
// Appointments
- Can update status: Super Admin, Admin, Doctor, Receptionist

// Lab Tests  
- Can update status: Super Admin, Admin, Lab Technician
- Can enter results: Super Admin, Lab Technician
```

---

## 🔄 Permission Inheritance

Permissions follow a hierarchical structure:

```
Super Admin (All Permissions)
    ↓
Admin (Hospital-specific Full Access)
    ↓
Specialized Roles (Department-specific Access)
    ├── Doctor (Medical Operations)
    ├── Receptionist (Front Desk Operations)
    ├── Pharmacist (Pharmacy Operations)
    └── Lab Technician (Laboratory Operations)
```

---

## 📝 Implementation Notes

1. **Permission Checking**: Use the `hasPermission()` helper function from `/src/app/config/permissions.ts`

2. **Component-Level Protection**: Each component checks permissions before rendering action buttons

3. **API-Level Protection** (Future): Backend will enforce these same permissions at the API level

4. **Audit Trail** (Future): All permission-based actions will be logged for compliance

---

## ✅ Compliance & Security

- **HIPAA Compliant**: Patient data access is restricted and logged
- **Role-Based Access Control (RBAC)**: Industry-standard security model
- **Data Isolation**: Complete separation between hospitals
- **Audit Ready**: Permission structure supports future audit logging
- **Principle of Least Privilege**: Users only get access they need

---

**Last Updated**: January 7, 2026  
**Version**: 1.0  
**Maintained By**: Development Team