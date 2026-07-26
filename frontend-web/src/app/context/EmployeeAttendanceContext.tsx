import React, { createContext, useContext, useEffect, useState } from 'react';
import { EmployeeAttendance } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface EmployeeAttendanceContextType {
  attendances: EmployeeAttendance[];
  refresh: (params?: { hospitalId?: string; employeeId?: string; departmentId?: string; shiftId?: string; status?: string; startDate?: string; endDate?: string }) => Promise<void>;
  addAttendance: (payload: Partial<EmployeeAttendance>) => Promise<EmployeeAttendance | null>;
  bulkAddAttendance: (payload: {
    hospitalId?: string;
    departmentId?: string;
    employeeIds?: string[];
    attendanceDate: Date | string;
    shiftId?: string;
    status?: EmployeeAttendance['status'];
    checkInTime?: string;
    checkOutTime?: string;
    notes?: string;
    entries?: Array<{
      employeeId: string;
      status?: EmployeeAttendance['status'];
      checkInTime?: string;
      checkOutTime?: string;
      shiftId?: string;
      notes?: string;
    }>;
  }) => Promise<number>;
  updateAttendance: (payload: Partial<EmployeeAttendance> & { id: string }) => Promise<void>;
  deleteAttendance: (id: string) => Promise<void>;
  exportAttendanceCsv: (params?: { hospitalId?: string; departmentId?: string; startDate?: string; endDate?: string }) => Promise<void>;
  importAttendanceCsv: (file: File, params?: { hospitalId?: string }) => Promise<{ success: number; failed: number }>;
  loading: boolean;
}

const EmployeeAttendanceContext = createContext<EmployeeAttendanceContextType | undefined>(undefined);

const normalizeTime = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const time = value.trim();
  return /^\d{2}:\d{2}(:\d{2})?$/.test(time) ? time.slice(0, 5) : time;
};

const mapAttendance = (a: any): EmployeeAttendance => ({
  id: String(a.id),
  hospitalId: String(a.hospital_id),
  employeeId: String(a.employee_id),
  shiftId: a.shift_id ? String(a.shift_id) : undefined,
  attendanceDate: a.attendance_date ? new Date(a.attendance_date) : new Date(),
  checkInTime: normalizeTime(a.check_in_time),
  checkOutTime: normalizeTime(a.check_out_time),
  status: (a.status ?? 'present') as EmployeeAttendance['status'],
  notes: a.notes ?? '',
  employee: a.employee
    ? {
        id: String(a.employee.id),
        employeeCode: a.employee.employee_code ?? '',
        firstName: a.employee.first_name ?? '',
        lastName: a.employee.last_name ?? '',
        fullName: `${a.employee.first_name ?? ''} ${a.employee.last_name ?? ''}`.trim(),
        departmentId: a.employee.department_id ? String(a.employee.department_id) : undefined,
        departmentName: a.employee.department?.name ?? '',
      }
    : undefined,
  shift: a.shift
    ? {
        id: String(a.shift.id),
        name: a.shift.name ?? '',
        startTime: normalizeTime(a.shift.start_time),
        endTime: normalizeTime(a.shift.end_time),
      }
    : undefined,
  createdAt: a.created_at ? new Date(a.created_at) : undefined,
  createdBy: a.created_by ?? undefined,
  updatedAt: a.updated_at ? new Date(a.updated_at) : undefined,
  updatedBy: a.updated_by ?? undefined,
});

export function EmployeeAttendanceProvider({ children }: { children: React.ReactNode }) {
  const [attendances, setAttendances] = useState<EmployeeAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, authLoading, hasPermission } = useAuth();

  const canView = hasPermission('view_employee_attendances') || hasPermission('manage_employee_attendances');

  const refresh = async (params?: { hospitalId?: string; employeeId?: string; departmentId?: string; shiftId?: string; status?: string; startDate?: string; endDate?: string }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token || !canView) {
      setAttendances([]);
      return;
    }

    setLoading(true);
    try {
      const queryParams: any = {};
      if (params?.hospitalId) queryParams.hospital_id = params.hospitalId;
      if (params?.employeeId) queryParams.employee_id = params.employeeId;
      if (params?.departmentId) queryParams.department_id = params.departmentId;
      if (params?.shiftId) queryParams.shift_id = params.shiftId;
      if (params?.status) queryParams.status = params.status;
      if (params?.startDate) queryParams.start_date = params.startDate;
      if (params?.endDate) queryParams.end_date = params.endDate;

      const { data } = await api.get('/employee-attendances', {
        params: Object.keys(queryParams).length ? queryParams : undefined,
      });

      const records: any[] = data.data ?? data;
      setAttendances(records.map(mapAttendance));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load attendance records');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setAttendances([]);
      return;
    }

    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, canView]);

  const serializePayload = (payload: Partial<EmployeeAttendance>) => {
    const body: any = {};
    if (payload.hospitalId) body.hospital_id = payload.hospitalId;
    if (payload.employeeId) body.employee_id = payload.employeeId;
    if (payload.shiftId !== undefined) body.shift_id = payload.shiftId || null;
    if (payload.attendanceDate) {
      const dateValue = payload.attendanceDate instanceof Date
        ? payload.attendanceDate.toISOString().slice(0, 10)
        : String(payload.attendanceDate);
      body.attendance_date = dateValue;
    }
    if (payload.checkInTime !== undefined) body.check_in_time = normalizeTime(payload.checkInTime) || null;
    if (payload.checkOutTime !== undefined) body.check_out_time = normalizeTime(payload.checkOutTime) || null;
    if (payload.status) body.status = payload.status;
    if (payload.notes !== undefined) body.notes = payload.notes || null;
    return body;
  };

  const addAttendance = async (payload: Partial<EmployeeAttendance>) => {
    try {
      const { data } = await api.post('/employee-attendances', serializePayload(payload));
      await refresh(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined);
      return mapAttendance(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add attendance');
      return null;
    }
  };

  const bulkAddAttendance = async (payload: {
    hospitalId?: string;
    departmentId?: string;
    employeeIds?: string[];
    attendanceDate: Date | string;
    shiftId?: string;
    status?: EmployeeAttendance['status'];
    checkInTime?: string;
    checkOutTime?: string;
    notes?: string;
    entries?: Array<{
      employeeId: string;
      status?: EmployeeAttendance['status'];
      checkInTime?: string;
      checkOutTime?: string;
      shiftId?: string;
      notes?: string;
    }>;
  }) => {
    const body: any = {
      attendance_date: payload.attendanceDate instanceof Date
        ? payload.attendanceDate.toISOString().slice(0, 10)
        : String(payload.attendanceDate),
    };

    if (payload.hospitalId) body.hospital_id = payload.hospitalId;
    if (payload.departmentId) body.department_id = payload.departmentId;
    if (payload.employeeIds && payload.employeeIds.length > 0) body.employee_ids = payload.employeeIds;
    if (payload.shiftId) body.shift_id = payload.shiftId;
    if (payload.status) body.status = payload.status;
    if (payload.checkInTime !== undefined) body.check_in_time = normalizeTime(payload.checkInTime) || null;
    if (payload.checkOutTime !== undefined) body.check_out_time = normalizeTime(payload.checkOutTime) || null;
    if (payload.notes !== undefined) body.notes = payload.notes || null;
    if (payload.entries && payload.entries.length > 0) {
      body.entries = payload.entries.map((entry) => ({
        employee_id: entry.employeeId,
        status: entry.status,
        check_in_time: normalizeTime(entry.checkInTime) || null,
        check_out_time: normalizeTime(entry.checkOutTime) || null,
        shift_id: entry.shiftId || null,
        notes: entry.notes || null,
      }));
    }

    const { data } = await api.post('/employee-attendances/bulk', body);
    await refresh(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined);
    return Number(data?.count ?? 0);
  };

  const updateAttendance = async (payload: Partial<EmployeeAttendance> & { id: string }) => {
    await api.put(`/employee-attendances/${payload.id}`, serializePayload(payload));
    await refresh(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined);
  };

  const deleteAttendance = async (id: string) => {
    await api.delete(`/employee-attendances/${id}`);
    await refresh();
  };

  const exportAttendanceCsv = async (params?: { hospitalId?: string; departmentId?: string; startDate?: string; endDate?: string }) => {
    const queryParams: any = {};
    if (params?.hospitalId) queryParams.hospital_id = params.hospitalId;
    if (params?.departmentId) queryParams.department_id = params.departmentId;
    if (params?.startDate) queryParams.start_date = params.startDate;
    if (params?.endDate) queryParams.end_date = params.endDate;

    const response = await api.get('/employee-attendances/export', {
      params: Object.keys(queryParams).length ? queryParams : undefined,
      responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `employee_attendance_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const importAttendanceCsv = async (file: File, params?: { hospitalId?: string }) => {
    const formData = new FormData();
    formData.append('file', file);
    if (params?.hospitalId) {
      formData.append('hospital_id', params.hospitalId);
    }

    const { data } = await api.post('/employee-attendances/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    await refresh(params?.hospitalId ? { hospitalId: params.hospitalId } : undefined);

    return {
      success: Number(data?.success ?? 0),
      failed: Number(data?.failed ?? 0),
    };
  };

  return (
    <EmployeeAttendanceContext.Provider
      value={{
        attendances,
        refresh,
        addAttendance,
        bulkAddAttendance,
        updateAttendance,
        deleteAttendance,
        exportAttendanceCsv,
        importAttendanceCsv,
        loading,
      }}
    >
      {children}
    </EmployeeAttendanceContext.Provider>
  );
}

export function useEmployeeAttendances() {
  const context = useContext(EmployeeAttendanceContext);
  if (!context) {
    throw new Error('useEmployeeAttendances must be used within EmployeeAttendanceProvider');
  }
  return context;
}
