import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appointment } from '../types';
import { parseDateOnly } from '../utils/date';
import api from '../../api/axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface AppointmentContextType {
  appointments: Appointment[];
  refresh: () => Promise<void>;
  addAppointment: (payload: Partial<Appointment>) => Promise<void>;
  updateAppointment: (payload: Partial<Appointment> & { id: string }) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  loading: boolean;
}

const AppointmentContext = createContext<AppointmentContextType | undefined>(undefined);

const normalizeStatus = (status: any): Appointment['status'] => {
  const raw = String(status ?? '').toLowerCase().trim();
  if (raw === 'scheduled' || raw === 'completed' || raw === 'cancelled' || raw === 'no_show') {
    return raw as Appointment['status'];
  }
  // Treat unknown/empty statuses as cancelled so they are excluded from scheduled-only flows.
  return 'cancelled';
};

const mapAppointment = (a: any): Appointment => ({
  id: String(a.id),
  hospitalId: String(a.hospital_id),
  appointmentNumber: a.appointment_number ?? '',
  patientId: a.patient_id ? String(a.patient_id) : '',
  patientName: a.patient_name ?? a.patient?.name ?? '',
  patientAge: Number(a.patient_age ?? a.patient?.age ?? 0),
  patientGender: a.patient_gender ?? a.patient?.gender ?? 'other',
  doctorId: a.doctor_id ? String(a.doctor_id) : '',
  doctorName: a.doctor?.name ?? '',
  appointmentDate: parseDateOnly(a.appointment_date) ?? new Date(),
  appointmentTime: a.appointment_time ?? '',
  reason: a.reason ?? '',
  status: normalizeStatus(a.status),
  notes: a.notes ?? '',
  originalFeeAmount: Number(a.original_fee_amount ?? 0),
  discountEnabled: Boolean(a.discount_enabled ?? false),
  discountTypeId: a.discount_type_id ? String(a.discount_type_id) : undefined,
  discountAmount: Number(a.discount_amount ?? 0),
  totalAmount: Number(a.total_amount ?? 0),
  currency: a.currency ?? 'AFN',
  paymentStatus: (a.payment_status ?? 'pending') as Appointment['paymentStatus'],
  createdAt: a.created_at ? new Date(a.created_at) : new Date(),
  updatedAt: a.updated_at ? new Date(a.updated_at) : undefined,
});

export function AppointmentProvider({ children }: { children: React.ReactNode }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, authLoading, hasPermission, user } = useAuth();

  const refresh = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      setAppointments([]);
      return;
    }

    // Backend: /appointments is guarded by permission OR (doctor).
    // Allow doctors to load their own appointments even if their DB role permissions are not configured.
    const isDoctor = String(user?.role || '').toLowerCase() === 'doctor';
    if (
      !isDoctor &&
      !hasPermission('view_appointments') &&
      !hasPermission('manage_appointments') &&
      !hasPermission('schedule_appointments')
    ) {
      setAppointments([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/appointments');
      const records: any[] = data.data ?? data;
      setAppointments(records.map(mapAppointment));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load appointments');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setAppointments([]);
      return;
    }
    refresh();
  }, [isAuthenticated, authLoading, user?.id, user?.role]);

  const addAppointment = async (payload: Partial<Appointment>) => {
    await api.post('/appointments', serializePayload(payload));
    await refresh();
  };

  const updateAppointment = async (payload: Partial<Appointment> & { id: string }) => {
    await api.put(`/appointments/${payload.id}`, serializePayload(payload));
    await refresh();
  };

  const deleteAppointment = async (id: string) => {
    await api.delete(`/appointments/${id}`);
    await refresh();
  };

  const serializePayload = (payload: Partial<Appointment>) => {
    const body: any = {};
    if (payload.hospitalId) body.hospital_id = payload.hospitalId;
    if (payload.patientId) body.patient_id = payload.patientId;
    if (payload.doctorId) body.doctor_id = payload.doctorId;
    if (payload.appointmentNumber) body.appointment_number = payload.appointmentNumber;
    if (payload.patientName) body.patient_name = payload.patientName;
    if (payload.patientAge !== undefined && payload.patientAge !== null) body.patient_age = payload.patientAge;
    if (payload.patientGender) body.patient_gender = payload.patientGender;
    if (payload.appointmentDate) body.appointment_date = formatDateOnly(payload.appointmentDate);
    if (payload.appointmentTime) body.appointment_time = payload.appointmentTime;
    if (payload.reason !== undefined) body.reason = payload.reason;
    if (payload.status) body.status = payload.status;
    if (payload.notes !== undefined) body.notes = payload.notes;
    if (payload.originalFeeAmount !== undefined && payload.originalFeeAmount !== null) body.original_fee_amount = payload.originalFeeAmount;
    if (payload.discountEnabled !== undefined && payload.discountEnabled !== null) body.discount_enabled = payload.discountEnabled;
    if (payload.discountTypeId !== undefined) body.discount_type_id = payload.discountTypeId || null;
    if (payload.discountAmount !== undefined && payload.discountAmount !== null) body.discount_amount = payload.discountAmount;
    if (payload.totalAmount !== undefined && payload.totalAmount !== null) body.total_amount = payload.totalAmount;
    if (payload.currency !== undefined) body.currency = payload.currency;
    if (payload.paymentStatus !== undefined) body.payment_status = payload.paymentStatus;
    return body;
  };

  const formatDateOnly = (value: Date | string) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.toISOString().split('T')[0];
  };

  return (
    <AppointmentContext.Provider value={{ appointments, refresh, addAppointment, updateAppointment, deleteAppointment, loading }}>
      {children}
    </AppointmentContext.Provider>
  );
}

export function useAppointments() {
  const context = useContext(AppointmentContext);
  if (!context) {
    console.warn('useAppointments called outside AppointmentProvider');
    return {
      appointments: [],
      refresh: async () => {},
      addAppointment: async () => {},
      updateAppointment: async () => {},
      deleteAppointment: async () => {},
      loading: false,
    };
  }
  return context;
}
