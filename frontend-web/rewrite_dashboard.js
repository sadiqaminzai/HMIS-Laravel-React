const fs = require('fs');

const code = `import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, FileText, Pill, Stethoscope, Building2,
  TrendingUp, TrendingDown, CheckCircle, Clock,
  XCircle, ArrowUpRight, ArrowDownRight, TestTube,
  Activity, Calendar, ClipboardList, AlertCircle,
  Package, Printer, Filter
} from 'lucide-react';
import { UserRole, Hospital } from '../types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../../api/axios';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, BarChart,
  Bar, PieChart, Pie, Cell
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
    patients: Array<any>;
    prescriptions: Array<any>;
    lab_orders: Array<any>;
  };
  financials?: any;
}

export function Dashboard({ role, hospital }: DashboardProps) {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [dateFilter, setDateFilter] = useState('this_month');

  useEffect(() => {
    if (!hospital && role !== 'super_admin') return;

    const loadSummary = async () => {
      try {
        const params = {
          ...(role === 'super_admin' ? { hospital_id: hospital?.id } : {}),
          date_filter: dateFilter
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
    hospitals: 0, doctors: 0, active_doctors: 0, patients: 0,
    prescriptions: 0, medicines: 0, manufacturers: 0, medicine_types: 0,
    test_templates: 0, rooms: 0, active_rooms: 0, surgeries: 0,
    lab_orders_today: 0, appointments_today: 0, room_bookings_today: 0, patient_surgeries_today: 0,
  };

  const monthlyData = summary?.charts.monthly ?? [];
  const appointmentStatusData = summary?.charts.appointment_status ?? [];
  const testStatusData = summary?.charts.test_status ?? [];
  const medicineStockData = summary?.charts.medicine_stock ?? [];
  const recentData = summary?.recent ?? { patients: [], prescriptions: [], lab_orders: [] };
  
  const pendingLabCount = testStatusData.find(item => item.name === 'Pending')?.value ?? 0;

  // RBAC Filtered Stats Cards
  const renderStatCards = () => {
    const cards = [];

    if (role === 'super_admin') {
      cards.push({ id: 'hospitals', label: 'Total Hospitals', value: counts.hospitals, icon: <Building2 className="w-4 h-4" />, color: 'bg-purple-500' });
    }
    if (hasPermission('view_doctors')) {
      cards.push({ id: 'doctors', label: 'Total Doctors', value: counts.doctors, icon: <Stethoscope className="w-4 h-4" />, color: 'bg-blue-500' });
    }
    if (hasPermission('view_patients')) {
      cards.push({ id: 'patients', label: 'Patients', value: counts.patients, icon: <Users className="w-4 h-4" />, color: 'bg-green-500' });
    }
    if (hasPermission('view_prescriptions')) {
      cards.push({ id: 'prescriptions', label: 'Prescriptions', value: counts.prescriptions, icon: <FileText className="w-4 h-4" />, color: 'bg-orange-500' });
    }
    if (hasPermission('view_appointments')) {
      cards.push({ id: 'appointments', label: 'Appointments', value: counts.appointments_today, icon: <Calendar className="w-4 h-4" />, color: 'bg-teal-500' });
    }
    if (hasPermission('view_lab_orders')) {
      cards.push({ id: 'lab_orders', label: 'Lab Tests', value: counts.lab_orders_today, icon: <Activity className="w-4 h-4" />, color: 'bg-cyan-500' });
      cards.push({ id: 'test_templates', label: 'Test Templates', value: counts.test_templates, icon: <TestTube className="w-4 h-4" />, color: 'bg-indigo-500' });
    }
    if (hasPermission('view_medicines')) {
      cards.push({ id: 'medicines', label: 'Total Medicines', value: counts.medicines, icon: <Pill className="w-4 h-4" />, color: 'bg-pink-500' });
    }
    if (hasPermission('view_rooms')) {
      cards.push({ id: 'rooms', label: 'Total Rooms', value: counts.rooms, icon: <Building2 className="w-4 h-4" />, color: 'bg-sky-500' });
      cards.push({ id: 'active_rooms', label: 'Active Rooms', value: counts.active_rooms, icon: <CheckCircle className="w-4 h-4" />, color: 'bg-emerald-500' });
    }
    if (hasPermission('view_surgeries')) {
      cards.push({ id: 'surgeries', label: 'Surgeries', value: counts.surgeries, icon: <Activity className="w-4 h-4" />, color: 'bg-rose-500' });
    }

    return cards.map(c => (
      <StatCard key={c.id} label={c.label} value={c.value.toString()} icon={c.icon} color={c.color} />
    ));
  };

  return (
    <div className="space-y-4">
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dashboard Overview</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {hospital?.name ? `Showing analytics for ${hospital.name}` : "System Overview"}
          </p>
        </div>
        <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg p-1.5 shadow-sm border border-gray-200 dark:border-gray-700">
          <Filter className="w-4 h-4 text-gray-500 ml-2 mr-1" />
          <select 
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-transparent border-none text-sm font-medium text-gray-700 dark:text-gray-300 focus:ring-0 cursor-pointer"
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

      {/* Stats Cards Grid based on RBAC */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {renderStatCards()}
      </div>

      {/* Pending Tests Alert */}
      {hasPermission("view_lab_orders") && pendingLabCount > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <h3 className="text-xs font-semibold text-blue-900 dark:text-blue-300">Pending Tests</h3>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">You have {pendingLabCount} pending tests waiting for processing.</p>
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Activity Trends</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey="patients" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="prescriptions" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="appointments" stroke="#f59e0b" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Appointment Status */}
        {hasPermission('view_appointments') && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Appointment Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={appointmentStatusData}
                cx="50%" cy="50%" innerRadius={60} outerRadius={80}
                paddingAngle={2} dataKey="value"
              >
                {appointmentStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {appointmentStatusData.map((item, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="text-xs text-gray-600 dark:text-gray-400">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>

      <RecentActivity recent={recentData} role={role} hasPermission={hasPermission} />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  trend?: { value: string; isPositive: boolean };
}

function StatCard({ label, value, icon, color, trend }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
        </div>
        <div className={`${color} p-3 rounded-xl text-white shadow-inner`}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${
          trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
        }`}>
          {trend.isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          <span>{trend.value} from last period</span>
        </div>
      )}
    </div>
  );
}

function RecentActivity({ recent, role, hasPermission }: { recent: any, role: string, hasPermission: (key: string) => boolean }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
      {hasPermission('view_patients') && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Patients</h3>
          </div>
          <div className="space-y-3">
            {recent.patients?.slice(0, 5).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{p.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{p.patient_id}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {hasPermission('view_lab_orders') && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Lab Orders</h3>
          </div>
          <div className="space-y-3">
            {recent.lab_orders?.slice(0, 5).map((l: any) => (
              <div key={l.id} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{l.patient_name || 'Walk-in'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{l.order_number}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  l.status === 'completed' ? 'bg-green-100 text-green-700' :
                  l.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {l.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync("C:\\xampp\\htdocs\\shifaascript\\frontend-web\\src\\app\\components\\Dashboard.tsx", code);
