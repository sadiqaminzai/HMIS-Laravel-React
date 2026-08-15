import React, { createContext, useContext, useEffect, useState } from 'react';
import { ExpenseCategory } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface ExpenseCategoryContextType {
  categories: ExpenseCategory[];
  refresh: (params?: { hospitalId?: string }) => Promise<void>;
  addCategory: (payload: Partial<ExpenseCategory>) => Promise<ExpenseCategory | null>;
  updateCategory: (payload: Partial<ExpenseCategory> & { id: string }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  loading: boolean;
}

const ExpenseCategoryContext = createContext<ExpenseCategoryContextType | undefined>(undefined);

const mapCategory = (c: any): ExpenseCategory => ({
  id: String(c.id),
  hospitalId: String(c.hospital_id),
  name: c.name ?? '',
  description: c.description ?? '',
  status: (c.status ?? 'active') as ExpenseCategory['status'],
  createdAt: c.created_at ? new Date(c.created_at) : undefined,
  createdBy: c.created_by ?? undefined,
  updatedAt: c.updated_at ? new Date(c.updated_at) : undefined,
  updatedBy: c.updated_by ?? undefined,
});

export function ExpenseCategoryProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, authLoading, hasPermission } = useAuth();

  const refresh = async (params?: { hospitalId?: string }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      setCategories([]);
      return;
    }

    if (!hasPermission('view_expense_categories') && !hasPermission('manage_expense_categories')) {
      setCategories([]);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get('/expense-categories', {
        params: params?.hospitalId ? { hospital_id: params.hospitalId } : undefined,
      });
      const records: any[] = data.data ?? data;
      setCategories(records.map(mapCategory));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load expense categories');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setCategories([]);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  const serializePayload = (payload: Partial<ExpenseCategory>) => {
    const body: any = {};
    if (payload.hospitalId) body.hospital_id = payload.hospitalId;
    if (payload.name) body.name = payload.name;
    if (payload.description !== undefined) body.description = payload.description;
    if (payload.status) body.status = payload.status;
    return body;
  };

  const addCategory = async (payload: Partial<ExpenseCategory>) => {
    try {
      const { data } = await api.post('/expense-categories', serializePayload(payload));
      await refresh(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined);
      return mapCategory(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add expense category');
      return null;
    }
  };

  const updateCategory = async (payload: Partial<ExpenseCategory> & { id: string }) => {
    await api.put(`/expense-categories/${payload.id}`, serializePayload(payload));
    await refresh();
  };

  const deleteCategory = async (id: string) => {
    await api.delete(`/expense-categories/${id}`);
    await refresh();
  };

  return (
    <ExpenseCategoryContext.Provider
      value={{ categories, refresh, addCategory, updateCategory, deleteCategory, loading }}
    >
      {children}
    </ExpenseCategoryContext.Provider>
  );
}

export function useExpenseCategories() {
  const context = useContext(ExpenseCategoryContext);
  if (!context) {
    throw new Error('useExpenseCategories must be used within ExpenseCategoryProvider');
  }
  return context;
}
