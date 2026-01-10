import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { toast } from '../utils/toast';

export function Settings() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();

  const dateFormats = [
    { value: 'gregorian', label: 'Gregorian', example: '01/05/2026' },
    { value: 'hijri_shamsi', label: 'Hijri Shamsi (Solar)', example: '15/10/1404' },
  ];

  const handleDateFormatChange = (format: 'gregorian' | 'hijri_shamsi') => {
    updateSettings({ dateFormat: format });
    toast.success('Date format updated successfully');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">System Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage application preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Date Format Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Date Format</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Choose how dates are displayed
          </p>
          <div className="space-y-2">
            {dateFormats.map((format) => (
              <button
                key={format.value}
                onClick={() => handleDateFormatChange(format.value as any)}
                className={`
                  w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-colors
                  ${settings.dateFormat === format.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
                  }
                `}
              >
                <span className="font-medium">{format.label}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{format.example}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <strong>Note:</strong> Date format applies system-wide to forms, tables, and printed prescriptions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
