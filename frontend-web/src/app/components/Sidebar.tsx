import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Calendar,
  UserCheck,
  Stethoscope,
  Users,
  TestTube,
  FileText,
  Package,
  Factory,
  Pill,
  Truck,
  Receipt,
  Box,
  ClipboardList,
  FilePlus,
  List,
  BarChart,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sun,
  Moon,
  Globe,
  Sliders,
  MessageSquare,
  UserCog,
  Shield,
  Key,
  LogOut,
  Hospital,
  Database
} from 'lucide-react';
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
    id: 'pharmacy', // Group ID
    translationKey: 'nav.pharmacy',
    icon: <Package className="w-3.5 h-3.5" />,
    anyPermissions: ['view_pharmacy_menu'],
    subItems: [
      {
        id: '/manufacturers',
        translationKey: 'nav.manufacturers',
        icon: <Factory className="w-3.5 h-3.5" />,
        anyPermissions: ['view_manufacturers', 'manage_manufacturers']
      },
      {
        id: '/medicine-types',
        translationKey: 'nav.medicineTypes',
        icon: <Pill className="w-3.5 h-3.5" />,
        anyPermissions: ['view_medicine_types', 'manage_medicine_types']
      },
      {
        id: '/medicines',
        translationKey: 'nav.medicines',
        icon: <Pill className="w-3.5 h-3.5" />,
        anyPermissions: ['view_medicines', 'manage_medicines', 'dispense_medicines']
      },
      {
        id: '/suppliers',
        translationKey: 'nav.suppliers',
        icon: <Truck className="w-3.5 h-3.5" />,
        anyPermissions: ['view_suppliers', 'manage_suppliers']
      },
      {
        id: '/transactions',
        translationKey: 'nav.transactions',
        icon: <Receipt className="w-3.5 h-3.5" />,
        anyPermissions: ['view_transactions', 'manage_transactions']
      },
      {
        id: '/stocks',
        translationKey: 'nav.stocks',
        icon: <Box className="w-3.5 h-3.5" />,
        anyPermissions: ['view_stocks', 'manage_stocks']
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
        id: '/prescriptions/create',
        translationKey: 'nav.createNew',
        icon: <FilePlus className="w-3.5 h-3.5" />,
        anyPermissions: ['create_prescription', 'manage_prescriptions']
      },
      {
        id: '/prescriptions',
        translationKey: 'nav.viewAll',
        icon: <List className="w-3.5 h-3.5" />,
        anyPermissions: ['view_prescriptions', 'manage_prescriptions']
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
    id: '/reports',
    translationKey: 'nav.reports',
    icon: <BarChart className="w-3.5 h-3.5" />,
    anyPermissions: ['view_reports', 'manage_reports']
  }
];

export function Sidebar({ role, onLogout }: SidebarProps) {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const isRTL = ['ps', 'fa', 'ar'].some((code) => String(i18n.language || '').toLowerCase().startsWith(code));

  const canSeeSettings = [
    'view_users',
    'manage_users',
    'view_roles',
    'manage_roles',
    'view_permissions',
    'manage_permissions',
    'view_hospital_settings',
    'manage_hospital_settings',
    'view_contact_messages',
    'manage_contact_messages',
  ].some((p) => hasPermission(p));

  const canSeeUsers = hasPermission('view_users') || hasPermission('manage_users');
  const canSeeRoles = hasPermission('view_roles') || hasPermission('manage_roles');
  const canSeePermissions = hasPermission('view_permissions') || hasPermission('manage_permissions');
  const canSeeHospitalSettings = hasPermission('view_hospital_settings') || hasPermission('manage_hospital_settings');
  const canSeeContactMessages = hasPermission('view_contact_messages') || hasPermission('manage_contact_messages');
  
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
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  };

  const handleNavigate = (path: string) => {
    // Check if path is a group ID (no slash) - if so, don't navigate
    if (!path.startsWith('/')) {
      return;
    }
    
    // Auto-collapse logic based on path groups
    // If navigating to a non-pharmacy page and pharmacy is expanded, collapse it
    const isPharmacySubItem = ['/manufacturers', '/medicine-types', '/medicines', '/suppliers', '/transactions', '/stocks'].includes(path);
    if (!isPharmacySubItem && path !== 'pharmacy' && expandedMenus.includes('pharmacy')) {
      setExpandedMenus(prev => prev.filter(id => id !== 'pharmacy'));
    }
    
    // If navigating to a non-prescription page and prescription menu is expanded, collapse it
    const isPrescriptionSubItem = ['/prescriptions/create', '/prescriptions'].includes(path);
    if (!isPrescriptionSubItem && path !== 'prescription-menu' && expandedMenus.includes('prescription-menu')) {
      setExpandedMenus(prev => prev.filter(id => id !== 'prescription-menu'));
    }
    
    // If navigating to a non-laboratory page and laboratory menu is expanded, collapse it
    const isLaboratorySubItem = ['/lab-tests', '/test-management'].includes(path);
    if (!isLaboratorySubItem && path !== 'laboratory' && expandedMenus.includes('laboratory')) {
      setExpandedMenus(prev => prev.filter(id => id !== 'laboratory'));
    }
    
    // If navigating to a non-reception page and reception menu is expanded, collapse it
    const isReceptionSubItem = ['/doctors', '/patients', '/appointments'].includes(path);
    if (!isReceptionSubItem && path !== 'reception' && expandedMenus.includes('reception')) {
      setExpandedMenus(prev => prev.filter(id => id !== 'reception'));
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
            className={`w-full flex items-center ${isRTL ? 'flex-row-reverse' : ''} ${isCollapsed ? 'justify-center' : 'justify-between'} px-2.5 py-1.5 rounded-md transition-colors text-xs ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={isCollapsed ? t(item.translationKey) : ''}
          >
            <div className={`flex items-center ${isRTL ? 'flex-row-reverse' : ''} ${isCollapsed ? '' : 'gap-2'}`}>
              {item.icon}
              {!isCollapsed && <span>{t(item.translationKey)}</span>}
            </div>
            {!isCollapsed && (
              <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            )}
          </button>
          {!isCollapsed && isExpanded && (
            <div className={`mt-0.5 space-y-0.5 ${isRTL ? 'mr-4 border-r-2 pr-2' : 'ml-4 border-l-2 pl-2'} border-gray-200 dark:border-gray-700`}>
              {item.subItems?.filter(isItemVisible).map((subItem) => (
                <button
                  key={subItem.id}
                  onClick={() => handleNavigate(subItem.id)}
                  className={`w-full flex items-center ${isRTL ? 'flex-row-reverse' : ''} gap-2 px-2.5 py-1.5 rounded-md transition-colors text-xs ${
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
        className={`w-full flex items-center ${isRTL ? 'flex-row-reverse' : ''} ${isCollapsed ? 'justify-center' : 'gap-2'} ${isSubItem ? (isRTL ? 'pr-6' : 'pl-6') : ''} px-2.5 py-1.5 rounded-md transition-colors text-xs ${
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
    <aside className={`no-print ${isCollapsed ? 'w-14' : 'w-48'} bg-white dark:bg-gray-800 ${isRTL ? 'border-l border-r-0' : 'border-r'} border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 flex-shrink-0 ${isRTL ? 'text-right' : ''}`}>
      {/* Logo */}
      <div className={`p-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between relative ${isRTL ? 'flex-row-reverse' : ''}`}>
        {!isCollapsed && (
          <div className={`flex items-center ${isRTL ? 'flex-row-reverse' : ''} gap-2`}>
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
          className={`${isCollapsed ? (isRTL ? 'absolute -left-3 top-1/2 -translate-y-1/2' : 'absolute -right-3 top-1/2 -translate-y-1/2') : ''} p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-md z-50 flex-shrink-0`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            isRTL ? (
              <ChevronLeft className="w-3 h-3 text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronRight className="w-3 h-3 text-gray-600 dark:text-gray-400" />
            )
          ) : (
            isRTL ? (
              <ChevronRight className="w-3 h-3 text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronLeft className="w-3 h-3 text-gray-600 dark:text-gray-400" />
            )
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
              className="w-full px-2.5 py-1.5 pr-7 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-md transition-colors cursor-pointer appearance-none text-xs"
            >
              <option value="en">🇬🇧 English</option>
              <option value="ps">🇦🇫 پښتو</option>
              <option value="fa">🇦🇫 دری</option>
              <option value="ar">🇸🇦 العربية</option>
            </select>
            <Globe className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500 pointer-events-none" />
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
            <div className="absolute left-full ml-2 bottom-0 hidden group-hover:block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 min-w-[140px]">
              <button
                onClick={() => i18n.changeLanguage('en')}
                className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 ${i18n.language === 'en' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}
              >
                🇬🇧 English
              </button>
              <button
                onClick={() => i18n.changeLanguage('ps')}
                className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 ${i18n.language === 'ps' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}
              >
                🇦🇫 پښتو
              </button>
              <button
                onClick={() => i18n.changeLanguage('fa')}
                className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 ${i18n.language === 'fa' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}
              >
                🇦🇫 دری
              </button>
              <button
                onClick={() => i18n.changeLanguage('ar')}
                className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 ${i18n.language === 'ar' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}
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
              onClick={() => isCollapsed ? handleNavigate('/settings/general') : toggleMenu('settings')}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-2.5 py-1.5 rounded-md transition-colors text-xs ${
                ['/settings/users', '/settings/roles', '/settings/permissions', '/settings/general', '/settings/backups', '/settings', '/contact-messages'].includes(currentPath)
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
                    <span>General</span>
                  </button>
                )}
                {canSeeHospitalSettings && (
                  <button
                    onClick={() => handleNavigate('/settings/backups')}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-xs ${
                      currentPath === '/settings/backups'
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Backups</span>
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
                    <span>Contact Messages</span>
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
                    <span>Users</span>
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
                    <span>Roles</span>
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
                    <span>Permissions</span>
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