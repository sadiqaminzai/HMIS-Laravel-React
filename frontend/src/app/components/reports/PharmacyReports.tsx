import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Boxes, ShoppingCart, Receipt, CalendarClock, TrendingDown, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { Hospital, UserRole } from '../../types';
import { TabbedModulePage, type ModuleTab } from '../TabbedModulePage';
import { ReportTable, type ReportColumn, type ReportSummaryItem } from './ReportTable';
import { DateRangeFilter, DaysWindowFilter, Field, inputClass, useReport } from './reportPrimitives';
import { formatMoneyIn, formatNumberIn } from '../../utils/money';
import {
  getAvailableStock,
  getLowStockReport,
  getProfitReport,
  getPurchaseReport,
  getSalesReport,
  getShortExpiryReport,
  type AvailableStockCompanyRow,
  type AvailableStockRow,
  type LowStockRow,
  type ProfitRow,
  type ShortExpiryRow,
  type TradeDayRow,
  type TradeDetailRow,
  type TradePartyRow,
} from '../../api/pharmacyReports';

interface PharmacyReportsProps {
  hospital: Hospital;
  userRole: UserRole;
}


/* ------------------------------------------------------- Available Stock */

function AvailableStockTab({ hospitalId, hospitalName, currency, language }: TabProps) {
  const [groupBy, setGroupBy] = useState<'product' | 'company'>('product');
  const [includeZero, setIncludeZero] = useState(false);

  const report = useReport<AvailableStockRow | AvailableStockCompanyRow>(
    getAvailableStock,
    useMemo(
      () => ({ hospital_id: hospitalId, group_by: groupBy, include_zero: includeZero || undefined }),
      [hospitalId, groupBy, includeZero]
    )
  );

  const productColumns: ReportColumn<AvailableStockRow>[] = [
    { key: 'product_name', label: 'Product Name' },
    { key: 'manufacturer_name', label: 'Company' },
    {
      key: 'qty_label',
      label: 'Qty (Packs)',
      // Shows the pharmacist's own reading of the shelf ("46 Pack + 10 Tablet"),
      // but sorts and exports on the pack number behind it -- sorting the label
      // as text would put 9 packs after 46.
      render: (row) => row.qty_label,
      value: (row) => row.qty_packs,
    },
    { key: 'qty_pieces', label: 'Qty (Pieces)', kind: 'number', total: true },
    { key: 'earliest_expiry', label: 'Expiry Date', kind: 'date' },
    { key: 'batch_count', label: 'Batches', kind: 'number' },
    { key: 'cost_price', label: 'Cost', kind: 'currency' },
    { key: 'sale_price', label: 'Sale', kind: 'currency' },
    { key: 'stock_value', label: 'Stock Value', kind: 'currency', total: true },
  ];

  const companyColumns: ReportColumn<AvailableStockCompanyRow>[] = [
    { key: 'manufacturer_name', label: 'Company' },
    { key: 'product_count', label: 'Products', kind: 'number', total: true },
    { key: 'out_of_stock_count', label: 'Out of Stock', kind: 'number', total: true },
    { key: 'qty_pieces', label: 'Qty (Pieces)', kind: 'number', total: true },
    { key: 'stock_value', label: 'Stock Value', kind: 'currency', total: true },
  ];

  const summary: ReportSummaryItem[] = [
    { label: groupBy === 'company' ? 'Companies' : 'Products', value: formatNumberIn(report.summary.lines ?? 0, language) },
    { label: 'Total Pieces', value: formatNumberIn(report.summary.total_pieces ?? 0, language) },
    { label: 'Stock Value', value: formatMoneyIn(report.summary.total_value ?? 0, currency, language), tone: 'good' },
  ];

  return (
    <ReportTable
      title="Available Stock"
      hospitalName={hospitalName}
      periodLabel={`As at ${format(new Date(), 'dd MMM yyyy')}`}
      columns={(groupBy === 'company' ? companyColumns : productColumns) as ReportColumn<any>[]}
      rows={report.rows}
      summary={summary}
      loading={report.loading}
      error={report.error}
      currency={currency}
      language={language}
      emptyMessage="No stock on hand for this selection."
      filters={
        <>
          <Field label="Group By">
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as 'product' | 'company')}
              className={inputClass}
            >
              <option value="product">Product Wise</option>
              <option value="company">Company Wise</option>
            </select>
          </Field>
          {groupBy === 'product' && (
            <label className="flex items-center gap-1.5 pb-1.5 text-[11px] text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={includeZero}
                onChange={(e) => setIncludeZero(e.target.checked)}
                className="rounded border-gray-300"
              />
              Include zero-stock products
            </label>
          )}
        </>
      }
    />
  );
}

/* ------------------------------------------------------- Purchase / Sales */

function TradeTab({
  kind,
  hospitalId,
  hospitalName,
  currency,
  language,
}: TabProps & { kind: 'purchase' | 'sales' }) {
  const isPurchase = kind === 'purchase';
  const [from, setFrom] = useState(format(new Date(), 'yyyy-MM-01'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [groupBy, setGroupBy] = useState<'detail' | 'supplier' | 'date'>('detail');

  const report = useReport<TradeDetailRow | TradePartyRow | TradeDayRow>(
    isPurchase ? getPurchaseReport : getSalesReport,
    useMemo(
      () => ({
        hospital_id: hospitalId,
        date_from: from,
        date_to: to,
        // The server calls the party grouping `supplier` on purchases and
        // `customer` on sales; both land in the same branch.
        group_by: groupBy === 'supplier' && !isPurchase ? 'customer' : groupBy,
      }),
      [hospitalId, from, to, groupBy, isPurchase]
    )
  );

  const detailColumns: ReportColumn<TradeDetailRow>[] = [
    { key: 'serial_no', label: 'Doc #' },
    { key: 'date', label: 'Date', kind: 'date' },
    { key: 'party_name', label: isPurchase ? 'Supplier' : 'Customer' },
    {
      key: 'trx_type',
      label: 'Type',
      render: (row) => (
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
            row.is_return
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
          }`}
        >
          {row.is_return ? 'Return' : isPurchase ? 'Purchase' : 'Sale'}
        </span>
      ),
    },
    { key: 'grand_total', label: 'Total', kind: 'currency', total: true },
    { key: 'total_discount', label: 'Discount', kind: 'currency', total: true },
    { key: 'paid_amount', label: 'Paid', kind: 'currency', total: true },
    { key: 'due_amount', label: 'Due', kind: 'currency', total: true },
    { key: 'payment_status', label: 'Status' },
  ];

  const partyColumns: ReportColumn<TradePartyRow>[] = [
    { key: 'party_name', label: isPurchase ? 'Supplier' : 'Customer' },
    { key: 'document_count', label: 'Documents', kind: 'number', total: true },
    { key: 'net_total', label: 'Net Total', kind: 'currency', total: true },
    { key: 'discount_total', label: 'Discount', kind: 'currency', total: true },
    { key: 'paid_total', label: 'Paid', kind: 'currency', total: true },
    { key: 'due_total', label: 'Due', kind: 'currency', total: true },
  ];

  const dayColumns: ReportColumn<TradeDayRow>[] = [
    { key: 'day', label: 'Date', kind: 'date' },
    { key: 'document_count', label: 'Documents', kind: 'number', total: true },
    { key: 'net_total', label: 'Net Total', kind: 'currency', total: true },
    { key: 'discount_total', label: 'Discount', kind: 'currency', total: true },
    { key: 'paid_total', label: 'Paid', kind: 'currency', total: true },
    { key: 'due_total', label: 'Due', kind: 'currency', total: true },
  ];

  const columns =
    groupBy === 'detail' ? detailColumns : groupBy === 'date' ? dayColumns : partyColumns;

  const summary: ReportSummaryItem[] = [
    { label: 'Rows', value: formatNumberIn(report.summary.lines ?? 0, language) },
    {
      label: isPurchase ? 'Net Purchases' : 'Net Sales',
      value: formatMoneyIn(report.summary.net_total ?? 0, currency, language),
      tone: 'good',
    },
    { label: 'Paid', value: formatMoneyIn(report.summary.paid_total ?? 0, currency, language) },
    { label: 'Due', value: formatMoneyIn(report.summary.due_total ?? 0, currency, language), tone: 'warn' },
    {
      label: 'Returns',
      value: formatMoneyIn(report.summary.return_total ?? 0, currency, language),
      tone: (report.summary.return_total ?? 0) > 0 ? 'bad' : 'default',
    },
  ];

  return (
    <ReportTable
      title={isPurchase ? 'Purchase Report' : 'Sales Report'}
      hospitalName={hospitalName}
      periodLabel={`${from} to ${to}`}
      columns={columns as ReportColumn<any>[]}
      rows={report.rows}
      summary={summary}
      loading={report.loading}
      error={report.error}
      currency={currency}
      language={language}
      rowClassName={(row: any) => (row.is_return ? 'bg-amber-50/60 dark:bg-amber-950/20' : '')}
      emptyMessage={`No ${isPurchase ? 'purchases' : 'sales'} in this period.`}
      filters={
        <>
          <DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />
          <Field label="Group By">
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)} className={inputClass}>
              <option value="detail">Document Wise</option>
              <option value="supplier">{isPurchase ? 'Supplier Wise' : 'Customer Wise'}</option>
              <option value="date">Date Wise</option>
            </select>
          </Field>
        </>
      }
    />
  );
}

/* ----------------------------------------------------------- Short Expiry */

function ShortExpiryTab({ hospitalId, hospitalName, currency, language }: TabProps) {
  const [days, setDays] = useState(90);
  // Empty means "rolling window": everything up to `days` from today,
  // including what has already expired. Filling either date switches to a
  // fixed window that does not move tomorrow.
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const usesRange = Boolean(from || to);

  const report = useReport<ShortExpiryRow>(
    getShortExpiryReport,
    useMemo(
      () => ({
        hospital_id: hospitalId,
        days,
        date_from: from || undefined,
        date_to: to || undefined,
      }),
      [hospitalId, days, from, to]
    )
  );

  const columns: ReportColumn<ShortExpiryRow>[] = [
    { key: 'product_name', label: 'Product Name' },
    { key: 'manufacturer_name', label: 'Company' },
    { key: 'batch_no', label: 'Batch' },
    { key: 'expiry_date', label: 'Expiry Date', kind: 'date' },
    {
      key: 'days_left',
      label: 'Days Left',
      kind: 'number',
      render: (row) =>
        row.is_expired ? (
          <span className="font-semibold text-red-600 dark:text-red-400">Expired</span>
        ) : (
          <span className={row.days_left !== null && row.days_left <= 30 ? 'font-semibold text-amber-600' : ''}>
            {formatNumberIn(row.days_left ?? 0, language)}
          </span>
        ),
    },
    {
      key: 'qty_label',
      label: 'Qty (Packs)',
      // Shows the pharmacist's own reading of the shelf ("46 Pack + 10 Tablet"),
      // but sorts and exports on the pack number behind it -- sorting the label
      // as text would put 9 packs after 46.
      render: (row) => row.qty_label,
      value: (row) => row.qty_packs,
    },
    { key: 'qty_pieces', label: 'Qty (Pieces)', kind: 'number', total: true },
    { key: 'value_at_cost', label: 'Value at Cost', kind: 'currency', total: true },
  ];

  const summary: ReportSummaryItem[] = [
    { label: 'Batches', value: formatNumberIn(report.summary.lines ?? 0, language) },
    {
      label: 'Already Expired',
      value: formatNumberIn(report.summary.expired_lines ?? 0, language),
      tone: (report.summary.expired_lines ?? 0) > 0 ? 'bad' : 'good',
    },
    {
      label: 'Expired Value',
      value: formatMoneyIn(report.summary.expired_value ?? 0, currency, language),
      tone: 'bad',
    },
    { label: 'Expiring Soon', value: formatNumberIn(report.summary.expiring_lines ?? 0, language), tone: 'warn' },
    {
      label: 'Expiring Value',
      value: formatMoneyIn(report.summary.expiring_value ?? 0, currency, language),
      tone: 'warn',
    },
  ];

  return (
    <ReportTable
      title="Short Expiry Report"
      hospitalName={hospitalName}
      periodLabel={
        usesRange
          ? `Batches expiring ${from || 'any time'} to ${to || report.meta?.cutoff || ''}`
          : `Batches expiring within ${days} days (and anything already expired)`
      }
      columns={columns}
      rows={report.rows}
      summary={summary}
      loading={report.loading}
      error={report.error}
      currency={currency}
      language={language}
      // Expired stock is still sitting on a shelf where someone can sell it, so
      // it is tinted rather than merely sorted to the top.
      rowClassName={(row) => (row.is_expired ? 'bg-red-50 dark:bg-red-950/30' : '')}
      emptyMessage="Nothing expiring in this window."
      filters={
        <>
          <DaysWindowFilter days={days} onChange={setDays} />
          <Field label="Expiring From">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Expiring To">
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputClass}
            />
          </Field>
          {usesRange && (
            <button
              type="button"
              onClick={() => {
                setFrom('');
                setTo('');
              }}
              className="mb-0.5 rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Clear dates
            </button>
          )}
          {/* Says which of the two filters is actually in force, because the
              day count stays visible while a date range overrides it. */}
          <span className="mb-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            {usesRange ? 'Using date range' : `Rolling ${days} days`}
          </span>
        </>
      }
    />
  );
}

/* --------------------------------------------------------------- Low Stock */

function LowStockTab({ hospitalId, hospitalName, currency, language }: TabProps) {
  const [status, setStatus] = useState<'all' | 'low' | 'out'>('all');

  const report = useReport<LowStockRow>(
    getLowStockReport,
    useMemo(
      () => ({ hospital_id: hospitalId, status: status === 'all' ? undefined : status }),
      [hospitalId, status]
    )
  );

  const columns: ReportColumn<LowStockRow>[] = [
    { key: 'product_name', label: 'Product Name' },
    { key: 'manufacturer_name', label: 'Company' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
            row.status === 'out_of_stock'
              ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
          }`}
        >
          {row.status === 'out_of_stock' ? 'Out of Stock' : 'Low Stock'}
        </span>
      ),
    },
    {
      key: 'qty_label',
      label: 'On Hand',
      // Shows the pharmacist's own reading of the shelf ("46 Pack + 10 Tablet"),
      // but sorts and exports on the pack number behind it -- sorting the label
      // as text would put 9 packs after 46.
      render: (row) => row.qty_label,
      value: (row) => row.qty_packs,
    },
    { key: 'qty_pieces', label: 'Pieces', kind: 'number', total: true },
    {
      key: 'min_stock_packs',
      label: 'Min Stock (Packs)',
      kind: 'number',
      // Marked so a pharmacist can see which products still carry the
      // hospital default rather than a level someone actually chose.
      render: (row) => (
        <span className={row.min_stock_is_default ? 'text-gray-400 italic' : ''}>
          {formatNumberIn(row.min_stock_packs, language)}
          {row.min_stock_is_default ? ' (default)' : ''}
        </span>
      ),
    },
    { key: 'shortfall_packs', label: 'Reorder (Packs)', kind: 'number' },
    { key: 'reorder_value', label: 'Reorder Value', kind: 'currency', total: true },
  ];

  const summary: ReportSummaryItem[] = [
    { label: 'Lines', value: formatNumberIn(report.summary.lines ?? 0, language) },
    {
      label: 'Out of Stock',
      value: formatNumberIn(report.summary.out_of_stock ?? 0, language),
      tone: 'bad',
    },
    { label: 'Low Stock', value: formatNumberIn(report.summary.low_stock ?? 0, language), tone: 'warn' },
    {
      label: 'Reorder Value',
      value: formatMoneyIn(report.summary.reorder_value ?? 0, currency, language),
    },
    {
      label: 'Default Min Stock',
      value: `${report.meta?.default_min_stock_packs ?? 5} packs`,
    },
  ];

  return (
    <ReportTable
      title="Low Stock Report"
      hospitalName={hospitalName}
      periodLabel={`As at ${format(new Date(), 'dd MMM yyyy')}`}
      columns={columns}
      rows={report.rows}
      summary={summary}
      loading={report.loading}
      error={report.error}
      currency={currency}
      language={language}
      rowClassName={(row) => (row.status === 'out_of_stock' ? 'bg-red-50 dark:bg-red-950/30' : '')}
      emptyMessage="Every product is above its reorder level."
      filters={
        <Field label="Show">
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} className={inputClass}>
            <option value="all">Low and Out of Stock</option>
            <option value="low">Low Stock Only</option>
            <option value="out">Out of Stock Only</option>
          </select>
        </Field>
      }
    />
  );
}

/* ------------------------------------------------------------------ Profit */

function ProfitTab({ hospitalId, hospitalName, currency, language }: TabProps) {
  const [from, setFrom] = useState(format(new Date(), 'yyyy-MM-01'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const report = useReport<ProfitRow>(
    getProfitReport,
    useMemo(() => ({ hospital_id: hospitalId, date_from: from, date_to: to }), [hospitalId, from, to])
  );

  const columns: ReportColumn<ProfitRow>[] = [
    { key: 'product_name', label: 'Product Name' },
    { key: 'manufacturer_name', label: 'Company' },
    {
      key: 'qty_label',
      label: 'Sold (Packs)',
      // Shows the pharmacist's own reading of the shelf ("46 Pack + 10 Tablet"),
      // but sorts and exports on the pack number behind it -- sorting the label
      // as text would put 9 packs after 46.
      render: (row) => row.qty_label,
      value: (row) => row.qty_packs,
    },
    { key: 'qty_pieces', label: 'Sold (Pieces)', kind: 'number', total: true },
    { key: 'revenue', label: 'Revenue', kind: 'currency', total: true },
    { key: 'cogs', label: 'Cost of Sales', kind: 'currency', total: true },
    {
      key: 'profit',
      label: 'Profit',
      kind: 'currency',
      total: true,
      render: (row) => (
        <span className={row.profit < 0 ? 'font-semibold text-red-600 dark:text-red-400' : ''}>
          {formatMoneyIn(row.profit, currency, language)}
        </span>
      ),
    },
    {
      key: 'margin_percent',
      label: 'Margin',
      kind: 'percent',
      render: (row) =>
        row.margin_percent === null ? (
          <span className="text-gray-400">-</span>
        ) : (
          <span className={row.margin_percent < 0 ? 'text-red-600 dark:text-red-400' : ''}>
            {formatNumberIn(row.margin_percent, language, 2)}%
          </span>
        ),
    },
  ];

  const profit = report.summary.profit ?? 0;
  const summary: ReportSummaryItem[] = [
    { label: 'Products Sold', value: formatNumberIn(report.summary.lines ?? 0, language) },
    { label: 'Revenue', value: formatMoneyIn(report.summary.revenue ?? 0, currency, language) },
    { label: 'Cost of Sales', value: formatMoneyIn(report.summary.cogs ?? 0, currency, language) },
    {
      label: 'Gross Profit',
      value: formatMoneyIn(profit, currency, language),
      tone: profit < 0 ? 'bad' : 'good',
    },
    {
      label: 'Margin',
      value:
        report.summary.margin_percent === null || report.summary.margin_percent === undefined
          ? '-'
          : `${formatNumberIn(report.summary.margin_percent, language, 2)}%`,
      tone: profit < 0 ? 'bad' : 'good',
    },
  ];

  return (
    <ReportTable
      title="Profit Report"
      hospitalName={hospitalName}
      periodLabel={`${from} to ${to}`}
      columns={columns}
      rows={report.rows}
      summary={summary}
      loading={report.loading}
      error={report.error}
      currency={currency}
      language={language}
      emptyMessage="No medicine sold in this period."
      filters={<DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />}
    />
  );
}

/* -------------------------------------------------------------------- page */

interface TabProps {
  hospitalId: number;
  hospitalName: string;
  currency: string;
  language: string;
}

export function PharmacyReports({ hospital }: PharmacyReportsProps) {
  const { i18n } = useTranslation();

  const shared: TabProps = {
    hospitalId: Number(hospital.id),
    hospitalName: hospital.name,
    currency: 'AFN',
    language: i18n.language,
  };

  const tabs: ModuleTab[] = [
    {
      key: 'available-stock',
      label: 'Available Stock',
      icon: <Boxes className="w-3.5 h-3.5" />,
      anyPermissions: ['view_reports_pharmacy_stock', 'view_reports_pharmacy', 'view_reports', 'manage_reports'],
      render: () => <AvailableStockTab {...shared} />,
    },
    {
      key: 'purchase',
      label: 'Purchase',
      icon: <ShoppingCart className="w-3.5 h-3.5" />,
      anyPermissions: ['view_reports_pharmacy_purchase', 'view_reports_pharmacy', 'view_reports', 'manage_reports'],
      render: () => <TradeTab kind="purchase" {...shared} />,
    },
    {
      key: 'sales',
      label: 'Sales',
      icon: <Receipt className="w-3.5 h-3.5" />,
      anyPermissions: ['view_reports_pharmacy_sales', 'view_reports_pharmacy', 'view_reports', 'manage_reports'],
      render: () => <TradeTab kind="sales" {...shared} />,
    },
    {
      key: 'short-expiry',
      label: 'Short Expiry',
      icon: <CalendarClock className="w-3.5 h-3.5" />,
      anyPermissions: ['view_reports_pharmacy_expiry', 'view_reports_pharmacy', 'view_reports', 'manage_reports'],
      render: () => <ShortExpiryTab {...shared} />,
    },
    {
      key: 'low-stock',
      label: 'Low Stock',
      icon: <TrendingDown className="w-3.5 h-3.5" />,
      anyPermissions: ['view_reports_pharmacy_low_stock', 'view_reports_pharmacy', 'view_reports', 'manage_reports'],
      render: () => <LowStockTab {...shared} />,
    },
    {
      key: 'profit',
      label: 'Profit',
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      anyPermissions: ['view_reports_pharmacy_profit', 'view_reports_pharmacy', 'view_reports', 'manage_reports'],
      render: () => <ProfitTab {...shared} />,
    },
  ];

  return (
    <TabbedModulePage
      title="Pharmacy Reports"
      subtitle={`Stock, purchasing, sales, expiry and margin for ${hospital.name}`}
      tabs={tabs}
    />
  );
}

export default PharmacyReports;
