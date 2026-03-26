import React, { useState } from 'react';
import { Plus, Edit, Trash2, Search, TestTube2, X } from 'lucide-react';
import { TestMaster, TestParameter } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

interface TestMasterManagementProps {
  testMasters: TestMaster[];
  onAdd: (testMaster: Omit<TestMaster, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, testMaster: Partial<TestMaster>) => void;
  onDelete: (id: string) => void;
}

export function TestMasterManagement({ testMasters, onAdd, onUpdate, onDelete }: TestMasterManagementProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showModal, setShowModal] = useState(false);
  const [editingTest, setEditingTest] = useState<TestMaster | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<TestMaster>>({
    testName: '',
    testCode: '',
    testType: 'Hematology',
    category: 'Blood Test',
    parameters: [],
    price: 0,
    description: '',
    status: 'active',
  });
  const [parameterForm, setParameterForm] = useState<Partial<TestParameter>>({
    parameterName: '',
    unit: '',
    normalRangeMin: '',
    normalRangeMax: '',
    normalRangeText: '',
  });

  // Filter tests based on search and role
  const filteredTests = testMasters.filter((test) => {
    const matchesSearch = 
      test.testName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      test.testCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      test.testType.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Role-based filtering
    if (user?.role === 'admin') {
      return matchesSearch && test.hospitalId === user.hospitalId;
    }
    if (user?.role === 'super_admin') {
      return matchesSearch;
    }
    return matchesSearch && test.hospitalId === user?.hospitalId;
  });

  const totalPages = Math.max(1, Math.ceil(filteredTests.length / itemsPerPage));
  const paginatedTests = filteredTests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleOpenModal = (test?: TestMaster) => {
    if (test) {
      setEditingTest(test);
      setFormData(test);
    } else {
      setEditingTest(null);
      setFormData({
        testName: '',
        testCode: '',
        testType: 'Hematology',
        category: 'Blood Test',
        parameters: [],
        price: 0,
        description: '',
        status: 'active',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTest(null);
    setParameterForm({
      parameterName: '',
      unit: '',
      normalRangeMin: '',
      normalRangeMax: '',
      normalRangeText: '',
    });
  };

  const handleAddParameter = () => {
    if (!parameterForm.parameterName || !parameterForm.unit) {
      toast.error('Parameter name and unit are required');
      return;
    }

    const newParameter: TestParameter = {
      id: Date.now().toString(),
      parameterName: parameterForm.parameterName || '',
      unit: parameterForm.unit || '',
      normalRangeMin: parameterForm.normalRangeMin,
      normalRangeMax: parameterForm.normalRangeMax,
      normalRangeText: parameterForm.normalRangeText,
    };

    setFormData({
      ...formData,
      parameters: [...(formData.parameters || []), newParameter],
    });

    setParameterForm({
      parameterName: '',
      unit: '',
      normalRangeMin: '',
      normalRangeMax: '',
      normalRangeText: '',
    });
    toast.success('Parameter added');
  };

  const handleRemoveParameter = (parameterId: string) => {
    setFormData({
      ...formData,
      parameters: formData.parameters?.filter((p) => p.id !== parameterId),
    });
    toast.success('Parameter removed');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (!formData.testName || !formData.testCode || !formData.testType) {
        toast.error('Please fill in all required fields');
        return;
      }

      if (!formData.parameters || formData.parameters.length === 0) {
        toast.error('Please add at least one test parameter');
        return;
      }

      if (editingTest) {
        onUpdate(editingTest.id, {
          ...formData,
          updatedAt: new Date(),
        });
        toast.success('Test updated successfully');
      } else {
        onAdd({
          ...formData as Omit<TestMaster, 'id' | 'createdAt'>,
          hospitalId: user?.hospitalId || '',
        });
        toast.success('Test created successfully');
      }
    } finally {
      setSubmitting(false);
    }

    handleCloseModal();
  };

  const handleDelete = (id: string, testName: string) => {
    if (window.confirm(`Are you sure you want to delete "${testName}"?`)) {
      onDelete(id);
      toast.success('Test deleted successfully');
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('testMasterManagement')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('manageTestTemplates')}</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('addTest')}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={t('searchTests')}
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  {t('testCode')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  {t('testName')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  {t('type')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  {t('category')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  {t('parameters')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  {t('price')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  {t('status')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  {t('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedTests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {t('noTestsFound')}
                  </td>
                </tr>
              ) : (
                paginatedTests.map((test) => (
                  <tr key={test.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400">
                      {test.testCode}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {test.testName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {test.testType}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {test.category}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {test.parameters.length} {t('params')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium">
                      ${test.price}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          test.status === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}
                      >
                        {test.status === 'active' ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenModal(test)}
                          className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded"
                          title={t('edit')}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(test.id, test.testName)}
                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded"
                          title={t('delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
          <span>Page {currentPage} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingTest ? t('editTest') : t('addTest')}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <TestTube2 className="w-4 h-4" />
                  {t('basicInformation')}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('testCode')} *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.testCode || ''}
                      onChange={(e) => setFormData({ ...formData, testCode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="e.g., CBC, LP, RFT"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('testName')} *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.testName || ''}
                      onChange={(e) => setFormData({ ...formData, testName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="e.g., Complete Blood Count"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('testType')} *
                    </label>
                    <select
                      required
                      value={formData.testType || 'Hematology'}
                      onChange={(e) => setFormData({ ...formData, testType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="Hematology">Hematology</option>
                      <option value="Biochemistry">Biochemistry</option>
                      <option value="Microbiology">Microbiology</option>
                      <option value="Immunology">Immunology</option>
                      <option value="Pathology">Pathology</option>
                      <option value="Radiology">Radiology</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('category')} *
                    </label>
                    <select
                      required
                      value={formData.category || 'Blood Test'}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="Blood Test">Blood Test</option>
                      <option value="Urine Test">Urine Test</option>
                      <option value="Stool Test">Stool Test</option>
                      <option value="X-Ray">X-Ray</option>
                      <option value="Ultrasound">Ultrasound</option>
                      <option value="ECG">ECG</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('price')} *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.price || 0}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('status')}
                    </label>
                    <select
                      value={formData.status || 'active'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="active">{t('active')}</option>
                      <option value="inactive">{t('inactive')}</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('description')}
                    </label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="Optional description or notes"
                    />
                  </div>
                </div>
              </div>

              {/* Test Parameters */}
              <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                  {t('testParameters')} *
                </h4>

                {/* Add Parameter Form */}
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-5 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('parameterName')}
                      </label>
                      <input
                        type="text"
                        value={parameterForm.parameterName || ''}
                        onChange={(e) => setParameterForm({ ...parameterForm, parameterName: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        placeholder="e.g., Hemoglobin"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('unit')}
                      </label>
                      <input
                        type="text"
                        value={parameterForm.unit || ''}
                        onChange={(e) => setParameterForm({ ...parameterForm, unit: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        placeholder="g/dL"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('minRange')}
                      </label>
                      <input
                        type="text"
                        value={parameterForm.normalRangeMin || ''}
                        onChange={(e) => setParameterForm({ ...parameterForm, normalRangeMin: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        placeholder="12"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('maxRange')}
                      </label>
                      <input
                        type="text"
                        value={parameterForm.normalRangeMax || ''}
                        onChange={(e) => setParameterForm({ ...parameterForm, normalRangeMax: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        placeholder="16"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('textRange')} ({t('optional')})
                      </label>
                      <input
                        type="text"
                        value={parameterForm.normalRangeText || ''}
                        onChange={(e) => setParameterForm({ ...parameterForm, normalRangeText: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        placeholder="e.g., Negative, Normal, Positive"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAddParameter}
                        className="px-4 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Parameters List */}
                {formData.parameters && formData.parameters.length > 0 && (
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                            {t('parameter')}
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                            {t('unit')}
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                            {t('normalRange')}
                          </th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 dark:text-gray-300">
                            {t('action')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {formData.parameters.map((param) => (
                          <tr key={param.id} className="bg-white dark:bg-gray-800">
                            <td className="px-3 py-2 text-gray-900 dark:text-gray-100 font-medium">
                              {param.parameterName}
                            </td>
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{param.unit}</td>
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                              {param.normalRangeText || 
                                (param.normalRangeMin && param.normalRangeMax 
                                  ? `${param.normalRangeMin} - ${param.normalRangeMax}`
                                  : '-')}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveParameter(param.id)}
                                className="text-red-600 hover:text-red-800 dark:hover:text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : editingTest ? t('update') : t('create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
