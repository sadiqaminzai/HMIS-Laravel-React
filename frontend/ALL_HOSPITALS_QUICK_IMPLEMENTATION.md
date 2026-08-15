# "All Hospitals" Feature - Complete Implementation Guide

## ✅ **COMPLETED**
1. **HospitalSelector** Component (Reusable) - `/src/app/components/HospitalSelector.tsx`
2. **useHospitalFilter** Custom Hook with `filterByHospital` helper
3. **AppointmentManagement** - Full implementation with "All Hospitals" support

---

## 🚀 **REMAINING 7 MODULES - Fast Implementation**

### **Pattern to Apply:**

```typescript
// Step 1: Import
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { mockHospitals } from '../data/mockData';

// Step 2: Add userRole to props (if missing)
interface ComponentProps {
  hospital: Hospital;
  userRole?: UserRole; // ADD THIS
}

// Step 3: Use the hook
const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);

// Step 4: Filter data using filterByHospital helper
const hospitalItems = filterByHospital(mockItems);

// Step 5: Handle "All Hospitals" in useEffect
React.useEffect(() => {
  if (isAllHospitals) {
    const allItems = mockHospitals.flatMap(h => generateMockItems(h.id));
    setItems(allItems);
  } else {
    setItems(generateMockItems(currentHospital.id));
  }
}, [currentHospital.id, isAllHospitals]);

// Step 6: Update subtitle
<p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
  Manage items for {isAllHospitals ? 'All Hospitals' : currentHospital.name}
</p>

// Step 7: Add HospitalSelector component
<HospitalSelector 
  userRole={userRole}
  selectedHospitalId={selectedHospitalId}
  onHospitalChange={setSelectedHospitalId}
/>

// Step 8: In App.tsx, pass userRole
<Component hospital={currentHospital} userRole={currentRole} />
```

---

## 📝 **IMPLEMENTATION LIST**

### 1. ✅ AppointmentManagement - DONE
- ✅ Hospital selector with "All Hospitals"
- ✅ filterByHospital for patients/doctors
- ✅ isAllHospitals for subtitle
- ✅ userRole passed in App.tsx

### 2. 🔄 DoctorManagement - Needs Refactoring
- ❌ Currently uses manual implementation
- ✅ Has userRole prop
- 🔄 **Action**: Replace manual code with reusable components

### 3. 🔄 PatientManagement - Needs Refactoring  
- ❌ Currently uses manual implementation
- ✅ Has userRole prop
- 🔄 **Action**: Replace manual code with reusable components

### 4. 🔄 LabTestManagementNew
- ❌ No hospital filtering yet
- ❌ userRole not passed in App.tsx
- 🔄 **Action**: Full implementation

### 5. 🔄 TestManagement
- ❌ No hospital filtering yet
- ❌ userRole not passed in App.tsx
- 🔄 **Action**: Full implementation

### 6. 🔄 ManufacturerManagement
- ❌ No hospital filtering yet
- ❌ userRole not passed in App.tsx
- 🔄 **Action**: Full implementation

### 7. 🔄 MedicineTypeManagement
- ❌ No hospital filtering yet
- ❌ userRole not passed in App.tsx
- 🔄 **Action**: Full implementation

### 8. 🔄 PrescriptionList
- ❌ No hospital filtering yet
- ✅ userRole already passed in App.tsx
- 🔄 **Action**: Full implementation

---

## 🎯 **App.tsx Updates Needed**

```typescript
case 'lab-tests':
  return <LabTestManagementNew hospital={currentHospital} userRole={currentRole} currentUserId={currentUser.email} />;

case 'test-management':
  return <TestManagement hospital={currentHospital} userRole={currentRole} />;

case 'manufacturers':
  return <ManufacturerManagement hospital={currentHospital} userRole={currentRole} />;

case 'medicine-types':
  return <MedicineTypeManagement hospital={currentHospital} userRole={currentRole} />;

// PrescriptionList already has userRole ✅
```

---

## ⚡ **Implementation Order (Recommended)**

1. LabTestManagementNew (Complex - Lab module)
2. PrescriptionList (Complex - View all prescriptions)
3. TestManagement (Medium - Test definitions)
4. ManufacturerManagement (Simple - Lookup table)
5. MedicineTypeManagement (Simple - Lookup table)
6. DoctorManagement (Refactor to reusable)
7. PatientManagement (Refactor to reusable)

---

## 📚 **Reference**

- **Working Example**: `/src/app/components/AppointmentManagement.tsx`
- **Reusable Component**: `/src/app/components/HospitalSelector.tsx`
- **Documentation**: This file

---

**Est. Time**: 30-40 minutes for all 7 modules
