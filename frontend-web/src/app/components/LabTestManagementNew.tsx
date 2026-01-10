import React, { useState, useEffect } from 'react';
import { Beaker, Plus, X, Search, Clock, CheckCircle, XCircle, Trash2, FileText, Printer, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown, FileDown, CreditCard, Eye } from 'lucide-react';
import { Hospital, LabTest, UserRole } from '../types';
import { mockPatients, mockHospitals, mockDoctors } from '../data/mockData';
import { mockTestTemplates } from '../data/mockTestTemplates';
import { Toast } from './Toast';
import { LabReportPrintNew } from './LabReportPrintNew';
import { LabReportTemplate } from './LabReportTemplate';
import { LabInvoicePrint } from './LabInvoicePrint';
import { LabResultEntryNew } from './LabResultEntryNew';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { formatDate } from '../utils/date';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import autoTable from 'jspdf-autotable';

interface LabTestManagementNewProps {
  hospital: Hospital;
  userRole: UserRole;
  currentUserId?: string;
}

// Generate mock lab tests with new structure
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
    selectedTests: ['test-1'], // CBC
    testName: 'Complete Blood Count (CBC)',
    testType: 'Hematology',
    instructions: 'Fasting not required',
    status: 'unpaid',
    priority: 'normal',
    createdAt: new Date(new Date().setHours(new Date().getHours() - 2)), // 2 hours ago
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
    selectedTests: ['test-2'], // LFT
    testName: 'Liver Function Test (LFT)',
    testType: 'Clinical Chemistry',
    status: 'pending',
    priority: 'urgent',
    createdAt: new Date(new Date().setHours(new Date().getHours() - 4)), // 4 hours ago
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
    selectedTests: ['test-3'], // KFT
    testName: 'Kidney Function Test (KFT)',
    testType: 'Clinical Chemistry',
    status: 'in_progress',
    priority: 'normal',
    assignedTo: 'LT001',
    assignedToName: 'Lab Tech - Ali Hassan',
    sampleCollectedAt: new Date(new Date().setHours(new Date().getHours() - 1)),
    createdAt: new Date(new Date().setHours(new Date().getHours() - 5)),
    createdBy: 'doctor1'
  },
  {
    id: '4',
    hospitalId,
    testNumber: 'LAB-2026-00004',
    patientId: 'P00004',
    patientName: 'Zainab Bibi',
    patientAge: 52,
    patientGender: 'female',
    doctorId: 'D001',
    doctorName: 'Dr. Sarah Ahmed',
    selectedTests: ['test-5'], // Lipid
    testName: 'Lipid Profile',
    testType: 'Clinical Chemistry',
    status: 'completed',
    priority: 'normal',
    assignedTo: 'LT001',
    assignedToName: 'Lab Tech - Ali Hassan',
    sampleCollectedAt: new Date(new Date().setDate(new Date().getDate() - 1)),
    reportedAt: new Date(new Date().setHours(new Date().getHours() - 10)),
    testResults: [
      { testTemplateId: 'test-5', testName: 'Lipid Profile', parameterName: 'Total Cholesterol', unit: 'mg/dL', normalRange: '<200', result: '185', remarks: 'Desirable' },
      { testTemplateId: 'test-5', testName: 'Lipid Profile', parameterName: 'Triglycerides', unit: 'mg/dL', normalRange: '<150', result: '145', remarks: 'Normal' },
      { testTemplateId: 'test-5', testName: 'Lipid Profile', parameterName: 'HDL Cholesterol', unit: 'mg/dL', normalRange: '>40', result: '48', remarks: 'Good' },
      { testTemplateId: 'test-5', testName: 'Lipid Profile', parameterName: 'LDL Cholesterol', unit: 'mg/dL', normalRange: '<100', result: '110', remarks: 'Near Optimal' },
    ],
    remarks: 'Lipid profile is within normal limits.',
    createdAt: new Date(new Date().setDate(new Date().getDate() - 1)),
    createdBy: 'doctor1'
  }
];

export function LabTestManagementNew({ hospital, userRole, currentUserId }: LabTestManagementNewProps) {
  // Hospital filtering for super_admin with "All Hospitals" support
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  
  const [labTests, setLabTests] = useState<LabTest[]>(generateMockLabTests(currentHospital.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState<LabTest | null>(null);
  const [pdfTest, setPdfTest] = useState<LabTest | null>(null);
  const pdfContainerRef = React.useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'danger' } | null>(null);
  const [openStatusDropdown, setOpenStatusDropdown] = useState<string | null>(null);

  // Handle PDF Generation
  useEffect(() => {
    if (pdfTest && pdfContainerRef.current) {
      const generatePDF = async () => {
        try {
          // Wait for render
          await new Promise(resolve => setTimeout(resolve, 100));

          const element = pdfContainerRef.current!;
          const doc = new jsPDF({
            format: 'a4',
            unit: 'mm',
          });

          // Using html-to-image (toPng) instead of html2canvas
          // It's generally more robust with modern CSS
          const dataUrl = await toPng(element, { 
             backgroundColor: '#ffffff',
             quality: 1.0,
             pixelRatio: 2 // Higher quality
          });

          const imgWidth = 210; // A4 width in mm
          const pageHeight = 297; // A4 height in mm
          
          // Calculate height maintaining aspect ratio
          // We need to know original dimensions
          const originalWidth = element.offsetWidth;
          const originalHeight = element.offsetHeight;
          
          // Ratio of A4 width to element width
          const ratio = imgWidth / originalWidth;
          const imgHeight = originalHeight * ratio;
          
          let heightLeft = imgHeight;
          let position = 0;

          doc.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;

          while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            doc.addPage();
            doc.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
          }

          doc.save(`Lab_Report_${pdfTest.testNumber}.pdf`);
          setToast({ message: 'PDF downloaded successfully', type: 'success' });
        } catch (error) {
          console.error('PDF generation failed:', error);
          setToast({ message: 'Failed to generate PDF', type: 'danger' });
        } finally {
          setPdfTest(null);
        }
      };

      generatePDF();
    }
  }, [pdfTest]);

  // Sorting state
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Form state
  const [formData, setFormData] = useState({
    patientId: '',
    selectedTests: [] as string[],
    instructions: '',
    priority: 'normal' as 'normal' | 'urgent' | 'stat',
    hospitalId: currentHospital.id // Add hospital selection
  });

  // Result form state
  const [resultFormData, setResultFormData] = useState({
    remarks: '',
    results: [] as any[]
  });

  // Update lab tests when hospital changes
  useEffect(() => {
    if (isAllHospitals) {
      const allTests = mockHospitals.flatMap((h, hospitalIndex) => 
        generateMockLabTests(h.id).map((test, testIndex) => ({
          ...test,
          // Make IDs unique across hospitals by prefixing with hospital index
          id: `${hospitalIndex}-${test.id}`
        }))
      );
      setLabTests(allTests);
    } else {
      setLabTests(generateMockLabTests(currentHospital.id));
    }
  }, [currentHospital.id, isAllHospitals]);

  // Get hospital-specific data (or all if viewing all hospitals)
  const hospitalPatients = filterByHospital(mockPatients);
  const hospitalTests = isAllHospitals 
    ? mockTestTemplates.filter(t => t.hospitalId === 'h1' || mockHospitals.some(h => h.id === t.hospitalId))
    : mockTestTemplates.filter(t => t.hospitalId === currentHospital.id || t.hospitalId === 'h1');

  // Filter lab tests
  const getFilteredLabTests = () => {
    let filtered = labTests;
    
    if (userRole === 'doctor' && currentUserId) {
      filtered = filtered.filter(test => test.doctorId === currentUserId);
    }
    
    if (userRole === 'lab_technician') {
      filtered = filtered.filter(test => test.status !== 'unpaid');
    }
    
    if (searchTerm) {
      filtered = filtered.filter(test =>
        test.testNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        test.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        test.testName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered.sort((a, b) => {
      let aValue: any = a[sortField as keyof LabTest];
      let bValue: any = b[sortField as keyof LabTest];

      if (sortField === 'createdAt') {
        aValue = a.createdAt.getTime();
        bValue = b.createdAt.getTime();
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
    const workSheet = XLSX.utils.json_to_sheet(filteredLabTests.map(test => ({
      TestNumber: test.testNumber,
      Patient: test.patientName,
      TestsOrdered: test.testName,
      Doctor: test.doctorName,
      Priority: test.priority,
      Status: test.status,
      Date: formatDate(test.createdAt, currentHospital.timezone, currentHospital.calendarType),
      Hospital: mockHospitals.find(h => h.id === test.hospitalId)?.name || 'Unknown'
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
    doc.text(`Generated on: ${formatDate(new Date(), currentHospital.timezone, currentHospital.calendarType)}`, 14, 30);
    if (!isAllHospitals) {
      doc.text(`Hospital: ${currentHospital.name}`, 14, 36);
    }

    autoTable(doc, {
      head: [['Test #', 'Patient', 'Tests Ordered', 'Doctor', 'Priority', 'Status']],
      body: filteredLabTests.map(test => [
        test.testNumber,
        test.patientName,
        test.testName,
        test.doctorName,
        test.priority,
        test.status
      ]),
      startY: isAllHospitals ? 40 : 46,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [66, 139, 202] }
    });

    doc.save('LabTests_Report.pdf');
  };

  const handleAdd = () => {
    if (!formData.patientId || formData.selectedTests.length === 0) {
      setToast({ message: 'Please select patient and at least one test.', type: 'warning' });
      return;
    }

    const selectedTemplates = hospitalTests.filter(t => formData.selectedTests.includes(t.id));
    const testNames = selectedTemplates.map(t => t.testName).join(', ');
    const testTypes = [...new Set(selectedTemplates.map(t => t.testType))].join(', ');

    const newTest: LabTest = {
      id: Date.now().toString(),
      hospitalId: formData.hospitalId, // Use selected hospital from form
      testNumber: `LAB-${new Date().getFullYear()}-${String(labTests.length + 1).padStart(5, '0')}`,
      patientId: formData.patientId,
      patientName: hospitalPatients.find(p => p.id === formData.patientId)?.name || 'Unknown',
      patientAge: hospitalPatients.find(p => p.id === formData.patientId)?.age || 0,
      patientGender: hospitalPatients.find(p => p.id === formData.patientId)?.gender || 'male',
      doctorId: currentUserId || 'D001',
      doctorName: 'Dr. Current User',
      selectedTests: formData.selectedTests,
      testName: testNames,
      testType: testTypes,
      instructions: formData.instructions,
      status: 'unpaid',
      priority: formData.priority,
      createdAt: new Date(),
      createdBy: currentUserId || 'doctor1'
    };
    
    setLabTests([newTest, ...labTests]);
    setShowAddModal(false);
    resetForm();
    setToast({ message: 'Lab test order created successfully!', type: 'success' });
  };

  const handleStatusUpdate = (testId: string, newStatus: LabTest['status'], additionalData?: Partial<LabTest>) => {
    setLabTests(labTests.map(test =>
      test.id === testId ? { ...test, status: newStatus, ...additionalData } : test
    ));
    setToast({ message: `Test status updated to ${newStatus}.`, type: 'success' });
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
      selectedTests: [],
      instructions: '',
      priority: 'normal',
      hospitalId: currentHospital.id // Reset hospital selection
    });
  };

  const toggleTestSelection = (testId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedTests: prev.selectedTests.includes(testId)
        ? prev.selectedTests.filter(id => id !== testId)
        : [...prev.selectedTests, testId]
    }));
  };

  const getStatusColor = (status: LabTest['status']) => {
    const colors = {
      unpaid: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
      pending: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
      in_progress: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      completed: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
      cancelled: 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800'
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

  const canCreate = ['doctor', 'admin', 'super_admin'].includes(userRole);
  const canProcess = ['lab_technician', 'super_admin', 'admin'].includes(userRole);
  const canPayment = ['receptionist', 'super_admin', 'admin'].includes(userRole);
  const canDelete = ['super_admin', 'admin', 'doctor'].includes(userRole);
  const canChangeAnyStatus = ['super_admin', 'admin'].includes(userRole);

  const handlePayAndPrint = (test: LabTest) => {
    setSelectedTest(test);
    setShowInvoiceModal(true);
  };

  const confirmPayment = () => {
    if (!selectedTest) return;
    
    // Update status to pending (Paid)
    handleStatusUpdate(selectedTest.id, 'pending');
    // Update selected test to reflect change in modal
    setSelectedTest({ ...selectedTest, status: 'pending' });
    
    setToast({ message: 'Payment collected. Printing receipt...', type: 'success' });
    
    // Print after render update
    setTimeout(() => {
      window.print();
    }, 500);
  };

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

           <button
             onClick={exportToExcel}
             className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs font-medium shadow-sm"
             title="Export to Excel"
           >
             <FileSpreadsheet className="w-3.5 h-3.5" />
             Excel
           </button>
           <button
             onClick={exportToPDF}
             className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs font-medium shadow-sm"
             title="Export to PDF"
           >
             <FileText className="w-3.5 h-3.5" />
             PDF
           </button>

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
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">{test.selectedTests?.length || 0} test(s)</div>
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
                            if (
                              canChangeAnyStatus || 
                              (canProcess && test.status !== 'completed' && test.status !== 'cancelled') ||
                              (canPayment && test.status === 'unpaid')
                            ) {
                              setOpenStatusDropdown(openStatusDropdown === test.id ? null : test.id);
                            }
                          }}
                          disabled={
                            !canChangeAnyStatus && 
                            !(canProcess && test.status !== 'completed' && test.status !== 'cancelled') &&
                            !(canPayment && test.status === 'unpaid')
                          }
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusColor(test.status)} ${
                            (
                              canChangeAnyStatus || 
                              (canProcess && test.status !== 'completed' && test.status !== 'cancelled') ||
                              (canPayment && test.status === 'unpaid')
                            )
                              ? 'cursor-pointer hover:opacity-80'
                              : 'cursor-default'
                          }`}
                        >
                          {test.status === 'unpaid' && <CreditCard className="w-3 h-3" />}
                          {test.status === 'pending' && <Clock className="w-3 h-3" />}
                          {test.status === 'in_progress' && <Beaker className="w-3 h-3" />}
                          {test.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                          {test.status === 'cancelled' && <XCircle className="w-3 h-3" />}
                          {test.status === 'unpaid' ? 'Unpaid' : test.status.replace('_', ' ')}
                        </button>
                        {openStatusDropdown === test.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-10" 
                              onClick={() => setOpenStatusDropdown(null)}
                            />
                            <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-1 z-20 min-w-[140px]">
                              {test.status === 'unpaid' && canPayment && (
                                <button
                                  onClick={() => {
                                    handlePayAndPrint(test);
                                    setOpenStatusDropdown(null);
                                  }}
                                  className="block w-full text-left px-2 py-1.5 text-[10px] text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
                                >
                                  Pay & Print Invoice
                                </button>
                              )}

                              {/* Admin only: Reset to Unpaid (e.g. refund/error) */}
                              {test.status !== 'unpaid' && canChangeAnyStatus && (
                                <button
                                  onClick={() => {
                                    handleStatusUpdate(test.id, 'unpaid');
                                    setOpenStatusDropdown(null);
                                  }}
                                  className="block w-full text-left px-2 py-1.5 text-[10px] text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-700"
                                >
                                  Reset to Unpaid (Admin)
                                </button>
                              )}

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
                                    // Normally handled by result entry, but allow quick complete
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
                        
                        {canPayment && test.status === 'unpaid' && (
                          <button
                            onClick={() => handlePayAndPrint(test)}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                            title="Pay & Print Invoice"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                        
                        {canProcess && test.status === 'in_progress' && (
                          <button
                            onClick={() => { 
                              setSelectedTest(test); 
                              setShowResultModal(true); 
                            }}
                            className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-md transition-colors"
                            title="Submit Result"
                          >
                            <Beaker className="w-3.5 h-3.5" />
                          </button>
                        )}
                        
                        {test.status === 'completed' && (
                          <button
                            onClick={() => { setSelectedTest(test); setShowPrintModal(true); }}
                            className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-md transition-colors"
                            title="Print Report"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                        
                        {test.status === 'completed' && (
                          <button
                            onClick={() => setPdfTest(test)}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                            title="Download PDF"
                          >
                            <FileDown className="w-3.5 h-3.5" />
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

      {/* Hidden PDF Container */}
      {pdfTest && (
        <div style={{ position: 'absolute', top: -9999, left: -9999, width: '210mm' }}>
          <div ref={pdfContainerRef}>
            <LabReportTemplate test={pdfTest} hospital={currentHospital} />
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg sticky top-0 z-10">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">New Lab Test Order</h2>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {/* Hospital Selection for Super Admin */}
              {userRole === 'super_admin' && (
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                    Hospital <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.hospitalId}
                    onChange={(e) => setFormData({ ...formData, hospitalId: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  >
                    {mockHospitals.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Patient Selection */}
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Patient <span className="text-red-500">*</span></label>
                <select
                  value={formData.patientId}
                  onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                >
                  <option value="">Select Patient</option>
                  {hospitalPatients.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.age}Y, {p.gender})</option>
                  ))}
                </select>
              </div>

              {/* Test Selection */}
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                  Select Tests <span className="text-red-500">*</span> (Select one or more)
                </label>
                <div className="border border-gray-300 dark:border-gray-600 rounded p-2 max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-700/30">
                  {hospitalTests.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">No tests available</p>
                  ) : (
                    hospitalTests.map(test => (
                      <label
                        key={test.id}
                        className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-colors ${
                          formData.selectedTests.includes(test.id)
                            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                            : 'hover:bg-white dark:hover:bg-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.selectedTests.includes(test.id)}
                          onChange={() => toggleTestSelection(test.id)}
                          className="mt-0.5 text-blue-600 focus:ring-blue-500 h-3 w-3 rounded border-gray-300 dark:border-gray-500"
                        />
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <span className="text-xs font-medium text-gray-900 dark:text-white">{test.testName}</span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">{test.testType}</span>
                          </div>
                          <div className="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5">
                            ₹{test.price} • {test.duration}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Instructions</label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded text-xs focus:ring-1 focus:ring-blue-500 resize-none"
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
                  className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-xs shadow-sm"
                >
                  Create Order
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
                    <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tests Ordered</label>
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
              {selectedTest.testResults && selectedTest.testResults.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-800">
                   <label className="block text-[10px] font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider mb-2">Test Results</label>
                   <div className="space-y-2">
                     {selectedTest.testResults.map((res, idx) => (
                       <div key={idx} className="text-xs text-gray-800 dark:text-gray-200">
                         <span className="font-bold">{res.testName} ({res.parameterName}):</span> {res.result} {res.unit}
                       </div>
                     ))}
                     {selectedTest.remarks && (
                       <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                         <span className="text-[10px] font-bold text-green-800 dark:text-green-300">Remarks: </span>
                         <span className="text-xs text-gray-700 dark:text-gray-300">{selectedTest.remarks}</span>
                       </div>
                     )}
                   </div>
                </div>
              )}

              {/* Audit Information */}
              <div className="bg-white dark:bg-gray-700/30 rounded-lg p-3 border border-gray-200 dark:border-gray-600 shadow-sm">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2 border-b border-gray-100 dark:border-gray-600 pb-1.5">
                  System Information
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created By</label>
                    <p className="text-xs text-gray-900 dark:text-white font-medium">{selectedTest.createdBy || '-'}</p>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created At</label>
                    <p className="text-xs text-gray-900 dark:text-white font-medium">
                      {selectedTest.createdAt ? formatDate(selectedTest.createdAt, currentHospital.timezone, currentHospital.calendarType) : '-'}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Updated By</label>
                    <p className="text-xs text-gray-900 dark:text-white font-medium">{selectedTest.updatedBy || '-'}</p>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Updated At</label>
                    <p className="text-xs text-gray-900 dark:text-white font-medium">
                      {selectedTest.updatedAt ? formatDate(selectedTest.updatedAt, currentHospital.timezone, currentHospital.calendarType) : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                 <button
                  onClick={() => setShowViewModal(false)}
                  className="w-full py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs shadow-sm"
                >
                  Close Detail View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result Entry Modal - Using LabResultEntryNew component */}
      {showResultModal && selectedTest && (
        <LabResultEntryNew
          test={selectedTest}
          onClose={() => setShowResultModal(false)}
          onSave={() => {
            setShowResultModal(false);
            setToast({ message: 'Results saved successfully', type: 'success' });
            // Refresh test list logic would go here
            handleStatusUpdate(selectedTest.id, 'completed'); // Auto-complete for now
          }}
        />
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && selectedTest && (
        <LabInvoicePrint
          hospital={currentHospital}
          patient={mockPatients.find(p => p.id === selectedTest.patientId)}
          doctor={mockDoctors.find(d => d.id === selectedTest.doctorId)}
          labTest={selectedTest}
          testTemplates={mockTestTemplates}
          onClose={() => setShowInvoiceModal(false)}
          onPrint={confirmPayment}
        />
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
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium shadow-sm"
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
               <LabReportPrintNew 
                 test={selectedTest} 
                 hospital={hospital} 
                 onClose={() => setShowPrintModal(false)}
               />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}