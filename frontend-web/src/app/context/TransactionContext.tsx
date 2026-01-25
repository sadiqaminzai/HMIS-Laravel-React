import React, { createContext, useContext, useEffect, useState } from 'react';
import { Transaction, TransactionDetail } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface TransactionContextType {
  transactions: Transaction[];
  refresh: () => Promise<void>;
  addTransaction: (payload: Partial<Transaction>) => Promise<void>;
  updateTransaction: (payload: Partial<Transaction> & { id: string }) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  loading: boolean;
}

const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

const mapDetail = (d: any): TransactionDetail => ({
  id: String(d.id),
  trxId: String(d.trx_id ?? d.trxId ?? d.transaction_id ?? ''),
  medicineId: String(d.medicine_id),
  batchNo: d.batch_no ?? undefined,
  expiryDate: d.expiry_date ? new Date(d.expiry_date) : undefined,
  qtty: Number(d.qtty ?? 0),
  bonus: d.bonus !== undefined && d.bonus !== null ? Number(d.bonus) : undefined,
  price: Number(d.price ?? 0),
  discount: d.discount !== undefined && d.discount !== null ? Number(d.discount) : undefined,
  tax: d.tax !== undefined && d.tax !== null ? Number(d.tax) : undefined,
  amount: d.amount !== undefined && d.amount !== null ? Number(d.amount) : undefined,
  medicineName: d.medicine?.brand_name ?? d.medicine_name ?? undefined,
});

const mapTransaction = (t: any): Transaction => ({
  id: String(t.id),
  hospitalId: String(t.hospital_id),
  supplierId: t.supplier_id !== undefined && t.supplier_id !== null ? String(t.supplier_id) : undefined,
  supplierName: t.supplier_name ?? undefined,
  patientId: t.patient_id !== undefined && t.patient_id !== null ? String(t.patient_id) : undefined,
  patientName: t.patient_name ?? undefined,
  trxType: (t.trx_type ?? 'purchase') as Transaction['trxType'],
  grandTotal: Number(t.grand_total ?? 0),
  totalDiscount: Number(t.total_discount ?? 0),
  totalTax: Number(t.total_tax ?? 0),
  paidAmount: Number(t.paid_amount ?? 0),
  dueAmount: Number(t.due_amount ?? 0),
  createdBy: t.created_by ?? undefined,
  updatedBy: t.updated_by ?? undefined,
  createdAt: t.created_at ? new Date(t.created_at) : undefined,
  updatedAt: t.updated_at ? new Date(t.updated_at) : undefined,
  details: Array.isArray(t.details) ? t.details.map(mapDetail) : [],
});

export function TransactionProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, authLoading, hasPermission } = useAuth();

  const refresh = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      setTransactions([]);
      return;
    }

    if (!hasPermission('view_transactions') && !hasPermission('manage_transactions')) {
      setTransactions([]);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get('/transactions');
      const records: any[] = data.data ?? data;
      setTransactions(records.map(mapTransaction));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load transactions');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setTransactions([]);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  const serializePayload = (payload: Partial<Transaction>) => {
    const body: any = {};
    if (payload.hospitalId) body.hospital_id = payload.hospitalId;
    if (payload.supplierId !== undefined) body.supplier_id = payload.supplierId || null;
    if (payload.patientId !== undefined) body.patient_id = payload.patientId || null;
    if (payload.trxType) body.trx_type = payload.trxType;
    if (payload.grandTotal !== undefined) body.grand_total = payload.grandTotal;
    if (payload.totalDiscount !== undefined) body.total_discount = payload.totalDiscount;
    if (payload.totalTax !== undefined) body.total_tax = payload.totalTax;
    if (payload.paidAmount !== undefined) body.paid_amount = payload.paidAmount;
    if (payload.dueAmount !== undefined) body.due_amount = payload.dueAmount;
    if (payload.createdBy !== undefined) body.created_by = payload.createdBy;
    if (payload.updatedBy !== undefined) body.updated_by = payload.updatedBy;
    if (payload.details) {
      body.items = payload.details.map((d) => ({
        medicine_id: d.medicineId,
        batch_no: d.batchNo ?? null,
        expiry_date: d.expiryDate ? d.expiryDate.toISOString().slice(0, 10) : null,
        qtty: d.qtty,
        bonus: d.bonus ?? 0,
        price: d.price,
        discount: d.discount ?? 0,
        tax: d.tax ?? 0,
      }));
    }
    return body;
  };

  const addTransaction = async (payload: Partial<Transaction>) => {
    await api.post('/transactions', serializePayload(payload));
    await refresh();
  };

  const updateTransaction = async (payload: Partial<Transaction> & { id: string }) => {
    await api.put(`/transactions/${payload.id}`, serializePayload(payload));
    await refresh();
  };

  const deleteTransaction = async (id: string) => {
    await api.delete(`/transactions/${id}`);
    await refresh();
  };

  return (
    <TransactionContext.Provider value={{ transactions, refresh, addTransaction, updateTransaction, deleteTransaction, loading }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  const context = useContext(TransactionContext);
  if (!context) {
    console.warn('useTransactions called outside TransactionProvider');
    return {
      transactions: [],
      refresh: async () => {},
      addTransaction: async () => {},
      updateTransaction: async () => {},
      deleteTransaction: async () => {},
      loading: false,
    };
  }
  return context;
}
