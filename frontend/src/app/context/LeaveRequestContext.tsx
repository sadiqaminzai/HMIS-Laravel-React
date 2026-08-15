import React, { createContext, useContext, useEffect, useState } from 'react';
import { LeaveRequest } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface LeaveRequestContextType {
  leaveRequests: LeaveRequest[];
  refresh: (params?: { hospitalId?: string; employeeId?: string; status?: string; leaveType?: string; startDate?: string; endDate?: string }) => Promise<void>;
  addLeaveRequest: (payload: Partial<LeaveRequest>) => Promise<LeaveRequest | null>;
  updateLeaveRequest: (payload: Partial<LeaveRequest> & { id: string }) => Promise<void>;
  deleteLeaveRequest: (id: string) => Promise<void>;
  approveLeaveRequest: (id: string) => Promise<void>;
  rejectLeaveRequest: (id: string, rejectionReason?: string) => Promise<void>;
  cancelLeaveRequest: (id: string) => Promise<void>;
  loading: boolean;
}

const LeaveRequestContext = createContext<LeaveRequestContextType | undefined>(undefined);

const mapLeaveRequest = (l: any): LeaveRequest => ({
  id: String(l.id),
  hospitalId: String(l.hospital_id),
  employeeId: String(l.employee_id),
  approvedByUserId: l.approved_by_user_id ? String(l.approved_by_user_id) : undefined,
  leaveType: (l.leave_type ?? 'annual') as LeaveRequest['leaveType'],
  startDate: l.start_date ? new Date(l.start_date) : new Date(),
  endDate: l.end_date ? new Date(l.end_date) : new Date(),
  totalDays: Number(l.total_days ?? 1),
  reason: l.reason ?? '',
  status: (l.status ?? 'pending') as LeaveRequest['status'],
  approvedAt: l.approved_at ? new Date(l.approved_at) : undefined,
  rejectionReason: l.rejection_reason ?? '',
  employee: l.employee
    ? {
        id: String(l.employee.id),
        employeeCode: l.employee.employee_code ?? '',
        firstName: l.employee.first_name ?? '',
        lastName: l.employee.last_name ?? '',
        fullName: `${l.employee.first_name ?? ''} ${l.employee.last_name ?? ''}`.trim(),
      }
    : undefined,
  approvedBy: l.approved_by
    ? {
        id: String(l.approved_by.id),
        name: l.approved_by.name ?? '',
      }
    : undefined,
  createdAt: l.created_at ? new Date(l.created_at) : undefined,
  createdBy: l.created_by ?? undefined,
  updatedAt: l.updated_at ? new Date(l.updated_at) : undefined,
  updatedBy: l.updated_by ?? undefined,
});

export function LeaveRequestProvider({ children }: { children: React.ReactNode }) {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, authLoading, hasPermission } = useAuth();

  const canView = hasPermission('view_leave_requests') || hasPermission('manage_leave_requests');

  const refresh = async (params?: { hospitalId?: string; employeeId?: string; status?: string; leaveType?: string; startDate?: string; endDate?: string }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token || !canView) {
      setLeaveRequests([]);
      return;
    }

    setLoading(true);
    try {
      const queryParams: any = {};
      if (params?.hospitalId) queryParams.hospital_id = params.hospitalId;
      if (params?.employeeId) queryParams.employee_id = params.employeeId;
      if (params?.status) queryParams.status = params.status;
      if (params?.leaveType) queryParams.leave_type = params.leaveType;
      if (params?.startDate) queryParams.start_date = params.startDate;
      if (params?.endDate) queryParams.end_date = params.endDate;

      const { data } = await api.get('/leave-requests', {
        params: Object.keys(queryParams).length ? queryParams : undefined,
      });

      const records: any[] = data.data ?? data;
      setLeaveRequests(records.map(mapLeaveRequest));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load leave requests');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setLeaveRequests([]);
      return;
    }

    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, canView]);

  const serializePayload = (payload: Partial<LeaveRequest>) => {
    const body: any = {};
    if (payload.hospitalId) body.hospital_id = payload.hospitalId;
    if (payload.employeeId) body.employee_id = payload.employeeId;
    if (payload.leaveType) body.leave_type = payload.leaveType;
    if (payload.startDate) {
      const dateValue = payload.startDate instanceof Date
        ? payload.startDate.toISOString().slice(0, 10)
        : String(payload.startDate);
      body.start_date = dateValue;
    }
    if (payload.endDate) {
      const dateValue = payload.endDate instanceof Date
        ? payload.endDate.toISOString().slice(0, 10)
        : String(payload.endDate);
      body.end_date = dateValue;
    }
    if (payload.totalDays !== undefined) body.total_days = payload.totalDays;
    if (payload.reason !== undefined) body.reason = payload.reason || null;
    return body;
  };

  const addLeaveRequest = async (payload: Partial<LeaveRequest>) => {
    try {
      const { data } = await api.post('/leave-requests', serializePayload(payload));
      await refresh(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined);
      return mapLeaveRequest(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add leave request');
      return null;
    }
  };

  const updateLeaveRequest = async (payload: Partial<LeaveRequest> & { id: string }) => {
    await api.put(`/leave-requests/${payload.id}`, serializePayload(payload));
    await refresh(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined);
  };

  const deleteLeaveRequest = async (id: string) => {
    await api.delete(`/leave-requests/${id}`);
    await refresh();
  };

  const approveLeaveRequest = async (id: string) => {
    await api.post(`/leave-requests/${id}/approve`);
    await refresh();
  };

  const rejectLeaveRequest = async (id: string, rejectionReason?: string) => {
    await api.post(`/leave-requests/${id}/reject`, {
      rejection_reason: rejectionReason || null,
    });
    await refresh();
  };

  const cancelLeaveRequest = async (id: string) => {
    await api.post(`/leave-requests/${id}/cancel`);
    await refresh();
  };

  return (
    <LeaveRequestContext.Provider
      value={{
        leaveRequests,
        refresh,
        addLeaveRequest,
        updateLeaveRequest,
        deleteLeaveRequest,
        approveLeaveRequest,
        rejectLeaveRequest,
        cancelLeaveRequest,
        loading,
      }}
    >
      {children}
    </LeaveRequestContext.Provider>
  );
}

export function useLeaveRequests() {
  const context = useContext(LeaveRequestContext);
  if (!context) {
    throw new Error('useLeaveRequests must be used within LeaveRequestProvider');
  }
  return context;
}
