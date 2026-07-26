import React, { createContext, useContext, useEffect, useState } from 'react';
import { SalaryStructure } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface SalaryStructureContextType {
  salaryStructures: SalaryStructure[];
  refresh: (params?: { hospitalId?: string; employeeId?: string; status?: string }) => Promise<void>;
  addSalaryStructure: (payload: Partial<SalaryStructure>) => Promise<SalaryStructure | null>;
  updateSalaryStructure: (payload: Partial<SalaryStructure> & { id: string }) => Promise<void>;
  deleteSalaryStructure: (id: string) => Promise<void>;
  loading: boolean;
}

const SalaryStructureContext = createContext<SalaryStructureContextType | undefined>(undefined);

const mapSalaryStructure = (s: any): SalaryStructure => ({
  id: String(s.id),
  hospitalId: String(s.hospital_id),
  employeeId: String(s.employee_id),
  effectiveFrom: s.effective_from ? new Date(s.effective_from) : new Date(),
  effectiveTo: s.effective_to ? new Date(s.effective_to) : undefined,
  baseSalary: Number(s.base_salary ?? 0),
  allowancesTotal: Number(s.allowances_total ?? 0),
  deductionsTotal: Number(s.deductions_total ?? 0),
  netSalary: Number(s.net_salary ?? 0),
  currency: s.currency ?? 'AFN',
  notes: s.notes ?? '',
  status: (s.status ?? 'active') as SalaryStructure['status'],
  employee: s.employee
    ? {
        id: String(s.employee.id),
        employeeCode: s.employee.employee_code ?? '',
        firstName: s.employee.first_name ?? '',
        lastName: s.employee.last_name ?? '',
        fullName: `${s.employee.first_name ?? ''} ${s.employee.last_name ?? ''}`.trim(),
      }
    : undefined,
  components: Array.isArray(s.components)
    ? s.components.map((component: any) => ({
        id: String(component.id),
        hospitalId: String(component.hospital_id),
        salaryStructureId: String(component.salary_structure_id),
        componentType: component.component_type,
        name: component.name ?? '',
        amount: Number(component.amount ?? 0),
        isTaxable: Boolean(component.is_taxable),
        sortOrder: Number(component.sort_order ?? 0),
      }))
    : [],
  createdAt: s.created_at ? new Date(s.created_at) : undefined,
  createdBy: s.created_by ?? undefined,
  updatedAt: s.updated_at ? new Date(s.updated_at) : undefined,
  updatedBy: s.updated_by ?? undefined,
});

export function SalaryStructureProvider({ children }: { children: React.ReactNode }) {
  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, authLoading, hasPermission } = useAuth();

  const canView = hasPermission('view_salary_structures') || hasPermission('manage_salary_structures');

  const refresh = async (params?: { hospitalId?: string; employeeId?: string; status?: string }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token || !canView) {
      setSalaryStructures([]);
      return;
    }

    setLoading(true);
    try {
      const queryParams: any = {};
      if (params?.hospitalId) queryParams.hospital_id = params.hospitalId;
      if (params?.employeeId) queryParams.employee_id = params.employeeId;
      if (params?.status) queryParams.status = params.status;

      const { data } = await api.get('/salary-structures', {
        params: Object.keys(queryParams).length ? queryParams : undefined,
      });

      const records: any[] = data.data ?? data;
      setSalaryStructures(records.map(mapSalaryStructure));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load salary structures');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setSalaryStructures([]);
      return;
    }

    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, canView]);

  const serializePayload = (payload: Partial<SalaryStructure>) => {
    const body: any = {};
    if (payload.hospitalId) body.hospital_id = payload.hospitalId;
    if (payload.employeeId) body.employee_id = payload.employeeId;
    if (payload.effectiveFrom) {
      const dateValue = payload.effectiveFrom instanceof Date
        ? payload.effectiveFrom.toISOString().slice(0, 10)
        : String(payload.effectiveFrom);
      body.effective_from = dateValue;
    }
    if (payload.effectiveTo !== undefined) {
      body.effective_to = payload.effectiveTo
        ? (payload.effectiveTo instanceof Date
          ? payload.effectiveTo.toISOString().slice(0, 10)
          : String(payload.effectiveTo))
        : null;
    }
    if (payload.baseSalary !== undefined) body.base_salary = payload.baseSalary;
    if (payload.allowancesTotal !== undefined) body.allowances_total = payload.allowancesTotal;
    if (payload.deductionsTotal !== undefined) body.deductions_total = payload.deductionsTotal;
    if (payload.currency !== undefined) body.currency = payload.currency;
    if (payload.notes !== undefined) body.notes = payload.notes || null;
    if (payload.status) body.status = payload.status;
    if (payload.components !== undefined) {
      body.components = payload.components.map((component) => ({
        component_type: component.componentType,
        name: component.name,
        amount: component.amount,
        is_taxable: component.isTaxable,
        sort_order: component.sortOrder,
      }));
    }
    return body;
  };

  const addSalaryStructure = async (payload: Partial<SalaryStructure>) => {
    try {
      const { data } = await api.post('/salary-structures', serializePayload(payload));
      await refresh(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined);
      return mapSalaryStructure(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add salary structure');
      return null;
    }
  };

  const updateSalaryStructure = async (payload: Partial<SalaryStructure> & { id: string }) => {
    await api.put(`/salary-structures/${payload.id}`, serializePayload(payload));
    await refresh(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined);
  };

  const deleteSalaryStructure = async (id: string) => {
    await api.delete(`/salary-structures/${id}`);
    await refresh();
  };

  return (
    <SalaryStructureContext.Provider
      value={{ salaryStructures, refresh, addSalaryStructure, updateSalaryStructure, deleteSalaryStructure, loading }}
    >
      {children}
    </SalaryStructureContext.Provider>
  );
}

export function useSalaryStructures() {
  const context = useContext(SalaryStructureContext);
  if (!context) {
    throw new Error('useSalaryStructures must be used within SalaryStructureProvider');
  }
  return context;
}
