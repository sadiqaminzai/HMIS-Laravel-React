import React, { createContext, useContext, useEffect, useState } from 'react';
import { OtherIncomeCategory } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface OtherIncomeCategoryContextType {
  categories: OtherIncomeCategory[];
  refresh: (params?: { hospitalId?: string }) => Promise<void>;
  addCategory: (payload: Partial<OtherIncomeCategory>) => Promise<OtherIncomeCategory | null>;
  updateCategory: (payload: Partial<OtherIncomeCategory> & { id: string }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  loading: boolean;
}

const OtherIncomeCategoryContext = createContext<OtherIncomeCategoryContextType | undefined>(undefined);

const mapCategory = (c: any): OtherIncomeCategory => ({
  id: String(c.id),
  hospitalId: String(c.hospital_id),
  name: c.name ?? '',
  description: c.description ?? '',
  status: (c.status ?? 'active') as OtherIncomeCategory['status'],
  createdAt: c.created_at ? new Date(c.created_at) : undefined,
  createdBy: c.created_by ?? undefined,
  updatedAt: c.updated_at ? new Date(c.updated_at) : undefined,
  updatedBy: c.updated_by ?? undefined,
});

export function OtherIncomeCategoryProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<OtherIncomeCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, authLoading, hasPermission } = useAuth();

  const refresh = async (params?: { hospitalId?: string }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      setCategories([]);
      return;
    }

    if (!hasPermission('view_other_income_categories') && !hasPermission('manage_other_income_categories')) {
      setCategories([]);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get('/other-income-categories', {
        params: params?.hospitalId ? { hospital_id: params.hospitalId } : undefined,
      });
      const records: any[] = data.data ?? data;
      setCategories(records.map(mapCategory));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load other income categories');
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

  const serializePayload = (payload: Partial<OtherIncomeCategory>) => {
    const body: any = {};
    if (payload.hospitalId) body.hospital_id = payload.hospitalId;
    if (payload.name) body.name = payload.name;
    if (payload.description !== undefined) body.description = payload.description;
    if (payload.status) body.status = payload.status;
    return body;
  };

  const addCategory = async (payload: Partial<OtherIncomeCategory>) => {
    try {
      const { data } = await api.post('/other-income-categories', serializePayload(payload));
      await refresh(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined);
      return mapCategory(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add other income category');
      return null;
    }
  };

  const updateCategory = async (payload: Partial<OtherIncomeCategory> & { id: string }) => {
    await api.put(`/other-income-categories/${payload.id}`, serializePayload(payload));
    await refresh();
  };

  const deleteCategory = async (id: string) => {
    await api.delete(`/other-income-categories/${id}`);
    await refresh();
  };

  return (
    <OtherIncomeCategoryContext.Provider
      value={{ categories, refresh, addCategory, updateCategory, deleteCategory, loading }}
    >
      {children}
    </OtherIncomeCategoryContext.Provider>
  );
}

export function useOtherIncomeCategories() {
  const context = useContext(OtherIncomeCategoryContext);
  if (!context) {
    throw new Error('useOtherIncomeCategories must be used within OtherIncomeCategoryProvider');
  }
  return context;
}
