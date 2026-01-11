import React, { createContext, useContext, useEffect, useState } from 'react';
import { Medicine } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';

interface MedicineContextType {
  medicines: Medicine[];
  refresh: () => Promise<void>;
  addMedicine: (payload: Partial<Medicine>) => Promise<void>;
  updateMedicine: (payload: Partial<Medicine> & { id: string }) => Promise<void>;
  deleteMedicine: (id: string) => Promise<void>;
  loading: boolean;
}

const MedicineContext = createContext<MedicineContextType | undefined>(undefined);

const mapMedicine = (m: any): Medicine => ({
  id: String(m.id),
  hospitalId: String(m.hospital_id),
  manufacturerId: String(m.manufacturer_id),
  medicineTypeId: String(m.medicine_type_id),
  brandName: m.brand_name ?? '',
  genericName: m.generic_name ?? '',
  strength: m.strength ?? '',
  type: m.type ?? m.medicine_type?.name ?? m.medicine_type_name ?? '',
  status: (m.status ?? 'active') as Medicine['status'],
  createdAt: m.created_at ? new Date(m.created_at) : undefined,
  updatedAt: m.updated_at ? new Date(m.updated_at) : undefined,
});

export function MedicineProvider({ children }: { children: React.ReactNode }) {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      setMedicines([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/medicines');
      const records: any[] = data.data ?? data;
      setMedicines(records.map(mapMedicine));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401) {
        toast.error(err?.response?.data?.message || 'Failed to load medicines');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const serializePayload = (payload: Partial<Medicine>) => {
    const body: any = {};
    if (payload.hospitalId) body.hospital_id = payload.hospitalId;
    if (payload.manufacturerId) body.manufacturer_id = payload.manufacturerId;
    if (payload.medicineTypeId) body.medicine_type_id = payload.medicineTypeId;
    if (payload.brandName) body.brand_name = payload.brandName;
    if (payload.genericName !== undefined) body.generic_name = payload.genericName;
    if (payload.strength !== undefined) body.strength = payload.strength;
    if (payload.status) body.status = payload.status;
    return body;
  };

  const addMedicine = async (payload: Partial<Medicine>) => {
    await api.post('/medicines', serializePayload(payload));
    await refresh();
  };

  const updateMedicine = async (payload: Partial<Medicine> & { id: string }) => {
    await api.put(`/medicines/${payload.id}`, serializePayload(payload));
    await refresh();
  };

  const deleteMedicine = async (id: string) => {
    await api.delete(`/medicines/${id}`);
    await refresh();
  };

  return (
    <MedicineContext.Provider value={{ medicines, refresh, addMedicine, updateMedicine, deleteMedicine, loading }}>
      {children}
    </MedicineContext.Provider>
  );
}

export function useMedicines() {
  const context = useContext(MedicineContext);
  if (!context) {
    console.warn('useMedicines called outside MedicineProvider');
    return {
      medicines: [],
      refresh: async () => {},
      addMedicine: async () => {},
      updateMedicine: async () => {},
      deleteMedicine: async () => {},
      loading: false,
    };
  }
  return context;
}
