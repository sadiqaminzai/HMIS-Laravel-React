import React, { createContext, useContext, useEffect, useState } from 'react';
import { OtherIncome } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface OtherIncomeContextType {
  otherIncomes: OtherIncome[];
  refresh: (params?: { hospitalId?: string }) => Promise<void>;
  addOtherIncome: (payload: Partial<OtherIncome> & { documentFile?: File | null }) => Promise<OtherIncome | null>;
  updateOtherIncome: (payload: Partial<OtherIncome> & { id: string; documentFile?: File | null }) => Promise<void>;
  deleteOtherIncome: (id: string) => Promise<void>;
  loading: boolean;
}

const OtherIncomeContext = createContext<OtherIncomeContextType | undefined>(undefined);

const mapOtherIncome = (e: any): OtherIncome => ({
  id: String(e.id),
  hospitalId: String(e.hospital_id),
  otherIncomeCategoryId: String(e.other_income_category_id),
  sequenceId: Number(e.sequence_id ?? 0),
  title: e.title ?? '',
  amount: parseFloat(e.amount ?? 0),
  incomeDate: e.income_date ? new Date(e.income_date) : new Date(),
  paymentMethod: e.payment_method ?? '',
  reference: e.reference ?? '',
  documentUrl: e.document_url ?? null,
  notes: e.notes ?? '',
  status: (e.status ?? 'approved') as OtherIncome['status'],
  category: e.category
    ? {
        id: String(e.category.id),
        hospitalId: String(e.category.hospital_id),
        name: e.category.name ?? '',
        description: e.category.description ?? '',
        status: (e.category.status ?? 'active') as any,
      }
    : undefined,
  createdAt: e.created_at ? new Date(e.created_at) : undefined,
  createdBy: e.created_by ?? undefined,
  updatedAt: e.updated_at ? new Date(e.updated_at) : undefined,
  updatedBy: e.updated_by ?? undefined,
});

export function OtherIncomeProvider({ children }: { children: React.ReactNode }) {
  const [otherIncomes, setOtherIncomes] = useState<OtherIncome[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, authLoading, hasPermission } = useAuth();

  const refresh = async (params?: { hospitalId?: string }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      setOtherIncomes([]);
      return;
    }

    if (!hasPermission('view_other_incomes') && !hasPermission('manage_other_incomes')) {
      setOtherIncomes([]);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get('/other-incomes', {
        params: params?.hospitalId ? { hospital_id: params.hospitalId } : undefined,
      });
      const records: any[] = data.data ?? data;
      setOtherIncomes(records.map(mapOtherIncome));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load other incomes');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setOtherIncomes([]);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  const toFormData = (payload: Partial<OtherIncome> & { documentFile?: File | null }) => {
    const formData = new FormData();
    if (payload.hospitalId) formData.append('hospital_id', payload.hospitalId);
    if (payload.otherIncomeCategoryId) formData.append('other_income_category_id', payload.otherIncomeCategoryId);
    if (payload.title) formData.append('title', payload.title);
    if (payload.amount !== undefined) formData.append('amount', String(payload.amount));
    if (payload.incomeDate) {
      const dateValue = payload.incomeDate instanceof Date
        ? payload.incomeDate.toISOString().slice(0, 10)
        : String(payload.incomeDate);
      formData.append('income_date', dateValue);
    }
    if (payload.paymentMethod !== undefined) formData.append('payment_method', payload.paymentMethod || '');
    if (payload.reference !== undefined) formData.append('reference', payload.reference || '');
    if (payload.notes !== undefined) formData.append('notes', payload.notes || '');
    if (payload.status) formData.append('status', payload.status);
    if (payload.documentFile) formData.append('document', payload.documentFile);
    return formData;
  };

  const addOtherIncome = async (payload: Partial<OtherIncome> & { documentFile?: File | null }) => {
    try {
      const { data } = await api.post('/other-incomes', toFormData(payload), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await refresh(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined);
      return mapOtherIncome(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add other income');
      return null;
    }
  };

  const updateOtherIncome = async (payload: Partial<OtherIncome> & { id: string; documentFile?: File | null }) => {
    const formData = toFormData(payload);
    formData.append('_method', 'PUT');
    await api.post(`/other-incomes/${payload.id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    await refresh(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined);
  };

  const deleteOtherIncome = async (id: string) => {
    await api.delete(`/other-incomes/${id}`);
    await refresh();
  };

  return (
    <OtherIncomeContext.Provider
      value={{
        otherIncomes,
        refresh,
        addOtherIncome,
        updateOtherIncome,
        deleteOtherIncome,
        loading,
      }}
    >
      {children}
    </OtherIncomeContext.Provider>
  );
}

export function useOtherIncomes() {
  const context = useContext(OtherIncomeContext);
  if (!context) {
    throw new Error('useOtherIncomes must be used within OtherIncomeProvider');
  }
  return context;
}
