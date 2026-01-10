import React, { useState } from 'react';
import {
  Users,
  Package,
  LayoutDashboard,
  Calendar,
  Building2,
  UserCheck,
  Pill,
  FileText,
  ClipboardList,
  Stethoscope,
  UserPlus,
  SettingsIcon,
  Hospital,
  Sun,
  Moon,
  Globe,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Package as PackageIcon,
  FilePlus,
  FileSpreadsheet,
  Factory,
  TestTube,
  Sliders,
  MessageSquare,
  List,
  UserCog,
  Shield,
  Key,
  LogOut,
  BarChart,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UserRole } from '../types';
import { useTheme } from '../context/ThemeContext';

interface SidebarProps {
  role: UserRole;
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

interface MenuItem {
  id: string;
  translationKey: string;
  icon: React.ReactNode;
  roles: UserRole[];
  subItems?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    translationKey: 'nav.dashboard',
    icon: <LayoutDashboard className="w-3.5 h-3.5" />,
    roles: ['super_admin', 'admin', 'doctor', 'receptionist', 'pharmacist', 'lab_technician']
  },
  {
    id: 'hospitals',
    translationKey: 'nav.hospitals',
    icon: <Building2 className="w-3.5 h-3.5" />,
    roles: ['super_admin']
  },
  {
    id: 'my-appointments',
    translationKey: 'nav.myAppointments',
    icon: <Calendar className="w-3.5 h-3.5" />,
    roles: ['doctor']
  },
  {
    id: 'reception',
    translationKey: 'nav.reception',
    icon: <UserCheck className="w-3.5 h-3.5" />,
    roles: ['super_admin', 'admin', 'receptionist'],
    subItems: [
      {
        id: 'doctors',
        translationKey: 'nav.doctors',
        icon: <Stethoscope className="w-3.5 h-3.5" />,
        roles: ['super_admin', 'admin', 'receptionist']
      },
      {
        id: 'patients',
        translationKey: 'nav.patients',
        icon: <Users className="w-3.5 h-3.5" />,
        roles: ['super_admin', 'admin', 'receptionist']
      },
      {
        id: 'appointments',
        translationKey: 'nav.appointments',
        icon: <Calendar className="w-3.5 h-3.5" />,
        roles: ['super_admin', 'admin', 'receptionist']
      }
    ]
  },
  {
    id: 'laboratory',
    translationKey: 'nav.laboratory',
    icon: <TestTube className="w-3.5 h-3.5" />,
    roles: ['super_admin', 'admin', 'doctor', 'receptionist', 'lab_technician'],
    subItems: [
      {
        id: 'lab-tests',
        translationKey: 'nav.labTests',
        icon: <FileText className="w-3.5 h-3.5" />,
        roles: ['super_admin', 'admin', 'doctor', 'receptionist', 'lab_technician']
      },
      {
        id: 'test-management',
        translationKey: 'nav.testManagement',
        icon: <TestTube className="w-3.5 h-3.5" />,
        roles: ['super_admin', 'admin', 'lab_technician']
      }
    ]
  },
  {
    id: 'pharmacy',
    translationKey: 'nav.pharmacy',
    icon: <Package className="w-3.5 h-3.5" />,
    roles: ['super_admin', 'admin', 'pharmacist'],
    subItems: [
      {
        id: 'manufacturers',
        translationKey: 'nav.manufacturers',
        icon: <Factory className="w-3.5 h-3.5" />,
        roles: ['super_admin', 'admin', 'pharmacist']
      },
      {
        id: 'medicine-types',
        translationKey: 'nav.medicineTypes',
        icon: <Pill className="w-3.5 h-3.5" />,
        roles: ['super_admin', 'admin', 'pharmacist']
      },
      {
        id: 'medicines',
        translationKey: 'nav.medicines',
        icon: <Pill className="w-3.5 h-3.5" />,
        roles: ['super_admin', 'admin', 'pharmacist']
      }
    ]
  },
  {
    id: 'prescription-menu',
    translationKey: 'nav.prescriptions',
    icon: <ClipboardList className="w-3.5 h-3.5" />,
    roles: ['super_admin', 'admin', 'doctor', 'receptionist', 'pharmacist'],
    subItems: [
      {
        id: 'create-prescription',
        translationKey: 'nav.createNew',
        icon: <FilePlus className="w-3.5 h-3.5" />,
        roles: ['super_admin', 'admin', 'doctor']
      },
      {
        id: 'prescriptions',
        translationKey: 'nav.viewAll',
        icon: <List className="w-3.5 h-3.5" />,
        roles: ['super_admin', 'admin', 'doctor', 'receptionist', 'pharmacist']
      }
    ]
  },
  {
    id: 'reports',
    translationKey: 'nav.reports',
    icon: <BarChart className="w-3.5 h-3.5" />,
    roles: ['super_admin', 'admin', 'doctor']
  }
];

export function Sidebar({ role, currentPage, onNavigate, onLogout }: SidebarProps) {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const visibleMenuItems = menuItems.filter(item => item.roles.includes(role));

  const toggleMenu = (menuId: string) => {
    setExpandedMenus(prev => 
      prev.includes(menuId) 
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  };

  const handleNavigate = (pageId: string) => {
    // Check if navigating to a non-pharmacy page
    const isPharmacySubItem = ['manufacturers', 'medicine-types', 'medicines'].includes(pageId);
    const isPrescriptionSubItem = ['create-prescription', 'prescriptions'].includes(pageId);
    const isLaboratorySubItem = ['lab-tests', 'test-management'].includes(pageId);
    const isReceptionSubItem = ['doctors', 'patients', 'appointments'].includes(pageId);
    
    // If navigating to a non-pharmacy page and pharmacy is expanded, collapse it
    if (!isPharmacySubItem && pageId !== 'pharmacy' && expandedMenus.includes('pharmacy')) {
      setExpandedMenus(prev => prev.filter(id => id !== 'pharmacy'));
    }
    
    // If navigating to a non-prescription page and prescription menu is expanded, collapse it
    if (!isPrescriptionSubItem && pageId !== 'prescription-menu' && expandedMenus.includes('prescription-menu')) {
      setExpandedMenus(prev => prev.filter(id => id !== 'prescription-menu'));
    }
    
    // If navigating to a non-laboratory page and laboratory menu is expanded, collapse it
    if (!isLaboratorySubItem && pageId !== 'laboratory' && expandedMenus.includes('laboratory')) {
      setExpandedMenus(prev => prev.filter(id => id !== 'laboratory'));
    }
    
    // If navigating to a non-reception page and reception menu is expanded, collapse it
    if (!isReceptionSubItem && pageId !== 'reception' && expandedMenus.includes('reception')) {
      setExpandedMenus(prev => prev.filter(id => id !== 'reception'));
    }
    
    onNavigate(pageId);
  };

  const renderMenuItem = (item: MenuItem, isSubItem = false) => {
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isExpanded = expandedMenus.includes(item.id);
    const isActive = currentPage === item.id || (hasSubItems && item.subItems?.some(sub => sub.id === currentPage));

    if (hasSubItems) {
      return (
        <div key={item.id}>
          <button
            onClick={() => isCollapsed ? handleNavigate(item.id) : toggleMenu(item.id)}
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
            <div className="mt-0.5 ml-4 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
              {item.subItems?.filter(sub => sub.roles.includes(role)).map(subItem => (
                <button
                  key={subItem.id}
                  onClick={() => handleNavigate(subItem.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-xs ${
                    currentPage === subItem.id
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
        className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isSubItem ? 'pl-6' : ''} px-2.5 py-1.5 rounded-md transition-colors text-xs ${
          currentPage === item.id
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
    <aside className={`no-print ${isCollapsed ? 'w-14' : 'w-48'} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 flex-shrink-0`}>
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
          className={`${isCollapsed ? 'absolute -right-3 top-1/2 -translate-y-1/2' : ''} p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-md z-50 flex-shrink-0`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3 h-3 text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronLeft className="w-3 h-3 text-gray-600 dark:text-gray-400" />
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

        {/* Settings Menu with Sub-items - RESTRICTED TO SUPER_ADMIN AND ADMIN ONLY */}
        {(role === 'super_admin' || role === 'admin') && (
          <div>
            <button
              onClick={() => isCollapsed ? onNavigate('settings-general') : toggleMenu('settings')}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-2.5 py-1.5 rounded-md transition-colors text-xs ${
                ['settings-users', 'settings-roles', 'settings-permissions', 'settings-general', 'settings', 'contact-messages'].includes(currentPage)
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
                <button
                  onClick={() => handleNavigate('settings-general')}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-xs ${
                    currentPage === 'settings-general'
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>General</span>
                </button>
                {/* Contact Messages - ONLY FOR SUPER ADMIN */}
                {role === 'super_admin' && (
                  <button
                    onClick={() => handleNavigate('contact-messages')}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-xs ${
                      currentPage === 'contact-messages'
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Contact Messages</span>
                  </button>
                )}
                <button
                  onClick={() => handleNavigate('settings-users')}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-xs ${
                    currentPage === 'settings-users'
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <UserCog className="w-3.5 h-3.5" />
                  <span>Users</span>
                </button>
                <button
                  onClick={() => handleNavigate('settings-roles')}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-xs ${
                    currentPage === 'settings-roles'
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Roles</span>
                </button>
                <button
                  onClick={() => handleNavigate('settings-permissions')}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-xs ${
                    currentPage === 'settings-permissions'
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Permissions</span>
                </button>
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