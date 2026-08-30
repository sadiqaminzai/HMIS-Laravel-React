import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, User, Hash, UserPlus, Building2, Globe, Printer, Pill, ListChecks, Package, ScanLine, Columns3, BarChart3 } from 'lucide-react';
import {
  useSettings,
  PRINT_PAPER_SIZES,
  PRINT_PAPER_SIZE_LABELS,
  PRINT_MODULE_GROUPS,
  DEFAULT_PRINT_PAPER_SIZES,
  DEFAULT_INVOICE_FIELDS,
  INVOICE_FIELD_KEYS,
  INVOICE_FIELD_LABELS,
  INVOICE_TYPE_LABELS,
  REPORT_DESKS,
  REPORT_INCOME_MODULES,
  DEFAULT_REPORT_MODULE_OWNERS,
  type PrintPaperSize,
  type PrintModule,
  type PharmacyCustomerMode,
  type PharmacyDefaultCustomer,
  type BarcodeType,
  type DefaultSaleUnit,
  type InvoiceFieldSettings,
  type InvoiceFieldKey,
  type InvoiceType,
  type ReportModuleOwners,
  type ReportIncomeModule,
  type ReportDesk,
} from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
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

type SettingsTab = 'general' | 'reception' | 'pharmacy' | 'laboratory' | 'prescription' | 'printing' | 'reports';

export function GeneralSettings({ hospital, userRole }: GeneralSettingsProps) {
  const { t } = useTranslation();
  const { loadHospitalSetting, saveHospitalSetting, getDefaultDoctorId, getDefaultToWalkIn, getDefaultPrescriptionNextVisit, getPatientIdConfig, getPrintColumnSettings, getPrescriptionPrintAssetSettings, getShowOutOfStockMedicines, getShowOutOfStockMedicinesForPharmacy, getShowPrescriptionListMeta, getPrintPaperSizes, getPharmacyCustomerMode, getPharmacyDefaultCustomer, getPharmacyWalkInDefaults, getPharmacyWalkInFields, getDefaultBarcodeType, getDefaultSaleUnit, getBarcodeLabel, getBarcodeScanningEnabled, getLabDefaultPaymentStatus, getDefaultPaymentStatuses, getAllInvoiceFields, getReportModuleOwners, generatePatientId } = useSettings();
  const { hasPermission } = useAuth();
  const canManagePrintSettings = hasPermission('manage_print_settings');
  // Which columns an invoice offers is pharmacy behaviour, so it shares the
  // pharmacy gate rather than the print one.
  const canManagePharmacySettings = hasPermission('manage_pharmacy_settings');
  const canSetLabPaymentDefault = hasPermission('manage_lab_payments');
  const canRecordFinancePayments = hasPermission('record_finance_payments') || hasPermission('manage_finance');
  const canCollectAppointmentFees =
    hasPermission('manage_appointment_payments') || hasPermission('manage_appointments');

  /**
   * One tab per module. Thirteen cards in a single grid meant scrolling past
   * pharmacy settings to reach a laboratory one, and every card competing for
   * attention with the same weight.
   */
  const SETTINGS_TABS: { key: SettingsTab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'reception', label: 'Reception' },
    { key: 'pharmacy', label: 'Pharmacy' },
    { key: 'laboratory', label: 'Laboratory' },
    { key: 'prescription', label: 'Prescription' },
    { key: 'printing', label: 'Printing' },
    { key: 'reports', label: 'Reports' },
  ];
  const { hospitals } = useHospitals();
  const { doctors } = useDoctors();
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  
  // Hospital selection state for super_admin
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>(hospital.id);
  useEffect(() => {
    setSelectedHospitalId(hospital.id);
  }, [hospital.id]);
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

  const [pharmacyCustomerMode, setPharmacyCustomerModeState] = useState<PharmacyCustomerMode>('both');
  const [pharmacyDefaultCustomer, setPharmacyDefaultCustomerState] = useState<PharmacyDefaultCustomer>('patient');
  const [walkInDefaults, setWalkInDefaults] = useState({ name: '', phone: '', address: '' });
  const [walkInFields, setWalkInFields] = useState({ showPhone: true, showAddress: true, nameEditable: true });
  const [defaultBarcodeType, setDefaultBarcodeType] = useState<BarcodeType>('manual');
  const [defaultSaleUnit, setDefaultSaleUnit] = useState<DefaultSaleUnit>('pack');
  const [barcodeLabel, setBarcodeLabel] = useState({ widthMm: 50, heightMm: 25 });
  const [barcodeScanningEnabled, setBarcodeScanningEnabled] = useState(true);
  const [labDefaultPaid, setLabDefaultPaid] = useState(false);
  const [paymentDefaults, setPaymentDefaults] = useState<Record<string, 'paid' | 'pending'>>({
    sales: 'pending',
    sales_return: 'pending',
    purchase: 'pending',
    purchase_return: 'pending',
    appointments: 'pending',
  });
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');
  const [invoiceFields, setInvoiceFields] = useState<InvoiceFieldSettings>({ ...DEFAULT_INVOICE_FIELDS });
  const [reportOwners, setReportOwners] = useState<ReportModuleOwners>({ ...DEFAULT_REPORT_MODULE_OWNERS });

  const [printPaperSizes, setPrintPaperSizes] = useState<Record<PrintModule, PrintPaperSize>>({
    ...DEFAULT_PRINT_PAPER_SIZES,
  });

  const [prescriptionPrintAssetSettings, setPrescriptionPrintAssetSettings] = useState({
    logoWidth: 176,
    logoHeight: 160,
    signatureWidth: 200,
    signatureHeight: 112,
  });

  const [showOutOfStockMedicines, setShowOutOfStockMedicines] = useState(false);
  const [showOutOfStockMedicinesForPharmacy, setShowOutOfStockMedicinesForPharmacy] = useState(false);
  const [showPrescriptionListMeta, setShowPrescriptionListMeta] = useState(true);

  // Get doctors for currently selected hospital
  const hospitalDoctors = doctors.filter(d => d.hospitalId === selectedHospital.id);

  useEffect(() => {
    loadHospitalSetting(selectedHospital.id).then((setting) => {
      if (!setting) {
        toast.error('Unable to load settings for the selected hospital');
        return;
      }
      // Use the exact response that completed this request. Reading through
      // the previous render's getter here returned fallback values on the first
      // load and made Super Admin appear to be editing another hospital.
      setSelectedDoctorId(setting.defaultDoctorId || '');
      setPatientIdConfigState(setting.patientIdConfig);
      setPrintColumns(setting.printColumns);
      setPrintPaperSizes(setting.printPaperSizes);
      setPharmacyCustomerModeState(setting.pharmacyCustomerMode);
      setPharmacyDefaultCustomerState(setting.pharmacyDefaultCustomer);
      setWalkInDefaults(setting.pharmacyWalkInDefaults);
      setWalkInFields(setting.pharmacyWalkInFields);
      setDefaultBarcodeType(setting.defaultBarcodeType);
      setDefaultSaleUnit(setting.defaultSaleUnit);
      setBarcodeLabel(setting.barcodeLabel);
      setBarcodeScanningEnabled(setting.barcodeScanningEnabled);
      setLabDefaultPaid(setting.labDefaultPaymentStatus === 'paid');
      setPaymentDefaults({ ...setting.defaultPaymentStatuses });
      setInvoiceFields(setting.invoiceFields);
      setReportOwners(setting.reportModuleOwners);
      setPrescriptionPrintAssetSettings(setting.prescriptionPrintAssetSettings);
      setShowOutOfStockMedicines(setting.showOutOfStockMedicines);
      setShowOutOfStockMedicinesForPharmacy(setting.showOutOfStockMedicinesForPharmacy);
      setShowPrescriptionListMeta(setting.showPrescriptionListMeta);

      setTimezone(selectedHospital.timezone || 'Asia/Kabul');
      setCalendarType(selectedHospital.calendarType || 'gregorian');
    });
  }, [selectedHospital.id, selectedHospital.timezone, selectedHospital.calendarType, loadHospitalSetting, getDefaultDoctorId, getPatientIdConfig, getPrintColumnSettings, getPrescriptionPrintAssetSettings, getShowOutOfStockMedicines, getShowOutOfStockMedicinesForPharmacy, getShowPrescriptionListMeta]);

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

  const handleSavePrintPaperSizes = () => {
    saveHospitalSetting(selectedHospital.id, { printPaperSizes })
      .then(() => toast.success('Print paper sizes saved successfully'))
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to save print paper sizes'));
  };

  const handleSavePharmacyCustomer = () => {
    if (pharmacyCustomerMode !== 'patient_only' && !walkInFields.nameEditable && !walkInDefaults.name.trim()) {
      toast.error('Enter a default walk-in name before locking the name field');
      return;
    }
    saveHospitalSetting(selectedHospital.id, {
      pharmacyCustomerMode,
      pharmacyDefaultCustomer,
      pharmacyWalkInDefaults: walkInDefaults,
      pharmacyWalkInFields: walkInFields,
      defaultSaleUnit,
    })
      .then(() => toast.success('Pharmacy customer settings saved'))
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to save pharmacy customer settings'));
  };

  const handleSaveInvoiceFields = () => {
    saveHospitalSetting(selectedHospital.id, { invoiceFields })
      .then(() => toast.success('Invoice field settings saved'))
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to save invoice field settings'));
  };

  const toggleInvoiceField = (type: InvoiceType, field: InvoiceFieldKey) => {
    setInvoiceFields((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: !prev[type][field] },
    }));
  };

  const handleSaveReportOwners = () => {
    saveHospitalSetting(selectedHospital.id, { reportModuleOwners: reportOwners })
      .then(() => toast.success('Report ownership saved'))
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to save report ownership'));
  };

  const handleSavePaymentDefaults = () => {
    saveHospitalSetting(selectedHospital.id, { defaultPaymentStatuses: paymentDefaults as any })
      .then(() => toast.success('Payment defaults saved'))
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to save payment defaults'));
  };

  const handleSaveLabDefaults = () => {
    saveHospitalSetting(selectedHospital.id, {
      labDefaultPaymentStatus: labDefaultPaid ? 'paid' : 'unpaid',
    })
      .then(() => toast.success('Laboratory defaults saved'))
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to save laboratory defaults'));
  };

  const handleSaveBarcodeSettings = () => {
    saveHospitalSetting(selectedHospital.id, { defaultBarcodeType, barcodeLabel, barcodeScanningEnabled })
      .then(() => toast.success('Barcode settings saved'))
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to save barcode settings'));
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

  const handlePrescriptionListMetaToggle = () => {
    const newValue = !showPrescriptionListMeta;
    setShowPrescriptionListMeta(newValue);
    saveHospitalSetting(selectedHospital.id, { showPrescriptionListMeta: newValue })
      .then(() => toast.success(newValue
        ? 'Rx and patient reference numbers are visible'
        : 'Rx and patient reference numbers are hidden'))
      .catch((err) => {
        setShowPrescriptionListMeta(!newValue);
        toast.error(err?.response?.data?.message || 'Failed to update prescription list visibility');
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
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{t('ui.selectHospital')}</label>
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

      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSettingsTab(tab.key)}
            className={`px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
              settingsTab === tab.key
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {settingsTab === 'reception' && canCollectAppointmentFees && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">OPD Fees</h2>
          </div>
          <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer select-none">
            <span className="text-xs text-gray-800 dark:text-gray-200">New appointments start as Paid</span>
            <button
              type="button"
              role="switch"
              aria-checked={paymentDefaults.appointments === 'paid'}
              aria-label="New appointments start as paid"
              onClick={() =>
                setPaymentDefaults((prev) => {
                  const next = prev.appointments === 'paid' ? 'pending' : 'paid';
                  toast.info(`Appointment fees default to ${next === 'paid' ? 'Paid' : 'Pending'}`);
                  return { ...prev, appointments: next };
                })
              }
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                paymentDefaults.appointments === 'paid' ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                paymentDefaults.appointments === 'paid' ? 'translate-x-4.5' : 'translate-x-0.5'
              }`} />
            </button>
          </label>
          <button
            onClick={handleSavePaymentDefaults}
            className="mt-2 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
          >
            Save OPD defaults
          </button>
        </div>
        )}

        {settingsTab === 'pharmacy' && canRecordFinancePayments && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Default Payment Status</h2>
          </div>
          {([
            ['sales', 'Sales Invoice'],
            ['sales_return', 'Sales Return'],
            ['purchase', 'Purchase Invoice'],
            ['purchase_return', 'Purchase Return'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3 py-1.5 cursor-pointer select-none">
              <span className="text-xs text-gray-800 dark:text-gray-200">{label} starts as Paid</span>
              <button
                type="button"
                role="switch"
                aria-checked={paymentDefaults[key] === 'paid'}
                aria-label={`${label} starts as paid`}
                onClick={() =>
                  setPaymentDefaults((prev) => {
                    const next = prev[key] === 'paid' ? 'pending' : 'paid';
                    toast.info(`${label} default set to ${next === 'paid' ? 'Paid' : 'Pending'}`);
                    return { ...prev, [key]: next };
                  })
                }
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  paymentDefaults[key] === 'paid' ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  paymentDefaults[key] === 'paid' ? 'translate-x-4.5' : 'translate-x-0.5'
                }`} />
              </button>
            </label>
          ))}
          <button
            onClick={handleSavePaymentDefaults}
            className="mt-2 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
          >
            Save payment defaults
          </button>
        </div>
        )}

        {settingsTab === 'laboratory' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Lab Payments</h2>
          </div>
          {canSetLabPaymentDefault && (
            <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
                <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
                  New lab orders start as Paid
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={labDefaultPaid}
                  aria-label="New lab orders start as paid"
                  onClick={() => setLabDefaultPaid(!labDefaultPaid)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    labDefaultPaid ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    labDefaultPaid ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`} />
                </button>
              </label>
              <button
                onClick={handleSaveLabDefaults}
                className="mt-2 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
              >
                Save laboratory defaults
              </button>
            </div>
          )}

        </div>
        )}

        {/* Default Doctor Settings - Compact */}
        {settingsTab === 'general' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Default Doctor</h2>
          </div>

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

        </div>
        )}

        {/* Patient ID Configuration - Compact */}
        {settingsTab === 'reception' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Hash className="w-4 h-4 text-green-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Patient ID Configuration</h2>
          </div>

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
        )}

          {/* Timezone & Calendar Settings - Compact */}
        {settingsTab === 'general' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Date & Time Settings</h2>
          </div>

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
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ui.calendarSystem')}</label>
              <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCalendarType('gregorian')}
                  className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                    calendarType === 'gregorian'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >{t('ui.gregorian')}</button>
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
            >{t('ui.saveSettings')}</button>
          </div>

          <div className="mt-2 p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              <strong>Current Time:</strong> {new Date().toLocaleTimeString('en-US', { timeZone: timezone })}
            </p>
          </div>
        </div>
        )}

        {/* Walk-in Patient Default Mode - NEW */}
        {settingsTab === 'reception' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <UserPlus className="w-4 h-4 text-purple-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Walk-in Patient Mode</h2>
          </div>

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
        )}

        {/* Medicine Visibility for Doctors */}
        {settingsTab === 'prescription' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Pill className="w-4 h-4 text-teal-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Prescription Medicine Visibility</h2>
          </div>

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
        )}

        {/* Medicine Visibility for Pharmacy */}
        {settingsTab === 'pharmacy' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Pill className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Pharmacy Medicine Visibility</h2>
          </div>

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
        )}

        {/* Prescription List Visibility */}
        {settingsTab === 'prescription' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <ListChecks className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Prescription List Visibility</h2>
          </div>

          <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/30">
            <div className="flex-1">
              <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Show Rx and patient reference numbers</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                When disabled, the Rx number and patient ID are hidden on the printed prescription, and the
                prescription list drops its Rx column, result count, rows-per-page selector and page text.
                Next and previous arrows still work.
              </p>
            </div>
            <button
              onClick={handlePrescriptionListMetaToggle}
              aria-label="Toggle prescription list Rx column and pagination visibility"
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-2
                ${showPrescriptionListMeta
                  ? 'bg-blue-600'
                  : 'bg-gray-300 dark:bg-gray-600'
                }
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${showPrescriptionListMeta ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>

          <div className={`p-2 rounded-lg border mt-3 ${
            showPrescriptionListMeta
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
          }`}>
            <p className={`text-xs font-semibold ${
              showPrescriptionListMeta
                ? 'text-blue-700 dark:text-blue-300'
                : 'text-gray-700 dark:text-gray-300'
            }`}>
              {showPrescriptionListMeta
                ? 'Rx and patient reference numbers visible'
                : 'Rx and patient reference numbers hidden'}
            </p>
          </div>
        </div>
        )}

        {/* Pharmacy - who a sale can be made to */}
        {settingsTab === 'pharmacy' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Pharmacy Customers</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                Customer options
              </label>
              <select
                value={pharmacyCustomerMode}
                title="Pharmacy customer options"
                onChange={(e) => {
                  const mode = e.target.value as PharmacyCustomerMode;
                  setPharmacyCustomerModeState(mode);
                  // Keep the default consistent with the chosen mode.
                  if (mode === 'patient_only') setPharmacyDefaultCustomerState('patient');
                  if (mode === 'walk_in_only') setPharmacyDefaultCustomerState('walk_in');
                }}
                className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs"
              >
                <option value="both">Registered patients and walk-in customers</option>
                <option value="patient_only">Registered patients only</option>
                <option value="walk_in_only">Walk-in customers only (retail pharmacy)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                Default when opening a new sale
              </label>
              <select
                value={pharmacyDefaultCustomer}
                title="Default pharmacy customer"
                disabled={pharmacyCustomerMode !== 'both'}
                onChange={(e) => setPharmacyDefaultCustomerState(e.target.value as PharmacyDefaultCustomer)}
                className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs disabled:opacity-60"
              >
                <option value="patient">Registered Patient</option>
                <option value="walk_in">Walk-in Customer</option>
              </select>
              {pharmacyCustomerMode !== 'both' && (
                <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                  Fixed by the selected customer option.
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
              Default selling unit for new medicines
            </label>
            <select
              value={defaultSaleUnit}
              title="Default selling unit for new medicines"
              onChange={(e) => setDefaultSaleUnit(e.target.value as DefaultSaleUnit)}
              className="w-full md:w-1/2 px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs"
            >
              <option value="pack">Pack / Box</option>
              <option value="strip">Strip</option>
              <option value="piece">Piece</option>
            </select>
            <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
              Applied when a new medicine's packaging makes that unit available. A product
              with no strip or box still sells by the piece.
            </p>
          </div>

          {pharmacyCustomerMode !== 'patient_only' && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Default walk-in customer
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300">Customer Name</label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={walkInFields.nameEditable}
                      title="Allow the walk-in name to be changed on an invoice"
                      onClick={() => setWalkInFields((prev) => ({ ...prev, nameEditable: !prev.nameEditable }))}
                      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${walkInFields.nameEditable ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${walkInFields.nameEditable ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={walkInDefaults.name}
                    onChange={(e) => setWalkInDefaults({ ...walkInDefaults, name: e.target.value })}
                    placeholder="e.g. Walk-in Customer"
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs"
                  />
                  <p className="mt-1 text-[9px] text-gray-500">{walkInFields.nameEditable ? 'Editable on invoice' : 'Locked to this default'}</p>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300">Phone</label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={walkInFields.showPhone}
                      title="Show the walk-in phone field on an invoice"
                      onClick={() => setWalkInFields((prev) => ({ ...prev, showPhone: !prev.showPhone }))}
                      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${walkInFields.showPhone ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${walkInFields.showPhone ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={walkInDefaults.phone}
                    onChange={(e) => setWalkInDefaults({ ...walkInDefaults, phone: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs"
                  />
                  <p className="mt-1 text-[9px] text-gray-500">{walkInFields.showPhone ? 'Shown on invoice' : 'Hidden on invoice'}</p>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300">Address</label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={walkInFields.showAddress}
                      title="Show the walk-in address field on an invoice"
                      onClick={() => setWalkInFields((prev) => ({ ...prev, showAddress: !prev.showAddress }))}
                      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${walkInFields.showAddress ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${walkInFields.showAddress ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={walkInDefaults.address}
                    onChange={(e) => setWalkInDefaults({ ...walkInDefaults, address: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs"
                  />
                  <p className="mt-1 text-[9px] text-gray-500">{walkInFields.showAddress ? 'Shown on invoice' : 'Hidden on invoice'}</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleSavePharmacyCustomer}
            className="mt-3 w-full px-3 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors font-medium text-xs"
          >
            Save Pharmacy Customer Settings
          </button>
        </div>
        )}

        {/* Barcode defaults and label size */}
        {settingsTab === 'pharmacy' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <ScanLine className="w-4 h-4 text-purple-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Barcodes</h2>
          </div>

          <label className="flex items-center justify-between gap-3 mb-3 cursor-pointer select-none">
            <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
              Enable barcode / QR scanning
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={barcodeScanningEnabled}
              aria-label="Enable barcode scanning"
              onClick={() => setBarcodeScanningEnabled(!barcodeScanningEnabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                barcodeScanningEnabled ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                barcodeScanningEnabled ? 'translate-x-4.5' : 'translate-x-0.5'
              }`} />
            </button>
          </label>

          <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 ${barcodeScanningEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
            <div>
              <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                Default barcode type
              </label>
              <select
                value={defaultBarcodeType}
                title="Default barcode type"
                onChange={(e) => setDefaultBarcodeType(e.target.value as BarcodeType)}
                className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs"
              >
                <option value="manual">Manual (typed)</option>
                <option value="manufacturer">Manufacturer (scanned)</option>
                <option value="system">System Generated</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                Label width (mm)
              </label>
              <input
                type="number"
                min={20}
                max={210}
                title="Label width in millimetres"
                value={barcodeLabel.widthMm}
                onChange={(e) => setBarcodeLabel({ ...barcodeLabel, widthMm: Number(e.target.value) })}
                className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                Label height (mm)
              </label>
              <input
                type="number"
                min={10}
                max={297}
                title="Label height in millimetres"
                value={barcodeLabel.heightMm}
                onChange={(e) => setBarcodeLabel({ ...barcodeLabel, heightMm: Number(e.target.value) })}
                className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs"
              />
            </div>
          </div>

          <button
            onClick={handleSaveBarcodeSettings}
            className="mt-3 w-full px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-medium text-xs"
          >
            Save Barcode Settings
          </button>
        </div>
        )}

        {/* Print Settings - Paper Size per Module */}
        {settingsTab === 'printing' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Printer className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Print Paper Size</h2>
          </div>

          {!canManagePrintSettings && (
            <p className="mb-3 px-2 py-1.5 rounded bg-amber-50 dark:bg-amber-900/20 text-[11px] text-amber-700 dark:text-amber-300">
              You do not have permission to change print paper sizes. Values below are read-only.
            </p>
          )}

          <div className="space-y-3">
            {PRINT_MODULE_GROUPS.map(({ group, modules }) => (
              <div key={group}>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
                  {group}
                </h3>
                <div className="space-y-1.5">
                  {modules.map(({ key, label }) => (
                    <div key={key} className="grid grid-cols-2 gap-2 items-center">
                      <label htmlFor={`paper-size-${key}`} className="text-xs text-gray-700 dark:text-gray-300">
                        {label}
                      </label>
                      <select
                        id={`paper-size-${key}`}
                        value={printPaperSizes[key]}
                        disabled={!canManagePrintSettings}
                        onChange={(e) => setPrintPaperSizes({
                          ...printPaperSizes,
                          [key]: e.target.value as PrintPaperSize,
                        })}
                        className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {PRINT_PAPER_SIZES.map((size) => (
                          <option key={size} value={size}>{PRINT_PAPER_SIZE_LABELS[size]}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {canManagePrintSettings && (
            <button
              onClick={handleSavePrintPaperSizes}
              className="mt-3 w-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Save Paper Sizes
            </button>
          )}
        </div>
        )}

        {/* Report Ownership - which desk reports each income module */}
        {settingsTab === 'reports' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-orange-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Report Ownership</h2>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3 leading-snug">
            Choose which desk reports each stream of income. Most hospitals run one
            finance officer at reception who reconciles everything; others let the
            pharmacy keep its own sales, or the lab its own orders. A module&rsquo;s
            money appears under the Reports tab chosen here &mdash; users still need
            that tab&rsquo;s own permission to open it.
          </p>

          <div className="space-y-1.5">
            {REPORT_INCOME_MODULES.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-2 gap-2 items-center">
                <label htmlFor={`report-owner-${key}`} className="text-xs text-gray-700 dark:text-gray-300">
                  {label}
                </label>
                <select
                  id={`report-owner-${key}`}
                  value={reportOwners[key as ReportIncomeModule]}
                  onChange={(e) => setReportOwners({
                    ...reportOwners,
                    [key]: e.target.value as ReportDesk,
                  })}
                  className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {REPORT_DESKS.map((desk) => (
                    <option key={desk.key} value={desk.key}>{desk.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <button
            onClick={handleSaveReportOwners}
            className="mt-3 w-full px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Save Report Ownership
          </button>
        </div>
        )}

        {/* Invoice Fields - per transaction type */}
        {settingsTab === 'pharmacy' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Columns3 className="w-4 h-4 text-cyan-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Invoice Fields</h2>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3 leading-snug">
            Choose which optional columns each invoice type shows. A counter sale
            normally does not need Batch or Expiry &mdash; the system already picks the
            nearest-expiry lot automatically (FIFO) &mdash; while a purchase records
            everything the supplier delivered. Hiding a column only removes the input;
            batch and expiry are still tracked behind the scenes.
          </p>

          {!canManagePharmacySettings && (
            <p className="mb-3 px-2 py-1.5 rounded bg-amber-50 dark:bg-amber-900/20 text-[11px] text-amber-700 dark:text-amber-300">
              You do not have permission to change invoice fields. Values below are read-only.
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-1.5 pr-2 font-semibold text-gray-600 dark:text-gray-300">Invoice Type</th>
                  {INVOICE_FIELD_KEYS.map((field) => (
                    <th key={field} className="py-1.5 px-1 font-semibold text-gray-600 dark:text-gray-300 text-center whitespace-nowrap">
                      {INVOICE_FIELD_LABELS[field]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {INVOICE_TYPE_LABELS.map(({ key, label, hint }) => (
                  <tr key={key} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <td className="py-1.5 pr-2 align-top">
                      <div className="font-medium text-gray-900 dark:text-white">{label}</div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">{hint}</div>
                    </td>
                    {INVOICE_FIELD_KEYS.map((field) => (
                      <td key={field} className="py-1.5 px-1 text-center align-middle">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={invoiceFields[key][field]}
                          aria-label={`${label} \u2013 ${INVOICE_FIELD_LABELS[field]}`}
                          disabled={!canManagePharmacySettings}
                          onClick={() => toggleInvoiceField(key, field)}
                          className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                            invoiceFields[key][field] ? 'bg-cyan-600' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        >
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            invoiceFields[key][field] ? 'translate-x-4.5' : 'translate-x-0.5'
                          }`} />
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canManagePharmacySettings && (
            <button
              onClick={handleSaveInvoiceFields}
              className="mt-3 w-full px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Save Invoice Fields
            </button>
          )}
        </div>
        )}

        {/* Print Settings - Column Visibility */}
        {settingsTab === 'printing' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Printer className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Print Settings</h2>
          </div>

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
        )}
      </div>
    </div>
  );
}
