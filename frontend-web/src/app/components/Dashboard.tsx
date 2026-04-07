import React, { useState, useEffect, useMemo } from 'react';
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
  Bed
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
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface DashboardProps {
  role: UserRole;
  hospital: Hospital | null;
}

interface DashboardSummary {
  hospital_id: number | null;
  hospitals: Array<{ id: number | string; name: string; code?: string; status?: string }>;
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
    appointments_today: number;
    room_bookings_today: number;
    patient_surgeries_today: number;
  };
  charts: {
    monthly: Array<{ month: string; patients: number; prescriptions: number; appointments: number; room_bookings: number; patient_surgeries: number }>;
    appointment_status: Array<{ name: string; value: number; color: string }>;
    test_status: Array<{ name: string; value: number; color: string }>;
    medicine_stock: Array<{ name: string; value: number; color: string }>;
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
    total_sales_invoice_amount: number;
    total_income: number;
    total_expenses: number;
    total_revenue?: number;
  };
}

export function Dashboard({ role, hospital }: DashboardProps) {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'last_7_days' | 'this_month' | 'last_month' | 'this_year'>('today');

  useEffect(() => {
    if (!hospital) return;

    const loadSummary = async () => {
      try {
        const params = {
          date_filter: dateFilter,
          ...(role === 'super_admin' ? { hospital_id: hospital.id } : {}),
        };
        const { data } = await api.get('/dashboard/summary', { params });
        setSummary(data);
      } catch (error) {
        setSummary(null);
      }
    };

    loadSummary();
  }, [hospital?.id, role, dateFilter]);

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
    appointments_today: 0,
    room_bookings_today: 0,
    patient_surgeries_today: 0,
  };

  const monthlyData = summary?.charts.monthly ?? [];
  const testStatusData = summary?.charts.test_status ?? [];
  const medicineStockData = summary?.charts.medicine_stock ?? [];
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
    total_sales_invoice_amount: 0,
    total_income: 0,
    total_expenses: 0,
    total_revenue: 0,
  };
  const netIncome = dailyFinancials.total_income - dailyFinancials.total_expenses;

  const formatMoney = (amount: number) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: dailyFinancials.currency || 'AFN',
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${(dailyFinancials.currency || 'AFN').toUpperCase()} ${amount.toFixed(2)}`;
    }
  };

  const canViewAny = (...permissions: string[]) => permissions.some((permission) => hasPermission(permission));

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
      || canViewRoomBookings;

    return [
      {
        key: 'available_stock',
        label: 'Available Stock (Medicine)',
        value: formatMoney(dailyFinancials.total_stock_cost_amount ?? 0),
        helper: 'Current stock value at cost price',
        icon: <Pill className="w-4 h-4" />,
        color: 'bg-pink-500',
        visible: canViewMedicines,
      },
      {
        key: 'medicine_sale',
        label: 'Medicine Sale',
        value: formatMoney(dailyFinancials.total_sales_invoice_amount),
        helper: 'Total medicine invoices for selected period',
        icon: <Package className="w-4 h-4" />,
        color: 'bg-blue-500',
        visible: canViewTransactions,
      },
      {
        key: 'appointment_fees',
        label: 'Appointments Fees',
        value: formatMoney(dailyFinancials.total_fees),
        helper: 'All doctor appointments for selected period',
        icon: <Calendar className="w-4 h-4" />,
        color: 'bg-teal-500',
        visible: canViewAppointments,
      },
      {
        key: 'lab_orders_amount',
        label: 'Test Lab Orders Amount',
        value: formatMoney(dailyFinancials.total_lab_fees),
        helper: 'Lab order amount for selected period',
        icon: <TestTube className="w-4 h-4" />,
        color: 'bg-indigo-500',
        visible: canViewLabOrders,
      },
      {
        key: 'surgery_fees',
        label: 'Surgery Fees',
        value: formatMoney(dailyFinancials.total_surgery_fees ?? 0),
        helper: 'Total surgery fees for selected period',
        icon: <HeartPulse className="w-4 h-4" />,
        color: 'bg-orange-500',
        visible: canViewSurgeries,
      },
      {
        key: 'room_booking_fees',
        label: 'Room Booking Fees',
        value: formatMoney(dailyFinancials.total_room_fees ?? 0),
        helper: 'Total room booking fees for selected period',
        icon: <Bed className="w-4 h-4" />,
        color: 'bg-cyan-500',
        visible: canViewRoomBookings,
      },
      {
        key: 'expenses',
        label: 'Expenses',
        value: formatMoney(dailyFinancials.total_expenses),
        helper: 'Total expenses for selected period',
        icon: <TrendingDown className="w-4 h-4" />,
        color: 'bg-rose-500',
        visible: canViewExpenses,
      },
      {
        key: 'revenue_total',
        label: 'Revenue Total',
        value: formatMoney(dailyFinancials.total_revenue ?? netIncome),
        helper: 'Total income minus expenses',
        icon: <TrendingUp className="w-4 h-4" />,
        color: 'bg-emerald-500',
        visible: canViewRevenue,
      },
    ];
  }, [
    dailyFinancials.total_revenue,
    dailyFinancials.total_stock_cost_amount,
    dailyFinancials.total_expenses,
    dailyFinancials.total_fees,
    dailyFinancials.total_income,
    dailyFinancials.total_lab_fees,
    dailyFinancials.total_surgery_fees,
    dailyFinancials.total_room_fees,
    dailyFinancials.total_sales_invoice_amount,
    formatMoney,
    hasPermission,
    netIncome,
  ]);

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

  const printReceptionFinancialReport = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    const hospitalName = hospital?.name || 'Hospital';
    const reportDate = dailyFinancials.report_date || new Date().toISOString().slice(0, 10);

    printWindow.document.write(`
      <html>
        <head>
          <title>Reception Financial Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin: 0 0 6px 0; font-size: 20px; }
            p { margin: 2px 0; color: #374151; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 13px; }
            th { background: #f3f4f6; font-weight: 700; }
            .num { text-align: right; font-variant-numeric: tabular-nums; }
            .total { font-weight: 700; background: #f9fafb; }
            .footer { margin-top: 16px; font-size: 11px; color: #6b7280; }
          </style>
        </head>
        <body>
          <h1>Daily Reception Financial Report</h1>
          <p>Hospital: ${hospitalName}</p>
          <p>Report Date: ${reportDate}</p>
          <table>
            <thead>
              <tr><th>Metric</th><th class="num">Amount</th></tr>
            </thead>
            <tbody>
              <tr><td>Total Fees</td><td class="num">${formatMoney(dailyFinancials.total_fees)}</td></tr>
              <tr><td>Total Lab Fees</td><td class="num">${formatMoney(dailyFinancials.total_lab_fees)}</td></tr>
              <tr><td>Total Sales Invoice Amount</td><td class="num">${formatMoney(dailyFinancials.total_sales_invoice_amount)}</td></tr>
              <tr><td>Total Income</td><td class="num">${formatMoney(dailyFinancials.total_income)}</td></tr>
              <tr><td>Total Expenses</td><td class="num">${formatMoney(dailyFinancials.total_expenses)}</td></tr>
              <tr class="total"><td>Net Income</td><td class="num">${formatMoney(netIncome)}</td></tr>
            </tbody>
          </table>
          <div class="footer">Generated from ShifaaScript dashboard</div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const RbacDashboardMetrics = () => {
    if (visibleRbacMetrics.length === 0) {
      return null;
    }

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Main Dashboard (RBAC)</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Default today data is shown. Totals remain unchanged.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
              className="text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-md px-2 py-1.5"
              title="Main dashboard date filter"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_year">This Year</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {visibleRbacMetrics.map((metric) => (
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
  };

  // Super Admin Dashboard
  const SuperAdminDashboard = () => (
    <div className="space-y-3">
      {/* Hospital Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Super Admin Dashboard</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Viewing {hospital?.name || 'Hospital'} analytics</p>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Building2 className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          <span className="text-xs text-gray-600 dark:text-gray-400">Selected in header</span>
        </div>
      </div>

      <RbacDashboardMetrics />

      {/* Stats Cards Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {canViewAny('view_hospitals', 'manage_hospitals') && (
          <StatCard
            label="Total Hospitals"
            value={counts.hospitals.toString()}
            icon={<Building2 className="w-4 h-4" />}
            color="bg-purple-500"
            trend={{ value: '2', isPositive: true }}
          />
        )}
        {canViewAny('view_doctors', 'manage_doctors') && (
          <StatCard
            label="Total Doctors"
            value={counts.doctors.toString()}
            icon={<Stethoscope className="w-4 h-4" />}
            color="bg-blue-500"
            trend={{ value: '5', isPositive: true }}
          />
        )}
        {canViewAny('view_patients', 'manage_patients') && (
          <StatCard
            label="Total Patients"
            value={counts.patients.toString()}
            icon={<Users className="w-4 h-4" />}
            color="bg-green-500"
            trend={{ value: '12', isPositive: true }}
          />
        )}
        {canViewAny('view_prescriptions', 'manage_prescriptions') && (
          <StatCard
            label="Total Prescriptions"
            value={counts.prescriptions.toString()}
            icon={<FileText className="w-4 h-4" />}
            color="bg-orange-500"
            trend={{ value: '8', isPositive: true }}
          />
        )}
      </div>

      {/* Stats Cards Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {canViewAny('view_medicines', 'manage_medicines', 'view_stocks', 'manage_stocks') && (
          <StatCard
            label="Total Medicines"
            value={counts.medicines.toString()}
            icon={<Pill className="w-4 h-4" />}
            color="bg-pink-500"
            trend={{ value: '10', isPositive: true }}
          />
        )}
        {canViewAny('view_test_templates', 'manage_test_templates') && (
          <StatCard
            label="Test Templates"
            value={counts.test_templates.toString()}
            icon={<TestTube className="w-4 h-4" />}
            color="bg-indigo-500"
            trend={{ value: '3', isPositive: true }}
          />
        )}
        {canViewAny('view_lab_orders', 'manage_lab_orders') && (
          <StatCard
            label="Lab Tests (Today)"
            value={counts.lab_orders_today.toString()}
            icon={<Activity className="w-4 h-4" />}
            color="bg-cyan-500"
            trend={{ value: '6', isPositive: true }}
          />
        )}
        {canViewAny('view_appointments', 'manage_appointments') && (
          <StatCard
            label="Appointments"
            value={counts.appointments_today.toString()}
            icon={<Calendar className="w-4 h-4" />}
            color="bg-teal-500"
            trend={{ value: '15', isPositive: true }}
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {canViewAny('view_rooms', 'manage_rooms') && (
          <StatCard
            label="Total Rooms"
            value={counts.rooms.toString()}
            icon={<Building2 className="w-4 h-4" />}
            color="bg-sky-500"
            trend={{ value: '4', isPositive: true }}
          />
        )}
        {canViewAny('view_rooms', 'manage_rooms') && (
          <StatCard
            label="Active Rooms"
            value={counts.active_rooms.toString()}
            icon={<CheckCircle className="w-4 h-4" />}
            color="bg-emerald-500"
            trend={{ value: '3', isPositive: true }}
          />
        )}
        {canViewAny('view_surgeries', 'manage_surgeries', 'view_patient_surgeries', 'manage_patient_surgeries') && (
          <StatCard
            label="Surgeries"
            value={counts.surgeries.toString()}
            icon={<Activity className="w-4 h-4" />}
            color="bg-rose-500"
            trend={{ value: '5', isPositive: true }}
          />
        )}
        {canViewAny('view_room_bookings', 'manage_room_bookings') && (
          <StatCard
            label="Room Bookings (Today)"
            value={counts.room_bookings_today.toString()}
            icon={<Package className="w-4 h-4" />}
            color="bg-indigo-500"
            trend={{ value: '2', isPositive: true }}
          />
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Monthly Trends */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">Monthly Trends</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#6b7280" />
              <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: 'none', 
                  borderRadius: '8px',
                  fontSize: '11px'
                }} 
              />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Line type="monotone" dataKey="patients" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="prescriptions" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Hospital Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">Hospital Status</h3>
          <div className="space-y-2">
            {hospitalsData.map(h => (
              <div key={h.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                  <Building2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                  <div className="truncate">
                    <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{h.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{h.code}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs shrink-0 ${
                  h.status === 'active'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                }`}>
                  {h.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Table */}
      <RecentActivity recent={recentData} role={role} />
    </div>
  );

  // Admin Dashboard
  const AdminDashboard = () => (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Admin Dashboard</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{hospital.name} - Overview</p>
      </div>

      <RbacDashboardMetrics />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {canViewAny('view_doctors', 'manage_doctors') && (
          <StatCard
            label="Total Doctors"
            value={counts.doctors.toString()}
            icon={<Stethoscope className="w-4 h-4" />}
            color="bg-blue-500"
            trend={{ value: '2', isPositive: true }}
          />
        )}
        {canViewAny('view_patients', 'manage_patients') && (
          <StatCard
            label="Total Patients"
            value={counts.patients.toString()}
            icon={<Users className="w-4 h-4" />}
            color="bg-green-500"
            trend={{ value: '15', isPositive: true }}
          />
        )}
        {canViewAny('view_prescriptions', 'manage_prescriptions') && (
          <StatCard
            label="Prescriptions"
            value={counts.prescriptions.toString()}
            icon={<FileText className="w-4 h-4" />}
            color="bg-orange-500"
            trend={{ value: '8', isPositive: true }}
          />
        )}
        {canViewAny('view_medicines', 'manage_medicines', 'view_stocks', 'manage_stocks') && (
          <StatCard
            label="Medicines"
            value={counts.medicines.toString()}
            icon={<Pill className="w-4 h-4" />}
            color="bg-purple-500"
            trend={{ value: '3', isPositive: false }}
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {canViewAny('view_rooms', 'manage_rooms') && (
          <StatCard
            label="Total Rooms"
            value={counts.rooms.toString()}
            icon={<Building2 className="w-4 h-4" />}
            color="bg-sky-500"
            trend={{ value: '2', isPositive: true }}
          />
        )}
        {canViewAny('view_surgeries', 'manage_surgeries', 'view_patient_surgeries', 'manage_patient_surgeries') && (
          <StatCard
            label="Surgeries"
            value={counts.surgeries.toString()}
            icon={<Activity className="w-4 h-4" />}
            color="bg-rose-500"
            trend={{ value: '2', isPositive: true }}
          />
        )}
        {canViewAny('view_room_bookings', 'manage_room_bookings') && (
          <StatCard
            label="Room Bookings Today"
            value={counts.room_bookings_today.toString()}
            icon={<Package className="w-4 h-4" />}
            color="bg-indigo-500"
            trend={{ value: '1', isPositive: true }}
          />
        )}
        {canViewAny('view_patient_surgeries', 'manage_patient_surgeries') && (
          <StatCard
            label="Surgeries Today"
            value={counts.patient_surgeries_today.toString()}
            icon={<Calendar className="w-4 h-4" />}
            color="bg-teal-500"
            trend={{ value: '1', isPositive: true }}
          />
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">Monthly Activity</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%" debounce={200}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#6b7280" />
                <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: 'none', 
                    borderRadius: '8px',
                    fontSize: '11px'
                  }} 
                />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="patients" fill="#3b82f6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="appointments" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">Appointment Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={appointmentStatusData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {appointmentStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: 'none', 
                  borderRadius: '8px',
                  fontSize: '11px'
                }} 
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {appointmentStatusData.map((item, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${getLegendDotClass(item.color)}`}></div>
                <span className="text-xs text-gray-600 dark:text-gray-400">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <RecentActivity recent={recentData} role={role} />
    </div>
  );

  const doctorQuickActions = useMemo(() => {
    const actions = [
      {
        key: 'create_prescription',
        label: 'Create New Prescription',
        icon: <ClipboardList className="w-3.5 h-3.5" />,
        to: '/prescriptions/create',
        className: 'from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
      },
      {
        key: 'view_appointments',
        label: 'View Appointments',
        icon: <Calendar className="w-3.5 h-3.5" />,
        to: '/appointments',
        className: 'from-green-600 to-green-700 hover:from-green-700 hover:to-green-800'
      },
      {
        key: 'view_lab_orders',
        label: 'Order Lab Tests',
        icon: <TestTube className="w-3.5 h-3.5" />,
        to: '/lab-tests',
        className: 'from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800'
      },
      {
        key: 'view_prescriptions',
        label: 'View Prescriptions',
        icon: <FileText className="w-3.5 h-3.5" />,
        to: '/prescriptions',
        className: 'from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800'
      }
    ];

    return actions.filter((action) => hasPermission(action.key));
  }, [hasPermission]);

  // Doctor Dashboard
  const DoctorDashboard = () => (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Doctor Dashboard</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Your patients and appointments overview</p>
      </div>

      <RbacDashboardMetrics />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {canViewAny('view_patients', 'manage_patients') && (
          <StatCard
            label="Total Patients"
            value={counts.patients.toString()}
            icon={<Users className="w-4 h-4" />}
            color="bg-blue-500"
            trend={{ value: '12', isPositive: true }}
          />
        )}
        {canViewAny('view_appointments', 'manage_appointments') && (
          <StatCard
            label="Appointments Today"
            value={counts.appointments_today.toString()}
            icon={<Calendar className="w-4 h-4" />}
            color="bg-green-500"
            trend={{ value: '3', isPositive: true }}
          />
        )}
        {canViewAny('view_prescriptions', 'manage_prescriptions') && (
          <StatCard
            label="Prescriptions"
            value={counts.prescriptions.toString()}
            icon={<ClipboardList className="w-4 h-4" />}
            color="bg-orange-500"
            trend={{ value: '5', isPositive: true }}
          />
        )}
        {canViewAny('view_lab_orders', 'manage_lab_orders') && (
          <StatCard
            label="Lab Tests Ordered"
            value={counts.lab_orders_today.toString()}
            icon={<TestTube className="w-4 h-4" />}
            color="bg-purple-500"
            trend={{ value: '2', isPositive: true }}
          />
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">Patient Consultations</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#6b7280" />
              <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: 'none', 
                  borderRadius: '8px',
                  fontSize: '11px'
                }} 
              />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Line type="monotone" dataKey="appointments" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">Quick Actions</h3>
          <div className="space-y-2">
            {doctorQuickActions.map((action) => (
              <button
                key={action.key}
                onClick={() => navigate(action.to)}
                className={`w-full p-2.5 bg-gradient-to-r ${action.className} text-white rounded-lg transition-all text-xs font-medium flex items-center justify-center gap-2`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
            {doctorQuickActions.length === 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                No quick actions available for your permissions.
              </div>
            )}
          </div>
        </div>
      </div>

      <RecentActivity recent={recentData} role={role} />
    </div>
  );

  // Receptionist Dashboard
  const ReceptionistDashboard = () => (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Reception Dashboard</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Patient registration and appointments</p>
      </div>

      <RbacDashboardMetrics />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {canViewAny('view_patients', 'manage_patients') && (
          <StatCard
            label="Total Patients"
            value={counts.patients.toString()}
            icon={<Users className="w-4 h-4" />}
            color="bg-blue-500"
            trend={{ value: '15', isPositive: true }}
          />
        )}
        {canViewAny('view_appointments', 'manage_appointments') && (
          <StatCard
            label="Today's Appointments"
            value={counts.appointments_today.toString()}
            icon={<Calendar className="w-4 h-4" />}
            color="bg-green-500"
            trend={{ value: '4', isPositive: true }}
          />
        )}
        {canViewAny('view_appointments', 'manage_appointments') && (
          <StatCard
            label="Scheduled"
            value={scheduledCount.toString()}
            icon={<Clock className="w-4 h-4" />}
            color="bg-orange-500"
            trend={{ value: '8', isPositive: true }}
          />
        )}
        {canViewAny('view_doctors', 'manage_doctors') && (
          <StatCard
            label="Available Doctors"
            value={counts.active_doctors.toString()}
            icon={<Stethoscope className="w-4 h-4" />}
            color="bg-purple-500"
            trend={{ value: '0', isPositive: true }}
          />
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Daily Financial Report</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Reception summary for {dailyFinancials.report_period_start || dailyFinancials.report_date}
              {(dailyFinancials.report_period_end && dailyFinancials.report_period_end !== (dailyFinancials.report_period_start || dailyFinancials.report_date))
                ? ` to ${dailyFinancials.report_period_end}`
                : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={printReceptionFinancialReport}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          <div className="rounded border border-gray-200 dark:border-gray-600 p-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Fees</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatMoney(dailyFinancials.total_fees)}</p>
          </div>
          <div className="rounded border border-gray-200 dark:border-gray-600 p-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Lab Fees</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatMoney(dailyFinancials.total_lab_fees)}</p>
          </div>
          <div className="rounded border border-gray-200 dark:border-gray-600 p-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Sales Invoice Amount</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatMoney(dailyFinancials.total_sales_invoice_amount)}</p>
          </div>
          <div className="rounded border border-gray-200 dark:border-gray-600 p-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Income</p>
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">{formatMoney(dailyFinancials.total_income)}</p>
          </div>
          <div className="rounded border border-gray-200 dark:border-gray-600 p-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Expenses</p>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">{formatMoney(dailyFinancials.total_expenses)}</p>
          </div>
          <div className="rounded border border-gray-200 dark:border-gray-600 p-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">Net Income</p>
            <p className={`text-sm font-semibold ${netIncome >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
              {formatMoney(netIncome)}
            </p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">Weekly Appointments</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#6b7280" />
              <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: 'none', 
                  borderRadius: '8px',
                  fontSize: '11px'
                }} 
              />
              <Bar dataKey="appointments" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">Appointment Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={appointmentStatusData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {appointmentStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: 'none', 
                  borderRadius: '8px',
                  fontSize: '11px'
                }} 
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {appointmentStatusData.map((item, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${getLegendDotClass(item.color)}`}></div>
                <span className="text-xs text-gray-600 dark:text-gray-400">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <RecentActivity recent={recentData} role={role} />
    </div>
  );

  const PharmacistDashboard = () => (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Pharmacy Dashboard</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Medicine inventory and prescriptions</p>
      </div>

      <RbacDashboardMetrics />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {canViewAny('view_medicines', 'manage_medicines', 'view_stocks', 'manage_stocks') && (
          <StatCard
            label="Total Medicines"
            value={counts.medicines.toString()}
            icon={<Pill className="w-4 h-4" />}
            color="bg-green-500"
            trend={{ value: '5', isPositive: true }}
          />
        )}
        {canViewAny('view_prescriptions', 'manage_prescriptions') && (
          <StatCard
            label="Prescriptions"
            value={counts.prescriptions.toString()}
            icon={<FileText className="w-4 h-4" />}
            color="bg-blue-500"
            trend={{ value: '8', isPositive: true }}
          />
        )}
        {canViewAny('view_stocks', 'manage_stocks', 'view_stock_reconciliation', 'manage_stock_reconciliation') && (
          <StatCard
            label="Low Stock Items"
            value={lowStockCount.toString()}
            icon={<AlertCircle className="w-4 h-4" />}
            color="bg-orange-500"
            trend={{ value: '3', isPositive: false }}
          />
        )}
        {canViewAny('view_manufacturers', 'manage_manufacturers') && (
          <StatCard
            label="Manufacturers"
            value={counts.manufacturers.toString()}
            icon={<Package className="w-4 h-4" />}
            color="bg-purple-500"
            trend={{ value: '1', isPositive: true }}
          />
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">Monthly Prescriptions</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#6b7280" />
              <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: 'none', 
                  borderRadius: '8px',
                  fontSize: '11px'
                }} 
              />
              <Line type="monotone" dataKey="prescriptions" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">Stock Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={medicineStockData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {medicineStockData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: 'none', 
                  borderRadius: '8px',
                  fontSize: '11px'
                }} 
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {medicineStockData.map((item, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${getLegendDotClass(item.color)}`}></div>
                <span className="text-xs text-gray-600 dark:text-gray-400">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-900/30 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5" />
          <div>
            <h3 className="text-xs font-semibold text-orange-900 dark:text-orange-300">Low Stock Alert</h3>
            <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">{lowStockCount} medicines are running low on stock. Please reorder soon.</p>
          </div>
        </div>
      </div>

      <RecentActivity recent={recentData} role={role} />
    </div>
  );

  // Lab Technician Dashboard
  const LabTechnicianDashboard = () => (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Laboratory Dashboard</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Lab tests and results management</p>
      </div>

      <RbacDashboardMetrics />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {canViewAny('view_lab_orders', 'manage_lab_orders') && (
          <StatCard
            label="Pending Tests"
            value={pendingLabCount.toString()}
            icon={<Clock className="w-4 h-4" />}
            color="bg-orange-500"
            trend={{ value: '5', isPositive: false }}
          />
        )}
        {canViewAny('view_lab_orders', 'manage_lab_orders') && (
          <StatCard
            label="In Progress"
            value={inProgressLabCount.toString()}
            icon={<Activity className="w-4 h-4" />}
            color="bg-blue-500"
            trend={{ value: '3', isPositive: true }}
          />
        )}
        {canViewAny('view_lab_orders', 'manage_lab_orders') && (
          <StatCard
            label="Completed Today"
            value={completedLabCount.toString()}
            icon={<CheckCircle className="w-4 h-4" />}
            color="bg-green-500"
            trend={{ value: '12', isPositive: true }}
          />
        )}
        {canViewAny('view_test_templates', 'manage_test_templates') && (
          <StatCard
            label="Test Templates"
            value={counts.test_templates.toString()}
            icon={<TestTube className="w-4 h-4" />}
            color="bg-purple-500"
            trend={{ value: '2', isPositive: true }}
          />
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">Test Status Overview</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={testStatusData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {testStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: 'none', 
                  borderRadius: '8px',
                  fontSize: '11px'
                }} 
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {testStatusData.map((item, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${getLegendDotClass(item.color)}`}></div>
                <span className="text-xs text-gray-600 dark:text-gray-400">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">Monthly Test Volume</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#6b7280" />
              <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: 'none', 
                  borderRadius: '8px',
                  fontSize: '11px'
                }} 
              />
              <Bar dataKey="appointments" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pending Tests Alert */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h3 className="text-xs font-semibold text-blue-900 dark:text-blue-300">Pending Tests</h3>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">You have {pendingLabCount} pending tests waiting for processing.</p>
          </div>
        </div>
      </div>

      <RecentActivity recent={recentData} role={role} />
    </div>
  );

  // Render based on role
  switch (role) {
    case 'super_admin':
      return <SuperAdminDashboard />;
    case 'admin':
      return <AdminDashboard />;
    case 'doctor':
      return <DoctorDashboard />;
    case 'receptionist':
      return <ReceptionistDashboard />;
    case 'pharmacist':
      return <PharmacistDashboard />;
    case 'lab_technician':
      return <LabTechnicianDashboard />;
    default:
      return <AdminDashboard />;
  }
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  trend?: { value: string; isPositive: boolean };
}

function StatCard({ label, value, icon, color, trend }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:shadow-lg dark:hover:shadow-gray-900/30 transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400">{label}</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white mt-1">{value}</p>
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

// Recent Activity Component
interface RecentActivityProps {
  recent: DashboardSummary['recent'];
  role: UserRole;
}

function RecentActivity({ recent, role }: RecentActivityProps) {
  if (role === 'pharmacist') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <h2 className="text-xs font-semibold text-gray-900 dark:text-white mb-2">Recent Prescriptions</h2>
        <div className="space-y-2">
          {recent.prescriptions.slice(0, 5).map((prescription) => (
            <div key={prescription.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                <div className="w-7 h-7 bg-green-100 dark:bg-green-900/30 rounded-md flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{prescription.patient_name || '—'}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{prescription.prescription_number || '—'}</p>
                </div>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                {prescription.items_count ?? 0} items
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (role === 'lab_technician') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <h2 className="text-xs font-semibold text-gray-900 dark:text-white mb-2">Recent Lab Tests</h2>
        <div className="space-y-2">
          {recent.lab_orders.slice(0, 5).map((order) => {
            const status = (order.status || '').toLowerCase();
            const statusLabel = status ? status.replace('_', ' ') : 'Pending';
            const statusStyles = status === 'completed'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : status === 'in_progress'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : status === 'cancelled'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';

            const Icon = status === 'completed'
              ? CheckCircle
              : status === 'in_progress'
                ? Activity
                : status === 'cancelled'
                  ? XCircle
                  : Clock;

            const iconStyles = status === 'completed'
              ? 'text-green-600 dark:text-green-400'
              : status === 'in_progress'
                ? 'text-blue-600 dark:text-blue-400'
                : status === 'cancelled'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-orange-600 dark:text-orange-400';

            const iconBg = status === 'completed'
              ? 'bg-green-100 dark:bg-green-900/30'
              : status === 'in_progress'
                ? 'bg-blue-100 dark:bg-blue-900/30'
                : status === 'cancelled'
                  ? 'bg-red-100 dark:bg-red-900/30'
                  : 'bg-orange-100 dark:bg-orange-900/30';

            return (
              <div key={order.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                  <div className={`w-7 h-7 ${iconBg} rounded-md flex items-center justify-center shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${iconStyles}`} />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{order.order_number || 'Lab Order'}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">Patient: {order.patient_name || '—'}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs ${statusStyles} shrink-0`}>
                  {statusLabel || 'Pending'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <h2 className="text-xs font-semibold text-gray-900 dark:text-white mb-2">Recent Patients</h2>
      <div className="space-y-2">
        {recent.patients.slice(0, 5).map((patient) => (
          <div key={patient.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
              <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{patient.name}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{patient.patient_id || '—'}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">{patient.age ?? '—'} yrs</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{patient.gender ?? '—'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}