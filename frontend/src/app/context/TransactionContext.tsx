import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { SaleUnit, Transaction, TransactionDetail } from '../types';
import api from '../../api/axios';
import { fetchAllPages } from '../utils/fetchAllPages';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface TransactionContextType {
  /** Signals that a consumer needs this data; triggers the first load. */
  markNeeded?: () => void;
  transactions: Transaction[];
  refresh: () => Promise<void>;
  addTransaction: (payload: Partial<Transaction>) => Promise<Transaction>;
  updateTransaction: (payload: Partial<Transaction> & { id: string }) => Promise<Transaction>;
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
  // Strip is a tier of its own: collapsing it into piece here would re-price a
  // strip line as a single tablet the moment an invoice is reopened.
  saleUnit: (d.sale_unit === 'pack' || d.sale_unit === 'strip' ? d.sale_unit : 'piece') as SaleUnit,
  packSizeSnapshot: Number(d.pack_size_snapshot ?? 1),
  baseQtty: Number(d.base_qtty ?? d.qtty ?? 0),
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
  serialNo: t.serial_no !== undefined && t.serial_no !== null ? Number(t.serial_no) : undefined,
  supplierId: t.supplier_id !== undefined && t.supplier_id !== null ? String(t.supplier_id) : undefined,
  supplierName: t.supplier_name ?? undefined,
  patientId: t.patient_id !== undefined && t.patient_id !== null ? String(t.patient_id) : undefined,
  patientName: t.patient_name ?? undefined,
  isWalkIn: Boolean(t.is_walk_in ?? false),
  walkInPatientId: t.walk_in_patient_id !== undefined && t.walk_in_patient_id !== null ? String(t.walk_in_patient_id) : undefined,
  trxType: (t.trx_type ?? 'purchase') as Transaction['trxType'],
  grandTotal: Number(t.grand_total ?? 0),
  totalDiscount: Number(t.total_discount ?? 0),
  totalTax: Number(t.total_tax ?? 0),
  paidAmount: Number(t.paid_amount ?? 0),
  dueAmount: Number(t.due_amount ?? 0),
  verificationToken: t.verification_token ?? undefined,
  createdBy: t.created_by ?? undefined,
  updatedBy: t.updated_by ?? undefined,
  createdAt: t.created_at ? new Date(t.created_at) : undefined,
  updatedAt: t.updated_at ? new Date(t.updated_at) : undefined,
  details: Array.isArray(t.details) ? t.details.map(mapDetail) : [],
});

const sortByCreatedDesc = (records: Transaction[]) => {
  return [...records].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
};

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
      const records = await fetchAllPages<any>('/transactions');
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

  // Set by the hook below the first time a component consumes this
  // context, so the fetch follows the need instead of preceding it.
  const [needed, setNeeded] = useState(false);
  const markNeeded = useCallback(() => setNeeded(true), []);

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setTransactions([]);
      return;
    }
    // Nothing has asked for this data yet. Loading a whole table at
    // login cost every screen the wait -- Lab Tests was downloading
    // megabytes of records it never reads.
    if (!needed) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, needed]);

  const serializePayload = (payload: Partial<Transaction>) => {
    const body: any = {};
    if (payload.hospitalId) body.hospital_id = payload.hospitalId;
    if (payload.supplierId !== undefined) body.supplier_id = payload.supplierId || null;
    if (payload.patientId !== undefined) body.patient_id = payload.patientId || null;
    if (payload.isWalkIn !== undefined) body.is_walk_in = payload.isWalkIn;
    if (payload.walkInCustomer !== undefined) body.walk_in_customer = payload.walkInCustomer;
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
        // Preserve the server line id on edits so the API can reuse the
        // original pack/strip conversion snapshot. It is omitted for new lines.
        ...(d.id ? { id: d.id } : {}),
        medicine_id: d.medicineId,
        batch_no: d.batchNo ?? null,
        expiry_date: d.expiryDate ? d.expiryDate.toISOString().slice(0, 10) : null,
        qtty: d.qtty,
        // Backend converts pack/strip -> pieces and snapshots the conversion. It
        // rejects anything outside these three, so send the tier verbatim.
        sale_unit: d.saleUnit === 'pack' || d.saleUnit === 'strip' ? d.saleUnit : 'piece',
        bonus: d.bonus ?? 0,
        price: d.price,
        discount: d.discount ?? 0,
        tax: d.tax ?? 0,
      }));
    }
    return body;
  };

  const addTransaction = async (payload: Partial<Transaction>) => {
    const { data } = await api.post('/transactions', serializePayload(payload));
    const created = mapTransaction(data);
    setTransactions((prev) => sortByCreatedDesc([created, ...prev.filter((t) => t.id !== created.id)]));
    return created;
  };

  const updateTransaction = async (payload: Partial<Transaction> & { id: string }) => {
    const { data } = await api.put(`/transactions/${payload.id}`, serializePayload(payload));
    const updated = mapTransaction(data);
    setTransactions((prev) => {
      const next = prev.some((t) => t.id === updated.id)
        ? prev.map((t) => (t.id === updated.id ? updated : t))
        : [updated, ...prev];

      return sortByCreatedDesc(next);
    });
    return updated;
  };

  const deleteTransaction = async (id: string) => {
    await api.delete(`/transactions/${id}`);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <TransactionContext.Provider value={{ markNeeded, transactions, refresh, addTransaction, updateTransaction, deleteTransaction, loading }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  const context = useContext(TransactionContext);
  // Ask for the data on first use. Screens that never call this hook
  // never trigger the download.
  const markNeeded = context?.markNeeded;
  useEffect(() => { markNeeded?.(); }, [markNeeded]);
  if (!context) {
    console.warn('useTransactions called outside TransactionProvider');
    return {
      transactions: [],
      refresh: async () => {},
      addTransaction: async () => { throw new Error('TransactionProvider is unavailable'); },
      updateTransaction: async () => { throw new Error('TransactionProvider is unavailable'); },
      deleteTransaction: async () => {},
      loading: false,
    };
  }
  return context;
}
