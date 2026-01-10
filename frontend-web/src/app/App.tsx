import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { useTranslation } from 'react-i18next';
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
import { mockHospitals } from './data/mockData';
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
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [currentHospital, setCurrentHospital] = useState<Hospital>(hospitals[0]);
  const [showLicenseWarning, setShowLicenseWarning] = useState(false);
  const [editPrescriptionData, setEditPrescriptionData] = useState<any>(null);

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

  // Handle prescription editing
  const handleEditPrescription = (prescription: any) => {
    setEditPrescriptionData(prescription);
    setCurrentPage('create-prescription');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard role={currentRole} hospital={currentHospital} />;
      case 'hospitals':
        return <HospitalManagement />;
      case 'doctors':
        return <DoctorManagement hospital={currentHospital} userRole={currentRole} />;
      case 'patients':
        return <PatientManagement hospital={currentHospital} userRole={currentRole} currentUser={currentUser} />;
      case 'manufacturers':
        return <ManufacturerManagement hospital={currentHospital} userRole={currentRole} />;
      case 'medicines':
        return <MedicineManagement hospital={currentHospital} userRole={currentRole} />;
      case 'medicine-types':
        return <MedicineTypeManagement hospital={currentHospital} userRole={currentRole} />;
      case 'appointments':
        return <AppointmentManagement hospital={currentHospital} userRole={currentRole} currentUser={currentUser} />;
      case 'my-appointments':
        return <AppointmentManagement hospital={currentHospital} userRole={currentRole} currentUser={currentUser} />;
      case 'lab-tests':
        return <LabTestManagementNew hospital={currentHospital} userRole={currentRole} currentUserId={currentUser.email} />;
      case 'test-management':
        return <TestManagement hospital={currentHospital} userRole={currentRole} />;
      case 'create-prescription':
        return <PrescriptionCreate hospital={currentHospital} currentUser={currentUser} editPrescriptionData={editPrescriptionData} />;
      case 'prescriptions':
        return <PrescriptionList hospital={currentHospital} userRole={currentRole} currentUser={currentUser} onEditPrescription={handleEditPrescription} />;
      case 'users':
        return <UserManagement hospital={currentHospital} userRole={currentRole} />;
      case 'settings-users':
        return <UserManagement hospital={currentHospital} userRole={currentRole} />;
      case 'settings-roles':
        return <RoleManagement hospital={currentHospital} userRole={currentRole} />;
      case 'settings-permissions':
        return <PermissionManagement hospital={currentHospital} userRole={currentRole} />;
      case 'settings':
        return <Settings />;
      case 'settings-general':
        return <GeneralSettings hospital={currentHospital} userRole={currentRole} />;
      case 'contact-messages':
        return <ContactMessages />;
      case 'reports':
        return <Reports hospital={currentHospital} userRole={currentRole} />;
      default:
        return <Dashboard role={currentRole} hospital={currentHospital} />;
    }
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
        currentPage={currentPage}
        onNavigate={setCurrentPage}
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
          {renderPage()}
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
                <Toaster richColors closeButton />
                <AppContent />
              </LandingLanguageProvider>
            </LandingThemeProvider>
          </SettingsProvider>
        </AuthProvider>
      </HospitalProvider>
    </ThemeProvider>
  );
}