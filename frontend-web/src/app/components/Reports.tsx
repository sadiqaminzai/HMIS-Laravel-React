import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  BarChart, 
  PieChart, 
  LineChart, 
  Users, 
  FileText, 
  Activity, 
  Building2, 
  Download,
  Filter
} from 'lucide-react';
import { format, subDays, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { 
  BarChart as RechartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  LineChart as RechartsLineChart, 
  Line, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Hospital, UserRole, Doctor, Patient, LabTest, Prescription, Appointment } from '../types';
import { mockPrescriptions, mockDoctors, mockPatients, mockHospitals } from '../data/mockData';

// Re-implementing mock lab tests generator locally since it's not exported
const generateMockLabTests = (hospitalId: string): LabTest[] => [
  {
    id: '1',
    hospitalId: hospitalId,
    testNumber: 'LT-2024-001',
    patientId: '1',
    patientName: 'John Doe',
    patientAge: 45,
    patientGender: 'male',
    doctorId: '1',
    doctorName: 'Dr. John Smith',
    selectedTests: ['1', '2'],
    testName: 'Complete Blood Count, Lipid Profile',
    testType: 'Hematology',
    status: 'completed',
    priority: 'normal',
    createdAt: new Date('2024-03-10T10:00:00'),
    createdBy: 'Lab Tech',
    assignedTo: 'LT001',
    assignedToName: 'Sarah Lab Tech'
  },
  {
    id: '2',
    hospitalId: hospitalId,
    testNumber: 'LT-2024-002',
    patientId: '2',
    patientName: 'Jane Smith',
    patientAge: 32,
    patientGender: 'female',
    doctorId: '2',
    doctorName: 'Dr. Sarah Johnson',
    selectedTests: ['3'],
    testName: 'Blood Glucose (Fasting)',
    testType: 'Biochemistry',
    status: 'pending',
    priority: 'urgent',
    createdAt: new Date('2024-03-11T09:30:00'),
    createdBy: 'Lab Tech',
    assignedTo: 'LT001',
    assignedToName: 'Sarah Lab Tech'
  },
  {
    id: '3',
    hospitalId: hospitalId,
    testNumber: 'LT-2024-003',
    patientId: '3',
    patientName: 'Robert Johnson',
    patientAge: 58,
    patientGender: 'male',
    doctorId: '1',
    doctorName: 'Dr. John Smith',
    selectedTests: ['4'],
    testName: 'Thyroid Profile',
    testType: 'Endocrinology',
    status: 'completed',
    priority: 'normal',
    createdAt: new Date('2024-03-12T14:15:00'),
    createdBy: 'Lab Tech',
    assignedTo: 'LT001',
    assignedToName: 'Sarah Lab Tech'
  },
  {
    id: '4',
    hospitalId: hospitalId,
    testNumber: 'LT-2024-004',
    patientId: '1',
    patientName: 'John Doe',
    patientAge: 45,
    patientGender: 'male',
    doctorId: '3',
    doctorName: 'Dr. Emily Davis',
    selectedTests: ['1'],
    testName: 'Complete Blood Count',
    testType: 'Hematology',
    status: 'unpaid',
    priority: 'normal',
    createdAt: new Date('2024-03-13T11:00:00'),
    createdBy: 'Lab Tech',
    assignedTo: 'LT001',
    assignedToName: 'Sarah Lab Tech'
  },
  {
    id: '5',
    hospitalId: hospitalId,
    testNumber: 'LT-2024-005',
    patientId: '4',
    patientName: 'Michael Brown',
    patientAge: 62,
    patientGender: 'male',
    doctorId: '2',
    doctorName: 'Dr. Sarah Johnson',
    selectedTests: ['2', '3'],
    testName: 'Lipid Profile, Blood Glucose',
    testType: 'Biochemistry',
    status: 'in_progress',
    priority: 'stat',
    createdAt: new Date('2024-03-14T08:45:00'),
    createdBy: 'Lab Tech',
    assignedTo: 'LT001',
    assignedToName: 'Sarah Lab Tech'
  }
];

interface ReportsProps {
  hospital: Hospital;
  userRole: UserRole;
}

type ReportType = 'date' | 'doctor' | 'patient' | 'lab' | 'hospital' | 'other';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function Reports({ hospital, userRole }: ReportsProps) {
  const [reportType, setReportType] = useState<ReportType>('date');
  const [startDate, setStartDate] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedEntityId, setSelectedEntityId] = useState<string>('all');
  
  // Data State
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    totalPrescriptions: 0,
    totalLabTests: 0,
    totalPatients: 0,
    totalRevenue: 0 // Mock revenue
  });

  // Mock Data Aggregation
  const allLabTests = useMemo(() => generateMockLabTests(hospital.id), [hospital.id]);
  
  useEffect(() => {
    // Filter logic based on Date Range and Report Type
    const start = startOfDay(parseISO(startDate));
    const end = endOfDay(parseISO(endDate));

    const isInRange = (date: Date) => isWithinInterval(date, { start, end });

    // Filter Prescriptions
    const prescriptions = mockPrescriptions.filter(p => 
      p.hospitalId === hospital.id && isInRange(new Date(p.createdAt))
    );

    // Filter Lab Tests
    const labTests = allLabTests.filter(lt => 
      lt.hospitalId === hospital.id && isInRange(new Date(lt.createdAt))
    );

    // Calculate Summary Stats
    setSummaryStats({
      totalPrescriptions: prescriptions.length,
      totalLabTests: labTests.length,
      totalPatients: new Set([...prescriptions.map(p => p.patientId), ...labTests.map(lt => lt.patientId)]).size,
      totalRevenue: labTests.length * 50 + prescriptions.length * 30 // Mock calculation
    });

    let chartData: any[] = [];

    switch (reportType) {
      case 'date':
        // Aggregate by Date
        const dateMap = new Map();
        // Initialize days in range could be complex, simplifying to just data points present
        prescriptions.forEach(p => {
          const date = format(new Date(p.createdAt), 'yyyy-MM-dd');
          if (!dateMap.has(date)) dateMap.set(date, { date, prescriptions: 0, labTests: 0 });
          dateMap.get(date).prescriptions++;
        });
        labTests.forEach(lt => {
          const date = format(new Date(lt.createdAt), 'yyyy-MM-dd');
          if (!dateMap.has(date)) dateMap.set(date, { date, prescriptions: 0, labTests: 0 });
          dateMap.get(date).labTests++;
        });
        chartData = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
        break;

      case 'doctor':
        const docMap = new Map();
        mockDoctors.filter(d => d.hospitalId === hospital.id).forEach(d => {
           docMap.set(d.id, { name: d.name, prescriptions: 0, labTests: 0, total: 0 });
        });
        prescriptions.forEach(p => {
          if (docMap.has(p.doctorId)) {
              docMap.get(p.doctorId).prescriptions++;
              docMap.get(p.doctorId).total++;
          }
        });
        labTests.forEach(lt => {
          if (docMap.has(lt.doctorId)) {
              docMap.get(lt.doctorId).labTests++;
              docMap.get(lt.doctorId).total++;
          }
        });
        chartData = Array.from(docMap.values());
        break;

      case 'patient':
        // Top 10 Patients
        const patMap = new Map();
        prescriptions.forEach(p => {
          const name = p.patientName;
          if (!patMap.has(name)) patMap.set(name, { name, activity: 0 });
          patMap.get(name).activity++;
        });
        labTests.forEach(lt => {
          const name = lt.patientName;
          if (!patMap.has(name)) patMap.set(name, { name, activity: 0 });
          patMap.get(name).activity++;
        });
        chartData = Array.from(patMap.values())
          .sort((a: any, b: any) => b.activity - a.activity)
          .slice(0, 10);
        break;

      case 'lab':
        // By Lab Test Type or Status
        const typeMap = new Map();
        labTests.forEach(lt => {
          const type = lt.testType;
          if (!typeMap.has(type)) typeMap.set(type, { name: type, count: 0 });
          typeMap.get(type).count++;
        });
        chartData = Array.from(typeMap.values());
        break;

      case 'hospital':
        // Only if super admin or just show current hospital stats comparison (mocking other hospitals for demo)
        if (userRole === 'super_admin' || true) { // Allow for demo
            const hospMap = new Map();
            mockHospitals.forEach(h => {
                hospMap.set(h.id, { name: h.name, count: 0 });
            });
            // Use global mock data for this one view if allowed, otherwise just current
            // For now, let's just show current hospital vs "Industry Average" (mock)
            chartData = [
                { name: hospital.name, count: prescriptions.length + labTests.length },
                { name: 'City Average', count: 45 } // Mock
            ];
        }
        break;
        
      default:
        break;
    }

    setFilteredData(chartData);

  }, [reportType, startDate, endDate, hospital.id, allLabTests, userRole]);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // -- Header Section --
    // Blue background for header
    doc.setFillColor(37, 99, 235); // Blue-600
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    // Hospital Name (White)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(hospital.name, 14, 20);
    
    // Report Title (White, smaller)
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Analysis Report`, 14, 30);

    // Date Info (Right aligned in header)
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy')}`, pageWidth - 14, 20, { align: 'right' });
    doc.text(`Range: ${startDate} to ${endDate}`, pageWidth - 14, 30, { align: 'right' });

    // -- Summary Stats Section --
    const startY = 55;
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Key Performance Indicators', 14, 50);

    // Draw 4 cards in a row
    const margin = 14;
    const gap = 5;
    const cardWidth = (pageWidth - (margin * 2) - (gap * 3)) / 4;
    const cardHeight = 25;

    const stats = [
       { label: 'Prescriptions', value: summaryStats.totalPrescriptions.toString() },
       { label: 'Lab Tests', value: summaryStats.totalLabTests.toString() },
       { label: 'Patients', value: summaryStats.totalPatients.toString() },
       { label: 'Revenue', value: summaryStats.totalRevenue.toFixed(2) },
    ];

    stats.forEach((stat, index) => {
        const x = margin + (index * (cardWidth + gap));
        
        // Card background
        doc.setFillColor(248, 250, 252); // Gray-50
        doc.setDrawColor(226, 232, 240); // Gray-200
        doc.roundedRect(x, startY, cardWidth, cardHeight, 2, 2, 'FD');

        // Value
        doc.setTextColor(37, 99, 235); // Blue-600
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(stat.value, x + 4, startY + 10);

        // Label
        doc.setTextColor(100, 116, 139); // Gray-500
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(stat.label, x + 4, startY + 20);
    });

    // -- Detailed Data Table --
    let tableHead: string[] = [];
    let tableBody: any[][] = [];

    if (reportType === 'date') {
        tableHead = ['Date', 'Prescriptions', 'Lab Tests', 'Total Activity'];
        tableBody = filteredData.map(row => [row.date, row.prescriptions, row.labTests, row.prescriptions + row.labTests]);
    } else if (reportType === 'doctor') {
        tableHead = ['Doctor Name', 'Prescriptions', 'Lab Tests', 'Total'];
        tableBody = filteredData.map(row => [row.name, row.prescriptions, row.labTests, row.prescriptions + row.labTests]);
    } else if (reportType === 'patient') {
         tableHead = ['Patient Name', 'Total Activity'];
         tableBody = filteredData.map(row => [row.name, row.activity]);
    } else if (reportType === 'lab') {
         tableHead = ['Test Type', 'Count'];
         tableBody = filteredData.map(row => [row.name, row.count]);
    } else if (reportType === 'hospital') {
         tableHead = ['Hospital Name', 'Count'];
         tableBody = filteredData.map(row => [row.name, row.count]);
    }

    autoTable(doc, {
        startY: startY + cardHeight + 15,
        head: [tableHead],
        body: tableBody,
        theme: 'grid',
        headStyles: { 
            fillColor: [255, 255, 255], 
            textColor: [37, 99, 235], // Blue-600
            fontStyle: 'bold',
            lineWidth: 0.1,
            lineColor: [226, 232, 240] 
        },
        styles: { 
            fontSize: 10, 
            cellPadding: 4,
            lineColor: [226, 232, 240],
            lineWidth: 0.1
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252] // Gray-50
        },
        margin: { left: 14, right: 14 }
    });

    // Footer with Page Numbers
    const totalPages = (doc as any).internal.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(150);
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.text(`Page ${i} of ${totalPages} - Confidential Report`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    doc.save(`report_${reportType}_${startDate}_${endDate}.pdf`);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Generate and analyze reports for {hospital.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={handleExportPDF}
             className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
           >
             <Download className="w-4 h-4" />
             Export Report
           </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
            
            {/* Report Type */}
            <div className="flex-1 w-full md:w-auto">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Report Type</label>
                <select 
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value as ReportType)}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                    <option value="date">Date Wise</option>
                    <option value="doctor">Doctor Wise</option>
                    <option value="patient">Patient Wise</option>
                    <option value="lab">Lab Test Wise</option>
                    {userRole === 'super_admin' && <option value="hospital">Hospital Wise</option>}
                    <option value="other">Other</option>
                </select>
            </div>

            {/* Date Range */}
            <div className="flex-1 flex gap-2 w-full md:w-auto">
                <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                    <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                    <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Additional Entity Filter (Context sensitive) */}
            {reportType === 'doctor' && (
                <div className="flex-1 w-full md:w-auto">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Specific Doctor</label>
                    <select 
                        value={selectedEntityId}
                        onChange={(e) => setSelectedEntityId(e.target.value)}
                        className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">All Doctors</option>
                        {mockDoctors.filter(d => d.hospitalId === hospital.id).map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Prescriptions</p>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{summaryStats.totalPrescriptions}</h3>
                </div>
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
            </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Lab Tests</p>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{summaryStats.totalLabTests}</h3>
                </div>
                <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                    <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
            </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Active Patients</p>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{summaryStats.totalPatients}</h3>
                </div>
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                    <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
            </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Est. Revenue</p>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{summaryStats.totalRevenue.toFixed(2)}</h3>
                </div>
                <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                    <BarChart className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
            </div>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 capitalize">
                {reportType === 'date' ? 'Activity Over Time' : `${reportType} Analysis`}
            </h3>
            
            <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    {reportType === 'date' ? (
                        <RechartsLineChart data={filteredData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                            />
                            <Legend />
                            <Line type="monotone" dataKey="prescriptions" stroke="#2563eb" strokeWidth={2} name="Prescriptions" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="labTests" stroke="#7c3aed" strokeWidth={2} name="Lab Tests" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </RechartsLineChart>
                    ) : (
                        <RechartsBarChart data={filteredData} layout={reportType === 'doctor' || reportType === 'patient' ? "vertical" : "horizontal"}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={true} vertical={false} />
                            <XAxis type={reportType === 'doctor' || reportType === 'patient' ? "number" : "category"} dataKey={reportType === 'doctor' || reportType === 'patient' ? undefined : "name"} stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis type={reportType === 'doctor' || reportType === 'patient' ? "category" : "number"} dataKey={reportType === 'doctor' || reportType === 'patient' ? "name" : undefined} width={100} stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip 
                                cursor={{ fill: '#f3f4f6' }}
                                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                            />
                            <Legend />
                            {reportType === 'doctor' ? (
                                <>
                                 <Bar dataKey="prescriptions" fill="#2563eb" name="Prescriptions" radius={[0, 4, 4, 0]} barSize={20} stackId="a" />
                                 <Bar dataKey="labTests" fill="#7c3aed" name="Lab Tests" radius={[0, 4, 4, 0]} barSize={20} stackId="a" />
                                </>
                            ) : (
                                <Bar dataKey={reportType === 'patient' ? "activity" : "count"} fill="#2563eb" radius={[4, 4, 0, 0]} name="Total Activity" barSize={32} />
                            )}
                        </RechartsBarChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>

        {/* Distribution Chart (Pie) */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Distribution</h3>
            <div className="h-[350px] w-full relative">
                 <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                        <Pie
                            data={[
                                { name: 'Prescriptions', value: summaryStats.totalPrescriptions },
                                { name: 'Lab Tests', value: summaryStats.totalLabTests }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            fill="#8884d8"
                            paddingAngle={5}
                            dataKey="value"
                        >
                            <Cell key="cell-0" fill="#2563eb" />
                            <Cell key="cell-1" fill="#7c3aed" />
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36}/>
                    </RechartsPieChart>
                </ResponsiveContainer>
                {/* Center Text */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{summaryStats.totalPrescriptions + summaryStats.totalLabTests}</span>
                    <span className="block text-xs text-gray-500">Total Items</span>
                </div>
            </div>
        </div>
      </div>

      {/* Detailed Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Detailed Data</h3>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase font-medium text-gray-500 dark:text-gray-300">
                    <tr>
                        {reportType === 'date' && (
                            <>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Prescriptions</th>
                                <th className="px-6 py-3">Lab Tests</th>
                                <th className="px-6 py-3">Total Activity</th>
                            </>
                        )}
                        {reportType === 'doctor' && (
                            <>
                                <th className="px-6 py-3">Doctor Name</th>
                                <th className="px-6 py-3">Prescriptions</th>
                                <th className="px-6 py-3">Lab Tests</th>
                                <th className="px-6 py-3">Total</th>
                            </>
                        )}
                        {reportType === 'patient' && (
                            <>
                                <th className="px-6 py-3">Patient Name</th>
                                <th className="px-6 py-3">Total Activity</th>
                            </>
                        )}
                         {reportType === 'lab' && (
                            <>
                                <th className="px-6 py-3">Test Type</th>
                                <th className="px-6 py-3">Count</th>
                            </>
                        )}
                        {reportType === 'hospital' && (
                            <>
                                <th className="px-6 py-3">Hospital Name</th>
                                <th className="px-6 py-3">Count</th>
                            </>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredData.length > 0 ? (
                        filteredData.map((row, index) => (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                {reportType === 'date' && (
                                    <>
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{row.date}</td>
                                        <td className="px-6 py-4">{row.prescriptions}</td>
                                        <td className="px-6 py-4">{row.labTests}</td>
                                        <td className="px-6 py-4 font-semibold">{row.prescriptions + row.labTests}</td>
                                    </>
                                )}
                                {reportType === 'doctor' && (
                                    <>
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{row.name}</td>
                                        <td className="px-6 py-4">{row.prescriptions}</td>
                                        <td className="px-6 py-4">{row.labTests}</td>
                                        <td className="px-6 py-4 font-semibold">{row.prescriptions + row.labTests}</td>
                                    </>
                                )}
                                {reportType === 'patient' && (
                                    <>
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{row.name}</td>
                                        <td className="px-6 py-4 font-semibold">{row.activity}</td>
                                    </>
                                )}
                                {reportType === 'lab' && (
                                    <>
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{row.name}</td>
                                        <td className="px-6 py-4 font-semibold">{row.count}</td>
                                    </>
                                )}
                                {reportType === 'hospital' && (
                                    <>
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{row.name}</td>
                                        <td className="px-6 py-4 font-semibold">{row.count}</td>
                                    </>
                                )}
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                No data available for the selected range.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}