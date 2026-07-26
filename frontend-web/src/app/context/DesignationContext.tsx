import React, { createContext, useContext, useEffect, useState } from 'react';
import { Designation } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface DesignationContextType {
  designations: Designation[];
  refresh: (params?: { hospitalId?: string; departmentId?: string }) => Promise<void>;
  addDesignation: (payload: Partial<Designation>) => Promise<Designation | null>;
  updateDesignation: (payload: Partial<Designation> & { id: string }) => Promise<void>;
  deleteDesignation: (id: string) => Promise<void>;
  loading: boolean;
}

const DesignationContext = createContext<DesignationContextType | undefined>(undefined);

const mapDesignation = (d: any): Designation => ({
  id: String(d.id),
  hospitalId: String(d.hospital_id),
  departmentId: d.department_id ? String(d.department_id) : undefined,
  name: d.name ?? '',
  description: d.description ?? '',
  status: (d.status ?? 'active') as Designation['status'],
  department: d.department
    ? {
        id: String(d.department.id),
        name: d.department.name ?? '',
      }
    : undefined,
  createdAt: d.created_at ? new Date(d.created_at) : undefined,
  createdBy: d.created_by ?? undefined,
  updatedAt: d.updated_at ? new Date(d.updated_at) : undefined,
  updatedBy: d.updated_by ?? undefined,
});

export function DesignationProvider({ children }: { children: React.ReactNode }) {
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, authLoading, hasPermission } = useAuth();

  const canView = hasPermission('view_designations') || hasPermission('manage_designations');

  const refresh = async (params?: { hospitalId?: string; departmentId?: string }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token || !canView) {
      setDesignations([]);
      return;
    }

    setLoading(true);
    try {
      const queryParams: any = {};
      if (params?.hospitalId) queryParams.hospital_id = params.hospitalId;
      if (params?.departmentId) queryParams.department_id = params.departmentId;

      const { data } = await api.get('/designations', {
        params: Object.keys(queryParams).length ? queryParams : undefined,
      });
      const records: any[] = data.data ?? data;
      setDesignations(records.map(mapDesignation));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load designations');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setDesignations([]);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, canView]);

  const serializePayload = (payload: Partial<Designation>) => {
    const body: any = {};
    if (payload.hospitalId) body.hospital_id = payload.hospitalId;
    if (payload.departmentId !== undefined) body.department_id = payload.departmentId || null;
    if (payload.name) body.name = payload.name;
    if (payload.description !== undefined) body.description = payload.description;
    if (payload.status) body.status = payload.status;
    return body;
  };

  const addDesignation = async (payload: Partial<Designation>) => {
    try {
      const { data } = await api.post('/designations', serializePayload(payload));
      await refresh(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined);
      return mapDesignation(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add designation');
      return null;
    }
  };

  const updateDesignation = async (payload: Partial<Designation> & { id: string }) => {
    await api.put(`/designations/${payload.id}`, serializePayload(payload));
    await refresh();
  };

  const deleteDesignation = async (id: string) => {
    await api.delete(`/designations/${id}`);
    await refresh();
  };

  return (
    <DesignationContext.Provider
      value={{ designations, refresh, addDesignation, updateDesignation, deleteDesignation, loading }}
    >
      {children}
    </DesignationContext.Provider>
  );
}

export function useDesignations() {
  const context = useContext(DesignationContext);
  if (!context) {
    throw new Error('useDesignations must be used within DesignationProvider');
  }
  return context;
}
