import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { SettingsProvider } from './context/SettingsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HospitalProvider, useHospitals } from './context/HospitalContext';
import { LandingThemeProvider } from './contexts/LandingThemeContext';
import { LandingLanguageProvider } from './contexts/LandingLanguageContext';
import { LandingPage } from './components/LandingPage';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { HospitalManagement } from './components/HospitalManagement';
import { DoctorManagement } from './components/DoctorManagement';
import { PatientManagement } from './components/PatientManagement';
import { ManufacturerManagement } from './components/ManufacturerManagement';
import { MedicineTypeManagement } from './components/MedicineTypeManagement';
import { MedicineManagement } from './components/MedicineManagement';
import { AppointmentManagement } from './components/AppointmentManagement';
import { LabTestManagementNew } from './components/LabTestManagementNew';
import { TestManagement } from './components/TestManagement';
import { PrescriptionCreate } from './components/PrescriptionCreate';
import { PrescriptionList } from './components/PrescriptionList';
import { UserManagement } from './components/UserManagement';
import { RoleManagement } from './components/RoleManagement';
import { PermissionManagement } from './components/PermissionManagement';
import { Settings } from './components/Settings';
import { GeneralSettings } from './components/GeneralSettings';
import { ContactMessages } from './components/ContactMessages';
import { Reports } from './components/Reports';
import { LicenseExpiryWarning } from './components/LicenseExpiryWarning';
import { LicenseExpired } from './components/LicenseExpired';
import { UserRole, Hospital } from './types';
import { useLicenseCheck } from './hooks/useLicenseCheck';
import '../i18n/config';

// Suppress ReactQuill findDOMNode deprecation warning (known library issue)
const originalError = console.error;
console.error = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('findDOMNode is deprecated')) {
    return;
  }
  originalError.call(console, ...args);
};

function AppContent() {
  const { i18n } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const { hospitals, getHospital } = useHospitals();
  const [showLanding, setShowLanding] = useState(true);
  const [currentHospital, setCurrentHospital] = useState<Hospital>(hospitals[0]);
  const [showLicenseWarning, setShowLicenseWarning] = useState(false);

  // Safety check: if user is null but isAuthenticated is true (shouldn't happen normally)
  // This can happen during hot reload
  if (isAuthenticated && !user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Update currentHospital when hospitals context changes (e.g. color update)
  useEffect(() => {
    if (currentHospital) {
      const updated = getHospital(currentHospital.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(currentHospital)) {
        setCurrentHospital(updated);
      }
    }
  }, [hospitals, getHospital, currentHospital]);

  // Check license status for current hospital (only for non-super admin users)
  const licenseStatus = useLicenseCheck(
    user && user.role !== 'super_admin' && user.hospitalId ? currentHospital : null
  );

  // Set current hospital based on logged-in user
  useEffect(() => {
    if (user && user.hospitalId) {
      const hospital = hospitals.find(h => h.id === user.hospitalId);
      if (hospital) {
        setCurrentHospital(hospital);
      }
    } else if (user && user.role === 'super_admin') {
      // Super admin can access all hospitals, default to first one if not set
      // Only set initial default if we don't have one or if it's not in the list
      if (!currentHospital || !hospitals.find(h => h.id === currentHospital.id)) {
        setCurrentHospital(hospitals[0]);
      }
    }
  }, [user, hospitals]);

  // Hide landing page once user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setShowLanding(false);
    }
  }, [isAuthenticated]);

  // Handle RTL for Pashto, Dari, and Arabic
  useEffect(() => {
    const isRTL = ['ps', 'fa', 'ar'].includes(i18n.language);
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  // Check and show license expiry warning (15 days before expiry)
  useEffect(() => {
    if (
      user &&
      user.role !== 'super_admin' &&
      user.hospitalId &&
      licenseStatus.isExpiringSoon &&
      !licenseStatus.isExpired
    ) {
      // Show warning every time on login during the warning period
      setShowLicenseWarning(true);
    }
  }, [user, licenseStatus]);

  // Handle license warning close
  const handleLicenseWarningClose = () => {
    setShowLicenseWarning(false);
  };

  // Show landing page first
  if (showLanding && !isAuthenticated) {
    return <LandingPage onGetStarted={() => setShowLanding(false)} />;
  }

  // Show login if not authenticated
  if (!isAuthenticated || !user) {
    return <Login />;
  }

  // Check if license is expired (only for non-super admin users)
  if (
    user.role !== 'super_admin' &&
    user.hospitalId &&
    licenseStatus.isExpired
  ) {
    return (
      <LicenseExpired
        expiryDate={licenseStatus.expiryDate}
        hospitalName={currentHospital.name}
        onLogout={logout}
      />
    );
  }

  const currentRole = user.role;
  const currentUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    doctorId: user.doctorId
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      
      {/* License Expiry Warning Modal */}
      {showLicenseWarning && (
        <LicenseExpiryWarning
          expiryDate={licenseStatus.expiryDate}
          daysRemaining={licenseStatus.daysRemaining}
          onClose={handleLicenseWarningClose}
        />
      )}
      
      <Sidebar
        role={currentRole}
        onLogout={logout}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header
          user={currentUser}
          hospital={currentHospital}
          role={currentRole}
          onRoleChange={() => {}} // Role changes are now handled by login
          onHospitalChange={setCurrentHospital}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50 dark:bg-gray-900 p-3">
          <Routes>
            <Route path="/" element={<Dashboard role={currentRole} hospital={currentHospital} />} />
            <Route path="/hospitals" element={<HospitalManagement />} />
            <Route path="/doctors" element={<DoctorManagement hospital={currentHospital} userRole={currentRole} />} />
            <Route path="/patients" element={<PatientManagement hospital={currentHospital} userRole={currentRole} currentUser={currentUser} />} />
            <Route path="/manufacturers" element={<ManufacturerManagement hospital={currentHospital} userRole={currentRole} />} />
            <Route path="/medicines" element={<MedicineManagement hospital={currentHospital} userRole={currentRole} />} />
            <Route path="/medicine-types" element={<MedicineTypeManagement hospital={currentHospital} userRole={currentRole} />} />
            <Route path="/appointments" element={<AppointmentManagement hospital={currentHospital} userRole={currentRole} currentUser={currentUser} />} />
            <Route path="/my-appointments" element={<AppointmentManagement hospital={currentHospital} userRole={currentRole} currentUser={currentUser} />} />
            <Route path="/lab-tests" element={<LabTestManagementNew hospital={currentHospital} userRole={currentRole} currentUserId={currentUser.email} />} />
            <Route path="/test-management" element={<TestManagement hospital={currentHospital} userRole={currentRole} />} />
            <Route path="/prescriptions/create" element={<PrescriptionCreate hospital={currentHospital} currentUser={currentUser} />} />
            <Route path="/prescriptions" element={<PrescriptionList hospital={currentHospital} userRole={currentRole} currentUser={currentUser} />} />
            <Route path="/users" element={<UserManagement hospital={currentHospital} userRole={currentRole} />} />
            <Route path="/settings/users" element={<UserManagement hospital={currentHospital} userRole={currentRole} />} />
            <Route path="/settings/roles" element={<RoleManagement hospital={currentHospital} userRole={currentRole} />} />
            <Route path="/settings/permissions" element={<PermissionManagement hospital={currentHospital} userRole={currentRole} />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/general" element={<GeneralSettings hospital={currentHospital} userRole={currentRole} />} />
            <Route path="/contact-messages" element={<ContactMessages />} />
            <Route path="/reports" element={<Reports hospital={currentHospital} userRole={currentRole} />} />
            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <HospitalProvider>
        <AuthProvider>
          <SettingsProvider>
            <LandingThemeProvider>
              <LandingLanguageProvider>
                <BrowserRouter>
                  <Toaster richColors closeButton />
                  <AppContent />
                </BrowserRouter>
              </LandingLanguageProvider>
            </LandingThemeProvider>
          </SettingsProvider>
        </AuthProvider>
      </HospitalProvider>
    </ThemeProvider>
  );
}