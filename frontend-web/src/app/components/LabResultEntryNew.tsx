import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { LabTest, TestTemplate, TestResult } from '../types';

interface LabResultEntryNewProps {
  test: LabTest;
  testTemplates: TestTemplate[];
  onClose: () => void;
  onSubmit: (results: TestResult[], remarks: string) => void;
}

export function LabResultEntryNew({ test, testTemplates, onClose, onSubmit }: LabResultEntryNewProps) {
  const [results, setResults] = useState<TestResult[]>([]);
  const [remarks, setRemarks] = useState('');

  // Initialize results from selected tests
  useEffect(() => {
    const initialResults: TestResult[] = [];
    
    test.selectedTests?.forEach(testId => {
      const template = testTemplates.find(t => t.id === testId);
      const orderItem = test.orderItems?.find(item => String(item.testTemplateId) === String(testId));
      const sourceParams = (template?.parameters && template.parameters.length > 0)
        ? template.parameters
        : (orderItem?.parameters || orderItem?.results || []);

      sourceParams.forEach((param, idx) => {
        const paramName = (param as any).parameterName || (param as any).name || '';
        const existingResult = test.testResults?.find(
          r => r.testTemplateId === testId && r.parameterName?.toLowerCase() === paramName.toLowerCase()
        );
        const paramUnit = (param as any).unit || '';
        const paramRange = (param as any).normalRange || '';
        const paramResultId = existingResult?.resultId
          || orderItem?.parameters?.find(p => p.parameterName?.toLowerCase() === paramName.toLowerCase())?.resultId
          || orderItem?.results?.find(p => p.parameterName?.toLowerCase() === paramName.toLowerCase())?.id
          || orderItem?.parameters?.[idx]?.resultId
          || orderItem?.results?.[idx]?.id;

        initialResults.push({
          testTemplateId: testId,
          testName: template?.testName || orderItem?.testTemplateId || '',
          resultId: paramResultId,
          labOrderItemId: orderItem?.id,
          parameterName: paramName,
          unit: paramUnit,
          normalRange: paramRange,
          result: existingResult?.result || '',
          remarks: existingResult?.remarks || ''
        });
      });
    });
    
    setResults(initialResults);
    setRemarks(test.remarks || '');
  }, [test, testTemplates]);

  const handleResultChange = (index: number, field: 'result' | 'remarks', value: string) => {
    setResults(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = () => {
    // Validate that at least some results are filled
    const filledResults = results.filter(r => r.result.trim() !== '');
    if (filledResults.length === 0) {
      alert('Please enter at least one test result.');
      return;
    }
    
    onSubmit(results, remarks);
  };

  // Group results by test
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.testName]) {
      acc[result.testName] = [];
    }
    acc[result.testName].push(result);
    return acc;
  }, {} as Record<string, TestResult[]>);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Lab Result Entry</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              {test.testNumber} • {test.patientName} ({test.patientAge}Y, {test.patientGender})
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-4">
            {Object.entries(groupedResults).map(([testName, testResults]) => (
              <div key={testName} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {/* Test Name Header */}
                <div className="bg-blue-50 dark:bg-blue-900/20 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-xs font-semibold text-gray-900 dark:text-white">{testName}</h3>
                </div>

                {/* Parameters Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-900 dark:text-white w-[25%]">Parameter</th>
                        <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-900 dark:text-white w-[10%]">Unit</th>
                        <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-900 dark:text-white w-[20%]">Normal Range</th>
                        <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-900 dark:text-white w-[15%]">Result *</th>
                        <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-900 dark:text-white w-[30%]">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testResults.map((result, idx) => {
                        const globalIndex = results.findIndex(
                          r => r.testTemplateId === result.testTemplateId && r.parameterName === result.parameterName
                        );
                        return (
                          <tr key={idx} className="border-t border-gray-200 dark:border-gray-700">
                            <td className="py-1.5 px-2 text-xs text-gray-900 dark:text-white font-medium">
                              {result.parameterName}
                            </td>
                            <td className="py-1.5 px-2 text-xs text-gray-600 dark:text-gray-400">
                              {result.unit}
                            </td>
                            <td className="py-1.5 px-2 text-xs text-gray-600 dark:text-gray-400">
                              {result.normalRange}
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                value={result.result}
                                onChange={(e) => handleResultChange(globalIndex, 'result', e.target.value)}
                                placeholder="Enter value"
                                className="w-full px-2 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                value={result.remarks || ''}
                                onChange={(e) => handleResultChange(globalIndex, 'remarks', e.target.value)}
                                placeholder="Optional remarks"
                                className="w-full px-2 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* Overall Remarks */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Overall Lab Technician Remarks
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Enter overall remarks, observations, or recommendations..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            Submit Results & Complete Test
          </button>
        </div>
      </div>
    </div>
  );
}
