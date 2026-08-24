import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, Calendar, BedDouble, Scissors, UserCheck, Stethoscope, Users, TestTube, FileText, Package, Factory, Pill, Receipt, Box, ClipboardList, FilePlus, List, BarChart, Settings, ChevronLeft, ChevronRight, ChevronDown, Sun, Moon, Globe, Sliders, MessageSquare, UserCog, Shield, Key, LogOut, Hospital, Database, Briefcase, ScanLine, LayoutTemplate, ShieldCheck, BadgeDollarSign, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UserRole } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  role: UserRole;
  onLogout: () => void;
}

interface MenuItem {
  id: string; // This will now be the route path
  translationKey: string;
  icon: React.ReactNode;
  anyPermissions?: string[];
  subItems?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    id: '/',
    translationKey: 'nav.dashboard',
    icon: <LayoutDashboard className="w-3.5 h-3.5" />,
    anyPermissions: ['view_dashboard']
  },
  {
    id: '/hospitals',
    translationKey: 'nav.hospitals',
    icon: <Building2 className="w-3.5 h-3.5" />,
    anyPermissions: ['view_hospitals', 'manage_hospitals']
  },
  {
    id: 'reception', // Group ID, not a route
    translationKey: 'nav.reception',
    icon: <UserCheck className="w-3.5 h-3.5" />,
    anyPermissions: ['view_reception_menu'],
    subItems: [
      {
        id: '/doctors',
        translationKey: 'nav.doctors',
        icon: <Stethoscope className="w-3.5 h-3.5" />,
        anyPermissions: ['view_doctors', 'manage_doctors']
      },
      {
        id: '/patients',
        translationKey: 'nav.patients',
        icon: <Users className="w-3.5 h-3.5" />,
        anyPermissions: ['view_patients', 'manage_patients', 'register_patients']
      },
      {
        id: '/appointments',
        translationKey: 'nav.appointments',
        icon: <Calendar className="w-3.5 h-3.5" />,
        anyPermissions: ['view_appointments', 'manage_appointments', 'schedule_appointments']
      },
      {
        // Rooms and room bookings live here as tabs.
        id: '/room-management',
        translationKey: 'nav.roomManagement',
        icon: <BedDouble className="w-3.5 h-3.5" />,
        anyPermissions: ['view_rooms', 'manage_rooms', 'view_room_bookings', 'manage_room_bookings']
      },
      {
        id: '/surgeries',
        translationKey: 'nav.surgeries',
        icon: <Scissors className="w-3.5 h-3.5" />,
        anyPermissions: ['view_surgery_types', 'manage_surgery_types', 'view_surgeries', 'manage_surgeries', 'view_patient_surgeries', 'manage_patient_surgeries']
      }
    ]
  },
  {
    id: 'laboratory', // Group ID
    translationKey: 'nav.laboratory',
    icon: <TestTube className="w-3.5 h-3.5" />,
    anyPermissions: ['view_laboratory_menu'],
    subItems: [
      {
        id: '/lab-tests',
        translationKey: 'nav.labTests',
        icon: <FileText className="w-3.5 h-3.5" />,
        anyPermissions: ['view_lab_orders', 'manage_lab_orders', 'enter_lab_results', 'manage_lab_payments']
      },
      {
        id: '/test-management',
        translationKey: 'nav.testManagement',
        icon: <TestTube className="w-3.5 h-3.5" />,
        anyPermissions: ['view_test_templates', 'manage_test_templates']
      }
    ]
  },
  {
    id: 'radiology', // Group ID
    translationKey: 'nav.radiology',
    icon: <ScanLine className="w-3.5 h-3.5" />,
    anyPermissions: [
      'view_radiology_menu',
      'view_ultrasound_exams', 'add_ultrasound_receipt', 'submit_ultrasound_result', 'delete_ultrasound_exams', 'manage_ultrasound_exams',
      'view_ultrasound_types', 'manage_ultrasound_types'
    ],
    subItems: [
      {
        // Reception's side of ultrasound. Its own entry because it belongs to a
        // different desk than the reporting screens -- a receptionist should
        // reach the bill without passing through the clinical list.
        id: '/ultrasound/receipts',
        translationKey: 'nav.ultrasoundReceipts',
        icon: <Receipt className="w-3.5 h-3.5" />,
        // Gated on the receipt/payment rights alone. It used to accept
        // manage_ultrasound_exams too, so a sonographer given the exam list
        // silently gained the cash desk beside it.
        anyPermissions: ['manage_ultrasound_payments', 'print_ultrasound_receipt']
      },
      {
        id: '/ultrasound/exams',
        translationKey: 'nav.ultrasound',
        icon: <ScanLine className="w-3.5 h-3.5" />,
        anyPermissions: [
          'view_ultrasound_exams', 'add_ultrasound_receipt', 'submit_ultrasound_result', 'delete_ultrasound_exams',
          'export_ultrasound_exams', 'print_ultrasound_exams', 'manage_ultrasound_exams'
        ]
      },
      {
        id: '/ultrasound/templates',
        translationKey: 'nav.ultrasoundTemplates',
        icon: <LayoutTemplate className="w-3.5 h-3.5" />,
        anyPermissions: ['view_ultrasound_types', 'manage_ultrasound_types']
      }
    ]
  },
  {
    id: 'pharmacy', // Group ID
    translationKey: 'nav.pharmacy',
    icon: <Package className="w-3.5 h-3.5" />,
    anyPermissions: ['view_pharmacy_menu'],
    subItems: [
      {
        // Medicines, types, manufacturers and suppliers live here as tabs.
        id: '/pharmacy-master',
        translationKey: 'nav.masterData',
        icon: <Factory className="w-3.5 h-3.5" />,
        anyPermissions: [
          'view_manufacturers', 'manage_manufacturers',
          'view_medicine_types', 'manage_medicine_types',
          'view_medicines', 'manage_medicines', 'dispense_medicines',
          'view_suppliers', 'manage_suppliers'
        ]
      },
      {
        id: '/transactions',
        translationKey: 'nav.transactions',
        icon: <Receipt className="w-3.5 h-3.5" />,
        anyPermissions: ['view_transactions', 'manage_transactions']
      },
      {
        // Stocks and stock adjustments live here as tabs.
        id: '/stock-control',
        translationKey: 'nav.stockControl',
        icon: <Box className="w-3.5 h-3.5" />,
        anyPermissions: ['view_stocks', 'manage_stocks', 'edit_stocks']
      }
    ]
  },
  {
    // Money, wherever it came from.
    //
    // Collection and settlement used to sit inside the modules that raise the
    // charges -- pharmacy invoices under Pharmacy, the collection desk under
    // Reception -- which suited whoever creates the document rather than
    // whoever handles the cash. A cashier works across all of them, and now has
    // one place to stand.
    id: 'finance', // Group ID, not a route
    translationKey: 'nav.finance',
    icon: <BadgeDollarSign className="w-3.5 h-3.5" />,
    anyPermissions: [
      'view_finance_menu',
      'view_finance_sales', 'view_finance_purchases',
      'view_finance_sales_returns', 'view_finance_purchase_returns',
      'record_finance_payments', 'edit_finance_payment_status', 'manage_finance',
      'manage_appointment_payments', 'manage_lab_payments', 'manage_ultrasound_payments',
      'manage_surgery_payments', 'manage_room_booking_payments'
    ],
    subItems: [
      {
        // Every unpaid charge in the hospital, in one queue.
        id: '/payment-collection',
        translationKey: 'nav.paymentCollection',
        icon: <Wallet className="w-3.5 h-3.5" />,
        anyPermissions: [
          'manage_appointment_payments', 'manage_lab_payments', 'manage_ultrasound_payments',
          'manage_surgery_payments', 'manage_room_booking_payments', 'record_finance_payments'
        ]
      },
      {
        // Paid / pending control over pharmacy documents, split per type.
        id: '/pharmacy-finance',
        translationKey: 'nav.pharmacyFinance',
        icon: <BadgeDollarSign className="w-3.5 h-3.5" />,
        anyPermissions: [
          'view_finance_menu',
          'view_finance_sales', 'view_finance_purchases',
          'view_finance_sales_returns', 'view_finance_purchase_returns',
          'record_finance_payments', 'edit_finance_payment_status', 'manage_finance'
        ]
      }
    ]
  },
  {
    id: 'prescription-menu', // Group ID
    translationKey: 'nav.prescriptions',
    icon: <ClipboardList className="w-3.5 h-3.5" />,
    anyPermissions: ['view_prescriptions_menu'],
    subItems: [
      {
        // The list page owns creation via its "+ Add Prescription" button,
        // matching the CRUD pattern used by every other module.
        id: '/prescriptions',
        translationKey: 'nav.prescriptions',
        icon: <List className="w-3.5 h-3.5" />,
        anyPermissions: ['view_prescriptions', 'manage_prescriptions', 'create_prescription', 'add_prescriptions']
      },
      {
        id: '/settings/treatment-sets',
        translationKey: 'nav.treatmentSets',
        icon: <Pill className="w-3.5 h-3.5" />,
        anyPermissions: ['view_treatment_sets', 'add_treatment_sets', 'edit_treatment_sets', 'delete_treatment_sets', 'manage_treatment_sets', 'add_prescriptions', 'edit_prescriptions', 'delete_prescriptions', 'manage_prescriptions']
      },
      {
        id: '/settings/prescription-diagnoses',
        translationKey: 'nav.prescriptionDiagnoses',
        icon: <FileText className="w-3.5 h-3.5" />,
        anyPermissions: ['view_prescription_diagnoses', 'add_prescription_diagnoses', 'edit_prescription_diagnoses', 'delete_prescription_diagnoses', 'manage_prescription_diagnoses', 'add_prescriptions', 'edit_prescriptions', 'delete_prescriptions', 'manage_prescriptions', 'create_prescription']
      }
    ]
  },
  {
    id: 'expenses',
    translationKey: 'nav.expenses',
    icon: <Receipt className="w-3.5 h-3.5" />,
    anyPermissions: ['view_expenses', 'manage_expenses', 'view_expense_categories', 'manage_expense_categories'],
    subItems: [
      {
        id: '/expenses/categories',
        translationKey: 'nav.expenseCategories',
        icon: <ClipboardList className="w-3.5 h-3.5" />,
        anyPermissions: ['view_expense_categories', 'manage_expense_categories']
      },
      {
        id: '/expenses/entries',
        translationKey: 'nav.expenseEntries',
        icon: <Receipt className="w-3.5 h-3.5" />,
        anyPermissions: ['view_expenses', 'manage_expenses']
      },
      {
        id: '/expenses/report',
        translationKey: 'nav.expenseReport',
        icon: <BarChart className="w-3.5 h-3.5" />,
        anyPermissions: ['view_expenses', 'manage_expenses']
      }
    ]
  },
  {
    id: 'other-income',
    translationKey: 'nav.otherIncome',
    icon: <Receipt className="w-3.5 h-3.5" />,
    anyPermissions: ['view_other_incomes', 'manage_other_incomes', 'view_other_income_categories', 'manage_other_income_categories'],
    subItems: [
      {
        id: '/other-income/categories',
        translationKey: 'nav.otherIncomeCategories',
        icon: <ClipboardList className="w-3.5 h-3.5" />,
        anyPermissions: ['view_other_income_categories', 'manage_other_income_categories']
      },
      {
        id: '/other-income/entries',
        translationKey: 'nav.otherIncomeEntries',
        icon: <Receipt className="w-3.5 h-3.5" />,
        anyPermissions: ['view_other_incomes', 'manage_other_incomes']
      },
      {
        id: '/other-income/report',
        translationKey: 'nav.otherIncomeReport',
        icon: <BarChart className="w-3.5 h-3.5" />,
        anyPermissions: ['view_other_incomes', 'manage_other_incomes']
      }
    ]
  },
  {
    id: 'reports-menu',
    translationKey: 'nav.reports',
    icon: <BarChart className="w-3.5 h-3.5" />,
    anyPermissions: ['view_reports', 'manage_reports', 'view_ledger', 'manage_ledger', 'export_ledger'],
    subItems: [
      {
        id: '/reports',
        translationKey: 'nav.reports',
        icon: <BarChart className="w-3.5 h-3.5" />,
        anyPermissions: ['view_reports', 'manage_reports']
      },
      {
        id: '/ledger',
        translationKey: 'nav.ledger',
        icon: <BarChart className="w-3.5 h-3.5" />,
        anyPermissions: ['view_ledger', 'manage_ledger', 'export_ledger']
      }
    ]
  },
  {
    id: 'hr-menu',
    translationKey: 'nav.hr',
    icon: <Briefcase className="w-3.5 h-3.5" />,
    anyPermissions: [
      'view_departments', 'manage_departments',
      'view_designations', 'manage_designations',
      'view_shifts', 'manage_shifts',
      'view_employees', 'manage_employees',
      'view_employee_attendances', 'manage_employee_attendances',
      'view_leave_requests', 'manage_leave_requests',
      'view_salary_structures', 'manage_salary_structures',
      'view_payroll_batches', 'manage_payroll_batches',
      'view_payroll_items', 'manage_payroll_items'
    ],
    subItems: [
      {
        id: '/hr/departments',
        translationKey: 'nav.hrDepartments',
        icon: <Building2 className="w-3.5 h-3.5" />,
        anyPermissions: ['view_departments', 'add_departments', 'edit_departments', 'delete_departments', 'manage_departments']
      },
      {
        id: '/hr/designations',
        translationKey: 'nav.hrDesignations',
        icon: <UserCog className="w-3.5 h-3.5" />,
        anyPermissions: ['view_designations', 'add_designations', 'edit_designations', 'delete_designations', 'manage_designations']
      },
      {
        id: '/hr/shifts',
        translationKey: 'nav.hrShifts',
        icon: <Calendar className="w-3.5 h-3.5" />,
        anyPermissions: ['view_shifts', 'add_shifts', 'edit_shifts', 'delete_shifts', 'manage_shifts']
      },
      {
        id: '/hr/employees',
        translationKey: 'nav.hrEmployees',
        icon: <Users className="w-3.5 h-3.5" />,
        anyPermissions: ['view_employees', 'add_employees', 'edit_employees', 'delete_employees', 'manage_employees']
      },
      {
        id: '/hr/attendances',
        translationKey: 'nav.hrAttendances',
        icon: <ClipboardList className="w-3.5 h-3.5" />,
        anyPermissions: ['view_employee_attendances', 'add_employee_attendances', 'edit_employee_attendances', 'delete_employee_attendances', 'manage_employee_attendances']
      },
      {
        id: '/hr/leave-requests',
        translationKey: 'nav.hrLeaveRequests',
        icon: <FileText className="w-3.5 h-3.5" />,
        anyPermissions: ['view_leave_requests', 'add_leave_requests', 'edit_leave_requests', 'delete_leave_requests', 'approve_leave_requests', 'manage_leave_requests']
      },
      {
        id: '/hr/salary-structures',
        translationKey: 'nav.hrSalaryStructures',
        icon: <Receipt className="w-3.5 h-3.5" />,
        anyPermissions: ['view_salary_structures', 'add_salary_structures', 'edit_salary_structures', 'delete_salary_structures', 'manage_salary_structures']
      },
      {
        id: '/hr/payroll',
        translationKey: 'nav.hrPayroll',
        icon: <BarChart className="w-3.5 h-3.5" />,
        anyPermissions: ['view_payroll_batches', 'manage_payroll_batches', 'view_payroll_items', 'manage_payroll_items', 'generate_payroll', 'approve_payroll', 'print_payslips']
      },
      {
        id: '/hr/data-tools',
        translationKey: 'nav.hrDataTools',
        icon: <Database className="w-3.5 h-3.5" />,
        anyPermissions: ['manage_departments', 'manage_designations', 'manage_shifts', 'manage_employees', 'manage_employee_attendances', 'manage_leave_requests', 'manage_salary_structures', 'manage_payroll_batches']
      }
    ]
  }
];

export function Sidebar({ role, onLogout }: SidebarProps) {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const canSeeSettings = [
    'view_users',
    'add_users',
    'edit_users',
    'delete_users',
    'manage_users',
    'view_roles',
    'add_roles',
    'edit_roles',
    'delete_roles',
    'manage_roles',
    'view_permissions',
    'add_permissions',
    'edit_permissions',
    'delete_permissions',
    'import_permissions',
    'export_permissions',
    'print_permissions',
    'manage_permissions',
    'view_hospital_settings',
    'add_hospital_settings',
    'edit_hospital_settings',
    'delete_hospital_settings',
    'manage_hospital_settings',
    'view_contact_messages',
    'edit_contact_messages',
    'delete_contact_messages',
    'manage_contact_messages',
    'view_backups',
    'add_backups',
    'edit_backups',
    'delete_backups',
    'export_backups',
    'manage_backups',
    'view_audit_logs',
    'manage_audit_logs',
  ].some((p) => hasPermission(p));

  const canSeeUsers = hasPermission('view_users') || hasPermission('add_users') || hasPermission('edit_users') || hasPermission('delete_users') || hasPermission('manage_users');
  const canSeeRoles = hasPermission('view_roles') || hasPermission('add_roles') || hasPermission('edit_roles') || hasPermission('delete_roles') || hasPermission('manage_roles');
  const canSeePermissions = hasPermission('view_permissions') || hasPermission('add_permissions') || hasPermission('edit_permissions') || hasPermission('delete_permissions') || hasPermission('import_permissions') || hasPermission('export_permissions') || hasPermission('print_permissions') || hasPermission('manage_permissions');
  const canSeeHospitalSettings = hasPermission('view_hospital_settings') || hasPermission('add_hospital_settings') || hasPermission('edit_hospital_settings') || hasPermission('delete_hospital_settings') || hasPermission('manage_hospital_settings');
  const canSeeBackups = hasPermission('view_backups') || hasPermission('add_backups') || hasPermission('edit_backups') || hasPermission('delete_backups') || hasPermission('export_backups') || hasPermission('manage_backups') || canSeeHospitalSettings;
  const canSeeContactMessages = hasPermission('view_contact_messages') || hasPermission('edit_contact_messages') || hasPermission('delete_contact_messages') || hasPermission('manage_contact_messages');
  // Audit Log is hidden entirely unless the user holds the dedicated permission.
  const canSeeAuditLog = hasPermission('view_audit_logs') || hasPermission('manage_audit_logs');
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  const isItemVisible = (item: MenuItem): boolean => {
    if (!item.anyPermissions || item.anyPermissions.length === 0) {
      // Public-to-auth (dashboard) or group header; visibility determined by children
      return true;
    }
    return item.anyPermissions.some((p) => hasPermission(p));
  };

  const visibleMenuItems = menuItems
    .map((item) => {
      if (!item.subItems?.length) return item;
      const subItems = item.subItems.filter(isItemVisible);
      return { ...item, subItems };
    })
    .filter((item) => {
      if (item.subItems?.length) return item.subItems.length > 0;
      return isItemVisible(item);
    });

  const toggleMenu = (menuId: string) => {
    setExpandedMenus(prev => 
      prev.includes(menuId) 
        ? []
        : [menuId]
    );
  };

  const handleNavigate = (path: string) => {
    // Check if path is a group ID (no slash) - if so, don't navigate
    if (!path.startsWith('/')) {
      return;
    }
    
    // Auto-collapse logic based on path groups
    // If navigating to a non-pharmacy page and pharmacy is expanded, collapse it
    const isPharmacySubItem = ['/pharmacy-master', '/manufacturers', '/medicine-types', '/medicines', '/suppliers', '/transactions', '/stock-control', '/stocks', '/stock-adjustments', '/pharmacy-finance'].includes(path);
    if (!isPharmacySubItem && path !== 'pharmacy' && expandedMenus.includes('pharmacy')) {
      setExpandedMenus(prev => prev.filter(id => id !== 'pharmacy'));
    }
    
    // If navigating to a non-prescription page and prescription menu is expanded, collapse it
    const isPrescriptionSubItem = ['/prescriptions/create', '/prescriptions', '/settings/treatment-sets', '/settings/prescription-diagnoses'].includes(path);
    if (!isPrescriptionSubItem && path !== 'prescription-menu' && expandedMenus.includes('prescription-menu')) {
      setExpandedMenus(prev => prev.filter(id => id !== 'prescription-menu'));
    }

    // If navigating away from radiology and its menu is expanded, collapse it
    const isRadiologySubItem = [
      '/ultrasound/exams',
      '/ultrasound/receipts',
      '/ultrasound/templates',
    ].includes(path);
    if (!isRadiologySubItem && path !== 'radiology' && expandedMenus.includes('radiology')) {
      setExpandedMenus(prev => prev.filter(id => id !== 'radiology'));
    }
    
    // If navigating to a non-laboratory page and laboratory menu is expanded, collapse it
    const isLaboratorySubItem = ['/lab-tests', '/test-management'].includes(path);
    if (!isLaboratorySubItem && path !== 'laboratory' && expandedMenus.includes('laboratory')) {
      setExpandedMenus(prev => prev.filter(id => id !== 'laboratory'));
    }
    
    // If navigating to a non-reception page and reception menu is expanded, collapse it
    const isReceptionSubItem = ['/doctors', '/patients', '/appointments', '/room-management', '/rooms', '/room-bookings', '/surgeries'].includes(path);
    if (!isReceptionSubItem && path !== 'reception' && expandedMenus.includes('reception')) {
      setExpandedMenus(prev => prev.filter(id => id !== 'reception'));
    }

    const isOtherIncomeSubItem = ['/other-income/categories', '/other-income/entries', '/other-income/report'].includes(path);
    if (!isOtherIncomeSubItem && path !== 'other-income' && expandedMenus.includes('other-income')) {
      setExpandedMenus(prev => prev.filter(id => id !== 'other-income'));
    }

    const isHrSubItem = [
      '/hr/departments',
      '/hr/designations',
      '/hr/shifts',
      '/hr/employees',
      '/hr/attendances',
      '/hr/leave-requests',
      '/hr/salary-structures',
      '/hr/payroll',
      '/hr/data-tools'
    ].includes(path);
    if (!isHrSubItem && path !== 'hr-menu' && expandedMenus.includes('hr-menu')) {
      setExpandedMenus(prev => prev.filter(id => id !== 'hr-menu'));
    }
    
    navigate(path);
  };

  const renderMenuItem = (item: MenuItem, isSubItem = false) => {
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isExpanded = expandedMenus.includes(item.id);
    
    // Check active status
    let isActive = false;
    if (hasSubItems) {
      isActive = item.subItems?.some(sub => sub.id === currentPath) || false;
    } else {
      isActive = item.id === currentPath;
    }

    if (hasSubItems) {
      return (
        <div key={item.id}>
          <button
            onClick={() => isCollapsed ? undefined : toggleMenu(item.id)} // Group headers usually don't navigate when collapsed unless logic added
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-2.5 py-1.5 rounded-md transition-colors text-xs ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={isCollapsed ? t(item.translationKey) : ''}
          >
            <div className={`flex items-center ${isCollapsed ? '' : 'gap-2'}`}>
              {item.icon}
              {!isCollapsed && <span>{t(item.translationKey)}</span>}
            </div>
            {!isCollapsed && (
              <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            )}
          </button>
          {!isCollapsed && isExpanded && (
            <div className="mt-0.5 space-y-0.5 ms-4 border-s-2 ps-2 border-gray-200 dark:border-gray-700">
              {item.subItems?.filter(isItemVisible).map((subItem) => (
                <button
                  key={subItem.id}
                  onClick={() => handleNavigate(subItem.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-xs ${
                    currentPath === subItem.id
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {subItem.icon}
                  <span>{t(subItem.translationKey)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={item.id}
        onClick={() => handleNavigate(item.id)}
        className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isSubItem ? 'ps-6' : ''} px-2.5 py-1.5 rounded-md transition-colors text-xs ${
          currentPath === item.id
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
        title={isCollapsed ? t(item.translationKey) : ''}
      >
        {item.icon}
        {!isCollapsed && <span>{t(item.translationKey)}</span>}
      </button>
    );
  };

  return (
    <aside className={`no-print ${isCollapsed ? 'w-14' : 'w-48'} bg-white dark:bg-gray-800 border-e border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 flex-shrink-0`}>
      {/* Logo */}
      <div className="p-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between relative">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-blue-700 rounded-md flex items-center justify-center flex-shrink-0">
              <Hospital className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-gray-900 dark:text-white">ShifaaScript</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Rx System</p>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-blue-700 rounded-md flex items-center justify-center mx-auto">
            <Hospital className="w-4 h-4 text-white" />
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`${isCollapsed ? 'absolute -end-3 top-1/2 -translate-y-1/2' : ''} p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-md z-50 flex-shrink-0`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {/* The chevron points away from the content in both directions. */}
          {isCollapsed ? (
            <ChevronRight className="w-3 h-3 text-gray-600 dark:text-gray-400 rtl:rotate-180" />
          ) : (
            <ChevronLeft className="w-3 h-3 text-gray-600 dark:text-gray-400 rtl:rotate-180" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-0.5">
          {visibleMenuItems.map((item) => renderMenuItem(item))}
        </div>
      </nav>

      {/* Settings Footer */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} px-2.5 py-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-xs`}
          title={isCollapsed ? (theme === 'dark' ? t('theme.lightMode') : t('theme.darkMode')) : ''}
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          {!isCollapsed && <span>{theme === 'dark' ? t('theme.lightMode') : t('theme.darkMode')}</span>}
        </button>

        {/* Language Selector */}
        {!isCollapsed ? (
          <div className="relative">
            <select
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              aria-label="Language"
              className="w-full px-2.5 py-1.5 pe-7 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-md transition-colors cursor-pointer appearance-none text-xs"
            >
              <option value="en">🇬🇧 English</option>
              <option value="ps">🇦🇫 پښتو</option>
              <option value="fa">🇦🇫 دری</option>
              <option value="ar">🇸🇦 العربية</option>
            </select>
            <Globe className="absolute end-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500 pointer-events-none" />
          </div>
        ) : (
          <div className="relative group">
            <button
              className="w-full flex items-center justify-center px-2.5 py-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="Language"
            >
              <Globe className="w-3.5 h-3.5" />
            </button>
            {/* Collapsed language selector dropdown */}
            <div className="absolute start-full ms-2 bottom-0 hidden group-hover:block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 min-w-[140px]">
              <button
                onClick={() => i18n.changeLanguage('en')}
                className={`w-full px-3 py-2 text-start text-xs hover:bg-gray-100 dark:hover:bg-gray-700 ${i18n.language === 'en' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}
              >
                🇬🇧 English
              </button>
              <button
                onClick={() => i18n.changeLanguage('ps')}
                className={`w-full px-3 py-2 text-start text-xs hover:bg-gray-100 dark:hover:bg-gray-700 ${i18n.language === 'ps' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}
              >
                🇦🇫 پښتو
              </button>
              <button
                onClick={() => i18n.changeLanguage('fa')}
                className={`w-full px-3 py-2 text-start text-xs hover:bg-gray-100 dark:hover:bg-gray-700 ${i18n.language === 'fa' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}
              >
                🇦🇫 دری
              </button>
              <button
                onClick={() => i18n.changeLanguage('ar')}
                className={`w-full px-3 py-2 text-start text-xs hover:bg-gray-100 dark:hover:bg-gray-700 ${i18n.language === 'ar' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}
              >
                🇸🇦 العربية
              </button>
            </div>
          </div>
        )}

        {/* Settings Menu with Sub-items */}
        {canSeeSettings && (
          <div>
            <button
              onClick={() => {
                if (!isCollapsed) {
                  toggleMenu('settings');
                  return;
                }
                if (canSeeHospitalSettings) {
                  handleNavigate('/settings/general');
                  return;
                }
                if (canSeeBackups) {
                  handleNavigate('/settings/backups');
                }
              }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-2.5 py-1.5 rounded-md transition-colors text-xs ${
                ['/settings/users', '/settings/roles', '/settings/permissions', '/settings/general', '/settings/backups', '/settings/audit-log', '/settings', '/contact-messages'].includes(currentPath)
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title={isCollapsed ? t('nav.settings') : ''}
            >
              <div className={`flex items-center ${isCollapsed ? '' : 'gap-2'}`}>
                <Settings className="w-3.5 h-3.5" />
                {!isCollapsed && <span>{t('nav.settings')}</span>}
              </div>
              {!isCollapsed && (
                <ChevronDown className={`w-3 h-3 transition-transform ${expandedMenus.includes('settings') ? 'rotate-180' : ''}`} />
              )}
            </button>
            {!isCollapsed && expandedMenus.includes('settings') && (
              <div className="mt-0.5 ml-4 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                {canSeeHospitalSettings && (
                  <button
                    onClick={() => handleNavigate('/settings/general')}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-xs ${
                      currentPath === '/settings/general'
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>{t('nav.settingsGeneral')}</span>
                  </button>
                )}
                {canSeeBackups && (
                  <button
                    onClick={() => handleNavigate('/settings/backups')}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-xs ${
                      currentPath === '/settings/backups'
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>{t('nav.settingsBackups')}</span>
                  </button>
                )}
                {canSeeContactMessages && (
                  <button
                    onClick={() => handleNavigate('/contact-messages')}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-xs ${
                      currentPath === '/contact-messages'
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{t('nav.contactMessages')}</span>
                  </button>
                )}
                {canSeeUsers && (
                  <button
                    onClick={() => handleNavigate('/settings/users')}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-xs ${
                      currentPath === '/settings/users'
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <UserCog className="w-3.5 h-3.5" />
                    <span>{t('nav.users')}</span>
                  </button>
                )}
                {canSeeRoles && (
                  <button
                    onClick={() => handleNavigate('/settings/roles')}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-xs ${
                      currentPath === '/settings/roles'
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>{t('nav.roles')}</span>
                  </button>
                )}
                {canSeeAuditLog && (
                  <button
                    onClick={() => handleNavigate('/settings/audit-log')}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-xs ${
                      currentPath === '/settings/audit-log'
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{t('nav.auditLog')}</span>
                  </button>
                )}
                {canSeePermissions && (
                  <button
                    onClick={() => handleNavigate('/settings/permissions')}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-xs ${
                      currentPath === '/settings/permissions'
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{t('nav.permissions')}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={onLogout}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} px-2.5 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors text-xs font-medium border-t border-gray-200 dark:border-gray-700 mt-1 pt-2`}
          title={isCollapsed ? t('header.logout') : ''}
        >
          <LogOut className="w-3.5 h-3.5" />
          {!isCollapsed && <span>{t('header.logout')}</span>}
        </button>
      </div>
    </aside>
  );
}
