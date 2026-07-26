import React, { createContext, useContext, useEffect, useState } from 'react';
import { Department } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface DepartmentContextType {
  departments: Department[];
  refresh: (params?: { hospitalId?: string }) => Promise<void>;
  addDepartment: (payload: Partial<Department>) => Promise<Department | null>;
  updateDepartment: (payload: Partial<Department> & { id: string }) => Promise<void>;
  deleteDepartment: (id: string) => Promise<void>;
  loading: boolean;
}

const DepartmentContext = createContext<DepartmentContextType | undefined>(undefined);

const mapDepartment = (d: any): Department => ({
  id: String(d.id),
  hospitalId: String(d.hospital_id),
  name: d.name ?? '',
  code: d.code ?? '',
  description: d.description ?? '',
  status: (d.status ?? 'active') as Department['status'],
  createdAt: d.created_at ? new Date(d.created_at) : undefined,
  createdBy: d.created_by ?? undefined,
  updatedAt: d.updated_at ? new Date(d.updated_at) : undefined,
  updatedBy: d.updated_by ?? undefined,
});

export function DepartmentProvider({ children }: { children: React.ReactNode }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, authLoading, hasPermission } = useAuth();

  const canView = hasPermission('view_departments')
    || hasPermission('manage_departments')
    || hasPermission('view_employee_attendances')
    || hasPermission('manage_employee_attendances');

  const refresh = async (params?: { hospitalId?: string }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token || !canView) {
      setDepartments([]);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get('/departments', {
        params: params?.hospitalId ? { hospital_id: params.hospitalId } : undefined,
      });
      const records: any[] = data.data ?? data;
      setDepartments(records.map(mapDepartment));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load departments');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setDepartments([]);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, canView]);

  const serializePayload = (payload: Partial<Department>) => {
    const body: any = {};
    if (payload.hospitalId) body.hospital_id = payload.hospitalId;
    if (payload.name) body.name = payload.name;
    if (payload.code !== undefined) body.code = payload.code;
    if (payload.description !== undefined) body.description = payload.description;
    if (payload.status) body.status = payload.status;
    return body;
  };

  const addDepartment = async (payload: Partial<Department>) => {
    try {
      const { data } = await api.post('/departments', serializePayload(payload));
      await refresh(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined);
      return mapDepartment(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add department');
      return null;
    }
  };

  const updateDepartment = async (payload: Partial<Department> & { id: string }) => {
    await api.put(`/departments/${payload.id}`, serializePayload(payload));
    await refresh();
  };

  const deleteDepartment = async (id: string) => {
    await api.delete(`/departments/${id}`);
    await refresh();
  };

  return (
    <DepartmentContext.Provider
      value={{ departments, refresh, addDepartment, updateDepartment, deleteDepartment, loading }}
    >
      {children}
    </DepartmentContext.Provider>
  );
}

export function useDepartments() {
  const context = useContext(DepartmentContext);
  if (!context) {
    throw new Error('useDepartments must be used within DepartmentProvider');
  }
  return context;
}
