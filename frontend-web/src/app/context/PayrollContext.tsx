import React, { createContext, useContext, useEffect, useState } from 'react';
import { PayrollBatch, PayrollItem } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface PayrollContextType {
  payrollBatches: PayrollBatch[];
  payrollItems: PayrollItem[];
  refreshBatches: (params?: { hospitalId?: string; payrollMonth?: string; status?: string; includeItems?: boolean }) => Promise<void>;
  refreshItems: (params?: { hospitalId?: string; payrollBatchId?: string; employeeId?: string; status?: string }) => Promise<void>;
  createPayrollBatch: (payload: Partial<PayrollBatch>) => Promise<PayrollBatch | null>;
  updatePayrollBatch: (payload: Partial<PayrollBatch> & { id: string }) => Promise<void>;
  generatePayroll: (payload: { hospitalId?: string; payrollMonth: string; employeeIds?: string[]; currency?: string; notes?: string }) => Promise<PayrollBatch | null>;
  approvePayrollBatch: (id: string) => Promise<void>;
  postPayrollBatch: (id: string, paymentMethod?: string) => Promise<void>;
  voidPayrollBatch: (id: string) => Promise<void>;
  deletePayrollBatch: (id: string) => Promise<void>;
  updatePayrollItem: (payload: Partial<PayrollItem> & { id: string }) => Promise<void>;
  deletePayrollItem: (id: string) => Promise<void>;
  getPayslip: (payrollItemId: string) => Promise<any>;
  loading: boolean;
}

const PayrollContext = createContext<PayrollContextType | undefined>(undefined);

const mapPayrollItem = (item: any): PayrollItem => ({
  id: String(item.id),
  hospitalId: String(item.hospital_id),
  payrollBatchId: String(item.payroll_batch_id),
  employeeId: String(item.employee_id),
  salaryStructureId: item.salary_structure_id ? String(item.salary_structure_id) : undefined,
  slipNumber: item.slip_number ?? '',
  baseSalary: Number(item.base_salary ?? 0),
  allowancesTotal: Number(item.allowances_total ?? 0),
  deductionsTotal: Number(item.deductions_total ?? 0),
  attendanceDays: Number(item.attendance_days ?? 0),
  payableDays: Number(item.payable_days ?? 0),
  overtimeAmount: Number(item.overtime_amount ?? 0),
  adjustmentsAmount: Number(item.adjustments_amount ?? 0),
  finalAmount: Number(item.final_amount ?? 0),
  status: (item.status ?? 'pending') as PayrollItem['status'],
  paidAt: item.paid_at ? new Date(item.paid_at) : undefined,
  paymentMethod: item.payment_method ?? '',
  notes: item.notes ?? '',
  employee: item.employee
    ? {
        id: String(item.employee.id),
        employeeCode: item.employee.employee_code ?? '',
        firstName: item.employee.first_name ?? '',
        lastName: item.employee.last_name ?? '',
        fullName: `${item.employee.first_name ?? ''} ${item.employee.last_name ?? ''}`.trim(),
      }
    : undefined,
  batch: item.batch
    ? {
        id: String(item.batch.id),
        payrollMonth: item.batch.payroll_month ?? '',
        status: (item.batch.status ?? 'draft') as PayrollItem['batch']['status'],
        currency: item.batch.currency ?? 'AFN',
      }
    : undefined,
  createdAt: item.created_at ? new Date(item.created_at) : undefined,
  createdBy: item.created_by ?? undefined,
  updatedAt: item.updated_at ? new Date(item.updated_at) : undefined,
  updatedBy: item.updated_by ?? undefined,
});

const mapPayrollBatch = (batch: any): PayrollBatch => ({
  id: String(batch.id),
  hospitalId: String(batch.hospital_id),
  payrollMonth: batch.payroll_month ?? '',
  status: (batch.status ?? 'draft') as PayrollBatch['status'],
  totalEmployees: Number(batch.total_employees ?? 0),
  grossAmount: Number(batch.gross_amount ?? 0),
  deductionsAmount: Number(batch.deductions_amount ?? 0),
  netAmount: Number(batch.net_amount ?? 0),
  currency: batch.currency ?? 'AFN',
  generatedBy: batch.generated_by ?? undefined,
  approvedBy: batch.approved_by ?? undefined,
  postedBy: batch.posted_by ?? undefined,
  generatedAt: batch.generated_at ? new Date(batch.generated_at) : undefined,
  approvedAt: batch.approved_at ? new Date(batch.approved_at) : undefined,
  postedAt: batch.posted_at ? new Date(batch.posted_at) : undefined,
  notes: batch.notes ?? '',
  items: Array.isArray(batch.items) ? batch.items.map(mapPayrollItem) : undefined,
  itemsCount: Number(batch.items_count ?? (Array.isArray(batch.items) ? batch.items.length : 0)),
  createdAt: batch.created_at ? new Date(batch.created_at) : undefined,
  createdBy: batch.created_by ?? undefined,
  updatedAt: batch.updated_at ? new Date(batch.updated_at) : undefined,
  updatedBy: batch.updated_by ?? undefined,
});

export function PayrollProvider({ children }: { children: React.ReactNode }) {
  const [payrollBatches, setPayrollBatches] = useState<PayrollBatch[]>([]);
  const [payrollItems, setPayrollItems] = useState<PayrollItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, authLoading, hasPermission } = useAuth();

  const canViewBatches = hasPermission('view_payroll_batches') || hasPermission('manage_payroll_batches');
  const canViewItems = hasPermission('view_payroll_items') || hasPermission('manage_payroll_items');

  const refreshBatches = async (params?: { hospitalId?: string; payrollMonth?: string; status?: string; includeItems?: boolean }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token || !canViewBatches) {
      setPayrollBatches([]);
      return;
    }

    setLoading(true);
    try {
      const queryParams: any = {};
      if (params?.hospitalId) queryParams.hospital_id = params.hospitalId;
      if (params?.payrollMonth) queryParams.payroll_month = params.payrollMonth;
      if (params?.status) queryParams.status = params.status;
      if (params?.includeItems) queryParams.include_items = 1;

      const { data } = await api.get('/payroll-batches', {
        params: Object.keys(queryParams).length ? queryParams : undefined,
      });

      const records: any[] = data.data ?? data;
      setPayrollBatches(records.map(mapPayrollBatch));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load payroll batches');
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshItems = async (params?: { hospitalId?: string; payrollBatchId?: string; employeeId?: string; status?: string }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token || !canViewItems) {
      setPayrollItems([]);
      return;
    }

    setLoading(true);
    try {
      const queryParams: any = {};
      if (params?.hospitalId) queryParams.hospital_id = params.hospitalId;
      if (params?.payrollBatchId) queryParams.payroll_batch_id = params.payrollBatchId;
      if (params?.employeeId) queryParams.employee_id = params.employeeId;
      if (params?.status) queryParams.status = params.status;

      const { data } = await api.get('/payroll-items', {
        params: Object.keys(queryParams).length ? queryParams : undefined,
      });

      const records: any[] = data.data ?? data;
      setPayrollItems(records.map(mapPayrollItem));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load payroll items');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setPayrollBatches([]);
      setPayrollItems([]);
      return;
    }

    if (canViewBatches) {
      refreshBatches();
    }

    if (canViewItems) {
      refreshItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, canViewBatches, canViewItems]);

  const createPayrollBatch = async (payload: Partial<PayrollBatch>) => {
    try {
      const { data } = await api.post('/payroll-batches', {
        hospital_id: payload.hospitalId,
        payroll_month: payload.payrollMonth,
        currency: payload.currency,
        notes: payload.notes,
      });
      await refreshBatches(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined);
      return mapPayrollBatch(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create payroll batch');
      return null;
    }
  };

  const updatePayrollBatch = async (payload: Partial<PayrollBatch> & { id: string }) => {
    await api.put(`/payroll-batches/${payload.id}`, {
      currency: payload.currency,
      notes: payload.notes,
    });
    await refreshBatches(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined);
  };

  const generatePayroll = async (payload: { hospitalId?: string; payrollMonth: string; employeeIds?: string[]; currency?: string; notes?: string }) => {
    try {
      const { data } = await api.post('/payroll-batches/generate', {
        hospital_id: payload.hospitalId,
        payroll_month: payload.payrollMonth,
        employee_ids: payload.employeeIds,
        currency: payload.currency,
        notes: payload.notes,
      });
      await Promise.all([
        refreshBatches(payload.hospitalId ? { hospitalId: payload.hospitalId, includeItems: true } : { includeItems: true }),
        refreshItems(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined),
      ]);
      return mapPayrollBatch(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to generate payroll');
      return null;
    }
  };

  const approvePayrollBatch = async (id: string) => {
    await api.post(`/payroll-batches/${id}/approve`);
    await Promise.all([refreshBatches({ includeItems: true }), refreshItems()]);
  };

  const postPayrollBatch = async (id: string, paymentMethod?: string) => {
    await api.post(`/payroll-batches/${id}/post`, {
      payment_method: paymentMethod || null,
    });
    await Promise.all([refreshBatches({ includeItems: true }), refreshItems()]);
  };

  const voidPayrollBatch = async (id: string) => {
    await api.post(`/payroll-batches/${id}/void`);
    await Promise.all([refreshBatches({ includeItems: true }), refreshItems()]);
  };

  const deletePayrollBatch = async (id: string) => {
    await api.delete(`/payroll-batches/${id}`);
    await Promise.all([refreshBatches(), refreshItems()]);
  };

  const updatePayrollItem = async (payload: Partial<PayrollItem> & { id: string }) => {
    await api.put(`/payroll-items/${payload.id}`, {
      allowances_total: payload.allowancesTotal,
      deductions_total: payload.deductionsTotal,
      attendance_days: payload.attendanceDays,
      payable_days: payload.payableDays,
      overtime_amount: payload.overtimeAmount,
      adjustments_amount: payload.adjustmentsAmount,
      payment_method: payload.paymentMethod,
      notes: payload.notes,
      status: payload.status,
    });

    await Promise.all([refreshItems(), refreshBatches({ includeItems: true })]);
  };

  const deletePayrollItem = async (id: string) => {
    await api.delete(`/payroll-items/${id}`);
    await Promise.all([refreshItems(), refreshBatches({ includeItems: true })]);
  };

  const getPayslip = async (payrollItemId: string) => {
    const { data } = await api.get(`/payroll-items/${payrollItemId}/payslip`);
    return data;
  };

  return (
    <PayrollContext.Provider
      value={{
        payrollBatches,
        payrollItems,
        refreshBatches,
        refreshItems,
        createPayrollBatch,
        updatePayrollBatch,
        generatePayroll,
        approvePayrollBatch,
        postPayrollBatch,
        voidPayrollBatch,
        deletePayrollBatch,
        updatePayrollItem,
        deletePayrollItem,
        getPayslip,
        loading,
      }}
    >
      {children}
    </PayrollContext.Provider>
  );
}

export function usePayroll() {
  const context = useContext(PayrollContext);
  if (!context) {
    throw new Error('usePayroll must be used within PayrollProvider');
  }
  return context;
}
