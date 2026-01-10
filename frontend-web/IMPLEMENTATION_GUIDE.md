# Doctor Prescription System - Enterprise Enhancement Implementation Guide

## ✅ COMPLETED FEATURES

### 1. Core Infrastructure
- ✅ **i18n Configuration** (`/src/i18n/config.ts`)
  - Multi-language support: English, Pashto, Dari, Arabic
  - RTL support for Arabic/Pashto/Dari
  - Translation resources with common terms, navigation, and module-specific text

- ✅ **Theme Context** (`/src/app/context/ThemeContext.tsx`)
  - Light/Dark theme switching
  - Persistent theme storage
  - CSS class-based theme application

- ✅ **Settings Context** (`/src/app/context/SettingsContext.tsx`)
  - Date format support (Gregorian & Hijri Shamsi)
  - Persistent settings storage
  - Global settings management

- ✅ **Print Styles** (`/src/styles/print.css`)
  - A4 page format
  - Hide UI elements during print
  - Black & white optimization
  - Print-specific layout

### 2. Reusable Components
- ✅ **Modal Component** (`/src/app/components/shared/Modal.tsx`)
  - Desktop centered modal
  - Mobile slide-up modal
  - Sticky header/footer
  - Keyboard support (Esc to close, Enter to submit)
  - Size variants (sm, md, lg, xl)
  - Smooth animations with Motion

- ✅ **ConfirmDialog** (`/src/app/components/shared/ConfirmDialog.tsx`)
  - Reusable confirmation dialog
  - Danger/Warning/Info variants
  - Customizable text
  - Clean UI with icons

- ✅ **ImageUpload** (`/src/app/components/shared/ImageUpload.tsx`)
  - Drag & drop support
  - Click to upload
  - Preview functionality
  - Avatar/Logo variants
  - Remove uploaded image

- ✅ **Toast Notifications** (`/src/app/utils/toast.ts`)
  - Success/Error/Info/Warning toasts
  - Top-right positioning
  - Auto-dismiss

### 3. Settings Module
- ✅ **Settings Page** (`/src/app/components/Settings.tsx`)
  - Theme switcher (Light/Dark)
  - Language switcher (EN/PS/FA/AR)
  - Date format selector
  - Visual feedback for selections
  - Only accessible to Super Admin & Hospital Admin

### 4. Type Updates
- ✅ Updated Hospital type with `logo` field
- ✅ Updated Doctor type with `image` field
- ✅ Updated Patient type with `image` field

### 5. App Integration
- ✅ Wrapped app with ThemeProvider
- ✅ Wrapped app with SettingsProvider
- ✅ Added Sonner Toaster
- ✅ Imported i18n config
- ✅ Added Settings route
- ✅ Updated Sidebar with Settings link
- ✅ Added dark mode support to Sidebar

## 🚧 TODO: CRITICAL ENHANCEMENTS NEEDED

### 1. Table Actions & CRUD Workflow

**Each management component needs:**
```typescript
// Example for HospitalManagement.tsx
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { Modal } from './shared/Modal';
import { ConfirmDialog } from './shared/ConfirmDialog';
import { toast } from '../utils/toast';

// State management
const [isViewModalOpen, setIsViewModalOpen] = useState(false);
const [isEditModalOpen, setIsEditModalOpen] = useState(false);
const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
const [selectedItem, setSelectedItem] = useState<Hospital | null>(null);

// Actions Column in Table
<td className="py-4 px-6">
  <div className="flex items-center gap-2 justify-end">
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleView(item)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
          >
            <Eye className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>View</TooltipContent>
      </Tooltip>
    </TooltipProvider>
    
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleEdit(item)}
            className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Edit</TooltipContent>
      </Tooltip>
    </TooltipProvider>
    
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleDelete(item)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Delete</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</td>
```

### 2. Modal Forms for Each Component

**View Modal** (Read-only):
```typescript
<Modal
  isOpen={isViewModalOpen}
  onClose={() => setIsViewModalOpen(false)}
  title="View Hospital Details"
  size="lg"
>
  {selectedItem && (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-sm font-medium text-gray-700">Hospital Name</label>
        <p className="mt-1 text-gray-900">{selectedItem.name}</p>
      </div>
      {/* More fields... */}
    </div>
  )}
</Modal>
```

**Edit/Add Modal** (Form):
```typescript
<Modal
  isOpen={isEditModalOpen}
  onClose={() => setIsEditModalOpen(false)}
  title={selectedItem ? "Edit Hospital" : "Add Hospital"}
  size="lg"
  footer={
    <div className="flex gap-3 justify-end">
      <button onClick={() => setIsEditModalOpen(false)} className="px-6 py-2.5 border border-gray-300 rounded-lg">
        Cancel
      </button>
      <button onClick={handleSubmit} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg">
        {selectedItem ? 'Update' : 'Save'}
      </button>
    </div>
  }
>
  <form className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-gray-700">Hospital Name</label>
      <input type="text" className="mt-1 w-full px-4 py-2 border rounded-lg" />
    </div>
    {/* More fields + ImageUpload component */}
    <ImageUpload
      type="logo"
      label="Hospital Logo"
      value={formData.logo}
      onChange={(value) => setFormData({...formData, logo: value})}
    />
  </form>
</Modal>
```

### 3. Components That Need CRUD Enhancement

Apply the above pattern to:
1. ✅ **HospitalManagement.tsx** (with logo upload)
2. ✅ **DoctorManagement.tsx** (with image upload)
3. ✅ **PatientManagement.tsx** (with image upload)
4. ✅ **ManufacturerManagement.tsx**
5. ✅ **MedicineManagement.tsx**
6. ✅ **UserManagement.tsx**
7. ✅ **PrescriptionList.tsx** (View only for prescriptions)

### 4. Responsive Design

**Mobile Hamburger Menu:**
```typescript
// In App.tsx or Header.tsx
const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

// Mobile menu button
<button
  className="lg:hidden p-2"
  onClick={() => setIsMobileSidebarOpen(true)}
>
  <Menu className="w-6 h-6" />
</button>

// Conditional sidebar rendering
<div className={`
  fixed inset-0 z-40 lg:static lg:z-0
  ${isMobileSidebarOpen ? 'block' : 'hidden lg:block'}
`}>
  <Sidebar ... />
</div>
```

**Table Responsiveness:**
```typescript
// Horizontal scroll on mobile
<div className="overflow-x-auto">
  <table className="min-w-full">
    {/* Table content */}
  </table>
</div>

// OR Card layout for mobile
<div className="lg:hidden space-y-4">
  {items.map(item => (
    <div className="bg-white rounded-lg border p-4">
      {/* Card layout */}
    </div>
  ))}
</div>
```

### 5. Date Formatting Utility

Create `/src/app/utils/dateFormat.ts`:
```typescript
import { useSettings } from '../context/SettingsContext';
import moment from 'moment-hijri';

export function useFormattedDate() {
  const { settings } = useSettings();

  const formatDate = (date: Date) => {
    if (settings.dateFormat === 'hijri_shamsi') {
      const m = moment(date);
      return m.format('iYYYY/iMM/iDD'); // Hijri format
    }
    return date.toLocaleDateString('en-US'); // Gregorian
  };

  return { formatDate };
}

// Usage in components
const { formatDate } = useFormattedDate();
<span>{formatDate(patient.createdAt)}</span>
```

### 6. Loading States

Add to each component:
```typescript
const [isLoading, setIsLoading] = useState(false);

{isLoading ? (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
) : (
  // Actual content
)}
```

### 7. Empty States

```typescript
{filteredItems.length === 0 && (
  <div className="text-center py-12">
    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
      <Icon className="w-8 h-8 text-gray-400" />
    </div>
    <h3 className="text-lg font-medium text-gray-900 mb-1">No items found</h3>
    <p className="text-gray-500">Get started by adding your first item.</p>
  </div>
)}
```

### 8. Header Enhancements

Update `/src/app/components/Header.tsx` to include:
- Theme toggle button
- Language dropdown
- User role badge
- Better dark mode support

### 9. Prescription Print Enhancement

Update `/src/app/components/PrescriptionPrint.tsx`:
```typescript
// Add print-content class
<div className="print-content">
  {/* Prescription content */}
  {/* Include hospital logo, doctor image, patient image */}
</div>

// Add print button
<button
  onClick={() => window.print()}
  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg print:hidden"
>
  Print Prescription
</button>
```

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Core CRUD (Priority: HIGH)
- [ ] Implement HospitalManagement with full CRUD modals
- [ ] Implement DoctorManagement with full CRUD modals + image upload
- [ ] Implement PatientManagement with full CRUD modals + image upload
- [ ] Implement ManufacturerManagement with full CRUD modals
- [ ] Implement MedicineManagement with full CRUD modals
- [ ] Implement UserManagement with full CRUD modals

### Phase 2: UX Enhancements (Priority: HIGH)
- [ ] Add tooltips to all action buttons
- [ ] Add loading states to all components
- [ ] Add empty states to all lists
- [ ] Add date formatting utility and apply system-wide
- [ ] Implement toast notifications for all actions

### Phase 3: Responsive Design (Priority: MEDIUM)
- [ ] Add mobile hamburger menu
- [ ] Make all tables horizontally scrollable on mobile
- [ ] Test all modals on mobile (slide-up behavior)
- [ ] Test theme switcher on all screen sizes
- [ ] Test language switcher RTL behavior

### Phase 4: Print & Advanced Features (Priority: MEDIUM)
- [ ] Enhance PrescriptionPrint with images (logo, doctor, patient)
- [ ] Test print functionality across browsers
- [ ] Verify print-only styles work correctly
- [ ] Add print preview option

### Phase 5: Polish & Testing (Priority: LOW)
- [ ] Add keyboard shortcuts (Ctrl+S to save, etc.)
- [ ] Add form validation with error messages
- [ ] Add success animations
- [ ] Test all role-based access controls
- [ ] Test all language translations
- [ ] Test date format switching
- [ ] Performance optimization

## 🎨 DESIGN TOKENS FOR DARK MODE

```typescript
// Primary colors stay same
bg-blue-600 dark:bg-blue-600
text-blue-600 dark:text-blue-400

// Backgrounds
bg-white dark:bg-gray-800
bg-gray-50 dark:bg-gray-900
bg-gray-100 dark:bg-gray-700

// Text
text-gray-900 dark:text-white
text-gray-700 dark:text-gray-300
text-gray-600 dark:text-gray-400
text-gray-500 dark:text-gray-500

// Borders
border-gray-200 dark:border-gray-700
border-gray-300 dark:border-gray-600

// Hover states
hover:bg-gray-50 dark:hover:bg-gray-700
hover:bg-blue-50 dark:hover:bg-blue-900/30
```

## 🚀 QUICK START FOR DEVELOPERS

1. **To add CRUD to a component:**
   - Copy Modal/ConfirmDialog imports
   - Add state management for modals
   - Create View/Edit/Add modal JSX
   - Add Actions column to table
   - Wire up event handlers
   - Add toast notifications

2. **To use ImageUpload:**
   ```typescript
   import { ImageUpload } from './shared/ImageUpload';
   
   <ImageUpload
     type="avatar" // or "logo"
     label="Profile Picture"
     value={formData.image}
     onChange={(value) => setFormData({...formData, image: value})}
   />
   ```

3. **To use Toast:**
   ```typescript
   import { toast } from '../utils/toast';
   
   toast.success('Item saved successfully!');
   toast.error('Failed to save item');
   ```

4. **To access theme/settings:**
   ```typescript
   import { useTheme } from '../context/ThemeContext';
   import { useSettings } from '../context/SettingsContext';
   
   const { theme, toggleTheme } = useTheme();
   const { settings, updateSettings } = useSettings();
   ```

## 📖 ADDITIONAL RESOURCES

- **Motion (Framer Motion)**: https://motion.dev/docs
- **Radix UI**: https://www.radix-ui.com/
- **i18next**: https://www.i18next.com/
- **React Dropzone**: https://react-dropzone.js.org/
- **Moment Hijri**: https://github.com/xsoh/moment-hijri

---

**Status:** Foundation Complete ✅ | CRUD Implementation Pending ⏳ | Testing Required 🧪
