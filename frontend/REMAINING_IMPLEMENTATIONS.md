# Remaining Hospital Filter Implementations

## ✅ COMPLETED (3/8):
1. ✅ **AppointmentManagement** - Hospital filtering + reusable HospitalSelector component working
2. ✅ **DoctorManagement** - Hospital filtering working
3. ✅ **PatientManagement** - Hospital filtering working

---

## 🔄 REMAINING (5/8):

### 1. **LabTestManagementNew** (Lab Tests)
### 2. **TestManagement** (Test Management - Laboratory)
### 3. **ManufacturerManagement** (Pharmacy > Manufacturers)
### 4. **MedicineTypeManagement** (Pharmacy > Medicine Types)
### 5. **PrescriptionList** (Prescriptions > View All)

---

## ⚡ REUSABLE PATTERN - Copy & Paste for Each Component:

### Step 1: Import the reusable components
```typescript
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { mockHospitals } from '../data/mockData';
```

### Step 2: Add userRole prop to interface (if not present)
```typescript
interface ComponentProps {
  hospital: Hospital;
  userRole?: UserRole; // ADD THIS
}
```

### Step 3: Use the custom hook at the top of the component
```typescript
export function ComponentName({ hospital, userRole = 'admin' }: ComponentProps) {
  // ADD THIS LINE - it handles all hospital filtering logic
  const { selectedHospitalId, setSelectedHospitalId, currentHospital } = useHospitalFilter(hospital, userRole);
  
  // Rest of your existing code...
```

### Step 4: Update data filtering to use currentHospital
```typescript
// BEFORE:
const [items, setItems] = useState(mockItems.filter(i => i.hospitalId === hospital.id));

// AFTER:
const [items, setItems] = useState(mockItems.filter(i => i.hospitalId === currentHospital.id));
```

### Step 5: Add useEffect to update data when hospital changes
```typescript
// ADD THIS after state declarations:
React.useEffect(() => {
  setItems(mockItems.filter(i => i.hospitalId === currentHospital.id));
}, [currentHospital.id]);
```

### Step 6: Update subtitle to show currentHospital name
```typescript
// BEFORE:
<p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
  Manage items for {hospital.name}
</p>

// AFTER:
<p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
  Manage items for {currentHospital.name}
</p>
```

### Step 7: Add HospitalSelector component in the render (after title, before search)
```typescript
return (
  <div className="space-y-3">
    {/* Title */}
    <div>...</div>
    
    {/* ADD THIS - Hospital Selector */}
    <HospitalSelector 
      userRole={userRole}
      selectedHospitalId={selectedHospitalId}
      onHospitalChange={setSelectedHospitalId}
    />
    
    {/* Search bar */}
    <div>...</div>
```

### Step 8: Update create/edit operations to use currentHospital.id
```typescript
// BEFORE:
hospitalId: hospital.id,

// AFTER:
hospitalId: currentHospital.id,
```

### Step 9: Update App.tsx to pass userRole prop
```typescript
// BEFORE:
case 'component-route':
  return <Component hospital={currentHospital} />;

// AFTER:
case 'component-route':
  return <Component hospital={currentHospital} userRole={currentRole} />;
```

---

## 🎯 PERFORMANCE BENEFITS:

### Reusable `HospitalSelector` Component:
- ✅ Single source of truth for UI
- ✅ Consistent design across all modules  
- ✅ Easy maintenance - update once, changes everywhere
- ✅ Smaller bundle size - component reused, not duplicated

### Custom `useHospitalFilter` Hook:
- ✅ Encapsulates hospital filtering logic
- ✅ Prevents code duplication
- ✅ Maintains performance with React.memo potential
- ✅ Clean separation of concerns

### Total Code Reduction:
- **Before**: ~30 lines per component × 8 components = ~240 lines
- **After**: 1 reusable component (25 lines) + 1 custom hook + minimal integration per component
- **Savings**: ~180 lines of code eliminated ✨
- **Performance**: Single component instance, optimized re-renders

---

## 📋 QUICK IMPLEMENTATION CHECKLIST:

For each remaining component, verify:
- [ ] Import `HospitalSelector` and `useHospitalFilter`  
- [ ] Import `mockHospitals`
- [ ] Add `userRole` to props interface
- [ ] Use `useHospitalFilter` hook
- [ ] Update data filtering to use `currentHospital.id`
- [ ] Add `useEffect` for hospital changes
- [ ] Update subtitle to show `currentHospital.name`
- [ ] Add `<HospitalSelector />` in render
- [ ] Update create/edit to use `currentHospital.id`
- [ ] Pass `userRole={currentRole}` in App.tsx

---

## 🚀 NEXT STEPS:

Implement the 5 remaining components using the reusable pattern above. Each implementation should take < 5 minutes!

**Files to modify:**
1. `/src/app/components/LabTestManagementNew.tsx`
2. `/src/app/components/TestManagement.tsx`
3. `/src/app/components/ManufacturerManagement.tsx`
4. `/src/app/components/MedicineTypeManagement.tsx`
5. `/src/app/components/PrescriptionList.tsx`
6. `/src/app/App.tsx` (add userRole props for all 5 components)

---

**Implementation Time Estimate**: 20-25 minutes total for all 5 remaining components
