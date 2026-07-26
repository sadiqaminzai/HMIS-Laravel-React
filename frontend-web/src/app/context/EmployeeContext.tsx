import React, { createContext, useContext, useEffect, useState } from 'react';
import { Employee } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface EmployeeContextType {
  employees: Employee[];
  refresh: (params?: { hospitalId?: string; departmentId?: string; designationId?: string }) => Promise<void>;
  addEmployee: (payload: Partial<Employee> & { profileImageFile?: File | null; contractDocumentFile?: File | null }) => Promise<Employee | null>;
  updateEmployee: (payload: Partial<Employee> & { id: string; profileImageFile?: File | null; contractDocumentFile?: File | null }) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  loading: boolean;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

const mapEmployee = (e: any): Employee => ({
  id: String(e.id),
  hospitalId: String(e.hospital_id),
  userId: e.user_id ? String(e.user_id) : undefined,
  departmentId: e.department_id ? String(e.department_id) : undefined,
  designationId: e.designation_id ? String(e.designation_id) : undefined,
  shiftId: e.shift_id ? String(e.shift_id) : undefined,
  employeeCode: e.employee_code ?? '',
  firstName: e.first_name ?? '',
  lastName: e.last_name ?? '',
  fullName: e.full_name ?? `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim(),
  gender: (e.gender ?? 'male') as Employee['gender'],
  dateOfBirth: e.date_of_birth ? new Date(e.date_of_birth) : undefined,
  phone: e.phone ?? '',
  email: e.email ?? '',
  address: e.address ?? '',
  emergencyContactName: e.emergency_contact_name ?? '',
  emergencyContactPhone: e.emergency_contact_phone ?? '',
  joiningDate: e.joining_date ? new Date(e.joining_date) : new Date(),
  employmentType: (e.employment_type ?? 'permanent') as Employee['employmentType'],
  basicSalary: Number(e.basic_salary ?? 0),
  status: (e.status ?? 'active') as Employee['status'],
  profileImageUrl: e.profile_image_url ?? null,
  contractDocumentUrl: e.contract_document_url ?? null,
  department: e.department
    ? {
        id: String(e.department.id),
        name: e.department.name ?? '',
      }
    : undefined,
  designation: e.designation
    ? {
        id: String(e.designation.id),
        name: e.designation.name ?? '',
      }
    : undefined,
  shift: e.shift
    ? {
        id: String(e.shift.id),
        name: e.shift.name ?? '',
        startTime: e.shift.start_time ?? '',
        endTime: e.shift.end_time ?? '',
      }
    : undefined,
  user: e.user
    ? {
        id: String(e.user.id),
        name: e.user.name ?? '',
        email: e.user.email ?? '',
      }
    : undefined,
  createdAt: e.created_at ? new Date(e.created_at) : undefined,
  createdBy: e.created_by ?? undefined,
  updatedAt: e.updated_at ? new Date(e.updated_at) : undefined,
  updatedBy: e.updated_by ?? undefined,
});

export function EmployeeProvider({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, authLoading, hasPermission } = useAuth();

  const canView = hasPermission('view_employees')
    || hasPermission('manage_employees')
    || hasPermission('view_employee_attendances')
    || hasPermission('manage_employee_attendances');

  const refresh = async (params?: { hospitalId?: string; departmentId?: string; designationId?: string }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token || !canView) {
      setEmployees([]);
      return;
    }

    setLoading(true);
    try {
      const queryParams: any = {};
      if (params?.hospitalId) queryParams.hospital_id = params.hospitalId;
      if (params?.departmentId) queryParams.department_id = params.departmentId;
      if (params?.designationId) queryParams.designation_id = params.designationId;

      const { data } = await api.get('/employees', {
        params: Object.keys(queryParams).length ? queryParams : undefined,
      });
      const records: any[] = data.data ?? data;
      setEmployees(records.map(mapEmployee));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load employees');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setEmployees([]);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, canView]);

  const toFormData = (payload: Partial<Employee> & { profileImageFile?: File | null; contractDocumentFile?: File | null }) => {
    const formData = new FormData();
    if (payload.hospitalId) formData.append('hospital_id', payload.hospitalId);
    if (payload.userId) formData.append('user_id', payload.userId);
    if (payload.departmentId !== undefined) formData.append('department_id', payload.departmentId || '');
    if (payload.designationId !== undefined) formData.append('designation_id', payload.designationId || '');
    if (payload.shiftId !== undefined) formData.append('shift_id', payload.shiftId || '');
    if (payload.employeeCode) formData.append('employee_code', payload.employeeCode);
    if (payload.firstName) formData.append('first_name', payload.firstName);
    if (payload.lastName) formData.append('last_name', payload.lastName);
    if (payload.gender) formData.append('gender', payload.gender);
    if (payload.dateOfBirth) {
      const dateValue = payload.dateOfBirth instanceof Date
        ? payload.dateOfBirth.toISOString().slice(0, 10)
        : String(payload.dateOfBirth);
      formData.append('date_of_birth', dateValue);
    }
    if (payload.phone !== undefined) formData.append('phone', payload.phone || '');
    if (payload.email !== undefined) formData.append('email', payload.email || '');
    if (payload.address !== undefined) formData.append('address', payload.address || '');
    if (payload.emergencyContactName !== undefined) formData.append('emergency_contact_name', payload.emergencyContactName || '');
    if (payload.emergencyContactPhone !== undefined) formData.append('emergency_contact_phone', payload.emergencyContactPhone || '');
    if (payload.joiningDate) {
      const dateValue = payload.joiningDate instanceof Date
        ? payload.joiningDate.toISOString().slice(0, 10)
        : String(payload.joiningDate);
      formData.append('joining_date', dateValue);
    }
    if (payload.employmentType) formData.append('employment_type', payload.employmentType);
    if (payload.basicSalary !== undefined) formData.append('basic_salary', String(payload.basicSalary));
    if (payload.status) formData.append('status', payload.status);
    if (payload.profileImageFile) formData.append('profile_image', payload.profileImageFile);
    if (payload.contractDocumentFile) formData.append('contract_document', payload.contractDocumentFile);
    return formData;
  };

  const addEmployee = async (payload: Partial<Employee> & { profileImageFile?: File | null; contractDocumentFile?: File | null }) => {
    try {
      const { data } = await api.post('/employees', toFormData(payload), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await refresh(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined);
      return mapEmployee(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add employee');
      return null;
    }
  };

  const updateEmployee = async (payload: Partial<Employee> & { id: string; profileImageFile?: File | null; contractDocumentFile?: File | null }) => {
    const formData = toFormData(payload);
    formData.append('_method', 'PUT');
    await api.post(`/employees/${payload.id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    await refresh(payload.hospitalId ? { hospitalId: payload.hospitalId } : undefined);
  };

  const deleteEmployee = async (id: string) => {
    await api.delete(`/employees/${id}`);
    await refresh();
  };

  return (
    <EmployeeContext.Provider value={{ employees, refresh, addEmployee, updateEmployee, deleteEmployee, loading }}>
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployees() {
  const context = useContext(EmployeeContext);
  if (!context) {
    throw new Error('useEmployees must be used within EmployeeProvider');
  }
  return context;
}
