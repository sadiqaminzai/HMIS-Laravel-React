import React, { createContext, useContext, useEffect, useState } from 'react';
import { Stock } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface StockContextType {
  stocks: Stock[];
  refresh: () => Promise<void>;
  loading: boolean;
}

const StockContext = createContext<StockContextType | undefined>(undefined);

const mapStock = (s: any): Stock => ({
  id: String(s.id),
  hospitalId: String(s.hospital_id),
  medicineId: String(s.medicine_id),
  batchNo: s.batch_no ?? undefined,
  stockQty: Number(s.stock_qty ?? 0),
  createdAt: s.created_at ? new Date(s.created_at) : undefined,
  updatedAt: s.updated_at ? new Date(s.updated_at) : undefined,
  medicineName: s.medicine?.brand_name ?? s.medicine_name ?? undefined,
});

export function StockProvider({ children }: { children: React.ReactNode }) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, authLoading, hasPermission } = useAuth();

  const refresh = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      setStocks([]);
      return;
    }

    if (!hasPermission('view_stocks') && !hasPermission('manage_stocks')) {
      setStocks([]);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get('/stocks');
      const records: any[] = data.data ?? data;
      setStocks(records.map(mapStock));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load stocks');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setStocks([]);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  return (
    <StockContext.Provider value={{ stocks, refresh, loading }}>
      {children}
    </StockContext.Provider>
  );
}

export function useStocks() {
  const context = useContext(StockContext);
  if (!context) {
    console.warn('useStocks called outside StockProvider');
    return {
      stocks: [],
      refresh: async () => {},
      loading: false,
    };
  }
  return context;
}
