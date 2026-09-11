import React, { useState, useEffect, useMemo } from 'react';
import { formatMoneyIn, formatNumberIn } from '../utils/money';
import { useTranslation } from 'react-i18next';
import {
  Users,
  FileText,
  Pill,
  Stethoscope,
  Building2,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Clock,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  TestTube,
  Activity,
  Calendar,
  ClipboardList,
  AlertCircle,
  Package,
  Printer,
  HeartPulse,
  Bed,
  Radio,
  ScanLine,
  Smile,
  CalendarDays,
  Database,
  Wallet,
} from 'lucide-react';
import { UserRole, Hospital } from '../types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../../api/axios';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  LabelList
} from 'recharts';
import { AppFooter } from './AppFooter';
import { UserWiseTotalsPanel } from './UserWiseTotalsPanel';
import { ActiveUsersPanel } from './ActiveUsersPanel';
import { printHandoverReport } from '../utils/handoverPrint';

/** Rendered instead of the ISO code, which reads as noise to local staff. */
/**
 * Every dashboard panel is switched independently, because the dashboard is the
 * one screen that aggregates figures from every module -- revenue, payroll,
 * stock value -- and a role rarely needs all of them.
 *
 * Keys must match the `view_dashboard_<key>` permissions seeded by
 * LabPrintPermissionsSeeder.
 */
const DASHBOARD_PANELS = [
  'available_stock', 'medicine_sale', 'appointment_fees', 'lab_orders_amount',
  'surgery_fees', 'room_booking_fees', 'ultrasound_fees', 'xray_fees', 'dental_fees', 'ecg_fees',
  'medicine_profit',
  'expenses', 'inventory_purchases',
  'other_income', 'salary', 'revenue_total',
  'count_hospitals', 'count_doctors', 'count_patients', 'count_prescriptions',
  'count_medicines', 'count_test_templates', 'count_lab_tests',
  'count_appointments', 'count_rooms', 'count_surgeries',
  'count_ultrasound', 'count_xray', 'count_dental', 'count_ecg',
  'chart_monthly', 'chart_appointment_status', 'chart_test_status',
  'chart_medicine_stock', 'chart_hourly', 'chart_income', 'chart_collection',
  'recent_patients', 'recent_prescriptions', 'recent_lab_orders',
] as const;

export type DashboardPanel = typeof DASHBOARD_PANELS[number];

interface DashboardProps {
  role: UserRole;
  hospital: Hospital | null;
}

interface DashboardSummary {
  hospital_id: number | null;
  hospitals: Array<{
    id: number | string;
    name: string;
    code?: string;
    status?: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    license?: string | null;
    license_issue_date?: string | null;
    license_expiry_date?: string | null;
    subscription_status?: string | null;
    timezone?: string | null;
  }>;
  counts: {
    hospitals: number;
    doctors: number;
    active_doctors: number;
    patients: number;
    prescriptions: number;
    medicines: number;
    manufacturers: number;
    medicine_types: number;
    test_templates: number;
    rooms: number;
    active_rooms: number;
    surgeries: number;
    lab_orders_today: number;
    ultrasound_exams_today: number;
    xray_receipts_today: number;
    dental_receipts_today: number;
    ecg_receipts_today: number;
    patients_period: number;
    prescriptions_period: number;
    dental_services: number;
    xray_types: number;
    appointments_today: number;
    room_bookings_today: number;
    patient_surgeries_today: number;
  };
  charts: {
    monthly: Array<{ month: string; patients: number; prescriptions: number; appointments: number; room_bookings: number; patient_surgeries: number; lab_orders: number }>;
    hourly: Array<{ hour: string; patients: number; appointments: number; lab_orders: number; prescriptions: number }>;
    appointment_status: Array<{ name: string; value: number; color: string }>;
    test_status: Array<{ name: string; value: number; color: string }>;
    medicine_stock: Array<{ name: string; value: number; color: string; units?: number }>;
    collection_status: Array<{ name: string; value: number; color: string; amount?: number }>;
  };
  recent: {
    patients: Array<{ id: number; name: string; patient_id?: string; age?: number; gender?: string }>;
    prescriptions: Array<{ id: number; patient_name?: string; prescription_number?: string; items_count?: number }>;
    lab_orders: Array<{ id: number; patient_name?: string; order_number?: string; status?: string }>;
  };
  financials?: {
    report_date: string;
    report_period_start?: string;
    report_period_end?: string;
    currency: string;
    total_stock_cost_amount?: number;
    total_fees: number;
    total_lab_fees: number;
    total_surgery_fees?: number;
    total_room_fees?: number;
    total_ultrasound_fees?: number;
    total_xray_fees?: number;
    total_dental_fees?: number;
    total_sales_invoice_amount: number;
    total_sales_paid_amount?: number;
    total_sales_due_amount?: number;
    total_sales_return_amount?: number;
    total_net_medicine_sale?: number;
    total_other_income?: number;
    total_income: number;
    total_expenses: number;
    total_inventory_purchases?: number;
    total_cash_flow?: number;
    total_salary?: number;
    total_expenses_with_salary?: number;
    total_revenue?: number;
  };
}

export function Dashboard({ role, hospital }: DashboardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [dateFilter, setDateFilter] = useState<
    'today' | 'yesterday' | 'last_7_days' | 'this_month' | 'last_month' | 'this_year' | 'all_time' | 'custom'
  >('today');
  // Only sent when the range is 'custom'. Seeded to today so the inputs are
  // never blank when the user first switches to them.
  const todayIso = new Date().toISOString().slice(0, 10);


  const [showFinanceSubmission, setShowFinanceSubmission] = useState(false);
  const [customFrom, setCustomFrom] = useState(todayIso);
  const [customTo, setCustomTo] = useState(todayIso);

  /**
   * What the date dropdown currently means, in words.
   *
   * The counts panel below is headed with this, because "Lab Tests 12" is
   * meaningless without saying twelve *when*.
   */
  const periodLabel = (() => {
    switch (dateFilter) {
      case 'today': return t('ui.today', 'Today');
      case 'yesterday': return t('ui.yesterday', 'Yesterday');
      case 'last_7_days': return t('ui.last7Days', 'Last 7 Days');
      case 'this_month': return t('ui.thisMonth', 'This Month');
      case 'last_month': return t('ui.lastMonth', 'Last Month');
      case 'this_year': return t('ui.thisYear', 'This Year');
      case 'all_time': return t('ui.allTime', 'All Time');
      // The word "Custom" says nothing; the dates are the whole point of
      // having picked them.
      default:
        return customFrom && customTo
          ? (customFrom === customTo ? customFrom : `${customFrom} - ${customTo}`)
          : t('ui.customRange', 'Custom Range');
    }
  })();

  useEffect(() => {
    if (!hospital) return;

    const loadSummary = async () => {
      try {
        const params = {
          date_filter: dateFilter,
          ...(dateFilter === 'custom' ? { start_date: customFrom, end_date: customTo } : {}),
          ...(role === 'super_admin' ? { hospital_id: hospital.id } : {}),
        };
        const { data } = await api.get('/dashboard/summary', { params });
        setSummary(data);
      } catch (error) {
        setSummary(null);
      }
    };

    loadSummary();
  }, [hospital?.id, role, dateFilter, customFrom, customTo]);

  const counts = summary?.counts ?? {
    hospitals: 0,
    doctors: 0,
    active_doctors: 0,
    patients: 0,
    prescriptions: 0,
    medicines: 0,
    manufacturers: 0,
    medicine_types: 0,
    test_templates: 0,
    rooms: 0,
    active_rooms: 0,
    surgeries: 0,
    lab_orders_today: 0,
    ultrasound_exams_today: 0,
    xray_receipts_today: 0,
    dental_receipts_today: 0,
    ecg_receipts_today: 0,
    patients_period: 0,
    prescriptions_period: 0,
    dental_services: 0,
    xray_types: 0,
    appointments_today: 0,
    room_bookings_today: 0,
    patient_surgeries_today: 0,
  };

  const monthlyData = summary?.charts.monthly ?? [];
  const hourlyData = summary?.charts.hourly ?? [];

  const testStatusData = summary?.charts.test_status ?? [];
  const medicineStockData = summary?.charts.medicine_stock ?? [];
  const collectionStatusData = summary?.charts.collection_status ?? [];
  const appointmentStatusData = summary?.charts.appointment_status ?? [];
  const hospitalsData = summary?.hospitals ?? (hospital ? [hospital] : []);
  const recentData = summary?.recent ?? { patients: [], prescriptions: [], lab_orders: [] };
  const lowStockCount = medicineStockData.find(item => item.name === 'Low Stock')?.value ?? 0;
  const scheduledCount = appointmentStatusData.find(item => item.name === 'Scheduled')?.value ?? 0;
  const pendingLabCount = testStatusData.find(item => item.name === 'Pending')?.value ?? 0;
  const inProgressLabCount = testStatusData.find(item => item.name === 'In Progress')?.value ?? 0;
  const completedLabCount = testStatusData.find(item => item.name === 'Completed')?.value ?? 0;
  const dailyFinancials = summary?.financials ?? {
    report_date: new Date().toISOString().slice(0, 10),
    report_period_start: new Date().toISOString().slice(0, 10),
    report_period_end: new Date().toISOString().slice(0, 10),
    currency: 'AFN',
    total_stock_cost_amount: 0,
    total_fees: 0,
    total_lab_fees: 0,
    total_surgery_fees: 0,
    total_room_fees: 0,
    total_ultrasound_fees: 0,
    total_xray_fees: 0,
    total_dental_fees: 0,
    total_sales_invoice_amount: 0,
    total_sales_return_amount: 0,
    total_net_medicine_sale: 0,
    total_other_income: 0,
    total_income: 0,
    total_expenses: 0,
    total_inventory_purchases: 0,
    total_cash_flow: 0,
    total_salary: 0,
    total_expenses_with_salary: 0,
    total_revenue: 0,
  };
  const netIncome = dailyFinancials.total_income - dailyFinancials.total_expenses - (dailyFinancials.total_salary ?? 0);

  /**
   * Intl renders AFN as the literal string "AFN", which is what made every tile
   * read "AFN 51,269.52". Afghan users expect the afghani sign, so the symbol is
   * placed manually and Intl is used only for digit grouping.
   */
  /**
   * Money in the language the user chose.
   *
   * This built the string by hand -- an en-US number with the symbol glued to
   * the front -- so a Pashto dashboard showed Western digits and put ؋ on the
   * wrong side of a right-to-left column. Intl places the symbol and picks the
   * digits itself once it is given the right locale.
   */
  const formatMoney = (amount: number) =>
    formatMoneyIn(amount, dailyFinancials.currency || 'AFN', i18n.language);

  /** Counts get the same digits as the money beside them. */
  const formatCount = (value: number | string) =>
    formatNumberIn(Number(value) || 0, i18n.language);

  /**
   * Every panel is gated on its own permission, with no fallback.
   *
   * An earlier version fell back to module permissions until a "new" dashboard
   * permission was granted, so a role holding only long-standing ones saw every
   * tile regardless of what was ticked. That made the checkboxes look broken.
   * The permission is now the only thing consulted.
   *
   * Consequence: a role with no dashboard permissions sees no panels. That is
   * intended -- the tiles are opt-in per role.
   *
   * @param panel the dashboard panel key; extra arguments are ignored and kept
   *              only so existing call sites need not change.
   */
  const showPanel = (panel: DashboardPanel, ..._fallbacks: string[]) => {
    if (role === 'super_admin') return true;
    return hasPermission(`view_dashboard_${panel}`);
  };

  /**
   * Income by module for the selected period.
   *
   * Derived from dailyFinancials, which is already on screen -- so the chart
   * costs nothing extra and can never disagree with the tiles above it. Each
   * slice is gated on the same permission as its tile, so a user who may not
   * see lab income does not see it reappear here; zero-value modules drop out
   * so a quiet day does not render as a row of stubs.
   */
  const revenueByModule = useMemo(() => {
    const rows = [
      { key: 'appointment_fees', name: t('ui.appointmentsFees'), value: Number(dailyFinancials.total_fees ?? 0), fill: '#14b8a6',
        perms: ['view_appointments', 'manage_appointments'] },
      { key: 'lab_orders_amount', name: t('ui.laboratoryTests', 'Laboratory Tests'), value: Number(dailyFinancials.total_lab_fees ?? 0), fill: '#6366f1',
        perms: ['view_lab_orders', 'manage_lab_orders'] },
      { key: 'surgery_fees', name: t('ui.surgeryFees'), value: Number(dailyFinancials.total_surgery_fees ?? 0), fill: '#f97316',
        perms: ['view_patient_surgeries', 'manage_patient_surgeries'] },
      { key: 'room_booking_fees', name: t('ui.roomBookingFees'), value: Number(dailyFinancials.total_room_fees ?? 0), fill: '#06b6d4',
        perms: ['view_room_bookings', 'manage_room_bookings'] },
      { key: 'ultrasound_fees', name: t('ui.ultrasoundFees'), value: Number(dailyFinancials.total_ultrasound_fees ?? 0), fill: '#d946ef',
        perms: ['view_ultrasound_exams', 'manage_ultrasound_exams'] },
      { key: 'xray_fees', name: t('ui.xrayFees'), value: Number(dailyFinancials.total_xray_fees ?? 0), fill: '#0284c7',
        perms: ['view_xray_receipts', 'manage_xray_receipts'] },
      { key: 'dental_fees', name: t('ui.dentalFees'), value: Number(dailyFinancials.total_dental_fees ?? 0), fill: '#0d9488',
        perms: ['view_dental_receipts', 'manage_dental_receipts'] },
      { key: 'ecg_fees', name: t('ui.ecgFees', 'ECG Fees'), value: Number(dailyFinancials.total_ecg_fees ?? 0), fill: '#ef4444',
        perms: ['view_ecg_receipts', 'manage_ecg_receipts'] },
      { key: 'medicine_sale', name: t('ui.medicineNetSale'),
        value: Number(dailyFinancials.total_net_medicine_sale ?? 0), fill: '#3b82f6',
        perms: ['view_transactions', 'manage_transactions'] },
      { key: 'other_income', name: t('ui.otherIncome'), value: Number(dailyFinancials.total_other_income ?? 0), fill: '#22c55e',
        perms: ['view_other_incomes', 'manage_other_incomes'] },
    ];

    // Every module this user may see, including the ones at zero -- a desk
    // that earned nothing today is information, and silently dropping it made
    // the chart look like the module was missing.
    return rows
      .filter((row) => showPanel(row.key as DashboardPanel, ...row.perms))
      .filter((row) => Number.isFinite(row.value))
      .sort((a, b) => b.value - a.value);
  }, [dailyFinancials, t]);

  /**
   * Which series the trend charts may draw.
   *
   * Same rule as the count cards above: a series is drawn only if this user is
   * allowed the corresponding count panel. Without it the charts became a side
   * channel -- the tile was hidden but the line was still there to read.
   */
  const trendSeries = useMemo(() => {
    const all = [
      { key: 'patients', name: t('ui.totalPatients'), colour: '#3b82f6',
        panel: 'count_patients' as DashboardPanel, perms: ['view_patients', 'manage_patients'] },
      { key: 'appointments', name: t('ui.appointments'), colour: '#14b8a6',
        panel: 'count_appointments' as DashboardPanel, perms: ['view_appointments', 'manage_appointments'] },
      { key: 'lab_orders', name: t('ui.laboratoryTests'), colour: '#6366f1',
        panel: 'count_lab_tests' as DashboardPanel, perms: ['view_lab_orders', 'manage_lab_orders'] },
      { key: 'prescriptions', name: t('ui.totalPrescriptions'), colour: '#10b981',
        panel: 'count_prescriptions' as DashboardPanel, perms: ['view_prescriptions', 'manage_prescriptions'] },
      { key: 'patient_surgeries', name: t('ui.surgeries'), colour: '#f43f5e',
        panel: 'count_surgeries' as DashboardPanel, perms: ['view_surgeries', 'manage_surgeries'] },
      { key: 'ultrasound', name: t('ui.ultrasound', 'Ultrasound'), colour: '#d946ef',
        panel: 'count_ultrasound' as DashboardPanel, perms: ['view_ultrasound_exams', 'manage_ultrasound_exams'] },
      { key: 'xray', name: t('ui.xray', 'X-Ray'), colour: '#0284c7',
        panel: 'count_xray' as DashboardPanel, perms: ['view_xray_receipts', 'manage_xray_receipts'] },
      { key: 'dental', name: t('ui.dental', 'Dental'), colour: '#0d9488',
        panel: 'count_dental' as DashboardPanel, perms: ['view_dental_receipts', 'manage_dental_receipts'] },
      { key: 'room_bookings', name: t('ui.roomBookings', 'Room Bookings'), colour: '#6366f1',
        panel: 'count_rooms' as DashboardPanel, perms: ['view_room_bookings', 'manage_room_bookings'] },
    ];

    return all.filter((row) => showPanel(row.panel, ...row.perms));
  }, [t]);

  const revenueByModuleTotal = useMemo(
    () => revenueByModule.reduce((sum, row) => sum + row.value, 0),
    [revenueByModule]
  );

  const rbacMetrics = useMemo(() => {
    const canViewMedicines = hasPermission('view_dashboard_available_stock')
      || hasPermission('view_medicines')
      || hasPermission('manage_medicines')
      || hasPermission('dispense_medicines');
    const canViewTransactions = hasPermission('view_dashboard_medicine_sale')
      || hasPermission('view_dashboard_revenue_total')
      || hasPermission('view_transactions')
      || hasPermission('manage_transactions');
    const canViewAppointments = hasPermission('view_dashboard_appointment_fees')
      || hasPermission('view_appointments')
      || hasPermission('manage_appointments');
    const canViewLabOrders = hasPermission('view_dashboard_lab_orders_amount')
      || hasPermission('view_lab_orders')
      || hasPermission('manage_lab_orders')
      || hasPermission('manage_lab_payments');
    const canViewExpenses = hasPermission('view_dashboard_expenses')
      || hasPermission('view_expenses')
      || hasPermission('manage_expenses');
    const canViewOtherIncomes = hasPermission('view_other_incomes')
      || hasPermission('manage_other_incomes');
    const canViewSalary = hasPermission('view_payroll_batches')
      || hasPermission('manage_payroll_batches')
      || hasPermission('view_payroll_items')
      || hasPermission('manage_payroll_items')
      || hasPermission('generate_payroll')
      || hasPermission('approve_payroll')
      || hasPermission('print_payslips');
    const canViewSurgeries = hasPermission('view_dashboard_surgery_fees')
      || hasPermission('view_surgeries')
      || hasPermission('manage_surgeries')
      || hasPermission('manage_patient_surgeries');
    const canViewRoomBookings = hasPermission('view_dashboard_room_booking_fees')
      || hasPermission('view_room_bookings')
      || hasPermission('manage_room_bookings');
    const canViewRevenue = hasPermission('view_dashboard_revenue_total')
      || canViewTransactions
      || canViewAppointments
      || canViewLabOrders
      || canViewSurgeries
      || canViewRoomBookings
      || canViewSalary;

    return [
      {
        key: 'available_stock',
        group: 'pharmacy' as const,
        label: t('ui.availableStock'),
        value: formatMoney(dailyFinancials.total_stock_cost_amount ?? 0),
        helper: 'Current stock value at cost price',
        icon: <Pill className="w-4 h-4" />,
        color: 'bg-pink-500',
        visible: showPanel('available_stock', 'view_medicines', 'manage_medicines', 'dispense_medicines'),
      },
      {
        key: 'medicine_sale',
        group: 'income' as const,
        label: t('ui.medicineNetSale'),
        // Sales invoices less sales returns. The gross invoice total is still
        // sent as total_sales_invoice_amount for anyone who needs it.
        value: formatMoney(dailyFinancials.total_net_medicine_sale
          ?? (dailyFinancials.total_sales_invoice_amount - (dailyFinancials.total_sales_return_amount ?? 0))),
        helper: 'Medicine invoices less sales returns for selected period',
        icon: <Package className="w-4 h-4" />,
        color: 'bg-blue-500',
        visible: showPanel('medicine_sale', 'view_transactions', 'manage_transactions'),
      },
      {
        key: 'appointment_fees',
        group: 'income' as const,
        label: t('ui.appointmentsFees'),
        value: formatMoney(dailyFinancials.total_fees),
        helper: 'All doctor appointments for selected period',
        icon: <Calendar className="w-4 h-4" />,
        color: 'bg-teal-500',
        visible: showPanel('appointment_fees', 'view_appointments', 'manage_appointments'),
      },
      {
        key: 'lab_orders_amount',
        group: 'income' as const,
        label: t('ui.labOrdersAmount'),
        value: formatMoney(dailyFinancials.total_lab_fees),
        helper: 'Lab order amount for selected period',
        icon: <TestTube className="w-4 h-4" />,
        color: 'bg-indigo-500',
        visible: showPanel('lab_orders_amount', 'view_lab_orders', 'manage_lab_orders', 'manage_lab_payments'),
      },
      {
        key: 'surgery_fees',
        group: 'income' as const,
        label: t('ui.surgeryFees'),
        value: formatMoney(dailyFinancials.total_surgery_fees ?? 0),
        helper: 'Total surgery fees for selected period',
        icon: <HeartPulse className="w-4 h-4" />,
        color: 'bg-orange-500',
        visible: showPanel('surgery_fees', 'view_surgeries', 'manage_surgeries', 'manage_patient_surgeries'),
      },
      {
        key: 'room_booking_fees',
        group: 'income' as const,
        label: t('ui.roomBookingFees'),
        value: formatMoney(dailyFinancials.total_room_fees ?? 0),
        helper: 'Total room booking fees for selected period',
        icon: <Bed className="w-4 h-4" />,
        color: 'bg-cyan-500',
        visible: showPanel('room_booking_fees', 'view_room_bookings', 'manage_room_bookings'),
      },
      {
        key: 'ultrasound_fees',
        group: 'income' as const,
        label: t('ui.ultrasoundFees'),
        value: formatMoney(dailyFinancials.total_ultrasound_fees ?? 0),
        helper: 'Total ultrasound fees for selected period',
        icon: <Radio className="w-4 h-4" />,
        color: 'bg-fuchsia-500',
        visible: showPanel('ultrasound_fees', 'view_ultrasound_exams', 'manage_ultrasound_exams', 'manage_ultrasound_payments'),
      },
      {
        key: 'xray_fees',
        group: 'income' as const,
        label: t('ui.xrayFees'),
        value: formatMoney(dailyFinancials.total_xray_fees ?? 0),
        helper: 'Total X-Ray fees for selected period',
        icon: <ScanLine className="w-4 h-4" />,
        color: 'bg-sky-600',
        visible: showPanel('xray_fees', 'view_xray_receipts', 'manage_xray_receipts', 'manage_xray_payments'),
      },
      {
        key: 'dental_fees',
        group: 'income' as const,
        label: t('ui.dentalFees'),
        value: formatMoney(dailyFinancials.total_dental_fees ?? 0),
        helper: 'Total dental fees for selected period',
        icon: <Smile className="w-4 h-4" />,
        color: 'bg-teal-600',
        visible: showPanel('dental_fees', 'view_dental_receipts', 'manage_dental_receipts', 'manage_dental_payments'),
      },
      {
        key: 'ecg_fees',
        group: 'income' as const,
        label: t('ui.ecgFees', 'ECG Fees'),
        value: formatMoney(dailyFinancials.total_ecg_fees ?? 0),
        helper: 'Total ECG fees for selected period',
        icon: <Activity className="w-4 h-4" />,
        color: 'bg-red-500',
        visible: showPanel('ecg_fees', 'view_ecg_receipts', 'manage_ecg_receipts', 'manage_ecg_payments'),
      },
      {
        key: 'other_income',
        group: 'income' as const,
        label: t('ui.expenses'),
        value: formatMoney(dailyFinancials.total_expenses),
        helper: 'Operating expenses only — rent, utilities, supplies',
        icon: <TrendingDown className="w-4 h-4" />,
        color: 'bg-rose-500',
        visible: showPanel('expenses', 'view_expenses', 'manage_expenses'),
      },
      {
        key: 'inventory_purchases',
        group: 'pharmacy' as const,
        label: t('ui.inventoryPurchases'),
        value: formatMoney(dailyFinancials.total_inventory_purchases ?? 0),
        // Deliberately NOT part of Revenue: this money became stock, it was not
        // consumed. Reported so the cash movement stays visible.
        helper: 'Stock bought this period — an asset, not an expense',
        icon: <Package className="w-4 h-4" />,
        color: 'bg-violet-500',
        visible: showPanel('inventory_purchases', 'view_transactions', 'manage_transactions'),
      },
      {
        key: 'medicine_profit',
        group: 'pharmacy' as const,
        label: t('ui.medicineProfit', 'Medicine Sales Profit'),
        value: formatMoney(dailyFinancials.total_medicine_profit ?? 0),
        // Cost of goods shown in the helper: a margin with no visible cost
        // behind it is a number nobody can check.
        helper: `Net sale less cost of goods (${formatMoney(dailyFinancials.total_medicine_cogs ?? 0)}) for selected period`,
        icon: <TrendingUp className="w-4 h-4" />,
        color: 'bg-emerald-600',
        visible: showPanel('medicine_profit', 'view_transactions', 'manage_transactions'),
      },
      {
        key: 'expenses',
        group: 'income' as const,
        label: t('ui.otherIncomeAmount'),
        value: formatMoney(dailyFinancials.total_other_income ?? 0),
        helper: 'Additional hospital income for selected period',
        icon: <TrendingUp className="w-4 h-4" />,
        color: 'bg-emerald-600',
        visible: showPanel('other_income', 'view_other_incomes', 'manage_other_incomes'),
      },
      {
        key: 'salary',
        group: 'income' as const,
        label: t('ui.salary'),
        value: formatMoney(dailyFinancials.total_salary ?? 0),
        helper: 'Total payroll salary for selected period',
        icon: <ClipboardList className="w-4 h-4" />,
        color: 'bg-red-500',
        visible: showPanel('salary', 'view_payroll_batches', 'manage_payroll_batches', 'view_payroll_items', 'manage_payroll_items'),
      },
      {
        key: 'revenue_total',
        group: 'income' as const,
        label: t('ui.revenueTotal'),
        value: formatMoney(dailyFinancials.total_revenue ?? netIncome),
        helper: 'Income less operating expenses and salary (excludes stock purchases)',
        icon: <TrendingUp className="w-4 h-4" />,
        color: 'bg-emerald-500',
        visible: showPanel('revenue_total', 'view_transactions', 'manage_transactions'),
      },
    ];
  }, [
    dailyFinancials.total_revenue,
    dailyFinancials.total_ecg_fees,
    dailyFinancials.total_stock_cost_amount,
    dailyFinancials.total_expenses,
    dailyFinancials.total_inventory_purchases,
    dailyFinancials.total_salary,
    dailyFinancials.total_fees,
    dailyFinancials.total_income,
    dailyFinancials.total_lab_fees,
    dailyFinancials.total_surgery_fees,
    dailyFinancials.total_room_fees,
    dailyFinancials.total_sales_invoice_amount,
    dailyFinancials.total_sales_return_amount,
    dailyFinancials.total_net_medicine_sale,
    dailyFinancials.total_other_income,
    dailyFinancials.total_medicine_profit,
    dailyFinancials.total_medicine_cogs,
    formatMoney,
    hasPermission,
    netIncome,
  ]);

  /** Per-series totals across the period, shown in the hourly chart legend. */
  const seriesTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const series of trendSeries) {
      totals[series.key] = hourlyData.reduce(
        (sum, row: any) => sum + (Number(row?.[series.key]) || 0),
        0
      );
    }
    return totals;
  }, [trendSeries, hourlyData]);

  /** The hour with the most activity across the permitted series. */
  const busiestHour = useMemo(() => {
    let best: { hour: string; total: number } | null = null;
    for (const row of hourlyData as any[]) {
      const total = trendSeries.reduce((sum, s) => sum + (Number(row?.[s.key]) || 0), 0);
      if (total > 0 && (!best || total > best.total)) {
        best = { hour: String(row?.hour ?? ''), total };
      }
    }
    return best;
  }, [hourlyData, trendSeries]);

  /**
   * The three status donuts, each behind its own permission.
   *
   * Built as data rather than three copies of the same markup, so adding a
   * fourth is one entry instead of another block to keep in step.
   */
  const statusCharts = useMemo(() => ([
    {
      key: 'collection_status',
      title: t('ui.collectionStatus', 'Collection Status'),
      badge: periodLabel,
      icon: <Wallet className="w-4 h-4 text-amber-500" />,
      data: collectionStatusData,
      unitLabel: t('ui.receipts', 'Receipts'),
      // Legend leads with the money: "40 unpaid" is meaningless until you
      // know whether that is 300 or 300,000.
      money: true,
      visible: showPanel('chart_collection'),
    },
    {
      key: 'appointment_status',
      title: t('ui.appointmentStatus', 'Appointment Status'),
      badge: periodLabel,
      icon: <Calendar className="w-4 h-4 text-teal-500" />,
      data: appointmentStatusData,
      unitLabel: t('ui.appointments'),
      visible: showPanel('chart_appointment_status', 'view_appointments', 'manage_appointments'),
    },
    {
      key: 'test_status',
      title: t('ui.testStatus', 'Lab Test Status'),
      badge: periodLabel,
      icon: <TestTube className="w-4 h-4 text-indigo-500" />,
      data: testStatusData,
      unitLabel: t('ui.laboratoryTests'),
      visible: showPanel('chart_test_status', 'view_lab_orders', 'manage_lab_orders'),
    },
    {
      key: 'medicine_stock',
      title: t('ui.medicineStock', 'Medicine Stock Health'),
      // Stock is a standing position, not a period figure -- it is what is on
      // the shelf right now, so it carries no date badge.
      badge: t('ui.rightNow', 'Right now'),
      icon: <Package className="w-4 h-4 text-emerald-500" />,
      data: medicineStockData,
      unitLabel: t('ui.totalMedicines'),
      visible: showPanel('chart_medicine_stock', 'view_medicines', 'manage_medicines', 'view_stocks', 'manage_stocks'),
    },
  ].filter((chart) => chart.visible && chart.data.some((row: any) => Number(row.value) > 0))),
  [t, periodLabel, appointmentStatusData, testStatusData, medicineStockData, collectionStatusData]);

  const visibleRbacMetrics = rbacMetrics.filter(item => item.visible);

  const getLegendDotClass = (color?: string) => {
    switch ((color || '').toLowerCase()) {
      case '#3b82f6':
        return 'bg-blue-500';
      case '#10b981':
        return 'bg-emerald-500';
      case '#ef4444':
        return 'bg-red-500';
      case '#6b7280':
        return 'bg-gray-500';
      case '#f59e0b':
        return 'bg-amber-500';
      case '#7c3aed':
        return 'bg-violet-600';
      default:
        return 'bg-slate-400';
    }
  };

  /**
   * Prints the hospital-wide handover sheet for the range on screen.
   *
   * Only the totals this user is permitted to see are included -- the backend
   * decides that, and the figures below are already filtered the same way.
   */
  const financialRange = {
    from: dailyFinancials.report_period_start || dailyFinancials.report_date || todayIso,
    to: dailyFinancials.report_period_end || dailyFinancials.report_date || todayIso,
  };

  const printReceptionFinancialReport = async () => {
    try {
      const params: Record<string, string | number> = {
        from: financialRange.from,
        to: financialRange.to,
      };
      if (role === 'super_admin' && summary?.hospital_id) {
        params.hospital_id = summary.hospital_id;
      }
      const { data } = await api.get('/dashboard/finance-submission', { params });
      printHandoverReport({
        hospitalName: hospital?.name || 'Hospital',
        hospitalAddress: hospital?.address,
        hospitalPhone: hospital?.phone,
        from: data.from,
        to: data.to,
        submittedBy: data.submitted_by?.name || '',
        generatedAt: data.generated_at,
        currency: data.currency,
        lines: data.lines.map((line: any) => ({
          label: line.label,
          amount: line.amount,
          entries: line.entries,
        })),
        totalAmount: data.total_amount,
      });
    } catch (err) {
      console.error('Could not build the finance submission report', err);
    }
  };


  const RbacDashboardMetrics = () => {
    if (visibleRbacMetrics.length === 0) {
      return null;
    }

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="text-xs font-semibold text-gray-900 dark:text-white">
              {t('ui.mainDashboard', 'Main Dashboard')}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {dateFilter === 'custom'
                ? `Showing ${customFrom} to ${customTo}.`
                : t('ui.figuresFollowRange', 'Figures follow the selected range.')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
              className="text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-md px-2 py-1.5"
              title="Main dashboard date filter"
            >
              <option value="today">{t('ui.today', 'Today')}</option>
              <option value="yesterday">{t('ui.yesterday', 'Yesterday')}</option>
              <option value="last_7_days">{t('ui.last7Days', 'Last 7 Days')}</option>
              <option value="this_month">{t('ui.thisMonth', 'This Month')}</option>
              <option value="last_month">{t('ui.lastMonth', 'Last Month')}</option>
              <option value="this_year">{t('ui.thisYear', 'This Year')}</option>
              {/* Everything on record. Sits after the year because it is the
                  widest range, and it is the one a manager reaches for when
                  asking "how are we doing overall". */}
              <option value="all_time">{t('ui.allTime', 'All Time')}</option>
              <option value="custom">{t('ui.customRange', 'Custom Range')}</option>
            </select>

            {/* The two date inputs only appear for a custom range, so the
                header stays compact for the presets people use daily. */}
            {dateFilter === 'custom' && (
              <>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  title="From date"
                  aria-label={t('ui.fromDate')}
                  className="text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-md px-2 py-1.5"
                />
                <span className="text-xs text-gray-400">to</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(e) => setCustomTo(e.target.value)}
                  title="To date"
                  aria-label={t('ui.toDate')}
                  className="text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-md px-2 py-1.5"
                />
              </>
            )}
          </div>
        </div>

        {/* Two groups. What the hospital earned and what it spent are read
            together -- they are the two halves of one question, and splitting
            expenses and salary into a third group headed "Other Income &
            Costs" put the answer two headings away from the figures it had to
            be weighed against. The pharmacy's stock position stays separate:
            stock is an asset the hospital is holding, not money it took.
            A group with nothing visible to this user renders nothing at all. */}
        <div className="space-y-3">
          {([
            { id: 'income', title: t('ui.incomeGroup', 'Income and Expenses'), accent: 'text-emerald-500' },
            { id: 'pharmacy', title: t('ui.pharmacyGroup', 'Pharmacy & Stock'), accent: 'text-blue-500' },
          ] as const).map((group) => {
            const tiles = visibleRbacMetrics.filter((metric) => metric.group === group.id);
            if (tiles.length === 0) return null;

            return (
              <div key={group.id}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${group.accent}`}>
                    {group.title}
                  </span>
                  <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {tiles.map((metric) => (
                    <StatCard
                      key={metric.key}
                      label={metric.label}
                      value={metric.value}
                      icon={metric.icon}
                      color={metric.color}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Super Admin Dashboard
  /**
   * The dashboard, for every role.
   *
   * There used to be six near-duplicate bodies -- one per role -- and any
   * panel added to one was silently missing from the other five. Every panel
   * here is gated by showPanel(), which grants super_admin everything and
   * checks view_dashboard_* for everyone else, so one body serves them all
   * and a permission granted in Settings > Roles now actually takes effect.
   */
  const UnifiedDashboard = () => (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{dashboardTitle}</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
            {hospital?.name || t('ui.hospital', 'Hospital')}
            {' - '}
            {role === 'super_admin' ? t('ui.analytics', 'analytics') : t('ui.overview', 'Overview')}
          </p>
        </div>
        {role === 'super_admin' && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Building2 className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {t('ui.selectedInHeader', 'Selected in header')}
            </span>
          </div>
        )}
      </div>

      <RbacDashboardMetrics />

      <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center gap-2 mb-2.5">
          <CalendarDays className="w-4 h-4 text-blue-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('ui.activityCounts', 'Activity')}
          </h2>
          <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30">
            {periodLabel}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Appointments first: the patient arrives here before anything else
            downstream happens. */}
        {showPanel('count_appointments', 'view_appointments', 'manage_appointments') && (
          <StatCard
            label={t('ui.appointments')}
            value={formatCount(counts.appointments_today)}
            icon={<Calendar className="w-4 h-4" />}
            color="bg-teal-500"
          />
        )}
        {/* The range-limited registration count. Total Patients above is now
            all-time, so this is where "how many arrived today" lives. */}
        {showPanel('count_patients', 'view_patients', 'manage_patients') && (
          <StatCard
            label={t('ui.newPatients', 'New Patients')}
            value={formatCount(counts.patients_period)}
            icon={<Users className="w-4 h-4" />}
            color="bg-green-500"
          />
        )}
        {showPanel('count_lab_tests', 'view_lab_orders', 'manage_lab_orders') && (
          <StatCard
            label={t('ui.laboratoryTests')}
            value={formatCount(counts.lab_orders_today)}
            icon={<Activity className="w-4 h-4" />}
            color="bg-cyan-500"
          />
        )}
        {showPanel('count_ultrasound', 'view_ultrasound_exams', 'manage_ultrasound_exams') && (
          <StatCard
            label={t('ui.ultrasound', 'Ultrasound')}
            value={formatCount(counts.ultrasound_exams_today)}
            icon={<Radio className="w-4 h-4" />}
            color="bg-fuchsia-500"
          />
        )}
        {showPanel('count_xray', 'view_xray_receipts', 'manage_xray_receipts') && (
          <StatCard
            label={t('ui.xray', 'X-Ray')}
            value={formatCount(counts.xray_receipts_today)}
            icon={<ScanLine className="w-4 h-4" />}
            color="bg-sky-600"
          />
        )}
        {showPanel('count_dental', 'view_dental_receipts', 'manage_dental_receipts') && (
          <StatCard
            label={t('ui.dental', 'Dental')}
            value={formatCount(counts.dental_receipts_today)}
            icon={<Smile className="w-4 h-4" />}
            color="bg-teal-600"
          />
        )}
        {showPanel('count_ecg', 'view_ecg_receipts', 'manage_ecg_receipts') && (
          <StatCard
            label={t('ui.ecg', 'ECG')}
            value={formatCount(counts.ecg_receipts_today)}
            icon={<Activity className="w-4 h-4" />}
            color="bg-red-500"
          />
        )}
        {showPanel('count_rooms', 'view_room_bookings', 'manage_room_bookings') && (
          <StatCard
            label={t('ui.roomBookings', 'Room Bookings')}
            value={formatCount(counts.room_bookings_today)}
            icon={<Package className="w-4 h-4" />}
            color="bg-indigo-500"
          />
        )}
        </div>
      </section>

      {/* Two panels, not three mixed rows. Absolute totals and period counts
          were interleaved, so "Total Patients 2,072" sat beside "X-Ray 2" and
          nothing said the second one meant "yesterday". */}
      <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center gap-2 mb-2.5">
          <Database className="w-4 h-4 text-purple-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('ui.overallTotals', 'Overall Totals')}
          </h2>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {t('ui.allTimeHint', 'All time - not affected by the date filter')}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {showPanel('count_hospitals', 'view_hospitals', 'manage_hospitals') && (
          <StatCard
            label={t('ui.totalHospitals')}
            value={formatCount(counts.hospitals)}
            icon={<Building2 className="w-4 h-4" />}
            color="bg-purple-500"
          />
        )}
        {showPanel('count_doctors', 'view_doctors', 'manage_doctors') && (
          <StatCard
            label={t('ui.totalDoctors')}
            value={formatCount(counts.doctors)}
            icon={<Stethoscope className="w-4 h-4" />}
            color="bg-blue-500"
          />
        )}
        {showPanel('count_patients', 'view_patients', 'manage_patients') && (
          <StatCard
            label={t('ui.totalPatients')}
            value={formatCount(counts.patients)}
            icon={<Users className="w-4 h-4" />}
            color="bg-green-500"
          />
        )}
        {showPanel('count_prescriptions', 'view_prescriptions', 'manage_prescriptions') && (
          <StatCard
            label={t('ui.totalPrescriptions')}
            value={formatCount(counts.prescriptions)}
            icon={<FileText className="w-4 h-4" />}
            color="bg-orange-500"
          />
        )}
        {showPanel('count_medicines', 'view_medicines', 'manage_medicines', 'view_stocks', 'manage_stocks') && (
          <StatCard
            label={t('ui.totalMedicines')}
            value={formatCount(counts.medicines)}
            icon={<Pill className="w-4 h-4" />}
            color="bg-pink-500"
          />
        )}
        {showPanel('count_test_templates', 'view_test_templates', 'manage_test_templates') && (
          <StatCard
            label={t('ui.testTemplatesCount')}
            value={formatCount(counts.test_templates)}
            icon={<TestTube className="w-4 h-4" />}
            color="bg-indigo-500"
          />
        )}
        {showPanel('count_rooms', 'view_rooms', 'manage_rooms') && (
          <StatCard
            label={t('ui.totalRooms')}
            value={formatCount(counts.rooms)}
            icon={<Bed className="w-4 h-4" />}
            color="bg-cyan-500"
          />
        )}
        {showPanel('count_rooms', 'view_rooms', 'manage_rooms') && (
          <StatCard
            label={t('ui.activeRooms')}
            value={formatCount(counts.active_rooms)}
            icon={<CheckCircle className="w-4 h-4" />}
            color="bg-emerald-500"
          />
        )}
        {showPanel('count_surgeries', 'view_surgeries', 'manage_surgeries') && (
          <StatCard
            label={t('ui.surgeries')}
            value={formatCount(counts.surgeries)}
            icon={<Activity className="w-4 h-4" />}
            color="bg-rose-500"
          />
        )}
        {showPanel('count_xray', 'view_xray_types', 'manage_xray_types') && (
          <StatCard
            label={t('ui.xrayTypesCount', 'X-Ray Types')}
            value={formatCount(counts.xray_types)}
            icon={<ScanLine className="w-4 h-4" />}
            color="bg-sky-600"
          />
        )}
        {showPanel('count_dental', 'view_dental_services', 'manage_dental_services') && (
          <StatCard
            label={t('ui.dentalServicesCount', 'Dental Services')}
            value={formatCount(counts.dental_services)}
            icon={<Smile className="w-4 h-4" />}
            color="bg-teal-600"
          />
        )}
        {showPanel('count_ecg', 'view_ecg_services', 'manage_ecg_services') && (
          <StatCard
            label={t('ui.ecgServicesCount', 'ECG Services')}
            value={formatCount(counts.ecg_services)}
            icon={<Activity className="w-4 h-4" />}
            color="bg-red-500"
          />
        )}
        </div>
      </section>

      {/* Where the money came from. Sits directly under the counts because it
          answers the question the tiles raise: which desk earned it. */}
      {showPanel('chart_income') && revenueByModule.length > 0 && (
      <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('ui.incomeByModule', 'Income by Module')}
          </h2>
          <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30">
            {periodLabel}
          </span>
          <span className="ms-auto text-xs font-semibold text-gray-900 dark:text-white tabular-nums">
            {formatMoney(revenueByModuleTotal)}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* dir="ltr" on the plot only. recharts positions its axes and bars
              in document order, so under an RTL page the category labels were
              painted on top of the bars. The surrounding card stays RTL. */}
          <div dir="ltr" className="lg:col-span-2 min-h-[260px]">
            <ResponsiveContainer width="100%" height={Math.max(240, revenueByModule.length * 34)}>
              <BarChart data={revenueByModule} layout="vertical" margin={{ left: 4, right: 76 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.12} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="#6b7280" tickFormatter={(v) => formatCount(v)} />
                {/* Wider, and the label is allowed two lines: Pashto module
                    names are far longer than the English ones and were being
                    clipped into the plot area. */}
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  tick={{ fontSize: 10 }}
                  stroke="#6b7280"
                  interval={0}
                />
                <Tooltip
                  cursor={{ fillOpacity: 0.08 }}
                  content={<ModuleTooltip total={revenueByModuleTotal} period={periodLabel} money={formatMoney} />}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {revenueByModule.map((row) => (
                    <Cell key={row.key} fill={row.fill} />
                  ))}
                  {/* The figure on the bar itself: reading a value off an axis
                      is guesswork, and this is money. */}
                  <LabelList
                    dataKey="value"
                    position="right"
                    formatter={(v: any) => formatMoney(Number(v) || 0)}
                    style={{ fontSize: 10, fill: 'currentColor' }}
                    className="text-gray-700 dark:text-gray-300"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* The same figures as a share of the total, because "which desk
              earns most" is a different question from "how much". */}
          <div className="min-h-[260px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={revenueByModule.filter((row) => row.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={92}
                  paddingAngle={2}
                >
                  {revenueByModule.filter((row) => row.value > 0).map((row) => (
                    <Cell key={row.key} fill={row.fill} />
                  ))}
                </Pie>
                <Tooltip
                  content={<ModuleTooltip total={revenueByModuleTotal} period={periodLabel} money={formatMoney} />}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Legend as a compact table: swatch, name and share kept together so
            the eye does not have to travel across the row to pair them. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700">
          {revenueByModule.map((row) => {
            const share = revenueByModuleTotal > 0 ? (row.value / revenueByModuleTotal) * 100 : 0;
            return (
              <div
                key={row.key}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 dark:bg-gray-900/40 min-w-0"
                title={`${row.name}: ${formatMoney(row.value)}`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.fill }} />
                <span className="text-[11px] text-gray-600 dark:text-gray-400 truncate flex-1 min-w-0">{row.name}</span>
                <span className="text-[11px] font-semibold text-gray-900 dark:text-white tabular-nums shrink-0">
                  {share >= 0.5 ? Math.round(share) + '%' : share > 0 ? '<1%' : '0%'}
                </span>
              </div>
            );
          })}
        </div>
      </section>
      )}

      {/* Two trends side by side: the shape of the selected day on the left,
          the last six months on the right. One answers "when are we busy",
          the other "are we growing" -- and neither used to be visible. */}
      {/* Activity through the day, full width.
          Was a half-width stack of four flat bars in different colours, which
          said very little at a glance. Now: gradient areas so overlap reads as
          depth, the busiest hour called out in the header, and a legend that
          carries each series' total for the period. Series are the permitted
          ones only -- a role with no prescription rights gets no prescription
          band, rather than a hidden tile and a visible line. */}
      {showPanel('chart_hourly') && trendSeries.length > 0 && (
      <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('ui.hourlyTrend', 'Trend by Hour')}
          </h3>
          <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30">
            {periodLabel}
          </span>
          {busiestHour && (
            <span className="ms-auto text-[11px] text-gray-600 dark:text-gray-400">
              {t('ui.busiestHour', 'Busiest hour')}:{' '}
              <span className="font-semibold text-gray-900 dark:text-white">{busiestHour.hour}</span>
              {' '}({formatCount(busiestHour.total)})
            </span>
          )}
        </div>

        <div dir="ltr">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={hourlyData} margin={{ left: 0, right: 8, top: 4 }}>
            <defs>
              {trendSeries.map((series) => (
                <linearGradient key={series.key} id={`grad-${series.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={series.colour} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={series.colour} stopOpacity={0.04} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} vertical={false} />
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="#6b7280" interval={1} />
            <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" allowDecimals={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(value: any, name: any) => [formatCount(Number(value) || 0), name]}
            />
            {trendSeries.map((series) => (
              <Area
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.name}
                stroke={series.colour}
                strokeWidth={2}
                fill={`url(#grad-${series.key})`}
                stackId="1"
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-1.5 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          {trendSeries.map((series) => (
            <div key={series.key} className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: series.colour }} />
              <span className="text-[11px] text-gray-600 dark:text-gray-400 truncate">{series.name}</span>
              <span className="ms-auto text-[11px] font-semibold text-gray-900 dark:text-white tabular-nums">
                {formatCount(seriesTotals[series.key] ?? 0)}
              </span>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* Monthly trends as small multiples.
          One stacked column per month put nine modules in a single bar, so a
          quiet module was a sliver you could not see and the tooltip was the
          only way to read anything. Each module now gets its own narrow chart
          with its own scale, which is what makes a module's own shape legible
          -- 8 ultrasounds a month is a visible line here, and was a hairline
          before. The trade-off is that bars are no longer comparable ACROSS
          modules, which the totals beside each title restore. */}
      {showPanel('chart_monthly') && trendSeries.length > 0 && (
      <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('ui.monthlyTrends', 'Monthly Trends')}
          </h3>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {t('ui.lastSixMonths', 'Last 6 months')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {trendSeries.map((series) => (
            <MiniTrend
              key={series.key}
              name={series.name}
              colour={series.colour}
              data={monthlyData}
              seriesKey={series.key}
              formatCount={formatCount}
              t={t}
            />
          ))}
        </div>
      </section>
      )}


      {/* The three status donuts. These existed only inside the per-role
          dashboards that have now been removed, which is why their permissions
          appeared to do nothing -- there was no panel for them to reveal. */}
      {statusCharts.length > 0 && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {statusCharts.map((chart) => (
          <StatusDonut
            key={chart.key}
            title={chart.title}
            badge={chart.badge}
            icon={chart.icon}
            data={chart.data}
            formatCount={formatCount}
            emptyLabel={t('ui.noDataForPeriod', 'Nothing recorded in this period')}
            unitLabel={chart.unitLabel}
            formatMoney={(chart as any).money ? formatMoney : undefined}
          />
        ))}
      </div>
      )}


      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* Who is at their desk right now, beside the hospital's status. */}
        <ActiveUsersPanel hospitalId={role === 'super_admin' ? hospital?.id : undefined} />

        {/* The hospital's own particulars, with the licence made prominent.
            A licence lapsing is the one thing on this page that stops the
            clinic trading, so it is called out rather than buried. */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <Building2 className="w-4 h-4 text-purple-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t('ui.hospitalStatus', 'Hospital Status')}
            </h3>
          </div>
          <div className="space-y-2.5">
            {hospitalsData.map((h) => (
              <HospitalCard key={h.id} hospital={h} t={t} />
            ))}
          </div>
        </div>
      </div>

      {/* Activity Table */}
      <RecentActivity recent={recentData} showPanel={showPanel} />
    </div>
  );

  // Admin Dashboard

  const dashboardTitle = ({
    super_admin: t('ui.superAdminDashboard', 'Super Admin Dashboard'),
    admin: t('ui.adminDashboard', 'Admin Dashboard'),
    doctor: t('ui.doctorDashboard', 'Doctor Dashboard'),
    receptionist: t('ui.receptionDashboard', 'Reception Dashboard'),
    pharmacist: t('ui.pharmacyDashboard', 'Pharmacy Dashboard'),
    lab_technician: t('ui.laboratoryDashboard', 'Laboratory Dashboard'),
  } as Record<string, string>)[role] ?? t('nav.dashboard', 'Dashboard');

  // Render based on role
  // One body, every role. The switch that used to pick between six copies
  // is gone: what a user sees is decided by their permissions, not by a
  // hard-coded layout for their role name.
  const roleDashboard = <UnifiedDashboard />;

  // Wrapped once here so the vendor/support footer appears for every role
  // without touching each dashboard body.
  return (
    <>
      {roleDashboard}
      <AppFooter />
    </>
  );
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  trend?: { value: string; isPositive: boolean };
}

/**
 * The hover card for the income charts.
 *
 * Both the bar and the donut use it, so the same hover tells the same story in
 * both: which desk, how much, what share of the period's income, and -- the
 * part a bare recharts tooltip never says -- which period that is.
 */
function ModuleTooltip({
  active,
  payload,
  total,
  period,
  money,
}: {
  active?: boolean;
  payload?: any[];
  total: number;
  period: string;
  money: (n: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload[0]?.payload ?? {};
  const value = Number(payload[0]?.value ?? 0);
  const share = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/95 px-3 py-2 shadow-xl min-w-[168px]">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: row.fill ?? payload[0]?.color }}
        />
        <span className="text-xs font-semibold text-white">{row.name ?? payload[0]?.name}</span>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[11px] text-gray-400">Amount</span>
        <span className="text-xs font-bold text-white tabular-nums">{money(value)}</span>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[11px] text-gray-400">Share</span>
        <span className="text-xs font-semibold text-emerald-400 tabular-nums">
          {share >= 0.5 ? share.toFixed(1) : share > 0 ? '<0.1' : '0'}%
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[11px] text-gray-400">Of total</span>
        <span className="text-[11px] text-gray-300 tabular-nums">{money(total)}</span>
      </div>
      <div className="mt-1.5 pt-1.5 border-t border-gray-700 text-[11px] text-blue-300">{period}</div>
    </div>
  );
}

function StatCard({ label, value, icon, color, trend }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:shadow-lg dark:hover:shadow-gray-900/30 transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-tight">{label}</p>
          {/* Was text-xl. These are counts sitting beside money panels, and at
              that size a "0" shouted louder than the revenue figures. */}
          <p className="text-base font-semibold text-gray-900 dark:text-white mt-0.5 tabular-nums">{value}</p>
        </div>
        <div className={`${color} p-2 rounded-lg text-white`}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className={`flex items-center gap-1 mt-2 text-xs ${
          trend.isPositive 
            ? 'text-green-600 dark:text-green-400' 
            : 'text-red-600 dark:text-red-400'
        }`}>
          {trend.isPositive ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : (
            <ArrowDownRight className="w-3 h-3" />
          )}
          <span>{trend.value} from last month</span>
        </div>
      )}
    </div>
  );
}

/**
 * One module's own six-month shape.
 *
 * Deliberately small and deliberately self-scaled: the point of a small
 * multiple is that each module is legible on its own terms. The header carries
 * the six-month total and the change from the previous month, so the reader
 * gets the direction without having to interpret the bars.
 */
function MiniTrend({
  name,
  colour,
  data,
  seriesKey,
  formatCount,
  t,
}: {
  name: string;
  colour: string;
  data: any[];
  seriesKey: string;
  formatCount: (value: number | string) => string;
  t: (key: string, fallback?: string) => string;
}) {
  const values = data.map((row) => Number(row?.[seriesKey]) || 0);
  const total = values.reduce((sum, v) => sum + v, 0);

  const latest = values[values.length - 1] ?? 0;
  const previous = values[values.length - 2] ?? 0;

  // Percentage change is meaningless from a base of zero, so it is only shown
  // when there is something to compare against.
  const change = previous > 0 ? Math.round(((latest - previous) / previous) * 100) : null;
  const rising = change !== null && change > 0;
  const falling = change !== null && change < 0;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2.5">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colour }} />
        <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300 truncate">{name}</span>
      </div>

      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-base font-bold text-gray-900 dark:text-white tabular-nums leading-none">
          {formatCount(total)}
        </span>
        {change !== null && (
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
              rising
                ? 'text-emerald-600 dark:text-emerald-400'
                : falling
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-400'
            }`}
          >
            {rising ? <ArrowUpRight className="w-3 h-3" /> : falling ? <ArrowDownRight className="w-3 h-3" /> : null}
            {Math.abs(change)}%
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 py-4 text-center">
          {t('ui.noRecords', 'Nothing yet')}
        </p>
      ) : (
        <div dir="ltr">
          <ResponsiveContainer width="100%" height={56}>
            <BarChart data={data} barCategoryGap="20%" margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 9 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fillOpacity: 0.08 }}
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 6, fontSize: 11 }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(value: any) => [formatCount(Number(value) || 0), name]}
              />
              <Bar dataKey={seriesKey} fill={colour} radius={[2, 2, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/**
 * A status breakdown as a donut with the total in the middle.
 *
 * Used for appointments, lab tests and medicine stock. The legend carries the
 * count and share for each band, because on a small donut the slices alone are
 * not readable -- and a printed dashboard has no tooltips at all.
 */
function StatusDonut({
  title,
  badge,
  icon,
  data,
  formatCount,
  emptyLabel,
  unitLabel,
  formatMoney,
}: {
  title: string;
  badge?: string;
  icon: React.ReactNode;
  data: Array<{ name: string; value: number; color: string; units?: number; amount?: number }>;
  formatCount: (value: number | string) => string;
  emptyLabel: string;
  unitLabel?: string;
  /** Supplied only for money charts; the legend then leads with the amount. */
  formatMoney?: (value: number) => string;
}) {
  const rows = data.filter((row) => Number(row.value) > 0);
  const total = rows.reduce((sum, row) => sum + Number(row.value || 0), 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white">{title}</h3>
        {badge && (
          <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30">
            {badge}
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 py-8 text-center">{emptyLabel}</p>
      ) : (
        <>
          <div dir="ltr" className="relative">
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={rows} dataKey="value" nameKey="name" innerRadius={44} outerRadius={66} paddingAngle={2}>
                  {rows.map((row) => (
                    <Cell key={row.name} fill={row.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#f9fafb' }}
                  formatter={(value: any, name: any) => [formatCount(Number(value) || 0), name]}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* The total sits in the hole rather than in a caption, so the
                chart answers "how many altogether" without a second glance. */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-bold text-gray-900 dark:text-white tabular-nums leading-none">
                {formatCount(total)}
              </span>
              {unitLabel && (
                <span className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5 max-w-[80px] truncate text-center">
                  {unitLabel}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1 mt-1">
            {rows.map((row) => (
              <div key={row.name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                <span className="text-[11px] text-gray-600 dark:text-gray-400 truncate">{row.name}</span>
                <span className="ms-auto text-[11px] font-semibold text-gray-900 dark:text-white tabular-nums">
                  {formatCount(row.value)}
                  {typeof row.units === 'number' && row.units > 0 && (
                    <span className="font-normal text-gray-500 dark:text-gray-400">
                      {' '}/ {formatCount(row.units)} pcs
                    </span>
                  )}
                  {/* On a money chart the count alone is not the point: 40
                      unpaid receipts could be 300 or 300,000. */}
                  {formatMoney && typeof row.amount === 'number' && (
                    <span className="font-normal text-gray-500 dark:text-gray-400">
                      {' '}/ {formatMoney(row.amount)}
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 w-9 text-right tabular-nums">
                  {Math.round((Number(row.value) / total) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * One hospital's particulars.
 *
 * The licence expiry is the point of the card: it turns amber a month out and
 * red once it has passed, because a lapsed licence is the one condition here
 * that stops the clinic trading and it used not to appear on this screen at
 * all.
 */
function HospitalCard({
  hospital,
  t,
}: {
  hospital: {
    id: number | string;
    name: string;
    code?: string;
    status?: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    license?: string | null;
    license_issue_date?: string | null;
    license_expiry_date?: string | null;
    subscription_status?: string | null;
  };
  t: (key: string, fallback?: string) => string;
}) {
  const expiry = hospital.license_expiry_date ? new Date(hospital.license_expiry_date) : null;
  const validExpiry = expiry && !Number.isNaN(expiry.getTime()) ? expiry : null;

  // Whole days, floored, so "today" reads as 0 rather than a fraction.
  const daysLeft = validExpiry
    ? Math.floor((validExpiry.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
    : null;

  const expired = daysLeft !== null && daysLeft < 0;
  const expiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;

  const expiryTone = expired
    ? 'text-red-600 dark:text-red-400 font-semibold'
    : expiringSoon
      ? 'text-amber-600 dark:text-amber-400 font-semibold'
      : 'text-gray-900 dark:text-white';

  const Field = ({ label, value, tone }: { label: string; value?: string | null; tone?: string }) => (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</p>
      <p className={`text-[11px] truncate ${tone || 'text-gray-700 dark:text-gray-300'}`} dir="auto">
        {value || '—'}
      </p>
    </div>
  );

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/40">
        <div className="w-7 h-7 rounded-md bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
          <Building2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{hospital.name}</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            {t('ui.code', 'Code')}: {hospital.code || '—'}
          </p>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
            hospital.status === 'active'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
          }`}
        >
          {hospital.status || '—'}
        </span>
      </div>

      <div className="px-3 py-2 grid grid-cols-2 gap-x-3 gap-y-2">
        <Field label={t('ui.phone', 'Phone')} value={hospital.phone} />
        <Field label={t('ui.email', 'Email')} value={hospital.email} />
        <div className="col-span-2">
          <Field label={t('ui.address', 'Address')} value={hospital.address} />
        </div>
        <Field label={t('ui.license', 'Licence')} value={hospital.license} />
        <Field
          label={t('ui.subscription', 'Subscription')}
          value={hospital.subscription_status}
          tone={
            hospital.subscription_status && hospital.subscription_status !== 'active'
              ? 'text-red-600 dark:text-red-400 font-semibold'
              : undefined
          }
        />
        <Field label={t('ui.licenseIssued', 'Licence Issued')} value={hospital.license_issue_date} />
        <Field
          label={t('ui.licenseExpiry', 'Licence Expiry')}
          value={hospital.license_expiry_date}
          tone={expiryTone}
        />
      </div>

      {(expired || expiringSoon) && (
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium ${
            expired
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {expired
            ? `${t('ui.licenseExpired', 'Licence expired')} (${Math.abs(daysLeft as number)}d)`
            : `${t('ui.licenseExpiringIn', 'Licence expires in')} ${daysLeft}d`}
        </div>
      )}
    </div>
  );
}

// Recent Activity Component
interface RecentActivityProps {
  recent: DashboardSummary['recent'];
  /** Panel gate from the parent; these lists carry patient-identifying data. */
  showPanel: (panel: DashboardPanel, ...fallbacks: string[]) => boolean;
}

/**
 * The three recent-activity lists, side by side.
 *
 * This used to be an if/else on the user's role that returned exactly ONE
 * list, so an admin saw Recent Patients and nothing else however many
 * permissions they held. Each list is now rendered on its own permission, and
 * the row collapses to whatever the user is allowed -- one, two or three.
 */
function RecentActivity({ recent, showPanel }: RecentActivityProps) {
  const { t } = useTranslation();

  const canPatients = showPanel('recent_patients', 'view_patients', 'manage_patients');
  const canPrescriptions = showPanel('recent_prescriptions', 'view_prescriptions', 'manage_prescriptions');
  const canLabOrders = showPanel('recent_lab_orders', 'view_lab_orders', 'manage_lab_orders');

  if (!canPatients && !canPrescriptions && !canLabOrders) return null;

  const statusTone = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    if (s === 'in_progress' || s === 'processing') return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
    if (s === 'cancelled') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
    return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
  };

  /* One row shape for all three lists: an icon, two lines of identity, and a
     compact figure on the right. Denser than the old cards -- five rows now
     fit in the height two used to take. */
  const Row = ({
    icon,
    tone,
    primary,
    secondary,
    trailing,
  }: {
    icon: React.ReactNode;
    tone: string;
    primary: string;
    secondary: string;
    trailing?: React.ReactNode;
  }) => (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-100 dark:border-gray-700/60 last:border-0">
      <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${tone}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-gray-900 dark:text-white truncate leading-tight">{primary}</p>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate leading-tight">{secondary}</p>
      </div>
      {trailing && <div className="shrink-0 text-right">{trailing}</div>}
    </div>
  );

  const Card = ({ title, count, children }: { title: string; count: number; children: React.ReactNode }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xs font-semibold text-gray-900 dark:text-white">{title}</h2>
        <span className="text-[10px] text-gray-500 dark:text-gray-400">{count}</span>
      </div>
      {count === 0 ? (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 py-6 text-center">
          {t('ui.noRecords', 'Nothing yet')}
        </p>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {canPatients && (
        <Card title={t('ui.recentPatients', 'Recent Patients')} count={recent.patients.length}>
          {recent.patients.slice(0, 5).map((patient) => (
            <Row
              key={patient.id}
              tone="bg-blue-100 dark:bg-blue-900/30"
              icon={<Users className="w-3 h-3 text-blue-600 dark:text-blue-400" />}
              primary={patient.name}
              secondary={patient.patient_id || '—'}
              trailing={
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {patient.age ?? '—'} / {patient.gender ?? '—'}
                </span>
              }
            />
          ))}
        </Card>
      )}

      {canPrescriptions && (
        <Card title={t('ui.recentPrescriptions', 'Recent Prescriptions')} count={recent.prescriptions.length}>
          {recent.prescriptions.slice(0, 5).map((prescription) => (
            <Row
              key={prescription.id}
              tone="bg-green-100 dark:bg-green-900/30"
              icon={<FileText className="w-3 h-3 text-green-600 dark:text-green-400" />}
              primary={prescription.patient_name || '—'}
              secondary={prescription.prescription_number || '—'}
              trailing={
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {prescription.items_count ?? 0} items
                </span>
              }
            />
          ))}
        </Card>
      )}

      {canLabOrders && (
        <Card title={t('ui.recentLabOrders', 'Recent Lab Tests')} count={recent.lab_orders.length}>
          {recent.lab_orders.slice(0, 5).map((order) => (
            <Row
              key={order.id}
              tone="bg-indigo-100 dark:bg-indigo-900/30"
              icon={<TestTube className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
              primary={order.patient_name || '—'}
              secondary={order.order_number || '—'}
              trailing={
                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium ${statusTone(order.status || '')}`}>
                  {(order.status || 'pending').replace('_', ' ')}
                </span>
              }
            />
          ))}
        </Card>
      )}
    </div>
  );
}