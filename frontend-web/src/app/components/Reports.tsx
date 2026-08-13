import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  CalendarDays,
  Download,
  FileDown,
  FileSpreadsheet,
  Filter,
  FlaskConical,
  Pill,
  Printer,
  Receipt,
  Search,
  Users,
  Eye,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import { differenceInCalendarDays, endOfDay, format, startOfDay } from 'date-fns';
import { Hospital, UserRole } from '../types';
import { useDoctors } from '../context/DoctorContext';
import { usePatients } from '../context/PatientContext';
import { useTransactions } from '../context/TransactionContext';
import { useStocks } from '../context/StockContext';
import { useAuth } from '../context/AuthContext';
import { useSettings, REPORT_INCOME_MODULES } from '../context/SettingsContext';
import api from '../../api/axios';
import { LedgerEntryApi, listLedger } from '../../api/ledger';
import { listPatientSurgeries } from '../../api/surgeries';
import { listLabOrders } from '../api/labOrders';

type ReportModule = 'overall' | 'reception' | 'pharmacy' | 'lab';

type ReportType =
  | 'overall_financial'
  | 'doctor_detailed'
  | 'patient_detailed'
  | 'fees_detailed'
  | 'reception_fees_overall'
  | 'reception_fees_doctor_wise'
  | 'reception_lab_orders'
  | 'reception_prescription_sales'
  | 'reception_surgery_operations'
  | 'reception_expenses'
  | 'reception_other_income'
  | 'reception_overall_clearance'
  | 'pharmacy_available_stock'
  | 'pharmacy_expiry'
  | 'pharmacy_purchase'
  | 'pharmacy_purchase_return_out'
  | 'pharmacy_sales'
  | 'pharmacy_sales_return_in'
  | 'pharmacy_customer_wise'
  | 'pharmacy_summary'
  | 'lab_samples'
  | 'lab_orders_date_wise'
  | 'lab_doctor_wise';

type StockGrouping = 'company' | 'product' | 'batch';

interface ReportsProps {
  hospital: Hospital;
  userRole: UserRole;
}

interface ReportColumn {
  key: string;
  label: string;
  kind?: 'text' | 'number' | 'currency' | 'date';
}

interface SummaryItem {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'negative';
}

interface BuiltReport {
  title: string;
  subtitle: string;
  columns: ReportColumn[];
  rows: Array<Record<string, any>>;
  summary: SummaryItem[];
}

interface ReportSourceState {
  appointments: any[];
  prescriptions: any[];
  labOrders: any[];
  transactions: any[];
  surgeries: any[];
  expenses: any[];
  otherIncomes: any[];
  ledger: LedgerEntryApi[];
  medicines: any[];
  stocks: any[];
  patients: any[];
}

interface NormalizedAppointment {
  id: string;
  appointmentNumber: string;
  doctorId: string;
  doctorName: string;
  patientId: string;
  patientName: string;
  status: string;
  paymentStatus: string;
  amount: number;
  date: Date | null;
}

interface NormalizedPrescription {
  id: string;
  prescriptionNumber: string;
  doctorId: string;
  doctorName: string;
  patientId: string;
  patientName: string;
  date: Date | null;
}

interface NormalizedLabOrder {
  id: string;
  orderNumber: string;
  doctorId: string;
  doctorName: string;
  patientId: string;
  patientName: string;
  status: string;
  paymentStatus: string;
  priority: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  sampleCollectedAt: Date | null;
  date: Date | null;
}

interface NormalizedTransaction {
  id: string;
  hospitalId: string;
  trxType: 'purchase' | 'sales' | 'purchase_return' | 'sales_return';
  supplierName: string;
  patientId: string;
  patientName: string;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  detailsCount: number;
  date: Date | null;
}

interface NormalizedSurgery {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  surgeryName: string;
  status: string;
  paymentStatus: string;
  cost: number;
  date: Date | null;
}

interface NormalizedExpense {
  id: string;
  title: string;
  category: string;
  amount: number;
  paymentMethod: string;
  status: string;
  createdBy: string;
  date: Date | null;
}

interface NormalizedOtherIncome {
  id: string;
  title: string;
  category: string;
  amount: number;
  paymentMethod: string;
  status: string;
  createdBy: string;
  date: Date | null;
}

interface NormalizedLedgerEntry {
  id: string;
  module: string;
  title: string;
  category: string;
  direction: 'income' | 'expense' | 'adjustment';
  amount: number;
  netAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  sourceType: string;
  sourceId: string;
  patientId: string;
  patientName: string;
  supplierName: string;
  postedBy: string;
  currency: string;
  date: Date | null;
}

interface NormalizedMedicine {
  id: string;
  brandName: string;
  manufacturerName: string;
  costPrice: number;
  salePrice: number;
}

interface NormalizedStock {
  id: string;
  hospitalId: string;
  medicineId: string;
  medicineName: string;
  batchNo: string;
  expiryDate: Date | null;
  quantity: number;
  purchasePrice: number;
  salePrice: number;
}

let cachedPdfTools: { jsPDF: any; autoTable: any } | null = null;
let cachedXlsxTools: { XLSX: any } | null = null;

const REPORT_OPTIONS: Record<ReportModule, Array<{ key: ReportType; label: string }>> = {
  overall: [
    { key: 'overall_financial', label: 'Overall Financial Report' },
    { key: 'doctor_detailed', label: 'Doctor Detailed Report' },
    { key: 'patient_detailed', label: 'Patient Detailed Report' },
    { key: 'fees_detailed', label: 'Fees Detailed Report' },
  ],
  reception: [
    { key: 'reception_fees_overall', label: 'Fees Report (Overall)' },
    { key: 'reception_fees_doctor_wise', label: 'Fees Report (Doctor Wise)' },
    { key: 'reception_lab_orders', label: 'Lab Orders Report' },
    { key: 'reception_prescription_sales', label: 'Prescription Sales Report' },
    { key: 'reception_surgery_operations', label: 'Surgery Operations Report' },
    { key: 'reception_expenses', label: 'Expense Report' },
    { key: 'reception_other_income', label: 'Other Income Report' },
    { key: 'reception_overall_clearance', label: 'Overall Daily Clearance' },
  ],
  pharmacy: [
    { key: 'pharmacy_available_stock', label: 'Available Stock Report' },
    { key: 'pharmacy_expiry', label: 'Expiry Report' },
    { key: 'pharmacy_purchase', label: 'Purchase Report' },
    { key: 'pharmacy_purchase_return_out', label: 'Return Out (Purchase Return)' },
    { key: 'pharmacy_sales', label: 'Sales Report' },
    { key: 'pharmacy_sales_return_in', label: 'Return In (Sale Return)' },
    { key: 'pharmacy_customer_wise', label: 'Customer Wise Report' },
    { key: 'pharmacy_summary', label: 'Summary Report' },
  ],
  lab: [
    { key: 'lab_samples', label: 'Lab Samples Report' },
    { key: 'lab_orders_date_wise', label: 'Lab Orders Report (Date Wise)' },
    { key: 'lab_doctor_wise', label: 'Doctor Wise Lab Report' },
  ],
};

/**
 * Sub-sections within a tab. The flat grid of a dozen identical buttons gave no
 * clue which report did what; grouping them under headings makes the tab
 * scannable and puts the financial reports together.
 */
/**
 * The income streams the Overall Financial Report always reports on, in the
 * order the hospital reads them. Keys are the `module` value on ledger entries.
 */
const FINANCIAL_MODULE_ORDER: Array<{ key: string; label: string }> = [
  { key: 'pharmacy', label: 'Medicine Sale' },
  { key: 'appointments', label: 'Appointment Fees' },
  { key: 'laboratory', label: 'Laboratory Fees' },
  { key: 'radiology', label: 'Ultrasound Fees' },
  { key: 'surgery', label: 'Surgery Fees' },
  { key: 'room_booking', label: 'Room Booking Fees' },
];

const REPORT_GROUPS: Record<ReportModule, Array<{ group: string; keys: ReportType[] }>> = {
  overall: [
    { group: 'Financial Summary', keys: ['overall_financial', 'fees_detailed'] },
    { group: 'By Person', keys: ['doctor_detailed', 'patient_detailed'] },
  ],
  reception: [
    {
      group: 'Income',
      keys: ['reception_fees_overall', 'reception_fees_doctor_wise', 'reception_lab_orders',
             'reception_prescription_sales', 'reception_surgery_operations', 'reception_other_income'],
    },
    { group: 'Outgoing', keys: ['reception_expenses'] },
    { group: 'Daily Close', keys: ['reception_overall_clearance'] },
  ],
  pharmacy: [
    { group: 'Inventory', keys: ['pharmacy_available_stock', 'pharmacy_expiry'] },
    { group: 'Purchasing', keys: ['pharmacy_purchase', 'pharmacy_purchase_return_out'] },
    { group: 'Sales', keys: ['pharmacy_sales', 'pharmacy_sales_return_in', 'pharmacy_customer_wise'] },
    { group: 'Summary', keys: ['pharmacy_summary'] },
  ],
  lab: [
    { group: 'Orders', keys: ['lab_orders_date_wise', 'lab_samples'] },
    { group: 'By Person', keys: ['lab_doctor_wise'] },
  ],
};

const emptySource: ReportSourceState = {
  appointments: [],
  prescriptions: [],
  labOrders: [],
  transactions: [],
  surgeries: [],
  expenses: [],
  otherIncomes: [],
  ledger: [],
  medicines: [],
  stocks: [],
  patients: [],
};

const toNumber = (value: any): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const inDateRange = (value: Date | null, start: Date, end: Date): boolean => {
  if (!value) return false;
  return value.getTime() >= start.getTime() && value.getTime() <= end.getTime();
};

/**
 * A ledger entry that moves inventory rather than consuming it.
 *
 * Purchases and sales returns take cash out and put goods on the shelf; the
 * expense is recognised when those goods are sold, not when they are bought.
 * Kept out of every expense/outgoing total and reported separately.
 */
const isInventoryMovement = (entry: { direction: string; module: string; category?: string }): boolean => {
  if (entry.direction !== 'expense') return false;
  if (String(entry.module || '').toLowerCase() !== 'pharmacy') return false;
  return ['purchase', 'sales_return'].includes(String(entry.category || '').toLowerCase());
};

/** Columns that settle an account rather than describe a fee category. */
const SETTLEMENT_KEYS = ['totalFees', 'total', 'paid', 'due', 'net'];

const normalizeModuleName = (value: string): string => {
  const raw = String(value || 'other').toLowerCase();
  // Must match FINANCIAL_MODULE_ORDER exactly: the report seeds its rows by
  // label, so a mismatch here would leave a module permanently on zero while
  // its money quietly appeared under a second, differently-named row.
  const income = FINANCIAL_MODULE_ORDER.find((m) => m.key === raw);
  if (income) return income.label;
  if (raw === 'expenses') return 'Expenses';
  if (raw === 'other_income') return 'Other Income';
  if (raw === 'salary') return 'Salary';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
};

const derivePaidDue = (total: number, paymentStatus?: string, explicitPaid?: number) => {
  const paidFromExplicit = toNumber(explicitPaid);
  if (paidFromExplicit > 0) {
    const due = Math.max(0, total - paidFromExplicit);
    return { paid: paidFromExplicit, due };
  }

  const status = String(paymentStatus || '').toLowerCase();
  if (status === 'paid' || status === 'completed') {
    return { paid: total, due: 0 };
  }
  if (status === 'partial') {
    return { paid: total / 2, due: total / 2 };
  }
  if (status === 'cancelled') {
    return { paid: 0, due: 0 };
  }

  return { paid: 0, due: total };
};

const unwrapArray = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.data?.data)) return value.data.data;
  return [];
};

const normalizeAppointment = (item: any): NormalizedAppointment => {
  return {
    id: String(item.id),
    appointmentNumber: String(item.appointment_number ?? item.appointmentNumber ?? `APT-${item.id}`),
    doctorId: String(item.doctor_id ?? item.doctorId ?? ''),
    doctorName: String(item.doctor_name ?? item.doctorName ?? item.doctor?.name ?? 'Unknown Doctor'),
    patientId: String(item.patient_id ?? item.patientId ?? ''),
    patientName: String(item.patient_name ?? item.patientName ?? item.patient?.name ?? 'Unknown Patient'),
    status: String(item.status ?? ''),
    paymentStatus: String(item.payment_status ?? item.paymentStatus ?? 'pending'),
    amount: toNumber(item.total_amount ?? item.totalAmount ?? item.original_fee_amount ?? item.originalFeeAmount),
    date: toDate(item.appointment_date ?? item.appointmentDate ?? item.created_at ?? item.createdAt),
  };
};

const normalizePrescription = (item: any): NormalizedPrescription => {
  return {
    id: String(item.id),
    prescriptionNumber: String(item.prescription_number ?? item.prescriptionNumber ?? `RX-${item.id}`),
    doctorId: String(item.doctor_id ?? item.doctorId ?? ''),
    doctorName: String(item.doctor_name ?? item.doctorName ?? 'Unknown Doctor'),
    patientId: String(item.patient_id ?? item.patientId ?? ''),
    patientName: String(item.patient_name ?? item.patientName ?? 'Unknown Patient'),
    date: toDate(item.created_at ?? item.createdAt),
  };
};

const normalizeLabOrder = (item: any): NormalizedLabOrder => {
  const totalAmount = toNumber(item.total_amount ?? item.totalAmount);
  const paidAmount = toNumber(item.paid_amount ?? item.paidAmount);

  return {
    id: String(item.id),
    orderNumber: String(item.order_number ?? item.orderNumber ?? `LAB-${item.id}`),
    doctorId: String(item.doctor_id ?? item.doctorId ?? ''),
    doctorName: String(item.doctor_name ?? item.doctorName ?? item.doctor?.name ?? 'Unknown Doctor'),
    patientId: String(item.patient_id ?? item.patientId ?? ''),
    patientName: String(item.patient_name ?? item.patientName ?? 'Unknown Patient'),
    status: String(item.status ?? ''),
    paymentStatus: String(item.payment_status ?? item.paymentStatus ?? 'unpaid'),
    priority: String(item.priority ?? 'normal'),
    totalAmount,
    paidAmount,
    dueAmount: Math.max(0, totalAmount - paidAmount),
    sampleCollectedAt: toDate(item.sample_collected_at ?? item.sampleCollectedAt),
    date: toDate(item.created_at ?? item.createdAt),
  };
};

const normalizeTransaction = (item: any): NormalizedTransaction => {
  const details = Array.isArray(item.details) ? item.details : [];

  return {
    id: String(item.id),
    hospitalId: String(item.hospital_id ?? item.hospitalId ?? ''),
    trxType: String(item.trx_type ?? item.trxType ?? 'purchase') as NormalizedTransaction['trxType'],
    supplierName: String(item.supplier_name ?? item.supplierName ?? item.supplier?.name ?? '-'),
    patientId: String(item.patient_id ?? item.patientId ?? ''),
    patientName: String(item.patient_name ?? item.patientName ?? item.patient?.name ?? '-'),
    grandTotal: toNumber(item.grand_total ?? item.grandTotal),
    paidAmount: toNumber(item.paid_amount ?? item.paidAmount),
    dueAmount: toNumber(item.due_amount ?? item.dueAmount),
    detailsCount: details.length,
    date: toDate(item.created_at ?? item.createdAt),
  };
};

const normalizeSurgery = (item: any): NormalizedSurgery => {
  return {
    id: String(item.id),
    patientId: String(item.patient_id ?? item.patientId ?? item.patient?.id ?? ''),
    patientName: String(item.patient?.name ?? item.patient_name ?? item.patientName ?? 'Unknown Patient'),
    doctorId: String(item.doctor_id ?? item.doctorId ?? item.doctor?.id ?? ''),
    doctorName: String(item.doctor?.name ?? item.doctor_name ?? item.doctorName ?? 'Unknown Doctor'),
    surgeryName: String(item.surgery?.name ?? item.surgery_name ?? item.surgeryName ?? `Surgery ${item.surgery_id ?? ''}`),
    status: String(item.status ?? ''),
    paymentStatus: String(item.payment_status ?? item.paymentStatus ?? 'pending'),
    cost: toNumber(item.cost),
    date: toDate(item.surgery_date ?? item.surgeryDate ?? item.created_at ?? item.createdAt),
  };
};

const normalizeExpense = (item: any): NormalizedExpense => {
  return {
    id: String(item.id),
    title: String(item.title ?? '-'),
    category: String(item.category?.name ?? item.category_name ?? '-'),
    amount: toNumber(item.amount),
    paymentMethod: String(item.payment_method ?? item.paymentMethod ?? '-'),
    status: String(item.status ?? '-'),
    createdBy: String(item.created_by ?? item.createdBy ?? '-'),
    date: toDate(item.expense_date ?? item.expenseDate ?? item.created_at ?? item.createdAt),
  };
};

const normalizeOtherIncome = (item: any): NormalizedOtherIncome => {
  return {
    id: String(item.id),
    title: String(item.title ?? '-'),
    category: String(item.category?.name ?? item.category_name ?? '-'),
    amount: toNumber(item.amount),
    paymentMethod: String(item.payment_method ?? item.paymentMethod ?? '-'),
    status: String(item.status ?? '-'),
    createdBy: String(item.created_by ?? item.createdBy ?? '-'),
    date: toDate(item.income_date ?? item.incomeDate ?? item.created_at ?? item.createdAt),
  };
};

const normalizeLedger = (entry: LedgerEntryApi): NormalizedLedgerEntry => {
  return {
    id: String(entry.id),
    module: String(entry.module || 'other'),
    title: String(entry.title || '-'),
    category: String(entry.category || '-'),
    direction: entry.entry_direction,
    amount: toNumber(entry.amount),
    netAmount: toNumber(entry.net_amount),
    paidAmount: toNumber(entry.paid_amount),
    dueAmount: toNumber(entry.due_amount),
    status: String(entry.status || '-'),
    sourceType: String(entry.source_type || '-'),
    sourceId: String(entry.source_id || '-'),
    patientId: String(entry.patient_id ?? ''),
    patientName: String(entry.patient?.name ?? '-'),
    supplierName: String(entry.supplier?.name ?? '-'),
    postedBy: String(entry.posted_by ?? '-'),
    currency: String(entry.currency || 'AFN').toUpperCase(),
    date: toDate(entry.posted_at),
  };
};

const normalizeMedicine = (item: any): NormalizedMedicine => ({
  id: String(item.id),
  brandName: String(item.brand_name ?? item.brandName ?? `Medicine ${item.id}`),
  manufacturerName: String(item.manufacturer?.name ?? item.manufacturer_name ?? '-'),
  costPrice: toNumber(item.cost_price ?? item.costPrice),
  salePrice: toNumber(item.sale_price ?? item.salePrice),
});

const normalizeStock = (item: any): NormalizedStock => ({
  id: String(item.id),
  hospitalId: String(item.hospital_id ?? item.hospitalId ?? ''),
  medicineId: String(item.medicine_id ?? item.medicineId ?? ''),
  medicineName: String(item.medicine?.brand_name ?? item.medicine_name ?? item.medicineName ?? `Medicine ${item.medicine_id ?? item.medicineId ?? ''}`),
  batchNo: String(item.batch_no ?? item.batchNo ?? '-'),
  expiryDate: toDate(item.expiry_date ?? item.expiryDate),
  quantity: toNumber(item.stock_qty ?? item.stockQty) + toNumber(item.bonus_qty ?? item.bonusQty),
  purchasePrice: toNumber(item.purchase_price ?? item.purchasePrice),
  salePrice: toNumber(item.sale_price ?? item.salePrice),
});

async function loadPdfTools() {
  if (cachedPdfTools) return cachedPdfTools;

  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  cachedPdfTools = {
    jsPDF,
    autoTable: autoTableModule.default,
  };

  return cachedPdfTools;
}

async function loadXlsxTools() {
  if (cachedXlsxTools) return cachedXlsxTools;

  const XLSX = await import('xlsx');
  cachedXlsxTools = { XLSX };
  return cachedXlsxTools;
}

export function Reports({ hospital, userRole }: ReportsProps) {
  const { t } = useTranslation();
  const { doctors } = useDoctors();
  const { patients: contextPatients } = usePatients();
  const { transactions: contextTransactions } = useTransactions();
  const { stocks: contextStocks } = useStocks();
  const { hasPermission } = useAuth();
  const { getReportModuleOwners } = useSettings();

  const role = String(userRole || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isReceptionist = role === 'receptionist';
  const isPharmacist = role === 'pharmacist';
  const isLab = role === 'lab_technician';

  const today = format(new Date(), 'yyyy-MM-dd');

  const availableModules = useMemo(() => {
    const modules: Array<{ key: ReportModule; label: string }> = [];

    if (isAdmin) {
      modules.push({ key: 'overall', label: 'Overall Reports' });
    }

    if (
      isAdmin ||
      isReceptionist ||
      hasPermission('view_appointments') ||
      hasPermission('manage_appointments') ||
      hasPermission('view_ledger') ||
      hasPermission('manage_ledger')
    ) {
      modules.push({ key: 'reception', label: 'Reception Reports' });
    }

    if (
      isAdmin ||
      isPharmacist ||
      hasPermission('view_transactions') ||
      hasPermission('manage_transactions') ||
      hasPermission('view_stocks') ||
      hasPermission('manage_stocks')
    ) {
      modules.push({ key: 'pharmacy', label: 'Pharmacy Reports' });
    }

    if (
      isAdmin ||
      isLab ||
      hasPermission('view_lab_orders') ||
      hasPermission('manage_lab_orders')
    ) {
      modules.push({ key: 'lab', label: 'Lab Reports' });
    }

    if (modules.length === 0) {
      modules.push({ key: 'overall', label: 'Overall Reports' });
    }

    return modules.filter((module, index, all) => all.findIndex((m) => m.key === module.key) === index);
  }, [
    hasPermission,
    isAdmin,
    isLab,
    isPharmacist,
    isReceptionist,
  ]);

  const [reportModule, setReportModule] = useState<ReportModule>(availableModules[0]?.key ?? 'overall');
  const [reportType, setReportType] = useState<ReportType>(REPORT_OPTIONS.overall[0].key);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedDoctorId, setSelectedDoctorId] = useState('all');
  const [stockGrouping, setStockGrouping] = useState<StockGrouping>('company');
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [tableSearch, setTableSearch] = useState('');
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [detailRow, setDetailRow] = useState<Record<string, any> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<ReportSourceState>(emptySource);

  useEffect(() => {
    const allowed = availableModules.some((m) => m.key === reportModule);
    if (!allowed) {
      setReportModule(availableModules[0]?.key ?? 'overall');
    }
  }, [availableModules, reportModule]);

  useEffect(() => {
    const options = REPORT_OPTIONS[reportModule] ?? [];
    if (options.length === 0) return;

    if (!options.some((o) => o.key === reportType)) {
      setReportType(options[0].key);
      setSelectedDoctorId('all');
    }
  }, [reportModule, reportType]);

  useEffect(() => {
    setCurrentPage(1);
  }, [reportModule, reportType, startDate, endDate, selectedDoctorId, stockGrouping]);

  useEffect(() => {
    if (!startDate || !endDate) return;

    let cancelled = false;

    const safeCall = async <T,>(runner: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await runner();
      } catch {
        return fallback;
      }
    };

    const loadData = async () => {
      setLoading(true);

      const scope = role === 'super_admin' ? { hospital_id: hospital.id } : {};

      const [
        appointmentsRes,
        prescriptionsRes,
        labOrdersRes,
        transactionsRes,
        surgeriesRes,
        expensesRes,
        otherIncomesRes,
        ledgerRes,
        medicinesRes,
        stocksRes,
        patientsRes,
      ] = await Promise.all([
        safeCall(
          () => api.get('/appointments', { params: { ...scope, date_from: startDate, date_to: endDate, per_page: 200 } }),
          null
        ),
        safeCall(
          () => api.get('/prescriptions', { params: { ...scope, per_page: 200 } }),
          null
        ),
        safeCall(
          () => listLabOrders({ ...scope, from_date: startDate, to_date: endDate, per_page: 200 }),
          { data: [] }
        ),
        safeCall(
          () => api.get('/transactions', { params: { ...scope, per_page: 200 } }),
          null
        ),
        safeCall(
          () => listPatientSurgeries({ ...scope, date_from: startDate, date_to: endDate, per_page: 200 }),
          { data: [] }
        ),
        safeCall(
          () => api.get('/expenses', { params: { ...scope, start_date: startDate, end_date: endDate } }),
          null
        ),
        safeCall(
          () => api.get('/other-incomes', { params: { ...scope, start_date: startDate, end_date: endDate } }),
          null
        ),
        safeCall(
          () => listLedger({ ...scope, date_from: startDate, date_to: endDate, per_page: 200 }),
          { data: [] }
        ),
        safeCall(
          () => api.get('/medicines', { params: { ...scope, per_page: 200 } }),
          null
        ),
        safeCall(
          () => api.get('/stocks', { params: { ...scope } }),
          null
        ),
        safeCall(
          () => api.get('/patients', { params: { ...scope, per_page: 200 } }),
          null
        ),
      ]);

      if (cancelled) return;

      setSource({
        appointments: unwrapArray(appointmentsRes?.data),
        prescriptions: unwrapArray(prescriptionsRes?.data),
        labOrders: unwrapArray(labOrdersRes),
        transactions: unwrapArray(transactionsRes?.data),
        surgeries: unwrapArray(surgeriesRes),
        expenses: unwrapArray(expensesRes?.data),
        otherIncomes: unwrapArray(otherIncomesRes?.data),
        ledger: (ledgerRes?.data ?? []) as LedgerEntryApi[],
        medicines: unwrapArray(medicinesRes?.data),
        stocks: unwrapArray(stocksRes?.data),
        patients: unwrapArray(patientsRes?.data),
      });

      setLoading(false);
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [endDate, hospital.id, role, startDate]);

  const rangeStart = useMemo(() => startOfDay(new Date(startDate)), [startDate]);
  const rangeEnd = useMemo(() => endOfDay(new Date(endDate)), [endDate]);

  const normalizedAppointments = useMemo(() => {
    return source.appointments
      .map(normalizeAppointment)
      .filter((item) => inDateRange(item.date, rangeStart, rangeEnd));
  }, [source.appointments, rangeEnd, rangeStart]);

  const normalizedPrescriptions = useMemo(() => {
    return source.prescriptions
      .map(normalizePrescription)
      .filter((item) => inDateRange(item.date, rangeStart, rangeEnd));
  }, [source.prescriptions, rangeEnd, rangeStart]);

  const normalizedLabOrders = useMemo(() => {
    return source.labOrders
      .map(normalizeLabOrder)
      .filter((item) => inDateRange(item.date, rangeStart, rangeEnd));
  }, [source.labOrders, rangeEnd, rangeStart]);

  const normalizedTransactions = useMemo(() => {
    const apiRows = source.transactions.map(normalizeTransaction);
    const rows = apiRows.length > 0
      ? apiRows
      : contextTransactions
          .map(normalizeTransaction)
          .filter((item) => String(item.hospitalId) === String(hospital.id));

    return rows.filter((item) => inDateRange(item.date, rangeStart, rangeEnd));
  }, [source.transactions, contextTransactions, hospital.id, rangeEnd, rangeStart]);

  const normalizedSurgeries = useMemo(() => {
    return source.surgeries
      .map(normalizeSurgery)
      .filter((item) => inDateRange(item.date, rangeStart, rangeEnd));
  }, [source.surgeries, rangeEnd, rangeStart]);

  const normalizedExpenses = useMemo(() => {
    return source.expenses
      .map(normalizeExpense)
      .filter((item) => inDateRange(item.date, rangeStart, rangeEnd));
  }, [source.expenses, rangeEnd, rangeStart]);

  const normalizedOtherIncomes = useMemo(() => {
    return source.otherIncomes
      .map(normalizeOtherIncome)
      .filter((item) => inDateRange(item.date, rangeStart, rangeEnd));
  }, [source.otherIncomes, rangeEnd, rangeStart]);

  /**
   * Income modules assigned to the desk whose tab is open, from
   * Settings > General > Report Ownership.
   *
   * A hospital where the pharmacist reconciles medicine sales and reception
   * reconciles everything else must not show the same money on both tabs, or
   * the two officers report overlapping totals to the administrator.
   *
   * Outgoing entries (expenses, salary) and modules not in the configurable
   * list are left alone -- only income ownership is being split here.
   */
  const ownedIncomeModules = useMemo(() => {
    const owners = getReportModuleOwners(hospital.id);
    const desk = reportModule === 'lab' ? 'laboratory' : reportModule;
    return new Set(
      REPORT_INCOME_MODULES
        .filter(({ key }) => owners[key] === desk)
        .map(({ key }) => key)
    );
  }, [getReportModuleOwners, hospital.id, reportModule]);

  const normalizedLedger = useMemo(() => {
    const configurable = new Set(REPORT_INCOME_MODULES.map((m) => m.key));

    return source.ledger
      .map(normalizeLedger)
      .filter((item) => item.status.toLowerCase() !== 'voided')
      .filter((item) => inDateRange(item.date, rangeStart, rangeEnd))
      .filter((item) => {
        // The Overall tab is the administrator's consolidated view and must
        // keep everything, whoever reconciles it.
        if (reportModule === 'overall') return true;
        const raw = String(item.module || '').toLowerCase();
        if (item.direction !== 'income' || !configurable.has(raw as any)) return true;
        return ownedIncomeModules.has(raw as any);
      });
  }, [source.ledger, rangeEnd, rangeStart, reportModule, ownedIncomeModules]);

  const normalizedMedicines = useMemo(() => {
    return source.medicines.map(normalizeMedicine);
  }, [source.medicines]);

  const normalizedStocks = useMemo(() => {
    const rows = source.stocks.length > 0 ? source.stocks : contextStocks;
    return rows
      .map(normalizeStock)
      .filter((item) => String(item.hospitalId) === String(hospital.id));
  }, [source.stocks, contextStocks, hospital.id]);

  const normalizedPatients = useMemo(() => {
    const rows = source.patients.length > 0 ? source.patients : contextPatients;

    return rows
      .map((item: any) => ({
        id: String(item.id),
        patientId: String(item.patient_id ?? item.patientId ?? ''),
        name: String(item.name ?? '-'),
        phone: String(item.phone ?? '-'),
        hospitalId: String(item.hospital_id ?? item.hospitalId ?? ''),
      }))
      .filter((item) => String(item.hospitalId) === String(hospital.id));
  }, [source.patients, contextPatients, hospital.id]);

  const medicinesById = useMemo(() => {
    const map = new Map<string, NormalizedMedicine>();
    normalizedMedicines.forEach((medicine) => {
      map.set(String(medicine.id), medicine);
    });
    return map;
  }, [normalizedMedicines]);

  const doctorOptions = useMemo(() => {
    const map = new Map<string, string>();

    doctors
      .filter((doctor) => String(doctor.hospitalId) === String(hospital.id))
      .forEach((doctor) => {
        map.set(String(doctor.id), doctor.name);
      });

    [...normalizedAppointments, ...normalizedLabOrders, ...normalizedPrescriptions, ...normalizedSurgeries].forEach((row: any) => {
      if (!row.doctorId) return;
      if (!map.has(String(row.doctorId))) {
        map.set(String(row.doctorId), String(row.doctorName || 'Unknown Doctor'));
      }
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [doctors, hospital.id, normalizedAppointments, normalizedLabOrders, normalizedPrescriptions, normalizedSurgeries]);

  const currency = useMemo(() => {
    const first = normalizedLedger.find((entry) => entry.currency);
    return first?.currency || 'AFN';
  }, [normalizedLedger]);

  const formatCurrency = (value: number) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(toNumber(value));
    } catch {
      return `${currency} ${toNumber(value).toFixed(2)}`;
    }
  };

  const buildReport = useMemo<BuiltReport>(() => {
    const ledgerActive = normalizedLedger.filter((entry) => entry.status.toLowerCase() !== 'voided');

    switch (reportType) {
      case 'overall_financial': {
        const byModule = new Map<string, { module: string; entries: number; incoming: number; outgoing: number; inventory: number; paid: number; due: number }>();

        // Seeded so every income stream is listed even when it earned nothing
        // this period. A module missing from the table reads as "not tracked";
        // a module showing 0.00 reads as "tracked, no activity" -- which is the
        // question the administrator is actually asking.
        FINANCIAL_MODULE_ORDER.forEach(({ label }) => {
          byModule.set(label, { module: label, entries: 0, incoming: 0, outgoing: 0, inventory: 0, paid: 0, due: 0 });
        });

        ledgerActive.forEach((entry) => {
          const key = normalizeModuleName(entry.module);
          if (!byModule.has(key)) {
            byModule.set(key, {
              module: key,
              entries: 0,
              incoming: 0,
              outgoing: 0,
              inventory: 0,
              paid: 0,
              due: 0,
            });
          }

          const bucket = byModule.get(key)!;
          bucket.entries += 1;
          bucket.paid += entry.paidAmount;
          bucket.due += entry.dueAmount;

          if (entry.direction === 'income') {
            bucket.incoming += entry.netAmount;
          } else if (isInventoryMovement(entry)) {
            // Reported in its own column so the cash movement stays visible
            // without being counted as money the hospital has spent.
            bucket.inventory += entry.netAmount;
          } else if (entry.direction === 'expense') {
            bucket.outgoing += entry.netAmount;
          }
        });

        // The six income streams first, in a fixed order the client reads top
        // to bottom; anything else (expenses, salary, other income) follows.
        const fixedOrder = FINANCIAL_MODULE_ORDER.map((m) => m.label);
        const rows = Array.from(byModule.values())
          .map((item) => ({
            ...item,
            net: item.incoming - item.outgoing,
          }))
          .sort((a, b) => {
            const aIndex = fixedOrder.indexOf(a.module);
            const bIndex = fixedOrder.indexOf(b.module);
            if (aIndex !== -1 || bIndex !== -1) {
              if (aIndex === -1) return 1;
              if (bIndex === -1) return -1;
              return aIndex - bIndex;
            }
            return b.net - a.net;
          });

        const totalIncoming = rows.reduce((sum, row) => sum + row.incoming, 0);
        const totalOutgoing = rows.reduce((sum, row) => sum + row.outgoing, 0);
        const totalInventory = rows.reduce((sum, row) => sum + row.inventory, 0);
        const totalDue = rows.reduce((sum, row) => sum + row.due, 0);

        return {
          title: 'Overall Financial Report',
          subtitle: 'Every income stream consolidated, including modules with no activity this period.',
          columns: [
            { key: 'module', label: t('ui.module') },
            { key: 'entries', label: t('ui.entries'), kind: 'number' },
            { key: 'incoming', label: t('ui.incoming'), kind: 'currency' },
            { key: 'outgoing', label: t('ui.outgoing'), kind: 'currency' },
            { key: 'inventory', label: 'Stock Purchased', kind: 'currency' },
            { key: 'net', label: t('ui.net'), kind: 'currency' },
            { key: 'paid', label: t('ui.paid'), kind: 'currency' },
            { key: 'due', label: t('ui.due'), kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Income Modules', value: String(FINANCIAL_MODULE_ORDER.length) },
            { label: t('ui.incoming'), value: formatCurrency(totalIncoming), tone: 'positive' },
            { label: t('ui.outgoing'), value: formatCurrency(totalOutgoing), tone: 'negative' },
            { label: 'Stock Purchased', value: formatCurrency(totalInventory) },
            { label: t('ui.net'), value: formatCurrency(totalIncoming - totalOutgoing), tone: totalIncoming - totalOutgoing >= 0 ? 'positive' : 'negative' },
            { label: t('ui.due'), value: formatCurrency(totalDue), tone: totalDue > 0 ? 'negative' : 'default' },
          ],
        };
      }

      case 'doctor_detailed': {
        const rows: Array<Record<string, any>> = [];

        normalizedAppointments.forEach((item) => {
          const amounts = derivePaidDue(item.amount, item.paymentStatus);
          rows.push({
            date: item.date,
            doctorId: item.doctorId,
            doctor: item.doctorName,
            patient: item.patientName,
            service: 'Appointment',
            reference: item.appointmentNumber,
            amount: item.amount,
            paid: amounts.paid,
            due: amounts.due,
            status: item.status,
          });
        });

        normalizedLabOrders.forEach((item) => {
          rows.push({
            date: item.date,
            doctorId: item.doctorId,
            doctor: item.doctorName,
            patient: item.patientName,
            service: 'Lab Order',
            reference: item.orderNumber,
            amount: item.totalAmount,
            paid: item.paidAmount,
            due: item.dueAmount,
            status: item.status,
          });
        });

        normalizedSurgeries.forEach((item) => {
          const amounts = derivePaidDue(item.cost, item.paymentStatus);
          rows.push({
            date: item.date,
            doctorId: item.doctorId,
            doctor: item.doctorName,
            patient: item.patientName,
            service: item.surgeryName,
            reference: `SRG-${item.id}`,
            amount: item.cost,
            paid: amounts.paid,
            due: amounts.due,
            status: item.status,
          });
        });

        normalizedPrescriptions.forEach((item) => {
          rows.push({
            date: item.date,
            doctorId: item.doctorId,
            doctor: item.doctorName,
            patient: item.patientName,
            service: 'Prescription',
            reference: item.prescriptionNumber,
            amount: 0,
            paid: 0,
            due: 0,
            status: 'created',
          });
        });

        const filteredRows = rows
          .filter((row) => (selectedDoctorId === 'all' ? true : String(row.doctorId) === String(selectedDoctorId)))
          .sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0));

        const totalAmount = filteredRows.reduce((sum, row) => sum + toNumber(row.amount), 0);
        const totalDue = filteredRows.reduce((sum, row) => sum + toNumber(row.due), 0);
        const uniquePatients = new Set(filteredRows.map((row) => row.patient).filter(Boolean));

        return {
          title: 'Doctor Detailed Report',
          subtitle: 'Doctor-wise detailed rows with patient and fee information.',
          columns: [
            { key: 'date', label: t('ui.date'), kind: 'date' },
            { key: 'doctor', label: t('ui.doctor') },
            { key: 'patient', label: t('ui.patient') },
            { key: 'service', label: 'Service' },
            { key: 'reference', label: t('ui.reference') },
            { key: 'status', label: t('ui.status') },
            { key: 'amount', label: t('ui.amount'), kind: 'currency' },
            { key: 'paid', label: t('ui.paid'), kind: 'currency' },
            { key: 'due', label: t('ui.due'), kind: 'currency' },
          ],
          rows: filteredRows,
          summary: [
            { label: t('ui.rows'), value: String(filteredRows.length) },
            { label: 'Unique Patients', value: String(uniquePatients.size) },
            { label: t('ui.totalAmount'), value: formatCurrency(totalAmount), tone: 'positive' },
            { label: t('ui.totalDue'), value: formatCurrency(totalDue), tone: totalDue > 0 ? 'negative' : 'default' },
          ],
        };
      }

      case 'patient_detailed': {
        const patientMap = new Map<string, {
          patientId: string;
          patientName: string;
          phone: string;
          visits: number;
          appointmentFees: number;
          labFees: number;
          medicineSales: number;
          surgeryFees: number;
          ultrasoundFees: number;
          roomBookingFees: number;
          paid: number;
          due: number;
        }>();

        normalizedPatients.forEach((patient) => {
          patientMap.set(String(patient.id), {
            patientId: patient.patientId || '-',
            patientName: patient.name,
            phone: patient.phone || '-',
            visits: 0,
            appointmentFees: 0,
            labFees: 0,
            medicineSales: 0,
            surgeryFees: 0,
            ultrasoundFees: 0,
            roomBookingFees: 0,
            paid: 0,
            due: 0,
          });
        });

        const ensurePatient = (patientId: string, patientName: string) => {
          if (!patientMap.has(patientId)) {
            patientMap.set(patientId, {
              patientId,
              patientName: patientName || 'Unknown Patient',
              phone: '-',
              visits: 0,
              appointmentFees: 0,
              labFees: 0,
              medicineSales: 0,
              surgeryFees: 0,
              ultrasoundFees: 0,
              roomBookingFees: 0,
              paid: 0,
              due: 0,
            });
          }
          return patientMap.get(patientId)!;
        };

        normalizedAppointments.forEach((item) => {
          const key = String(item.patientId || item.patientName);
          const row = ensurePatient(key, item.patientName);
          row.visits += 1;
          row.appointmentFees += item.amount;
        });

        normalizedLabOrders.forEach((item) => {
          const key = String(item.patientId || item.patientName);
          const row = ensurePatient(key, item.patientName);
          row.labFees += item.totalAmount;
          row.paid += item.paidAmount;
          row.due += item.dueAmount;
        });

        normalizedTransactions
          .filter((item) => item.trxType === 'sales' || item.trxType === 'sales_return')
          .forEach((item) => {
            const key = String(item.patientId || item.patientName || 'Unknown');
            const row = ensurePatient(key, item.patientName || 'Unknown Patient');
            if (item.trxType === 'sales') {
              row.medicineSales += item.grandTotal;
              row.paid += item.paidAmount;
              row.due += item.dueAmount;
            } else {
              row.medicineSales -= item.grandTotal;
            }
          });

        normalizedSurgeries.forEach((item) => {
          const key = String(item.patientId || item.patientName);
          const row = ensurePatient(key, item.patientName);
          row.surgeryFees += item.cost;
          const amounts = derivePaidDue(item.cost, item.paymentStatus);
          row.paid += amounts.paid;
          row.due += amounts.due;
        });

        ledgerActive
          .filter((entry) => entry.patientId)
          .forEach((entry) => {
            const row = ensurePatient(String(entry.patientId), entry.patientName || 'Unknown Patient');
            // Radiology and room bookings have no dedicated source array here,
            // but both post to the ledger against a patient, so the fees are
            // read from there rather than left out of the patient's total.
            const module = String(entry.module || '').toLowerCase();
            if (entry.direction === 'income') {
              if (module === 'radiology') row.ultrasoundFees += entry.netAmount;
              if (module === 'room_booking') row.roomBookingFees += entry.netAmount;
            }
            row.paid += entry.paidAmount;
            row.due += entry.dueAmount;
          });

        const rows = Array.from(patientMap.values())
          .map((item) => ({
            ...item,
            totalFees: item.appointmentFees + item.labFees + item.medicineSales
              + item.surgeryFees + item.ultrasoundFees + item.roomBookingFees,
          }))
          .sort((a, b) => b.totalFees - a.totalFees);

        const activePatients = rows.filter((row) => row.totalFees > 0 || row.visits > 0).length;
        const totalFees = rows.reduce((sum, row) => sum + row.totalFees, 0);
        const totalDue = rows.reduce((sum, row) => sum + row.due, 0);

        return {
          title: 'Patient Detailed Report',
          subtitle: 'All patients with fee and activity details.',
          columns: [
            { key: 'patientId', label: 'Patient ID' },
            { key: 'patientName', label: 'Patient Name' },
            { key: 'phone', label: t('ui.phone') },
            { key: 'visits', label: 'Visits', kind: 'number' },
            { key: 'appointmentFees', label: 'Appointment Fees', kind: 'currency' },
            { key: 'labFees', label: 'Lab Fees', kind: 'currency' },
            { key: 'medicineSales', label: 'Medicine Sold', kind: 'currency' },
            { key: 'surgeryFees', label: t('ui.surgeryFees'), kind: 'currency' },
            { key: 'ultrasoundFees', label: 'Ultrasound Fees', kind: 'currency' },
            { key: 'roomBookingFees', label: 'Room Booking', kind: 'currency' },
            { key: 'totalFees', label: t('ui.totalFees'), kind: 'currency' },
            { key: 'paid', label: t('ui.paid'), kind: 'currency' },
            { key: 'due', label: t('ui.due'), kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Total Patients', value: String(rows.length) },
            { label: 'Active Patients', value: String(activePatients) },
            { label: t('ui.totalFees'), value: formatCurrency(totalFees), tone: 'positive' },
            { label: t('ui.totalDue'), value: formatCurrency(totalDue), tone: totalDue > 0 ? 'negative' : 'default' },
          ],
        };
      }

      case 'fees_detailed':
      case 'reception_fees_overall': {
        const byModule = new Map<string, { module: string; entries: number; amount: number; paid: number; due: number }>();

        ledgerActive
          .filter((entry) => entry.direction === 'income')
          .forEach((entry) => {
            const key = normalizeModuleName(entry.module);
            if (!byModule.has(key)) {
              byModule.set(key, { module: key, entries: 0, amount: 0, paid: 0, due: 0 });
            }
            const row = byModule.get(key)!;
            row.entries += 1;
            row.amount += entry.netAmount;
            row.paid += entry.paidAmount;
            row.due += entry.dueAmount;
          });

        const rows = Array.from(byModule.values()).sort((a, b) => b.amount - a.amount);
        const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
        const totalDue = rows.reduce((sum, row) => sum + row.due, 0);

        return {
          title: reportType === 'fees_detailed' ? 'Fees Detailed Report' : 'Reception Fees Report (Overall)',
          subtitle: 'Fee collection summary grouped by module.',
          columns: [
            { key: 'module', label: t('ui.module') },
            { key: 'entries', label: t('ui.entries'), kind: 'number' },
            { key: 'amount', label: t('ui.amount'), kind: 'currency' },
            { key: 'paid', label: t('ui.paid'), kind: 'currency' },
            { key: 'due', label: t('ui.due'), kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Modules', value: String(rows.length) },
            { label: t('ui.totalFees'), value: formatCurrency(totalAmount), tone: 'positive' },
            { label: t('ui.totalDue'), value: formatCurrency(totalDue), tone: totalDue > 0 ? 'negative' : 'default' },
          ],
        };
      }

      case 'reception_fees_doctor_wise': {
        const byDoctor = new Map<string, {
          doctorId: string;
          doctor: string;
          patientCount: number;
          appointmentFees: number;
          labFees: number;
          surgeryFees: number;
          totalFees: number;
        }>();
        const patientSets = new Map<string, Set<string>>();

        const ensureDoctor = (doctorId: string, doctorName: string) => {
          if (!byDoctor.has(doctorId)) {
            byDoctor.set(doctorId, {
              doctorId,
              doctor: doctorName || 'Unknown Doctor',
              patientCount: 0,
              appointmentFees: 0,
              labFees: 0,
              surgeryFees: 0,
              totalFees: 0,
            });
            patientSets.set(doctorId, new Set<string>());
          }
          return byDoctor.get(doctorId)!;
        };

        normalizedAppointments.forEach((item) => {
          const doctorId = String(item.doctorId || item.doctorName);
          const row = ensureDoctor(doctorId, item.doctorName);
          row.appointmentFees += item.amount;
          row.totalFees += item.amount;
          patientSets.get(doctorId)?.add(String(item.patientId || item.patientName));
        });

        normalizedLabOrders.forEach((item) => {
          const doctorId = String(item.doctorId || item.doctorName);
          const row = ensureDoctor(doctorId, item.doctorName);
          row.labFees += item.totalAmount;
          row.totalFees += item.totalAmount;
          patientSets.get(doctorId)?.add(String(item.patientId || item.patientName));
        });

        normalizedSurgeries.forEach((item) => {
          const doctorId = String(item.doctorId || item.doctorName);
          const row = ensureDoctor(doctorId, item.doctorName);
          row.surgeryFees += item.cost;
          row.totalFees += item.cost;
          patientSets.get(doctorId)?.add(String(item.patientId || item.patientName));
        });

        const rows = Array.from(byDoctor.values())
          .map((row) => ({
            ...row,
            patientCount: patientSets.get(row.doctorId)?.size ?? 0,
          }))
          .filter((row) => (selectedDoctorId === 'all' ? true : String(row.doctorId) === String(selectedDoctorId)))
          .sort((a, b) => b.totalFees - a.totalFees);

        const totalFees = rows.reduce((sum, row) => sum + row.totalFees, 0);

        return {
          title: 'Reception Fees Report (Doctor Wise)',
          subtitle: 'Doctor-wise fee breakdown for appointments, lab orders, and surgeries.',
          columns: [
            { key: 'doctor', label: t('ui.doctor') },
            { key: 'patientCount', label: 'Patients', kind: 'number' },
            { key: 'appointmentFees', label: 'Appointment Fees', kind: 'currency' },
            { key: 'labFees', label: 'Lab Fees', kind: 'currency' },
            { key: 'surgeryFees', label: t('ui.surgeryFees'), kind: 'currency' },
            { key: 'totalFees', label: t('ui.totalFees'), kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Doctors', value: String(rows.length) },
            { label: t('ui.totalFees'), value: formatCurrency(totalFees), tone: 'positive' },
          ],
        };
      }

      case 'reception_lab_orders': {
        const rows = normalizedLabOrders
          .map((item) => ({
            date: item.date,
            orderNumber: item.orderNumber,
            patient: item.patientName,
            doctor: item.doctorName,
            status: item.status,
            paymentStatus: item.paymentStatus,
            totalAmount: item.totalAmount,
            paidAmount: item.paidAmount,
            dueAmount: item.dueAmount,
          }))
          .sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0));

        const total = rows.reduce((sum, row) => sum + row.totalAmount, 0);
        const due = rows.reduce((sum, row) => sum + row.dueAmount, 0);

        return {
          title: 'Reception Lab Orders Report',
          subtitle: 'Date-wise lab orders with patient, doctor, and payment details.',
          columns: [
            { key: 'date', label: t('ui.date'), kind: 'date' },
            { key: 'orderNumber', label: 'Order No' },
            { key: 'patient', label: t('ui.patient') },
            { key: 'doctor', label: t('ui.doctor') },
            { key: 'status', label: t('ui.status') },
            { key: 'paymentStatus', label: t('ui.payment') },
            { key: 'totalAmount', label: t('ui.total'), kind: 'currency' },
            { key: 'paidAmount', label: t('ui.paid'), kind: 'currency' },
            { key: 'dueAmount', label: t('ui.due'), kind: 'currency' },
          ],
          rows,
          summary: [
            { label: t('ui.orders'), value: String(rows.length) },
            { label: t('ui.totalAmount'), value: formatCurrency(total), tone: 'positive' },
            { label: t('ui.due'), value: formatCurrency(due), tone: due > 0 ? 'negative' : 'default' },
          ],
        };
      }

      case 'reception_prescription_sales': {
        const rows = normalizedTransactions
          .filter((item) => item.trxType === 'sales')
          .map((item) => ({
            date: item.date,
            invoice: `TRX-${item.id}`,
            patient: item.patientName,
            itemsCount: item.detailsCount,
            grandTotal: item.grandTotal,
            paidAmount: item.paidAmount,
            dueAmount: item.dueAmount,
          }))
          .sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0));

        const sales = rows.reduce((sum, row) => sum + row.grandTotal, 0);

        return {
          title: 'Reception Prescription Sales Report',
          subtitle: 'Medicine sold report with invoice-level payment details.',
          columns: [
            { key: 'date', label: t('ui.date'), kind: 'date' },
            { key: 'invoice', label: t('ui.invoice') },
            { key: 'patient', label: t('ui.patient') },
            { key: 'itemsCount', label: 'Items', kind: 'number' },
            { key: 'grandTotal', label: t('ui.total'), kind: 'currency' },
            { key: 'paidAmount', label: t('ui.paid'), kind: 'currency' },
            { key: 'dueAmount', label: t('ui.due'), kind: 'currency' },
          ],
          rows,
          summary: [
            { label: t('ui.invoices'), value: String(rows.length) },
            { label: 'Sales Total', value: formatCurrency(sales), tone: 'positive' },
          ],
        };
      }

      case 'reception_surgery_operations': {
        const rows = normalizedSurgeries
          .map((item) => {
            const amounts = derivePaidDue(item.cost, item.paymentStatus);
            return {
              date: item.date,
              surgery: item.surgeryName,
              patient: item.patientName,
              doctor: item.doctorName,
              status: item.status,
              paymentStatus: item.paymentStatus,
              cost: item.cost,
              paid: amounts.paid,
              due: amounts.due,
            };
          })
          .sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0));

        const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);

        return {
          title: 'Reception Surgery Operations Report',
          subtitle: 'Surgery operations with fee and payment status details.',
          columns: [
            { key: 'date', label: t('ui.date'), kind: 'date' },
            { key: 'surgery', label: t('ui.surgery') },
            { key: 'patient', label: t('ui.patient') },
            { key: 'doctor', label: t('ui.doctor') },
            { key: 'status', label: t('ui.status') },
            { key: 'paymentStatus', label: t('ui.payment') },
            { key: 'cost', label: 'Cost', kind: 'currency' },
            { key: 'paid', label: t('ui.paid'), kind: 'currency' },
            { key: 'due', label: t('ui.due'), kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Operations', value: String(rows.length) },
            { label: 'Total Cost', value: formatCurrency(totalCost), tone: 'positive' },
          ],
        };
      }

      case 'reception_expenses': {
        const rows = normalizedExpenses
          .map((item) => ({
            date: item.date,
            title: item.title,
            category: item.category,
            paymentMethod: item.paymentMethod,
            status: item.status,
            createdBy: item.createdBy,
            amount: item.amount,
          }))
          .sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0));

        const totalExpense = rows.reduce((sum, row) => sum + row.amount, 0);

        return {
          title: 'Reception Expense Report',
          subtitle: 'Outgoing amounts and expense-level details.',
          columns: [
            { key: 'date', label: t('ui.date'), kind: 'date' },
            { key: 'title', label: t('ui.title') },
            { key: 'category', label: t('ui.category') },
            { key: 'paymentMethod', label: t('ui.paymentMethod') },
            { key: 'status', label: t('ui.status') },
            { key: 'createdBy', label: t('ui.createdBy') },
            { key: 'amount', label: t('ui.amount'), kind: 'currency' },
          ],
          rows,
          summary: [
            { label: t('ui.expenses'), value: String(rows.length) },
            { label: 'Total Outgoing', value: formatCurrency(totalExpense), tone: 'negative' },
          ],
        };
      }

      case 'reception_other_income': {
        const rows = normalizedOtherIncomes
          .map((item) => ({
            date: item.date,
            title: item.title,
            category: item.category,
            paymentMethod: item.paymentMethod,
            status: item.status,
            createdBy: item.createdBy,
            amount: item.amount,
          }))
          .sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0));

        const totalOtherIncome = rows.reduce((sum, row) => sum + row.amount, 0);

        return {
          title: 'Reception Other Income Report',
          subtitle: 'Additional hospital income entries and source details.',
          columns: [
            { key: 'date', label: t('ui.date'), kind: 'date' },
            { key: 'title', label: t('ui.title') },
            { key: 'category', label: t('ui.category') },
            { key: 'paymentMethod', label: t('ui.paymentMethod') },
            { key: 'status', label: t('ui.status') },
            { key: 'createdBy', label: t('ui.createdBy') },
            { key: 'amount', label: t('ui.amount'), kind: 'currency' },
          ],
          rows,
          summary: [
            { label: t('ui.entries'), value: String(rows.length) },
            { label: 'Total Other Income', value: formatCurrency(totalOtherIncome), tone: 'positive' },
          ],
        };
      }

      case 'reception_overall_clearance': {
        const rows = ledgerActive
          .map((item) => ({
            date: item.date,
            module: normalizeModuleName(item.module),
            title: item.title,
            direction: item.direction,
            amount: item.netAmount,
            paid: item.paidAmount,
            due: item.dueAmount,
            status: item.status,
            reference: `${item.sourceType}#${item.sourceId}`,
          }))
          .sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0));

        const incoming = rows.filter((row) => row.direction === 'income').reduce((sum, row) => sum + row.amount, 0);
        const outgoing = rows.filter((row) => row.direction === 'expense').reduce((sum, row) => sum + row.amount, 0);

        return {
          title: 'Reception Overall Clearance Report',
          subtitle: 'Incoming and outgoing details for day-end/date-wise clearance.',
          columns: [
            { key: 'date', label: t('ui.date'), kind: 'date' },
            { key: 'module', label: t('ui.module') },
            { key: 'title', label: t('ui.title') },
            { key: 'direction', label: 'Direction' },
            { key: 'amount', label: t('ui.amount'), kind: 'currency' },
            { key: 'paid', label: t('ui.paid'), kind: 'currency' },
            { key: 'due', label: t('ui.due'), kind: 'currency' },
            { key: 'status', label: t('ui.status') },
            { key: 'reference', label: t('ui.reference') },
          ],
          rows,
          summary: [
            { label: t('ui.entries'), value: String(rows.length) },
            { label: t('ui.incoming'), value: formatCurrency(incoming), tone: 'positive' },
            { label: t('ui.outgoing'), value: formatCurrency(outgoing), tone: 'negative' },
            { label: t('ui.net'), value: formatCurrency(incoming - outgoing), tone: incoming - outgoing >= 0 ? 'positive' : 'negative' },
          ],
        };
      }

      case 'pharmacy_available_stock': {
        const rowsForStock = normalizedStocks.map((stock) => {
          const medicine = medicinesById.get(stock.medicineId);
          const company = medicine?.manufacturerName || '-';
          const product = medicine?.brandName || stock.medicineName;
          const costPrice = stock.purchasePrice > 0 ? stock.purchasePrice : medicine?.costPrice || 0;
          const salePrice = stock.salePrice > 0 ? stock.salePrice : medicine?.salePrice || 0;

          return {
            company,
            product,
            batch: stock.batchNo,
            expiryDate: stock.expiryDate,
            qty: stock.quantity,
            stockCost: stock.quantity * costPrice,
            stockSale: stock.quantity * salePrice,
          };
        });

        if (stockGrouping === 'company') {
          const byCompany = new Map<string, { company: string; products: number; batches: number; qty: number; stockCost: number; stockSale: number }>();

          rowsForStock.forEach((item) => {
            if (!byCompany.has(item.company)) {
              byCompany.set(item.company, { company: item.company, products: 0, batches: 0, qty: 0, stockCost: 0, stockSale: 0 });
            }

            const row = byCompany.get(item.company)!;
            row.batches += 1;
            row.qty += item.qty;
            row.stockCost += item.stockCost;
            row.stockSale += item.stockSale;
          });

          rowsForStock.forEach((item) => {
            const row = byCompany.get(item.company);
            if (row) row.products += 1;
          });

          const rows = Array.from(byCompany.values()).sort((a, b) => b.stockCost - a.stockCost);
          return {
            title: 'Available Stock Report (Company Wise)',
            subtitle: 'Company-level stock clearance by quantity and stock value.',
            columns: [
              { key: 'company', label: t('ui.company') },
              { key: 'products', label: 'Products', kind: 'number' },
              { key: 'batches', label: t('ui.batches'), kind: 'number' },
              { key: 'qty', label: t('ui.totalQty'), kind: 'number' },
              { key: 'stockCost', label: 'Stock Value (Cost)', kind: 'currency' },
              { key: 'stockSale', label: 'Stock Value (Sale)', kind: 'currency' },
            ],
            rows,
            summary: [
              { label: 'Companies', value: String(rows.length) },
              { label: t('ui.totalQty'), value: String(rows.reduce((sum, row) => sum + row.qty, 0)) },
              { label: 'Cost Value', value: formatCurrency(rows.reduce((sum, row) => sum + row.stockCost, 0)), tone: 'positive' },
            ],
          };
        }

        if (stockGrouping === 'product') {
          const byProduct = new Map<string, {
            company: string;
            product: string;
            batches: number;
            qty: number;
            stockCost: number;
            stockSale: number;
            nearestExpiry: Date | null;
          }>();

          rowsForStock.forEach((item) => {
            const key = `${item.company}::${item.product}`;
            if (!byProduct.has(key)) {
              byProduct.set(key, {
                company: item.company,
                product: item.product,
                batches: 0,
                qty: 0,
                stockCost: 0,
                stockSale: 0,
                nearestExpiry: null,
              });
            }

            const row = byProduct.get(key)!;
            row.batches += 1;
            row.qty += item.qty;
            row.stockCost += item.stockCost;
            row.stockSale += item.stockSale;

            if (!row.nearestExpiry && item.expiryDate) {
              row.nearestExpiry = item.expiryDate;
            } else if (item.expiryDate && row.nearestExpiry && item.expiryDate < row.nearestExpiry) {
              row.nearestExpiry = item.expiryDate;
            }
          });

          const rows = Array.from(byProduct.values()).sort((a, b) => b.stockCost - a.stockCost);
          return {
            title: 'Available Stock Report (Product Wise)',
            subtitle: 'Product-level stock clearance including batch coverage and nearest expiry.',
            columns: [
              { key: 'company', label: t('ui.company') },
              { key: 'product', label: t('ui.product') },
              { key: 'batches', label: t('ui.batches'), kind: 'number' },
              { key: 'qty', label: t('ui.qty'), kind: 'number' },
              { key: 'nearestExpiry', label: 'Nearest Expiry', kind: 'date' },
              { key: 'stockCost', label: 'Stock Value (Cost)', kind: 'currency' },
              { key: 'stockSale', label: 'Stock Value (Sale)', kind: 'currency' },
            ],
            rows,
            summary: [
              { label: 'Products', value: String(rows.length) },
              { label: t('ui.totalQty'), value: String(rows.reduce((sum, row) => sum + row.qty, 0)) },
              { label: 'Cost Value', value: formatCurrency(rows.reduce((sum, row) => sum + row.stockCost, 0)), tone: 'positive' },
            ],
          };
        }

        const rows = rowsForStock
          .map((item) => ({
            company: item.company,
            product: item.product,
            batch: item.batch,
            expiryDate: item.expiryDate,
            qty: item.qty,
            stockCost: item.stockCost,
            stockSale: item.stockSale,
          }))
          .sort((a, b) => b.stockCost - a.stockCost);

        return {
          title: 'Available Stock Report (Batch Wise)',
          subtitle: 'Batch-level stock clearance with quantity and valuation.',
          columns: [
            { key: 'company', label: t('ui.company') },
            { key: 'product', label: t('ui.product') },
            { key: 'batch', label: 'Batch' },
            { key: 'expiryDate', label: t('ui.expiry'), kind: 'date' },
            { key: 'qty', label: t('ui.qty'), kind: 'number' },
            { key: 'stockCost', label: 'Stock Value (Cost)', kind: 'currency' },
            { key: 'stockSale', label: 'Stock Value (Sale)', kind: 'currency' },
          ],
          rows,
          summary: [
            { label: t('ui.batches'), value: String(rows.length) },
            { label: t('ui.totalQty'), value: String(rows.reduce((sum, row) => sum + row.qty, 0)) },
            { label: 'Cost Value', value: formatCurrency(rows.reduce((sum, row) => sum + row.stockCost, 0)), tone: 'positive' },
          ],
        };
      }

      case 'pharmacy_expiry': {
        const rows = normalizedStocks
          .filter((item) => item.expiryDate)
          .map((item) => {
            const medicine = medicinesById.get(item.medicineId);
            const company = medicine?.manufacturerName || '-';
            const product = medicine?.brandName || item.medicineName;
            const daysLeft = item.expiryDate ? differenceInCalendarDays(item.expiryDate, new Date()) : 0;
            const status = daysLeft < 0 ? 'Expired' : daysLeft <= 60 ? 'Near Expiry' : 'Safe';
            const unitCost = item.purchasePrice > 0 ? item.purchasePrice : medicine?.costPrice || 0;
            return {
              company,
              product,
              batch: item.batchNo,
              expiryDate: item.expiryDate,
              daysLeft,
              qty: item.quantity,
              status,
              atRiskValue: item.quantity * unitCost,
            };
          })
          .sort((a, b) => a.daysLeft - b.daysLeft);

        const expiredCount = rows.filter((row) => row.status === 'Expired').length;
        const nearExpiryCount = rows.filter((row) => row.status === 'Near Expiry').length;
        const atRisk = rows
          .filter((row) => row.status !== 'Safe')
          .reduce((sum, row) => sum + row.atRiskValue, 0);

        return {
          title: 'Pharmacy Expiry Report',
          subtitle: 'Expired and near-expiry stock visibility for clearance planning.',
          columns: [
            { key: 'company', label: t('ui.company') },
            { key: 'product', label: t('ui.product') },
            { key: 'batch', label: 'Batch' },
            { key: 'expiryDate', label: t('ui.expiry'), kind: 'date' },
            { key: 'daysLeft', label: 'Days Left', kind: 'number' },
            { key: 'qty', label: t('ui.qty'), kind: 'number' },
            { key: 'status', label: t('ui.status') },
            { key: 'atRiskValue', label: 'At Risk Value', kind: 'currency' },
          ],
          rows,
          summary: [
            { label: t('ui.rows'), value: String(rows.length) },
            { label: 'Expired', value: String(expiredCount), tone: expiredCount > 0 ? 'negative' : 'default' },
            { label: 'Near Expiry', value: String(nearExpiryCount), tone: nearExpiryCount > 0 ? 'negative' : 'default' },
            { label: 'At Risk Value', value: formatCurrency(atRisk), tone: atRisk > 0 ? 'negative' : 'default' },
          ],
        };
      }

      case 'pharmacy_purchase':
      case 'pharmacy_purchase_return_out':
      case 'pharmacy_sales':
      case 'pharmacy_sales_return_in': {
        const trxType =
          reportType === 'pharmacy_purchase'
            ? 'purchase'
            : reportType === 'pharmacy_purchase_return_out'
              ? 'purchase_return'
              : reportType === 'pharmacy_sales'
                ? 'sales'
                : 'sales_return';

        const rows = normalizedTransactions
          .filter((item) => item.trxType === trxType)
          .map((item) => ({
            date: item.date,
            invoice: `TRX-${item.id}`,
            supplier: item.supplierName,
            patient: item.patientName,
            itemsCount: item.detailsCount,
            grandTotal: item.grandTotal,
            paidAmount: item.paidAmount,
            dueAmount: item.dueAmount,
          }))
          .sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0));

        const total = rows.reduce((sum, row) => sum + row.grandTotal, 0);

        const titleMap: Record<string, string> = {
          purchase: 'Pharmacy Purchase Report',
          purchase_return: 'Pharmacy Return Out (Purchase Return)',
          sales: 'Pharmacy Sales Report',
          sales_return: 'Pharmacy Return In (Sale Return)',
        };

        return {
          title: titleMap[trxType],
          subtitle: 'Transaction-level report with complete payment details.',
          columns: [
            { key: 'date', label: t('ui.date'), kind: 'date' },
            { key: 'invoice', label: t('ui.invoice') },
            { key: 'supplier', label: t('ui.supplier') },
            { key: 'patient', label: 'Customer/Patient' },
            { key: 'itemsCount', label: 'Items', kind: 'number' },
            { key: 'grandTotal', label: t('ui.grandTotal'), kind: 'currency' },
            { key: 'paidAmount', label: t('ui.paid'), kind: 'currency' },
            { key: 'dueAmount', label: t('ui.due'), kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Transactions', value: String(rows.length) },
            { label: t('ui.totalAmount'), value: formatCurrency(total), tone: 'positive' },
          ],
        };
      }

      case 'pharmacy_customer_wise': {
        const byCustomer = new Map<string, {
          customer: string;
          invoices: number;
          salesAmount: number;
          returnAmount: number;
          paidAmount: number;
          dueAmount: number;
        }>();

        const ensureCustomer = (name: string) => {
          const key = name || 'Unknown Customer';
          if (!byCustomer.has(key)) {
            byCustomer.set(key, {
              customer: key,
              invoices: 0,
              salesAmount: 0,
              returnAmount: 0,
              paidAmount: 0,
              dueAmount: 0,
            });
          }
          return byCustomer.get(key)!;
        };

        normalizedTransactions
          .filter((item) => item.trxType === 'sales' || item.trxType === 'sales_return')
          .forEach((item) => {
            const row = ensureCustomer(item.patientName || 'Unknown Customer');
            row.invoices += 1;
            if (item.trxType === 'sales') {
              row.salesAmount += item.grandTotal;
              row.paidAmount += item.paidAmount;
              row.dueAmount += item.dueAmount;
            } else {
              row.returnAmount += item.grandTotal;
            }
          });

        const rows = Array.from(byCustomer.values())
          .map((item) => ({
            ...item,
            netSales: item.salesAmount - item.returnAmount,
          }))
          .sort((a, b) => b.netSales - a.netSales);

        const netTotal = rows.reduce((sum, row) => sum + row.netSales, 0);

        return {
          title: 'Pharmacy Customer Wise Report',
          subtitle: 'Customer-level sales, returns, and net values.',
          columns: [
            { key: 'customer', label: t('ui.customer') },
            { key: 'invoices', label: t('ui.invoices'), kind: 'number' },
            { key: 'salesAmount', label: 'Sales', kind: 'currency' },
            { key: 'returnAmount', label: 'Returns', kind: 'currency' },
            { key: 'netSales', label: 'Net Sales', kind: 'currency' },
            { key: 'paidAmount', label: t('ui.paid'), kind: 'currency' },
            { key: 'dueAmount', label: t('ui.due'), kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Customers', value: String(rows.length) },
            { label: 'Net Sales', value: formatCurrency(netTotal), tone: 'positive' },
          ],
        };
      }

      case 'pharmacy_summary': {
        const byType = new Map<string, { type: string; transactions: number; grandTotal: number; paid: number; due: number }>();

        normalizedTransactions.forEach((item) => {
          const key = item.trxType;
          if (!byType.has(key)) {
            byType.set(key, {
              type: key,
              transactions: 0,
              grandTotal: 0,
              paid: 0,
              due: 0,
            });
          }

          const row = byType.get(key)!;
          row.transactions += 1;
          row.grandTotal += item.grandTotal;
          row.paid += item.paidAmount;
          row.due += item.dueAmount;
        });

        const rows = Array.from(byType.values()).sort((a, b) => b.grandTotal - a.grandTotal);
        const totalGrand = rows.reduce((sum, row) => sum + row.grandTotal, 0);

        return {
          title: 'Pharmacy Summary Report',
          subtitle: 'Summary of purchase, sales, and return transactions.',
          columns: [
            { key: 'type', label: 'Transaction Type' },
            { key: 'transactions', label: 'Count', kind: 'number' },
            { key: 'grandTotal', label: t('ui.grandTotal'), kind: 'currency' },
            { key: 'paid', label: t('ui.paid'), kind: 'currency' },
            { key: 'due', label: t('ui.due'), kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Types', value: String(rows.length) },
            { label: t('ui.grandTotal'), value: formatCurrency(totalGrand), tone: 'positive' },
          ],
        };
      }

      case 'lab_samples': {
        const rows = normalizedLabOrders
          .map((item) => ({
            orderNumber: item.orderNumber,
            date: item.date,
            sampleCollectedAt: item.sampleCollectedAt,
            patient: item.patientName,
            doctor: item.doctorName,
            priority: item.priority,
            status: item.status,
            paymentStatus: item.paymentStatus,
            totalAmount: item.totalAmount,
          }))
          .sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0));

        const collected = rows.filter((row) => row.sampleCollectedAt).length;

        return {
          title: 'Lab Samples Report',
          subtitle: 'Sample collection and processing visibility by order.',
          columns: [
            { key: 'orderNumber', label: 'Order No' },
            { key: 'date', label: 'Created', kind: 'date' },
            { key: 'sampleCollectedAt', label: 'Sample Collected', kind: 'date' },
            { key: 'patient', label: t('ui.patient') },
            { key: 'doctor', label: t('ui.doctor') },
            { key: 'priority', label: t('ui.priority') },
            { key: 'status', label: t('ui.status') },
            { key: 'paymentStatus', label: t('ui.payment') },
            { key: 'totalAmount', label: t('ui.amount'), kind: 'currency' },
          ],
          rows,
          summary: [
            { label: t('ui.orders'), value: String(rows.length) },
            { label: 'Samples Collected', value: String(collected), tone: collected > 0 ? 'positive' : 'default' },
          ],
        };
      }

      case 'lab_orders_date_wise': {
        const byDate = new Map<string, { date: string; orders: number; totalAmount: number; paidAmount: number; dueAmount: number; completed: number }>();

        normalizedLabOrders.forEach((item) => {
          if (!item.date) return;
          const key = format(item.date, 'yyyy-MM-dd');

          if (!byDate.has(key)) {
            byDate.set(key, {
              date: key,
              orders: 0,
              totalAmount: 0,
              paidAmount: 0,
              dueAmount: 0,
              completed: 0,
            });
          }

          const row = byDate.get(key)!;
          row.orders += 1;
          row.totalAmount += item.totalAmount;
          row.paidAmount += item.paidAmount;
          row.dueAmount += item.dueAmount;
          if (String(item.status).toLowerCase() === 'completed') row.completed += 1;
        });

        const rows = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

        return {
          title: 'Lab Orders Report (Date Wise)',
          subtitle: 'Date-wise lab orders and financial totals.',
          columns: [
            { key: 'date', label: t('ui.date') },
            { key: 'orders', label: t('ui.orders'), kind: 'number' },
            { key: 'completed', label: 'Completed', kind: 'number' },
            { key: 'totalAmount', label: t('ui.total'), kind: 'currency' },
            { key: 'paidAmount', label: t('ui.paid'), kind: 'currency' },
            { key: 'dueAmount', label: t('ui.due'), kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Days', value: String(rows.length) },
            { label: t('ui.orders'), value: String(rows.reduce((sum, row) => sum + row.orders, 0)) },
            { label: t('ui.totalAmount'), value: formatCurrency(rows.reduce((sum, row) => sum + row.totalAmount, 0)), tone: 'positive' },
          ],
        };
      }

      case 'lab_doctor_wise': {
        const byDoctor = new Map<string, {
          doctorId: string;
          doctor: string;
          orders: number;
          completed: number;
          pending: number;
          totalAmount: number;
          paidAmount: number;
          dueAmount: number;
        }>();

        normalizedLabOrders.forEach((item) => {
          const doctorId = String(item.doctorId || item.doctorName);
          if (!byDoctor.has(doctorId)) {
            byDoctor.set(doctorId, {
              doctorId,
              doctor: item.doctorName || 'Unknown Doctor',
              orders: 0,
              completed: 0,
              pending: 0,
              totalAmount: 0,
              paidAmount: 0,
              dueAmount: 0,
            });
          }

          const row = byDoctor.get(doctorId)!;
          row.orders += 1;
          row.totalAmount += item.totalAmount;
          row.paidAmount += item.paidAmount;
          row.dueAmount += item.dueAmount;

          const status = String(item.status).toLowerCase();
          if (status === 'completed') row.completed += 1;
          else row.pending += 1;
        });

        const rows = Array.from(byDoctor.values())
          .filter((row) => (selectedDoctorId === 'all' ? true : String(row.doctorId) === String(selectedDoctorId)))
          .sort((a, b) => b.totalAmount - a.totalAmount);

        return {
          title: 'Lab Doctor Wise Report',
          subtitle: 'Doctor-level lab order volume and amount details.',
          columns: [
            { key: 'doctor', label: t('ui.doctor') },
            { key: 'orders', label: t('ui.orders'), kind: 'number' },
            { key: 'completed', label: 'Completed', kind: 'number' },
            { key: 'pending', label: t('ui.pending'), kind: 'number' },
            { key: 'totalAmount', label: t('ui.total'), kind: 'currency' },
            { key: 'paidAmount', label: t('ui.paid'), kind: 'currency' },
            { key: 'dueAmount', label: t('ui.due'), kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Doctors', value: String(rows.length) },
            { label: 'Total Orders', value: String(rows.reduce((sum, row) => sum + row.orders, 0)) },
            { label: t('ui.totalAmount'), value: formatCurrency(rows.reduce((sum, row) => sum + row.totalAmount, 0)), tone: 'positive' },
          ],
        };
      }

      default:
        return {
          title: 'Report',
          subtitle: 'No data available.',
          columns: [],
          rows: [],
          summary: [],
        };
    }
  }, [
    currency,
    doctors,
    formatCurrency,
    medicinesById,
    normalizedAppointments,
    normalizedExpenses,
    normalizedLabOrders,
    normalizedLedger,
    normalizedOtherIncomes,
    normalizedPatients,
    normalizedPrescriptions,
    normalizedStocks,
    normalizedSurgeries,
    normalizedTransactions,
    reportType,
    selectedDoctorId,
    stockGrouping,
  ]);

  const formatCellValue = (value: any, column: ReportColumn, forExport = false): string => {
    if (column.kind === 'currency') {
      return forExport ? toNumber(value).toFixed(2) : formatCurrency(toNumber(value));
    }
    if (column.kind === 'number') {
      return String(toNumber(value));
    }
    if (column.kind === 'date') {
      const date = toDate(value);
      if (!date) return '-';
      return format(date, 'yyyy-MM-dd HH:mm');
    }
    if (value === null || value === undefined || value === '') return '-';
    return String(value);
  };

  const formatCellValueForPrint = (value: any, column: ReportColumn): string => {
    if (column.kind === 'date') {
      const date = toDate(value);
      if (!date) return '-';
      return format(date, 'yyyy-MM-dd');
    }
    return formatCellValue(value, column);
  };

  const escapeHtml = (value: string): string => {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const escapeCsvValue = (value: string): string => {
    return `"${String(value).replace(/"/g, '""')}"`;
  };

  const getReportFileBaseName = () => {
    return `${buildReport.title.replace(/\s+/g, '_')}_${startDate}_${endDate}`.replace(/[^a-zA-Z0-9_.-]/g, '');
  };

  const numericTotalColumns = useMemo(() => {
    return buildReport.columns.filter((column) => column.kind === 'currency' || column.kind === 'number');
  }, [buildReport.columns]);

  /**
   * Search and sort applied to whatever the active report produced.
   *
   * Done generically on the built rows rather than inside each report, so every
   * report gets the same behaviour and a new report cannot forget to support it.
   */
  const visibleRows = useMemo(() => {
    const needle = tableSearch.trim().toLowerCase();

    let rows = buildReport.rows;
    if (needle) {
      rows = rows.filter((row) =>
        buildReport.columns.some((column) =>
          String(row[column.key] ?? '').toLowerCase().includes(needle)
        )
      );
    }

    if (!sortKey) return rows;

    const column = buildReport.columns.find((c) => c.key === sortKey);
    const numeric = column?.kind === 'currency' || column?.kind === 'number';

    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const result = numeric
        ? (Number(av) || 0) - (Number(bv) || 0)
        // numeric:true so "Patient 10" sorts after "Patient 2", not before it.
        : String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true });
      return sortDir === 'asc' ? result : -result;
    });
  }, [buildReport.rows, buildReport.columns, tableSearch, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  const reportColumnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    numericTotalColumns.forEach((column) => {
      totals[column.key] = 0;
    });

    visibleRows.forEach((row) => {
      numericTotalColumns.forEach((column) => {
        totals[column.key] += toNumber(row[column.key]);
      });
    });

    return totals;
  }, [visibleRows, numericTotalColumns]);

  const hasReportTotals = visibleRows.length > 0 && numericTotalColumns.length > 0;

  const pagination = useMemo(() => {
    const totalRows = visibleRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
    const normalizedCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (normalizedCurrentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalRows);

    return {
      totalRows,
      totalPages,
      currentPage: normalizedCurrentPage,
      startIndex,
      endIndex,
      rows: visibleRows.slice(startIndex, endIndex),
    };
  }, [visibleRows, currentPage, rowsPerPage]);

  useEffect(() => {
    if (currentPage !== pagination.currentPage) {
      setCurrentPage(pagination.currentPage);
    }
  }, [currentPage, pagination.currentPage]);

  const firstDescriptorColumnKey = useMemo(() => {
    const firstDescriptor = buildReport.columns.find((column) => column.kind !== 'currency' && column.kind !== 'number');
    return firstDescriptor?.key ?? buildReport.columns[0]?.key ?? '';
  }, [buildReport.columns]);

  const reportOptions = REPORT_OPTIONS[reportModule] ?? [];

  /**
   * The tab's reports arranged into named sections. Anything not listed in
   * REPORT_GROUPS still appears under "Other", so adding a report can never
   * make it silently invisible.
   */
  const groupedReportOptions = useMemo(() => {
    const groups = REPORT_GROUPS[reportModule] ?? [];
    const byKey = new Map(reportOptions.map((o) => [o.key, o]));
    const used = new Set<ReportType>();

    const sections = groups.map(({ group, keys }) => {
      const options = keys
        .map((key) => {
          const option = byKey.get(key);
          if (option) used.add(key);
          return option;
        })
        .filter((o): o is { key: ReportType; label: string } => Boolean(o));
      return { group, options };
    }).filter((section) => section.options.length > 0);

    const leftovers = reportOptions.filter((o) => !used.has(o.key));
    if (leftovers.length) sections.push({ group: 'Other', options: leftovers });

    return sections;
  }, [reportModule, reportOptions]);

  const exportToExcel = async () => {
    if (!buildReport.columns.length) return;
    const { XLSX } = await loadXlsxTools();

    const rows = visibleRows.map((row, index) => {
      const exportRow: Record<string, any> = {};
      exportRow['S/N'] = String(index + 1);
      buildReport.columns.forEach((column) => {
        exportRow[column.label] = formatCellValue(row[column.key], column, true);
      });
      return exportRow;
    });

    if (hasReportTotals) {
      const totalsRow: Record<string, string> = {
        'S/N': 'Totals',
      };
      buildReport.columns.forEach((column) => {
        totalsRow[column.label] = column.kind === 'currency' || column.kind === 'number'
          ? formatCellValue(reportColumnTotals[column.key], column, true)
          : '';
      });
      rows.push(totalsRow);
    }

    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Report');

    const summaryRows = [
      { Field: 'Report', Value: buildReport.title },
      { Field: 'Hospital', Value: hospital.name },
      { Field: 'From Date', Value: startDate },
      { Field: 'To Date', Value: endDate },
      ...buildReport.summary.map((item) => ({ Field: item.label, Value: item.value })),
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(book, summarySheet, 'Summary');

    XLSX.writeFile(book, `${getReportFileBaseName()}.xlsx`);
  };
  const exportToCsv = () => {
    if (!buildReport.columns.length) return;

    const lines: string[] = [];
    const header = ['S/N', ...buildReport.columns.map((column) => column.label)].map(escapeCsvValue).join(',');
    lines.push(header);

    visibleRows.forEach((row, index) => {
      const rowValues = [
        String(index + 1),
        ...buildReport.columns.map((column) => formatCellValue(row[column.key], column, true)),
      ];
      lines.push(rowValues.map(escapeCsvValue).join(','));
    });

    if (hasReportTotals) {
      const totalValues = [
        'Totals',
        ...buildReport.columns.map((column) => {
          if (column.kind === 'currency' || column.kind === 'number') {
            return formatCellValue(reportColumnTotals[column.key], column, true);
          }
          return '';
        }),
      ];
      lines.push(totalValues.map(escapeCsvValue).join(','));
    }

    if (buildReport.summary.length > 0) {
      lines.push('');
      lines.push(['Summary', 'Value'].map(escapeCsvValue).join(','));
      buildReport.summary.forEach((item) => {
        lines.push([item.label, item.value].map(escapeCsvValue).join(','));
      });
    }

    const csvBlob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${getReportFileBaseName()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToPdf = async () => {
    if (!buildReport.columns.length) return;

    const { jsPDF, autoTable } = await loadPdfTools();
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(buildReport.title, 14, 20);
    doc.setFontSize(10);
    doc.text(`Hospital: ${hospital.name}`, 14, 27);
    doc.text(`From ${startDate} to ${endDate}`, 14, 33);

    const pdfHead = [['S/N', ...buildReport.columns.map((column) => column.label)]];
    const pdfBody = visibleRows.map((row, index) => [
      String(index + 1),
      ...buildReport.columns.map((column) => formatCellValue(row[column.key], column, true)),
    ]);
    const pdfFoot = hasReportTotals
      ? [[
          'Totals',
          ...buildReport.columns.map((column) => {
            if (column.kind === 'currency' || column.kind === 'number') {
              return formatCellValue(reportColumnTotals[column.key], column, true);
            }
            return '';
          }),
        ]]
      : undefined;

    autoTable(doc, {
      startY: 38,
      head: pdfHead,
      body: pdfBody,
      foot: pdfFoot,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235] },
      footStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
      didDrawPage: () => {
        const page = doc.getCurrentPageInfo().pageNumber;
        const total = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.text(`Page ${page} of ${total}`, doc.internal.pageSize.width - 35, doc.internal.pageSize.height - 8);
      },
    });

    doc.save(`${getReportFileBaseName()}.pdf`);
  };

  const printReport = () => {
    if (!buildReport.columns.length) return;

    const printWindow = window.open('', '_blank', 'width=1200,height=760');
    if (!printWindow) return;

    const summaryHtml = buildReport.summary
      .map((item) => `<div class="summary-item"><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</div>`)
      .join('');

    const headers = [
      '<th class="num">S/N</th>',
      ...buildReport.columns.map((column) => {
        const rightAligned = column.kind === 'currency' || column.kind === 'number';
        return `<th class="${rightAligned ? 'num' : ''}">${escapeHtml(column.label)}</th>`;
      }),
    ].join('');

    const rows = visibleRows
      .map(
        (row, index) =>
          `<tr><td class="num">${index + 1}</td>${buildReport.columns
            .map((column) => {
              const rightAligned = column.kind === 'currency' || column.kind === 'number';
              return `<td class="${rightAligned ? 'num' : ''}">${escapeHtml(formatCellValueForPrint(row[column.key], column))}</td>`;
            })
            .join('')}</tr>`
      )
      .join('');

    const totalsRow = hasReportTotals
      ? `<tr class="totals-row"><td>Totals</td>${buildReport.columns
          .map((column) => {
            const rightAligned = column.kind === 'currency' || column.kind === 'number';
            const value = rightAligned
              ? formatCellValueForPrint(reportColumnTotals[column.key], column)
              : '';
            return `<td class="${rightAligned ? 'num' : ''}">${escapeHtml(value)}</td>`;
          })
          .join('')}</tr>`
      : '';

    printWindow.document.write(`
      <html>
        <head>
          <title>${escapeHtml(buildReport.title)}</title>
          <style>
            @page { size: A4 landscape; margin: 12mm 10mm 14mm; }
            body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #111827; }

            .head { border-bottom: 2px solid #111827; padding-bottom: 6px; margin-bottom: 8px; }
            h1 { margin: 0; font-size: 16px; }
            .sub { font-size: 10px; color: #4b5563; }
            .meta { display: flex; justify-content: space-between; align-items: flex-end; }

            .summary { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 10px; }
            .summary-item { border: 1px solid #d1d5db; border-radius: 4px; padding: 4px 8px; font-size: 10px; background: #f9fafb; }

            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #d1d5db; padding: 4px 5px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; }
            .num { text-align: right; font-variant-numeric: tabular-nums; }
            tbody tr:nth-child(even) td { background: #fbfbfc; }

            /*
              Repeat the header and the totals on every printed page. Without
              these the totals appear once, wherever the rows happen to end, so a
              multi-page report has pages with no figures to reconcile against.
            */
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
            tr { page-break-inside: avoid; }

            .totals-row td {
              font-weight: 700;
              background: #eef2f7;
              border-top: 2px solid #111827;
            }

            .foot { margin-top: 8px; font-size: 9px; color: #6b7280;
                    display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="head">
            <div class="meta">
              <div>
                <h1>${escapeHtml(buildReport.title)}</h1>
                <div class="sub">${escapeHtml(buildReport.subtitle)}</div>
              </div>
              <div class="sub" style="text-align:right;">
                <div><strong>${escapeHtml(hospital.name)}</strong></div>
                <div>${escapeHtml(startDate)} to ${escapeHtml(endDate)}</div>
              </div>
            </div>
          </div>
          <div class="summary">${summaryHtml}</div>
          <table>
            <thead><tr>${headers}</tr></thead>
            ${totalsRow ? `<tfoot>${totalsRow}</tfoot>` : ''}
            <tbody>${rows || `<tr><td colspan="${buildReport.columns.length + 1}">No rows found.</td></tr>`}</tbody>
          </table>
          <div class="foot">
            <span>Printed ${escapeHtml(new Date().toLocaleString())}</span>
            <span>${escapeHtml(String(visibleRows.length))} rows</span>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const showDoctorFilter = reportType === 'doctor_detailed' || reportType === 'reception_fees_doctor_wise' || reportType === 'lab_doctor_wise';
  const showStockGrouping = reportType === 'pharmacy_available_stock';

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Reports</h1>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Operational and financial reports for {hospital.name}.</p>
        </div>
        {/* Export actions as one quiet segmented control. Four saturated
            buttons competed with the report itself for attention; these are
            secondary actions and now read as such. */}
        <div className="inline-flex items-center rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden divide-x divide-gray-300 dark:divide-gray-600 bg-white dark:bg-gray-800">
          <button
            type="button"
            onClick={exportToCsv}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            title={t('ui.exportCsv')}
          >
            <FileDown className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={exportToExcel}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            title="Export Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            type="button"
            onClick={exportToPdf}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            title="Export PDF"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            type="button"
            onClick={printReport}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-white bg-gray-800 hover:bg-gray-900"
            title="Print report"
          >
            <Printer className="w-3.5 h-3.5" />{t('ui.print')}</button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Main tabs: an underlined tab bar, so the selected desk is obvious and
            the sub-reports below clearly belong to it. */}
        <div className="flex overflow-x-auto scrollbar-none border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
          {availableModules.map((module) => (
            <button
              key={module.key}
              type="button"
              onClick={() => setReportModule(module.key)}
              className={`relative shrink-0 px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                reportModule === module.key
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {module.label}
              {reportModule === module.key && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              )}
            </button>
          ))}
        </div>

        {/*
          Sub-reports: a single scrolling row of pills. The stacked grid cost
          several rows of vertical space before any data was visible; group
          names are kept as inline separators so the sections are still legible
          without each one claiming its own heading row.
        */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none px-3 py-1.5">
          {groupedReportOptions.map(({ group, options }, groupIndex) => (
            <React.Fragment key={group}>
              {groupIndex > 0 && (
                <span className="shrink-0 h-4 w-px bg-gray-200 dark:bg-gray-600 mx-0.5" aria-hidden="true" />
              )}
              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 pr-0.5">
                {group}
              </span>
              {options.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setReportType(option.key)}
                  title={option.label}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                    reportType === option.key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-700 dark:hover:text-blue-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Filters: a single inline strip. The previous card spent a heading row
          and a label above every control to say what a date input plainly is. */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />

          <div className="relative">
            <CalendarDays className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              title={t('ui.startDate')}
              aria-label={t('ui.startDate')}
              className="pl-7 pr-2 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <span className="text-xs text-gray-400">to</span>

          <div className="relative">
            <CalendarDays className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              title={t('ui.endDate')}
              aria-label={t('ui.endDate')}
              className="pl-7 pr-2 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {showDoctorFilter && (
              <select
                value={selectedDoctorId}
                onChange={(event) => setSelectedDoctorId(event.target.value)}
                title={t('ui.doctor')}
                aria-label={t('ui.doctor')}
                className="px-2 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Doctors</option>
                {doctorOptions.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                ))}
              </select>
          )}

          {showStockGrouping && (
              <select
                value={stockGrouping}
                onChange={(event) => setStockGrouping(event.target.value as StockGrouping)}
                title="Stock grouping"
                aria-label="Stock grouping"
                className="px-2 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="company">Company Wise</option>
                <option value="product">Product Wise</option>
                <option value="batch">Batch Wise</option>
              </select>
          )}

          <button
            type="button"
            onClick={() => {
              setStartDate(today);
              setEndDate(today);
              setSelectedDoctorId('all');
            }}
            className="px-2.5 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Today
          </button>
        </div>
      </div>

      {/* Title and summary share one strip: the title sits beside the figures
          instead of above them, which removes a whole band of white space. */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-2 lg:w-64 shrink-0">
            <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shrink-0">
              {reportModule === 'overall' && <BarChart3 className="w-4 h-4" />}
              {reportModule === 'reception' && <Receipt className="w-4 h-4" />}
              {reportModule === 'pharmacy' && <Pill className="w-4 h-4" />}
              {reportModule === 'lab' && <FlaskConical className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{buildReport.title}</h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">{buildReport.subtitle}</p>
            </div>
          </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
          {buildReport.summary.map((item) => (
            <div key={item.label} className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">{item.label}</p>
              <p
                className={`text-sm font-semibold leading-tight ${
                  item.tone === 'positive'
                    ? 'text-green-700 dark:text-green-400'
                    : item.tone === 'negative'
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-gray-900 dark:text-white'
                }`}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          {/* Search sits in the table header where the rows it filters are. */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={tableSearch}
              onChange={(event) => { setTableSearch(event.target.value); setCurrentPage(1); }}
              placeholder="Search this report..."
              aria-label="Search report rows"
              className="w-full pl-8 pr-2 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {visibleRows.length}{tableSearch ? ` of ${buildReport.rows.length}` : ''} rows
          </span>
          {loading && <span className="text-[11px] text-gray-500 ml-auto">Refreshing...</span>}
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-700/40 text-gray-500 dark:text-gray-400">
              <tr>
                {buildReport.columns.map((column) => {
                  const rightAligned = column.kind === 'currency' || column.kind === 'number';
                  const active = sortKey === column.key;
                  return (
                    <th
                      key={column.key}
                      onClick={() => toggleSort(column.key)}
                      title={`Sort by ${column.label}`}
                      className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        rightAligned ? 'text-right' : ''
                      }`}
                    >
                      <span className={`inline-flex items-center gap-1 ${rightAligned ? 'flex-row-reverse' : ''}`}>
                        {column.label}
                        {active
                          ? (sortDir === 'asc'
                              ? <ArrowUp className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                              : <ArrowDown className="w-3 h-3 text-blue-600 dark:text-blue-400" />)
                          : <ArrowUpDown className="w-3 h-3 text-gray-300 dark:text-gray-600" />}
                      </span>
                    </th>
                  );
                })}
                {/* Row inspector: the wide financial reports carry more columns
                    than fit comfortably, so each row can be opened in full. */}
                <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-center whitespace-nowrap">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-700 dark:text-gray-300">
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(1, buildReport.columns.length + 1)} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {tableSearch ? 'No rows match your search.' : 'No report rows found for selected criteria.'}
                  </td>
                </tr>
              ) : (
                pagination.rows.map((row, index) => (
                  <tr key={`${pagination.startIndex + index}-${row.id ?? row.reference ?? 'row'}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    {buildReport.columns.map((column) => {
                      const rightAligned = column.kind === 'currency' || column.kind === 'number';
                      return (
                        <td
                          key={column.key}
                          className={`px-3 py-1.5 whitespace-nowrap ${
                            rightAligned ? 'text-right font-medium tabular-nums' : ''
                          }`}
                        >
                          {formatCellValue(row[column.key], column)}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setDetailRow(row)}
                        title="View details"
                        aria-label="View details"
                        className="p-1 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {hasReportTotals && (
              <tfoot className="bg-gray-50 dark:bg-gray-700/20 border-t border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">
                <tr>
                  {buildReport.columns.map((column) => {
                    const rightAligned = column.kind === 'currency' || column.kind === 'number';
                    const value = rightAligned
                      ? formatCellValue(reportColumnTotals[column.key], column)
                      : column.key === firstDescriptorColumnKey
                        ? 'Totals'
                        : '';

                    return (
                      <td
                        key={column.key}
                        className={`px-3 py-1.5 whitespace-nowrap font-semibold ${
                          rightAligned ? 'text-right tabular-nums' : ''
                        }`}
                      >
                        {value}
                      </td>
                    );
                  })}
                  {/* Keeps the footer aligned with the added View column. */}
                  <td className="px-3 py-2" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {pagination.totalRows > 0
              ? `Showing ${pagination.startIndex + 1} to ${pagination.endIndex} of ${pagination.totalRows} rows`
              : 'Showing 0 rows'}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-gray-600 dark:text-gray-400">{t('ui.rows')}</label>
            <select
              value={rowsPerPage}
              onChange={(event) => {
                setRowsPerPage(Number(event.target.value));
                setCurrentPage(1);
              }}
              title="Rows per page"
              className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>

            <span className="text-xs text-gray-600 dark:text-gray-400 px-1">
              Page {pagination.currentPage} / {pagination.totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={pagination.currentPage === 1}
              className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-200"
            >
              First
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={pagination.currentPage === 1}
              className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-200"
            >{t('ui.prev')}</button>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
              disabled={pagination.currentPage >= pagination.totalPages}
              className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-200"
            >{t('ui.next')}</button>
            <button
              type="button"
              onClick={() => setCurrentPage(pagination.totalPages)}
              disabled={pagination.currentPage >= pagination.totalPages}
              className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-200"
            >
              Last
            </button>
          </div>
        </div>
      </div>

      {/*
        Row detail card.

        The financial reports carry a dozen columns, so a row read across a wide
        table is hard to follow. This shows one record as a card: the descriptive
        fields as a header, the money as a labelled grid, and a highlighted total.
      */}
      {detailRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {String(detailRow[firstDescriptorColumnKey] ?? buildReport.title)}
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">{buildReport.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                aria-label={t('ui.close')}
                className="p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
              {/* Identity fields first: who or what this row is about. */}
              <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                <p className="px-2.5 py-1 bg-gray-50 dark:bg-gray-700/40 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Details
                </p>
                <div className="px-2.5 py-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                  {buildReport.columns
                    .filter((column) => column.kind !== 'currency')
                    .map((column) => (
                      <div key={column.key} className="flex items-baseline justify-between gap-3 py-1 border-b border-gray-100 dark:border-gray-700/60 last:border-0">
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 shrink-0">{column.label}</span>
                        <span className="text-xs font-medium text-gray-900 dark:text-white text-right min-w-0 break-words">
                          {formatCellValue(detailRow[column.key], column) || '\u2014'}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Money, given its own block so the figures read as a statement. */}
              {buildReport.columns.some((column) => column.kind === 'currency') && (
                <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <p className="px-2.5 py-1 bg-gray-50 dark:bg-gray-700/40 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                    Amounts
                  </p>
                  <div className="p-2.5 space-y-2">
                    {/* Fee categories across one row of tiles, so the six income
                        streams can be compared at a glance instead of scanned
                        down a list. */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
                      {buildReport.columns
                        .filter((column) => column.kind === 'currency' && !SETTLEMENT_KEYS.includes(column.key))
                        .map((column) => {
                          const amount = toNumber(detailRow[column.key]);
                          return (
                            <div key={column.key} className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                              <p className="text-[9px] uppercase tracking-wide text-gray-500 dark:text-gray-400 leading-tight truncate">
                                {column.label}
                              </p>
                              <p className={`text-xs font-semibold tabular-nums leading-tight ${
                                amount === 0 ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'
                              }`}>
                                {formatCellValue(detailRow[column.key], column)}
                              </p>
                            </div>
                          );
                        })}
                    </div>

                    {/* Total, paid and due settle the account -- kept together
                        on their own row rather than mixed in with the fees. */}
                    {buildReport.columns.some((column) => SETTLEMENT_KEYS.includes(column.key)) && (
                      <div className="grid grid-cols-3 gap-1.5">
                        {buildReport.columns
                          .filter((column) => SETTLEMENT_KEYS.includes(column.key))
                          .map((column) => {
                            const amount = toNumber(detailRow[column.key]);
                            const tone = column.key === 'due' && amount > 0
                              ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-200'
                              : column.key === 'paid'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-200'
                                : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200';
                            return (
                              <div key={column.key} className={`rounded-md border px-2 py-1.5 ${tone}`}>
                                <p className="text-[9px] uppercase tracking-wide opacity-70 leading-tight">{column.label}</p>
                                <p className="text-sm font-bold tabular-nums leading-tight">
                                  {formatCellValue(detailRow[column.key], column)}
                                </p>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >{t('ui.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
