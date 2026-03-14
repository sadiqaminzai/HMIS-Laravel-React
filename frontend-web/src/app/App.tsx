import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { SettingsProvider } from './context/SettingsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HospitalProvider, useHospitals } from './context/HospitalContext';
import { DoctorProvider } from './context/DoctorContext';
import { PatientProvider } from './context/PatientContext';
import { AppointmentProvider } from './context/AppointmentContext';
import { ManufacturerProvider } from './context/ManufacturerContext';
import { MedicineTypeProvider } from './context/MedicineTypeContext';
import { MedicineProvider } from './context/MedicineContext';
import { SupplierProvider } from './context/SupplierContext';
import { TransactionProvider } from './context/TransactionContext';
import { StockProvider } from './context/StockContext';
import { ExpenseCategoryProvider } from './context/ExpenseCategoryContext';
import { ExpenseProvider } from './context/ExpenseContext';
import { LandingThemeProvider } from './contexts/LandingThemeContext';
import { LandingLanguageProvider } from './contexts/LandingLanguageContext';
import { PrescriptionProvider } from './context/PrescriptionContext';
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
import { SupplierManagement } from './components/SupplierManagement';
import { TransactionManagement } from './components/TransactionManagement';
import { StockManagement } from './components/StockManagement';
import { AppointmentManagement } from './components/AppointmentManagement';
import { LabTestManagementNew } from './components/LabTestManagementNew';
import { TestManagement } from './components/TestManagement';
import { PrescriptionCreate } from './components/PrescriptionCreate';
import { PrescriptionList } from './components/PrescriptionList';
import { MedicineSetManagement } from './components/MedicineSetManagement';
import { UserManagement } from './components/UserManagement';
import { RoleManagement } from './components/RoleManagement';
import { PermissionManagement } from './components/PermissionManagement';
import { Settings } from './components/Settings';
import { GeneralSettings } from './components/GeneralSettings';
import { BackupManagement } from './components/BackupManagement';
import { ContactMessages } from './components/ContactMessages';
import { Reports } from './components/Reports';
import { ExpenseCategories } from './components/ExpenseCategories';
import { ExpenseManagement } from './components/ExpenseManagement';
import { ExpenseReport } from './components/ExpenseReport';
import { RequirePermission } from './components/RequirePermission';
import { LicenseExpiryWarning } from './components/LicenseExpiryWarning';
import { LicenseExpired } from './components/LicenseExpired';
import { VerificationRoutes } from './components/verification/VerificationRoutes';
import { UserRole, Hospital } from './types';
import { useLicenseCheck, shouldShowWarningToday, markWarningShownToday } from './hooks/useLicenseCheck';
import api from '../api/axios';
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
  const { user, isAuthenticated, authLoading, logout } = useAuth();
  const { hospitals, getHospital, loading, refresh } = useHospitals();
  const location = useLocation();
  const [currentHospital, setCurrentHospital] = useState<Hospital | null>(hospitals[0] || null);
  const [myHospitalLoading, setMyHospitalLoading] = useState(false);
  const [showLicenseWarning, setShowLicenseWarning] = useState(false);
  const [isRTL, setIsRTL] = useState(false);
  const shouldShowUserLoading = isAuthenticated && !user;

  // Update currentHospital when hospitals context changes (e.g. color update)
  useEffect(() => {
    if (currentHospital) {
      const updated = getHospital(currentHospital.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(currentHospital)) {
        setCurrentHospital(updated);
      }
    } else if (hospitals.length > 0) {
      // If nothing selected yet but hospitals loaded, pick the first as a safe default
      setCurrentHospital(hospitals[0]);
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
        setCurrentHospital(hospitals[0] || null);
      }
    }
  }, [user, hospitals, currentHospital]);

  // Bootstrap current hospital for tenant users even if they cannot access the hospitals directory.
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (user.role === 'super_admin') return;
    if (!user.hospitalId) return;
    if (currentHospital) return;

    let cancelled = false;
    setMyHospitalLoading(true);

    api
      .get('/my-hospital')
      .then((res) => {
        if (cancelled) return;
        const h = res.data;
        if (!h) return;
        const mapped: Hospital = {
          id: String(h.id),
          name: h.name,
          code: h.code ?? h.slug ?? '',
          address: h.address ?? '',
          phone: h.phone ?? '',
          email: h.email ?? '',
          license: h.license ?? '',
          licenseIssueDate: h.license_issue_date ?? '',
          licenseExpiryDate: h.license_expiry_date ?? '',
          status: (h.status ?? 'active') as Hospital['status'],
          logo: h.logo_url ?? h.logo_path ?? '',
          brandColor: h.brand_color ?? '#2563eb',
          createdAt: h.created_at ? new Date(h.created_at) : undefined,
        };
        setCurrentHospital(mapped);
      })
      .catch(() => {
        // Best-effort; UI will show "No hospital assigned" if needed.
      })
      .finally(() => {
        if (!cancelled) setMyHospitalLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user, currentHospital]);

  // After authentication, re-fetch hospitals (initial fetch may have happened without token)
  useEffect(() => {
    if (isAuthenticated) {
      refresh();
    }
    // refresh is intentionally omitted from deps to avoid repeated calls
    // due to function identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Handle RTL for Pashto, Dari, and Arabic
  useEffect(() => {
    const updateDirection = (lng: string) => {
      const normalized = String(lng || '').toLowerCase();
      const rtl = ['ps', 'fa', 'ar'].some((code) => normalized.startsWith(code));
      const dir = rtl ? 'rtl' : 'ltr';
      document.documentElement.setAttribute('dir', dir);
      document.documentElement.setAttribute('lang', normalized || 'en');
      document.body?.setAttribute('dir', dir);
      setIsRTL(rtl);
    };

    updateDirection(i18n.language);
    i18n.on('languageChanged', updateDirection);
    return () => {
      i18n.off('languageChanged', updateDirection);
    };
  }, [i18n]);

  // Check and show license expiry warning (only once per day, 10 days or less remaining)
  useEffect(() => {
    if (
      user &&
      user.role !== 'super_admin' &&
      user.hospitalId &&
      currentHospital &&
      licenseStatus.isExpiringSoon &&
      !licenseStatus.isExpired &&
      shouldShowWarningToday(currentHospital.id)
    ) {
      setShowLicenseWarning(true);
    }
  }, [user, licenseStatus, currentHospital]);

  // Handle license warning close
  const handleLicenseWarningClose = () => {
    setShowLicenseWarning(false);
    if (currentHospital) {
      markWarningShownToday(currentHospital.id);
    }
  };

  if (location.pathname.startsWith('/verify/')) {
    return <VerificationRoutes />;
  }

  // While auth is resolving (refresh), avoid redirect flicker
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Restoring your session...</p>
        </div>
      </div>
    );
  }

  // Safety check: if user is null but isAuthenticated is true (shouldn't happen normally)
  if (shouldShowUserLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated || !user) {
    return <Login />;
  }

  // If hospitals directory hasn't resolved yet, don't hard-block the entire app.
  // Non-super-admin users may not have access to the full hospitals list endpoint.
  // We can still render the app if the user's hospitalId is known.
  if (!currentHospital) {
    if (loading || myHospitalLoading) {
      return (
        <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading hospitals...</p>
          </div>
        </div>
      );
    }

    // Not loading anymore, but we still don't have a hospital.
    const msg = user?.hospitalId
      ? 'Failed to load your hospital. Please try again.'
      : 'No hospital assigned to this account.';

    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="text-center space-y-4">
          <p className="text-gray-700 dark:text-gray-200 font-medium">{msg}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                // Retry both: directory (for super admin) and my-hospital bootstrap.
                refresh();
                setCurrentHospital(null);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
            >
              Retry
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-semibold dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
            >
              Logout
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Ask Super Admin to assign a hospital if needed.</p>
        </div>
      </div>
    );
  }

  // Check if license is expired (only for non-super admin users)
  if (
    user.role !== 'super_admin' &&
    user.hospitalId &&
    currentHospital &&
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
    <div className={`flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden ${isRTL ? 'flex-row-reverse' : ''}`}>
      
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
            {/* Default to dashboard after login */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <RequirePermission anyOf={["view_dashboard"]}>
                  <Dashboard role={currentRole} hospital={currentHospital} />
                </RequirePermission>
              }
            />
            <Route
              path="/hospitals"
              element={
                <RequirePermission anyOf={["view_hospitals", "add_hospitals", "edit_hospitals", "delete_hospitals", "export_hospitals", "print_hospitals", "manage_hospitals"]}>
                  <HospitalManagement userRole={currentRole} />
                </RequirePermission>
              }
            />
            <Route
              path="/doctors"
              element={
                <RequirePermission anyOf={["view_doctors", "add_doctors", "edit_doctors", "delete_doctors", "export_doctors", "print_doctors", "manage_doctors"]}>
                  <DoctorManagement hospital={currentHospital} userRole={currentRole} />
                </RequirePermission>
              }
            />
            <Route
              path="/patients"
              element={
                <RequirePermission anyOf={["view_patients", "add_patients", "edit_patients", "delete_patients", "export_patients", "print_patients", "manage_patients", "register_patients"]}>
                  <PatientManagement hospital={currentHospital} userRole={currentRole} currentUser={currentUser} />
                </RequirePermission>
              }
            />
            <Route
              path="/manufacturers"
              element={
                <RequirePermission anyOf={["view_manufacturers", "add_manufacturers", "edit_manufacturers", "delete_manufacturers", "export_manufacturers", "print_manufacturers", "manage_manufacturers"]}>
                  <ManufacturerManagement hospital={currentHospital} userRole={currentRole} />
                </RequirePermission>
              }
            />
            <Route
              path="/medicines"
              element={
                <RequirePermission anyOf={["view_medicines", "add_medicines", "edit_medicines", "delete_medicines", "export_medicines", "print_medicines", "manage_medicines", "dispense_medicines"]}>
                  <MedicineManagement hospital={currentHospital} userRole={currentRole} />
                </RequirePermission>
              }
            />
            <Route
              path="/medicine-types"
              element={
                <RequirePermission anyOf={["view_medicine_types", "add_medicine_types", "edit_medicine_types", "delete_medicine_types", "export_medicine_types", "print_medicine_types", "manage_medicine_types"]}>
                  <MedicineTypeManagement hospital={currentHospital} userRole={currentRole} />
                </RequirePermission>
              }
            />
            <Route
              path="/suppliers"
              element={
                <RequirePermission anyOf={["view_suppliers", "add_suppliers", "edit_suppliers", "delete_suppliers", "export_suppliers", "print_suppliers", "manage_suppliers"]}>
                  <SupplierManagement hospital={currentHospital} userRole={currentRole} />
                </RequirePermission>
              }
            />
            <Route
              path="/transactions"
              element={
                <RequirePermission anyOf={["view_transactions", "add_transactions", "edit_transactions", "delete_transactions", "export_transactions", "print_transactions", "manage_transactions"]}>
                  <TransactionManagement hospital={currentHospital} userRole={currentRole} />
                </RequirePermission>
              }
            />
            <Route
              path="/stocks"
              element={
                <RequirePermission anyOf={["view_stocks", "add_stocks", "edit_stocks", "delete_stocks", "export_stocks", "print_stocks", "manage_stocks"]}>
                  <StockManagement hospital={currentHospital} userRole={currentRole} />
                </RequirePermission>
              }
            />
            <Route
              path="/appointments"
              element={
                <RequirePermission anyOf={["view_appointments", "add_appointments", "edit_appointments", "delete_appointments", "export_appointments", "print_appointments", "manage_appointments", "schedule_appointments", "update_appointment_status"]}>
                  <AppointmentManagement hospital={currentHospital} userRole={currentRole} currentUser={currentUser} />
                </RequirePermission>
              }
            />
            <Route
              path="/lab-tests"
              element={
                <RequirePermission anyOf={["view_lab_orders", "add_lab_orders", "edit_lab_orders", "delete_lab_orders", "export_lab_orders", "print_lab_orders", "manage_lab_orders", "update_lab_order_status", "enter_lab_results", "manage_lab_payments"]}>
                  <LabTestManagementNew hospital={currentHospital} userRole={currentRole} currentUserId={currentUser.doctorId || currentUser.id} />
                </RequirePermission>
              }
            />
            <Route
              path="/test-management"
              element={
                <RequirePermission anyOf={["view_test_templates", "add_test_templates", "edit_test_templates", "delete_test_templates", "export_test_templates", "print_test_templates", "manage_test_templates"]}>
                  <TestManagement hospital={currentHospital} userRole={currentRole} />
                </RequirePermission>
              }
            />
            <Route
              path="/prescriptions/create"
              element={
                <RequirePermission anyOf={["create_prescription", "add_prescriptions", "edit_prescriptions", "manage_prescriptions"]}>
                  <PrescriptionCreate hospital={currentHospital} currentUser={currentUser} />
                </RequirePermission>
              }
            />
            <Route
              path="/prescriptions"
              element={
                <RequirePermission anyOf={["view_prescriptions", "add_prescriptions", "edit_prescriptions", "delete_prescriptions", "export_prescriptions", "print_prescriptions", "manage_prescriptions", "create_prescription"]}>
                  <PrescriptionList hospital={currentHospital} userRole={currentRole} currentUser={currentUser} />
                </RequirePermission>
              }
            />
            <Route
              path="/settings/treatment-sets"
              element={
                <RequirePermission anyOf={["view_treatment_sets", "add_treatment_sets", "edit_treatment_sets", "delete_treatment_sets", "manage_treatment_sets", "add_prescriptions", "edit_prescriptions", "delete_prescriptions", "manage_prescriptions"]}>
                  <MedicineSetManagement hospital={currentHospital} userRole={currentRole} />
                </RequirePermission>
              }
            />
            <Route
              path="/users"
              element={
                <RequirePermission anyOf={["view_users", "add_users", "edit_users", "delete_users", "export_users", "print_users", "manage_users"]}>
                  <UserManagement hospital={currentHospital} userRole={currentRole} />
                </RequirePermission>
              }
            />
            <Route
              path="/settings/users"
              element={
                <RequirePermission anyOf={["view_users", "add_users", "edit_users", "delete_users", "export_users", "print_users", "manage_users"]}>
                  <UserManagement hospital={currentHospital} userRole={currentRole} />
                </RequirePermission>
              }
            />
            <Route
              path="/settings/roles"
              element={
                <RequirePermission anyOf={["view_roles", "add_roles", "edit_roles", "delete_roles", "manage_roles"]}>
                  <RoleManagement hospital={currentHospital} userRole={currentRole} />
                </RequirePermission>
              }
            />
            <Route
              path="/settings/permissions"
              element={
                <RequirePermission anyOf={["view_permissions", "add_permissions", "edit_permissions", "delete_permissions", "import_permissions", "manage_permissions"]}>
                  <PermissionManagement hospital={currentHospital} userRole={currentRole} />
                </RequirePermission>
              }
            />
            <Route
              path="/settings"
              element={
                <RequirePermission
                  anyOf={[
                    "view_users",
                    "add_users",
                    "edit_users",
                    "delete_users",
                    "manage_users",
                    "view_roles",
                    "add_roles",
                    "edit_roles",
                    "delete_roles",
                    "manage_roles",
                    "view_permissions",
                    "add_permissions",
                    "edit_permissions",
                    "delete_permissions",
                    "manage_permissions",
                    "view_hospital_settings",
                    "add_hospital_settings",
                    "edit_hospital_settings",
                    "delete_hospital_settings",
                    "manage_hospital_settings",
                    "view_contact_messages",
                    "edit_contact_messages",
                    "delete_contact_messages",
                    "manage_contact_messages",
                    "view_backups",
                    "add_backups",
                    "edit_backups",
                    "delete_backups",
                    "export_backups",
                    "manage_backups",
                  ]}
                >
                  <Settings />
                </RequirePermission>
              }
            />
            <Route
              path="/settings/general"
              element={
                <RequirePermission anyOf={["view_hospital_settings", "add_hospital_settings", "edit_hospital_settings", "delete_hospital_settings", "manage_hospital_settings"]}>
                  <GeneralSettings hospital={currentHospital} userRole={currentRole} />
                </RequirePermission>
              }
            />
            <Route
              path="/settings/backups"
              element={
                <RequirePermission anyOf={["view_backups", "add_backups", "edit_backups", "delete_backups", "export_backups", "manage_backups", "view_hospital_settings", "manage_hospital_settings"]}>
                  <BackupManagement hospital={currentHospital} userRole={currentRole} />
                </RequirePermission>
              }
            />
            <Route
              path="/contact-messages"
              element={
                <RequirePermission anyOf={["view_contact_messages", "edit_contact_messages", "delete_contact_messages", "manage_contact_messages"]}>
                  <ContactMessages />
                </RequirePermission>
              }
            />
            <Route
              path="/reports"
              element={
                <RequirePermission anyOf={["view_reports", "add_reports", "edit_reports", "delete_reports", "export_reports", "print_reports", "manage_reports"]}>
                  <Reports hospital={currentHospital} userRole={currentRole} />
                </RequirePermission>
              }
            />
            <Route
              path="/expenses/categories"
              element={
                <RequirePermission anyOf={["view_expense_categories", "add_expense_categories", "edit_expense_categories", "delete_expense_categories", "export_expense_categories", "print_expense_categories", "manage_expense_categories"]}>
                  <ExpenseCategories hospital={currentHospital} userRole={currentRole} />
                </RequirePermission>
              }
            />
            <Route
              path="/expenses/entries"
              element={
                <RequirePermission anyOf={["view_expenses", "add_expenses", "edit_expenses", "delete_expenses", "export_expenses", "print_expenses", "manage_expenses"]}>
                  <ExpenseManagement hospital={currentHospital} userRole={currentRole} />
                </RequirePermission>
              }
            />
            <Route
              path="/expenses/report"
              element={
                <RequirePermission anyOf={["view_expenses", "add_expenses", "edit_expenses", "delete_expenses", "export_expenses", "print_expenses", "manage_expenses"]}>
                  <ExpenseReport hospital={currentHospital} userRole={currentRole} />
                </RequirePermission>
              }
            />
            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HospitalProvider>
          <DoctorProvider>
            <PatientProvider>
              <SettingsProvider>
                <LandingThemeProvider>
                  <LandingLanguageProvider>
                    <ManufacturerProvider>
                      <MedicineTypeProvider>
                        <MedicineProvider>
                          <SupplierProvider>
                            <TransactionProvider>
                              <StockProvider>
                                <ExpenseCategoryProvider>
                                  <ExpenseProvider>
                                    <PrescriptionProvider>
                                      <AppointmentProvider>
                                        <BrowserRouter basename={import.meta.env.BASE_URL}>
                                          <Toaster richColors closeButton position="top-right" />
                                          <AppContent />
                                        </BrowserRouter>
                                      </AppointmentProvider>
                                    </PrescriptionProvider>
                                  </ExpenseProvider>
                                </ExpenseCategoryProvider>
                              </StockProvider>
                            </TransactionProvider>
                          </SupplierProvider>
                        </MedicineProvider>
                      </MedicineTypeProvider>
                    </ManufacturerProvider>
                  </LandingLanguageProvider>
                </LandingThemeProvider>
              </SettingsProvider>
            </PatientProvider>
          </DoctorProvider>
        </HospitalProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}