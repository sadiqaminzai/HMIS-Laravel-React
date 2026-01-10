import React, { useState } from 'react';
import { 
  Users, FileText, Pill, Stethoscope, Building2, TrendingUp, TrendingDown,
  Calendar, ClipboardList, TestTube, Package, Activity, AlertCircle,
  CheckCircle, Clock, XCircle, ArrowUpRight, ArrowDownRight, Filter
} from 'lucide-react';
import { UserRole, Hospital } from '../types';
import { 
  mockDoctors, mockPatients, mockMedicines, mockPrescriptions, 
  mockHospitals, mockManufacturers, mockMedicineTypes 
} from '../data/mockData';
import { mockTestTemplates } from '../data/mockTestTemplates';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

interface DashboardProps {
  role: UserRole;
  hospital: Hospital;
}

export function Dashboard({ role, hospital }: DashboardProps) {
  const [selectedHospital, setSelectedHospital] = useState<string>('all');

  // Filter data based on role and hospital
  const getFilteredData = () => {
    if (role === 'super_admin') {
      if (selectedHospital === 'all') {
        return {
          hospitals: mockHospitals,
          doctors: mockDoctors,
          patients: mockPatients,
          prescriptions: mockPrescriptions,
          medicines: mockMedicines
        };
      } else {
        return {
          hospitals: mockHospitals.filter(h => h.id === selectedHospital),
          doctors: mockDoctors.filter(d => d.hospitalId === selectedHospital),
          patients: mockPatients.filter(p => p.hospitalId === selectedHospital),
          prescriptions: mockPrescriptions.filter(p => p.hospitalId === selectedHospital),
          medicines: mockMedicines.filter(m => m.hospitalId === selectedHospital)
        };
      }
    } else {
      return {
        hospitals: [hospital],
        doctors: mockDoctors.filter(d => d.hospitalId === hospital.id),
        patients: mockPatients.filter(p => p.hospitalId === hospital.id),
        prescriptions: mockPrescriptions.filter(p => p.hospitalId === hospital.id),
        medicines: mockMedicines.filter(m => m.hospitalId === hospital.id)
      };
    }
  };

  const data = getFilteredData();

  // Chart data
  const monthlyData = [
    { month: 'Jan', patients: 65, prescriptions: 45, appointments: 75 },
    { month: 'Feb', patients: 78, prescriptions: 52, appointments: 85 },
    { month: 'Mar', patients: 90, prescriptions: 68, appointments: 95 },
    { month: 'Apr', patients: 81, prescriptions: 58, appointments: 88 },
    { month: 'May', patients: 95, prescriptions: 72, appointments: 102 },
    { month: 'Jun', patients: 110, prescriptions: 85, appointments: 115 },
  ];

  const testStatusData = [
    { name: 'Pending', value: 15, color: '#f59e0b' },
    { name: 'In Progress', value: 8, color: '#3b82f6' },
    { name: 'Completed', value: 45, color: '#10b981' },
    { name: 'Cancelled', value: 2, color: '#ef4444' },
  ];

  const medicineStockData = [
    { name: 'In Stock', value: 285, color: '#10b981' },
    { name: 'Low Stock', value: 35, color: '#f59e0b' },
    { name: 'Out of Stock', value: 8, color: '#ef4444' },
  ];

  const appointmentStatusData = [
    { name: 'Scheduled', value: 42, color: '#3b82f6' },
    { name: 'Completed', value: 156, color: '#10b981' },
    { name: 'Cancelled', value: 12, color: '#ef4444' },
    { name: 'No Show', value: 5, color: '#6b7280' },
  ];

  // Super Admin Dashboard
  const SuperAdminDashboard = () => (
    <div className="space-y-3">
      {/* Hospital Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Super Admin Dashboard</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">System-wide overview and analytics</p>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Filter className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          <select
            value={selectedHospital}
            onChange={(e) => setSelectedHospital(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Hospitals</option>
            {mockHospitals.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Cards Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Hospitals"
          value={data.hospitals.length.toString()}
          icon={<Building2 className="w-4 h-4" />}
          color="bg-purple-500"
          trend={{ value: '2', isPositive: true }}
        />
        <StatCard
          label="Total Doctors"
          value={data.doctors.length.toString()}
          icon={<Stethoscope className="w-4 h-4" />}
          color="bg-blue-500"
          trend={{ value: '5', isPositive: true }}
        />
        <StatCard
          label="Total Patients"
          value={data.patients.length.toString()}
          icon={<Users className="w-4 h-4" />}
          color="bg-green-500"
          trend={{ value: '12', isPositive: true }}
        />
        <StatCard
          label="Total Prescriptions"
          value={data.prescriptions.length.toString()}
          icon={<FileText className="w-4 h-4" />}
          color="bg-orange-500"
          trend={{ value: '8', isPositive: true }}
        />
      </div>

      {/* Stats Cards Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Medicines"
          value={data.medicines.length.toString()}
          icon={<Pill className="w-4 h-4" />}
          color="bg-pink-500"
          trend={{ value: '10', isPositive: true }}
        />
        <StatCard
          label="Test Templates"
          value={mockTestTemplates.length.toString()}
          icon={<TestTube className="w-4 h-4" />}
          color="bg-indigo-500"
          trend={{ value: '3', isPositive: true }}
        />
        <StatCard
          label="Lab Tests (Today)"
          value="24"
          icon={<Activity className="w-4 h-4" />}
          color="bg-cyan-500"
          trend={{ value: '6', isPositive: true }}
        />
        <StatCard
          label="Appointments"
          value="156"
          icon={<Calendar className="w-4 h-4" />}
          color="bg-teal-500"
          trend={{ value: '15', isPositive: true }}
        />
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
            {data.hospitals.map(h => (
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
      <RecentActivity data={data} role={role} />
    </div>
  );

  // Admin Dashboard
  const AdminDashboard = () => (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Admin Dashboard</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{hospital.name} - Overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Doctors"
          value={data.doctors.length.toString()}
          icon={<Stethoscope className="w-4 h-4" />}
          color="bg-blue-500"
          trend={{ value: '2', isPositive: true }}
        />
        <StatCard
          label="Total Patients"
          value={data.patients.length.toString()}
          icon={<Users className="w-4 h-4" />}
          color="bg-green-500"
          trend={{ value: '15', isPositive: true }}
        />
        <StatCard
          label="Prescriptions"
          value={data.prescriptions.length.toString()}
          icon={<FileText className="w-4 h-4" />}
          color="bg-orange-500"
          trend={{ value: '8', isPositive: true }}
        />
        <StatCard
          label="Medicines"
          value={data.medicines.length.toString()}
          icon={<Pill className="w-4 h-4" />}
          color="bg-purple-500"
          trend={{ value: '3', isPositive: false }}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">Monthly Activity</h3>
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
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Bar dataKey="patients" fill="#3b82f6" radius={[4, 4, 0, 0]} />
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
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="text-xs text-gray-600 dark:text-gray-400">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <RecentActivity data={data} role={role} />
    </div>
  );

  // Doctor Dashboard
  const DoctorDashboard = () => (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Doctor Dashboard</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Your patients and appointments overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Patients"
          value={data.patients.length.toString()}
          icon={<Users className="w-4 h-4" />}
          color="bg-blue-500"
          trend={{ value: '12', isPositive: true }}
        />
        <StatCard
          label="Appointments Today"
          value="8"
          icon={<Calendar className="w-4 h-4" />}
          color="bg-green-500"
          trend={{ value: '3', isPositive: true }}
        />
        <StatCard
          label="Prescriptions"
          value={data.prescriptions.length.toString()}
          icon={<ClipboardList className="w-4 h-4" />}
          color="bg-orange-500"
          trend={{ value: '5', isPositive: true }}
        />
        <StatCard
          label="Lab Tests Ordered"
          value="15"
          icon={<TestTube className="w-4 h-4" />}
          color="bg-purple-500"
          trend={{ value: '2', isPositive: true }}
        />
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
            <button className="w-full p-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all text-xs font-medium flex items-center justify-center gap-2">
              <ClipboardList className="w-3.5 h-3.5" />
              Create New Prescription
            </button>
            <button className="w-full p-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all text-xs font-medium flex items-center justify-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              View Appointments
            </button>
            <button className="w-full p-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all text-xs font-medium flex items-center justify-center gap-2">
              <TestTube className="w-3.5 h-3.5" />
              Order Lab Tests
            </button>
          </div>
        </div>
      </div>

      <RecentActivity data={data} role={role} />
    </div>
  );

  // Receptionist Dashboard
  const ReceptionistDashboard = () => (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Reception Dashboard</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Patient registration and appointments</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Patients"
          value={data.patients.length.toString()}
          icon={<Users className="w-4 h-4" />}
          color="bg-blue-500"
          trend={{ value: '15', isPositive: true }}
        />
        <StatCard
          label="Today's Appointments"
          value="12"
          icon={<Calendar className="w-4 h-4" />}
          color="bg-green-500"
          trend={{ value: '4', isPositive: true }}
        />
        <StatCard
          label="Scheduled"
          value="42"
          icon={<Clock className="w-4 h-4" />}
          color="bg-orange-500"
          trend={{ value: '8', isPositive: true }}
        />
        <StatCard
          label="Available Doctors"
          value={data.doctors.filter(d => d.status === 'active').length.toString()}
          icon={<Stethoscope className="w-4 h-4" />}
          color="bg-purple-500"
          trend={{ value: '0', isPositive: true }}
        />
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
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="text-xs text-gray-600 dark:text-gray-400">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <RecentActivity data={data} role={role} />
    </div>
  );

  // Pharmacist Dashboard
  const PharmacistDashboard = () => (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Pharmacy Dashboard</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Medicine inventory and prescriptions</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Medicines"
          value={data.medicines.length.toString()}
          icon={<Pill className="w-4 h-4" />}
          color="bg-blue-500"
          trend={{ value: '5', isPositive: true }}
        />
        <StatCard
          label="Prescriptions"
          value={data.prescriptions.length.toString()}
          icon={<FileText className="w-4 h-4" />}
          color="bg-green-500"
          trend={{ value: '8', isPositive: true }}
        />
        <StatCard
          label="Low Stock Items"
          value="12"
          icon={<AlertCircle className="w-4 h-4" />}
          color="bg-orange-500"
          trend={{ value: '3', isPositive: false }}
        />
        <StatCard
          label="Manufacturers"
          value={mockManufacturers.length.toString()}
          icon={<Package className="w-4 h-4" />}
          color="bg-purple-500"
          trend={{ value: '1', isPositive: true }}
        />
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
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
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
            <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">12 medicines are running low on stock. Please reorder soon.</p>
          </div>
        </div>
      </div>

      <RecentActivity data={data} role={role} />
    </div>
  );

  // Lab Technician Dashboard
  const LabTechnicianDashboard = () => (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Laboratory Dashboard</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Lab tests and results management</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Pending Tests"
          value="15"
          icon={<Clock className="w-4 h-4" />}
          color="bg-orange-500"
          trend={{ value: '5', isPositive: false }}
        />
        <StatCard
          label="In Progress"
          value="8"
          icon={<Activity className="w-4 h-4" />}
          color="bg-blue-500"
          trend={{ value: '3', isPositive: true }}
        />
        <StatCard
          label="Completed Today"
          value="24"
          icon={<CheckCircle className="w-4 h-4" />}
          color="bg-green-500"
          trend={{ value: '12', isPositive: true }}
        />
        <StatCard
          label="Test Templates"
          value="48"
          icon={<TestTube className="w-4 h-4" />}
          color="bg-purple-500"
          trend={{ value: '2', isPositive: true }}
        />
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
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
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
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">You have 15 pending tests waiting for processing.</p>
          </div>
        </div>
      </div>

      <RecentActivity data={data} role={role} />
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
  data: any;
  role: UserRole;
}

function RecentActivity({ data, role }: RecentActivityProps) {
  if (role === 'pharmacist') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <h2 className="text-xs font-semibold text-gray-900 dark:text-white mb-2">Recent Prescriptions</h2>
        <div className="space-y-2">
          {data.prescriptions.slice(0, 5).map((prescription: any) => (
            <div key={prescription.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                <div className="w-7 h-7 bg-green-100 dark:bg-green-900/30 rounded-md flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{prescription.patientName}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{prescription.prescriptionNumber}</p>
                </div>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                {prescription.medicines.length} items
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
          <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
              <div className="w-7 h-7 bg-orange-100 dark:bg-orange-900/30 rounded-md flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">Complete Blood Count</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">Patient: John Doe</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 shrink-0">
              Pending
            </span>
          </div>
          <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
              <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center shrink-0">
                <Activity className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">Lipid Profile</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">Patient: Sarah Smith</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 shrink-0">
              In Progress
            </span>
          </div>
          <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
              <div className="w-7 h-7 bg-green-100 dark:bg-green-900/30 rounded-md flex items-center justify-center shrink-0">
                <CheckCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">Thyroid Function Test</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">Patient: Mike Johnson</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 shrink-0">
              Completed
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <h2 className="text-xs font-semibold text-gray-900 dark:text-white mb-2">Recent Patients</h2>
      <div className="space-y-2">
        {data.patients.slice(0, 5).map((patient: any) => (
          <div key={patient.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
              <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{patient.name}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{patient.patientId}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">{patient.age} yrs</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{patient.gender}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}