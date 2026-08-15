import React, { createContext, useContext, useEffect, useState } from 'react';
import { Medicine } from '../types';
import api from '../../api/axios';
import { fetchAllPages } from '../utils/fetchAllPages';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface MedicineContextType {
  medicines: Medicine[];
  refresh: () => Promise<void>;
  addMedicine: (payload: Partial<Medicine>) => Promise<void>;
  updateMedicine: (payload: Partial<Medicine> & { id: string }) => Promise<void>;
  deleteMedicine: (id: string) => Promise<void>;
  generateBarcode: (id: string) => Promise<Medicine>;
  findByBarcode: (barcode: string, hospitalId?: string) => Promise<Medicine | null>;
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
  stock: m.stock !== undefined && m.stock !== null ? Number(m.stock) : undefined,
  costPrice: m.cost_price !== undefined && m.cost_price !== null ? Number(m.cost_price) : undefined,
  salePrice: m.sale_price !== undefined && m.sale_price !== null ? Number(m.sale_price) : undefined,
  packSize: m.pack_size !== undefined && m.pack_size !== null ? Math.max(1, Number(m.pack_size)) : 1,
  packPrice: m.pack_price !== undefined && m.pack_price !== null ? Number(m.pack_price) : undefined,
  packLabel: m.pack_label ?? '',
  piecesPerStrip: Math.max(1, Number(m.pieces_per_strip ?? 1)),
  stripsPerPack: Math.max(1, Number(m.strips_per_pack ?? 1)),
  stripPrice: m.strip_price !== undefined && m.strip_price !== null ? Number(m.strip_price) : undefined,
  stripLabel: m.strip_label ?? '',
  sellableUnits: Array.isArray(m.sellable_units) && m.sellable_units.length ? m.sellable_units : ['piece'],
  defaultSaleUnit: (m.default_sale_unit ?? 'piece'),
  barcode: m.barcode ?? '',
  barcodeType: (m.barcode_type ?? undefined) as Medicine['barcodeType'],
  status: (m.status ?? 'active') as Medicine['status'],
  createdBy: m.created_by ?? undefined,
  updatedBy: m.updated_by ?? undefined,
  createdAt: m.created_at ? new Date(m.created_at) : undefined,
  updatedAt: m.updated_at ? new Date(m.updated_at) : undefined,
});

export function MedicineProvider({ children }: { children: React.ReactNode }) {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, authLoading, hasPermission, user } = useAuth();

  const refresh = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      setMedicines([]);
      return;
    }

    // Backend: /medicines is guarded by permissions or doctor role.
    const isDoctor = String(user?.role || '').toLowerCase() === 'doctor';
    if (
      !isDoctor &&
      !hasPermission('view_medicines') &&
      !hasPermission('manage_medicines') &&
      !hasPermission('create_prescription') &&
      !hasPermission('manage_prescriptions')
    ) {
      setMedicines([]);
      return;
    }
    setLoading(true);
    try {
      const records = await fetchAllPages<any>('/medicines');
      setMedicines(records.map(mapMedicine));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load medicines');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setMedicines([]);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  const serializePayload = (payload: Partial<Medicine>) => {
    const body: any = {};
    if (payload.hospitalId) body.hospital_id = payload.hospitalId;
    if (payload.manufacturerId) body.manufacturer_id = payload.manufacturerId;
    if (payload.medicineTypeId) body.medicine_type_id = payload.medicineTypeId;
    if (payload.brandName) body.brand_name = payload.brandName;
    if (payload.genericName !== undefined) body.generic_name = payload.genericName;
    if (payload.strength !== undefined) body.strength = payload.strength;
    if (payload.stock !== undefined) body.stock = payload.stock;
    if (payload.costPrice !== undefined) body.cost_price = payload.costPrice;
    if (payload.salePrice !== undefined) body.sale_price = payload.salePrice;
    if (payload.packSize !== undefined) body.pack_size = payload.packSize;
    if (payload.packPrice !== undefined) body.pack_price = payload.packPrice;
    if (payload.packLabel !== undefined) body.pack_label = payload.packLabel;
    // pack_size is derived server-side from these two, so it is never sent.
    if (payload.piecesPerStrip !== undefined) body.pieces_per_strip = payload.piecesPerStrip;
    if (payload.stripsPerPack !== undefined) body.strips_per_pack = payload.stripsPerPack;
    if (payload.stripPrice !== undefined) body.strip_price = payload.stripPrice;
    if (payload.stripLabel !== undefined) body.strip_label = payload.stripLabel;
    if (payload.sellableUnits !== undefined) body.sellable_units = payload.sellableUnits;
    if (payload.defaultSaleUnit !== undefined) body.default_sale_unit = payload.defaultSaleUnit;
    // Send null rather than '' so the unique index treats "no barcode" as NULL.
    if (payload.barcode !== undefined) body.barcode = payload.barcode ? payload.barcode : null;
    if (payload.barcodeType !== undefined) body.barcode_type = payload.barcodeType || null;
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

  const generateBarcode = async (id: string) => {
    const { data } = await api.post(`/medicines/${id}/generate-barcode`);
    await refresh();
    return mapMedicine(data);
  };

  const findByBarcode = async (barcode: string, hospitalId?: string) => {
    try {
      const { data } = await api.get('/medicines/barcode-lookup', {
        params: { barcode, ...(hospitalId ? { hospital_id: hospitalId } : {}) },
      });
      return mapMedicine(data);
    } catch {
      return null; // 404 simply means the code is not registered here
    }
  };

  const deleteMedicine = async (id: string) => {
    await api.delete(`/medicines/${id}`);
    await refresh();
  };

  return (
    <MedicineContext.Provider value={{ medicines, refresh, addMedicine, updateMedicine, deleteMedicine, generateBarcode, findByBarcode, loading }}>
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
      generateBarcode: async () => ({} as Medicine),
      findByBarcode: async () => null,
      loading: false,
    };
  }
  return context;
}
