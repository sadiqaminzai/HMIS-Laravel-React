import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Barcode, Eye, FileSpreadsheet, FileText, Pencil, Plus, Minus, Search, Trash2, X, ShoppingCart, Receipt, Printer, TrendingUp, Undo2, RotateCcw, ArrowUp, ArrowDown, ArrowUpDown, Check, Loader2 } from 'lucide-react';
import { Hospital, Patient, SaleUnit, Transaction, TransactionDetail, UserRole } from '../types';
import { toast } from 'sonner';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { useTransactions } from '../context/TransactionContext';
import { useMedicines } from '../context/MedicineContext';
import { useStocks } from '../context/StockContext';
import { useSuppliers } from '../context/SupplierContext';
import { usePatients } from '../context/PatientContext';
import { useHospitals } from '../context/HospitalContext';
import { useAuth } from '../context/AuthContext';
import {
  useSettings,
  type PrintModule,
  type PrintPaperSize,
  type InvoiceType,
} from '../context/SettingsContext';
import api from '../../api/axios';
import { formatOnlyDate } from '../utils/date';
import { buildVerificationUrl } from '../utils/verification';
import { POWERED_BY_TEXT } from '../utils/receiptBranding';
import { AddButton } from './AddButton';
import { printName } from '../utils/printName';
import { createPortal } from 'react-dom';

/** Maps an invoice to its configurable print module (Settings > Print Paper Size). */
const printModuleFor = (trx: Pick<Transaction, 'trxType'>): PrintModule => {
  switch (String(trx?.trxType || '').toLowerCase()) {
    case 'purchase': return 'pharmacy_purchase_invoice';
    case 'purchase_return': return 'pharmacy_purchase_return_invoice';
    case 'sales_return': return 'pharmacy_sales_return_invoice';
    default: return 'pharmacy_sales_invoice';
  }
};

type SortKey = 'serial' | 'party' | 'grandTotal' | 'paid' | 'due' | 'date';

/** Header cell with the up/down sort affordance on every sortable column. */
function SortableTh({
  label,
  sortKey,
  sortState,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sortState: { key: SortKey; dir: 'asc' | 'desc' };
  onSort: (key: SortKey) => void;
}) {
  const isActive = sortState.key === sortKey;
  return (
    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}`}
        aria-sort={isActive ? (sortState.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className="inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        {label}
        {isActive
          ? (sortState.dir === 'asc'
              ? <ArrowUp className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              : <ArrowDown className="w-3 h-3 text-blue-600 dark:text-blue-400" />)
          : <ArrowUpDown className="w-3 h-3 text-gray-400" />}
      </button>
    </th>
  );
}

/** One tab per invoice type. "Return In" is a sales return, "Return Out" a purchase return. */
const INVOICE_TABS: { id: Transaction['trxType']; label: string; docTitle: string; icon: typeof TrendingUp }[] = [
  { id: 'sales', label: 'Sales Invoice', docTitle: 'Sales Invoice', icon: TrendingUp },
  { id: 'sales_return', label: 'Return In', docTitle: 'Sales Return Invoice', icon: Undo2 },
  { id: 'purchase', label: 'Purchase Invoice', docTitle: 'Purchase Invoice', icon: ShoppingCart },
  { id: 'purchase_return', label: 'Return Out', docTitle: 'Purchase Return Invoice', icon: RotateCcw },
];

let cachedPdfTools: {
  jsPDF: any;
  autoTable: any;
} | null = null;

let cachedXlsxTools: {
  XLSX: any;
} | null = null;

async function loadPdfTools() {
  if (cachedPdfTools) return cachedPdfTools;

  const [jsPDFModule, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  cachedPdfTools = {
    jsPDF: jsPDFModule.default,
    autoTable: autoTableModule.default,
  };

  return cachedPdfTools;
}

async function loadXlsxTools() {
  if (cachedXlsxTools) return cachedXlsxTools;

  const XLSX = await import('xlsx');
  cachedXlsxTools = { XLSX };

  return cachedXlsxTools;
}

interface TransactionManagementProps {
  hospital: Hospital;
  userRole?: UserRole;
}

const emptyItem = (): TransactionDetail => ({
  id: '',
  trxId: '',
  medicineId: '',
  batchNo: '',
  expiryDate: undefined,
  qtty: 1,
  saleUnit: 'piece',
  bonus: 0,
  price: 0,
  discount: 0,
  tax: 0,
  amount: 0,
});

const buildInitialFormData = (hospitalId: string) => ({
  trxType: 'sales' as Transaction['trxType'],
  paidAmount: 0,
  dueAmount: 0,
  supplierId: '',
  patientId: '',
  // Retail pharmacy: a sale may go to a walk-in customer instead of a
  // registered hospital patient. Defaults to the existing patient workflow.
  isWalkIn: false,
  walkInName: '',
  walkInPhone: '',
  walkInAddress: '',
  hospitalId,
  transactionDate: new Date(),
  items: [emptyItem()],
});

export function TransactionManagement({ hospital, userRole = 'admin' }: TransactionManagementProps) {
  const { t } = useTranslation();
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  const { transactions, addTransaction, updateTransaction, deleteTransaction, loading } = useTransactions();
  const { medicines, refresh: refreshMedicines, findByBarcode } = useMedicines();
  const { stocks, refresh: refreshStocks } = useStocks();
  const { suppliers } = useSuppliers();
  const { patients } = usePatients();
  const { hospitals } = useHospitals();
  const { hasPermission } = useAuth();
  // Typing an amount into the invoice is recording a payment, so it needs
  // record_finance_payments. Settling afterwards from the finance list is a
  // different act with its own permission.
  const canRecordPayment = hasPermission('record_finance_payments') || hasPermission('manage_finance');
  const { loadHospitalSetting, getPrintColumnSettings, getShowOutOfStockMedicinesForPharmacy, getPrintPaperSize,
          getPharmacyCustomerMode, getPharmacyDefaultCustomer, getPharmacyWalkInDefaults,
          getBarcodeScanningEnabled, getInvoiceFields } = useSettings();

  // Master switch from Settings > Barcodes; hides the scan field entirely.
  const barcodeScanningEnabled = getBarcodeScanningEnabled(currentHospital.id);

  // Which customer options this sale screen offers = hospital setting AND the
  // user's own permission. A user without pharmacy_walk_in_sales never sees the
  // walk-in option, even where the hospital enables it.
  const pharmacyCustomerMode = getPharmacyCustomerMode(currentHospital.id);
  const mayUseWalkIn = hasPermission('pharmacy_walk_in_sales') || hasPermission('manage_transactions');
  const walkInAllowed = pharmacyCustomerMode !== 'patient_only' && mayUseWalkIn;
  const patientAllowed = pharmacyCustomerMode !== 'walk_in_only';
  // If the hospital is walk-in only but this user lacks the permission, fall back
  // to the patient option so the screen is never left with no way to sell.
  const showCustomerToggle = walkInAllowed && patientAllowed;
  const defaultIsWalkIn = walkInAllowed
    && (getPharmacyDefaultCustomer(currentHospital.id) === 'walk_in' || !patientAllowed);
  // Configured once per hospital; pre-fills a new walk-in sale so a retail
  // counter is not retyped on every invoice.
  const walkInDefaults = getPharmacyWalkInDefaults(currentHospital.id);
  const canAdd = hasPermission('add_transactions') || hasPermission('manage_transactions');
  const canEdit = hasPermission('edit_transactions') || hasPermission('manage_transactions');
  const canDelete = hasPermission('delete_transactions') || hasPermission('manage_transactions');
  const canExport = hasPermission('export_transactions') || hasPermission('manage_transactions');
  const canPrint = hasPermission('print_transactions') || hasPermission('manage_transactions');

  const [searchTerm, setSearchTerm] = useState('');
  // Sales invoices are the day-to-day default tab.
  const [trxTypeFilter, setTrxTypeFilter] = useState<Transaction['trxType']>('sales');
  // Newest invoices first by default.
  const [sortState, setSortState] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });

  const toggleSort = (key: SortKey) => {
    setSortState((prev) => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'date' ? 'desc' : 'asc' });
  };
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [medicineSearch, setMedicineSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [printTemplate, setPrintTemplate] = useState<'sale' | 'purchase' | 'supplier'>('sale');
  // Seeded from the hospital-wide print setting (Settings > General > Print Settings)
  // and re-synced whenever that setting loads, so a mini-printer hospital never
  // silently prints A4. Users can still override per preview.
  const [receiptSize, setReceiptSize] = useState<PrintPaperSize>('a4');
  const [submitting, setSubmitting] = useState(false);
  const [remoteMedicines, setRemoteMedicines] = useState<typeof medicines>([]);
  const [remoteSuppliers, setRemoteSuppliers] = useState<typeof suppliers>([]);
  const [remotePatients, setRemotePatients] = useState<typeof patients>([]);
  const [lastEditedTotal, setLastEditedTotal] = useState<'paid' | 'due' | 'auto'>('auto');
  const [openMedicineDropdownIndex, setOpenMedicineDropdownIndex] = useState<number | null>(null);
  const [medicineQueries, setMedicineQueries] = useState<Record<number, string>>({});
  const [openSupplierDropdown, setOpenSupplierDropdown] = useState(false);
  const [openPatientDropdown, setOpenPatientDropdown] = useState(false);
  const [highlightedSupplierIndex, setHighlightedSupplierIndex] = useState(-1);
  const [highlightedPatientIndex, setHighlightedPatientIndex] = useState(-1);
  const [highlightedMedicineIndex, setHighlightedMedicineIndex] = useState<Record<number, number>>({});

  const [formData, setFormData] = useState(() => buildInitialFormData(currentHospital.id));

  const scopedTransactions = filterByHospital(transactions);

  const getHospital = (id: string) => hospitals.find((h) => h.id === id);
  const getHospitalName = (id: string) => getHospital(id)?.name || 'Unknown';
  const activePrintColumns = getPrintColumnSettings(selectedTransaction?.hospitalId || currentHospital.id);
  /**
   * Pieces on hand, matching what the API will actually let a sale draw on.
   *
   * A sale cannot be served from an expired batch -- the API filters those out
   * before it checks availability -- so counting them here only produces a
   * figure the pharmacist trusts and the server then refuses. Batches with no
   * expiry recorded are never dated, so they stay in, exactly as on the server.
   */
  const getAvailableStock = (
    medicineId?: string,
    batchNo?: string,
    hospitalId?: string,
    options?: { includeExpired?: boolean },
  ) => {
    if (!medicineId || !hospitalId) return 0;
    const excludeExpired = formData.trxType === 'sales' && !options?.includeExpired;
    const scoped = stocks.filter((s) =>
      String(s.hospitalId) === String(hospitalId)
      && String(s.medicineId) === String(medicineId)
      && (!excludeExpired || !s.expiryDate || isUsableThrough(s.expiryDate)));
    if (!scoped.length) return 0;
    if (batchNo) {
      return scoped
        .filter((s) => (s.batchNo || '') === batchNo)
        .reduce((sum, s) => sum + Number(s.stockQty || 0) + Number(s.bonusQty || 0), 0);
    }
    return scoped.reduce((sum, s) => sum + Number(s.stockQty || 0) + Number(s.bonusQty || 0), 0);
  };

  const validateSalesStock = () => {
    if (!['sales', 'purchase_return'].includes(formData.trxType)) return true;
    if (formData.trxType === 'sales' && getShowOutOfStockMedicinesForPharmacy(formData.hospitalId)) return true;

    const requiredByKey: Record<string, number> = {};
    formData.items.forEach((item) => {
      if (!item.medicineId) return;
      // Stock is held in pieces, so a pack line reserves pack_size pieces.
      const factor = piecesPerUnit(item.medicineId, (item.saleUnit ?? 'piece') as SaleUnit);
      const required = (Number(item.qtty || 0) + Number(item.bonus || 0)) * factor;
      if (required <= 0) return;
      const key = `${item.medicineId}::${item.batchNo || '__all__'}`;
      requiredByKey[key] = (requiredByKey[key] || 0) + required;
    });

    const existingRequiredByKey: Record<string, number> = {};
    if (
      showEditModal &&
      selectedTransaction &&
      selectedTransaction.hospitalId === formData.hospitalId &&
      ['sales', 'purchase_return'].includes(selectedTransaction.trxType)
    ) {
      (selectedTransaction.details || []).forEach((detail) => {
        if (!detail.medicineId) return;
        // Use the pieces-per-unit recorded at the time of sale, not today's value.
        // The snapshot covers strip lines too, so releasing an edited strip line
        // credits back the pieces it actually consumed.
        const factor = (detail.saleUnit === 'pack' || detail.saleUnit === 'strip')
          ? Math.max(1, Number(detail.packSizeSnapshot ?? 1))
          : 1;
        const required = (Number(detail.qtty || 0) + Number(detail.bonus || 0)) * factor;
        if (required <= 0) return;
        const key = `${detail.medicineId}::${detail.batchNo || '__all__'}`;
        existingRequiredByKey[key] = (existingRequiredByKey[key] || 0) + required;
      });
    }

    const mergedKeys = new Set([...Object.keys(requiredByKey), ...Object.keys(existingRequiredByKey)]);
    for (const key of mergedKeys) {
      const [medicineId, batchNo] = key.split('::');
      const nextRequired = Number(requiredByKey[key] || 0);
      const existingRequired = Number(existingRequiredByKey[key] || 0);
      const deltaRequired = showEditModal ? nextRequired - existingRequired : nextRequired;

      if (deltaRequired <= 0) {
        continue;
      }

      const available = getAvailableStock(medicineId, batchNo === '__all__' ? undefined : batchNo, formData.hospitalId);
      if (available < deltaRequired) {
        const label = getMedicineName(medicineId);
        const batchLabel = batchNo !== '__all__' ? ` (Batch: ${batchNo})` : '';
        toast.error(`Insufficient stock for ${label}${batchLabel}. Available: ${available}, Required: ${deltaRequired}.`);
        return false;
      }
    }

    return true;
  };

  const loadImageAsDataUrl = async (url?: string) => {
    if (!url) return undefined;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return undefined;
    }
  };

  const escapeHtml = (value: string) =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const handlePrintInvoice = async (
    transaction: Transaction | null = selectedTransaction,
    forceA4 = false,
    sizeOverride?: PrintPaperSize,
  ) => {
    if (!transaction) return;
    const trx = transaction;

    const resolvedTemplate: 'sale' | 'purchase' | 'supplier' =
      trx.trxType === 'purchase' || trx.trxType === 'purchase_return'
        ? (trx.supplierId ? 'supplier' : 'purchase')
        : 'sale';

    setPrintTemplate(resolvedTemplate);

    // Resolve the paper size from the invoice actually being printed. Using the
    // `receiptSize` state here made a direct row-print use whatever invoice was
    // last previewed (or the sales default), so a Purchase Invoice configured as
    // A4 printed on the mini-printer layout until the preview had been opened.
    const targetSize: PrintPaperSize = forceA4
      ? 'a4'
      : (sizeOverride ?? getPrintPaperSize(trx.hospitalId || currentHospital.id, printModuleFor(trx)));
    const printWindow = window.open('', '_blank', 'width=1200,height=920');
    if (!printWindow) {
      toast.error('Unable to open print preview. Please allow popups for this site.');
      return;
    }

    const hospitalInfo = getHospital(trx.hospitalId);
    const transactionDetails = trx.details || [];
    const totalsSummary = calculateTotalsSummary(transactionDetails);
    const netTotal = calculateTotals(transactionDetails);
    const grossTotal = transactionDetails.reduce((sum, detail) => sum + Number(detail.price || 0) * Number(detail.qtty || 0), 0);
    const totalQuantity = transactionDetails.reduce((sum, detail) => sum + Number(detail.qtty || 0), 0);
    const logoDataUrl = await loadImageAsDataUrl(hospitalInfo?.logo);

    const patient = patients.find((p) => p.id === trx.patientId);
    const supplier = suppliers.find((s) => s.id === trx.supplierId);
    const billedToName = printName(
      resolvedTemplate === 'sale'
        ? (patient?.name || trx.patientName || getPatientDisplay(trx.patientId) || 'Walk-in Customer')
        : (supplier?.name || trx.supplierName || getSupplierDisplay(trx.supplierId) || 'Supplier')
    );
    const billedToAddress = resolvedTemplate === 'sale' ? (patient?.address || '') : (supplier?.address || '');
    const billedToPhone = resolvedTemplate === 'sale' ? (patient?.phone || '') : (supplier?.contactInfo || '');

    const invoiceHeading = resolvedTemplate === 'sale' ? 'SALES INVOICE' : resolvedTemplate === 'purchase' ? 'PURCHASE INVOICE' : 'SUPPLIER INVOICE';
    const hospitalName = hospitalInfo?.name || getHospitalName(trx.hospitalId);
    const hospitalAddress = hospitalInfo?.address || '';
    const hospitalContact = hospitalInfo?.phone || '';

    const invoiceDate = trx.createdAt
      ? formatOnlyDate(trx.createdAt, hospitalInfo?.timezone || 'Asia/Kabul', (hospitalInfo?.calendarType as 'gregorian' | 'shamsi') || 'gregorian')
      : formatOnlyDate(new Date(), hospitalInfo?.timezone || 'Asia/Kabul', (hospitalInfo?.calendarType as 'gregorian' | 'shamsi') || 'gregorian');
    const createdAt = trx.createdAt ? new Date(trx.createdAt).toLocaleString() : '-';
    const updatedAt = trx.updatedAt ? new Date(trx.updatedAt).toLocaleString() : '-';
    const verificationUrl = buildVerificationUrl('transaction', trx.verificationToken || null);

    const qrPayload = JSON.stringify({
      kind: 'transaction',
      verificationUrl,
      invoiceNo: trx.serialNo ?? trx.id,
      transactionType: trx.trxType,
      transactionDate: invoiceDate,
      hospital: hospitalName,
      billedTo: billedToName,
      grandTotal: Number(netTotal.toFixed(2)),
      paidAmount: Number((trx.paidAmount || 0).toFixed(2)),
      dueAmount: Number((trx.dueAmount || 0).toFixed(2)),
      medicines: transactionDetails.map((detail) => ({
        medicine: printName(detail.medicineId ? getMedicineDisplay(detail.medicineId) : (detail.medicineName || 'Unknown')),
        batchNo: detail.batchNo || null,
        quantity: Number(detail.qtty || 0),
        bonus: Number(detail.bonus || 0),
        price: Number(detail.price || 0),
        amount: Number((detail.amount ?? calculateLineAmount(detail)) || 0),
      })),
    });

    const logoMarkup = logoDataUrl || hospitalInfo?.logo
      ? `<img src="${logoDataUrl || hospitalInfo?.logo}" alt="Hospital logo" class="hospital-logo" />`
      : ``;

    const showBatchColumn = activePrintColumns.showBatchColumn;
    const showExpiryDateColumn = activePrintColumns.showExpiryDateColumn;
    const showBonusColumn = activePrintColumns.showBonusColumn;
    const a4ColumnCount = 7 + (showBatchColumn ? 1 : 0) + (showExpiryDateColumn ? 1 : 0) + (showBonusColumn ? 1 : 0);

    const rowsMarkupA4 = transactionDetails.length
      ? transactionDetails
          .map((detail) => {
            const amount = Number(detail.amount ?? calculateLineAmount(detail));
            const qty = Number(detail.qtty || 0);
            const discount = Number(detail.discount || 0);
            const tax = Number(detail.tax || 0);
            const netPrice = qty > 0 ? amount / qty : Number(detail.price || 0);
            const itemName = printName(detail.medicineId ? getMedicineDisplay(detail.medicineId) : (detail.medicineName || 'Unknown'));

            return `
              <tr>
                <td>
                  <div class="product-details">
                    <span class="product-name">${escapeHtml(itemName)}</span>
                  </div>
                </td>
                ${showBatchColumn ? `<td class="text-center" style="color: #2563eb;">${escapeHtml(detail.batchNo || 'N/A')}</td>` : ''}
                ${showExpiryDateColumn ? `<td class="text-center">${escapeHtml(detail.expiryDate ? getExpiryDisplay(detail.expiryDate, trx.hospitalId) : '-')}</td>` : ''}
                <td class="text-center"><strong>${qty}</strong></td>
                ${showBonusColumn ? `<td class="text-center">${Number(detail.bonus || 0)}</td>` : ''}
                <td class="text-center">${Number(detail.price || 0).toFixed(2)}</td>
                <td class="text-center ${discount > 0 ? 'accent-red' : ''}">${discount > 0 ? `${discount}%` : '-'}</td>
                <td class="text-center ${tax > 0 ? 'accent-blue' : ''}">${tax > 0 ? `${tax}%` : '-'}</td>
                <td class="text-center">${netPrice.toFixed(2)}</td>
                <td class="text-right amount">${amount.toFixed(2)}</td>
              </tr>
            `;
          })
          .join('')
      : `<tr><td colspan="${a4ColumnCount}" class="empty-row">No items found for this transaction.</td></tr>`;

    const rowsMarkupCompact = transactionDetails.length
      ? transactionDetails
          .map((detail, index) => {
            const amount = Number(detail.amount ?? calculateLineAmount(detail));
            const itemName = printName(detail.medicineId ? getMedicineDisplay(detail.medicineId) : (detail.medicineName || 'Unknown'));
            return `
              <tr>
                <td>${index + 1}</td>
                <td class="item">${escapeHtml(itemName)}</td>
                <td class="num">${Number(detail.qtty || 0)}</td>
                <td class="num">${Number(detail.price || 0).toFixed(2)}</td>
                <td class="num strong">${amount.toFixed(2)}</td>
              </tr>
            `;
          })
          .join('')
      : '<tr><td colspan="5" class="empty">No items</td></tr>';

    let html = '';

    // A5 shares the full-page invoice layout with A4, only the sheet differs.
    const isFullPage = targetSize === 'a4' || targetSize === 'a5';

    if (isFullPage) {
      html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${escapeHtml(invoiceHeading)}</title>
            <style>
              @page { size: ${targetSize === 'a5' ? 'A5' : 'A4'}; margin: ${targetSize === 'a5' ? '8mm' : '15mm'}; }
              * { box-sizing: border-box; }
              body {
                margin: 0;
                background: #ffffff;
                color: #0f172a;
                font-family: Arial, Helvetica, sans-serif;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              /* A5 keeps every column of the A4 invoice but is scaled to the
                 narrower sheet (132mm printable vs 180mm on A4). */
              ${targetSize === 'a5' ? `
              @media print {
                .invoice { zoom: 0.73; }
              }
              ` : ''}
              .screen-note {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                color: #64748b;
                font-size: 14px;
              }
              @media screen {
                .invoice { display: none; }
                .screen-note { display: flex; }
              }
              @media print {
                .screen-note { display: none !important; }
                .invoice { display: block; }
              }
              .invoice {
                width: 100%;
                max-width: 900px;
                min-height: calc(297mm - 30mm);
                margin: 0 auto;
                padding: 10px 20px;
              }
              /* Header */
              .header {
                display: flex;
                align-items: center;
                gap: 20px;
                padding-bottom: 12px;
                padding-top: 10px;
              }
              .hospital-logo {
                width: auto;
                max-width: 120px;
                height: 60px;
                object-fit: contain;
                margin-left: 10px;
              }
              .hospital-name {
                margin: 0;
                font-size: 24px;
                line-height: 1.1;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: #0d3b66;
              }
              .hospital-meta {
                margin-top: 4px;
                font-size: 12px;
                color: #475569;
                line-height: 1.4;
              }
              /* Brand Divider */
              .brand-divider {
                border-top: 3px solid #0d3b66;
                margin-bottom: 2px;
              }
              .brand-divider-thin {
                border-top: 1px solid #0d3b66;
                margin-bottom: 24px;
              }
              /* Top Section */
              .top-section {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 24px;
                padding: 0 10px;
              }
              .bill-to-panel {
                width: 45%;
                background: #f8fafc;
                border-radius: 6px;
                padding: 16px 20px;
              }
              .bill-to-title {
                font-size: 11px;
                color: #64748b;
                text-transform: uppercase;
                font-weight: 700;
                margin-bottom: 12px;
                letter-spacing: 0.5px;
              }
              .party-name {
                margin: 0;
                font-size: 16px;
                font-weight: 800;
                color: #0f172a;
              }
              .party-meta {
                margin-top: 8px;
                font-size: 12px;
                color: #475569;
                line-height: 1.6;
              }
              .invoice-info {
                text-align: right;
                width: 45%;
                padding-top: 16px;
              }
              .invoice-title {
                margin: 0 0 20px;
                font-size: 24px;
                font-weight: 900;
                color: #0d3b66;
                letter-spacing: 0.5px;
                text-transform: uppercase;
              }
              .invoice-row {
                display: flex;
                justify-content: flex-end;
                gap: 24px;
                margin-bottom: 10px;
                font-size: 12px;
                color: #475569;
              }
              .invoice-row strong { 
                color: #0f172a; 
                min-width: 90px; 
                text-align: right;
                font-weight: 800;
              }
              /* Table */
              table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-bottom: 30px;
              }
              thead th {
                border-top: 1px solid #cbd5e1;
                border-bottom: 1px solid #cbd5e1;
                color: #0f172a;
                font-size: 10px;
                font-weight: 900;
                text-transform: uppercase;
                text-align: left;
                padding: 12px 6px;
              }
              tbody td {
                border-bottom: 1px solid #e2e8f0;
                padding: 12px 6px;
                font-size: 11px;
                color: #334155;
                vertical-align: middle;
              }
              .product-details {
                display: flex;
                flex-direction: column;
                gap: 4px;
                padding-left: 4px;
              }
              .product-name {
                font-size: 11px;
                font-weight: 700;
                color: #0f172a;
                text-transform: uppercase;
              }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .amount { font-weight: 900; font-size: 12px; color: #0f172a; }
              .accent-red { color: #dc2626; font-weight: 700; }
              .accent-blue { color: #2563eb; font-weight: 700; }
              .empty-row { text-align: center; padding: 20px 8px; color: #64748b; }
              
              /* Summary / Totals */
              .summary-box {
                display: flex;
                justify-content: space-between;
                border-top: 2px solid #0d3b66;
                padding: 20px 10px;
                border-bottom: 1px solid #e2e8f0;
              }
              .summary-left {
                display: flex;
                gap: 40px;
              }
              .stat-col {
                display: flex;
                flex-direction: column;
                gap: 10px;
                text-align: center;
              }
              .stat-label {
                font-size: 10px;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: 700;
              }
              .stat-value {
                font-size: 16px;
                font-weight: 900;
                color: #0f172a;
              }
              .stat-value.red { color: #dc2626; }
              .stat-value.blue { color: #2563eb; }
              .summary-right {
                width: 250px;
                display: flex;
                flex-direction: column;
                gap: 16px;
              }
              .total-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 11px;
                color: #475569;
                text-transform: uppercase;
                font-weight: 700;
              }
              .total-row strong {
                font-size: 16px;
                font-weight: 900;
                color: #0f172a;
              }
              .total-row.net strong { font-size: 18px; color: #0f172a; }
              .total-row.paid {
                padding-bottom: 16px;
                border-bottom: 1px solid #e2e8f0;
              }
              .total-row.paid strong { color: #059669; }
              .total-row.balance strong { color: #dc2626; font-size: 16px; }
              
              /* Footer */
              .footer {
                margin-top: 60px;
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                padding: 0 10px;
              }
              .audit {
                font-size: 10px;
                color: #64748b;
                line-height: 1.6;
                font-style: italic;
              }
              .signature {
                width: 220px;
                border-top: 1px solid #0f172a;
                padding-top: 10px;
                text-align: center;
                font-size: 12px;
                font-weight: 700;
                color: #475569;
                text-transform: uppercase;
              }
              .brand-foot {
                margin-top: 40px;
                text-align: center;
                color: #94a3b8;
                font-size: 10px;
                font-style: italic;
              }
            </style>
          </head>
          <body>
            <div class="screen-note">Preparing print preview...</div>
            <div class="invoice">
              <div class="header">
                ${logoMarkup}
                <div>
                  <h1 class="hospital-name">${escapeHtml(hospitalName)}</h1>
                  <div class="hospital-meta">
                    <div>${escapeHtml(hospitalAddress || 'Address not available')}</div>
                    <div>${escapeHtml(hospitalContact || 'Contact not available')}</div>
                  </div>
                </div>
              </div>
              <div class="brand-divider"></div>
              <div class="brand-divider-thin"></div>

              <div class="top-section">
                <div class="bill-to-panel">
                  <div class="bill-to-title">Bill To</div>
                  <p class="party-name">${escapeHtml(billedToName)}</p>
                  <div class="party-meta">
                    <div>${escapeHtml(billedToAddress || '')}</div>
                    <div>${escapeHtml(billedToPhone ? 'Phone: ' + billedToPhone : '')}</div>
                  </div>
                </div>
                <div class="invoice-info">
                  <h2 class="invoice-title">${escapeHtml(invoiceHeading)}</h2>
                  <div class="invoice-row"><span>Invoice No:</span> <strong>${escapeHtml(String(trx.serialNo ?? '-'))}</strong></div>
                  <div class="invoice-row"><span>Date:</span> <strong>${escapeHtml(invoiceDate)}</strong></div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="width:30%">Product</th>
                    ${showBatchColumn ? '<th style="width:8%" class="text-center">Batch</th>' : ''}
                    ${showExpiryDateColumn ? '<th style="width:9%" class="text-center">Expiry</th>' : ''}
                    <th style="width:6%" class="text-center">Qty</th>
                    ${showBonusColumn ? '<th style="width:6%" class="text-center">Bonus</th>' : ''}
                    <th style="width:9%" class="text-center">Price</th>
                    <th style="width:7%" class="text-center">Discount</th>
                    <th style="width:7%" class="text-center">Tax</th>
                    <th style="width:9%" class="text-center">Net Price</th>
                    <th style="width:9%" class="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>${rowsMarkupA4}</tbody>
              </table>

              <div class="summary-box">
                <div class="summary-left">
                  <div class="stat-col"><span class="stat-label">Items</span><span class="stat-value">${transactionDetails.length}</span></div>
                  <div class="stat-col"><span class="stat-label">Quantity</span><span class="stat-value">${totalQuantity}</span></div>
                  <div class="stat-col"><span class="stat-label">Total</span><span class="stat-value">${grossTotal.toFixed(2)}</span></div>
                  <div class="stat-col"><span class="stat-label">Discount</span><span class="stat-value red">-${totalsSummary.totalDiscount.toFixed(2)}</span></div>
                  <div class="stat-col"><span class="stat-label">Tax</span><span class="stat-value blue">+${totalsSummary.totalTax.toFixed(2)}</span></div>
                </div>
                <div class="summary-right">
                  <div class="total-row net"><span>NET:</span><strong>${netTotal.toFixed(2)}</strong></div>
                  <div class="total-row paid"><span>PAID:</span><strong>${Number(trx.paidAmount || 0).toFixed(2)}</strong></div>
                  <div class="total-row balance"><span>BALANCE:</span><strong>${Number(trx.dueAmount || 0).toFixed(2)}</strong></div>
                </div>
              </div>

              <div class="footer">
                <div class="audit">
                  <div>Created: ${escapeHtml(String(trx.createdBy || '-'))} &bull; ${escapeHtml(createdAt)}</div>
                  <div>Updated: ${escapeHtml(String(trx.updatedBy || '-'))} &bull; ${escapeHtml(updatedAt)}</div>
                </div>
                <div class="signature">AUTHORIZED SIGNATURE</div>
              </div>

              <div class="brand-foot">${POWERED_BY_TEXT}</div>
            </div>
            <script>
              window.onload = function () {
                setTimeout(function () {
                  window.focus();
                  window.print();
                  window.close();
                }, 250);
              };
            </script>
          </body>
        </html>
      `;
    } else {
      const paperWidth = targetSize;
      const baseFont = targetSize === '58mm' ? 8 : targetSize === '76mm' ? 9 : 10;
      
      // Every receipt line prints on two rows: the full product name, then the
      // arithmetic beneath it. The old single-row layout truncated names at 25
      // characters, which on a 58mm roll cut "Capsule Paracetamol 500mg" down to
      // something the customer could not identify.
      const rowsMarkupThermal = transactionDetails.length
        ? transactionDetails.map((detail, index) => {
            const amount = Number(detail.amount ?? calculateLineAmount(detail));
            const qty = Number(detail.qtty || 0);
            const netPrice = qty > 0 ? amount / qty : Number(detail.price || 0);
            const itemName = printName(detail.medicineId ? getMedicineDisplay(detail.medicineId) : (detail.medicineName || 'Unknown'));
            const unit = detail.saleUnit && detail.saleUnit !== 'piece'
              ? ` ${detail.saleUnit === 'pack' ? 'Pack' : 'Strip'}`
              : '';
            return `
              <div class="line">
                <div class="line-name">${String(index + 1).padStart(2, '0')}. ${escapeHtml(itemName)}</div>
                <div class="line-calc">
                  <span class="calc">${qty}${escapeHtml(unit)} &times; ${netPrice.toFixed(2)}</span>
                  <span class="amt">${amount.toFixed(2)}</span>
                </div>
              </div>`;
          }).join('')
        : '<div class="line"><div class="line-name" style="text-align:center;">No items</div></div>';

      // "Invoice" is not specific enough on a return receipt -- the customer and
      // the auditor both need to see which direction the goods moved.
      const thermalTitle = trx.trxType === 'sales' ? 'SALES INVOICE'
        : trx.trxType === 'sales_return' ? 'SALES RETURN'
        : trx.trxType === 'purchase' ? 'PURCHASE INVOICE'
        : trx.trxType === 'purchase_return' ? 'PURCHASE RETURN'
        : 'INVOICE';

      const paidAmount = Number(trx.paidAmount || 0);
      const dueAmount = Number(trx.dueAmount || 0);
      const grossTotalThermal = netTotal + totalsSummary.totalDiscount - totalsSummary.totalTax;

      html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${escapeHtml(thermalTitle)}</title>
            <style>
              @page { size: ${paperWidth} auto; margin: 0; }
              * { box-sizing: border-box; }
              html, body {
                margin: 0; padding: 0; width: ${paperWidth}; background: #fff;
                /* A mono stack keeps every column of figures on the same
                   baseline grid, which is what makes a receipt readable. */
                font-family: 'Consolas', 'Menlo', 'DejaVu Sans Mono', monospace;
                color: #000;
                -webkit-print-color-adjust: exact; print-color-adjust: exact;
              }
              .screen-note { display: flex; align-items: center; justify-content: center; min-height: 100vh; color: #64748b; font-size: 14px; font-family: Arial, sans-serif; }
              @media screen { .receipt { display: none; } .screen-note { display: flex; } }
              @media print { .screen-note { display: none !important; } .receipt { display: block; } }

              .receipt { width: ${paperWidth}; padding: 5mm 2.5mm 4mm; margin: 0 auto; }

              /* ---- header ---- */
              .head { text-align: center; }
              .h-name { font-size: ${baseFont + 3}px; font-weight: 700; line-height: 1.15; text-transform: uppercase; }
              .h-sub { font-size: ${baseFont - 1}px; line-height: 1.35; margin-top: 1px; word-break: break-word; }

              .title { text-align: center; font-size: ${baseFont + 1}px; font-weight: 700; letter-spacing: 1px;
                       border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 2px 0; margin: 3px 0; }

              /* ---- meta: label left, value right ---- */
              .meta-row { display: flex; justify-content: space-between; gap: 6px; font-size: ${baseFont - 1}px; line-height: 1.45; }
              .meta-row span:last-child { text-align: right; font-weight: 700; word-break: break-word; }

              .rule { border-top: 1px dashed #000; margin: 3px 0; }
              .rule-solid { border-top: 1px solid #000; margin: 3px 0; }

              /* ---- items ---- */
              .cols { display: flex; justify-content: space-between; font-size: ${baseFont - 2}px;
                      font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
              .line { margin: 3px 0; }
              .line-name { font-size: ${baseFont - 1}px; font-weight: 700; line-height: 1.25; word-break: break-word; }
              .line-calc { display: flex; justify-content: space-between; font-size: ${baseFont - 1}px; line-height: 1.3; }
              .line-calc .calc { color: #333; }
              .line-calc .amt { font-weight: 700; }

              /* ---- totals ---- */
              .tot-row { display: flex; justify-content: space-between; font-size: ${baseFont - 1}px; line-height: 1.5; }
              .tot-row.grand { font-size: ${baseFont + 2}px; font-weight: 700; border-top: 1px solid #000;
                               border-bottom: 1px solid #000; padding: 2px 0; margin: 2px 0; }
              .tot-row.due { font-weight: 700; }

              /* ---- footer ---- */
              .qr-wrap { text-align: center; margin-top: 5px; }
              .qr-code { width: 68px; height: 68px; }
              .qr-cap { font-size: ${baseFont - 2}px; margin-top: 1px; }
              .thanks { text-align: center; font-size: ${baseFont - 1}px; font-weight: 700; margin-top: 4px; }
              .addr { text-align: center; font-size: ${baseFont - 2}px; line-height: 1.35; margin-top: 2px; word-break: break-word; }
              .brand { text-align: center; font-size: ${baseFont - 3}px; margin-top: 4px; }
            </style>
          </head>
          <body>
            <div class="screen-note">Preparing print preview...</div>
            <div class="receipt">

              <div class="head">
                <div class="h-name">${escapeHtml(hospitalName)}</div>
                ${hospitalAddress ? `<div class="h-sub">${escapeHtml(hospitalAddress)}</div>` : ''}
                ${hospitalContact ? `<div class="h-sub">${escapeHtml(hospitalContact)}</div>` : ''}
              </div>

              <div class="title">${escapeHtml(thermalTitle)}</div>

              <div class="meta-row"><span>Invoice #</span><span>${escapeHtml(String(trx.serialNo ?? '-'))}</span></div>
              <div class="meta-row"><span>Date</span><span>${escapeHtml(invoiceDate)}</span></div>
              <div class="meta-row"><span>${resolvedTemplate === 'sale' ? 'Customer' : 'Supplier'}</span><span>${escapeHtml(billedToName)}</span></div>
              ${billedToPhone ? `<div class="meta-row"><span>Phone</span><span>${escapeHtml(billedToPhone)}</span></div>` : ''}

              <div class="rule-solid"></div>
              <div class="cols"><span>Item / Qty &times; Rate</span><span>Amount</span></div>
              <div class="rule"></div>

              ${rowsMarkupThermal}

              <div class="rule-solid"></div>

              <div class="tot-row"><span>Subtotal</span><span>${grossTotalThermal.toFixed(2)}</span></div>
              ${totalsSummary.totalDiscount > 0 ? `<div class="tot-row"><span>Discount</span><span>-${totalsSummary.totalDiscount.toFixed(2)}</span></div>` : ''}
              ${totalsSummary.totalTax > 0 ? `<div class="tot-row"><span>Tax</span><span>+${totalsSummary.totalTax.toFixed(2)}</span></div>` : ''}
              <div class="tot-row grand"><span>TOTAL</span><span>${netTotal.toFixed(2)}</span></div>
              ${dueAmount > 0 ? `<div class="tot-row due"><span>Balance Due</span><span>${dueAmount.toFixed(2)}</span></div>` : ''}

              <div class="qr-wrap">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl || qrPayload)}" class="qr-code" />
                <div class="qr-cap">Scan to verify this invoice</div>
              </div>

              <div class="thanks">Thank you &mdash; get well soon</div>
              <div class="brand">${POWERED_BY_TEXT}</div>
            </div>
            <script>
              window.onload = function () {
                setTimeout(function () {
                  window.focus();
                  window.print();
                  window.close();
                }, 250);
              };
            </script>
          </body>
        </html>
      `;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };
  const getMedicineName = (id: string) => medicines.find((m) => m.id === id)?.brandName || 'Unknown';
  const getMedicineDisplay = (id: string) => {
    const med = medicines.find((m) => m.id === id);
    if (!med) return '';
    const parts = [med.type || '', med.brandName, med.strength || ''];
    return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  };
  const getSupplierDisplay = (id?: string) => suppliers.find((s) => s.id === id)?.name || '';
  const getPatientDisplay = (id?: string) => {
    const patient = patients.find((p) => p.id === id);
    if (!patient) return '';
    return `${patient.name} ${patient.patientId ? `(${patient.patientId})` : ''}${patient.phone ? ` - ${patient.phone}` : ''}`.trim();
  };
  const getPatientOptionDisplay = (patient: Patient) =>
    `${patient.name} ${patient.patientId ? `(${patient.patientId})` : ''}${patient.phone ? ` - ${patient.phone}` : ''}`.trim();
  const getTransactionPatientPhone = (transaction: Transaction) =>
    patients.find((patient) => String(patient.id) === String(transaction.patientId))?.phone || '';

  // Purchases/purchase returns are against a supplier, sales/sales returns a patient.
  const isSupplierSide = (trx: Transaction) =>
    trx.trxType === 'purchase' || trx.trxType === 'purchase_return';

  const getPartyName = (trx: Transaction) => {
    if (isSupplierSide(trx)) {
      return suppliers.find((s) => String(s.id) === String(trx.supplierId))?.name
        || trx.supplierName || '—';
    }
    return patients.find((p) => String(p.id) === String(trx.patientId))?.name
      || trx.patientName || '—';
  };

  const getPartyMeta = (trx: Transaction) => {
    if (isSupplierSide(trx)) {
      const supplier = suppliers.find((s) => String(s.id) === String(trx.supplierId));
      return supplier?.phone ? `${supplier.phone}` : '—';
    }
    const patient = patients.find((p) => String(p.id) === String(trx.patientId));
    if (!patient) return '—';
    return [patient.patientId ? `ID: ${patient.patientId}` : null, patient.phone || null]
      .filter(Boolean).join(' · ') || '—';
  };

  /**
   * Expiry is shown as MM/YYYY everywhere -- on screen and in print.
   *
   * A full "31 August 2027" is both wider than the column and more precise than
   * the carton, which only ever states a month. The hospitalId argument is kept
   * so callers do not change, though a month needs no timezone conversion.
   */
  const getExpiryDisplay = (date: Date | string | undefined, _hospitalId?: string) => {
    if (!date) return '';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return '';
    return `${String(parsed.getMonth() + 1).padStart(2, '0')}/${parsed.getFullYear()}`;
  };

  const getExpiryFromStock = (medicineId: string, batchNo: string) => {
    if (!medicineId || !batchNo) return undefined;
    const match = stocks.find(
      (s) =>
        String(s.hospitalId) === String(formData.hospitalId) &&
        s.medicineId === medicineId &&
        (s.batchNo || '') === batchNo
    );
    return match?.expiryDate;
  };

  useEffect(() => {
    if (selectedTransaction?.hospitalId) {
      loadHospitalSetting(selectedTransaction.hospitalId);
    } else if (selectedHospitalId) {
      loadHospitalSetting(selectedHospitalId);
    }
  }, [selectedTransaction?.hospitalId, selectedHospitalId, loadHospitalSetting]);

  // Follow the paper size configured for THIS kind of invoice: sales receipts
  // normally go to the thermal mini printer while purchase invoices go to A4.
  const activeHospitalIdForPrint = selectedTransaction?.hospitalId || selectedHospitalId || currentHospital.id;
  const printModuleForType = selectedTransaction
    ? printModuleFor(selectedTransaction)
    : printModuleFor({ trxType: trxTypeFilter } as Transaction);
  const configuredPaperSize = getPrintPaperSize(activeHospitalIdForPrint, printModuleForType);
  useEffect(() => {
    setReceiptSize(configuredPaperSize);
  }, [configuredPaperSize, activeHospitalIdForPrint, printModuleForType]);

  const getNearestExpiryForMedicine = (medicineId: string) => {
    if (!medicineId) return undefined;
    const scoped = stocks.filter(
      (s) => String(s.hospitalId) === String(formData.hospitalId) && s.medicineId === medicineId
    );
    const dates = scoped
      .map((s) => s.expiryDate)
      .filter((d): d is Date => Boolean(d));
    if (!dates.length) return undefined;
    const now = new Date();
    const future = dates.filter((d) => d >= now).sort((a, b) => a.getTime() - b.getTime());
    if (future.length) return future[0];
    return dates.sort((a, b) => b.getTime() - a.getTime())[0];
  };
  const getPreferredBatchForMedicine = (medicineId: string) => {
    if (!medicineId) return undefined;
    const scoped = stocks.filter(
      (s) =>
        String(s.hospitalId) === String(formData.hospitalId) &&
        s.medicineId === medicineId &&
        Number(s.stockQty || 0) + Number(s.bonusQty || 0) > 0
    );
    const withMeta = scoped
      .map((s) => {
        const batchNo = s.batchNo || '';
        return {
          batchNo,
          stockQty: Number(s.stockQty || 0) + Number(s.bonusQty || 0),
          expiryDate: s.expiryDate,
        };
      })
      .filter((b) => b.batchNo);
    if (!withMeta.length) return undefined;

    const now = new Date();
    const future = withMeta
      // End of the labelled month, not the stored 1st: a batch expiring 08/2027
      // is still sellable for the whole of August.
      .filter((b) => isUsableThrough(b.expiryDate, now))
      .sort((a, b) => (a.expiryDate as Date).getTime() - (b.expiryDate as Date).getTime());
    if (future.length) return future[0];

    const withExpiry = withMeta
      .filter((b) => b.expiryDate)
      .sort((a, b) => (a.expiryDate as Date).getTime() - (b.expiryDate as Date).getTime());
    if (withExpiry.length) return withExpiry[0];

    const getBatchNumber = (batchNo: string) => {
      const numeric = Number(String(batchNo).replace(/\D/g, ''));
      return Number.isFinite(numeric) && String(batchNo).match(/\d/) ? numeric : Number.POSITIVE_INFINITY;
    };

    const sortedByBatchNumber = [...withMeta].sort((a, b) => {
      const aNum = getBatchNumber(a.batchNo);
      const bNum = getBatchNumber(b.batchNo);
      if (aNum !== bNum) return aNum - bNum;
      return a.batchNo.localeCompare(b.batchNo);
    });

    return sortedByBatchNumber[0];
  };
  const getMedicineById = (id?: string) => medicines.find((m) => m.id === id);
  const getPackSize = (id?: string) => Math.max(1, Number(getMedicineById(id)?.packSize ?? 1));

  /** Pieces contained in one unit -- the single conversion rule, mirroring the API. */
  const piecesPerUnit = (id: string | undefined, unit: SaleUnit) => {
    const med = getMedicineById(id);
    if (!med) return 1;
    if (unit === 'pack') return Math.max(1, Number(med.packSize ?? 1));
    if (unit === 'strip') return Math.max(1, Number(med.piecesPerStrip ?? 1));
    return 1;
  };

  /**
   * The name of a sale tier. The piece tier is deliberately NOT labelled with the
   * medicine's category: "Surgical" is a type, not a unit, and reading it in the
   * Sale Unit dropdown made a per-piece line look like a category filter while
   * the pack tier next to it carried the pack price.
   */
  const unitLabelFor = (id: string | undefined, unit: SaleUnit) => {
    const med = getMedicineById(id);
    if (unit === 'pack') return med?.packLabel || t('ui.pack');
    if (unit === 'strip') return med?.stripLabel || t('ui.strip');
    return t('ui.piece');
  };

  /**
   * What the Sale Unit dropdown actually offers for a line.
   *
   * A <select> whose value is absent from its options silently renders the FIRST
   * option instead. Lines saved before the unit was recorded correctly hold
   * 'piece' on products sold only by pack/strip, so the row displayed "Pack"
   * while holding 'piece' -- right on screen, wrong in the payload, and
   * impossible to correct by hand because the field already read "Pack".
   * The stored unit is therefore always offered, even when it is no longer a
   * configured tier, so what is shown is what will be sent.
   */
  const unitOptionsFor = (id?: string, current?: SaleUnit): SaleUnit[] => {
    const allowed = sellableUnitsFor(id);
    return current && !allowed.includes(current) ? [current, ...allowed] : allowed;
  };

  /** Units the pharmacist configured this product to be sold in. */
  const sellableUnitsFor = (id?: string): SaleUnit[] => {
    const units = getMedicineById(id)?.sellableUnits;
    return units && units.length ? units : ['piece'];
  };

  const getPackLabel = (id?: string) => unitLabelFor(id, 'pack');

  /**
   * Unit-aware price. A pack line uses the medicine's Retail Price (MRP) when set,
   * otherwise the piece price multiplied by the pack size, so the two units always
   * reconcile (7 pieces at 1.00 == 1 pack at 7.00).
   */
  /** MM/YYYY for display, from whatever the row currently holds. */
  const toMonthInput = (value: Date | string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  };

  /**
   * Keeps the field to digits and inserts the slash as the user types, so the
   * four numbers printed on the carton can be entered without reaching for it.
   */
  const maskMonthYear = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  };

  /**
   * MM/YYYY -> the FIRST of that month, so 08/2027 is stored as 01/08/2027.
   *
   * Stock stays usable through the whole labelled month, so anything comparing
   * an expiry against today must use isUsableThrough() below rather than the
   * stored date directly -- otherwise a batch would retire on the 1st and up to
   * 30 days of good stock would be written off.
   *
   * Returns undefined until the value is complete and valid, so a half-typed
   * entry never overwrites a stored date.
   */
  const parseMonthInput = (value: string): Date | undefined => {
    const match = /^(\d{2})\/(\d{4})$/.exec(value);
    if (!match) return undefined;
    const month = Number(match[1]);
    const year = Number(match[2]);
    if (month < 1 || month > 12 || year < 1900 || year > 2999) return undefined;
    // Midday, not midnight: the value is later serialised through UTC, and in a
    // positive-offset zone like Kabul (+4:30) local midnight would shift the
    // date across the day boundary once converted.
    return new Date(year, month - 1, 1, 12, 0, 0);
  };

  /**
   * Whether a batch is still good, given that an expiry is really a month.
   *
   * Compares against the END of the stored month, which is what the carton
   * means: a pack labelled 08/2027 may be sold up to 31 August 2027.
   */
  const isUsableThrough = (expiry: Date | string | undefined, at: Date = new Date()): boolean => {
    if (!expiry) return false;
    const date = new Date(expiry);
    if (Number.isNaN(date.getTime())) return false;
    const endOfLabelledMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    return endOfLabelledMonth >= at;
  };

  /** Currency is always two decimals -- anything finer cannot be tendered. */
  const round2 = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

  const getMedicinePrice = (id: string, type: Transaction['trxType'], saleUnit: SaleUnit = 'piece') => {
    const med = medicines.find((m) => m.id === id);
    if (!med) return 0;
    const isPurchase = type === 'purchase' || type === 'purchase_return';

    // Cost Price and Sale Price are entered for a FULL PACK (the unit suppliers
    // trade in), so the smaller tiers are divisions of it -- not multiples.
    // For an unpackaged product packSize is 1, so this is a no-op and the price
    // keeps its old per-piece meaning.
    //
    // Retail Price (MRP) is deliberately NOT used here: it is the price printed
    // on the carton, kept for reference only. Billing always uses Sale Price for
    // sales/sales returns and Cost Price for purchases/purchase returns.
    const packQty = Math.max(1, piecesPerUnit(id, 'pack'));
    const stripsPerPack = Math.max(1, Math.round(packQty / Math.max(1, piecesPerUnit(id, 'strip'))));
    const packPriceBase = isPurchase ? (med.costPrice ?? 0) : (med.salePrice ?? 0);

    // Dividing a pack price by an odd tier count produces values like
    // 64.285714285, which a step=0.01 input rejects outright. Money is rounded
    // to two decimals at the point it becomes a price.
    if (saleUnit === 'pack') return round2(packPriceBase);
    if (saleUnit === 'strip') return round2(packPriceBase / stripsPerPack);
    return round2(packPriceBase / packQty);
  };

  /** "14 Pieces (2 Boxes)" / "11 Pieces (1 Box + 4)" */
  const describeStock = (pieces: number, medicineId?: string) => {
    const packSize = getPackSize(medicineId);
    const perStrip = piecesPerUnit(medicineId, 'strip');
    if (packSize <= 1 && perStrip <= 1) return `${pieces}`;

    const parts: string[] = [];
    let rest = pieces;

    if (packSize > 1) {
      const packs = Math.floor(rest / packSize);
      rest = rest % packSize;
      if (packs > 0) parts.push(`${packs} ${unitLabelFor(medicineId, 'pack')}`);
    }
    if (perStrip > 1) {
      const strips = Math.floor(rest / perStrip);
      rest = rest % perStrip;
      if (strips > 0) parts.push(`${strips} ${unitLabelFor(medicineId, 'strip')}`);
    }
    if (rest > 0) parts.push(`${rest}`);

    return parts.length ? `${pieces} (${parts.join(' + ')})` : `${pieces}`;
  };

  const exportToExcel = async () => {
    const { XLSX } = await loadXlsxTools();

    const workSheet = XLSX.utils.json_to_sheet(sortedTransactions.map((t) => ({
      ID: t.serialNo ?? t.id,
      Type: t.trxType,
      GrandTotal: t.grandTotal,
      Paid: t.paidAmount,
      Due: t.dueAmount,
      CreatedAt: t.createdAt ? new Date(t.createdAt).toLocaleString() : '',
      Hospital: getHospitalName(t.hospitalId),
    })));
    const workBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workBook, workSheet, 'Transactions');
    XLSX.writeFile(workBook, 'Transactions_List.xlsx');
  };

  const exportToPDF = async () => {
    const { jsPDF, autoTable } = await loadPdfTools();

    const doc = new jsPDF();
    const headerY = 20;
    const logoUrl = !isAllHospitals ? getHospital(currentHospital.id)?.logo : undefined;
    const logoDataUrl = await loadImageAsDataUrl(logoUrl);
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', 14, 12, 16, 16);
    }
    doc.setFontSize(18);
    doc.text('Transactions Report', logoDataUrl ? 34 : 14, headerY);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    if (!isAllHospitals) {
      doc.text(`Hospital: ${currentHospital.name}`, 14, 36);
      doc.text(`Code: ${getHospital(currentHospital.id)?.code || '—'}`, 14, 42);
    }

    autoTable(doc, {
      head: [['ID', 'Type', 'Grand Total', 'Paid', 'Due', 'Created']],
      body: sortedTransactions.map((t) => [
        `#${t.serialNo ?? t.id}`,
        t.trxType,
        t.grandTotal,
        t.paidAmount,
        t.dueAmount,
        t.createdAt ? new Date(t.createdAt).toLocaleString() : '—',
      ]),
      startY: isAllHospitals ? 40 : 50,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [66, 139, 202] },
    });

    doc.save('Transactions_Report.pdf');
  };

  const filteredTransactions = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return scopedTransactions.filter((t) => {
      const patientPhone = getTransactionPatientPhone(t).toLowerCase();
      const matchesTerm =
        String(t.serialNo ?? t.id).includes(term) ||
        (t.trxType || '').toLowerCase().includes(term) ||
        (t.patientName || '').toLowerCase().includes(term) ||
        getPatientDisplay(t.patientId).toLowerCase().includes(term) ||
        patientPhone.includes(term) ||
        (t.details || []).some((d) => (d.medicineName || getMedicineName(d.medicineId)).toLowerCase().includes(term));
      const matchesType = t.trxType === trxTypeFilter;
      return matchesTerm && matchesType;
    });
  }, [scopedTransactions, searchTerm, trxTypeFilter, medicines, patients]);

  const sortedTransactions = useMemo(() => {
    const dir = sortState.dir === 'asc' ? 1 : -1;
    const valueOf = (t: Transaction): string | number => {
      switch (sortState.key) {
        case 'serial': return Number(t.serialNo ?? t.id ?? 0);
        case 'party': return getPartyName(t).toLowerCase();
        case 'grandTotal': return Number(t.grandTotal ?? 0);
        case 'paid': return Number(t.paidAmount ?? 0);
        case 'due': return Number(t.dueAmount ?? 0);
        case 'date':
        default: return t.createdAt ? new Date(t.createdAt).getTime() : 0;
      }
    };

    return [...filteredTransactions].sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      if (typeof av === 'string' || typeof bv === 'string') {
        return String(av).localeCompare(String(bv)) * dir;
      }
      return (av - bv) * dir;
    });
  }, [filteredTransactions, sortState, patients, suppliers]);

  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / itemsPerPage));
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedTransactions.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedTransactions, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, trxTypeFilter, selectedHospitalId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const filteredMedicines = useMemo(() => {
    const term = medicineSearch.toLowerCase().trim();
    const scoped = medicines.filter((m) => String(m.hospitalId) === String(formData.hospitalId));
    if (!term) return scoped;
    return scoped.filter((m) =>
      m.brandName.toLowerCase().includes(term) ||
      (m.genericName || '').toLowerCase().includes(term) ||
      (m.strength || '').toLowerCase().includes(term) ||
      (m.type || '').toLowerCase().includes(term)
    );
  }, [medicines, medicineSearch, formData.hospitalId]);

  const filteredSuppliers = useMemo(() => {
    const term = supplierSearch.toLowerCase().trim();
    const scoped = suppliers.filter((s) => String(s.hospitalId) === String(formData.hospitalId));
    if (!term) return scoped;
    return scoped.filter((s) =>
      s.name.toLowerCase().includes(term) ||
      (s.contactInfo || '').toLowerCase().includes(term) ||
      (s.address || '').toLowerCase().includes(term)
    );
  }, [suppliers, supplierSearch, formData.hospitalId]);

  const filteredPatients = useMemo(() => {
    const term = patientSearch.toLowerCase().trim();
    const scoped = patients.filter((p) => String(p.hospitalId) === String(formData.hospitalId));
    if (!term) return scoped;
    return scoped.filter((p) =>
      p.name.toLowerCase().includes(term) ||
      (p.patientId || '').toLowerCase().includes(term) ||
      (p.phone || '').toLowerCase().includes(term) ||
      (p.address || '').toLowerCase().includes(term)
    );
  }, [patients, patientSearch, formData.hospitalId]);

  const availableMedicines = filteredMedicines.length > 0 ? filteredMedicines : remoteMedicines;
  const availableSuppliers = filteredSuppliers.length > 0 ? filteredSuppliers : remoteSuppliers;
  const availablePatients = filteredPatients.length > 0 ? filteredPatients : remotePatients;

  const getPatientOptions = () => {
    return availablePatients
      .filter((p) => {
        const term = patientSearch.toLowerCase();
        if (!term) return true;
        return p.name.toLowerCase().includes(term) ||
          (p.patientId || '').toLowerCase().includes(term) ||
          (p.phone || '').toLowerCase().includes(term) ||
          (p.address || '').toLowerCase().includes(term);
      })
      // Newest patients first; fall back to id when createdAt is missing so the
      // order is never arbitrary.
      .sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (bt !== at) return bt - at;
        return Number(b.id ?? 0) - Number(a.id ?? 0);
      })
      .slice(0, 30);
  };

  const getSupplierOptions = () => {
    return availableSuppliers
      .filter((s) => {
        const term = supplierSearch.toLowerCase();
        if (!term) return true;
        return s.name.toLowerCase().includes(term) ||
          (s.contactInfo || '').toLowerCase().includes(term) ||
          (s.address || '').toLowerCase().includes(term);
      })
      .slice(0, 30);
  };

  const getMedicineOptions = (index: number) => {
    return availableMedicines
      .filter((m) => {
        const term = (medicineQueries[index] || '').trim().toLowerCase();
        if (!term) return true;
        // Id and barcode are searched too: staff who know a product by the
        // number on the shelf label should not have to spell its brand name,
        // and a code typed by hand should find the same row a scan would.
        const display = [
          m.id,
          m.barcode,
          m.brandName,
          m.genericName,
          m.strength,
          m.type,
        ].filter(Boolean).join(' ').toLowerCase();
        return display.includes(term);
      })
      .filter((m) => {
        if (!['sales', 'purchase_return'].includes(formData.trxType)) return true;
        if (formData.trxType === 'sales' && getShowOutOfStockMedicinesForPharmacy(formData.hospitalId)) return true;
        if (getAvailableStock(m.id, undefined, formData.hospitalId) > 0) return true;
        // A product whose every batch has lapsed still sits on the shelf. Dropping
        // it from the list reads as "we never stocked it"; it is listed with an
        // Expired tag instead, so the reason it cannot be sold is visible.
        return getAvailableStock(m.id, undefined, formData.hospitalId, { includeExpired: true }) > 0;
      })
      .slice(0, 50);
  };

  useEffect(() => {
    const term = medicineSearch.trim();
    if (term.length < 2 || filteredMedicines.length > 0) {
      setRemoteMedicines([]);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/medicines', {
          params: {
            search: term,
            hospital_id: formData.hospitalId,
          },
        });
        if (!active) return;
        const records: any[] = data.data ?? data;
        const mapped = records.map((m) => ({
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
          status: (m.status ?? 'active') as any,
          createdAt: m.created_at ? new Date(m.created_at) : undefined,
          updatedAt: m.updated_at ? new Date(m.updated_at) : undefined,
        }));
        setRemoteMedicines(mapped);
      } catch {
        if (active) setRemoteMedicines([]);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [medicineSearch, formData.hospitalId, filteredMedicines.length]);

  useEffect(() => {
    const term = supplierSearch.trim();
    if (term.length < 2 || filteredSuppliers.length > 0) {
      setRemoteSuppliers([]);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/suppliers', {
          params: { search: term, hospital_id: formData.hospitalId },
        });
        if (!active) return;
        const records: any[] = data.data ?? data;
        const mapped = records.map((s) => ({
          id: String(s.id),
          hospitalId: String(s.hospital_id),
          name: s.name ?? '',
          contactInfo: s.contact_info ?? '',
          address: s.address ?? '',
          createdAt: s.created_at ? new Date(s.created_at) : undefined,
          updatedAt: s.updated_at ? new Date(s.updated_at) : undefined,
        }));
        setRemoteSuppliers(mapped);
      } catch {
        if (active) setRemoteSuppliers([]);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [supplierSearch, formData.hospitalId, filteredSuppliers.length]);

  useEffect(() => {
    const term = patientSearch.trim();
    if (term.length < 2 || filteredPatients.length > 0) {
      setRemotePatients([]);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/patients', {
          params: { search: term, hospital_id: formData.hospitalId },
        });
        if (!active) return;
        const records: any[] = data.data ?? data;
        const mapped: Patient[] = records.map((p): Patient => ({
          id: String(p.id),
          hospitalId: String(p.hospital_id),
          patientId: p.patient_id ?? '',
          name: p.name ?? '',
          age: Number(p.age ?? 0),
          gender: (p.gender ?? 'other') as any,
          phone: p.phone ?? '',
          address: p.address ?? '',
          status: (p.status ?? 'active') as any,
          image: p.image_url ?? p.image_path ?? '',
          createdAt: p.created_at ? new Date(p.created_at) : new Date(),
          updatedAt: p.updated_at ? new Date(p.updated_at) : new Date(),
        }));
        setRemotePatients(mapped);
      } catch {
        if (active) setRemotePatients([]);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [patientSearch, formData.hospitalId, filteredPatients.length]);

  const calculateLineAmount = (item: TransactionDetail) => {
    const price = Number(item.price || 0);
    const discount = Number(item.discount || 0);
    const tax = Number(item.tax || 0);
    const qtty = Number(item.qtty || 0);
    const unitDiscount = (price * discount) / 100;
    const unitTax = (price * tax) / 100;
    return qtty * (price - unitDiscount + unitTax);
  };

  const calculateTotals = (items: TransactionDetail[]) => {
    let grandTotal = 0;
    items.forEach((item) => {
      grandTotal += calculateLineAmount(item);
    });
    return Number(grandTotal.toFixed(2));
  };

  const calculateTotalsSummary = (items: TransactionDetail[]) => {
    let totalDiscount = 0;
    let totalTax = 0;
    let totalBonus = 0;
    items.forEach((item) => {
      const price = Number(item.price || 0);
      const discount = Number(item.discount || 0);
      const tax = Number(item.tax || 0);
      const qtty = Number(item.qtty || 0);
      const bonus = Number(item.bonus || 0);
      const unitDiscount = (price * discount) / 100;
      const unitTax = (price * tax) / 100;
      totalDiscount += qtty * unitDiscount;
      totalTax += qtty * unitTax;
      totalBonus += bonus;
    });
    return {
      totalDiscount: Number(totalDiscount.toFixed(2)),
      totalTax: Number(totalTax.toFixed(2)),
      totalBonus: Number(totalBonus.toFixed(2)),
    };
  };

  const handleAdd = () => {
    const targetHospitalId = userRole === 'super_admin' && selectedHospitalId !== 'all'
      ? selectedHospitalId
      : currentHospital.id;
    // New invoices open as the type the user is currently viewing.
    setFormData({
      ...buildInitialFormData(targetHospitalId),
      trxType: trxTypeFilter,
      isWalkIn: defaultIsWalkIn,
      walkInName: walkInDefaults.name,
      walkInPhone: walkInDefaults.phone,
      walkInAddress: walkInDefaults.address,
    });
    setSupplierSearch('');
    setPatientSearch('');
    setOpenSupplierDropdown(false);
    setOpenPatientDropdown(false);
    setHighlightedSupplierIndex(-1);
    setHighlightedPatientIndex(-1);
    setHighlightedMedicineIndex({});
    setLastEditedTotal('auto');
    setShowAddModal(true);
  };

  const resetTransactionForm = (targetHospitalId?: string) => {
    const hospitalId = targetHospitalId || currentHospital.id;
    setFormData(buildInitialFormData(hospitalId));
    setSupplierSearch('');
    setPatientSearch('');
    setMedicineSearch('');
    setMedicineQueries({});
    setOpenSupplierDropdown(false);
    setOpenPatientDropdown(false);
    setOpenMedicineDropdownIndex(null);
    setHighlightedSupplierIndex(-1);
    setHighlightedPatientIndex(-1);
    setHighlightedMedicineIndex({});
    setLastEditedTotal('auto');
  };

  const closeTransactionModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setSelectedTransaction(null);
    resetTransactionForm();
  };

  const handleView = (trx: Transaction) => {
    setSelectedTransaction(trx);
    if (trx.trxType === 'purchase' || trx.trxType === 'purchase_return') {
      setPrintTemplate(trx.supplierId ? 'supplier' : 'purchase');
    } else {
      setPrintTemplate('sale');
    }
    setShowViewModal(true);
  };

  const handleEdit = (trx: Transaction) => {
    setSelectedTransaction(trx);
    setFormData({
      trxType: trx.trxType,
      paidAmount: trx.paidAmount,
      dueAmount: trx.dueAmount,
      supplierId: trx.supplierId || '',
      patientId: trx.patientId || '',
      // Preserve how the sale was originally made; the name is already snapshot
      // on the transaction so an edit never loses the walk-in customer.
      isWalkIn: Boolean(trx.isWalkIn),
      walkInName: trx.isWalkIn ? (trx.patientName || '') : '',
      walkInPhone: '',
      walkInAddress: '',
      hospitalId: trx.hospitalId,
      transactionDate: trx.createdAt ? new Date(trx.createdAt) : new Date(),
      items: (trx.details || []).map((d) => ({
        ...d,
        expiryDate: d.expiryDate ? new Date(d.expiryDate) : undefined,
      })),
    });
    setSupplierSearch(getSupplierDisplay(trx.supplierId));
    setPatientSearch(getPatientDisplay(trx.patientId));
    setOpenSupplierDropdown(false);
    setOpenPatientDropdown(false);
    setHighlightedSupplierIndex(-1);
    setHighlightedPatientIndex(-1);
    setHighlightedMedicineIndex({});
    setLastEditedTotal('auto');
    setShowEditModal(true);

    // An edit almost always means adding to the invoice, so the list opens
    // scrolled to the last line instead of making the user drag past 49 rows.
    // The scan field keeps the caret; only the list is scrolled.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const list = itemListRef.current;
      if (list) list.scrollTop = list.scrollHeight;
    }));
  };

  const handleDelete = (trx: Transaction) => {
    setSelectedTransaction(trx);
    setShowDeleteModal(true);
  };

  const handleItemChange = (index: number, patch: Partial<TransactionDetail>) => {
    setFormData((prev) => {
      const next = [...prev.items];
      next[index] = { ...next[index], ...patch } as TransactionDetail;
      return { ...prev, items: next };
    });
  };

  const handlePaidChange = (value: number) => {
    setLastEditedTotal('paid');
    const grandTotal = calculateTotals(formData.items);
    const nextPaid = Math.max(0, value);
    const nextDue = Math.max(0, grandTotal - nextPaid);
    setFormData((prev) => ({ ...prev, paidAmount: nextPaid, dueAmount: nextDue }));
  };

  const handleDueChange = (value: number) => {
    setLastEditedTotal('due');
    const grandTotal = calculateTotals(formData.items);
    const nextDue = Math.max(0, value);
    const nextPaid = Math.max(0, grandTotal - nextDue);
    setFormData((prev) => ({ ...prev, paidAmount: nextPaid, dueAmount: nextDue }));
  };


  // What the user is currently typing per row, before it parses. Without
  // this the field would snap back to the stored value mid-entry.
  const [expiryDrafts, setExpiryDrafts] = useState<Record<number, string>>({});
  const [itemFilter, setItemFilter] = useState('');
  // Per row: does its medicine list open upward because it sits near the foot?
  const [dropdownRect, setDropdownRect] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);

  /** Does this line match what was typed into the find box? */
  const itemMatchesFilter = (item: TransactionDetail) => {
    const term = itemFilter.trim().toLowerCase();
    if (!term) return true;
    const med = getMedicineById(item.medicineId);
    return [med?.id, med?.barcode, med?.brandName, med?.genericName, med?.strength, item.batchNo]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(term);
  };

  const [scanValue, setScanValue] = useState('');
  const [scanning, setScanning] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  /**
   * An invoice is rarely one line, so the caret has to return to the scan box
   * after every item. Clicking a quantity or price field moves focus away by
   * design -- refocusing is therefore only done right after a scan resolves.
   */
  const refocusScanner = () => {
    requestAnimationFrame(() => {
      const el = scanInputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
  };

  /**
   * USB barcode scanners behave like a keyboard and end with Enter. Resolve the
   * code to a medicine and add it to the sale; scanning the same product again
   * increments the existing line instead of creating a duplicate row.
   */
  const handleScan = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;
    setScanning(true);
    try {
      const med = await findByBarcode(code, formData.hospitalId);
      if (!med) {
        toast.error(t('ui.barcodeNotFound', { code }));
        return;
      }

      setFormData((prev) => {
        const items = [...prev.items];
        // Match an existing line for the same medicine in the same unit.
        const idx = items.findIndex((it) => it.medicineId === med.id);
        if (idx >= 0) {
          items[idx] = { ...items[idx], qtty: Number(items[idx].qtty || 0) + 1 };
          return { ...prev, items };
        }

        const allowedUnits = med.sellableUnits && med.sellableUnits.length ? med.sellableUnits : ['piece'];
        const unit: SaleUnit = (allowedUnits.includes(med.defaultSaleUnit as SaleUnit)
          ? med.defaultSaleUnit
          : allowedUnits[0]) as SaleUnit;
        const price = getMedicinePrice(med.id, prev.trxType, unit);

        // A scanned line has to pick its batch the same way a typed one does.
        // Leaving it blank sent the sale in against "any batch", which the API
        // then resolves to unexpired stock only -- so a product whose oldest
        // batch had lapsed was refused as out of stock at the till.
        let batchNo = '';
        let expiryDate: TransactionDetail['expiryDate'];
        if (prev.trxType === 'sales' || prev.trxType === 'sales_return') {
          const preferred = getPreferredBatchForMedicine(med.id);
          if (preferred?.batchNo) {
            batchNo = preferred.batchNo;
            expiryDate = preferred.expiryDate || expiryDate;
          } else {
            expiryDate = getNearestExpiryForMedicine(med.id) || expiryDate;
          }
        }
        const line = { ...emptyItem(), medicineId: med.id, qtty: 1, saleUnit: unit, price, batchNo, expiryDate };

        // Replace a blank first row rather than leaving it empty.
        const blank = items.findIndex((it) => !it.medicineId);
        if (blank >= 0) items[blank] = line; else items.push(line);
        return { ...prev, items };
      });

      toast.success(med.brandName);
    } finally {
      setScanning(false);
      setScanValue('');
      refocusScanner();
    }
  };

  /**
   * Invoice-level keyboard shortcuts.
   *
   * Ctrl+S saves and Escape closes. Both are safe wherever the cursor is: no
   * one types either into a medicine name, unlike the plain-letter shortcut
   * this replaced, which could never fire from inside a cell.
   */

  useEffect(() => {
    if (!showAddModal && !showEditModal) return;

    const onKeyDown = (event: KeyboardEvent) => {
      // Ctrl+S is the only save shortcut. Shift+S was removed: inside a text
      // cell Shift+S is simply how the letter S is typed, so it could never
      // fire where the cursor actually is, and two shortcuts for one action is
      // one more than anyone needs to remember.
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (submitting) return;
        // Routed through the form so validation and the submit guard both run,
        // exactly as if the Save button had been pressed.
        transactionFormRef.current?.requestSubmit();
        return;
      }

      if (event.ctrlKey || event.altKey || event.metaKey) return;

      // Escape closes, and unlike a letter shortcut it is safe inside a text
      // field -- nobody types Esc into a medicine name -- so it works wherever
      // the cursor happens to be.
      if (event.key === 'Escape') {
        // Let an open medicine dropdown take the first Escape for itself.
        if (openMedicineDropdownIndex !== null) return;
        event.preventDefault();
        closeTransactionModal();
        return;
      }

    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showAddModal, showEditModal, submitting, openMedicineDropdownIndex]);

  const handleMedicineChange = (index: number, medicineId: string) => {
    // Adopt the medicine's configured default unit (Box for packaged products),
    // falling back to the line's current unit when that is also permitted.
    const allowed = sellableUnitsFor(medicineId);
    const currentUnit = (formData.items[index]?.saleUnit ?? 'piece') as SaleUnit;
    const configuredDefault = (getMedicineById(medicineId)?.defaultSaleUnit ?? 'piece') as SaleUnit;
    const effectiveUnit: SaleUnit = allowed.includes(configuredDefault)
      ? configuredDefault
      : (allowed.includes(currentUnit) ? currentUnit : allowed[0]);
    const price = getMedicinePrice(medicineId, formData.trxType, effectiveUnit);
    let expiryDate = formData.items[index]?.expiryDate;
    const batchNo = formData.items[index]?.batchNo || '';
    let nextBatchNo = batchNo;
    if (formData.trxType === 'sales' || formData.trxType === 'sales_return') {
      if (!batchNo) {
        const preferred = getPreferredBatchForMedicine(medicineId);
        if (preferred?.batchNo) {
          nextBatchNo = preferred.batchNo;
          expiryDate = preferred.expiryDate || expiryDate;
        } else {
          expiryDate = getNearestExpiryForMedicine(medicineId) || expiryDate;
        }
      }
    }
    // The unit has to travel with the price it produced. Writing only the price
    // left the line on 'piece' while it carried the pack price, so a 100-piece
    // box was billed at box price and reserved a single piece.
    handleItemChange(index, { medicineId, price, saleUnit: effectiveUnit, batchNo: nextBatchNo, expiryDate });
  };

  const itemListRef = useRef<HTMLDivElement>(null);

  // A portalled list is positioned in page coordinates, so it has to be
  // re-measured whenever those coordinates move.
  useEffect(() => {
    if (openMedicineDropdownIndex === null) {
      setDropdownRect(null);
      return;
    }
    const reposition = () => positionDropdown(openMedicineDropdownIndex);
    reposition();
    const list = itemListRef.current;
    list?.addEventListener('scroll', reposition);
    window.addEventListener('resize', reposition);
    return () => {
      list?.removeEventListener('scroll', reposition);
      window.removeEventListener('resize', reposition);
    };
  }, [openMedicineDropdownIndex]);
  const transactionFormRef = useRef<HTMLFormElement>(null);

  /**
   * Decides which way a medicine dropdown should open.
   *
   * It used to scroll the row upward to make room, which meant clicking a line
   * near the bottom moved that line out from under the cursor -- the row the
   * user had just aimed at jumped away as the list appeared. The row now stays
   * exactly where it is and the list opens upward instead, the way a desktop
   * combo box behaves at the foot of a window.
   */
  const revealDropdown = (index: number) => {
    requestAnimationFrame(() => positionDropdown(index));
  };

  /**
   * Pin the medicine list to the box it belongs to, in page coordinates.
   *
   * The list is drawn in a portal on document.body rather than inside the row.
   * The item panel scrolls, and a scrolling box clips on BOTH axes -- so a list
   * rendered inside it was cut off, or vanished entirely, exactly when the row
   * was near an edge. Neither scrolling the row into view nor flipping the list
   * upward fixed that reliably; both were working around the clip instead of
   * leaving it. Measured against the viewport, nothing can crop it.
   */
  const positionDropdown = (index: number) => {
    const list = itemListRef.current;
    const input = list?.querySelector(
      `[data-grid-row="${index}"] [data-medicine-input]`
    ) as HTMLElement | null;
    if (!input) return;

    const rect = input.getBoundingClientRect();
    const DROPDOWN_HEIGHT = 192; // max-h-48
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp = spaceBelow < DROPDOWN_HEIGHT && rect.top > spaceBelow;

    setDropdownRect({
      left: rect.left,
      width: rect.width,
      top: flipUp ? rect.top - DROPDOWN_HEIGHT - 4 : rect.bottom + 2,
      maxHeight: Math.max(96, Math.min(DROPDOWN_HEIGHT, flipUp ? rect.top - 8 : spaceBelow - 8)),
    });
  };

  /** Scrolls the item list to the last row and focuses its medicine field. */
  const focusLastRow = () => {
    // Two frames: one for React to commit the new row, one for layout to
    // settle so the scroll lands on the row rather than where it used to be.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const list = itemListRef.current;
      if (!list) return;
      list.scrollTop = list.scrollHeight;
      const inputs = list.querySelectorAll<HTMLInputElement>('input[data-medicine-input]');
      const last = inputs[inputs.length - 1];
      last?.focus();
    }));
  };

  const addItemRow = () => {
    setFormData((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }));
    focusLastRow();
  };

  /**
   * Enter anywhere on a row starts the next one.
   *
   * Reaching for the + button between every line is the slowest part of typing
   * a 50-line purchase invoice. The medicine combobox is excluded because Enter
   * there already picks the highlighted suggestion.
   */
  /**
   * Every editable cell in a row, in the order they are read.
   *
   * Taken from the DOM rather than from a hand-maintained column list: which
   * columns exist depends on the hospital's visibleFields settings, and a
   * hardcoded index would silently point at the wrong cell the moment a site
   * turned Bonus or Tax off.
   */
  const rowCells = (row: Element | null): HTMLElement[] =>
    row
      ? Array.from(row.querySelectorAll<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]), select:not([disabled])'
        ))
      : [];

  const focusCell = (rowIndex: number, colIndex: number): boolean => {
    const row = itemListRef.current?.querySelector(`[data-grid-row="${rowIndex}"]`) ?? null;
    const cells = rowCells(row);
    if (!cells.length) return false;

    // Clamp: a row may legitimately have fewer cells than the one moved from.
    const cell = cells[Math.min(colIndex, cells.length - 1)];
    cell?.focus();
    if (cell instanceof HTMLInputElement) cell.select?.();
    return Boolean(cell);
  };

  /**
   * Spreadsheet keys for the item grid.
   *
   * Staff here come from desktop stock software and expect a sheet: up and down
   * walk the same column through the rows, left and right step between cells,
   * and Enter moves down rather than submitting the document.
   *
   * Left/Right only leave a text cell once the caret is already at its edge, so
   * ordinary editing inside a cell still works -- the alternative would make it
   * impossible to correct the middle of a medicine name. Number cells hold a few
   * characters at most, so they hand over immediately.
   */
  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, index: number) => {
    // The medicine box owns its own arrows and Enter while its list is open.
    if (event.defaultPrevented) return;
    if (event.altKey || event.metaKey) return;

    // Ctrl+Up/Down walks rows from anywhere, including out of a dropdown whose
    // plain arrows are busy changing its value.
    if (event.ctrlKey) {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      const row = target.closest('[data-grid-row]');
      const col = rowCells(row).indexOf(target);
      if (col === -1) return;
      event.preventDefault();
      focusCell(index + (event.key === 'ArrowDown' ? 1 : -1), col);
      return;
    }

    const target = event.target as HTMLElement;
    if (target.tagName === 'BUTTON') return;

    const row = target.closest('[data-grid-row]');
    const cells = rowCells(row);
    const col = cells.indexOf(target);
    if (col === -1) return;

    const lastRow = formData.items.length - 1;
    const input = target as HTMLInputElement;
    const isTextCell = target.tagName === 'INPUT' && input.type !== 'number';

    // selectionStart throws on number inputs in some browsers, so it is only
    // consulted for the text cells that actually need caret awareness.
    const atStart = !isTextCell || (input.selectionStart === 0 && input.selectionEnd === 0);
    const atEnd = !isTextCell
      || (input.selectionStart === input.value.length && input.selectionEnd === input.value.length);

    // A dropdown owns its own up/down: that is how the value is changed without
    // reaching for the mouse, which was the whole point of working by keyboard.
    // Rows are still walked from a dropdown with Enter, or Ctrl+Up/Down.
    const isSelect = target.tagName === 'SELECT';

    switch (event.key) {
      case 'ArrowDown':
        if (isSelect) return;
        event.preventDefault();
        focusCell(index + 1, col);
        return;

      case 'ArrowUp':
        if (isSelect) return;
        event.preventDefault();
        focusCell(index - 1, col);
        return;

      case 'ArrowLeft':
        if (!atStart || col === 0) return;
        event.preventDefault();
        cells[col - 1]?.focus();
        if (cells[col - 1] instanceof HTMLInputElement) (cells[col - 1] as HTMLInputElement).select?.();
        return;

      case 'ArrowRight':
        if (!atEnd || col === cells.length - 1) return;
        event.preventDefault();
        cells[col + 1]?.focus();
        if (cells[col + 1] instanceof HTMLInputElement) (cells[col + 1] as HTMLInputElement).select?.();
        return;

      case 'Enter':
        // Never submits. A grid that saves on Enter files the invoice halfway
        // through typing it, which is what the counter kept doing by accident.
        event.preventDefault();
        if (index === lastRow) {
          addItemRow();
        } else {
          focusCell(index + 1, col);
        }
        return;

      default:
    }
  };

  const removeItemRow = (index: number) => {
    setFormData((prev) => {
      if (prev.items.length <= 1) {
        return { ...prev, items: [emptyItem()] };
      }
      return { ...prev, items: prev.items.filter((_, i) => i !== index) };
    });
    setMedicineQueries((prev) => {
      const next: Record<number, string> = {};
      Object.keys(prev).forEach((key) => {
        const numericKey = Number(key);
        if (numericKey < index) next[numericKey] = prev[numericKey];
        if (numericKey > index) next[numericKey - 1] = prev[numericKey];
      });
      return next;
    });
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.items.length || formData.items.some((i) => !i.medicineId)) {
      toast.error('Please select medicines for all items');
      return;
    }
    if ((formData.trxType === 'purchase' || formData.trxType === 'purchase_return') && !formData.supplierId) {
      toast.error('Please select a supplier');
      return;
    }
    // A sale needs a party: either a registered patient or a named walk-in customer.
    if (formData.trxType === 'sales' || formData.trxType === 'sales_return') {
      if (formData.isWalkIn) {
        if (!formData.walkInName.trim()) {
          toast.error(t('ui.walkInNameRequired'));
          return;
        }
      } else if (!formData.patientId) {
        toast.error('Please select a patient');
        return;
      }
    }
    if (!validateSalesStock()) {
      return;
    }
    setSubmitting(true);
    try {
      const grandTotal = calculateTotals(formData.items);
      const paidAmount = Number(formData.paidAmount || 0);
      const dueAmount = Math.max(0, Number(formData.dueAmount || 0));
      await addTransaction({
        hospitalId: formData.hospitalId,
        supplierId: formData.supplierId || undefined,
        patientId: formData.isWalkIn ? undefined : (formData.patientId || undefined),
        isWalkIn: formData.isWalkIn,
        walkInCustomer: formData.isWalkIn
          ? {
              name: formData.walkInName.trim(),
              phone: formData.walkInPhone.trim() || undefined,
              address: formData.walkInAddress.trim() || undefined,
            }
          : undefined,
        trxType: formData.trxType,
        paidAmount,
        grandTotal,
        dueAmount: Math.min(grandTotal, dueAmount),
        details: formData.items,
      });
      closeTransactionModal();
      toast.success('Transaction added successfully.');
      void Promise.all([refreshMedicines(), refreshStocks()]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransaction) return;
    if (!formData.items.length || formData.items.some((i) => !i.medicineId)) {
      toast.error('Please select medicines for all items');
      return;
    }
    if ((formData.trxType === 'purchase' || formData.trxType === 'purchase_return') && !formData.supplierId) {
      toast.error('Please select a supplier');
      return;
    }
    // A sale needs a party: either a registered patient or a named walk-in customer.
    if (formData.trxType === 'sales' || formData.trxType === 'sales_return') {
      if (formData.isWalkIn) {
        if (!formData.walkInName.trim()) {
          toast.error(t('ui.walkInNameRequired'));
          return;
        }
      } else if (!formData.patientId) {
        toast.error('Please select a patient');
        return;
      }
    }
    if (!validateSalesStock()) {
      return;
    }
    setSubmitting(true);
    try {
      const grandTotal = calculateTotals(formData.items);
      const paidAmount = Number(formData.paidAmount || 0);
      const dueAmount = Math.max(0, Number(formData.dueAmount || 0));
      await updateTransaction({
        id: selectedTransaction.id,
        hospitalId: formData.hospitalId,
        supplierId: formData.supplierId || undefined,
        patientId: formData.isWalkIn ? undefined : (formData.patientId || undefined),
        isWalkIn: formData.isWalkIn,
        walkInCustomer: formData.isWalkIn
          ? {
              name: formData.walkInName.trim(),
              phone: formData.walkInPhone.trim() || undefined,
              address: formData.walkInAddress.trim() || undefined,
            }
          : undefined,
        trxType: formData.trxType,
        paidAmount,
        grandTotal,
        dueAmount: Math.min(grandTotal, dueAmount),
        details: formData.items,
      });
      closeTransactionModal();
      toast.success('Transaction updated successfully.');
      void Promise.all([refreshMedicines(), refreshStocks()]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedTransaction) return;
    try {
      await deleteTransaction(selectedTransaction.id);
      setShowDeleteModal(false);
      toast.success('Transaction deleted successfully.');
      void Promise.all([refreshMedicines(), refreshStocks()]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete transaction');
    }
  };

  const totalPreview = calculateTotals(formData.items);
  const totalsSummary = calculateTotalsSummary(formData.items);
  // A4 and A5 both use the full detailed layout; only thermal rolls are compact.
  const isCompactReceipt = receiptSize !== 'a4' && receiptSize !== 'a5';
  const invoiceNo = useMemo(() => {
    if (showEditModal && selectedTransaction?.serialNo) return selectedTransaction.serialNo;
    const scoped = transactions.filter((t) => String(t.hospitalId) === String(formData.hospitalId));
    const maxSerial = scoped.reduce((max, t) => Math.max(max, t.serialNo ?? 0), 0);
    return maxSerial + 1;
  }, [formData.hospitalId, selectedTransaction?.serialNo, showEditModal, transactions]);
  const printTotalsSummary = selectedTransaction
    ? calculateTotalsSummary(selectedTransaction.details || [])
    : { totalDiscount: 0, totalTax: 0, totalBonus: 0 };
  const printNetTotal = selectedTransaction
    ? calculateTotals(selectedTransaction.details || [])
    : 0;
  const showFormulaColumns = printTemplate !== 'sale';
  const itemsCount = formData.items.length;

  useEffect(() => {
    const nextTotal = calculateTotals(formData.items);
    if (['sales', 'purchase', 'purchase_return', 'sales_return'].includes(formData.trxType) && lastEditedTotal === 'auto') {
      setFormData((prev) => ({ ...prev, paidAmount: nextTotal, dueAmount: 0 }));
      return;
    }
    if (lastEditedTotal === 'due') {
      const nextPaid = Math.max(0, nextTotal - Number(formData.dueAmount || 0));
      if (nextPaid !== Number(formData.paidAmount || 0)) {
        setFormData((prev) => ({ ...prev, paidAmount: nextPaid }));
      }
    } else {
      const nextDue = Math.max(0, nextTotal - Number(formData.paidAmount || 0));
      if (nextDue !== Number(formData.dueAmount || 0)) {
        setFormData((prev) => ({ ...prev, dueAmount: nextDue }));
      }
    }
  }, [formData.items, formData.paidAmount, formData.dueAmount, lastEditedTotal, formData.trxType]);

  useEffect(() => {
    const total = calculateTotals(formData.items);
    if (['sales', 'purchase', 'purchase_return', 'sales_return'].includes(formData.trxType)) {
      setLastEditedTotal('auto');
      setFormData((prev) => ({ ...prev, paidAmount: total, dueAmount: 0 }));
    }
  }, [formData.trxType]);

  useEffect(() => {
    if (!showAddModal && !showEditModal) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        addItemRow();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showAddModal, showEditModal]);

  const patientOptions = getPatientOptions();
  const supplierOptions = getSupplierOptions();

  const isPurchaseSideForm = formData.trxType === 'purchase' || formData.trxType === 'purchase_return';

  // Stock availability is only meaningful for the types that draw down stock.
  const showAvailableStock = ['sales', 'purchase_return'].includes(formData.trxType);

  /**
   * Optional columns for this invoice type, from Settings > Pharmacy > Invoice
   * Fields. A counter sale normally hides batch and expiry because FIFO already
   * picks the nearest-expiry lot; a purchase shows everything.
   *
   * Hiding a column is presentation only -- handleMedicineChange still resolves
   * the batch and expiry and they are still saved, so stock stays accurate.
   */
  const visibleFields = getInvoiceFields(formData.hospitalId || currentHospital.id, formData.trxType as InvoiceType);

  // The row is a 12-column grid. Five cells are always present (sale unit, qty,
  // price, amount, delete), so the medicine cell absorbs whatever the hidden
  // optional columns free up instead of leaving a gap.
  // Written out in full rather than interpolated: Tailwind scans source text for
  // class names, so a template literal would never be generated.
  /**
   * Explicit column widths, the way a desktop grid sizes itself.
   *
   * A twelve-column layout gave every field the same slice, so Bonus and Tax --
   * which hold a single digit -- were as wide as the medicine name, and with all
   * the optional columns on the product got 2/12 of the row. Each column is now
   * sized to what it actually holds and the medicine takes the rest, so nothing
   * is padded out to fill a slot it does not need.
   *
   * Emitted as a stylesheet rather than a Tailwind class because the set of
   * columns depends on the hospital's settings, and Tailwind only generates
   * classes it can find written out in the source.
   */
  const gridTemplateColumns = [
    'minmax(200px, 1fr)',                        // medicine
    '84px',                                      // sale unit
    visibleFields.batch ? '86px' : null,         // batch
    visibleFields.expiry ? '80px' : null,        // expiry
    '54px',                                      // qty
    visibleFields.bonus ? '50px' : null,         // bonus
    '76px',                                      // price
    visibleFields.discount ? '50px' : null,      // disc %
    visibleFields.tax ? '50px' : null,           // tax %
    '84px',                                      // amount
    '28px',                                      // delete
  ].filter(Boolean).join(' ');

  // Summed once in the footer instead of a badge under every Qty field.
  // Deduped by medicine+batch so the same stock is not counted twice.
  const availableStockTotal = (() => {
    const seen = new Set<string>();
    return formData.items.reduce((sum, item) => {
      if (!item.medicineId) return sum;
      const key = `${item.medicineId}::${item.batchNo || ''}`;
      if (seen.has(key)) return sum;
      seen.add(key);
      return sum + getAvailableStock(item.medicineId, item.batchNo || undefined, formData.hospitalId);
    }, 0);
  })();

  // Shown as "14 (2 Box)" when the lines share one packable medicine.
  const availableStockLabel = (() => {
    const ids = Array.from(new Set(formData.items.map((i) => i.medicineId).filter(Boolean)));
    if (ids.length === 1) return describeStock(availableStockTotal, ids[0]);
    return String(availableStockTotal);
  })();

  // Name/ID are already visible in the selector above, so this panel only adds
  // the details the selector does not show.
  const selectedPartyDetails = (() => {
    if (isPurchaseSideForm) {
      const supplier = suppliers.find((s) => String(s.id) === String(formData.supplierId));
      if (!supplier) return null;
      return [
        { label: t('ui.phone'), value: supplier.phone || '—' },
        { label: t('ui.address'), value: supplier.address || '—' },
      ];
    }
    const patient = patients.find((p) => String(p.id) === String(formData.patientId));
    if (!patient) return null;
    const gender = patient.gender
      ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)
      : '—';
    return [
      { label: t('ui.gender'), value: gender },
      { label: t('ui.age'), value: patient.age ? String(patient.age) : '—' },
      { label: t('ui.phone'), value: patient.phone || '—' },
    ];
  })();

  const invoiceTypeLabel = INVOICE_TABS.find((t) => t.id === formData.trxType)?.docTitle || 'Invoice';

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">{t('ui.invoices')}</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">Manage sales, purchase and return invoices for {isAllHospitals ? 'All Hospitals' : currentHospital.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search transactions..."
              title="Search transactions"
              aria-label="Search transactions"
              className="w-48 pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          {canExport && (
            <button onClick={exportToExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs font-medium shadow-sm" title={t('ui.exportToExcel')}>
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
          )}
          {canExport && (
            <button onClick={exportToPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs font-medium shadow-sm" title={t('ui.exportToPdf')}>
              <FileText className="w-3.5 h-3.5" />
              PDF
            </button>
          )}
          {canAdd && (
            <AddButton onClick={handleAdd} label={t('ui.add')} />
          )}
        </div>
      </div>

      <HospitalSelector userRole={userRole} selectedHospitalId={selectedHospitalId} onHospitalChange={setSelectedHospitalId} />

      {/* One tab per invoice type; the list below shows only that type. */}
      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="-mb-px flex gap-4 min-w-max" aria-label="Invoice types">
          {INVOICE_TABS.map((tab) => {
            const isActive = trxTypeFilter === tab.id;
            const count = scopedTransactions.filter((t) => t.trxType === tab.id).length;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTrxTypeFilter(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`group inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-1 py-2.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
                }`}
              >
                <tab.icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                {tab.label}
                <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  isActive
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="overflow-x-auto rounded-t-lg max-h-[calc(100vh-220px)] overflow-y-auto">
          <table className="w-full text-left border-collapse relative">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
              <tr>
                <SortableTh label="S.No" sortKey="serial" sortState={sortState} onSort={toggleSort} />
                <SortableTh label="Party" sortKey="party" sortState={sortState} onSort={toggleSort} />
                <SortableTh label={t('ui.grandTotal')} sortKey="grandTotal" sortState={sortState} onSort={toggleSort} />
                <SortableTh label={t('ui.paid')} sortKey="paid" sortState={sortState} onSort={toggleSort} />
                <SortableTh label={t('ui.due')} sortKey="due" sortState={sortState} onSort={toggleSort} />
                <SortableTh label="Inv Date" sortKey="date" sortState={sortState} onSort={toggleSort} />
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-center">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedTransactions.length > 0 ? (
                paginatedTransactions.map((trx) => (
                  <tr key={trx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">#{trx.serialNo ?? trx.id}</td>
                    <td className="px-4 py-2 text-xs">
                      <div className="flex flex-col leading-tight">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{getPartyName(trx)}</span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">{getPartyMeta(trx)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{trx.grandTotal}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{trx.paidAmount}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{trx.dueAmount}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{trx.createdAt ? new Date(trx.createdAt).toLocaleString() : '—'}</td>
                    <td className="px-4 py-2 text-xs text-center">
                      <div className="flex items-center justify-center gap-2">
                        {canPrint && (
                          <button
                            onClick={() => {
                              void handlePrintInvoice(trx);
                            }}
                            className="p-1.5 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-200"
                            title={t('ui.print')}
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => handleView(trx)} className="p-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-200" title={t('ui.view')}>
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button onClick={() => handleEdit(trx)} className="p-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-200" title={t('ui.edit')}>
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(trx)} className="p-1.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-200" title={t('ui.delete')}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    {loading ? 'Loading transactions...' : 'No transactions found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span>
            Showing <strong>{filteredTransactions.length}</strong> of <strong>{scopedTransactions.length}</strong> transactions {isAllHospitals ? '(all hospitals)' : `for ${currentHospital.name}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >{t('ui.prev')}</button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >{t('ui.next')}</button>
          </div>
        </div>
      </div>

      {/* View Modal */}
      <div className={`fixed inset-0 z-50 ${showViewModal ? 'flex' : 'hidden'} items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Transaction Details</h3>
            <div className="flex items-center gap-2">
              <select
                className="px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                title="Print size"
                value={receiptSize}
                onChange={(e) => setReceiptSize(e.target.value as PrintPaperSize)}
              >
                <option value="a4">A4 Invoice</option>
                <option value="a5">A5 Invoice</option>
                <option value="58mm">58mm Receipt</option>
                <option value="76mm">76mm Receipt</option>
                <option value="80mm">80mm Receipt</option>
              </select>
              {canPrint && (
                <button
                  onClick={() => {
                    // In the preview the user may override the size via the dropdown.
                    void handlePrintInvoice(selectedTransaction, false, receiptSize);
                  }}
                  className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
                >{t('ui.printInvoice')}</button>
              )}
              {selectedTransaction && (canEdit || canDelete) && (
                <>
                  {canEdit && (
                    <button
                      onClick={() => {
                        setShowViewModal(false);
                        handleEdit(selectedTransaction);
                      }}
                      className="px-3 py-1.5 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                    >{t('ui.edit')}</button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => {
                        setShowViewModal(false);
                        handleDelete(selectedTransaction);
                      }}
                      className="px-3 py-1.5 text-xs rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-200"
                    >{t('ui.delete')}</button>
                  )}
                </>
              )}
              <button onClick={() => setShowViewModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label={t('ui.close')}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <style>
            {`
              @media print {
                body * { visibility: hidden; }
                #transaction-print-view, #transaction-print-view * { visibility: visible; }
                #transaction-print-view {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  min-height: 100%;
                  padding: 40px;
                  background: white;
                }
                #transaction-print-view.receipt-58mm {
                  width: 58mm;
                  padding: 10px;
                }
                #transaction-print-view.receipt-76mm {
                  width: 76mm;
                  padding: 12px;
                }
                #transaction-print-view.receipt-80mm {
                  width: 80mm;
                  padding: 12px;
                }
                #transaction-print-view.receipt-58mm h1,
                #transaction-print-view.receipt-58mm h2,
                #transaction-print-view.receipt-58mm h3 {
                  font-size: 12px;
                }
                #transaction-print-view.receipt-58mm p,
                #transaction-print-view.receipt-58mm td,
                #transaction-print-view.receipt-58mm th {
                  font-size: 9px;
                }
                #transaction-print-view.receipt-76mm p,
                #transaction-print-view.receipt-76mm td,
                #transaction-print-view.receipt-76mm th,
                #transaction-print-view.receipt-80mm p,
                #transaction-print-view.receipt-80mm td,
                #transaction-print-view.receipt-80mm th {
                  font-size: 10px;
                }
                @page { margin: 0; }
                @page receipt58 { size: 58mm auto; margin: 0; }
                @page receipt76 { size: 76mm auto; margin: 0; }
                @page receipt80 { size: 80mm auto; margin: 0; }
                #transaction-print-view.receipt-58mm { page: receipt58; }
                #transaction-print-view.receipt-76mm { page: receipt76; }
                #transaction-print-view.receipt-80mm { page: receipt80; }
              }
            `}
          </style>
          <div
            id="transaction-print-view"
            className={`hidden print:block ${receiptSize === '58mm' ? 'receipt-58mm' : receiptSize === '76mm' ? 'receipt-76mm' : receiptSize === '80mm' ? 'receipt-80mm' : ''}`}
          >
            {selectedTransaction && (
              <div className="space-y-6 bg-white p-6">
                {/* Header Section */}
                <div className={`flex items-start justify-between border-b-2 border-gray-800 pb-4 ${receiptSize !== 'a4' ? 'gap-3' : ''}`}>
                  <div className="flex items-center gap-4 w-1/2">
                    {getHospital(selectedTransaction.hospitalId)?.logo && (
                      <img
                        src={getHospital(selectedTransaction.hospitalId)?.logo}
                        alt="Hospital Logo"
                        className={`${!isCompactReceipt ? 'w-24 h-24' : 'w-10 h-10'} object-contain`}
                      />
                    )}
                    <div>
                      <h1 className={`${!isCompactReceipt ? 'text-2xl' : 'text-base'} font-bold text-gray-900 uppercase tracking-wider`}>
                        {getHospitalName(selectedTransaction.hospitalId)}
                      </h1>
                      <p className={`${!isCompactReceipt ? 'text-sm' : 'text-[10px]'} text-gray-600`}>Healthcare Services & Solutions</p>
                      <p className={`${!isCompactReceipt ? 'text-sm' : 'text-[10px]'} text-gray-600`}>Code: {getHospital(selectedTransaction.hospitalId)?.code || '—'}</p>
                    </div>
                  </div>
                  <div className={`text-right w-1/2 ${!isCompactReceipt ? 'text-sm' : 'text-[10px]'}`}>
                    <h2 className="text-2xl font-bold text-gray-800 uppercase mb-2">
                       {printTemplate === 'sale' ? 'Sale Invoice' : printTemplate === 'purchase' ? 'Purchase Invoice' : 'Supplier Invoice'}
                    </h2>
                    <p className="text-gray-600">Invoice No: <span className="font-semibold text-gray-900">{selectedTransaction.serialNo ?? '—'}</span></p>
                    <p className="text-gray-600">Transaction ID: <span className="font-semibold text-gray-900">#{selectedTransaction.serialNo ?? selectedTransaction.id}</span></p>
                    <p className="text-gray-600">Printed on: <span className="font-semibold text-gray-900">{new Date().toLocaleDateString()}</span></p>
                  </div>
                </div>

                {/* Billing Details Block */}
                {!isCompactReceipt && (
                  <div className="grid grid-cols-2 gap-8 mb-6">
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 border-b border-gray-200 pb-2">Billed To</h3>
                      {printTemplate === 'sale' ? (
                         <div>
                            <p className="font-bold text-gray-900 text-lg">{getPatientDisplay(selectedTransaction.patientId) || 'Walk-in Customer'}</p>
                            <p className="text-sm text-gray-600 mt-1">Patient Customer</p>
                         </div>
                      ) : (
                         <div>
                            <p className="font-bold text-gray-900 text-lg">{getSupplierDisplay(selectedTransaction.supplierId) || '—'}</p>
                            <p className="text-sm text-gray-600 mt-1">{t('ui.supplier')}</p>
                         </div>
                      )}
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 border-b border-gray-200 pb-2">Transaction Details</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-gray-600">Type:</div>
                        <div className="font-medium text-gray-900 capitalize">{selectedTransaction.trxType.replace('_', ' ')}</div>
                        
                        <div className="text-gray-600">Date:</div>
                        <div className="font-medium text-gray-900">
                          {selectedTransaction.createdAt ? new Date(selectedTransaction.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Compact Details handling */}
                {isCompactReceipt && (
                  <div className="grid grid-cols-2 gap-2 text-[10px] border border-gray-300 rounded-md p-2">
                    <div>
                      <p className="text-gray-500">{t('ui.type')}</p>
                      <p className="font-semibold text-gray-900 capitalize">{selectedTransaction.trxType.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{t('ui.invoice')}</p>
                      <p className="font-semibold text-gray-900">{selectedTransaction.serialNo ?? '—'}</p>
                    </div>
                    {printTemplate === 'sale' ? (
                      <div className="col-span-2">
                        <p className="text-gray-500">{t('ui.customer')}</p>
                        <p className="font-semibold text-gray-900 break-words">{getPatientDisplay(selectedTransaction.patientId) || 'Walk-in'}</p>
                      </div>
                    ) : (
                      <div className="col-span-2">
                        <p className="text-gray-500">{t('ui.supplier')}</p>
                        <p className="font-semibold text-gray-900 break-words">{getSupplierDisplay(selectedTransaction.supplierId) || '—'}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Main Items Table */}
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <table className={`w-full text-left text-xs ${isCompactReceipt ? 'table-fixed' : ''}`}>
                    <thead className="bg-gray-800 text-white">
                      {isCompactReceipt ? (
                        <tr>
                          <th className="px-1 py-1 w-4 text-center">#</th>
                          <th className="px-1 py-1">{t('table.item')}</th>
                          <th className="px-1 py-1 w-6 text-center">{t('table.qty')}</th>
                          <th className="px-1 py-1 w-8 text-right">{t('table.amount')}</th>
                        </tr>
                      ) : (
                        <tr>
                          <th className="px-3 py-2 font-medium">{t('table.sn')}</th>
                          <th className="px-3 py-2 font-medium">{t('table.itemDescription')}</th>
                          <th className="px-3 py-2 font-medium text-center">{t('table.batch')}</th>
                          <th className="px-3 py-2 font-medium text-center">{t('table.expiry')}</th>
                          <th className="px-3 py-2 font-medium text-center">{t('table.qty')}</th>
                          <th className="px-3 py-2 font-medium text-center">{t('table.bonus')}</th>
                          <th className="px-3 py-2 font-medium text-right">{t('table.price')}</th>
                          {showFormulaColumns && <th className="px-3 py-2 font-medium text-right">Disc %</th>}
                          {showFormulaColumns && <th className="px-3 py-2 font-medium text-right">Tax %</th>}
                          <th className="px-3 py-2 font-medium text-right">{t('table.netPrice')}</th>
                          <th className="px-3 py-2 font-medium text-right">{t('table.amount')}</th>
                        </tr>
                      )}
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {(selectedTransaction.details || []).map((d, idx) => {
                        const amount = Number(d.amount ?? calculateLineAmount(d));
                        const netPrice = d.qtty ? (amount / d.qtty) : 0;
                        return (
                          <tr key={`${d.medicineId}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            {isCompactReceipt ? (
                              <>
                                <td className="px-1 py-1 align-top text-center w-4">{idx + 1}</td>
                                <td className="px-1 py-1 break-words align-top font-medium text-gray-900">
                                   {d.medicineId ? getMedicineDisplay(d.medicineId) : (d.medicineName || 'Unknown')}
                                </td>
                                <td className="px-1 py-1 align-top text-center w-6">{d.qtty}</td>
                                <td className="px-1 py-1 align-top text-right w-8 font-medium text-gray-900">{amount.toFixed(2)}</td>
                              </>
                            ) : (
                              <>
                                <td className="px-3 py-2 text-center text-gray-500">{idx + 1}</td>
                                <td className="px-3 py-2 font-medium text-gray-900">
                                  {d.medicineId ? getMedicineDisplay(d.medicineId) : (d.medicineName || 'Unknown')}
                                </td>
                                <td className="px-3 py-2 text-center text-gray-600">{d.batchNo || '—'}</td>
                                <td className="px-3 py-2 text-center text-gray-600">
                                  {d.expiryDate ? getExpiryDisplay(d.expiryDate, selectedTransaction.hospitalId) : '—'}
                                </td>
                                <td className="px-3 py-2 text-center font-medium">{d.qtty}</td>
                                <td className="px-3 py-2 text-center text-gray-600">{d.bonus ?? 0}</td>
                                <td className="px-3 py-2 text-right text-gray-600">{Number(d.price).toFixed(2)}</td>
                                {showFormulaColumns && <td className="px-3 py-2 text-right text-gray-600">{d.discount ?? 0}%</td>}
                                {showFormulaColumns && <td className="px-3 py-2 text-right text-gray-600">{d.tax ?? 0}%</td>}
                                <td className="px-3 py-2 text-right text-gray-600">{netPrice.toFixed(2)}</td>
                                <td className="px-3 py-2 text-right font-medium text-gray-900">{amount.toFixed(2)}</td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Summary Section */}
                {!isCompactReceipt && (
                  <div className="flex justify-end mt-4">
                    <div className="w-80 bg-gray-50 rounded-lg border border-gray-200 p-4">
                      <div className="space-y-2 text-sm">
                        {showFormulaColumns && (
                          <div className="flex justify-between items-center text-gray-600">
                            <span>Total Discount:</span>
                            <span className="font-medium">{printTotalsSummary.totalDiscount.toFixed(2)}</span>
                          </div>
                        )}
                        {showFormulaColumns && (
                          <div className="flex justify-between items-center text-gray-600 border-b border-gray-200 pb-2">
                            <span>Total Tax:</span>
                            <span className="font-medium">{printTotalsSummary.totalTax.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-base font-bold text-gray-900 pt-2">
                          <span>Grand Total:</span>
                          <span>{printNetTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-gray-600 pt-2 border-t border-gray-200 mt-2">
                          <span>Amount Paid:</span>
                          <span className="font-medium">{Number(selectedTransaction.paidAmount).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-red-600 font-bold">
                          <span>Balance Due:</span>
                          <span>{Number(selectedTransaction.dueAmount).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isCompactReceipt && (
                  <div className="border-t border-gray-300 pt-2 text-[10px] space-y-1">
                    {showFormulaColumns && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">{t('ui.discount')}</span>
                        <span className="font-semibold text-gray-900">{printTotalsSummary.totalDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    {showFormulaColumns && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Tax</span>
                        <span className="font-semibold text-gray-900">{printTotalsSummary.totalTax.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pb-1 border-b border-gray-200">
                      <span className="text-gray-600">Net Total</span>
                      <span className="font-bold text-gray-900">{printNetTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-gray-600">{t('ui.paid')}</span>
                      <span className="font-semibold text-gray-900">{Number(selectedTransaction.paidAmount).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-gray-600 text-red-600">{t('ui.due')}</span>
                      <span className="text-red-600">{Number(selectedTransaction.dueAmount).toFixed(2)}</span>
                    </div>
                  </div>
                )}
                
                {/* Signatures */}
                {!isCompactReceipt && (
                  <div className="flex justify-between mt-16 pt-8 border-t border-gray-200">
                     <div className="text-center">
                        <div className="border-t border-gray-800 w-48 mb-2"></div>
                        <p className="text-sm text-gray-600 font-medium">Customer / Receiver Signature</p>
                     </div>
                     <div className="text-center">
                        <div className="border-t border-gray-800 w-48 mb-2"></div>
                        <p className="text-sm text-gray-600 font-medium">Authorized Signature</p>
                     </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {selectedTransaction && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">{t('ui.hospital')}</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{getHospitalName(selectedTransaction.hospitalId)}</p>
                  </div>
                  {selectedTransaction.trxType === 'sales' || selectedTransaction.trxType === 'sales_return' ? (
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">{t('ui.customer')}</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{getPatientDisplay(selectedTransaction.patientId) || '—'}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">{t('ui.supplier')}</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{getSupplierDisplay(selectedTransaction.supplierId) || '—'}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">{t('ui.type')}</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{selectedTransaction.trxType}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">{t('ui.date')}</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{selectedTransaction.createdAt ? new Date(selectedTransaction.createdAt).toLocaleString() : '—'}</p>
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
                      <tr>
                        <th className="px-3 py-2">{t('table.medicine')}</th>
                        {activePrintColumns.showBatchColumn && <th className="px-3 py-2">{t('table.batch')}</th>}
                        {activePrintColumns.showExpiryDateColumn && <th className="px-3 py-2">{t('table.expiry')}</th>}
                        <th className="px-3 py-2">{t('table.qty')}</th>
                        {activePrintColumns.showBonusColumn && <th className="px-3 py-2">{t('table.bonus')}</th>}
                        <th className="px-3 py-2">{t('table.price')}</th>
                        {showFormulaColumns && <th className="px-3 py-2">{t('table.discount')}</th>}
                        {showFormulaColumns && <th className="px-3 py-2">{t('table.tax')}</th>}
                        <th className="px-3 py-2">{t('table.amount')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {(selectedTransaction.details || []).map((d, idx) => (
                        <tr key={`${d.medicineId}-${idx}`}>
                          <td className="px-3 py-2">{d.medicineId ? getMedicineDisplay(d.medicineId) : (d.medicineName || 'Unknown')}</td>
                          {activePrintColumns.showBatchColumn && <td className="px-3 py-2">{d.batchNo || '—'}</td>}
                          {activePrintColumns.showExpiryDateColumn && (
                            <td className="px-3 py-2">{d.expiryDate ? getExpiryDisplay(d.expiryDate, selectedTransaction.hospitalId) : '—'}</td>
                          )}
                          <td className="px-3 py-2">{d.qtty}</td>
                          {activePrintColumns.showBonusColumn && <td className="px-3 py-2">{d.bonus ?? 0}</td>}
                          <td className="px-3 py-2">{d.price}</td>
                          {showFormulaColumns && <td className="px-3 py-2">{d.discount ?? 0}%</td>}
                          {showFormulaColumns && <td className="px-3 py-2">{d.tax ?? 0}%</td>}
                          <td className="px-3 py-2">{Number(d.amount ?? calculateLineAmount(d)).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap justify-end gap-4 text-xs pt-2">
                  {showFormulaColumns && (
                    <div className="text-gray-600 dark:text-gray-300">Discount: <span className="font-semibold text-gray-900 dark:text-white">{printTotalsSummary.totalDiscount.toFixed(2)}</span></div>
                  )}
                  {showFormulaColumns && (
                    <div className="text-gray-600 dark:text-gray-300">Tax: <span className="font-semibold text-gray-900 dark:text-white">{printTotalsSummary.totalTax.toFixed(2)}</span></div>
                  )}
                  <div className="text-gray-600 dark:text-gray-300">Net: <span className="font-semibold text-gray-900 dark:text-white">{printNetTotal.toFixed(2)}</span></div>
                  <div className="text-gray-600 dark:text-gray-300">Paid: <span className="font-semibold text-gray-900 dark:text-white">{selectedTransaction.paidAmount}</span></div>
                  <div className="text-gray-600 dark:text-gray-300">Due: <span className="font-semibold text-gray-900 dark:text-white">{selectedTransaction.dueAmount}</span></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          {/* Fixed height, not content height: the modal used to grow and shrink
              as rows were added, moving the Save button under the cursor. */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-5xl h-[88vh] flex flex-col border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 rounded-t-lg">
              <div className="flex items-center gap-3">
                <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 tracking-tight">
                  {showAddModal ? `New ${invoiceTypeLabel}` : `Edit ${invoiceTypeLabel}`}
                </h3>
                  {userRole === 'super_admin' && (
                    <select
                      className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs"
                      title={t('ui.hospital')}
                      value={formData.hospitalId}
                      onChange={(e) => setFormData({ ...formData, hospitalId: e.target.value })}
                      required
                    >
                      <option value="">Select hospital</option>
                      {hospitals.map((h) => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  )}
              </div>
              <button
                onClick={closeTransactionModal}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label={t('ui.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              ref={transactionFormRef}
              className="p-4 space-y-4 flex-1 min-h-0 overflow-visible flex flex-col"
              onSubmit={showAddModal ? handleSubmitAdd : handleSubmitEdit}
              /**
               * A form with a submit button files itself when Enter is pressed in
               * any input. In a grid that means the invoice is saved partway
               * through typing a line -- the single thing the counter complained
               * about. Enter is handled by the grid instead (move down / add a
               * row); saving is only ever the Save button or Ctrl+S.
               */
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                const target = e.target as HTMLElement;
                if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return;
                e.preventDefault();
              }}
            >
              <style>{`
                @media (min-width: 1024px) {
                  .trx-grid { display: grid; grid-template-columns: ${gridTemplateColumns}; }
                }
                /* Cells sit flush; the grid's own gap draws the rules between
                   them, so the inputs do not each carry a rounded outline. */
                .grid-cell:focus { outline: 2px solid rgb(37 99 235); outline-offset: -2px; z-index: 1; position: relative; }
                /* Active line: tint plus a solid bar down the left edge, so the
                   row the cursor is on is findable without hunting for a faint
                   background on a seventy-line invoice. */
                .trx-row { position: relative; }
                .trx-row:focus-within { background: rgb(219 234 254); }
                .trx-row:focus-within::before {
                  content: ''; position: absolute; left: 0; top: 0; bottom: 0;
                  width: 3px; background: rgb(37 99 235);
                }
                .trx-kbd { display:inline-block; min-width:1.1rem; padding:0 3px; border:1px solid rgb(203 213 225);
                           border-bottom-width:2px; border-radius:3px; background:#fff; color:rgb(71 85 105);
                           font:inherit; font-size:9px; line-height:14px; text-align:center; }
              `}</style>
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm">
                <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                {(formData.trxType === 'sales' || formData.trxType === 'sales_return') && showCustomerToggle && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-gray-700 dark:text-gray-200">{t('ui.customerType')}</label>
                    <div className="flex items-center gap-1">
                      {([[false, t('ui.registeredPatient')], [true, t('ui.walkInCustomer')]] as const).map(([val, label]) => (
                        <button
                          key={String(val)}
                          type="button"
                          onClick={() => setFormData((prev) => ({
                            ...prev,
                            isWalkIn: val as boolean,
                            // Clear the other party so a sale never carries both.
                            patientId: val ? '' : prev.patientId,
                            walkInName: val ? prev.walkInName : '',
                            walkInPhone: val ? prev.walkInPhone : '',
                            walkInAddress: val ? prev.walkInAddress : '',
                          }))}
                          className={`px-2.5 py-1.5 rounded-md border text-[10px] font-medium transition-colors h-8 ${
                            formData.isWalkIn === val
                              ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-200'
                              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-gray-800/60 dark:border-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(formData.trxType === 'sales' || formData.trxType === 'sales_return') && formData.isWalkIn && (
                  <>
                    <div className="space-y-1 min-w-[150px] max-w-[190px]">
                      <label className="text-[10px] font-medium text-gray-700 dark:text-gray-200">
                        {t('ui.customerName')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.walkInName}
                        onChange={(e) => setFormData({ ...formData, walkInName: e.target.value })}
                        placeholder={t('ui.customerName')}
                        title={t('ui.customerName')}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] h-8"
                      />
                    </div>
                    <div className="space-y-1 min-w-[130px] max-w-[160px]">
                      <label className="text-[10px] font-medium text-gray-700 dark:text-gray-200">{t('ui.phone')}</label>
                      <input
                        type="text"
                        value={formData.walkInPhone}
                        onChange={(e) => setFormData({ ...formData, walkInPhone: e.target.value })}
                        placeholder={t('ui.phone')}
                        title={t('ui.phone')}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] h-8"
                      />
                    </div>
                    <div className="space-y-1 min-w-[130px] max-w-[190px]">
                      <label className="text-[10px] font-medium text-gray-700 dark:text-gray-200">{t('ui.address')}</label>
                      <input
                        type="text"
                        value={formData.walkInAddress}
                        onChange={(e) => setFormData({ ...formData, walkInAddress: e.target.value })}
                        placeholder={t('ui.address')}
                        title={t('ui.address')}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] h-8"
                      />
                    </div>
                  </>
                )}

                {(formData.trxType === 'sales' || formData.trxType === 'sales_return') && !formData.isWalkIn && (
                  <div className="space-y-1 min-w-[180px] max-w-[220px]">
                    <label className="text-[10px] font-medium text-gray-700 dark:text-gray-200">Find Patient</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={patientSearch}
                          title="Find patient"
                        onChange={(e) => {
                          setPatientSearch(e.target.value);
                          setOpenPatientDropdown(true);
                          setHighlightedPatientIndex(0);
                        }}
                        onFocus={() => {
                          setOpenPatientDropdown(true);
                          setHighlightedPatientIndex(0);
                        }}
                        onBlur={() => setTimeout(() => {
                          setOpenPatientDropdown(false);
                          setHighlightedPatientIndex(-1);
                        }, 200)}
                        onKeyDown={(e) => {
                          const options = patientOptions;
                          if (!options.length) return;

                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setOpenPatientDropdown(true);
                            setHighlightedPatientIndex((prev) => {
                              const next = prev < 0 ? 0 : Math.min(prev + 1, options.length - 1);
                              return next;
                            });
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setOpenPatientDropdown(true);
                            setHighlightedPatientIndex((prev) => Math.max(prev - 1, 0));
                          } else if (e.key === 'Enter' && openPatientDropdown) {
                            e.preventDefault();
                            const selected = options[highlightedPatientIndex] || options[0];
                            if (selected) {
                              setFormData({ ...formData, patientId: selected.id });
                              setPatientSearch(getPatientOptionDisplay(selected));
                              setOpenPatientDropdown(false);
                              setHighlightedPatientIndex(-1);
                            }
                          } else if (e.key === 'Escape') {
                            setOpenPatientDropdown(false);
                            setHighlightedPatientIndex(-1);
                          }
                        }}
                        placeholder="Search patient..."
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] h-8"
                      />
                      {openPatientDropdown && (
                        <div className="absolute z-20 mt-1 w-[250px] max-h-48 overflow-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                          {patientOptions
                            .map((p, optionIndex) => (
                              <button
                                key={p.id}
                                type="button"
                                className={`w-full text-left px-2 py-1.5 text-xs ${highlightedPatientIndex === optionIndex ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                onMouseEnter={() => setHighlightedPatientIndex(optionIndex)}
                                onMouseDown={() => {
                                  setFormData({ ...formData, patientId: p.id });
                                  setPatientSearch(getPatientOptionDisplay(p));
                                  setOpenPatientDropdown(false);
                                  setHighlightedPatientIndex(-1);
                                }}
                              >
                                <div className="font-medium text-gray-900 dark:text-gray-100">{p.name} {p.patientId ? `(${p.patientId})` : ''}</div>
                                {p.phone && <div className="text-[10px] text-gray-500 dark:text-gray-400">{p.phone}</div>}
                              </button>
                            ))}
                          {patientOptions.length === 0 && (
                            <div className="px-2 py-2 text-xs text-gray-500">No patients found</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(formData.trxType === 'purchase' || formData.trxType === 'purchase_return') && (
                  <div className="space-y-1 min-w-[180px] max-w-[220px]">
                    <label className="text-[10px] font-medium text-gray-700 dark:text-gray-200">Find Supplier</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={supplierSearch}
                          title="Find supplier"
                        onChange={(e) => {
                          setSupplierSearch(e.target.value);
                          setOpenSupplierDropdown(true);
                          setHighlightedSupplierIndex(0);
                        }}
                        onFocus={() => {
                          setOpenSupplierDropdown(true);
                          setHighlightedSupplierIndex(0);
                        }}
                        onBlur={() => setTimeout(() => {
                          setOpenSupplierDropdown(false);
                          setHighlightedSupplierIndex(-1);
                        }, 200)}
                        onKeyDown={(e) => {
                          const options = supplierOptions;
                          if (!options.length) return;

                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setOpenSupplierDropdown(true);
                            setHighlightedSupplierIndex((prev) => {
                              const next = prev < 0 ? 0 : Math.min(prev + 1, options.length - 1);
                              return next;
                            });
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setOpenSupplierDropdown(true);
                            setHighlightedSupplierIndex((prev) => Math.max(prev - 1, 0));
                          } else if (e.key === 'Enter' && openSupplierDropdown) {
                            e.preventDefault();
                            const selected = options[highlightedSupplierIndex] || options[0];
                            if (selected) {
                              setFormData({ ...formData, supplierId: selected.id });
                              setSupplierSearch(selected.name);
                              setOpenSupplierDropdown(false);
                              setHighlightedSupplierIndex(-1);
                            }
                          } else if (e.key === 'Escape') {
                            setOpenSupplierDropdown(false);
                            setHighlightedSupplierIndex(-1);
                          }
                        }}
                        placeholder="Search supplier..."
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] h-8"
                      />
                      {openSupplierDropdown && (
                        <div className="absolute z-20 mt-1 w-[250px] max-h-48 overflow-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                          {supplierOptions
                            .map((s, optionIndex) => (
                              <button
                                key={s.id}
                                type="button"
                                className={`w-full text-left px-2 py-1.5 text-xs ${highlightedSupplierIndex === optionIndex ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                onMouseEnter={() => setHighlightedSupplierIndex(optionIndex)}
                                onMouseDown={() => {
                                  setFormData({ ...formData, supplierId: s.id });
                                  setSupplierSearch(s.name);
                                  setOpenSupplierDropdown(false);
                                  setHighlightedSupplierIndex(-1);
                                }}
                              >
                                {s.name}
                              </button>
                            ))}
                          {supplierOptions.length === 0 && (
                            <div className="px-2 py-2 text-xs text-gray-500">No suppliers found</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* The invoice type comes from the tab, so this space shows who the
                    invoice is for instead of a redundant type picker. Hidden for
                    walk-in sales, where the customer fields already capture it. */}
                {!formData.isWalkIn && (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                    {isPurchaseSideForm ? 'Supplier Details' : t('ui.patientDetails')}
                  </label>
                  {selectedPartyDetails ? (
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-1.5 leading-tight">
                      {selectedPartyDetails.map((detail) => (
                        <span key={detail.label} className="text-[10px]">
                          <span className="text-gray-500 dark:text-gray-400">{detail.label}: </span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{detail.value}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="px-1 py-2 text-[10px] italic text-gray-400 dark:text-gray-500">
                      {isPurchaseSideForm
                        ? 'Select a supplier to view contact details'
                        : 'Select a patient to view contact details'}
                    </p>
                  )}
                </div>
                )}

                {userRole === 'super_admin' && (
                  <div className="hidden">
                    {/* Hospital selector moved to header */}
                  </div>
                )}
                <div className="space-y-1 w-[90px] ml-auto">
                  <label className="text-[10px] font-medium text-gray-700 dark:text-gray-200">Invoice No</label>
                  <input
                    type="text"
                    readOnly
                    title="Invoice number"
                    className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-[11px] h-8 text-gray-700 dark:text-gray-200"
                    value={invoiceNo}
                  />
                </div>

                <div className="space-y-1 w-[120px]">
                  <label className="text-[10px] font-medium text-gray-700 dark:text-gray-200">Invoice Date</label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] h-8"
                    title="Transaction date"
                    value={formData.transactionDate ? new Date(formData.transactionDate).toISOString().slice(0, 10) : ''}
                    onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value ? new Date(e.target.value) : new Date() })}
                  />
                </div>
              </div>
              </div>

              {/* USB scanners type here and submit with Enter. Available on every
                  invoice type -- purchases are received by scanning too. */}
              {barcodeScanningEnabled && (
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="relative flex-1 max-w-xs">
                    <Barcode className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      ref={scanInputRef}
                      // Focused on open so a scan is captured immediately.
                      autoFocus
                      value={scanValue}
                      // readOnly rather than disabled: a disabled input is blurred
                      // by the browser, which would drop focus on every scan.
                      readOnly={scanning}
                      onChange={(e) => setScanValue(e.target.value)}
                      onFocus={(e) => e.currentTarget.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleScan(scanValue);
                        }
                      }}
                      placeholder={t('ui.scanBarcode')}
                      aria-label={t('ui.scanBarcode')}
                      className="w-full pl-8 pr-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">{t('ui.barcodeScanHint')}</span>

                  {/* Find a line already on this invoice.
                      A received purchase can run to seventy lines; hunting for
                      one by scrolling or arrowing is the slow part of correcting
                      it. Typing filters the rows in place -- each keeps its real
                      position, so editing a filtered row edits the right line. */}
                  <div className="relative ml-auto w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={itemFilter}
                      onChange={(e) => setItemFilter(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setItemFilter(''); } }}
                      placeholder="Find item: id, brand or generic..."
                      aria-label="Find an item on this invoice"
                      className="w-full pl-8 pr-7 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {itemFilter && (
                      <button
                        type="button"
                        onClick={() => setItemFilter('')}
                        title="Clear"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <X className="w-3 h-3 text-gray-400" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Column titles shown once instead of repeating a label on every item row. */}
              <div className="trx-grid hidden lg:grid gap-px px-0 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300 border-b border-gray-300 dark:border-gray-600">
                <div className="px-1.5">Medicine</div>
                {/* Sale Unit sits directly after the product: it changes the price,
                    so it belongs with the thing it prices. */}
                <div className="px-1.5">{t('ui.saleUnit')}</div>
                {visibleFields.batch && <div className="px-1.5">Batch</div>}
                {visibleFields.expiry && <div className="px-1.5">Expiry</div>}
                <div className="px-1.5">Qty</div>
                {visibleFields.bonus && <div className="px-1.5">Bonus</div>}
                <div className="px-1.5">Price</div>
                {visibleFields.discount && <div className="px-1.5">Disc %</div>}
                {visibleFields.tax && <div className="px-1.5">Tax %</div>}
                <div className="px-1.5">Amount</div>
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={addItemRow}
                    title="Add item (Ctrl+Enter)"
                    aria-label="Add item"
                    className="p-1 rounded-full bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div
                ref={itemListRef}
                /*
                  Fixed to five rows, always scrolling. It used to switch to
                  overflow-visible whenever a medicine dropdown opened, which is
                  what let the list escape the panel and hang over the totals;
                  the dropdown now scrolls with the rows it belongs to.

                  40px per row plus the row gap -- enough that the sixth row is
                  half visible, which is what tells the user there is more.
                */
                className="space-y-1 pr-1 flex-1 min-h-[210px] overflow-y-auto overscroll-contain"
              >
                {formData.items.map((item, index) => {
                  const medicineOptions = getMedicineOptions(index);
                  // Filtered out, not removed: `index` stays the row's real
                  // position, so every handler still edits the correct line.
                  if (!itemMatchesFilter(item)) return null;

                  return (
                  <div
                    key={index}
                    data-grid-row={index}
                    onKeyDown={(e) => handleRowKeyDown(e, index)}
                    /* Sheet density: cells butt against each other with a single
                       shared rule, the way a desktop grid looks, instead of
                       floating in their own rounded boxes with gaps between. */
                    className="trx-row trx-grid grid grid-cols-1 gap-px items-stretch border-b border-gray-200 dark:border-gray-700 hover:bg-blue-50/40 dark:hover:bg-blue-900/10"
                  >
                    <div>
                      <label className="sr-only">Medicine</label>
                      <div className="relative">
                        <input
                          type="text"
                          data-medicine-input=""
                          className="grid-cell w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-0.5 text-[11px] h-7"
                          title="Medicine"
                          placeholder="Type medicine name..."
                          value={medicineQueries[index] ?? (item.medicineId ? getMedicineDisplay(item.medicineId) : '')}
                          onFocus={() => {
                            setOpenMedicineDropdownIndex(index);
                            setHighlightedMedicineIndex((prev) => ({ ...prev, [index]: 0 }));
                            revealDropdown(index);
                          }}
                          onBlur={() => setTimeout(() => {
                            setOpenMedicineDropdownIndex((prev) => (prev === index ? null : prev));
                            setHighlightedMedicineIndex((prev) => ({ ...prev, [index]: -1 }));
                          }, 200)}
                          onChange={(e) => {
                            const value = e.target.value;
                            setMedicineQueries((prev) => ({ ...prev, [index]: value }));
                            setMedicineSearch(value);
                            setOpenMedicineDropdownIndex(index);
                            setHighlightedMedicineIndex((prev) => ({ ...prev, [index]: 0 }));
                          }}
                          onKeyDown={(e) => {
                            if (!medicineOptions.length) return;

                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setOpenMedicineDropdownIndex(index);
                              setHighlightedMedicineIndex((prev) => {
                                const current = prev[index] ?? -1;
                                const next = current < 0 ? 0 : Math.min(current + 1, medicineOptions.length - 1);
                                return { ...prev, [index]: next };
                              });
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setOpenMedicineDropdownIndex(index);
                              setHighlightedMedicineIndex((prev) => {
                                const current = prev[index] ?? 0;
                                return { ...prev, [index]: Math.max(current - 1, 0) };
                              });
                            } else if (e.key === 'Enter' && openMedicineDropdownIndex === index) {
                              e.preventDefault();
                              const selected = medicineOptions[highlightedMedicineIndex[index] ?? 0] || medicineOptions[0];
                              if (!selected) return;
                              const display = `${selected.brandName} ${selected.genericName ? `(${selected.genericName})` : ''} ${selected.strength || ''} ${selected.type || ''}`.replace(/\s+/g, ' ').trim();
                              handleMedicineChange(index, selected.id);
                              setMedicineQueries((prev) => ({ ...prev, [index]: display }));
                              setOpenMedicineDropdownIndex(null);
                              setHighlightedMedicineIndex((prev) => ({ ...prev, [index]: -1 }));
                            } else if (e.key === 'Escape') {
                              setOpenMedicineDropdownIndex(null);
                              setHighlightedMedicineIndex((prev) => ({ ...prev, [index]: -1 }));
                            }
                          }}
                          required
                        />
                        {openMedicineDropdownIndex === index && dropdownRect && createPortal(
                          <div
                            style={{
                              position: 'fixed',
                              left: dropdownRect.left,
                              top: dropdownRect.top,
                              width: dropdownRect.width,
                              maxHeight: dropdownRect.maxHeight,
                            }}
                            // Rendered on document.body so the scrolling item
                            // panel cannot crop it. onMouseDown keeps focus in
                            // the input, otherwise the blur handler closes the
                            // list before the click lands on an option.
                            onMouseDown={(e) => e.preventDefault()}
                            className="z-[60] overflow-auto rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-xl">
                            {medicineOptions
                              .map((m, optionIndex) => {
                                const display = `${m.brandName} ${m.genericName ? `(${m.genericName})` : ''} ${m.strength || ''} ${m.type || ''}`.replace(/\s+/g, ' ').trim();
                                const available = ['sales', 'purchase_return'].includes(formData.trxType)
                                  ? getAvailableStock(m.id, undefined, formData.hospitalId)
                                  : null;
                                // Nothing sellable, yet cartons on the shelf: every batch has lapsed.
                                const expiredOnly = available === 0
                                  && getAvailableStock(m.id, undefined, formData.hospitalId, { includeExpired: true }) > 0;
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    className={`w-full text-left px-2 py-1.5 text-xs ${highlightedMedicineIndex[index] === optionIndex ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                    onMouseEnter={() => setHighlightedMedicineIndex((prev) => ({ ...prev, [index]: optionIndex }))}
                                    onMouseDown={() => {
                                      handleMedicineChange(index, m.id);
                                      setMedicineQueries((prev) => ({ ...prev, [index]: display }));
                                      setOpenMedicineDropdownIndex(null);
                                      setHighlightedMedicineIndex((prev) => ({ ...prev, [index]: -1 }));
                                    }}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span>{display}</span>
                                      {available !== null && (
                                        <span className="flex items-center gap-1 shrink-0">
                                          {expiredOnly && (
                                            <span className="rounded bg-amber-100 px-1 py-px text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                              Expired
                                            </span>
                                          )}
                                          <span className={`text-[10px] font-semibold ${available > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                            {available}
                                          </span>
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            {medicineOptions.length === 0 && (
                              <div className="px-2 py-2 text-xs text-gray-500">No medicines found</div>
                            )}
                          </div>,
                          document.body
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="sr-only">{t('ui.saleUnit')}</label>
                      <select
                        className="grid-cell w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-[11px] h-7 disabled:opacity-60"
                        title={t('ui.saleUnit')}
                        // Only meaningful when more than one unit is on offer. A
                        // line carrying a retired unit always has at least two,
                        // so it can never be locked out of being corrected.
                        disabled={unitOptionsFor(item.medicineId, item.saleUnit ?? 'piece').length <= 1}
                        value={item.saleUnit ?? 'piece'}
                        onChange={(e) => {
                          // Strip is a real tier, not a synonym for piece -- coercing
                          // it here would silently price a strip as a single tablet.
                          const raw = e.target.value;
                          const saleUnit: SaleUnit = raw === 'pack' || raw === 'strip' ? raw : 'piece';
                          // Switching unit re-prices the line so piece and pack always reconcile.
                          handleItemChange(index, {
                            saleUnit,
                            price: item.medicineId
                              ? getMedicinePrice(item.medicineId, formData.trxType, saleUnit)
                              : item.price,
                          });
                        }}
                      >
                        {unitOptionsFor(item.medicineId, item.saleUnit ?? 'piece').map((u) => (
                          <option key={u} value={u}>
                            {unitLabelFor(item.medicineId, u)}
                            {sellableUnitsFor(item.medicineId).includes(u) ? '' : ' (as saved)'}
                          </option>
                        ))}
                      </select>
                    </div>
                    {visibleFields.batch && (
                    <div>
                      <label className="sr-only">Batch No</label>
                      <input
                        className="grid-cell w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-0.5 text-[11px] h-7"
                        title="Batch Number"
                        value={item.batchNo || ''}
                        onChange={(e) => {
                          const batchNo = e.target.value;
                          let expiryDate = item.expiryDate;
                          if (formData.trxType === 'sales' || formData.trxType === 'sales_return') {
                            if (batchNo && item.medicineId) {
                              expiryDate = getExpiryFromStock(item.medicineId, batchNo) || expiryDate;
                            }
                            if (!batchNo && item.medicineId) {
                              expiryDate = getNearestExpiryForMedicine(item.medicineId) || expiryDate;
                            }
                          }
                          handleItemChange(index, { batchNo, expiryDate });
                        }}
                        required={false}
                      />
                    </div>
                    )}
                    {visibleFields.expiry && (
                    <div>
                      <label className="sr-only">{t('ui.expiry')}</label>
                      {/*
                        Typed MM/YYYY rather than a native month picker.

                        A drug's labelled expiry IS a month, but the browser's
                        month input renders it as "January 2026" and shows a
                        "--------- ----" placeholder, neither of which is what a
                        pharmacist reads off the carton. A plain text field takes
                        the four keystrokes printed on the box and shows them
                        back unchanged.

                        Stored as the last day of that month, and only rewritten
                        when the user actually edits the field, so an untouched
                        row keeps its original date.
                      */}
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={7}
                        placeholder="MM/YYYY"
                        className="grid-cell w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-0.5 text-[11px] h-7 tabular-nums text-center"
                        title={t('ui.expiryDate')}
                        value={expiryDrafts[index] ?? (item.expiryDate ? toMonthInput(item.expiryDate) : '')}
                        onChange={(e) => {
                          const draft = maskMonthYear(e.target.value);
                          setExpiryDrafts((prev) => ({ ...prev, [index]: draft }));
                          const parsed = parseMonthInput(draft);
                          // Only commit once MM/YYYY is complete, so a half-typed
                          // value never clears a date that was already stored.
                          if (parsed) handleItemChange(index, { expiryDate: parsed });
                          else if (draft === '') handleItemChange(index, { expiryDate: undefined });
                        }}
                        onBlur={() => setExpiryDrafts((prev) => {
                          const next = { ...prev };
                          delete next[index];
                          return next;
                        })}
                      />
                    </div>
                    )}
                    <div>
                      <label className="sr-only">{t('ui.qty')}</label>
                      <input
                        type="number"
                        min={1}
                        className="grid-cell w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-0.5 text-[11px] h-7 text-right"
                        title="Quantity"
                        value={item.qtty}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => handleItemChange(index, { qtty: Number(e.target.value) })}
                      />
                    </div>
                    {visibleFields.bonus && (
                    <div>
                      <label className="sr-only">Bonus</label>
                      <input
                        type="number"
                        min={0}
                        className="grid-cell w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-0.5 text-[11px] h-7 text-right"
                        title="Bonus"
                        value={item.bonus ?? 0}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => handleItemChange(index, { bonus: Number(e.target.value) })}
                      />
                    </div>
                    )}
                    <div>
                      <label className="sr-only">{t('ui.price')}</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className="grid-cell w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-0.5 text-[11px] h-7 text-right"
                        title={t('ui.price')}
                        value={item.price}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => handleItemChange(index, { price: round2(Number(e.target.value)) })}
                      />
                    </div>
                    {visibleFields.discount && (
                    <div>
                      <label className="sr-only">Disc %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        className="grid-cell w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-0.5 text-[11px] h-7 text-right"
                        title={t('ui.discount')}
                        value={item.discount ?? 0}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => handleItemChange(index, { discount: Number(e.target.value) })}
                      />
                    </div>
                    )}
                    {visibleFields.tax && (
                    <div>
                      <label className="sr-only">Tax %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        className="grid-cell w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-0.5 text-[11px] h-7 text-right"
                        title="Tax"
                        value={item.tax ?? 0}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => handleItemChange(index, { tax: Number(e.target.value) })}
                      />
                    </div>
                    )}
                    <div className="flex items-center justify-end gap-1 px-1.5">
                      <span className="lg:hidden text-[10px] text-gray-500 dark:text-gray-400">{t('ui.amount')}</span>
                      <div className="text-[11px] font-semibold text-gray-900 dark:text-white">{calculateLineAmount(item).toFixed(2)}</div>
                    </div>
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => removeItemRow(index)}
                        className="p-1 rounded-md text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-900/30"
                        title="Remove item"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );})}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-[10px]">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600 dark:text-gray-300">Items: <strong className="text-gray-900 dark:text-white">{itemsCount}</strong></span>
                </div>
                {showAvailableStock && (
                  <span className="text-gray-600 dark:text-gray-300">Available Stock: <strong className="text-gray-900 dark:text-white">{availableStockLabel}</strong></span>
                )}
                <span className="text-gray-600 dark:text-gray-300">Grand Total: <strong className="text-gray-900 dark:text-white">{totalPreview.toFixed(2)}</strong></span>
                <span className="text-gray-600 dark:text-gray-300">Bonus: <strong className="text-gray-900 dark:text-white">{totalsSummary.totalBonus.toFixed(2)}</strong></span>
                <span className="text-gray-600 dark:text-gray-300">Discount: <strong className="text-gray-900 dark:text-white">{totalsSummary.totalDiscount.toFixed(2)}</strong></span>
                <span className="text-gray-600 dark:text-gray-300">Tax: <strong className="text-gray-900 dark:text-white">{totalsSummary.totalTax.toFixed(2)}</strong></span>
                <span className="text-gray-600 dark:text-gray-300">Net: <strong className="text-gray-900 dark:text-white">{totalPreview.toFixed(2)}</strong></span>
                <div className="flex items-center gap-2 text-[10px]">
                  <label className="text-gray-600 dark:text-gray-300">{t('ui.paid')}</label>
                  {/* Stating that money was received is a financial act, not
                      part of writing the invoice. Without the permission the
                      figure is shown but not editable, and the backend ignores
                      any amount such a user posts. */}
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="w-20 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-[10px] disabled:opacity-60 disabled:cursor-not-allowed"
                    title={canRecordPayment ? 'Paid amount' : 'Requires the Record Finance Payments permission'}
                    value={formData.paidAmount}
                    disabled={!canRecordPayment}
                    onChange={(e) => handlePaidChange(Number(e.target.value))}
                  />
                </div>
                <span className="text-gray-600 dark:text-gray-300">Due: <strong className="text-gray-900 dark:text-white">{Number(formData.dueAmount || 0).toFixed(2)}</strong></span>
              </div>

              {/* A desktop command strip: the shortcut legend on the left, the
                  two actions on the right, each captioned with the key that
                  fires it so the keyboard route is discoverable rather than
                  folded away in a tooltip. */}
              <div className="flex items-center justify-between gap-3 mt-2 px-2 py-1.5 border-t border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 rounded-b">
                <div className="hidden md:flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
                  <span><kbd className="trx-kbd">&#8593;&#8595;</kbd> row</span>
                  <span><kbd className="trx-kbd">&#8592;&#8594;</kbd> cell</span>
                  <span><kbd className="trx-kbd">Enter</kbd> next / new row</span>
                  <span><kbd className="trx-kbd">Ctrl</kbd>+<kbd className="trx-kbd">S</kbd> save</span>
                  <span><kbd className="trx-kbd">Esc</kbd> close</span>
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    type="button"
                    onClick={closeTransactionModal}
                    className="inline-flex items-center justify-center gap-1.5 min-w-[104px] px-3 py-1 text-xs font-medium rounded border border-gray-400 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 active:translate-y-px transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                    {t('ui.cancel')}
                    <span className="text-[9px] text-gray-400">Esc</span>
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-1.5 min-w-[124px] px-3 py-1 text-xs font-semibold rounded border border-blue-700 bg-blue-600 text-white hover:bg-blue-700 active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  >
                    {submitting
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Check className="w-3.5 h-3.5" />}
                    {submitting ? 'Saving...' : showAddModal ? t('ui.save') : t('ui.update')}
                    <span className="text-[9px] text-blue-100">Ctrl+S</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      <div className={`fixed inset-0 z-50 ${showDeleteModal ? 'flex' : 'hidden'} items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Delete Transaction</h3>
            <button onClick={() => setShowDeleteModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label={t('ui.close')}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-3 text-sm text-gray-700 dark:text-gray-200">
            {/* The serial number is what the user sees on the invoice and in the
                list; the database id is an internal value they have never been
                shown, so confirming against it told them nothing. */}
            <p>
              Are you sure you want to delete{' '}
              <strong>
                {INVOICE_TABS.find((tab) => tab.id === selectedTransaction?.trxType)?.docTitle ?? 'transaction'}
                {' #'}
                {selectedTransaction?.serialNo ?? selectedTransaction?.id}
              </strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowDeleteModal(false)} className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700">{t('ui.cancel')}</button>
              <button onClick={handleConfirmDelete} className="px-3 py-2 text-sm rounded-md bg-rose-600 text-white hover:bg-rose-700">{t('ui.delete')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
