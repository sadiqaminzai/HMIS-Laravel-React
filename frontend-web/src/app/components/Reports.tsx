import React, { useEffect, useMemo, useState } from 'react';
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
  Users,
} from 'lucide-react';
import { differenceInCalendarDays, endOfDay, format, startOfDay } from 'date-fns';
import { Hospital, UserRole } from '../types';
import { useDoctors } from '../context/DoctorContext';
import { usePatients } from '../context/PatientContext';
import { useTransactions } from '../context/TransactionContext';
import { useStocks } from '../context/StockContext';
import { useAuth } from '../context/AuthContext';
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

const emptySource: ReportSourceState = {
  appointments: [],
  prescriptions: [],
  labOrders: [],
  transactions: [],
  surgeries: [],
  expenses: [],
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

const normalizeModuleName = (value: string): string => {
  const raw = String(value || 'other').toLowerCase();
  if (raw === 'appointments') return 'Appointments';
  if (raw === 'laboratory') return 'Laboratory';
  if (raw === 'pharmacy') return 'Pharmacy';
  if (raw === 'room_booking') return 'Room Booking';
  if (raw === 'surgery') return 'Surgery';
  if (raw === 'expenses') return 'Expenses';
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
  const { doctors } = useDoctors();
  const { patients: contextPatients } = usePatients();
  const { transactions: contextTransactions } = useTransactions();
  const { stocks: contextStocks } = useStocks();
  const { hasPermission } = useAuth();

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

  const normalizedLedger = useMemo(() => {
    return source.ledger
      .map(normalizeLedger)
      .filter((item) => item.status.toLowerCase() !== 'voided')
      .filter((item) => inDateRange(item.date, rangeStart, rangeEnd));
  }, [source.ledger, rangeEnd, rangeStart]);

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
        const byModule = new Map<string, { module: string; entries: number; incoming: number; outgoing: number; paid: number; due: number }>();

        ledgerActive.forEach((entry) => {
          const key = normalizeModuleName(entry.module);
          if (!byModule.has(key)) {
            byModule.set(key, {
              module: key,
              entries: 0,
              incoming: 0,
              outgoing: 0,
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
          } else if (entry.direction === 'expense') {
            bucket.outgoing += entry.netAmount;
          }
        });

        const rows = Array.from(byModule.values())
          .map((item) => ({
            ...item,
            net: item.incoming - item.outgoing,
          }))
          .sort((a, b) => b.net - a.net);

        const totalIncoming = rows.reduce((sum, row) => sum + row.incoming, 0);
        const totalOutgoing = rows.reduce((sum, row) => sum + row.outgoing, 0);
        const totalDue = rows.reduce((sum, row) => sum + row.due, 0);

        return {
          title: 'Overall Financial Report',
          subtitle: 'All financial parts consolidated by module.',
          columns: [
            { key: 'module', label: 'Module' },
            { key: 'entries', label: 'Entries', kind: 'number' },
            { key: 'incoming', label: 'Incoming', kind: 'currency' },
            { key: 'outgoing', label: 'Outgoing', kind: 'currency' },
            { key: 'net', label: 'Net', kind: 'currency' },
            { key: 'paid', label: 'Paid', kind: 'currency' },
            { key: 'due', label: 'Due', kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Modules', value: String(rows.length) },
            { label: 'Incoming', value: formatCurrency(totalIncoming), tone: 'positive' },
            { label: 'Outgoing', value: formatCurrency(totalOutgoing), tone: 'negative' },
            { label: 'Net', value: formatCurrency(totalIncoming - totalOutgoing), tone: totalIncoming - totalOutgoing >= 0 ? 'positive' : 'negative' },
            { label: 'Due', value: formatCurrency(totalDue), tone: totalDue > 0 ? 'negative' : 'default' },
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
            { key: 'date', label: 'Date', kind: 'date' },
            { key: 'doctor', label: 'Doctor' },
            { key: 'patient', label: 'Patient' },
            { key: 'service', label: 'Service' },
            { key: 'reference', label: 'Reference' },
            { key: 'status', label: 'Status' },
            { key: 'amount', label: 'Amount', kind: 'currency' },
            { key: 'paid', label: 'Paid', kind: 'currency' },
            { key: 'due', label: 'Due', kind: 'currency' },
          ],
          rows: filteredRows,
          summary: [
            { label: 'Rows', value: String(filteredRows.length) },
            { label: 'Unique Patients', value: String(uniquePatients.size) },
            { label: 'Total Amount', value: formatCurrency(totalAmount), tone: 'positive' },
            { label: 'Total Due', value: formatCurrency(totalDue), tone: totalDue > 0 ? 'negative' : 'default' },
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
            row.paid += entry.paidAmount;
            row.due += entry.dueAmount;
          });

        const rows = Array.from(patientMap.values())
          .map((item) => ({
            ...item,
            totalFees: item.appointmentFees + item.labFees + item.medicineSales + item.surgeryFees,
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
            { key: 'phone', label: 'Phone' },
            { key: 'visits', label: 'Visits', kind: 'number' },
            { key: 'appointmentFees', label: 'Appointment Fees', kind: 'currency' },
            { key: 'labFees', label: 'Lab Fees', kind: 'currency' },
            { key: 'medicineSales', label: 'Medicine Sold', kind: 'currency' },
            { key: 'surgeryFees', label: 'Surgery Fees', kind: 'currency' },
            { key: 'totalFees', label: 'Total Fees', kind: 'currency' },
            { key: 'paid', label: 'Paid', kind: 'currency' },
            { key: 'due', label: 'Due', kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Total Patients', value: String(rows.length) },
            { label: 'Active Patients', value: String(activePatients) },
            { label: 'Total Fees', value: formatCurrency(totalFees), tone: 'positive' },
            { label: 'Total Due', value: formatCurrency(totalDue), tone: totalDue > 0 ? 'negative' : 'default' },
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
            { key: 'module', label: 'Module' },
            { key: 'entries', label: 'Entries', kind: 'number' },
            { key: 'amount', label: 'Amount', kind: 'currency' },
            { key: 'paid', label: 'Paid', kind: 'currency' },
            { key: 'due', label: 'Due', kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Modules', value: String(rows.length) },
            { label: 'Total Fees', value: formatCurrency(totalAmount), tone: 'positive' },
            { label: 'Total Due', value: formatCurrency(totalDue), tone: totalDue > 0 ? 'negative' : 'default' },
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
            { key: 'doctor', label: 'Doctor' },
            { key: 'patientCount', label: 'Patients', kind: 'number' },
            { key: 'appointmentFees', label: 'Appointment Fees', kind: 'currency' },
            { key: 'labFees', label: 'Lab Fees', kind: 'currency' },
            { key: 'surgeryFees', label: 'Surgery Fees', kind: 'currency' },
            { key: 'totalFees', label: 'Total Fees', kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Doctors', value: String(rows.length) },
            { label: 'Total Fees', value: formatCurrency(totalFees), tone: 'positive' },
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
            { key: 'date', label: 'Date', kind: 'date' },
            { key: 'orderNumber', label: 'Order No' },
            { key: 'patient', label: 'Patient' },
            { key: 'doctor', label: 'Doctor' },
            { key: 'status', label: 'Status' },
            { key: 'paymentStatus', label: 'Payment' },
            { key: 'totalAmount', label: 'Total', kind: 'currency' },
            { key: 'paidAmount', label: 'Paid', kind: 'currency' },
            { key: 'dueAmount', label: 'Due', kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Orders', value: String(rows.length) },
            { label: 'Total Amount', value: formatCurrency(total), tone: 'positive' },
            { label: 'Due', value: formatCurrency(due), tone: due > 0 ? 'negative' : 'default' },
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
            { key: 'date', label: 'Date', kind: 'date' },
            { key: 'invoice', label: 'Invoice' },
            { key: 'patient', label: 'Patient' },
            { key: 'itemsCount', label: 'Items', kind: 'number' },
            { key: 'grandTotal', label: 'Total', kind: 'currency' },
            { key: 'paidAmount', label: 'Paid', kind: 'currency' },
            { key: 'dueAmount', label: 'Due', kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Invoices', value: String(rows.length) },
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
            { key: 'date', label: 'Date', kind: 'date' },
            { key: 'surgery', label: 'Surgery' },
            { key: 'patient', label: 'Patient' },
            { key: 'doctor', label: 'Doctor' },
            { key: 'status', label: 'Status' },
            { key: 'paymentStatus', label: 'Payment' },
            { key: 'cost', label: 'Cost', kind: 'currency' },
            { key: 'paid', label: 'Paid', kind: 'currency' },
            { key: 'due', label: 'Due', kind: 'currency' },
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
            { key: 'date', label: 'Date', kind: 'date' },
            { key: 'title', label: 'Title' },
            { key: 'category', label: 'Category' },
            { key: 'paymentMethod', label: 'Payment Method' },
            { key: 'status', label: 'Status' },
            { key: 'createdBy', label: 'Created By' },
            { key: 'amount', label: 'Amount', kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Expenses', value: String(rows.length) },
            { label: 'Total Outgoing', value: formatCurrency(totalExpense), tone: 'negative' },
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
            { key: 'date', label: 'Date', kind: 'date' },
            { key: 'module', label: 'Module' },
            { key: 'title', label: 'Title' },
            { key: 'direction', label: 'Direction' },
            { key: 'amount', label: 'Amount', kind: 'currency' },
            { key: 'paid', label: 'Paid', kind: 'currency' },
            { key: 'due', label: 'Due', kind: 'currency' },
            { key: 'status', label: 'Status' },
            { key: 'reference', label: 'Reference' },
          ],
          rows,
          summary: [
            { label: 'Entries', value: String(rows.length) },
            { label: 'Incoming', value: formatCurrency(incoming), tone: 'positive' },
            { label: 'Outgoing', value: formatCurrency(outgoing), tone: 'negative' },
            { label: 'Net', value: formatCurrency(incoming - outgoing), tone: incoming - outgoing >= 0 ? 'positive' : 'negative' },
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
              { key: 'company', label: 'Company' },
              { key: 'products', label: 'Products', kind: 'number' },
              { key: 'batches', label: 'Batches', kind: 'number' },
              { key: 'qty', label: 'Total Qty', kind: 'number' },
              { key: 'stockCost', label: 'Stock Value (Cost)', kind: 'currency' },
              { key: 'stockSale', label: 'Stock Value (Sale)', kind: 'currency' },
            ],
            rows,
            summary: [
              { label: 'Companies', value: String(rows.length) },
              { label: 'Total Qty', value: String(rows.reduce((sum, row) => sum + row.qty, 0)) },
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
              { key: 'company', label: 'Company' },
              { key: 'product', label: 'Product' },
              { key: 'batches', label: 'Batches', kind: 'number' },
              { key: 'qty', label: 'Qty', kind: 'number' },
              { key: 'nearestExpiry', label: 'Nearest Expiry', kind: 'date' },
              { key: 'stockCost', label: 'Stock Value (Cost)', kind: 'currency' },
              { key: 'stockSale', label: 'Stock Value (Sale)', kind: 'currency' },
            ],
            rows,
            summary: [
              { label: 'Products', value: String(rows.length) },
              { label: 'Total Qty', value: String(rows.reduce((sum, row) => sum + row.qty, 0)) },
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
            { key: 'company', label: 'Company' },
            { key: 'product', label: 'Product' },
            { key: 'batch', label: 'Batch' },
            { key: 'expiryDate', label: 'Expiry', kind: 'date' },
            { key: 'qty', label: 'Qty', kind: 'number' },
            { key: 'stockCost', label: 'Stock Value (Cost)', kind: 'currency' },
            { key: 'stockSale', label: 'Stock Value (Sale)', kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Batches', value: String(rows.length) },
            { label: 'Total Qty', value: String(rows.reduce((sum, row) => sum + row.qty, 0)) },
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
            { key: 'company', label: 'Company' },
            { key: 'product', label: 'Product' },
            { key: 'batch', label: 'Batch' },
            { key: 'expiryDate', label: 'Expiry', kind: 'date' },
            { key: 'daysLeft', label: 'Days Left', kind: 'number' },
            { key: 'qty', label: 'Qty', kind: 'number' },
            { key: 'status', label: 'Status' },
            { key: 'atRiskValue', label: 'At Risk Value', kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Rows', value: String(rows.length) },
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
            { key: 'date', label: 'Date', kind: 'date' },
            { key: 'invoice', label: 'Invoice' },
            { key: 'supplier', label: 'Supplier' },
            { key: 'patient', label: 'Customer/Patient' },
            { key: 'itemsCount', label: 'Items', kind: 'number' },
            { key: 'grandTotal', label: 'Grand Total', kind: 'currency' },
            { key: 'paidAmount', label: 'Paid', kind: 'currency' },
            { key: 'dueAmount', label: 'Due', kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Transactions', value: String(rows.length) },
            { label: 'Total Amount', value: formatCurrency(total), tone: 'positive' },
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
            { key: 'customer', label: 'Customer' },
            { key: 'invoices', label: 'Invoices', kind: 'number' },
            { key: 'salesAmount', label: 'Sales', kind: 'currency' },
            { key: 'returnAmount', label: 'Returns', kind: 'currency' },
            { key: 'netSales', label: 'Net Sales', kind: 'currency' },
            { key: 'paidAmount', label: 'Paid', kind: 'currency' },
            { key: 'dueAmount', label: 'Due', kind: 'currency' },
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
            { key: 'grandTotal', label: 'Grand Total', kind: 'currency' },
            { key: 'paid', label: 'Paid', kind: 'currency' },
            { key: 'due', label: 'Due', kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Types', value: String(rows.length) },
            { label: 'Grand Total', value: formatCurrency(totalGrand), tone: 'positive' },
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
            { key: 'patient', label: 'Patient' },
            { key: 'doctor', label: 'Doctor' },
            { key: 'priority', label: 'Priority' },
            { key: 'status', label: 'Status' },
            { key: 'paymentStatus', label: 'Payment' },
            { key: 'totalAmount', label: 'Amount', kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Orders', value: String(rows.length) },
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
            { key: 'date', label: 'Date' },
            { key: 'orders', label: 'Orders', kind: 'number' },
            { key: 'completed', label: 'Completed', kind: 'number' },
            { key: 'totalAmount', label: 'Total', kind: 'currency' },
            { key: 'paidAmount', label: 'Paid', kind: 'currency' },
            { key: 'dueAmount', label: 'Due', kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Days', value: String(rows.length) },
            { label: 'Orders', value: String(rows.reduce((sum, row) => sum + row.orders, 0)) },
            { label: 'Total Amount', value: formatCurrency(rows.reduce((sum, row) => sum + row.totalAmount, 0)), tone: 'positive' },
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
            { key: 'doctor', label: 'Doctor' },
            { key: 'orders', label: 'Orders', kind: 'number' },
            { key: 'completed', label: 'Completed', kind: 'number' },
            { key: 'pending', label: 'Pending', kind: 'number' },
            { key: 'totalAmount', label: 'Total', kind: 'currency' },
            { key: 'paidAmount', label: 'Paid', kind: 'currency' },
            { key: 'dueAmount', label: 'Due', kind: 'currency' },
          ],
          rows,
          summary: [
            { label: 'Doctors', value: String(rows.length) },
            { label: 'Total Orders', value: String(rows.reduce((sum, row) => sum + row.orders, 0)) },
            { label: 'Total Amount', value: formatCurrency(rows.reduce((sum, row) => sum + row.totalAmount, 0)), tone: 'positive' },
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

  const reportColumnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    numericTotalColumns.forEach((column) => {
      totals[column.key] = 0;
    });

    buildReport.rows.forEach((row) => {
      numericTotalColumns.forEach((column) => {
        totals[column.key] += toNumber(row[column.key]);
      });
    });

    return totals;
  }, [buildReport.rows, numericTotalColumns]);

  const hasReportTotals = buildReport.rows.length > 0 && numericTotalColumns.length > 0;

  const pagination = useMemo(() => {
    const totalRows = buildReport.rows.length;
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
      rows: buildReport.rows.slice(startIndex, endIndex),
    };
  }, [buildReport.rows, currentPage, rowsPerPage]);

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

  const exportToExcel = async () => {
    if (!buildReport.columns.length) return;
    const { XLSX } = await loadXlsxTools();

    const rows = buildReport.rows.map((row, index) => {
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

    buildReport.rows.forEach((row, index) => {
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
    const pdfBody = buildReport.rows.map((row, index) => [
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

    const rows = buildReport.rows
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
            body { font-family: Arial, sans-serif; margin: 18px; color: #111827; }
            h1 { margin: 0; font-size: 20px; }
            .sub { margin-top: 6px; font-size: 12px; color: #4b5563; }
            .summary { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0; }
            .summary-item { border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 10px; font-size: 12px; background: #f9fafb; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #e5e7eb; padding: 6px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; }
            .num { text-align: right; }
            .totals-row td { font-weight: 700; background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(buildReport.title)}</h1>
          <div class="sub">Hospital: ${escapeHtml(hospital.name)}</div>
          <div class="sub">Range: ${escapeHtml(startDate)} to ${escapeHtml(endDate)}</div>
          <div class="summary">${summaryHtml}</div>
          <table>
            <thead><tr>${headers}</tr></thead>
            <tbody>${rows || `<tr><td colspan="${buildReport.columns.length + 1}">No rows found.</td></tr>`}</tbody>
            ${totalsRow ? `<tfoot>${totalsRow}</tfoot>` : ''}
          </table>
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
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">Generate detailed operational and financial reports for {hospital.name}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportToCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-sky-600 text-white text-xs md:text-sm font-medium hover:bg-sky-700"
            title="Export CSV"
          >
            <FileDown className="w-4 h-4" />
            CSV
          </button>
          <button
            type="button"
            onClick={exportToExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-emerald-600 text-white text-xs md:text-sm font-medium hover:bg-emerald-700"
            title="Export Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
          <button
            type="button"
            onClick={exportToPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-blue-600 text-white text-xs md:text-sm font-medium hover:bg-blue-700"
            title="Export PDF"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button
            type="button"
            onClick={printReport}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-gray-900 text-white text-xs md:text-sm font-medium hover:bg-black"
            title="Print report"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {availableModules.map((module) => (
            <button
              key={module.key}
              type="button"
              onClick={() => setReportModule(module.key)}
              className={`px-3 py-2 rounded-md border text-xs md:text-sm font-medium transition-colors ${
                reportModule === module.key
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:border-blue-400'
              }`}
            >
              {module.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {reportOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setReportType(option.key)}
              className={`px-3 py-2 rounded-md border text-xs md:text-sm font-medium transition-colors text-left ${
                reportType === option.key
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:border-blue-400'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 md:p-4">
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200 text-xs md:text-sm font-semibold mb-3">
          <Filter className="w-4 h-4" />
          Filters
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
            <div className="relative">
              <CalendarDays className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                title="Start date"
                className="w-full pl-8 pr-2 py-2 text-xs md:text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">End Date</label>
            <div className="relative">
              <CalendarDays className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                title="End date"
                className="w-full pl-8 pr-2 py-2 text-xs md:text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {showDoctorFilter && (
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Doctor</label>
              <select
                value={selectedDoctorId}
                onChange={(event) => setSelectedDoctorId(event.target.value)}
                title="Doctor filter"
                className="w-full px-2 py-2 text-xs md:text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Doctors</option>
                {doctorOptions.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                ))}
              </select>
            </div>
          )}

          {showStockGrouping && (
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Stock View</label>
              <select
                value={stockGrouping}
                onChange={(event) => setStockGrouping(event.target.value as StockGrouping)}
                title="Stock grouping"
                className="w-full px-2 py-2 text-xs md:text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="company">Company Wise</option>
                <option value="product">Product Wise</option>
                <option value="batch">Batch Wise</option>
              </select>
            </div>
          )}

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setStartDate(today);
                setEndDate(today);
                setSelectedDoctorId('all');
              }}
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Reset to Today
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start gap-2 mb-3">
          <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            {reportModule === 'overall' && <BarChart3 className="w-4 h-4" />}
            {reportModule === 'reception' && <Receipt className="w-4 h-4" />}
            {reportModule === 'pharmacy' && <Pill className="w-4 h-4" />}
            {reportModule === 'lab' && <FlaskConical className="w-4 h-4" />}
          </div>
          <div>
            <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">{buildReport.title}</h2>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">{buildReport.subtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {buildReport.summary.map((item) => (
            <div key={item.label} className="rounded-lg border border-gray-200 dark:border-gray-700 p-2.5">
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{item.label}</p>
              <p
                className={`text-sm md:text-base font-semibold mt-1 ${
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

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Detailed Report Data</h3>
          {loading && <span className="text-xs text-gray-500">Refreshing...</span>}
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[980px] text-left text-xs md:text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/40 text-gray-700 dark:text-gray-300">
              <tr>
                {buildReport.columns.map((column) => (
                  <th key={column.key} className="px-3 py-2 font-semibold whitespace-nowrap">{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-700 dark:text-gray-300">
              {buildReport.rows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(1, buildReport.columns.length)} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No report rows found for selected criteria.
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
                          className={`px-3 py-2 whitespace-nowrap ${rightAligned ? 'text-right font-medium' : ''}`}
                        >
                          {formatCellValue(row[column.key], column)}
                        </td>
                      );
                    })}
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
                        className={`px-3 py-2 whitespace-nowrap font-semibold ${rightAligned ? 'text-right' : ''}`}
                      >
                        {value}
                      </td>
                    );
                  })}
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
            <label className="text-xs text-gray-600 dark:text-gray-400">Rows</label>
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
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
              disabled={pagination.currentPage >= pagination.totalPages}
              className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-200"
            >
              Next
            </button>
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

      <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-2">
        <Users className="w-3.5 h-3.5" />
        Doctor report, patient report, and fee details are now generated from real data with CSV, Excel, PDF, and tuned print support.
      </div>
    </div>
  );
}
