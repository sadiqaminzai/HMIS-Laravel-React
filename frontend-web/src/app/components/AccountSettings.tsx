import React, { useState } from 'react';
import { X, Settings, Palette, Globe, Calendar, Eye, Save, Sun, Moon, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';

interface AccountSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountSettings({ isOpen, onClose }: AccountSettingsProps) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  
  const [settings, setSettings] = useState({
    // Theme Settings
    themeMode: theme,
    
    // Language Settings
    language: i18n.language,
    
    // Display Settings
    compactView: localStorage.getItem('compactView') === 'true' || false,
    showPatientPhotos: localStorage.getItem('showPatientPhotos') !== 'false',
    
    // Regional Settings
    dateFormat: localStorage.getItem('dateFormat') || 'gregorian',
    timeZone: 'Asia/Kabul',
    firstDayOfWeek: localStorage.getItem('firstDayOfWeek') || 'sunday',
  });
  
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Apply theme
      setTheme(settings.themeMode as 'light' | 'dark' | 'system');
      
      // Apply language
      i18n.changeLanguage(settings.language);
      
      // Save to localStorage
      localStorage.setItem('compactView', settings.compactView.toString());
      localStorage.setItem('showPatientPhotos', settings.showPatientPhotos.toString());
      localStorage.setItem('dateFormat', settings.dateFormat);
      localStorage.setItem('firstDayOfWeek', settings.firstDayOfWeek);
      
      // Simulate API call to save user preferences
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Account settings updated successfully');
      setLoading(false);
      onClose();
    } catch (error) {
      toast.error('Failed to update settings');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-600 to-pink-600">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-white" />
            <h2 className="text-sm font-semibold text-white">Account Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-md p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Theme Settings */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <Palette className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Theme Preferences</h3>
              </div>
              
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Appearance Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, themeMode: 'light' })}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      settings.themeMode === 'light'
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-purple-400'
                    }`}
                  >
                    <Sun className={`w-5 h-5 mx-auto mb-1 ${
                      settings.themeMode === 'light' ? 'text-purple-600' : 'text-gray-400'
                    }`} />
                    <span className={`text-xs font-medium ${
                      settings.themeMode === 'light' ? 'text-purple-600' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      Light
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, themeMode: 'dark' })}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      settings.themeMode === 'dark'
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-purple-400'
                    }`}
                  >
                    <Moon className={`w-5 h-5 mx-auto mb-1 ${
                      settings.themeMode === 'dark' ? 'text-purple-600' : 'text-gray-400'
                    }`} />
                    <span className={`text-xs font-medium ${
                      settings.themeMode === 'dark' ? 'text-purple-600' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      Dark
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, themeMode: 'system' })}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      settings.themeMode === 'system'
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-purple-400'
                    }`}
                  >
                    <Monitor className={`w-5 h-5 mx-auto mb-1 ${
                      settings.themeMode === 'system' ? 'text-purple-600' : 'text-gray-400'
                    }`} />
                    <span className={`text-xs font-medium ${
                      settings.themeMode === 'system' ? 'text-purple-600' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      System
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Language Settings */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Language & Region</h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Display Language
                  </label>
                  <select
                    value={settings.language}
                    onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="en">English</option>
                    <option value="ps">پښتو (Pashto)</option>
                    <option value="fa">دری (Dari)</option>
                    <option value="ar">العربية (Arabic)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Time Zone
                  </label>
                  <select
                    value={settings.timeZone}
                    onChange={(e) => setSettings({ ...settings, timeZone: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="Asia/Kabul">Afghanistan (UTC+4:30)</option>
                    <option value="Asia/Dubai">Dubai (UTC+4:00)</option>
                    <option value="Asia/Karachi">Pakistan (UTC+5:00)</option>
                    <option value="Asia/Tehran">Iran (UTC+3:30)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Date & Time Settings */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Date & Time Format</h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Calendar System
                  </label>
                  <select
                    value={settings.dateFormat}
                    onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="gregorian">Gregorian Calendar</option>
                    <option value="hijri_shamsi">Hijri Shamsi (Solar)</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {settings.dateFormat === 'gregorian' 
                      ? 'Example: January 7, 2026' 
                      : 'Example: دلو ۱۷, ۱۴۰۴'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    First Day of Week
                  </label>
                  <select
                    value={settings.firstDayOfWeek}
                    onChange={(e) => setSettings({ ...settings, firstDayOfWeek: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="sunday">Sunday</option>
                    <option value="monday">Monday</option>
                    <option value="saturday">Saturday</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Display Settings */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Display Preferences</h3>
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-gray-800 rounded-md cursor-pointer transition-colors">
                  <div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Compact View</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Reduce spacing in tables and lists</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.compactView}
                    onChange={(e) => setSettings({ ...settings, compactView: e.target.checked })}
                    className="w-4 h-4 text-purple-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500"
                  />
                </label>

                <label className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-gray-800 rounded-md cursor-pointer transition-colors">
                  <div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Show Patient Photos</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Display patient images in lists</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showPatientPhotos}
                    onChange={(e) => setSettings({ ...settings, showPatientPhotos: e.target.checked })}
                    className="w-4 h-4 text-purple-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500"
                  />
                </label>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 rounded-md transition-colors flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}