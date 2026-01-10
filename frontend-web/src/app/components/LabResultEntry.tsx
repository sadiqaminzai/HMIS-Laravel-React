import React, { useState } from 'react';
import { FileText, X, Search, Clock, AlertTriangle, User, Calendar, Beaker, Stethoscope, CheckCircle2, Plus, Trash2, Printer, Eye } from 'lucide-react';
import { Hospital, LabTest, UserRole } from '../types';
import { Toast } from './Toast';

interface LabResultEntryProps {
  hospital: Hospital;
  userRole: UserRole;
  currentUserId?: string;
}

interface TestParameter {
  id: string;
  testName: string;
  normalRange: string;
  result: string;
  remarks: string;
}

// Common test parameter templates
const testParameterTemplates: Record<string, TestParameter[]> = {
  'Complete Blood Count (CBC)': [
    { id: '1', testName: 'WBC (White Blood Cells)', normalRange: '4.0-11.0 x10³/μL', result: '', remarks: '' },
    { id: '2', testName: 'RBC (Red Blood Cells)', normalRange: '4.5-5.5 x10⁶/μL', result: '', remarks: '' },
    { id: '3', testName: 'Hemoglobin', normalRange: '13.5-17.5 g/dL', result: '', remarks: '' },
    { id: '4', testName: 'Hematocrit', normalRange: '38-50%', result: '', remarks: '' },
    { id: '5', testName: 'Platelets', normalRange: '150-400 x10³/μL', result: '', remarks: '' },
    { id: '6', testName: 'MCV (Mean Corpuscular Volume)', normalRange: '80-100 fL', result: '', remarks: '' },
  ],
  'Liver Function Test': [
    { id: '1', testName: 'ALT (Alanine Aminotransferase)', normalRange: '7-56 U/L', result: '', remarks: '' },
    { id: '2', testName: 'AST (Aspartate Aminotransferase)', normalRange: '10-40 U/L', result: '', remarks: '' },
    { id: '3', testName: 'ALP (Alkaline Phosphatase)', normalRange: '44-147 U/L', result: '', remarks: '' },
    { id: '4', testName: 'Total Bilirubin', normalRange: '0.3-1.2 mg/dL', result: '', remarks: '' },
    { id: '5', testName: 'Direct Bilirubin', normalRange: '0.0-0.3 mg/dL', result: '', remarks: '' },
    { id: '6', testName: 'Total Protein', normalRange: '6.0-8.3 g/dL', result: '', remarks: '' },
    { id: '7', testName: 'Albumin', normalRange: '3.5-5.5 g/dL', result: '', remarks: '' },
  ],
  'Blood Glucose': [
    { id: '1', testName: 'Fasting Blood Sugar', normalRange: '70-100 mg/dL', result: '', remarks: '' },
    { id: '2', testName: 'Random Blood Sugar', normalRange: '<140 mg/dL', result: '', remarks: '' },
  ],
  'Lipid Profile': [
    { id: '1', testName: 'Total Cholesterol', normalRange: '<200 mg/dL', result: '', remarks: '' },
    { id: '2', testName: 'LDL (Bad Cholesterol)', normalRange: '<100 mg/dL', result: '', remarks: '' },
    { id: '3', testName: 'HDL (Good Cholesterol)', normalRange: '>40 mg/dL', result: '', remarks: '' },
    { id: '4', testName: 'Triglycerides', normalRange: '<150 mg/dL', result: '', remarks: '' },
  ],
  'Thyroid Function Test': [
    { id: '1', testName: 'TSH (Thyroid Stimulating Hormone)', normalRange: '0.4-4.0 mIU/L', result: '', remarks: '' },
    { id: '2', testName: 'T3 (Triiodothyronine)', normalRange: '80-200 ng/dL', result: '', remarks: '' },
    { id: '3', testName: 'T4 (Thyroxine)', normalRange: '4.5-12.0 μg/dL', result: '', remarks: '' },
  ],
  'Urine Analysis': [
    { id: '1', testName: 'Color', normalRange: 'Pale to dark yellow', result: '', remarks: '' },
    { id: '2', testName: 'Appearance', normalRange: 'Clear', result: '', remarks: '' },
    { id: '3', testName: 'pH', normalRange: '4.5-8.0', result: '', remarks: '' },
    { id: '4', testName: 'Specific Gravity', normalRange: '1.005-1.030', result: '', remarks: '' },
    { id: '5', testName: 'Protein', normalRange: 'Negative', result: '', remarks: '' },
    { id: '6', testName: 'Glucose', normalRange: 'Negative', result: '', remarks: '' },
    { id: '7', testName: 'WBC', normalRange: '0-5 /HPF', result: '', remarks: '' },
    { id: '8', testName: 'RBC', normalRange: '0-2 /HPF', result: '', remarks: '' },
  ],
};

// Mock lab tests data - in production, this would come from API
const generateMockLabTests = (hospitalId: string, assignedTo: string): LabTest[] => [
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
    assignedTo: assignedTo,
    assignedToName: 'Current Lab Technician',
    sampleCollectedAt: new Date(),
    createdAt: new Date(),
    createdBy: 'doctor2'
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
    assignedTo: assignedTo,
    assignedToName: 'Current Lab Technician',
    sampleCollectedAt: new Date(),
    createdAt: new Date(),
    createdBy: 'doctor1'
  },
  {
    id: '7',
    hospitalId,
    testNumber: 'LAB-2026-00007',
    patientId: 'P00003',
    patientName: 'Omar Hassan',
    patientAge: 45,
    patientGender: 'male',
    doctorId: 'D001',
    doctorName: 'Dr. Sarah Ahmed',
    testName: 'Complete Blood Count (CBC)',
    testType: 'Hematology',
    status: 'in_progress',
    priority: 'stat',
    assignedTo: assignedTo,
    assignedToName: 'Current Lab Technician',
    sampleCollectedAt: new Date(),
    createdAt: new Date(),
    createdBy: 'doctor1'
  }
];

export function LabResultEntry({ hospital, userRole, currentUserId }: LabResultEntryProps) {
  const [labTests, setLabTests] = useState<LabTest[]>(generateMockLabTests(hospital.id, currentUserId || 'LT001'));
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTest, setSelectedTest] = useState<LabTest | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [completedTest, setCompletedTest] = useState<LabTest | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'danger' } | null>(null);

  // Result form state - array of test parameters
  const [testParameters, setTestParameters] = useState<TestParameter[]>([]);
  const [generalRemarks, setGeneralRemarks] = useState('');

  // Filter tests assigned to current user and in_progress status
  const getFilteredLabTests = () => {
    let filtered = labTests.filter(test => 
      test.status === 'in_progress' && 
      test.assignedTo === currentUserId
    );
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(test =>
        test.testNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        test.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        test.testName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered.sort((a, b) => {
      // Sort by priority: stat > urgent > normal
      const priorityOrder = { stat: 0, urgent: 1, normal: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  };

  const filteredLabTests = getFilteredLabTests();

  const handleOpenModal = (test: LabTest) => {
    setSelectedTest(test);
    
    // Load template based on test name
    const template = testParameterTemplates[test.testName];
    if (template) {
      setTestParameters(JSON.parse(JSON.stringify(template))); // Deep copy
    } else {
      // Default single parameter
      setTestParameters([
        { id: '1', testName: test.testName, normalRange: '', result: '', remarks: '' }
      ]);
    }
    
    setGeneralRemarks('');
    setShowResultModal(true);
  };

  const handleAddParameter = () => {
    const newId = (Math.max(0, ...testParameters.map(p => parseInt(p.id))) + 1).toString();
    setTestParameters([
      ...testParameters,
      { id: newId, testName: '', normalRange: '', result: '', remarks: '' }
    ]);
  };

  const handleRemoveParameter = (id: string) => {
    if (testParameters.length > 1) {
      setTestParameters(testParameters.filter(p => p.id !== id));
    }
  };

  const handleUpdateParameter = (id: string, field: keyof TestParameter, value: string) => {
    setTestParameters(testParameters.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const handleSubmitResult = () => {
    if (!selectedTest) return;
    
    // Validate at least one parameter has a result
    const hasResults = testParameters.some(p => p.result.trim());
    if (!hasResults) {
      setToast({ message: 'Please enter at least one test result.', type: 'warning' });
      return;
    }

    // Format results as structured data
    const formattedResults = testParameters
      .filter(p => p.result.trim())
      .map(p => {
        let line = `${p.testName}: ${p.result}`;
        if (p.normalRange) line += ` (Normal: ${p.normalRange})`;
        if (p.remarks) line += ` - ${p.remarks}`;
        return line;
      })
      .join('\n');

    // Update test status to completed
    setLabTests(labTests.map(test =>
      test.id === selectedTest.id ? {
        ...test,
        status: 'completed',
        result: formattedResults,
        remarks: generalRemarks,
        reportedAt: new Date()
      } : test
    ));

    setCompletedTest(selectedTest);
    setShowResultModal(false);
    setSelectedTest(null);
    setTestParameters([]);
    setGeneralRemarks('');
    setToast({ message: 'Lab test results submitted successfully!', type: 'success' });
    setShowSuccessModal(true);
  };

  const getPriorityColor = (priority: LabTest['priority']) => {
    const colors = {
      normal: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700',
      urgent: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30',
      stat: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
    };
    return colors[priority];
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Enter Lab Results</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Submit results for assigned tests</p>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <div className="relative max-w-md">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tests..."
            className="w-full px-3 py-1.5 pl-8 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
        </div>
      </div>

      {/* Tests List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-900 dark:text-white">Test #</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-900 dark:text-white">Patient</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-900 dark:text-white">Test Name</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-900 dark:text-white">Doctor</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-900 dark:text-white">Priority</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-900 dark:text-white">Sample Time</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-900 dark:text-white">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLabTests.map((test) => (
                <tr key={test.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="py-2 px-3">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{test.testNumber}</span>
                  </td>
                  <td className="py-2 px-3">
                    <div>
                      <div className="text-xs font-medium text-gray-900 dark:text-white">{test.patientName}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">{test.patientAge}Y • {test.patientGender}</div>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div>
                      <div className="text-xs font-medium text-gray-900 dark:text-white">{test.testName}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">{test.testType}</div>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="text-xs text-gray-900 dark:text-white">{test.doctorName}</div>
                  </td>
                  <td className="py-2 px-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium uppercase ${getPriorityColor(test.priority)}`}>
                      {test.priority === 'stat' && <AlertTriangle className="w-3 h-3 mr-1" />}
                      {test.priority}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                      <Clock className="w-3 h-3" />
                      {test.sampleCollectedAt?.toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={() => handleOpenModal(test)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 text-xs ml-auto"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Enter Result
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLabTests.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">No pending tests to process.</p>
            <p className="text-xs mt-1">Tests assigned to you will appear here.</p>
          </div>
        )}
      </div>

      {/* Professional Result Submission Modal */}
      {showResultModal && selectedTest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            {/* Modal Header with Gradient */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                  <Beaker className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Lab Result Entry</h2>
                  <p className="text-xs text-blue-100 mt-0.5">Submit test results and complete analysis</p>
                </div>
              </div>
              <button 
                onClick={() => setShowResultModal(false)} 
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-6 space-y-5">
              {/* Test Information Card */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Test Number
                    </div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{selectedTest.testNumber}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1.5">
                      <User className="w-3.5 h-3.5" />
                      Patient
                    </div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{selectedTest.patientName}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      {selectedTest.patientAge}Y • {selectedTest.patientGender === 'male' ? 'Male' : 'Female'}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1.5">
                      <Stethoscope className="w-3.5 h-3.5" />
                      Requested By
                    </div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{selectedTest.doctorName}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Sample Time
                    </div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {selectedTest.sampleCollectedAt?.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Test Type</div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{selectedTest.testName}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{selectedTest.testType}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Priority Level</div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium uppercase ${getPriorityColor(selectedTest.priority)}`}>
                        {selectedTest.priority === 'stat' && <AlertTriangle className="w-3 h-3 mr-1" />}
                        {selectedTest.priority}
                      </span>
                    </div>
                  </div>
                  {selectedTest.instructions && (
                    <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Special Instructions</div>
                      <div className="text-sm text-gray-900 dark:text-white font-medium bg-white dark:bg-gray-800/50 px-3 py-2 rounded-lg">
                        {selectedTest.instructions}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Test Parameters Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white">
                    <span className="flex items-center gap-2">
                      <Beaker className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Test Parameters
                      <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <button
                    onClick={handleAddParameter}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Parameter
                  </button>
                </div>

                <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600">
                            Test Name <span className="text-red-500">*</span>
                          </th>
                          <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600">
                            Normal Range
                          </th>
                          <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600">
                            Result <span className="text-red-500">*</span>
                          </th>
                          <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600">
                            Remarks
                          </th>
                          <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 w-16">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {testParameters.map((param, index) => (
                          <tr key={param.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={param.testName}
                                onChange={(e) => handleUpdateParameter(param.id, 'testName', e.target.value)}
                                placeholder="e.g., WBC, Hemoglobin"
                                className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={param.normalRange}
                                onChange={(e) => handleUpdateParameter(param.id, 'normalRange', e.target.value)}
                                placeholder="e.g., 4.0-11.0 x10³/μL"
                                className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={param.result}
                                onChange={(e) => handleUpdateParameter(param.id, 'result', e.target.value)}
                                placeholder="Enter result value"
                                className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={param.remarks}
                                onChange={(e) => handleUpdateParameter(param.id, 'remarks', e.target.value)}
                                placeholder="Optional notes"
                                className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                onClick={() => handleRemoveParameter(param.id)}
                                disabled={testParameters.length === 1}
                                className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Remove parameter"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  💡 Tip: Click "Add Parameter" to include additional test values. Pre-filled values are common ranges.
                </p>
              </div>

              {/* General Lab Technician Remarks */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    Overall Lab Technician Remarks
                    <span className="text-xs text-gray-500 font-normal">(Optional)</span>
                  </span>
                </label>
                <textarea
                  value={generalRemarks}
                  onChange={(e) => setGeneralRemarks(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                  placeholder="Add any general observations, quality control notes, or recommendations..."
                />
              </div>
            </div>

            {/* Modal Footer with Actions */}
            <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-6 py-4 flex items-center justify-between gap-3">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <span className="font-medium">Note:</span> Results will be marked as completed and sent to the requesting doctor
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResultModal(false)}
                  className="px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitResult}
                  className="px-5 py-2.5 text-sm bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Submit Results & Complete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && completedTest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal Header with Gradient */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 dark:from-green-700 dark:to-green-800 p-5 text-center">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-white">Test Completed Successfully!</h2>
              <p className="text-sm text-green-100 mt-1">Results have been submitted and test is marked as completed</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Test Information */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Test Completed</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{completedTest.testNumber}</div>
                <div className="text-sm text-gray-900 dark:text-white mt-1">{completedTest.testName}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Patient: {completedTest.patientName}
                </div>
              </div>

              <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
                The test has been removed from your pending tests list and the doctor has been notified of the results.
              </div>
            </div>

            {/* Modal Footer with Actions */}
            <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-6 py-4 flex gap-3">
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setToast({ message: 'Print functionality will redirect to Lab Tests page in production.', type: 'success' });
                }}
                className="flex-1 px-4 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                View & Print Report
              </button>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="flex-1 px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}