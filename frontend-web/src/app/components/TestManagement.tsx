import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, ArrowUp, ArrowDown, ArrowUpDown, FileSpreadsheet, FileText, Loader2, Eye, X } from 'lucide-react';
import { TestTemplate, TestParameter, Hospital, UserRole } from '../types';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { useHospitals } from '../context/HospitalContext';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  fetchTestTemplates,
  createTestTemplate,
  updateTestTemplate,
  deleteTestTemplate,
} from '../../api/testTemplates';

interface TestManagementProps {
  hospital: Hospital;
  userRole?: UserRole;
}

export function TestManagement({ hospital, userRole = 'admin' }: TestManagementProps) {
  // Hospital filtering for super_admin with "All Hospitals" support
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  const { hospitals } = useHospitals();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_test_templates');
  
  const { t, i18n } = useTranslation();
  const [tests, setTests] = useState<TestTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedTest, setSelectedTest] = useState<TestTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<string>('testName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Load tests from API
  const loadTests = useCallback(async () => {
    setIsLoading(true);
    try {
      const hospitalFilter = isAllHospitals ? undefined : selectedHospitalId;
      const result = await fetchTestTemplates(hospitalFilter, searchTerm || undefined);
      setTests(result.data);
    } catch (error) {
      console.error('Failed to load tests:', error);
      toast.error(i18n.language === 'en' ? 'Failed to load tests' : 'خطا در بارگذاری آزمایشات');
    } finally {
      setIsLoading(false);
    }
  }, [selectedHospitalId, isAllHospitals, searchTerm, i18n.language]);

  // Fetch tests when hospital or search changes
  useEffect(() => {
    loadTests();
  }, [loadTests]);

  // Form state
  const [formData, setFormData] = useState({
    testCode: '',
    testName: '',
    testType: '',
    sampleType: '',
    price: '',
    status: 'active' as 'active' | 'inactive',
    hospitalId: currentHospital.id // Add hospital selection
  });

  const [parameters, setParameters] = useState<TestParameter[]>([
    { parameterName: '', unit: '', normalRange: '', description: '' }
  ]);

  const resetForm = () => {
    setFormData({
      testCode: '',
      testName: '',
      testType: '',
      sampleType: '',
      price: '',
      status: 'active',
      hospitalId: currentHospital.id // Add hospital selection
    });
    setParameters([{ parameterName: '', unit: '', normalRange: '', description: '' }]);
  };

  const handleAddTest = () => {
    setModalMode('add');
    resetForm();
    setIsModalOpen(true);
  };

  const handleViewTest = (test: TestTemplate) => {
    setSelectedTest(test);
    setIsViewModalOpen(true);
  };

  const handleEditTest = (test: TestTemplate) => {
    setModalMode('edit');
    setSelectedTest(test);
    setFormData({
      testCode: test.testCode,
      testName: test.testName,
      testType: test.testType,
      sampleType: test.sampleType,
      price: test.price.toString(),
      status: test.status,
      hospitalId: test.hospitalId // Add hospital selection
    });
    setParameters(test.parameters.length > 0 ? test.parameters : [{ parameterName: '', unit: '', normalRange: '', description: '' }]);
    setIsModalOpen(true);
  };

  const handleDeleteTest = async (id: string) => {
    if (window.confirm(t('common.delete') + '?')) {
      try {
        await deleteTestTemplate(id);
        setTests(tests.filter(t => t.id !== id));
        toast.success(i18n.language === 'en' ? 'Test deleted' : 'تست حذف شد');
      } catch (error) {
        console.error('Failed to delete test:', error);
        toast.error(i18n.language === 'en' ? 'Failed to delete test' : 'خطا در حذف آزمایش');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      hospitalId: formData.hospitalId,
      testCode: formData.testCode,
      testName: formData.testName,
      testType: formData.testType,
      category: 'Routine',
      description: '',
      sampleType: formData.sampleType,
      parameters: parameters.filter(p => p.parameterName.trim() !== ''),
      price: parseFloat(formData.price) || 0,
      duration: '24 hours',
      instructions: '',
      status: formData.status,
    };

    try {
      if (modalMode === 'add') {
        const created = await createTestTemplate(payload);
        setTests(prev => [created, ...prev]);
        toast.success(i18n.language === 'en' ? 'Test added' : 'تست اضافه شد');
      } else {
        const updated = await updateTestTemplate(selectedTest!.id, payload);
        setTests(prev => prev.map(t => t.id === selectedTest!.id ? updated : t));
        toast.success(i18n.language === 'en' ? 'Test updated' : 'تست بروز شد');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Failed to save test:', error);
      const message = error?.response?.data?.message || (i18n.language === 'en' ? 'Failed to save test' : 'خطا در ذخیره آزمایش');
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addParameter = () => {
    setParameters([...parameters, { parameterName: '', unit: '', normalRange: '', description: '' }]);
  };

  const removeParameter = (index: number) => {
    if (parameters.length > 1) {
      setParameters(parameters.filter((_, i) => i !== index));
    }
  };

  const updateParameter = (index: number, field: keyof TestParameter, value: string) => {
    const updated = [...parameters];
    updated[index] = { ...updated[index], [field]: value };
    setParameters(updated);
  };

  // Filter and Sort
  const filteredTests = tests.filter(test =>
    test.testName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    test.testCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    test.testType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedTests = [...filteredTests].sort((a: any, b: any) => {
    const aValue = a[sortField]?.toString().toLowerCase() || '';
    const bValue = b[sortField]?.toString().toLowerCase() || '';
    
    if (sortDirection === 'asc') {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  });

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
    const workSheet = XLSX.utils.json_to_sheet(sortedTests.map(t => ({
      Code: t.testCode,
      'Test Name': t.testName,
      Type: t.testType,
      Sample: t.sampleType,
      Price: t.price,
      Parameters: t.parameters.length,
      Status: t.status,
      Hospital: hospitals.find(h => h.id === t.hospitalId)?.name || 'Unknown'
    })));
    const workBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workBook, workSheet, "Tests");
    XLSX.writeFile(workBook, "Test_Definitions.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Test Definitions Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    if (!isAllHospitals) {
      doc.text(`Hospital: ${currentHospital.name}`, 14, 36);
    }

    autoTable(doc, {
      head: [['Code', 'Test Name', 'Type', 'Sample', 'Price', 'Params', 'Status']],
      body: sortedTests.map(t => [
        t.testCode,
        t.testName,
        t.testType,
        t.sampleType,
        t.price,
        t.parameters.length,
        t.status
      ]),
      startY: isAllHospitals ? 40 : 46,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [66, 139, 202] }
    });

    doc.save('Test_Definitions_Report.pdf');
  };

  const isRTL = i18n.language === 'ar' || i18n.language === 'fa' || i18n.language === 'ps';

  return (
    <div className={`space-y-3 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Compact Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            {i18n.language === 'en' ? 'Test Management' : i18n.language === 'ps' ? 'د ازمویښتونو مدیریت' : i18n.language === 'fa' ? 'مدیریت آزمایشات' : 'إدارة الاختبارات'}
          </h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {i18n.language === 'en' 
              ? `Manage laboratory test definitions for ${isAllHospitals ? 'All Hospitals' : currentHospital.name}`
              : `مدیریت تعاریف آزمایشات برای ${isAllHospitals ? 'همه بیمارستان‌ها' : currentHospital.name}`
            }
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Compact Search */}
          <div className="relative">
            <Search className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-2.5' : 'left-2.5'} w-3.5 h-3.5 text-gray-400`} />
            <input
              type="text"
              placeholder={i18n.language === 'en' ? 'Search tests...' : i18n.language === 'ps' ? 'لټون...' : i18n.language === 'fa' ? 'جستجو...' : 'بحث...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-48 ${isRTL ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
            />
          </div>

          {/* Action Buttons */}
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
          {canManage && (
            <button
              onClick={handleAddTest}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              {i18n.language === 'en' ? 'Add' : i18n.language === 'ps' ? 'اضافه' : i18n.language === 'fa' ? 'افزودن' : 'إضافة'}
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

      {/* Ultra-Compact Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="overflow-x-auto rounded-t-lg" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          <table className="w-full text-left border-collapse relative">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
              <tr>
                <th onClick={() => handleSort('testCode')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    {i18n.language === 'en' ? 'Code' : i18n.language === 'ps' ? 'کوډ' : i18n.language === 'fa' ? 'کد' : 'رمز'}
                    {renderSortIcon('testCode')}
                  </div>
                </th>
                <th onClick={() => handleSort('testName')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    {i18n.language === 'en' ? 'Test Name' : i18n.language === 'ps' ? 'نوم' : i18n.language === 'fa' ? 'نام آزمایش' : 'الاسم'}
                    {renderSortIcon('testName')}
                  </div>
                </th>
                <th onClick={() => handleSort('testType')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    {i18n.language === 'en' ? 'Type' : i18n.language === 'ps' ? 'ډول' : i18n.language === 'fa' ? 'نوع' : 'النوع'}
                    {renderSortIcon('testType')}
                  </div>
                </th>
                <th onClick={() => handleSort('sampleType')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    {i18n.language === 'en' ? 'Sample' : i18n.language === 'ps' ? 'نمونه' : i18n.language === 'fa' ? 'نمونه' : 'عينة'}
                    {renderSortIcon('sampleType')}
                  </div>
                </th>
                <th onClick={() => handleSort('price')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    {i18n.language === 'en' ? 'Price' : i18n.language === 'ps' ? 'قیمت' : i18n.language === 'fa' ? 'قیمت' : 'السعر'}
                    {renderSortIcon('price')}
                  </div>
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">
                  {i18n.language === 'en' ? 'Params' : i18n.language === 'ps' ? 'پارام' : i18n.language === 'fa' ? 'پارام' : 'معامل'}
                </th>
                <th onClick={() => handleSort('status')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">
                    {i18n.language === 'en' ? 'Status' : i18n.language === 'ps' ? 'حالت' : i18n.language === 'fa' ? 'وضعیت' : 'الحالة'}
                    {renderSortIcon('status')}
                  </div>
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-center">
                  {i18n.language === 'en' ? 'Actions' : i18n.language === 'ps' ? 'کړنې' : i18n.language === 'fa' ? 'عملیات' : 'إجراءات'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedTests.length > 0 ? (
                sortedTests.map((test) => (
                  <tr key={test.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                    <td className="px-4 py-2">
                      <span className="text-[10px] font-medium text-gray-900 dark:text-white font-mono">{test.testCode}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">{test.testName}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-[10px] text-gray-600 dark:text-gray-400">{test.testType}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-[10px] text-gray-600 dark:text-gray-400">{test.sampleType}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">{test.price}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center justify-center px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-[10px] font-medium border border-blue-100 dark:border-blue-800 min-w-[24px]">
                        {test.parameters.length}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                        test.status === 'active'
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                          : 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800'
                      }`}>
                        {test.status === 'active' ? (i18n.language === 'en' ? 'Active' : 'فعال') : (i18n.language === 'en' ? 'Inactive' : 'غیرفعال')}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleViewTest(test)}
                          className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-md transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canManage && (
                          <button
                            onClick={() => handleEditTest(test)}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canManage && (
                          <button
                            onClick={() => handleDeleteTest(test.id)}
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
              ) : isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                      <p className="text-sm font-medium">
                        {i18n.language === 'en' ? 'Loading tests...' : 'در حال بارگذاری...'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                        <Search className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium">
                        {i18n.language === 'en' ? 'No tests found' : i18n.language === 'ps' ? 'تست ونه موندل شو' : i18n.language === 'fa' ? 'آزمایشی یافت نشد' : 'لم يتم العثور'}
                      </p>
                      <p className="text-xs mt-1">Try adjusting your search terms</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer with totals */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 rounded-b-lg flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
          <span>Total Records: <span className="font-semibold text-gray-900 dark:text-white">{sortedTests.length}</span></span>
          <span>Showing {sortedTests.length} of {tests.length} tests</span>
        </div>
      </div>

      {/* Compact Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700 flex flex-col">
            {/* Modal Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg sticky top-0 z-10">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                {modalMode === 'add' 
                  ? (i18n.language === 'en' ? 'Add New Test' : i18n.language === 'ps' ? 'نوی تست' : i18n.language === 'fa' ? 'آزمایش جدید' : 'اختبار جديد')
                  : (i18n.language === 'en' ? 'Edit Test' : i18n.language === 'ps' ? 'تست تدوین' : i18n.language === 'fa' ? 'ویرایش' : 'تعديل')
                }
              </h2>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
                <Plus className="w-4 h-4 rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              {/* Hospital Selection for Super Admin */}
              {userRole === 'super_admin' && (
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                    {i18n.language === 'en' ? 'Hospital' : i18n.language === 'ps' ? 'روغتون' : i18n.language === 'fa' ? 'بیمارستان' : 'مستشفى'} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.hospitalId}
                    onChange={(e) => setFormData({ ...formData, hospitalId: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  >
                    {hospitals.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Basic Info */}
              <div>
                <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-2 bg-gray-50 dark:bg-gray-700/30 p-1.5 rounded border border-gray-100 dark:border-gray-700">
                  {i18n.language === 'en' ? 'Basic Information' : i18n.language === 'ps' ? 'معلومات' : i18n.language === 'fa' ? 'اطلاعات' : 'المعلومات'}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                      {i18n.language === 'en' ? 'Test Code' : i18n.language === 'ps' ? 'کوډ' : i18n.language === 'fa' ? 'کد' : 'رمز'} *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.testCode}
                      onChange={(e) => setFormData({ ...formData, testCode: e.target.value })}
                      className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                      {i18n.language === 'en' ? 'Test Name' : i18n.language === 'ps' ? 'نوم' : i18n.language === 'fa' ? 'نام' : 'الاسم'} *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.testName}
                      onChange={(e) => setFormData({ ...formData, testName: e.target.value })}
                      className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                      {i18n.language === 'en' ? 'Test Type' : i18n.language === 'ps' ? 'ډول' : i18n.language === 'fa' ? 'نوع' : 'النوع'} *
                    </label>
                    <input
                      type="text"
                      required
                      list="testTypes"
                      value={formData.testType}
                      onChange={(e) => setFormData({ ...formData, testType: e.target.value })}
                      placeholder="e.g., Hematology"
                      className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500"
                    />
                    <datalist id="testTypes">
                      <option value="Hematology" />
                      <option value="Clinical Chemistry" />
                      <option value="Microbiology" />
                      <option value="Endocrinology" />
                      <option value="Serology" />
                      <option value="Immunology" />
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                      {i18n.language === 'en' ? 'Sample Type' : i18n.language === 'ps' ? 'نمونه' : i18n.language === 'fa' ? 'نمونه' : 'عينة'} *
                    </label>
                    <input
                      type="text"
                      required
                      list="sampleTypes"
                      value={formData.sampleType}
                      onChange={(e) => setFormData({ ...formData, sampleType: e.target.value })}
                      placeholder="e.g., Blood"
                      className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500"
                    />
                    <datalist id="sampleTypes">
                      <option value="Blood" />
                      <option value="Urine" />
                      <option value="Stool" />
                      <option value="Saliva" />
                      <option value="Sputum" />
                      <option value="Tissue" />
                      <option value="Swab" />
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                      {i18n.language === 'en' ? 'Price' : i18n.language === 'ps' ? 'قیمت' : i18n.language === 'fa' ? 'قیمت' : 'السعر'} *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                      {i18n.language === 'en' ? 'Status' : i18n.language === 'ps' ? 'حالت' : i18n.language === 'fa' ? 'وضعیت' : 'الحالة'}
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                      className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="active">{i18n.language === 'en' ? 'Active' : 'فعال'}</option>
                      <option value="inactive">{i18n.language === 'en' ? 'Inactive' : 'غیرفعال'}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Test Parameters */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700/30 p-1.5 rounded border border-gray-100 dark:border-gray-700 flex-1 mr-2">
                    {i18n.language === 'en' ? 'Test Parameters' : i18n.language === 'ps' ? 'پارامترونه' : i18n.language === 'fa' ? 'پارامترها' : 'المعاملات'}
                  </h3>
                  <button
                    type="button"
                    onClick={addParameter}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {i18n.language === 'en' ? 'Add' : i18n.language === 'ps' ? 'اضافه' : i18n.language === 'fa' ? 'افزودن' : 'إضافة'}
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {parameters.map((param, index) => (
                    <div key={index} className="p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          {i18n.language === 'en' ? 'Parameter' : 'پارامتر'} #{index + 1}
                        </span>
                        {parameters.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeParameter(index)}
                            className="text-red-600 hover:text-red-700 p-0.5 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <input
                            type="text"
                            required
                            placeholder={i18n.language === 'en' ? 'Name *' : 'نوم *'}
                            value={param.parameterName}
                            onChange={(e) => updateParameter(index, 'parameterName', e.target.value)}
                            className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            required
                            placeholder={i18n.language === 'en' ? 'Unit *' : 'واحد *'}
                            value={param.unit}
                            onChange={(e) => updateParameter(index, 'unit', e.target.value)}
                            className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="text"
                            required
                            placeholder={i18n.language === 'en' ? 'Normal Range *' : 'نورمال حد *'}
                            value={param.normalRange}
                            onChange={(e) => updateParameter(index, 'normalRange', e.target.value)}
                            className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs"
                >
                  {i18n.language === 'en' ? 'Cancel' : i18n.language === 'ps' ? 'لغوه' : i18n.language === 'fa' ? 'لغو' : 'إلغاء'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md transition-colors font-medium text-xs shadow-sm flex items-center justify-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {modalMode === 'add' 
                    ? (i18n.language === 'en' ? 'Add Test' : i18n.language === 'ps' ? 'اضافه' : i18n.language === 'fa' ? 'افزودن' : 'إضافة')
                    : (i18n.language === 'en' ? 'Update Test' : i18n.language === 'ps' ? 'تازه' : i18n.language === 'fa' ? 'بروز' : 'تحديث')
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {isViewModalOpen && selectedTest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between rounded-t-lg">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  {i18n.language === 'en' ? 'Test Details' : 'جزئیات آزمایش'}
                </h2>
                <p className="text-xs text-blue-100 mt-0.5">{selectedTest.testCode}</p>
              </div>
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-lg">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                    {i18n.language === 'en' ? 'Test Name' : 'نام آزمایش'}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{selectedTest.testName}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-lg">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                    {i18n.language === 'en' ? 'Test Type' : 'نوع آزمایش'}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{selectedTest.testType}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-lg">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                    {i18n.language === 'en' ? 'Sample Type' : 'نوع نمونه'}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{selectedTest.sampleType}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-lg">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                    {i18n.language === 'en' ? 'Price' : 'قیمت'}
                  </p>
                  <p className="text-sm font-semibold text-green-600 dark:text-green-400 mt-0.5">{selectedTest.price}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-lg">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                    {i18n.language === 'en' ? 'Category' : 'دسته‌بندی'}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{selectedTest.category || 'Routine'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-lg">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                    {i18n.language === 'en' ? 'Status' : 'وضعیت'}
                  </p>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium mt-0.5 ${
                    selectedTest.status === 'active'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {selectedTest.status === 'active' ? (i18n.language === 'en' ? 'Active' : 'فعال') : (i18n.language === 'en' ? 'Inactive' : 'غیرفعال')}
                  </span>
                </div>
              </div>

              {/* Parameters */}
              {selectedTest.parameters && selectedTest.parameters.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                    {i18n.language === 'en' ? 'Test Parameters' : 'پارامترهای آزمایش'} ({selectedTest.parameters.length})
                  </h3>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">#</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">
                            {i18n.language === 'en' ? 'Parameter' : 'پارامتر'}
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">
                            {i18n.language === 'en' ? 'Unit' : 'واحد'}
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">
                            {i18n.language === 'en' ? 'Normal Range' : 'محدوده طبیعی'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {selectedTest.parameters.map((param, index) => (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{index + 1}</td>
                            <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{param.parameterName}</td>
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{param.unit || '-'}</td>
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{param.normalRange || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Duration & Instructions */}
              {(selectedTest.duration || selectedTest.instructions) && (
                <div className="grid grid-cols-1 gap-3">
                  {selectedTest.duration && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800">
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wide font-medium">
                        {i18n.language === 'en' ? 'Expected Duration' : 'زمان انتظار'}
                      </p>
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mt-0.5">{selectedTest.duration}</p>
                    </div>
                  )}
                  {selectedTest.instructions && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase tracking-wide font-medium">
                        {i18n.language === 'en' ? 'Instructions' : 'دستورالعمل'}
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-0.5">{selectedTest.instructions}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  handleEditTest(selectedTest);
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium text-xs flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" />
                {i18n.language === 'en' ? 'Edit' : 'ویرایش'}
              </button>
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs"
              >
                {i18n.language === 'en' ? 'Close' : 'بستن'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}