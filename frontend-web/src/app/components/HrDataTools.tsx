import React, { useEffect, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Hospital, UserRole } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';

interface HrDataToolsProps {
  hospital: Hospital;
  userRole: UserRole;
}

const moduleLabels: Record<string, string> = {
  shifts: 'Shifts',
  departments: 'Departments',
  designations: 'Designations',
  employees: 'Employees',
  employee_attendances: 'Employee Attendances',
  leave_requests: 'Leave Requests',
  salary_structures: 'Salary Structures',
  payroll_batches: 'Payroll Batches',
  payroll_items: 'Payroll Items',
};

export function HrDataTools({ hospital, userRole }: HrDataToolsProps) {
  const { selectedHospitalId, setSelectedHospitalId, currentHospital } = useHospitalFilter(hospital, userRole);
  const [modules, setModules] = useState<string[]>([]);
  const [selectedModule, setSelectedModule] = useState('employees');
  const [busyAction, setBusyAction] = useState<'import' | 'export' | null>(null);

  useEffect(() => {
    const loadModules = async () => {
      try {
        const queryParams: any = {};
        if (userRole === 'super_admin' && selectedHospitalId) {
          queryParams.hospital_id = selectedHospitalId;
        }

        const { data } = await api.get('/hr-data-tools/modules', {
          params: Object.keys(queryParams).length ? queryParams : undefined,
        });

        const list: string[] = data?.modules ?? [];
        setModules(list);

        if (list.length > 0 && !list.includes(selectedModule)) {
          setSelectedModule(list[0]);
        }
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Failed to load HR modules');
      }
    };

    loadModules();
  }, [selectedHospitalId, selectedModule, userRole]);

  const getHospitalParam = () => {
    if (userRole !== 'super_admin') return {};
    if (!selectedHospitalId) {
      throw new Error('Please select a hospital first.');
    }
    return { hospital_id: selectedHospitalId };
  };

  const onExport = async () => {
    try {
      setBusyAction('export');
      const params = getHospitalParam();
      const response = await api.get(`/hr-data-tools/${selectedModule}/export`, {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedModule}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast.success('Export completed');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Export failed');
    } finally {
      setBusyAction(null);
    }
  };

  const onImport = async (file: File | null) => {
    if (!file) return;

    try {
      setBusyAction('import');
      const params = getHospitalParam();
      const formData = new FormData();
      formData.append('file', file);
      if ((params as any).hospital_id) {
        formData.append('hospital_id', String((params as any).hospital_id));
      }

      const { data } = await api.post(`/hr-data-tools/${selectedModule}/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success(data?.message || 'Import completed');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Import failed');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">HR Data Tools</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Import and export HR data module-wise using CSV files.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Module</label>
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            title="HR data module"
          >
            {modules.map((module) => (
              <option key={module} value={module}>{moduleLabels[module] || module}</option>
            ))}
          </select>
        </div>

        <div className="md:w-[280px]">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Hospital</label>
          <HospitalSelector
            userRole={userRole}
            selectedHospitalId={selectedHospitalId}
            onHospitalChange={setSelectedHospitalId}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          Current hospital context: <span className="font-semibold">{currentHospital.name}</span>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={onExport}
            disabled={busyAction !== null || !selectedModule}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            {busyAction === 'export' ? 'Exporting...' : 'Export CSV'}
          </button>

          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm cursor-pointer">
            <Upload className="w-4 h-4" />
            {busyAction === 'import' ? 'Importing...' : 'Import CSV'}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={busyAction !== null || !selectedModule}
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                onImport(file);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Export downloads a template-compatible CSV for the selected module. Import performs upsert based on module keys.
        </p>
      </div>
    </div>
  );
}
