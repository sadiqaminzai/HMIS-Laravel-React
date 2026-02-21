import React, { useState } from 'react';
import { Beaker, Plus, Search, Clock, CheckCircle, XCircle, FileText, Printer, Trash2, X, ArrowUp, ArrowDown, ArrowUpDown, FileSpreadsheet, Eye } from 'lucide-react';
import { Hospital, LabTest, UserRole } from '../types';
import { mockPatients } from '../data/mockData';
import { Toast } from './Toast';
import { LabReportPrint } from './LabReportPrint';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LabTestManagementProps {
  hospital: Hospital;
  userRole: UserRole;
  currentUserId?: string;
}

// Mock lab tests data
const generateMockLabTests = (hospitalId: string): LabTest[] => [
  {
    id: '1',
    hospitalId,
    testNumber: 'LAB-2026-00001',
    patientId: 'P00001',
    patientName: 'Ahmed Khan',
    patientAge: 35,
    patientGender: 'male',
    doctorId: 'D001',
    doctorName: 'Dr. Sarah Ahmed',
    testName: 'Complete Blood Count (CBC)',
    testType: 'Hematology',
    instructions: 'Fasting required',
    status: 'pending',
    priority: 'normal',
    createdAt: new Date(),
    createdBy: 'doctor1'
  },
  {
    id: '2',
    hospitalId,
    testNumber: 'LAB-2026-00002',
    patientId: 'P00002',
    patientName: 'Fatima Ali',
    patientAge: 28,
    patientGender: 'female',
    doctorId: 'D002',
    doctorName: 'Dr. Mohammed Yusuf',
    testName: 'Blood Glucose',
    testType: 'Biochemistry',
    status: 'in_progress',
    priority: 'urgent',
    assignedTo: 'LT001',
    assignedToName: 'Lab Tech - Ali Hassan',
    sampleCollectedAt: new Date(),
    createdAt: new Date(),
    createdBy: 'doctor2'
  },
  {
    id: '3',
    hospitalId,
    testNumber: 'LAB-2026-00003',
    patientId: 'P00003',
    patientName: 'Omar Hassan',
    patientAge: 45,
    patientGender: 'male',
    doctorId: 'D001',
    doctorName: 'Dr. Sarah Ahmed',
    testName: 'Lipid Profile',
    testType: 'Biochemistry',
    status: 'completed',
    priority: 'normal',
    assignedTo: 'LT001',
    assignedToName: 'Lab Tech - Ali Hassan',
    sampleCollectedAt: new Date('2026-01-07T09:00:00'),
    reportedAt: new Date('2026-01-07T14:00:00'),
    result: 'Total Cholesterol: 180 mg/dL (Normal: <200) - Normal\nHDL: 45 mg/dL (Normal: >40) - Good\nLDL: 110 mg/dL (Normal: <100) - Borderline',
    remarks: 'Patient can continue current medication',
    createdAt: new Date(),
    createdBy: 'doctor1'
  },
  {
    id: '4',
    hospitalId,
    testNumber: 'LAB-2026-00004',
    patientId: 'P00004',
    patientName: 'Zainab Malik',
    patientAge: 32,
    patientGender: 'female',
    doctorId: 'D003',
    doctorName: 'Dr. Fatima Noor',
    testName: 'Thyroid Function Test',
    testType: 'Biochemistry',
    status: 'pending',
    priority: 'normal',
    createdAt: new Date(),
    createdBy: 'doctor3'
  },
  {
    id: '5',
    hospitalId,
    testNumber: 'LAB-2026-00005',
    patientId: 'P00005',
    patientName: 'Ibrahim Siddiqui',
    patientAge: 52,
    patientGender: 'male',
    doctorId: 'D001',
    doctorName: 'Dr. Sarah Ahmed',
    testName: 'Liver Function Test',
    testType: 'Biochemistry',
    instructions: 'Fasting 12 hours',
    status: 'in_progress',
    priority: 'normal',
    assignedTo: 'LT001',
    assignedToName: 'Lab Tech - Ali Hassan',
    sampleCollectedAt: new Date(),
    createdAt: new Date(),
    createdBy: 'doctor1'
  },
  {
    id: '6',
    hospitalId,
    testNumber: 'LAB-2026-00006',
    patientId: 'P00001',
    patientName: 'Ahmed Khan',
    patientAge: 35,
    patientGender: 'male',
    doctorId: 'D001',
    doctorName: 'Dr. Sarah Ahmed',
    testName: 'Urine Analysis',
    testType: 'Clinical Pathology',
    status: 'completed',
    priority: 'normal',
    assignedTo: 'LT001',
    assignedToName: 'Lab Tech - Ali Hassan',
    sampleCollectedAt: new Date('2026-01-06T08:00:00'),
    reportedAt: new Date('2026-01-06T11:00:00'),
    result: 'Color: Pale Yellow (Normal: Pale Yellow) - Normal\npH: 6.0 (Normal: 4.5-8.0) - Normal\nGlucose: Negative (Normal: Negative) - Normal',
    createdAt: new Date(),
    createdBy: 'doctor1'
  }
];

export function LabTestManagement({ hospital, userRole, currentUserId }: LabTestManagementProps) {
  // Hospital filtering for super_admin
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);

  const [labTests, setLabTests] = useState<LabTest[]>(
    filterByHospital(generateMockLabTests(hospital.id))
  );

  // Update tests when hospital changes
  React.useEffect(() => {
    setLabTests(filterByHospital(generateMockLabTests(selectedHospitalId === 'all' ? hospital.id : selectedHospitalId)));
  }, [selectedHospitalId, isAllHospitals]);

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState<LabTest | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'danger' } | null>(null);
  const [openStatusDropdown, setOpenStatusDropdown] = useState<string | null>(null);
  
  // Sorting state
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Form state
  const [formData, setFormData] = useState({
    patientId: '',
    testName: '',
    testType: '',
    instructions: '',
    priority: 'normal' as 'normal' | 'urgent' | 'stat',
    hospitalId: currentHospital.id
  });

  // Result form state
  const [resultFormData, setResultFormData] = useState({
    result: '',
    remarks: '',
    normalRange: '',
    findings: ''
  });

  // Get hospital-specific patients
  const hospitalPatients = mockPatients.filter(p => isAllHospitals ? true : p.hospitalId === currentHospital.id);

  // Filter lab tests
  const getFilteredLabTests = () => {
    let filtered = labTests;
    
    // Role-based filtering
    if (userRole === 'doctor' && currentUserId) {
      filtered = filtered.filter(test => test.doctorId === currentUserId);
    }
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(test =>
        test.testNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        test.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        test.testName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        test.status.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Sorting logic
    return filtered.sort((a, b) => {
      let aValue: any = a[sortField as keyof LabTest];
      let bValue: any = b[sortField as keyof LabTest];

      if (sortField === 'createdAt' || sortField === 'sampleCollectedAt' || sortField === 'reportedAt') {
        aValue = a[sortField as keyof LabTest]?.getTime() || 0;
        bValue = b[sortField as keyof LabTest]?.getTime() || 0;
      } else {
        aValue = aValue?.toString().toLowerCase() || '';
        bValue = bValue?.toString().toLowerCase() || '';
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  };

  const filteredLabTests = getFilteredLabTests();

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-blue-600 dark:text-blue-400" />
      : <ArrowDown className="w-3 h-3 text-blue-600 dark:text-blue-400" />;
  };

  const exportToExcel = () => {
    const workSheet = XLSX.utils.json_to_sheet(filteredLabTests.map(t => ({
      'Test #': t.testNumber,
      Patient: t.patientName,
      'Test Name': t.testName,
      Doctor: t.doctorName,
      Priority: t.priority,
      Status: t.status,
      Date: t.createdAt.toLocaleDateString()
    })));
    const workBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workBook, workSheet, "LabTests");
    XLSX.writeFile(workBook, "LabTests_List.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Lab Tests Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    if (!isAllHospitals) {
      doc.text(`Hospital: ${currentHospital.name}`, 14, 36);
    }

    autoTable(doc, {
      head: [['Test #', 'Patient', 'Test Name', 'Doctor', 'Priority', 'Status']],
      body: filteredLabTests.map(t => [
        t.testNumber,
        t.patientName,
        t.testName,
        t.doctorName,
        t.priority,
        t.status
      ]),
      startY: isAllHospitals ? 40 : 46,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [66, 139, 202] }
    });

    doc.save('LabTests_Report.pdf');
  };

  const handleAdd = () => {
    const selectedPatient = hospitalPatients.find(p => p.id === formData.patientId);
    
    const newTest: LabTest = {
      id: Date.now().toString(),
      hospitalId: formData.hospitalId,
      testNumber: `LAB-${new Date().getFullYear()}-${String(labTests.length + 1).padStart(5, '0')}`,
      patientId: formData.patientId,
      patientName: selectedPatient?.name || 'Unknown Patient',
      patientAge: selectedPatient?.age || 0,
      patientGender: selectedPatient?.gender || 'male',
      doctorId: currentUserId || 'D001',
      doctorName: 'Dr. Sarah Ahmed', // Mock doctor name
      testName: formData.testName,
      testType: formData.testType,
      instructions: formData.instructions,
      status: 'pending',
      priority: formData.priority,
      createdAt: new Date(),
      createdBy: currentUserId || 'doctor1'
    };
    
    setLabTests([newTest, ...labTests]);
    setShowAddModal(false);
    resetForm();
    setToast({ message: 'Lab test created successfully.', type: 'success' });
  };

  const handleStatusUpdate = (testId: string, newStatus: LabTest['status'], additionalData?: Partial<LabTest>) => {
    setLabTests(labTests.map(test =>
      test.id === testId ? { ...test, status: newStatus, ...additionalData } : test
    ));
    setToast({ message: `Test status updated to ${newStatus}.`, type: 'success' });
  };

  const handleResultSubmit = () => {
    if (!selectedTest) return;
    
    handleStatusUpdate(selectedTest.id, 'completed', {
      result: resultFormData.result,
      remarks: resultFormData.remarks,
      reportedAt: new Date()
    });
    
    setShowResultModal(false);
    setSelectedTest(null);
  };

  const handleDelete = () => {
    if (!selectedTest) return;
    setLabTests(labTests.filter(test => test.id !== selectedTest.id));
    setShowDeleteModal(false);
    setSelectedTest(null);
    setToast({ message: 'Lab test deleted successfully.', type: 'success' });
  };

  const resetForm = () => {
    setFormData({
      patientId: '',
      testName: '',
      testType: '',
      instructions: '',
      priority: 'normal',
      hospitalId: currentHospital.id
    });
  };

  const getStatusColor = (status: LabTest['status']) => {
    const colors = {
      pending: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
      in_progress: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      completed: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
      cancelled: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
    };
    return colors[status];
  };

  const getPriorityColor = (priority: LabTest['priority']) => {
    const colors = {
      normal: 'text-gray-600 dark:text-gray-400',
      urgent: 'text-orange-600 dark:text-orange-400 font-semibold',
      stat: 'text-red-600 dark:text-red-400 font-bold'
    };
    return colors[priority];
  };

  // Check permissions
  const canCreate = hasPermission('add_lab_orders') || hasPermission('manage_lab_orders');
  const canProcess = hasPermission('edit_lab_orders') || hasPermission('update_lab_order_status') || hasPermission('manage_lab_orders');
  const canDelete = hasPermission('delete_lab_orders') || hasPermission('manage_lab_orders');
  const canExport = hasPermission('export_lab_orders') || hasPermission('manage_lab_orders');
  const canPrint = hasPermission('print_lab_orders') || hasPermission('manage_lab_orders');
  const canEnterResults = hasPermission('enter_lab_results') || hasPermission('manage_lab_orders');
  const canChangeAnyStatus = hasPermission('update_lab_order_status') || hasPermission('manage_lab_orders');

  return (
    <div className="space-y-3">
      {/* Compact Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Lab Tests</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Manage laboratory test orders for {isAllHospitals ? 'All Hospitals' : currentHospital.name}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Compact Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search lab tests..."
              className="w-48 pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

           {canExport && (
             <button
               onClick={exportToExcel}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs font-medium shadow-sm"
               title="Export to Excel"
             >
               <FileSpreadsheet className="w-3.5 h-3.5" />
               Excel
             </button>
           )}
           {canExport && (
             <button
               onClick={exportToPDF}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs font-medium shadow-sm"
               title="Export to PDF"
             >
               <FileText className="w-3.5 h-3.5" />
               PDF
             </button>
           )}

          {canCreate && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              New Test
            </button>
          )}
        </div>
      </div>

      {/* Hospital Selector for Super Admin */}
      <HospitalSelector 
        userRole={userRole}
        selectedHospitalId={selectedHospitalId}
        onHospitalChange={setSelectedHospitalId}
      />

      {/* Lab Tests Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="overflow-x-auto rounded-t-lg" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          <table className="w-full text-left border-collapse relative">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
              <tr>
                <th onClick={() => handleSort('testNumber')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Test #
                    {renderSortIcon('testNumber')}
                  </div>
                </th>
                <th onClick={() => handleSort('patientName')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Patient
                    {renderSortIcon('patientName')}
                  </div>
                </th>
                <th onClick={() => handleSort('testName')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Tests Ordered
                    {renderSortIcon('testName')}
                  </div>
                </th>
                <th onClick={() => handleSort('doctorName')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Doctor
                    {renderSortIcon('doctorName')}
                  </div>
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Priority</th>
                <th onClick={() => handleSort('status')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    Status
                    {renderSortIcon('status')}
                  </div>
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredLabTests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                        <Beaker className="w-6 h-6 text-gray-400 opacity-50" />
                      </div>
                      <p className="text-sm font-medium">No lab tests found</p>
                      <p className="text-xs mt-1">Try adjusting your search terms</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLabTests.map((test) => (
                  <tr key={test.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                    <td className="px-4 py-2">
                      <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 font-mono">{test.testNumber}</span>
                    </td>
                    <td className="px-4 py-2">
                      <div>
                        <div className="text-xs font-semibold text-gray-900 dark:text-white">{test.patientName}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">{test.patientAge}Y • {test.patientGender}</div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div>
                        <div className="text-xs font-medium text-gray-900 dark:text-white">{test.testName}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">{test.testType}</div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-xs text-gray-900 dark:text-white">{test.doctorName}</div>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-[10px] uppercase tracking-wide ${getPriorityColor(test.priority)}`}>
                        {test.priority}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="relative">
                        <button
                          onClick={() => {
                            if (canChangeAnyStatus || (canProcess && test.status !== 'completed' && test.status !== 'cancelled')) {
                              setOpenStatusDropdown(openStatusDropdown === test.id ? null : test.id);
                            }
                          }}
                          disabled={!canChangeAnyStatus && (!canProcess || test.status === 'completed' || test.status === 'cancelled')}
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusColor(test.status)} ${
                            (canChangeAnyStatus || (canProcess && test.status !== 'completed' && test.status !== 'cancelled'))
                              ? 'cursor-pointer hover:opacity-80'
                              : 'cursor-default'
                          }`}
                        >
                          {test.status === 'pending' && <Clock className="w-3 h-3" />}
                          {test.status === 'in_progress' && <Beaker className="w-3 h-3" />}
                          {test.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                          {test.status === 'cancelled' && <XCircle className="w-3 h-3" />}
                          {test.status.replace('_', ' ')}
                        </button>
                        {openStatusDropdown === test.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-10" 
                              onClick={() => setOpenStatusDropdown(null)}
                            />
                            <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-1 z-20 min-w-[140px]">
                              {/* Dropdown options */}
                              {(test.status === 'completed' || test.status === 'cancelled') && canChangeAnyStatus && (
                                <button
                                  onClick={() => {
                                    handleStatusUpdate(test.id, 'pending');
                                    setOpenStatusDropdown(null);
                                  }}
                                  className="block w-full text-left px-2 py-1.5 text-[10px] text-yellow-600 dark:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
                                >
                                  Reset to Pending
                                </button>
                              )}
                              
                              {test.status === 'pending' && (
                                <button
                                  onClick={() => {
                                    handleStatusUpdate(test.id, 'in_progress', { 
                                      sampleCollectedAt: new Date(),
                                      assignedTo: currentUserId,
                                      assignedToName: 'Current Lab Tech'
                                    });
                                    setOpenStatusDropdown(null);
                                  }}
                                  className="block w-full text-left px-2 py-1.5 text-[10px] text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
                                >
                                  Start Processing
                                </button>
                              )}
                              
                              {test.status === 'in_progress' && (
                                <button
                                  onClick={() => {
                                    handleStatusUpdate(test.id, 'completed', { reportedAt: new Date() });
                                    setOpenStatusDropdown(null);
                                  }}
                                  className="block w-full text-left px-2 py-1.5 text-[10px] text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
                                >
                                  Mark Completed
                                </button>
                              )}
                              
                              {test.status !== 'cancelled' && (
                                <button
                                  onClick={() => {
                                    handleStatusUpdate(test.id, 'cancelled');
                                    setOpenStatusDropdown(null);
                                  }}
                                  className="block w-full text-left px-2 py-1.5 text-[10px] text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
                                >
                                  Cancel Test
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => { setSelectedTest(test); setShowViewModal(true); }}
                          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        
                        {canEnterResults && test.status === 'in_progress' && (
                          <button
                            onClick={() => { 
                              setSelectedTest(test); 
                              setResultFormData({
                                result: test.result || '',
                                remarks: test.remarks || '',
                                normalRange: '',
                                findings: ''
                              });
                              setShowResultModal(true); 
                            }}
                            className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-md transition-colors"
                            title="Submit Result"
                          >
                            <Beaker className="w-3.5 h-3.5" />
                          </button>
                        )}
                        
                        {canPrint && test.status === 'completed' && (
                          <button
                            onClick={() => { setSelectedTest(test); setShowPrintModal(true); }}
                            className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-md transition-colors"
                            title="Print Report"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        )}
                        
                        {canDelete && (
                          <button
                            onClick={() => { setSelectedTest(test); setShowDeleteModal(true); }}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer with totals */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 rounded-b-lg flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
          <span>Total Records: <span className="font-semibold text-gray-900 dark:text-white">{filteredLabTests.length}</span></span>
          <span>Showing {filteredLabTests.length} of {labTests.length} tests</span>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">New Lab Test</h2>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Patient Name</label>
                  <select
                    value={formData.patientId}
                    onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Patient</option>
                    {hospitalPatients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.age}Y, {p.gender})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Age</label>
                  <input
                    type="number"
                    value={formData.patientId ? hospitalPatients.find(p => p.id === formData.patientId)?.age : ''}
                    readOnly
                    className="w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Test Name</label>
                  <input
                    type="text"
                    value={formData.testName}
                    onChange={(e) => setFormData({ ...formData, testName: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. Complete Blood Count"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Test Type</label>
                  <select
                    value={formData.testType}
                    onChange={(e) => setFormData({ ...formData, testType: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Type</option>
                    <option value="Hematology">Hematology</option>
                    <option value="Biochemistry">Biochemistry</option>
                    <option value="Microbiology">Microbiology</option>
                    <option value="Clinical Pathology">Clinical Pathology</option>
                    <option value="Serology">Serology</option>
                    <option value="Radiology">Radiology</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Instructions</label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md text-xs focus:ring-1 focus:ring-blue-500 resize-none"
                  rows={2}
                  placeholder="e.g. Fasting for 12 hours"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Priority</label>
                <div className="flex gap-3">
                  {['normal', 'urgent', 'stat'].map((p) => (
                    <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="priority"
                        value={p}
                        checked={formData.priority === p}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                        className="text-blue-600 focus:ring-blue-500 h-3 w-3"
                      />
                      <span className="text-xs text-gray-700 dark:text-gray-300 capitalize">{p}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
                <button
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium text-xs shadow-sm"
                >
                  Create Test
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedTest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Beaker className="w-4 h-4 text-blue-600" />
                Test Details
              </h2>
              <button onClick={() => setShowViewModal(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Header Info */}
              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                <div>
                  <div className="text-lg font-bold text-blue-700 dark:text-blue-400">{selectedTest.testNumber}</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Test ID</div>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide border ${getStatusColor(selectedTest.status)}`}>
                  {selectedTest.status.replace('_', ' ')}
                </div>
              </div>

              {/* Patient & Test Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Patient</label>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">{selectedTest.patientName}</div>
                    <div className="text-xs text-gray-500">{selectedTest.patientAge} Years • {selectedTest.patientGender}</div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Doctor</label>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">{selectedTest.doctorName}</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Test Name</label>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">{selectedTest.testName}</div>
                    <div className="text-xs text-gray-500">{selectedTest.testType}</div>
                  </div>
                   <div>
                    <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Priority</label>
                    <div className={`font-bold text-sm uppercase ${getPriorityColor(selectedTest.priority)}`}>{selectedTest.priority}</div>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              {selectedTest.instructions && (
                <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Instructions</label>
                  <p className="text-xs text-gray-700 dark:text-gray-300 italic">{selectedTest.instructions}</p>
                </div>
              )}

              {/* Results if available */}
              {selectedTest.result && (
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-800">
                   <label className="block text-[10px] font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider mb-2">Test Results</label>
                   <div className="space-y-2">
                     <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-sans">{selectedTest.result}</pre>
                     {selectedTest.remarks && (
                       <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                         <span className="text-[10px] font-bold text-green-800 dark:text-green-300">Remarks: </span>
                         <span className="text-xs text-gray-700 dark:text-gray-300">{selectedTest.remarks}</span>
                       </div>
                     )}
                   </div>
                </div>
              )}

              {/* Close Button */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                 <button
                  onClick={() => setShowViewModal(false)}
                  className="w-full py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs shadow-sm"
                >
                  Close Detail View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result Entry Modal */}
      {showResultModal && selectedTest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Enter Test Results</h2>
              <button onClick={() => setShowResultModal(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-xs text-blue-700 dark:text-blue-300 mb-2">
                <span className="font-bold">Test:</span> {selectedTest.testName} <br/>
                <span className="font-bold">Patient:</span> {selectedTest.patientName}
              </div>
              
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Results</label>
                <textarea
                  value={resultFormData.result}
                  onChange={(e) => setResultFormData({ ...resultFormData, result: e.target.value })}
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md text-xs focus:ring-1 focus:ring-blue-500 min-h-[100px]"
                  placeholder="Enter test results (e.g. Value: 10 mg/dL)"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Remarks / Observations</label>
                <textarea
                  value={resultFormData.remarks}
                  onChange={(e) => setResultFormData({ ...resultFormData, remarks: e.target.value })}
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md text-xs focus:ring-1 focus:ring-blue-500 resize-none"
                  rows={2}
                  placeholder="Any specific observations..."
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowResultModal(false)}
                  className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResultSubmit}
                  className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium text-xs shadow-sm"
                >
                  Submit Results
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6 text-center border border-gray-200 dark:border-gray-700">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Lab Test</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete <strong>{selectedTest?.testNumber}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal Overlay */}
      {showPrintModal && selectedTest && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden relative">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
               <h2 className="text-lg font-bold text-gray-900">Print Preview</h2>
               <div className="flex gap-3">
                 <button 
                   onClick={() => window.print()}
                   className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm"
                 >
                   <Printer className="w-4 h-4" />
                   Print Report
                 </button>
                 <button 
                   onClick={() => setShowPrintModal(false)}
                   className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-medium text-sm"
                 >
                   <X className="w-4 h-4" />
                   Close
                 </button>
               </div>
            </div>
            <div className="flex-1 overflow-auto bg-gray-100 p-8">
               <LabReportPrint test={selectedTest} hospital={hospital} />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}