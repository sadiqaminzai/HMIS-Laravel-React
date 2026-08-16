import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Search, X, PlusCircle, MinusCircle } from 'lucide-react';
import { Hospital, UserRole, SalaryStructure } from '../types';
import { useSalaryStructures } from '../context/SalaryStructureContext';
import { useEmployees } from '../context/EmployeeContext';
import { useAuth } from '../context/AuthContext';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { toast } from 'sonner';
import { AddButton } from './AddButton';

interface SalaryStructureManagementProps {
  hospital: Hospital;
  userRole: UserRole;
}

type FormComponent = {
  componentType: 'allowance' | 'deduction';
  name: string;
  amount: string;
  isTaxable: boolean;
  sortOrder: number;
};

export function SalaryStructureManagement({ hospital, userRole }: SalaryStructureManagementProps) {
  const { t } = useTranslation();
  const { salaryStructures, addSalaryStructure, updateSalaryStructure, deleteSalaryStructure, loading } = useSalaryStructures();
  const { employees } = useEmployees();
  const { hasPermission } = useAuth();
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital } = useHospitalFilter(hospital, userRole);

  const canAdd = hasPermission('add_salary_structures') || hasPermission('manage_salary_structures');
  const canEdit = hasPermission('edit_salary_structures') || hasPermission('manage_salary_structures');
  const canDelete = hasPermission('delete_salary_structures') || hasPermission('manage_salary_structures');

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    hospitalId: currentHospital.id,
    employeeId: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '',
    baseSalary: '',
    currency: 'AFN',
    status: 'active' as 'active' | 'inactive',
    notes: '',
  });
  const [components, setComponents] = useState<FormComponent[]>([]);

  const scopedSalaryStructures = useMemo(() => filterByHospital(salaryStructures), [salaryStructures, filterByHospital]);
  const scopedEmployees = useMemo(() => filterByHospital(employees), [employees, filterByHospital]);

  const filtered = useMemo(
    () => scopedSalaryStructures.filter((salaryStructure) => {
      const search = searchTerm.toLowerCase();
      return (
        (salaryStructure.employee?.fullName || '').toLowerCase().includes(search) ||
        (salaryStructure.employee?.employeeCode || '').toLowerCase().includes(search) ||
        salaryStructure.currency.toLowerCase().includes(search) ||
        salaryStructure.status.toLowerCase().includes(search)
      );
    }),
    [scopedSalaryStructures, searchTerm]
  );

  const paginatedSalaryStructures = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  }, [filtered, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));

  React.useEffect(() => {
    setFormData((prev) => ({ ...prev, hospitalId: currentHospital.id }));
  }, [currentHospital.id]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedHospitalId]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const openAdd = () => {
    if (!canAdd) {
      toast.warning('You are not authorized to add salary structures');
      return;
    }

    setEditingId(null);
    setFormData({
      hospitalId: currentHospital.id,
      employeeId: '',
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: '',
      baseSalary: '',
      currency: 'AFN',
      status: 'active',
      notes: '',
    });
    setComponents([]);
    setShowModal(true);
  };

  const openEdit = (id: string) => {
    if (!canEdit) {
      toast.warning('You are not authorized to edit salary structures');
      return;
    }

    const record = salaryStructures.find((salaryStructure) => salaryStructure.id === id);
    if (!record) return;

    setEditingId(record.id);
    setFormData({
      hospitalId: record.hospitalId,
      employeeId: record.employeeId,
      effectiveFrom: record.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: record.effectiveTo ? record.effectiveTo.toISOString().slice(0, 10) : '',
      baseSalary: String(record.baseSalary || ''),
      currency: record.currency || 'AFN',
      status: record.status,
      notes: record.notes || '',
    });
    setComponents(
      (record.components || []).map((component) => ({
        componentType: component.componentType,
        name: component.name,
        amount: String(component.amount || ''),
        isTaxable: component.isTaxable,
        sortOrder: component.sortOrder || 0,
      }))
    );
    setShowModal(true);
  };

  const onDelete = async (id: string) => {
    if (!canDelete) {
      toast.warning('You are not authorized to delete salary structures');
      return;
    }

    const confirmed = window.confirm('Delete this salary structure?');
    if (!confirmed) return;

    try {
      await deleteSalaryStructure(id);
      toast.success('Salary structure deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete salary structure');
    }
  };

  const addComponentRow = () => {
    setComponents((prev) => ([
      ...prev,
      {
        componentType: 'allowance',
        name: '',
        amount: '',
        isTaxable: false,
        sortOrder: prev.length,
      },
    ]));
  };

  const updateComponentRow = (index: number, patch: Partial<FormComponent>) => {
    setComponents((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const removeComponentRow = (index: number) => {
    setComponents((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting) return;

    if (userRole === 'super_admin' && !formData.hospitalId) {
      toast.error('Please select hospital');
      return;
    }

    if (!formData.employeeId) {
      toast.error('Please select employee');
      return;
    }

    if (!formData.baseSalary || Number(formData.baseSalary) < 0) {
      toast.error('Please enter valid base salary');
      return;
    }

    const normalizedComponents = components
      .filter((component) => component.name.trim().length > 0 && Number(component.amount) >= 0)
      .map((component, index) => ({
        id: `${index}`,
        hospitalId: formData.hospitalId,
        salaryStructureId: editingId || '',
        componentType: component.componentType,
        name: component.name,
        amount: Number(component.amount || 0),
        isTaxable: component.isTaxable,
        sortOrder: component.sortOrder,
      }));

    setSubmitting(true);
    try {
      const payload: Partial<SalaryStructure> = {
        hospitalId: formData.hospitalId,
        employeeId: formData.employeeId,
        effectiveFrom: new Date(formData.effectiveFrom),
        effectiveTo: formData.effectiveTo ? new Date(formData.effectiveTo) : undefined,
        baseSalary: Number(formData.baseSalary),
        currency: formData.currency,
        status: formData.status,
        notes: formData.notes || undefined,
        components: normalizedComponents,
      };

      if (editingId) {
        await updateSalaryStructure({ id: editingId, ...payload });
        toast.success('Salary structure updated');
      } else {
        const created = await addSalaryStructure(payload);
        if (!created) return;
        toast.success('Salary structure added');
      }

      setShowModal(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save salary structure');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1300px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Salary Structures</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Base salary with allowance/deduction component definitions.</p>
        </div>
        <AddButton onClick={openAdd} label={'Add Salary Structure'} />
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            title="Search salary structures"
            placeholder="Search salary structures..."
            className="w-full pl-10 pr-4 py-2.5 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          />
        </div>
        <HospitalSelector
          userRole={userRole}
          selectedHospitalId={selectedHospitalId}
          onHospitalChange={setSelectedHospitalId}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-[12px] border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[980px]">
            <thead className="bg-gray-50/80 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 font-semibold sticky top-0 backdrop-blur-sm z-10">
              <tr>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.employee')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.effectiveFrom')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.baseSalary')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.netSalary')}</th>
                <th className="px-3 py-2.5 text-xs font-medium">{t('table.status')}</th>
                <th className="px-3 py-2.5 text-xs font-medium text-center">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedSalaryStructures.map((salaryStructure) => (
                <tr key={salaryStructure.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/40 transition-colors border-b border-gray-100 dark:border-gray-800/50">
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-900 dark:text-white font-medium">
                    <div>{salaryStructure.employee?.fullName || '-'}</div>
                    <div className="text-xs text-gray-500">{salaryStructure.employee?.employeeCode || ''}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{salaryStructure.effectiveFrom.toLocaleDateString()}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{salaryStructure.baseSalary.toFixed(2)} {salaryStructure.currency}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{salaryStructure.netSalary.toFixed(2)} {salaryStructure.currency}</td>
                  <td className="px-3 py-2.5 text-xs font-medium">
                    <span className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold ${salaryStructure.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {salaryStructure.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-medium">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => openEdit(salaryStructure.id)}
                        className="p-2.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-blue-600 hover:bg-blue-100"
                        title={t('ui.edit')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(salaryStructure.id)}
                        className="p-2.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-red-600 hover:bg-red-100"
                        title={t('ui.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                    No salary structures found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
            <div className="text-xs text-gray-500 dark:text-gray-400">Page {currentPage} of {totalPages}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >{t('ui.previous')}</button>
              <button
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >{t('ui.next')}</button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 transition-all">
          <form onSubmit={onSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between rounded-t-lg sticky top-0 z-10">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                {editingId ? 'Edit Salary Structure' : 'Add Salary Structure'}
                {userRole === 'super_admin' && (
                  <span className="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">- {currentHospital.name}</span>
                )}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors" title={t('ui.close')}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 space-y-2">
              {userRole === 'super_admin' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.hospital')}</label>
                  <div className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 px-3.5 py-2 text-sm text-gray-700 dark:text-gray-200">
                    {currentHospital.name}
                  </div>
                </div>
              )}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">Salary Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.employee')}</label>
                <select
                  value={formData.employeeId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, employeeId: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title={t('ui.employee')}
                  required
                >
                  <option value="">{t('ui.selectEmployee')}</option>
                  {scopedEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.fullName} ({employee.employeeCode || 'N/A'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Effective From</label>
                <input
                  type="date"
                  value={formData.effectiveFrom}
                  onChange={(e) => setFormData((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title="Effective from date"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Effective To (optional)</label>
                <input
                  type="date"
                  value={formData.effectiveTo}
                  onChange={(e) => setFormData((prev) => ({ ...prev, effectiveTo: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title="Effective to date"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Base Salary</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.baseSalary}
                  onChange={(e) => setFormData((prev) => ({ ...prev, baseSalary: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title="Base salary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.currency')}</label>
                <input
                  value={formData.currency}
                  onChange={(e) => setFormData((prev) => ({ ...prev, currency: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title={t('ui.currency')}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.status')}</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title="Salary structure status"
                >
                  <option value="active">{t('ui.active')}</option>
                  <option value="inactive">{t('ui.inactive')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.notes')}</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                  title={t('ui.notes')}
                />
              </div>

              <div className="md:col-span-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900 dark:text-white">Salary Components</h3>
                  <button type="button" onClick={addComponentRow} className="text-blue-600 text-sm inline-flex items-center gap-1">
                    <PlusCircle className="w-4 h-4" />
                    Add Component
                  </button>
                </div>

                <div className="space-y-2">
                  {components.map((component, index) => (
                    <div key={`component-${index}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                      <div className="md:col-span-2">
                        <select
                          value={component.componentType}
                          onChange={(e) => updateComponentRow(index, { componentType: e.target.value as FormComponent['componentType'] })}
                          className="w-full px-2 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                          title="Component type"
                        >
                          <option value="allowance">Allowance</option>
                          <option value="deduction">Deduction</option>
                        </select>
                      </div>
                      <div className="md:col-span-4">
                        <input
                          value={component.name}
                          onChange={(e) => updateComponentRow(index, { name: e.target.value })}
                          placeholder="Component name"
                          className="w-full px-2 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                          title="Component name"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={component.amount}
                          onChange={(e) => updateComponentRow(index, { amount: e.target.value })}
                          placeholder={t('ui.amount')}
                          className="w-full px-2 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                          title="Component amount"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={component.isTaxable}
                            onChange={(e) => updateComponentRow(index, { isTaxable: e.target.checked })}
                            title="Taxable"
                          />
                          Taxable
                        </label>
                      </div>
                      <div className="md:col-span-1">
                        <input
                          type="number"
                          min="0"
                          value={component.sortOrder}
                          onChange={(e) => updateComponentRow(index, { sortOrder: Number(e.target.value || 0) })}
                          className="w-full px-2 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                          title="Sort order"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <button
                          type="button"
                          onClick={() => removeComponentRow(index)}
                          className="p-2 rounded text-red-600 hover:bg-red-50"
                          title="Remove component"
                        >
                          <MinusCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {components.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No components added. You can keep only base salary or add allowances/deductions.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

            <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs">{t('ui.cancel')}</button>
              <button type="submit" disabled={submitting} className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md transition-colors font-medium text-xs shadow-sm flex items-center justify-center gap-1.5">
                {submitting ? 'Saving...' : editingId ? t('ui.update') : t('ui.create')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
