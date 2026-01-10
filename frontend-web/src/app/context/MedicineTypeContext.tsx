import React, { createContext, useContext, useEffect, useState } from 'react';
import { MedicineType } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';

interface MedicineTypeContextType {
  medicineTypes: MedicineType[];
  refresh: () => Promise<void>;
  addMedicineType: (payload: Partial<MedicineType>) => Promise<void>;
  updateMedicineType: (payload: Partial<MedicineType> & { id: string }) => Promise<void>;
  deleteMedicineType: (id: string) => Promise<void>;
  loading: boolean;
}

const MedicineTypeContext = createContext<MedicineTypeContextType | undefined>(undefined);

const mapMedicineType = (t: any): MedicineType => ({
  id: String(t.id),
  hospitalId: String(t.hospital_id),
  name: t.name ?? '',
  description: t.description ?? '',
  status: (t.status ?? 'active') as MedicineType['status'],
  createdAt: t.created_at ? new Date(t.created_at) : undefined,
  updatedAt: t.updated_at ? new Date(t.updated_at) : undefined,
});

export function MedicineTypeProvider({ children }: { children: React.ReactNode }) {
  const [medicineTypes, setMedicineTypes] = useState<MedicineType[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/medicine-types');
      const records: any[] = data.data ?? data;
      setMedicineTypes(records.map(mapMedicineType));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load medicine types');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const serializePayload = (payload: Partial<MedicineType>) => {
    const body: any = {};
    if (payload.hospitalId) body.hospital_id = payload.hospitalId;
    if (payload.name) body.name = payload.name;
    if (payload.description !== undefined) body.description = payload.description;
    if (payload.status) body.status = payload.status;
    return body;
  };

  const addMedicineType = async (payload: Partial<MedicineType>) => {
    await api.post('/medicine-types', serializePayload(payload));
    await refresh();
  };

  const updateMedicineType = async (payload: Partial<MedicineType> & { id: string }) => {
    await api.put(`/medicine-types/${payload.id}`, serializePayload(payload));
    await refresh();
  };

  const deleteMedicineType = async (id: string) => {
    await api.delete(`/medicine-types/${id}`);
    await refresh();
  };

  return (
    <MedicineTypeContext.Provider value={{ medicineTypes, refresh, addMedicineType, updateMedicineType, deleteMedicineType, loading }}>
      {children}
    </MedicineTypeContext.Provider>
  );
}

export function useMedicineTypes() {
  const context = useContext(MedicineTypeContext);
  if (!context) {
    console.warn('useMedicineTypes called outside MedicineTypeProvider');
    return {
      medicineTypes: [],
      refresh: async () => {},
      addMedicineType: async () => {},
      updateMedicineType: async () => {},
      deleteMedicineType: async () => {},
      loading: false,
    };
  }
  return context;
}
