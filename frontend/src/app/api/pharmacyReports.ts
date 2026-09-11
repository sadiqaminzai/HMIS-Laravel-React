import api from '../../api/axios';

/**
 * Pharmacy reports.
 *
 * Every endpoint answers with the same envelope -- rows, summary, meta -- so
 * one table component can render all six without knowing which report it is
 * showing. The shapes of the rows differ; the wrapper does not.
 */
export interface ReportEnvelope<TRow = Record<string, any>> {
  rows: TRow[];
  summary: Record<string, number | null>;
  meta: Record<string, any>;
}

/** Filters the reports share. Each endpoint ignores the ones it has no use for. */
export interface PharmacyReportParams {
  hospital_id?: number;
  date_from?: string;
  date_to?: string;
  group_by?: string;
  supplier_id?: number;
  manufacturer_id?: number;
  medicine_id?: number;
  days?: number;
  status?: string;
  include_zero?: boolean;
}

const get = async <TRow>(path: string, params: PharmacyReportParams): Promise<ReportEnvelope<TRow>> => {
  // Undefined entries would serialise as `?supplier_id=` and be read
  // server-side as "filter by the empty supplier", which matches nothing.
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== '' && value !== null)
  );

  const { data } = await api.get(`/reports/pharmacy/${path}`, { params: clean });

  return {
    rows: Array.isArray(data?.rows) ? data.rows : [],
    summary: data?.summary ?? {},
    meta: data?.meta ?? {},
  };
};

export interface AvailableStockRow {
  id: number;
  product_name: string;
  manufacturer_name: string;
  qty_pieces: number;
  qty_packs: number;
  qty_label: string;
  batch_count: number;
  earliest_expiry: string | null;
  cost_price: number;
  sale_price: number;
  stock_value: number;
}

export interface AvailableStockCompanyRow {
  manufacturer_id: number | null;
  manufacturer_name: string;
  product_count: number;
  out_of_stock_count: number;
  qty_pieces: number;
  stock_value: number;
}

export interface LowStockRow {
  id: number;
  product_name: string;
  manufacturer_name: string;
  qty_pieces: number;
  qty_packs: number;
  qty_label: string;
  min_stock_packs: number;
  min_stock_is_default: boolean;
  threshold_pieces: number;
  shortfall_pieces: number;
  shortfall_packs: number;
  status: 'low_stock' | 'out_of_stock';
  reorder_value: number;
}

export interface ShortExpiryRow {
  stock_id: number;
  medicine_id: number;
  product_name: string;
  manufacturer_name: string;
  batch_no: string;
  expiry_date: string | null;
  days_left: number | null;
  is_expired: boolean;
  qty_pieces: number;
  qty_packs: number;
  qty_label: string;
  value_at_cost: number;
}

export interface TradeDetailRow {
  id: number;
  serial_no: number | null;
  trx_type: string;
  is_return: boolean;
  date: string | null;
  party_name: string;
  grand_total: number;
  total_discount: number;
  paid_amount: number;
  due_amount: number;
  payment_status: string | null;
  payment_method: string | null;
}

export interface TradePartyRow {
  party_id: number | null;
  party_name: string;
  document_count: number;
  net_total: number;
  discount_total: number;
  paid_total: number;
  due_total: number;
}

export interface TradeDayRow {
  day: string;
  document_count: number;
  net_total: number;
  discount_total: number;
  paid_total: number;
  due_total: number;
}

export interface ProfitRow {
  id: number;
  product_name: string;
  manufacturer_name: string;
  qty_pieces: number;
  qty_packs: number;
  qty_label: string;
  revenue: number;
  cogs: number;
  profit: number;
  margin_percent: number | null;
}

export const getAvailableStock = (params: PharmacyReportParams) =>
  get<AvailableStockRow | AvailableStockCompanyRow>('available-stock', params);

export const getPurchaseReport = (params: PharmacyReportParams) =>
  get<TradeDetailRow | TradePartyRow | TradeDayRow>('purchases', params);

export const getSalesReport = (params: PharmacyReportParams) =>
  get<TradeDetailRow | TradePartyRow | TradeDayRow>('sales', params);

export const getShortExpiryReport = (params: PharmacyReportParams) =>
  get<ShortExpiryRow>('short-expiry', params);

export const getLowStockReport = (params: PharmacyReportParams) => get<LowStockRow>('low-stock', params);

export const getProfitReport = (params: PharmacyReportParams) => get<ProfitRow>('profit', params);
