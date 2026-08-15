# Hospital Selection & Filtering - Implementation Guide for Super Admin

## ✅ **COMPLETED Components:**
1. ✅ DoctorManagement - Full hospital selection with filtering
2. ✅ UserManagement - Full hospital selection with filtering  
3. ✅ GeneralSettings - Full hospital selection with filtering

## 📋 **Pattern to Apply to Remaining Components:**

### **Components Requiring Update:**
1. PatientManagement
2. AppointmentManagement
3. ManufacturerManagement
4. MedicineTypeManagement
5. MedicineManagement
6. LabTestManagement
7. TestManagement
8. PrescriptionManagement (View All)
9. RoleManagement
10. PermissionManagement

---

## 🔧 **Step-by-Step Implementation Pattern:**

### **Step 1: Import Required Dependencies**
```typescript
import { Building2 } from 'lucide-react'; // Add to existing lucide imports
import { mockHospitals } from '../data/mockData'; // Add to existing imports
```

### **Step 2: Add Hospital Selection State**
```typescript
export function ComponentName({ hospital, userRole = 'admin' }: ComponentProps) {
  // ... existing useState declarations ...
  
  // ADD THIS: Hospital selection for super_admin
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>(hospital.id);
  const currentHospital = userRole === 'super_admin' 
    ? mockHospitals.find(h => h.id === selectedHospitalId) || hospital
    : hospital;
  
  // MODIFY existing state to use currentHospital.id:
  const [items, setItems] = useState(mockItems.filter(i => i.hospitalId === currentHospital.id));
```

### **Step 3: Update Data Filtering**
```typescript
// MODIFY existing filter to use currentHospital.id:
const hospitalFilteredItems = mockItems.filter(i => i.hospitalId === currentHospital.id);

const filteredItems = hospitalFilteredItems.filter(item =>
  item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  // ... other search criteria ...
);
```

### **Step 4: Add useEffect for Hospital Changes**
```typescript
// ADD THIS: Update items when hospital selection changes
React.useEffect(() => {
  setItems(mockItems.filter(i => i.hospitalId === currentHospital.id));
}, [currentHospital.id]);
```

### **Step 5: Update Title/Subtitle**
```typescript
<div>
  <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Component Title</h1>
  {/* MODIFY to use currentHospital.name: */}
  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
    Manage items for {currentHospital.name}
  </p>
</div>
```

### **Step 6: Add Hospital Selector UI (After Title Section)**
```typescript
{/* Hospital Selection - Only for Super Admin */}
{userRole === 'super_admin' && (
  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
    <div className="flex items-center gap-2 mb-2">
      <Building2 className="w-4 h-4 text-purple-500" />
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Select Hospital</h2>
    </div>
    <select
      value={selectedHospitalId}
      onChange={(e) => setSelectedHospitalId(e.target.value)}
      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
    >
      {mockHospitals.map(h => (
        <option key={h.id} value={h.id}>{h.name}</option>
      ))}
    </select>
  </div>
)}
```

### **Step 7: Update Create/Edit Operations**
```typescript
const handleSubmitAdd = (e: React.FormEvent) => {
  e.preventDefault();
  const newItem = {
    id: items.length + 1,
    hospitalId: currentHospital.id, // CHANGE from hospital.id to currentHospital.id
    // ... other fields ...
  };
  setItems([...items, newItem]);
  // ... rest of logic ...
};
```

---

## 🎯 **Complete Example (DoctorManagement - Reference)**

See `/src/app/components/DoctorManagement.tsx` for the complete working example with all patterns applied.

**Key Changes Made:**
1. ✅ Import `Building2` icon and `mockHospitals`
2. ✅ Add `selectedHospitalId` state
3. ✅ Add `currentHospital` computed value
4. ✅ Update data filtering to use `currentHospital.id`
5. ✅ Add `useEffect` to reload data on hospital change
6. ✅ Update title to show `currentHospital.name`
7. ✅ Add Hospital Selector UI block for `super_admin`
8. ✅ Update create/edit to use `currentHospital.id`

---

## 🎨 **UI Placement:**

The Hospital Selector should be placed:
- **After** the title/header section
- **Before** the search bar
- **Only visible** when `userRole === 'super_admin'`

```typescript
return (
  <div className="space-y-3">
    {/* Title */}
    <div>...</div>
    
    {/* Hospital Selector - SUPER ADMIN ONLY */}
    {userRole === 'super_admin' && (
      <div>...</div>
    )}
    
    {/* Search Bar */}
    <div>...</div>
    
    {/* Data Table */}
    <div>...</div>
  </div>
);
```

---

## 🔒 **Data Isolation Rules:**

### **For Super Admin:**
- Can switch between ANY hospital using the dropdown
- Sees all data for the selected hospital
- Can create/edit/delete in any hospital

### **For Admin & Other Roles:**
- Hospital selector is **HIDDEN**
- Automatically uses their assigned hospital (from `hospital` prop)
- Can only see/manage data for their own hospital

---

## 🧪 **Testing Checklist:**

For each component, verify:
- [ ] Super Admin sees hospital selector dropdown
- [ ] Admin/other roles do NOT see hospital selector
- [ ] Switching hospitals updates the data table
- [ ] Search works correctly within selected hospital
- [ ] Create new item assigns to correct hospital
- [ ] Edit item doesn't change hospital assignment
- [ ] Title shows correct hospital name
- [ ] No data leaks between hospitals

---

## 📝 **Notes:**

- Use purple theme (`text-purple-500`, `ring-purple-500`) for hospital selector
- Keep UI consistent across all components
- Ensure `currentHospital.id` is used everywhere, not `hospital.id`
- For components with related data (e.g., doctors in appointments), filter by `currentHospital.id`

---

**Implementation Status:**
- ✅ 3 components completed
- 🔄 10 components remaining
- 📊 ~23% complete
