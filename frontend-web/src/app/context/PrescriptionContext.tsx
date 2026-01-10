import React, { createContext, useContext, useEffect, useState } from 'react';
import { Prescription, PrescriptionMedicine } from '../types';
import { toast } from 'sonner';
import api from '../../api/axios';

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

const mapPrescription = (p: any): Prescription => ({
  id: String(p.id),
  hospitalId: String(p.hospital_id),
  prescriptionNumber: p.prescription_number,
  patientId: p.patient_id ? String(p.patient_id) : null,
  walkInPatientId: p.walk_in_patient_id ? String(p.walk_in_patient_id) : null,
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
    instruction: (i.instruction ?? 'after_meal') as PrescriptionMedicine['instruction'],
    quantity: Number(i.quantity ?? 0),
    type: i.type,
  })),
  advice: p.advice ?? '',
  createdAt: p.created_at ? new Date(p.created_at) : new Date(),
  createdBy: p.created_by ?? 'system',
  updatedAt: p.updated_at ? new Date(p.updated_at) : undefined,
  updatedBy: undefined,
  status: (p.status ?? 'active') as Prescription['status'],
});

export function PrescriptionProvider({ children }: { children: React.ReactNode }) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);

  const refresh = async () => {
    const { data } = await api.get('/prescriptions');
    const records: any[] = data.data ?? data;
    setPrescriptions(records.map(mapPrescription));
  };

  useEffect(() => {
    refresh();
  }, []);

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
      const mapped = mapPrescription(data.data ?? data);
      await refresh();
      toast.success('Prescription saved');
      return mapped;
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Failed to save prescription';
      toast.error(msg);
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

    await api.put(`/prescriptions/${input.id}`, payload);
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
