import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../../api/axios';

export type DateFormat = 'gregorian' | 'hijri_shamsi';

export interface PatientIdConfig {
  autoGenerate: boolean;
  prefix: string;
  startNumber: number;
  digits: number;
}

export interface PrintColumnSettings {
  showBatchColumn: boolean;
  showExpiryDateColumn: boolean;
  showBonusColumn: boolean;
}

export interface PrescriptionPrintAssetSettings {
  logoWidth: number;
  logoHeight: number;
  signatureWidth: number;
  signatureHeight: number;
}

export type PrintPaperSize = 'a4' | 'a5' | '80mm' | '76mm' | '58mm';

export const PRINT_PAPER_SIZES: PrintPaperSize[] = ['a4', 'a5', '80mm', '76mm', '58mm'];

export const PRINT_PAPER_SIZE_LABELS: Record<PrintPaperSize, string> = {
  a4: 'A4 (Full Page)',
  a5: 'A5 (Half Page)',
  '80mm': '80mm Thermal (Mini Printer)',
  '76mm': '76mm Thermal (Mini Printer)',
  '58mm': '58mm Thermal (Mini Printer)',
};

/**
 * Every printable document is configured separately: counter receipts usually go to
 * a thermal mini printer while purchase invoices, lab reports and discharge
 * summaries go to A4. Keys must match config/print.php on the backend.
 */
export type PrintModule =
  | 'pharmacy_sales_invoice'
  | 'pharmacy_purchase_invoice'
  | 'pharmacy_sales_return_invoice'
  | 'pharmacy_purchase_return_invoice'
  | 'patient_card'
  | 'appointment_receipt'
  | 'lab_invoice'
  | 'lab_report'
  | 'surgery_receipt'
  | 'surgery_discharge_summary'
  | 'room_booking_receipt'
  | 'expense_receipt'
  | 'other_income_receipt'
  | 'prescription';

export const PRINT_MODULE_GROUPS: { group: string; modules: { key: PrintModule; label: string }[] }[] = [
  {
    group: 'Pharmacy',
    modules: [
      { key: 'pharmacy_sales_invoice', label: 'Sales Invoice' },
      { key: 'pharmacy_purchase_invoice', label: 'Purchase Invoice' },
      { key: 'pharmacy_sales_return_invoice', label: 'Return In (Sales Return)' },
      { key: 'pharmacy_purchase_return_invoice', label: 'Return Out (Purchase Return)' },
    ],
  },
  {
    group: 'Reception',
    modules: [
      { key: 'patient_card', label: 'Patient Registration Card' },
      { key: 'appointment_receipt', label: 'Appointment / OPD Bill' },
      { key: 'room_booking_receipt', label: 'Room Booking Receipt' },
    ],
  },
  {
    group: 'Laboratory',
    modules: [
      { key: 'lab_invoice', label: 'Lab Invoice / Receipt' },
      { key: 'lab_report', label: 'Lab Test Report' },
    ],
  },
  {
    group: 'Surgery',
    modules: [
      { key: 'surgery_receipt', label: 'Surgery Receipt' },
      { key: 'surgery_discharge_summary', label: 'Discharge Summary' },
    ],
  },
  {
    group: 'Finance & Prescriptions',
    modules: [
      { key: 'expense_receipt', label: 'Expense Receipt' },
      { key: 'other_income_receipt', label: 'Other Income Receipt' },
      { key: 'prescription', label: 'Prescription' },
    ],
  },
];

export const DEFAULT_PRINT_PAPER_SIZES: Record<PrintModule, PrintPaperSize> = {
  pharmacy_sales_invoice: '80mm',
  pharmacy_purchase_invoice: 'a4',
  pharmacy_sales_return_invoice: '80mm',
  pharmacy_purchase_return_invoice: 'a4',
  patient_card: 'a4',
  appointment_receipt: '80mm',
  lab_invoice: '80mm',
  lab_report: 'a4',
  surgery_receipt: '80mm',
  surgery_discharge_summary: 'a4',
  room_booking_receipt: '80mm',
  expense_receipt: 'a4',
  other_income_receipt: 'a4',
  prescription: 'a4',
};

export interface HospitalSetting {
  hospitalId: string;
  defaultDoctorId?: string;
  defaultToWalkIn: boolean;
  defaultPrescriptionNextVisit: boolean;
  patientIdConfig: PatientIdConfig;
  printColumns: PrintColumnSettings;
  prescriptionPrintAssetSettings: PrescriptionPrintAssetSettings;
  showOutOfStockMedicines: boolean;
  showOutOfStockMedicinesForPharmacy: boolean;
  showPrescriptionListMeta: boolean;
  /** Paper size configured per printable document for this hospital. */
  printPaperSizes: Record<PrintModule, PrintPaperSize>;
}

interface Settings {
  dateFormat: DateFormat;
  defaultDoctorId?: { [hospitalId: string]: string }; // Hospital-specific default doctor
  patientIdConfig?: { [hospitalId: string]: PatientIdConfig }; // Hospital-specific patient ID config
  defaultToWalkIn?: boolean; // Default to walk-in patient mode in prescription creation
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;
  getDefaultDoctorId: (hospitalId: string) => string | undefined;
  getDefaultToWalkIn: (hospitalId: string) => boolean;
  getDefaultPrescriptionNextVisit: (hospitalId: string) => boolean;
  getPatientIdConfig: (hospitalId: string) => PatientIdConfig;
  getPrintColumnSettings: (hospitalId: string) => PrintColumnSettings;
  getPrescriptionPrintAssetSettings: (hospitalId: string) => PrescriptionPrintAssetSettings;
  getShowOutOfStockMedicines: (hospitalId: string) => boolean;
  getShowOutOfStockMedicinesForPharmacy: (hospitalId: string) => boolean;
  getShowPrescriptionListMeta: (hospitalId: string) => boolean;
  getPrintPaperSize: (hospitalId: string, module: PrintModule) => PrintPaperSize;
  getPrintPaperSizes: (hospitalId: string) => Record<PrintModule, PrintPaperSize>;
  generatePatientId: (hospitalId: string, currentCount: number) => string;
  loadHospitalSetting: (hospitalId: string) => Promise<void>;
  saveHospitalSetting: (hospitalId: string, payload: Partial<HospitalSetting>) => Promise<void>;
}

const defaultPatientIdConfig: PatientIdConfig = {
  autoGenerate: true,
  prefix: 'P',
  startNumber: 1,
  digits: 5
};

const defaultPrintColumns: PrintColumnSettings = {
  showBatchColumn: true,
  showExpiryDateColumn: true,
  showBonusColumn: true,
};

const defaultPrescriptionPrintAssetSettings: PrescriptionPrintAssetSettings = {
  logoWidth: 176,
  logoHeight: 160,
  signatureWidth: 200,
  signatureHeight: 112,
};

const defaultSettings: Settings = {
  dateFormat: 'gregorian',
  defaultDoctorId: {},
  patientIdConfig: {},
  defaultToWalkIn: false
};

const normalizePaperSizes = (raw: unknown): Record<PrintModule, PrintPaperSize> => {
  const stored = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  const resolved = { ...DEFAULT_PRINT_PAPER_SIZES };

  (Object.keys(DEFAULT_PRINT_PAPER_SIZES) as PrintModule[]).forEach((module) => {
    const candidate = String(stored[module] ?? '').toLowerCase() as PrintPaperSize;
    if (PRINT_PAPER_SIZES.includes(candidate)) resolved[module] = candidate;
  });

  return resolved;
};

const toPositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.round(parsed);
};

// Create context with default value
const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  updateSettings: () => {},
  getDefaultDoctorId: () => undefined,
  getDefaultToWalkIn: () => false,
  getDefaultPrescriptionNextVisit: () => false,
  getPatientIdConfig: () => defaultPatientIdConfig,
  getPrintColumnSettings: () => defaultPrintColumns,
  getPrescriptionPrintAssetSettings: () => defaultPrescriptionPrintAssetSettings,
  getShowOutOfStockMedicines: () => false,
  getShowOutOfStockMedicinesForPharmacy: () => false,
  getShowPrescriptionListMeta: () => true,
  getPrintPaperSize: (_hospitalId: string, module: PrintModule) => DEFAULT_PRINT_PAPER_SIZES[module],
  getPrintPaperSizes: () => ({ ...DEFAULT_PRINT_PAPER_SIZES }),
  generatePatientId: () => 'P0001',
  loadHospitalSetting: async () => {},
  saveHospitalSetting: async () => {}
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const stored = localStorage.getItem('app_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure all required fields exist
        return {
          dateFormat: parsed.dateFormat || 'gregorian',
          defaultDoctorId: parsed.defaultDoctorId || {},
          patientIdConfig: parsed.patientIdConfig || {},
          defaultToWalkIn: parsed.defaultToWalkIn || false
        };
      }
    } catch (error) {
      console.error('Error loading settings from localStorage:', error);
      // Clear corrupted data
      try {
        localStorage.removeItem('app_settings');
      } catch (e) {
        console.error('Error clearing localStorage:', e);
      }
    }
    // Default settings
    return { ...defaultSettings };
  });

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('app_settings', JSON.stringify(updated));
      } catch (error) {
        console.error('Error saving settings to localStorage:', error);
      }
      return updated;
    });
  };

  const [settingsByHospital, setSettingsByHospital] = useState<Record<string, HospitalSetting>>({});

  const loadHospitalSetting = async (hospitalId: string) => {
    if (!hospitalId) return;
    if (settingsByHospital[hospitalId]) return;
    try {
      const { data } = await api.get(`/hospital-settings/${hospitalId}`);
      setSettingsByHospital((prev) => ({
        ...prev,
        [hospitalId]: normalizeSetting(data)
      }));
    } catch (error) {
      console.error('Failed to load hospital setting', error);
    }
  };

  const saveHospitalSetting = async (hospitalId: string, payload: Partial<HospitalSetting>) => {
    const body: any = {};
    if (payload.defaultDoctorId !== undefined) body.default_doctor_id = payload.defaultDoctorId || null;
    if (payload.defaultToWalkIn !== undefined) body.default_to_walk_in = payload.defaultToWalkIn;
    if (payload.defaultPrescriptionNextVisit !== undefined) body.default_prescription_next_visit = payload.defaultPrescriptionNextVisit;
    if (payload.patientIdConfig) {
      body.patient_id_prefix = payload.patientIdConfig.prefix;
      body.patient_id_start = payload.patientIdConfig.startNumber;
      body.patient_id_digits = payload.patientIdConfig.digits;
      body.auto_generate_patient_ids = payload.patientIdConfig.autoGenerate;
    }
    if (payload.printColumns) {
      body.print_show_batch_column = payload.printColumns.showBatchColumn;
      body.print_show_expiry_date_column = payload.printColumns.showExpiryDateColumn;
      body.print_show_bonus_column = payload.printColumns.showBonusColumn;
    }
    if (payload.prescriptionPrintAssetSettings) {
      body.prescription_logo_width = payload.prescriptionPrintAssetSettings.logoWidth;
      body.prescription_logo_height = payload.prescriptionPrintAssetSettings.logoHeight;
      body.prescription_signature_width = payload.prescriptionPrintAssetSettings.signatureWidth;
      body.prescription_signature_height = payload.prescriptionPrintAssetSettings.signatureHeight;
    }
    if (payload.showOutOfStockMedicines !== undefined) {
      body.show_out_of_stock_medicines_to_doctors = payload.showOutOfStockMedicines;
    }
    if (payload.showOutOfStockMedicinesForPharmacy !== undefined) {
      body.show_out_of_stock_medicines_to_pharmacy = payload.showOutOfStockMedicinesForPharmacy;
    }
    if (payload.showPrescriptionListMeta !== undefined) {
      body.show_prescription_list_meta = payload.showPrescriptionListMeta;
    }
    if (payload.printPaperSizes !== undefined) {
      body.print_paper_sizes = payload.printPaperSizes;
    }

    const { data } = await api.put(`/hospital-settings/${hospitalId}`, body);
    setSettingsByHospital((prev) => ({
      ...prev,
      [hospitalId]: normalizeSetting(data)
    }));
  };

  const normalizeSetting = (raw: any): HospitalSetting => {
    return {
      hospitalId: String(raw.hospital_id ?? raw.id ?? ''),
      defaultDoctorId: raw.default_doctor_id ? String(raw.default_doctor_id) : undefined,
      defaultToWalkIn: Boolean(raw.default_to_walk_in),
      defaultPrescriptionNextVisit: Boolean(raw.default_prescription_next_visit ?? false),
      patientIdConfig: {
        autoGenerate: raw.auto_generate_patient_ids ?? true,
        prefix: raw.patient_id_prefix ?? 'P',
        startNumber: Number(raw.patient_id_start ?? 1),
        digits: Number(raw.patient_id_digits ?? 5),
      },
      printColumns: {
        showBatchColumn: raw.print_show_batch_column ?? true,
        showExpiryDateColumn: raw.print_show_expiry_date_column ?? true,
        showBonusColumn: raw.print_show_bonus_column ?? true,
      },
      prescriptionPrintAssetSettings: {
        logoWidth: toPositiveInt(raw.prescription_logo_width, defaultPrescriptionPrintAssetSettings.logoWidth),
        logoHeight: toPositiveInt(raw.prescription_logo_height, defaultPrescriptionPrintAssetSettings.logoHeight),
        signatureWidth: toPositiveInt(raw.prescription_signature_width, defaultPrescriptionPrintAssetSettings.signatureWidth),
        signatureHeight: toPositiveInt(raw.prescription_signature_height, defaultPrescriptionPrintAssetSettings.signatureHeight),
      },
      showOutOfStockMedicines: Boolean(raw.show_out_of_stock_medicines_to_doctors ?? false),
      showOutOfStockMedicinesForPharmacy: Boolean(raw.show_out_of_stock_medicines_to_pharmacy ?? false),
      showPrescriptionListMeta: Boolean(raw.show_prescription_list_meta ?? true),
      printPaperSizes: normalizePaperSizes(raw.print_paper_sizes),
    };
  };

  const getHospitalSetting = (hospitalId: string): HospitalSetting => {
    return settingsByHospital[hospitalId] || {
      hospitalId,
      defaultDoctorId: undefined,
      defaultToWalkIn: false,
      defaultPrescriptionNextVisit: false,
      patientIdConfig: { ...defaultPatientIdConfig },
      printColumns: { ...defaultPrintColumns },
      prescriptionPrintAssetSettings: { ...defaultPrescriptionPrintAssetSettings },
      showOutOfStockMedicines: false,
      showOutOfStockMedicinesForPharmacy: false,
      showPrescriptionListMeta: true,
      printPaperSizes: { ...DEFAULT_PRINT_PAPER_SIZES },
    };
  };

  const getDefaultDoctorId = (hospitalId: string) => {
    return getHospitalSetting(hospitalId).defaultDoctorId;
  };

  const getDefaultToWalkIn = (hospitalId: string) => {
    return getHospitalSetting(hospitalId).defaultToWalkIn;
  };

  const getDefaultPrescriptionNextVisit = (hospitalId: string) => {
    return getHospitalSetting(hospitalId).defaultPrescriptionNextVisit;
  };

  const getPatientIdConfig = (hospitalId: string): PatientIdConfig => {
    return getHospitalSetting(hospitalId).patientIdConfig;
  };

  const getPrintColumnSettings = (hospitalId: string): PrintColumnSettings => {
    return getHospitalSetting(hospitalId).printColumns;
  };

  const getPrescriptionPrintAssetSettings = (hospitalId: string): PrescriptionPrintAssetSettings => {
    return getHospitalSetting(hospitalId).prescriptionPrintAssetSettings;
  };

  const getShowOutOfStockMedicines = (hospitalId: string): boolean => {
    return getHospitalSetting(hospitalId).showOutOfStockMedicines;
  };

  const getShowOutOfStockMedicinesForPharmacy = (hospitalId: string): boolean => {
    return getHospitalSetting(hospitalId).showOutOfStockMedicinesForPharmacy;
  };

  const getShowPrescriptionListMeta = (hospitalId: string): boolean => {
    return getHospitalSetting(hospitalId).showPrescriptionListMeta;
  };

  const getPrintPaperSize = (hospitalId: string, module: PrintModule): PrintPaperSize => {
    return getHospitalSetting(hospitalId).printPaperSizes[module] ?? DEFAULT_PRINT_PAPER_SIZES[module];
  };

  const getPrintPaperSizes = (hospitalId: string): Record<PrintModule, PrintPaperSize> => {
    return getHospitalSetting(hospitalId).printPaperSizes;
  };

  const generatePatientId = (hospitalId: string, currentCount: number): string => {
    const config = getPatientIdConfig(hospitalId);
    const number = (config.startNumber + currentCount).toString().padStart(config.digits, '0');
    return `${config.prefix}${number}`;
  };

  return (
    <SettingsContext.Provider value={{ 
      settings, 
      updateSettings, 
      getDefaultDoctorId,
      getDefaultToWalkIn,
      getDefaultPrescriptionNextVisit,
      getPatientIdConfig,
      getPrintColumnSettings,
      getPrescriptionPrintAssetSettings,
      getShowOutOfStockMedicines,
      getShowOutOfStockMedicinesForPharmacy,
      getShowPrescriptionListMeta,
      getPrintPaperSize,
      getPrintPaperSizes,
      generatePatientId,
      loadHospitalSetting,
      saveHospitalSetting
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  return context;
}
