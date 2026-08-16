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

/** Which customer options the pharmacy sale screen offers for this hospital. */
export type PharmacyCustomerMode = 'patient_only' | 'walk_in_only' | 'both';
export type PharmacyDefaultCustomer = 'patient' | 'walk_in';
export type BarcodeType = 'manual' | 'manufacturer' | 'system';
/** Preferred selling unit for NEW medicines. */
export type DefaultSaleUnit = 'piece' | 'strip' | 'pack';

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

/**
 * Optional columns on the pharmacy invoice entry form. Hiding one only removes
 * the input -- batch and expiry are still resolved by FIFO and stored, so stock
 * tracking is unaffected.
 */
export type InvoiceFieldKey = 'batch' | 'expiry' | 'bonus' | 'discount' | 'tax';
export type InvoiceType = 'sales' | 'sales_return' | 'purchase' | 'purchase_return';

export const INVOICE_FIELD_KEYS: InvoiceFieldKey[] = ['batch', 'expiry', 'bonus', 'discount', 'tax'];

export const INVOICE_FIELD_LABELS: Record<InvoiceFieldKey, string> = {
  batch: 'Batch',
  expiry: 'Expiry',
  bonus: 'Bonus',
  discount: 'Discount %',
  tax: 'Tax %',
};

export const INVOICE_TYPE_LABELS: { key: InvoiceType; label: string; hint: string }[] = [
  { key: 'sales', label: 'Sales Invoice', hint: 'Counter sale \u2014 batch and expiry are picked automatically by FIFO' },
  { key: 'sales_return', label: 'Return In (Sales Return)', hint: 'Returned goods must go back to the right lot' },
  { key: 'purchase', label: 'Purchase Invoice', hint: 'Goods received from a supplier' },
  { key: 'purchase_return', label: 'Return Out (Purchase Return)', hint: 'Mirrors the purchase it reverses' },
];

export type InvoiceFieldSettings = Record<InvoiceType, Record<InvoiceFieldKey, boolean>>;

/** Must match config/invoice_fields.php on the backend. */
export const DEFAULT_INVOICE_FIELDS: InvoiceFieldSettings = {
  sales: { batch: false, expiry: false, bonus: false, discount: true, tax: false },
  sales_return: { batch: true, expiry: true, bonus: false, discount: true, tax: false },
  purchase: { batch: true, expiry: true, bonus: true, discount: true, tax: true },
  purchase_return: { batch: true, expiry: true, bonus: true, discount: true, tax: true },
};

/**
 * Which reporting desk owns each income module. Hospitals split financial
 * responsibility differently -- one officer for everything, or the pharmacy
 * keeping its own sales -- so this is configured rather than hard-coded.
 * Keys match the `module` value on ledger entries.
 */
export type ReportDesk = 'reception' | 'pharmacy' | 'laboratory' | 'radiology';
export type ReportIncomeModule =
  | 'pharmacy' | 'appointments' | 'laboratory' | 'radiology' | 'surgery' | 'room_booking';

export const REPORT_DESKS: { key: ReportDesk; label: string }[] = [
  { key: 'reception', label: 'Reception / Finance' },
  { key: 'pharmacy', label: 'Pharmacy' },
  { key: 'laboratory', label: 'Laboratory' },
  { key: 'radiology', label: 'Radiology' },
];

export const REPORT_INCOME_MODULES: { key: ReportIncomeModule; label: string }[] = [
  { key: 'pharmacy', label: 'Medicine Sale' },
  { key: 'appointments', label: 'Appointment Fees' },
  { key: 'laboratory', label: 'Laboratory Fees' },
  { key: 'radiology', label: 'Ultrasound / Radiology Fees' },
  { key: 'surgery', label: 'Surgery Fees' },
  { key: 'room_booking', label: 'Room Booking Fees' },
];

export type ReportModuleOwners = Record<ReportIncomeModule, ReportDesk>;

/** Must match config/report_ownership.php on the backend. */
export const DEFAULT_REPORT_MODULE_OWNERS: ReportModuleOwners = {
  pharmacy: 'pharmacy',
  appointments: 'reception',
  laboratory: 'reception',
  radiology: 'reception',
  surgery: 'reception',
  room_booking: 'reception',
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
  /** Optional invoice columns configured per transaction type. */
  invoiceFields: InvoiceFieldSettings;
  /** Which reports desk each income module's money is reported under. */
  reportModuleOwners: ReportModuleOwners;
  /** Payment status a new document of each type starts on. */
  defaultPaymentStatuses: Record<'sales' | 'sales_return' | 'purchase' | 'purchase_return' | 'appointments', 'paid' | 'pending'>;
  /** Whether pharmacy sales accept registered patients, walk-ins, or both. */
  pharmacyCustomerMode: PharmacyCustomerMode;
  pharmacyDefaultCustomer: PharmacyDefaultCustomer;
  /** Pre-filled on every new walk-in sale so the counter is not retyped daily. */
  pharmacyWalkInDefaults: { name: string; phone: string; address: string };
  /** Barcode type a new medicine starts on, and the label size for the barcode printer. */
  defaultBarcodeType: BarcodeType;
  defaultSaleUnit: DefaultSaleUnit;
  /** Master switch for barcode/QR scanning across products and invoices. */
  barcodeScanningEnabled: boolean;
  /**
   * Whether a new lab order starts already settled.
   *
   * Hospitals that collect at the counter before entering the order would
   * otherwise have to mark every single order paid by hand.
   */
  labDefaultPaymentStatus: 'paid' | 'unpaid';
  barcodeLabel: { widthMm: number; heightMm: number };
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
  getInvoiceFields: (hospitalId: string, type: InvoiceType) => Record<InvoiceFieldKey, boolean>;
  getAllInvoiceFields: (hospitalId: string) => InvoiceFieldSettings;
  getReportModuleOwners: (hospitalId: string) => ReportModuleOwners;
  getPharmacyCustomerMode: (hospitalId: string) => PharmacyCustomerMode;
  getPharmacyDefaultCustomer: (hospitalId: string) => PharmacyDefaultCustomer;
  getPharmacyWalkInDefaults: (hospitalId: string) => { name: string; phone: string; address: string };
  getDefaultBarcodeType: (hospitalId: string) => BarcodeType;
  getDefaultSaleUnit: (hospitalId: string) => DefaultSaleUnit;
  getBarcodeScanningEnabled: (hospitalId: string) => boolean;
  getLabDefaultPaymentStatus: (hospitalId: string) => 'paid' | 'unpaid';
  getDefaultPaymentStatuses: (hospitalId: string) => HospitalSetting['defaultPaymentStatuses'];
  getBarcodeLabel: (hospitalId: string) => { widthMm: number; heightMm: number };
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

const normalizeInvoiceFields = (raw: unknown): InvoiceFieldSettings => {
  const stored = (raw && typeof raw === 'object') ? raw as Record<string, any> : {};
  const resolved = {} as InvoiceFieldSettings;

  (Object.keys(DEFAULT_INVOICE_FIELDS) as InvoiceType[]).forEach((type) => {
    const storedType = (stored[type] && typeof stored[type] === 'object') ? stored[type] : {};
    resolved[type] = { ...DEFAULT_INVOICE_FIELDS[type] };
    INVOICE_FIELD_KEYS.forEach((field) => {
      if (storedType[field] !== undefined) resolved[type][field] = Boolean(storedType[field]);
    });
  });

  return resolved;
};

const normalizeReportOwners = (raw: unknown): ReportModuleOwners => {
  const stored = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  const allowed = REPORT_DESKS.map((d) => d.key);
  const resolved = { ...DEFAULT_REPORT_MODULE_OWNERS };

  (Object.keys(DEFAULT_REPORT_MODULE_OWNERS) as ReportIncomeModule[]).forEach((module) => {
    const candidate = String(stored[module] ?? '') as ReportDesk;
    if (allowed.includes(candidate)) resolved[module] = candidate;
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
  getInvoiceFields: (_hospitalId: string, type: InvoiceType) => ({ ...DEFAULT_INVOICE_FIELDS[type] }),
  getAllInvoiceFields: () => ({ ...DEFAULT_INVOICE_FIELDS }),
  getReportModuleOwners: () => ({ ...DEFAULT_REPORT_MODULE_OWNERS }),
  getPharmacyCustomerMode: () => 'both' as PharmacyCustomerMode,
  getPharmacyDefaultCustomer: () => 'patient' as PharmacyDefaultCustomer,
  getPharmacyWalkInDefaults: () => ({ name: '', phone: '', address: '' }),
  getDefaultBarcodeType: () => 'manual' as BarcodeType,
  getDefaultSaleUnit: () => 'pack' as DefaultSaleUnit,
  getBarcodeScanningEnabled: () => true,
  getLabDefaultPaymentStatus: () => 'unpaid',
  getDefaultPaymentStatuses: () => ({
    sales: 'pending',
    sales_return: 'pending',
    purchase: 'pending',
    purchase_return: 'pending',
    appointments: 'pending',
  }),
  getBarcodeLabel: () => ({ widthMm: 50, heightMm: 25 }),
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
    if (payload.pharmacyCustomerMode !== undefined) {
      body.pharmacy_customer_mode = payload.pharmacyCustomerMode;
    }
    if (payload.pharmacyDefaultCustomer !== undefined) {
      body.pharmacy_default_customer = payload.pharmacyDefaultCustomer;
    }
    if (payload.pharmacyWalkInDefaults !== undefined) {
      body.pharmacy_walk_in_default_name = payload.pharmacyWalkInDefaults.name;
      body.pharmacy_walk_in_default_phone = payload.pharmacyWalkInDefaults.phone;
      body.pharmacy_walk_in_default_address = payload.pharmacyWalkInDefaults.address;
    }
    if (payload.defaultBarcodeType !== undefined) {
      body.pharmacy_default_barcode_type = payload.defaultBarcodeType;
    }
    if (payload.defaultSaleUnit !== undefined) {
      body.pharmacy_default_sale_unit = payload.defaultSaleUnit;
    }
    if (payload.labDefaultPaymentStatus !== undefined) {
      body.lab_default_payment_status = payload.labDefaultPaymentStatus;
    }
    if (payload.defaultPaymentStatuses !== undefined) {
      body.default_payment_statuses = payload.defaultPaymentStatuses;
    }
    if (payload.barcodeScanningEnabled !== undefined) {
      body.barcode_scanning_enabled = payload.barcodeScanningEnabled;
    }
    if (payload.barcodeLabel !== undefined) {
      body.barcode_label_width_mm = payload.barcodeLabel.widthMm;
      body.barcode_label_height_mm = payload.barcodeLabel.heightMm;
    }
    if (payload.printPaperSizes !== undefined) {
      body.print_paper_sizes = payload.printPaperSizes;
    }
    if (payload.invoiceFields !== undefined) {
      body.invoice_fields = payload.invoiceFields;
    }
    if (payload.reportModuleOwners !== undefined) {
      body.report_module_owners = payload.reportModuleOwners;
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
      invoiceFields: normalizeInvoiceFields(raw.invoice_fields),
      reportModuleOwners: normalizeReportOwners(raw.report_module_owners),
      pharmacyCustomerMode: (['patient_only','walk_in_only','both'].includes(String(raw.pharmacy_customer_mode))
        ? raw.pharmacy_customer_mode : 'both') as PharmacyCustomerMode,
      pharmacyDefaultCustomer: (['patient','walk_in'].includes(String(raw.pharmacy_default_customer))
        ? raw.pharmacy_default_customer : 'patient') as PharmacyDefaultCustomer,
      pharmacyWalkInDefaults: {
        name: raw.pharmacy_walk_in_default_name ?? '',
        phone: raw.pharmacy_walk_in_default_phone ?? '',
        address: raw.pharmacy_walk_in_default_address ?? '',
      },
      defaultBarcodeType: (['manual','manufacturer','system'].includes(String(raw.pharmacy_default_barcode_type))
        ? raw.pharmacy_default_barcode_type : 'manual') as BarcodeType,
      defaultSaleUnit: (['piece','strip','pack'].includes(String(raw.pharmacy_default_sale_unit))
        ? raw.pharmacy_default_sale_unit : 'pack') as DefaultSaleUnit,
      labDefaultPaymentStatus: raw.lab_default_payment_status === 'paid' ? 'paid' : 'unpaid',
      defaultPaymentStatuses: {
        sales: raw.default_payment_statuses?.sales ?? 'pending',
        sales_return: raw.default_payment_statuses?.sales_return ?? 'pending',
        purchase: raw.default_payment_statuses?.purchase ?? 'pending',
        purchase_return: raw.default_payment_statuses?.purchase_return ?? 'pending',
        appointments: raw.default_payment_statuses?.appointments ?? 'pending',
      },
      barcodeScanningEnabled: raw.barcode_scanning_enabled !== undefined
        ? Boolean(raw.barcode_scanning_enabled) : true,
      barcodeLabel: {
        widthMm: toPositiveInt(raw.barcode_label_width_mm, 50),
        heightMm: toPositiveInt(raw.barcode_label_height_mm, 25),
      },
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
      invoiceFields: normalizeInvoiceFields(undefined),
      reportModuleOwners: normalizeReportOwners(undefined),
      pharmacyCustomerMode: 'both',
      pharmacyDefaultCustomer: 'patient',
      pharmacyWalkInDefaults: { name: '', phone: '', address: '' },
      defaultBarcodeType: 'manual',
      defaultSaleUnit: 'pack',
      labDefaultPaymentStatus: 'unpaid',
      defaultPaymentStatuses: {
        sales: 'pending',
        sales_return: 'pending',
        purchase: 'pending',
        purchase_return: 'pending',
        appointments: 'pending',
      },
      barcodeScanningEnabled: true,
      barcodeLabel: { widthMm: 50, heightMm: 25 },
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

  const getInvoiceFields = (hospitalId: string, type: InvoiceType) => {
    const stored = getHospitalSetting(hospitalId).invoiceFields;
    return { ...DEFAULT_INVOICE_FIELDS[type], ...(stored?.[type] ?? {}) };
  };

  const getAllInvoiceFields = (hospitalId: string): InvoiceFieldSettings => {
    return getHospitalSetting(hospitalId).invoiceFields ?? { ...DEFAULT_INVOICE_FIELDS };
  };

  const getReportModuleOwners = (hospitalId: string): ReportModuleOwners => {
    return getHospitalSetting(hospitalId).reportModuleOwners ?? { ...DEFAULT_REPORT_MODULE_OWNERS };
  };

  const getPharmacyCustomerMode = (hospitalId: string): PharmacyCustomerMode => {
    return getHospitalSetting(hospitalId).pharmacyCustomerMode ?? 'both';
  };

  const getPharmacyDefaultCustomer = (hospitalId: string): PharmacyDefaultCustomer => {
    return getHospitalSetting(hospitalId).pharmacyDefaultCustomer ?? 'patient';
  };

  const getPharmacyWalkInDefaults = (hospitalId: string) => {
    return getHospitalSetting(hospitalId).pharmacyWalkInDefaults ?? { name: '', phone: '', address: '' };
  };

  const getDefaultBarcodeType = (hospitalId: string): BarcodeType => {
    return getHospitalSetting(hospitalId).defaultBarcodeType ?? 'manual';
  };

  const getDefaultSaleUnit = (hospitalId: string): DefaultSaleUnit => {
    return getHospitalSetting(hospitalId).defaultSaleUnit ?? 'pack';
  };

  const getDefaultPaymentStatuses = (hospitalId: string) =>
    getHospitalSetting(hospitalId).defaultPaymentStatuses;

  const getLabDefaultPaymentStatus = (hospitalId: string): 'paid' | 'unpaid' =>
    getHospitalSetting(hospitalId).labDefaultPaymentStatus === 'paid' ? 'paid' : 'unpaid';

  const getBarcodeScanningEnabled = (hospitalId: string): boolean => {
    return getHospitalSetting(hospitalId).barcodeScanningEnabled !== false;
  };

  const getBarcodeLabel = (hospitalId: string) => {
    return getHospitalSetting(hospitalId).barcodeLabel ?? { widthMm: 50, heightMm: 25 };
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
      getPharmacyCustomerMode,
      getPharmacyDefaultCustomer,
      getPharmacyWalkInDefaults,
      getDefaultBarcodeType,
      getDefaultSaleUnit,
      getBarcodeScanningEnabled,
      getLabDefaultPaymentStatus,
      getDefaultPaymentStatuses,
      getBarcodeLabel,
      getInvoiceFields,
      getAllInvoiceFields,
      getReportModuleOwners,
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
