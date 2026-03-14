import React, { createContext, useContext, useEffect, useState } from 'react';
import { Prescription, PrescriptionMedicine } from '../types';
import { toast } from 'sonner';
import api from '../../api/axios';
import { useAuth } from './AuthContext';

interface AddPrescriptionInput {
  hospitalId: string;
  patientId: string | null;
  walkInPatientId?: string | null;
  isWalkIn?: boolean;
  patientName: string;
  patientAge: number;
  patientGender: string;
  doctorId: string;
  doctorName: string;
  diagnosis?: string;
  nextVisit?: string | null;
  medicines: PrescriptionMedicine[];
  advice: string;
  createdBy?: string;
}

interface UpdatePrescriptionInput extends Partial<AddPrescriptionInput> {
  id: string;
  prescriptionNumber?: string;
  status?: 'active' | 'cancelled';
}

interface PrescriptionContextType {
  prescriptions: Prescription[];
  addPrescription: (input: AddPrescriptionInput) => Promise<Prescription>;
  updatePrescription: (input: UpdatePrescriptionInput) => Promise<void>;
  deletePrescription: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const PrescriptionContext = createContext<PrescriptionContextType | undefined>(undefined);

const buildGroupPayload = (savedPrescription: any, medicines: PrescriptionMedicine[]) => {
  const savedItems: any[] = savedPrescription?.items ?? [];

  return medicines
    .map((medicine, index) => {
      const item = savedItems[index];
      if (!item?.id || !medicine.groupKey) {
        return null;
      }

      return {
        prescription_item_id: Number(item.id),
        group_key: medicine.groupKey,
        group_label: medicine.groupLabel || null,
        sort_order: Number(medicine.groupOrder ?? index),
      };
    })
    .filter(Boolean) as Array<{
      prescription_item_id: number;
      group_key: string;
      group_label: string | null;
      sort_order: number;
    }>;
};

const mapPrescription = (p: any): Prescription => ({
  id: String(p.id),
  hospitalId: String(p.hospital_id),
  prescriptionNumber: p.prescription_number,
  nextVisit: p.next_visit ? new Date(p.next_visit) : null,
  patientId: p.patient_id ? String(p.patient_id) : null,
  walkInPatientId: p.walk_in_patient?.serial_no
    ? String(p.walk_in_patient.serial_no)
    : (p.walk_in_patient_serial_no ? String(p.walk_in_patient_serial_no) : (p.walk_in_patient_id ? String(p.walk_in_patient_id) : null)),
  isWalkIn: Boolean(p.is_walk_in),
  patientName: p.patient_name,
  patientAge: Number(p.patient_age ?? 0),
  patientGender: p.patient_gender ?? 'other',
  doctorId: String(p.doctor_id),
  doctorName: p.doctor_name,
  diagnosis: p.diagnosis,
  medicines: (p.items ?? []).map((i: any) => ({
    medicineId: i.medicine_id ? String(i.medicine_id) : '',
    medicineName: i.medicine_name,
    strength: i.strength ?? '',
    dose: i.dose ?? '',
    duration: i.duration ?? '',
    instruction: (i.instruction ?? '') as PrescriptionMedicine['instruction'],
    quantity: Number(i.quantity ?? 0),
    type: i.type,
    groupKey: i.group_link?.group_key ?? undefined,
    groupLabel: i.group_link?.group_label ?? undefined,
    groupOrder: i.group_link?.sort_order !== undefined ? Number(i.group_link.sort_order) : undefined,
  })),
  advice: p.advice ?? '',
  createdAt: p.created_at ? new Date(p.created_at) : new Date(),
  createdBy: p.created_by ?? 'system',
  updatedAt: p.updated_at ? new Date(p.updated_at) : undefined,
  updatedBy: undefined,
  status: (p.status ?? 'active') as Prescription['status'],
  verificationToken: p.verification_token ?? undefined,
});

export function PrescriptionProvider({ children }: { children: React.ReactNode }) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const { isAuthenticated, authLoading, hasPermission, user } = useAuth();

  const refresh = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      setPrescriptions([]);
      return;
    }

    // Backend: /prescriptions is guarded by permission:view_prescriptions OR manage_prescriptions
    // Create requires create_prescription OR manage_prescriptions.
    const isDoctor = String(user?.role || '').toLowerCase() === 'doctor';
    if (
      !isDoctor &&
      !hasPermission('view_prescriptions') &&
      !hasPermission('manage_prescriptions') &&
      !hasPermission('create_prescription')
    ) {
      setPrescriptions([]);
      return;
    }
    try {
      const { data } = await api.get('/prescriptions');
      const records: any[] = data.data ?? data;
      setPrescriptions(records.map(mapPrescription));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load prescriptions');
      }
    }
  };

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setPrescriptions([]);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  const addPrescription = async (input: AddPrescriptionInput) => {
    const payload: any = {
      hospital_id: input.hospitalId,
      patient_id: input.patientId || null,
      walk_in_patient_id: input.walkInPatientId || null,
      is_walk_in: Boolean(input.isWalkIn),
      patient_name: input.patientName,
      patient_age: input.patientAge,
      patient_gender: input.patientGender,
      doctor_id: input.doctorId,
      doctor_name: input.doctorName,
      diagnosis: input.diagnosis,
      next_visit: input.nextVisit || null,
      advice: input.advice,
      items: input.medicines.map((m) => ({
        medicine_id: m.medicineId || null,
        medicine_name: m.medicineName,
        strength: m.strength,
        dose: m.dose,
        duration: m.duration,
        instruction: m.instruction,
        quantity: m.quantity,
        type: m.type,
      })),
    };

    try {
      const { data } = await api.post('/prescriptions', payload);
      const saved = data.data ?? data;

      const groups = buildGroupPayload(saved, input.medicines);
      let groupedResponse = saved;
      if (groups.length > 0) {
        try {
          const syncResponse = await api.put(`/prescriptions/${saved.id}/item-groups`, { groups });
          groupedResponse = syncResponse.data?.data ?? syncResponse.data ?? saved;
        } catch {
          toast.error('Prescription saved, but medicine grouping could not be attached');
        }
      }

      const mapped = mapPrescription(groupedResponse);
      await refresh();
      toast.success('Prescription saved');
      return mapped;
    } catch (error: any) {
      const status = error?.response?.status;
      const msg = error?.response?.data?.message || 'Failed to save prescription';
      if (status !== 401 && status !== 403) toast.error(msg);
      throw error;
    }
  };

  const updatePrescription = async (input: UpdatePrescriptionInput) => {
    const payload: any = {};
    if (input.hospitalId) payload.hospital_id = input.hospitalId;
    if (input.patientId !== undefined) payload.patient_id = input.patientId;
    if (input.walkInPatientId !== undefined) payload.walk_in_patient_id = input.walkInPatientId;
    if (input.isWalkIn !== undefined) payload.is_walk_in = input.isWalkIn;
    if (input.patientName) payload.patient_name = input.patientName;
    if (input.patientAge !== undefined) payload.patient_age = input.patientAge;
    if (input.patientGender) payload.patient_gender = input.patientGender;
    if (input.doctorId) payload.doctor_id = input.doctorId;
    if (input.doctorName) payload.doctor_name = input.doctorName;
    if (input.diagnosis !== undefined) payload.diagnosis = input.diagnosis;
    if (input.nextVisit !== undefined) payload.next_visit = input.nextVisit || null;
    if (input.advice !== undefined) payload.advice = input.advice;
    if (input.status) payload.status = input.status;
    if (input.medicines) {
      payload.items = input.medicines.map((m) => ({
        medicine_id: m.medicineId || null,
        medicine_name: m.medicineName,
        strength: m.strength,
        dose: m.dose,
        duration: m.duration,
        instruction: m.instruction,
        quantity: m.quantity,
        type: m.type,
      }));
    }

    const { data } = await api.put(`/prescriptions/${input.id}`, payload);

    if (input.medicines) {
      const updated = data?.data ?? data;
      const groups = buildGroupPayload(updated, input.medicines);

      if (groups.length > 0) {
        try {
          await api.put(`/prescriptions/${input.id}/item-groups`, { groups });
        } catch {
          toast.error('Prescription updated, but medicine grouping could not be attached');
        }
      }
    }

    await refresh();
    toast.success('Prescription updated');
  };

  const deletePrescription = async (id: string) => {
    await api.delete(`/prescriptions/${id}`);
    await refresh();
    toast.success('Prescription deleted');
  };

  return (
    <PrescriptionContext.Provider
      value={{ prescriptions, addPrescription, updatePrescription, deletePrescription, refresh }}
    >
      {children}
    </PrescriptionContext.Provider>
  );
}

export function usePrescriptions() {
  const ctx = useContext(PrescriptionContext);
  if (!ctx) {
    console.warn('usePrescriptions called outside PrescriptionProvider');
    return {
      prescriptions: [],
      addPrescription: async () => {
        throw new Error('PrescriptionProvider missing');
      },
      updatePrescription: async () => {},
      deletePrescription: async () => {},
      refresh: async () => {},
    } as PrescriptionContextType;
  }
  return ctx;
}
