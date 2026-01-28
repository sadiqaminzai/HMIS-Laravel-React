import React, { createContext, useContext, useEffect, useState } from 'react';
import { Expense } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface ExpenseContextType {
  expenses: Expense[];
  refresh: (params?: { hospitalId?: string }) => Promise<void>;
  addExpense: (payload: Partial<Expense> & { documentFile?: File | null }) => Promise<Expense | null>;
  updateExpense: (payload: Partial<Expense> & { id: string; documentFile?: File | null }) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  loading: boolean;
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

const mapExpense = (e: any): Expense => ({
  id: String(e.id),
  hospitalId: String(e.hospital_id),
  expenseCategoryId: String(e.expense_category_id),
  sequenceId: Number(e.sequence_id ?? 0),
  title: e.title ?? '',
  amount: parseFloat(e.amount ?? 0),
  expenseDate: e.expense_date ? new Date(e.expense_date) : new Date(),
  paymentMethod: e.payment_method ?? '',
  reference: e.reference ?? '',
  documentUrl: e.document_url ?? null,
  notes: e.notes ?? '',
  status: (e.status ?? 'approved') as Expense['status'],
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

export function ExpenseProvider({ children }: { children: React.ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, authLoading, hasPermission } = useAuth();

  const refresh = async (params?: { hospitalId?: string }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      setExpenses([]);
      return;
    }

    if (!hasPermission('view_expenses') && !hasPermission('manage_expenses')) {
      setExpenses([]);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get('/expenses', {
        params: params?.hospitalId ? { hospital_id: params.hospitalId } : undefined,
      });
      const records: any[] = data.data ?? data;
      setExpenses(records.map(mapExpense));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load expenses');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setExpenses([]);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  const toFormData = (payload: Partial<Expense> & { documentFile?: File | null }) => {
    const formData = new FormData();
    if (payload.hospitalId) formData.append('hospital_id', payload.hospitalId);
    if (payload.expenseCategoryId) formData.append('expense_category_id', payload.expenseCategoryId);
    if (payload.title) formData.append('title', payload.title);
    if (payload.amount !== undefined) formData.append('amount', String(payload.amount));
    if (payload.expenseDate) {
      const dateValue = payload.expenseDate instanceof Date
        ? payload.expenseDate.toISOString().slice(0, 10)
        : String(payload.expenseDate);
      formData.append('expense_date', dateValue);
    }
    if (payload.paymentMethod !== undefined) formData.append('payment_method', payload.paymentMethod || '');
    if (payload.reference !== undefined) formData.append('reference', payload.reference || '');
    if (payload.notes !== undefined) formData.append('notes', payload.notes || '');
    if (payload.status) formData.append('status', payload.status);
    if (payload.documentFile) formData.append('document', payload.documentFile);
    return formData;
  };

  const addExpense = async (payload: Partial<Expense> & { documentFile?: File | null }) => {
    try {
      const { data } = await api.post('/expenses', toFormData(payload), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await refresh(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined);
      return mapExpense(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add expense');
      return null;
    }
  };

  const updateExpense = async (payload: Partial<Expense> & { id: string; documentFile?: File | null }) => {
    const formData = toFormData(payload);
    formData.append('_method', 'PUT');
    await api.post(`/expenses/${payload.id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    await refresh(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined);
  };

  const deleteExpense = async (id: string) => {
    await api.delete(`/expenses/${id}`);
    await refresh();
  };

  return (
    <ExpenseContext.Provider value={{ expenses, refresh, addExpense, updateExpense, deleteExpense, loading }}>
      {children}
    </ExpenseContext.Provider>
  );
}

export function useExpenses() {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpenses must be used within ExpenseProvider');
  }
  return context;
}
