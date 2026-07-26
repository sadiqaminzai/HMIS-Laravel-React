import React, { createContext, useContext, useEffect, useState } from 'react';
import { Shift } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface ShiftContextType {
  shifts: Shift[];
  refresh: (params?: { hospitalId?: string; status?: string }) => Promise<void>;
  addShift: (payload: Partial<Shift>) => Promise<Shift | null>;
  updateShift: (payload: Partial<Shift> & { id: string }) => Promise<void>;
  deleteShift: (id: string) => Promise<void>;
  loading: boolean;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

const normalizeTime = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const time = value.trim();
  return /^\d{2}:\d{2}(:\d{2})?$/.test(time) ? time.slice(0, 5) : time;
};

const mapShift = (s: any): Shift => ({
  id: String(s.id),
  hospitalId: String(s.hospital_id),
  name: s.name ?? '',
  code: s.code ?? '',
  startTime: normalizeTime(s.start_time) || '09:00',
  endTime: normalizeTime(s.end_time) || '17:00',
  graceMinutes: Number(s.grace_minutes ?? 0),
  isOvernight: Boolean(s.is_overnight),
  status: (s.status ?? 'active') as Shift['status'],
  description: s.description ?? '',
  createdAt: s.created_at ? new Date(s.created_at) : undefined,
  createdBy: s.created_by ?? undefined,
  updatedAt: s.updated_at ? new Date(s.updated_at) : undefined,
  updatedBy: s.updated_by ?? undefined,
});

export function ShiftProvider({ children }: { children: React.ReactNode }) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, authLoading, hasPermission } = useAuth();

  const canView = hasPermission('view_shifts')
    || hasPermission('manage_shifts')
    || hasPermission('view_employee_attendances')
    || hasPermission('manage_employee_attendances');

  const refresh = async (params?: { hospitalId?: string; status?: string }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token || !canView) {
      setShifts([]);
      return;
    }

    setLoading(true);
    try {
      const queryParams: any = {};
      if (params?.hospitalId) queryParams.hospital_id = params.hospitalId;
      if (params?.status) queryParams.status = params.status;

      const { data } = await api.get('/shifts', {
        params: Object.keys(queryParams).length ? queryParams : undefined,
      });
      const records: any[] = data.data ?? data;
      setShifts(records.map(mapShift));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load shifts');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setShifts([]);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, canView]);

  const serializePayload = (payload: Partial<Shift>) => {
    const body: any = {};
    if (payload.hospitalId) body.hospital_id = payload.hospitalId;
    if (payload.name) body.name = payload.name;
    if (payload.code !== undefined) body.code = payload.code || null;
    if (payload.startTime) body.start_time = normalizeTime(payload.startTime);
    if (payload.endTime) body.end_time = normalizeTime(payload.endTime);
    if (payload.graceMinutes !== undefined) body.grace_minutes = payload.graceMinutes;
    if (payload.status) body.status = payload.status;
    if (payload.description !== undefined) body.description = payload.description || null;
    return body;
  };

  const addShift = async (payload: Partial<Shift>) => {
    try {
      const { data } = await api.post('/shifts', serializePayload(payload));
      await refresh(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined);
      return mapShift(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add shift');
      return null;
    }
  };

  const updateShift = async (payload: Partial<Shift> & { id: string }) => {
    await api.put(`/shifts/${payload.id}`, serializePayload(payload));
    await refresh(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined);
  };

  const deleteShift = async (id: string) => {
    await api.delete(`/shifts/${id}`);
    await refresh();
  };

  return (
    <ShiftContext.Provider value={{ shifts, refresh, addShift, updateShift, deleteShift, loading }}>
      {children}
    </ShiftContext.Provider>
  );
}

export function useShifts() {
  const context = useContext(ShiftContext);
  if (!context) {
    throw new Error('useShifts must be used within ShiftProvider');
  }
  return context;
}
