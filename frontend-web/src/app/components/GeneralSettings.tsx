import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, User, Hash, UserPlus, Building2, Globe, Printer, Pill } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useHospitals } from '../context/HospitalContext';
import { useDoctors } from '../context/DoctorContext';
import { Hospital, UserRole } from '../types';
import { toast } from 'sonner';

interface GeneralSettingsProps {
  hospital: Hospital;
  userRole: UserRole;
}

const timezones = [
  'Asia/Kabul',
  'UTC',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Tehran',
  'Asia/Riyadh',
  'Europe/London',
  'America/New_York',
  'Asia/Calcutta',
  'Asia/Bangkok',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Europe/Paris',
  'Europe/Berlin',
];

export function GeneralSettings({ hospital, userRole }: GeneralSettingsProps) {
  const { t } = useTranslation();
  const { loadHospitalSetting, saveHospitalSetting, getDefaultDoctorId, getDefaultToWalkIn, getDefaultPrescriptionNextVisit, getPatientIdConfig, getPrintColumnSettings, getPrescriptionPrintAssetSettings, getShowOutOfStockMedicines, getShowOutOfStockMedicinesForPharmacy, generatePatientId } = useSettings();
  const { hospitals } = useHospitals();
  const { doctors } = useDoctors();
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  
  // Hospital selection state for super_admin
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>(hospital.id);
  const selectedHospital = userRole === 'super_admin'
    ? hospitals.find(h => h.id === selectedHospitalId) || hospital
    : hospital;
  
  // Timezone state
  const [timezone, setTimezone] = useState<string>(selectedHospital.timezone || 'Asia/Kabul');
  
  // Calendar type state
  const [calendarType, setCalendarType] = useState<'gregorian' | 'shamsi'>(selectedHospital.calendarType || 'gregorian');

  // Patient ID Configuration state
  const [patientIdConfig, setPatientIdConfigState] = useState({
    autoGenerate: true,
    prefix: 'P',
    startNumber: 1,
    digits: 4
  });

  const [printColumns, setPrintColumns] = useState({
    showBatchColumn: true,
    showExpiryDateColumn: true,
    showBonusColumn: true,
  });

  const [prescriptionPrintAssetSettings, setPrescriptionPrintAssetSettings] = useState({
    logoWidth: 176,
    logoHeight: 160,
    signatureWidth: 200,
    signatureHeight: 112,
  });

  const [showOutOfStockMedicines, setShowOutOfStockMedicines] = useState(false);
  const [showOutOfStockMedicinesForPharmacy, setShowOutOfStockMedicinesForPharmacy] = useState(false);

  // Get doctors for currently selected hospital
  const hospitalDoctors = doctors.filter(d => d.hospitalId === selectedHospital.id);

  useEffect(() => {
    loadHospitalSetting(selectedHospital.id).then(() => {
      const defaultDoctor = getDefaultDoctorId(selectedHospital.id);
      setSelectedDoctorId(defaultDoctor || '');

      const config = getPatientIdConfig(selectedHospital.id);
      setPatientIdConfigState(config);

      const printConfig = getPrintColumnSettings(selectedHospital.id);
      setPrintColumns(printConfig);
      const prescriptionPrintConfig = getPrescriptionPrintAssetSettings(selectedHospital.id);
      setPrescriptionPrintAssetSettings(prescriptionPrintConfig);

      setShowOutOfStockMedicines(getShowOutOfStockMedicines(selectedHospital.id));
      setShowOutOfStockMedicinesForPharmacy(getShowOutOfStockMedicinesForPharmacy(selectedHospital.id));

      setTimezone(selectedHospital.timezone || 'Asia/Kabul');
      setCalendarType(selectedHospital.calendarType || 'gregorian');
    });
  }, [selectedHospital.id, selectedHospital.timezone, selectedHospital.calendarType, loadHospitalSetting, getDefaultDoctorId, getPatientIdConfig, getPrintColumnSettings, getPrescriptionPrintAssetSettings, getShowOutOfStockMedicines, getShowOutOfStockMedicinesForPharmacy]);

  const handleSaveDefaultDoctor = () => {
    saveHospitalSetting(selectedHospital.id, { defaultDoctorId: selectedDoctorId || undefined })
      .then(() => toast.success(selectedDoctorId ? 'Default doctor saved successfully' : 'Default doctor cleared'))
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to save default doctor'));
  };

  const handleSavePatientIdConfig = () => {
    saveHospitalSetting(selectedHospital.id, { patientIdConfig })
      .then(() => toast.success('Patient ID settings saved successfully'))
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to save patient ID settings'));
  };

  const handleSavePrintColumns = () => {
    saveHospitalSetting(selectedHospital.id, { printColumns, prescriptionPrintAssetSettings })
      .then(() => toast.success('Print settings saved successfully'))
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to save print settings'));
  };

  const handleSaveTimezone = () => {
    toast.warning('Timezone/Calendar settings not yet wired to backend');
  };

  const handleWalkInToggle = () => {
    const newValue = !getDefaultToWalkIn(selectedHospital.id);
    saveHospitalSetting(selectedHospital.id, { defaultToWalkIn: newValue })
      .then(() => toast.success(newValue ? 'Walk-in patient mode enabled by default' : 'Search patient mode enabled by default'))
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to update walk-in mode'));
  };

  const handleOutOfStockToggle = () => {
    const newValue = !showOutOfStockMedicines;
    setShowOutOfStockMedicines(newValue);
    saveHospitalSetting(selectedHospital.id, { showOutOfStockMedicines: newValue })
      .then(() => toast.success(newValue ? 'Out-of-stock medicines are now visible to doctors' : 'Out-of-stock medicines are now hidden from doctors'))
      .catch((err) => {
        setShowOutOfStockMedicines(!newValue);
        toast.error(err?.response?.data?.message || 'Failed to update medicine visibility');
      });
  };

  const handleOutOfStockPharmacyToggle = () => {
    const newValue = !showOutOfStockMedicinesForPharmacy;
    setShowOutOfStockMedicinesForPharmacy(newValue);
    saveHospitalSetting(selectedHospital.id, { showOutOfStockMedicinesForPharmacy: newValue })
      .then(() => toast.success(newValue ? 'Out-of-stock medicines are now visible to pharmacy' : 'Out-of-stock medicines are now hidden from pharmacy'))
      .catch((err) => {
        setShowOutOfStockMedicinesForPharmacy(!newValue);
        toast.error(err?.response?.data?.message || 'Failed to update pharmacy medicine visibility');
      });
  };

  const selectedDoctor = hospitalDoctors.find(d => d.id === selectedDoctorId);
  
  // Generate preview of patient ID
  const previewPatientId = generatePatientId(selectedHospital.id, 0);
  const previewNextId = generatePatientId(selectedHospital.id, 1);
  const defaultToWalkIn = getDefaultToWalkIn(selectedHospital.id);
  const defaultPrescriptionNextVisit = getDefaultPrescriptionNextVisit(selectedHospital.id);

  const handleDefaultNextVisitToggle = () => {
    const newValue = !defaultPrescriptionNextVisit;
    saveHospitalSetting(selectedHospital.id, { defaultPrescriptionNextVisit: newValue })
      .then(() => toast.success(newValue ? 'Next visit defaults to Yes' : 'Next visit defaults to No'))
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to update next visit default'));
  };

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">General Settings</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Configure default preferences for {selectedHospital.name}</p>
      </div>

      {/* Hospital Selection - Only for Super Admin */}
      {userRole === 'super_admin' && (
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
          <Building2 className="w-4 h-4 text-purple-500 flex-shrink-0" />
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
            Select Hospital
          </label>
          <select
            value={selectedHospitalId}
            onChange={(e) => setSelectedHospitalId(e.target.value)}
            aria-label="Select hospital"
            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
          >
            {hospitals.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Default Doctor Settings - Compact */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Default Doctor</h2>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            Set a default doctor to auto-populate in patient registration and appointment forms
          </p>

          {/* Doctor Selection */}
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select Default Doctor
              </label>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                aria-label="Select default doctor"
                className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">-- No Default Doctor --</option>
                {hospitalDoctors.map(doctor => (
                  <option key={doctor.id} value={doctor.id}>
                    Dr. {doctor.name} - {doctor.specialization}
                  </option>
                ))}
              </select>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveDefaultDoctor}
              className="w-full px-2 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Save Default Doctor
            </button>
          </div>

          {/* Information Box */}
          <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              <strong>How it works:</strong> When creating a new patient or appointment, the doctor field will be automatically filled with the selected default doctor. You can still change it manually if needed.
            </p>
          </div>
        </div>

        {/* Patient ID Configuration - Compact */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Hash className="w-4 h-4 text-green-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Patient ID Configuration</h2>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            Configure how patient IDs are generated and formatted.
          </p>

          {/* Patient ID Configuration Form */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={patientIdConfig.autoGenerate}
                onChange={(e) => setPatientIdConfigState({ ...patientIdConfig, autoGenerate: e.target.checked })}
                aria-label="Auto-generate patient IDs"
                className="w-3.5 h-3.5 text-green-600 dark:text-green-500 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-green-500 dark:focus:ring-green-600"
              />
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Auto-generate Patient IDs
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Prefix
              </label>
              <input
                type="text"
                value={patientIdConfig.prefix}
                onChange={(e) => setPatientIdConfigState({ ...patientIdConfig, prefix: e.target.value })}
                aria-label="Patient ID prefix"
                className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Number
                </label>
                <input
                  type="number"
                  value={patientIdConfig.startNumber}
                  onChange={(e) => setPatientIdConfigState({ ...patientIdConfig, startNumber: parseInt(e.target.value) })}
                  aria-label="Patient ID start number"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Digits
                </label>
                <input
                  type="number"
                  value={patientIdConfig.digits}
                  onChange={(e) => setPatientIdConfigState({ ...patientIdConfig, digits: parseInt(e.target.value) })}
                  aria-label="Patient ID digits"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                Preview:
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Current ID: <span className="font-mono font-semibold text-gray-900 dark:text-white">{previewPatientId}</span>
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Next ID: <span className="font-mono font-semibold text-gray-900 dark:text-white">{previewNextId}</span>
              </p>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSavePatientIdConfig}
              className="w-full px-2 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              Save Patient ID Settings
            </button>
          </div>
        </div>

          {/* Timezone & Calendar Settings - Compact */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Date & Time Settings</h2>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            Set the default timezone and calendar system for the hospital.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                aria-label="Select timezone"
                className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
              >
                {timezones.map(tz => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Calendar System
              </label>
              <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCalendarType('gregorian')}
                  className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                    calendarType === 'gregorian'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  Gregorian
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarType('shamsi')}
                  className={`flex-1 py-1.5 text-xs font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                    calendarType === 'shamsi'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  Hijri Shamsi
                </button>
              </div>
            </div>

            <button
              onClick={handleSaveTimezone}
              className="w-full px-2 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              Save Settings
            </button>
          </div>

          <div className="mt-2 p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              <strong>Current Time:</strong> {new Date().toLocaleTimeString('en-US', { timeZone: timezone })}
            </p>
          </div>
        </div>

        {/* Walk-in Patient Default Mode - NEW */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <UserPlus className="w-4 h-4 text-purple-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Walk-in Patient Mode</h2>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            Set default patient entry mode for prescription creation
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/30">
              <div className="flex-1">
                <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Default to Walk-in</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Enable walk-in patient mode by default
                </p>
              </div>
              <button
                onClick={handleWalkInToggle}
                aria-label="Toggle default walk-in patient mode"
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-2
                  ${defaultToWalkIn
                    ? 'bg-purple-600'
                    : 'bg-gray-300 dark:bg-gray-600'
                  }
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${defaultToWalkIn ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>

            {/* Status Display */}
            <div className={`p-2 rounded-lg border ${
              defaultToWalkIn
                ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
                : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
            }`}>
              <p className={`text-xs font-semibold ${
                defaultToWalkIn
                  ? 'text-purple-700 dark:text-purple-300'
                  : 'text-blue-700 dark:text-blue-300'
              }`}>
                {defaultToWalkIn ? '✓ Walk-in Mode Active' : 'Search Patient Mode Active'}
              </p>
              <p className={`text-xs mt-1 ${
                defaultToWalkIn
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-blue-600 dark:text-blue-400'
              }`}>
                {defaultToWalkIn 
                  ? 'Prescription form will open in walk-in patient mode'
                  : 'Prescription form will open in search patient mode'
                }
              </p>
            </div>

            {/* Information Box */}
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                <strong>Note:</strong> Users can still manually toggle between modes when creating prescriptions.
              </p>
            </div>

            <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/30">
              <div className="flex-1">
                <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Default Next Visit</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  If enabled, prescription form starts with Next Visit = Yes
                </p>
              </div>
              <button
                onClick={handleDefaultNextVisitToggle}
                aria-label="Toggle default next visit option"
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-2
                  ${defaultPrescriptionNextVisit
                    ? 'bg-purple-600'
                    : 'bg-gray-300 dark:bg-gray-600'
                  }
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${defaultPrescriptionNextVisit ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Medicine Visibility for Doctors */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Pill className="w-4 h-4 text-teal-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Prescription Medicine Visibility</h2>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            Control whether doctors can see out-of-stock medicines while creating prescriptions.
          </p>

          <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/30">
            <div className="flex-1">
              <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Show out-of-stock medicines</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                When disabled, only medicines with stock above zero appear in the doctor dropdown.
              </p>
            </div>
            <button
              onClick={handleOutOfStockToggle}
              aria-label="Toggle out-of-stock medicine visibility for doctors"
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-2
                ${showOutOfStockMedicines
                  ? 'bg-teal-600'
                  : 'bg-gray-300 dark:bg-gray-600'
                }
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${showOutOfStockMedicines ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>

          <div className={`p-2 rounded-lg border mt-3 ${
            showOutOfStockMedicines
              ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800'
              : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
          }`}>
            <p className={`text-xs font-semibold ${
              showOutOfStockMedicines
                ? 'text-teal-700 dark:text-teal-300'
                : 'text-gray-700 dark:text-gray-300'
            }`}>
              {showOutOfStockMedicines ? '✓ Out-of-stock medicines visible to doctors' : 'Out-of-stock medicines hidden from doctors'}
            </p>
          </div>
        </div>

        {/* Medicine Visibility for Pharmacy */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Pill className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Pharmacy Medicine Visibility</h2>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            Control whether pharmacy can sell medicines when stock is zero.
          </p>

          <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/30">
            <div className="flex-1">
              <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Allow out-of-stock sales</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                When disabled, pharmacy cannot sell medicines with zero stock.
              </p>
            </div>
            <button
              onClick={handleOutOfStockPharmacyToggle}
              aria-label="Toggle out-of-stock medicine visibility for pharmacy"
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-2
                ${showOutOfStockMedicinesForPharmacy
                  ? 'bg-indigo-600'
                  : 'bg-gray-300 dark:bg-gray-600'
                }
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${showOutOfStockMedicinesForPharmacy ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>

          <div className={`p-2 rounded-lg border mt-3 ${
            showOutOfStockMedicinesForPharmacy
              ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800'
              : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
          }`}>
            <p className={`text-xs font-semibold ${
              showOutOfStockMedicinesForPharmacy
                ? 'text-indigo-700 dark:text-indigo-300'
                : 'text-gray-700 dark:text-gray-300'
            }`}>
              {showOutOfStockMedicinesForPharmacy
                ? '✓ Out-of-stock medicines visible to pharmacy'
                : 'Out-of-stock medicines hidden from pharmacy'}
            </p>
          </div>
        </div>

        {/* Print Settings - Column Visibility */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Printer className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Print Settings</h2>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            Control which columns appear on printed transaction invoices.
          </p>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={printColumns.showBatchColumn}
                onChange={(e) => setPrintColumns({ ...printColumns, showBatchColumn: e.target.checked })}
                aria-label="Show batch column on print"
                className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-emerald-500"
              />
              Show Batch Column
            </label>

            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={printColumns.showExpiryDateColumn}
                onChange={(e) => setPrintColumns({ ...printColumns, showExpiryDateColumn: e.target.checked })}
                aria-label="Show expiry date column on print"
                className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-emerald-500"
              />
              Show Expiry Date Column
            </label>

            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={printColumns.showBonusColumn}
                onChange={(e) => setPrintColumns({ ...printColumns, showBonusColumn: e.target.checked })}
                aria-label="Show bonus column on print"
                className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-emerald-500"
              />
              Show Bonus Column
            </label>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Prescription Logo Width (px)</label>
                <input
                  type="number"
                  min={40}
                  max={800}
                  value={prescriptionPrintAssetSettings.logoWidth}
                  onChange={(e) => setPrescriptionPrintAssetSettings({
                    ...prescriptionPrintAssetSettings,
                    logoWidth: Number(e.target.value || 176),
                  })}
                  aria-label="Prescription logo width"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Prescription Logo Height (px)</label>
                <input
                  type="number"
                  min={40}
                  max={800}
                  value={prescriptionPrintAssetSettings.logoHeight}
                  onChange={(e) => setPrescriptionPrintAssetSettings({
                    ...prescriptionPrintAssetSettings,
                    logoHeight: Number(e.target.value || 160),
                  })}
                  aria-label="Prescription logo height"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Signature Width (px)</label>
                <input
                  type="number"
                  min={40}
                  max={800}
                  value={prescriptionPrintAssetSettings.signatureWidth}
                  onChange={(e) => setPrescriptionPrintAssetSettings({
                    ...prescriptionPrintAssetSettings,
                    signatureWidth: Number(e.target.value || 200),
                  })}
                  aria-label="Prescription signature width"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Signature Height (px)</label>
                <input
                  type="number"
                  min={40}
                  max={800}
                  value={prescriptionPrintAssetSettings.signatureHeight}
                  onChange={(e) => setPrescriptionPrintAssetSettings({
                    ...prescriptionPrintAssetSettings,
                    signatureHeight: Number(e.target.value || 112),
                  })}
                  aria-label="Prescription signature height"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <button
              onClick={handleSavePrintColumns}
              className="w-full px-2 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
            >
              Save Print Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}