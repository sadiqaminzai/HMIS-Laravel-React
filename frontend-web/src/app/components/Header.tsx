import React, { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, User, LogOut, Settings, KeyRound, UserCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UserRole, Hospital } from '../types';
import { mockHospitals } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { useHospitals } from '../context/HospitalContext';
import { MyProfile } from './MyProfile';
import { AccountSettings } from './AccountSettings';
import { ChangePassword } from './ChangePassword';

interface HeaderProps {
  user: {
    name: string;
    email: string;
    role: UserRole;
  };
  hospital: Hospital;
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
  onHospitalChange: (hospital: Hospital) => void;
}

export function Header({ user, hospital, role, onRoleChange, onHospitalChange }: HeaderProps) {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { hospitals } = useHospitals();
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setShowAccountMenu(false);
    // Since we are using React Router now, but logout might do a full refresh or we need to redirect
    // The AuthProvider likely handles the state, but we might want to redirect to login if it doesn't automatically
    window.location.href = '/'; 
  };

  return (
    <>
      <header 
        className="no-print bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2 transition-colors duration-300"
        style={{ borderTop: `3px solid ${hospital.brandColor || '#2563eb'}` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-md border border-blue-100 dark:border-blue-800">
              <Building2 className="w-3.5 h-3.5" style={{ color: hospital.brandColor || '#2563eb' }} />
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{t('header.currentHospital')}</div>
                <div className="text-xs font-medium text-gray-900 dark:text-white">{hospital.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{t('header.code')}: {hospital.code}</div>
              </div>
            </div>

            {/* Switch Hospital (Super Admin only) */}
            {role === 'super_admin' && (
              <div className="relative">
                <select
                  value={hospital.id}
                  onChange={(e) => {
                    const selected = hospitals.find(h => h.id === e.target.value);
                    if (selected) onHospitalChange(selected);
                  }}
                  className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md px-2.5 py-1 pr-7 text-xs cursor-pointer hover:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {hospitals.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 dark:text-gray-500 pointer-events-none" />
              </div>
            )}
          </div>

          {/* User Account Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowAccountMenu(!showAccountMenu)}
              className="flex items-center gap-2 px-2.5 py-1 bg-gray-50 dark:bg-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <div className="w-7 h-7 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-xs font-medium text-gray-900 dark:text-white">{user.name}</div>
                <div className="text-xs text-blue-600 dark:text-blue-400">{t(`roles.${user.role}`)}</div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform ${showAccountMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showAccountMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50">
                {/* User Info Header */}
                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">{user.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                    {t(`roles.${user.role}`)}
                  </span>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowAccountMenu(false);
                      setShowMyProfile(true);
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <UserCircle className="w-4 h-4" />
                    <span>{t('header.myProfile')}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowAccountMenu(false);
                      setShowAccountSettings(true);
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    <span>{t('header.accountSettings')}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowAccountMenu(false);
                      setShowChangePassword(true);
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>{t('header.changePassword')}</span>
                  </button>
                </div>

                {/* Logout - Separated */}
                <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{t('header.logout')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Modals */}
      <MyProfile isOpen={showMyProfile} onClose={() => setShowMyProfile(false)} />
      <AccountSettings isOpen={showAccountSettings} onClose={() => setShowAccountSettings(false)} />
      <ChangePassword isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </>
  );
}