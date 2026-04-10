import React, { useMemo, useState, useEffect } from 'react';
import { Eye, FileSpreadsheet, FileText, Pencil, Plus, Minus, Search, Trash2, X, ShoppingCart, Receipt, Printer } from 'lucide-react';
import { Hospital, Patient, Transaction, TransactionDetail, UserRole } from '../types';
import { toast } from 'sonner';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { useTransactions } from '../context/TransactionContext';
import { useMedicines } from '../context/MedicineContext';
import { useStocks } from '../context/StockContext';
import { useSuppliers } from '../context/SupplierContext';
import { usePatients } from '../context/PatientContext';
import { useHospitals } from '../context/HospitalContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import api from '../../api/axios';
import { formatOnlyDate } from '../utils/date';
import { buildVerificationUrl } from '../utils/verification';

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
  hospitalId,
  transactionDate: new Date(),
  items: [emptyItem()],
});

export function TransactionManagement({ hospital, userRole = 'admin' }: TransactionManagementProps) {
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  const { transactions, addTransaction, updateTransaction, deleteTransaction, loading } = useTransactions();
  const { medicines, refresh: refreshMedicines } = useMedicines();
  const { stocks, refresh: refreshStocks } = useStocks();
  const { suppliers } = useSuppliers();
  const { patients } = usePatients();
  const { hospitals } = useHospitals();
  const { hasPermission } = useAuth();
  const { loadHospitalSetting, getPrintColumnSettings, getShowOutOfStockMedicinesForPharmacy } = useSettings();
  const canAdd = hasPermission('add_transactions') || hasPermission('manage_transactions');
  const canEdit = hasPermission('edit_transactions') || hasPermission('manage_transactions');
  const canDelete = hasPermission('delete_transactions') || hasPermission('manage_transactions');
  const canExport = hasPermission('export_transactions') || hasPermission('manage_transactions');
  const canPrint = hasPermission('print_transactions') || hasPermission('manage_transactions');

  const [searchTerm, setSearchTerm] = useState('');
  const [trxTypeFilter, setTrxTypeFilter] = useState<'all' | Transaction['trxType']>('all');
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
  const [receiptSize, setReceiptSize] = useState<'a4' | '58mm' | '76mm' | '80mm'>('a4');
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
  const getAvailableStock = (medicineId?: string, batchNo?: string, hospitalId?: string) => {
    if (!medicineId || !hospitalId) return 0;
    const scoped = stocks.filter((s) => String(s.hospitalId) === String(hospitalId) && String(s.medicineId) === String(medicineId));
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
      const required = Number(item.qtty || 0) + Number(item.bonus || 0);
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
        const required = Number(detail.qtty || 0) + Number(detail.bonus || 0);
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

  const handlePrintInvoice = async (transaction: Transaction | null = selectedTransaction, forceA4 = false) => {
    if (!transaction) return;
    const trx = transaction;

    const resolvedTemplate: 'sale' | 'purchase' | 'supplier' =
      trx.trxType === 'purchase' || trx.trxType === 'purchase_return'
        ? (trx.supplierId ? 'supplier' : 'purchase')
        : 'sale';

    setPrintTemplate(resolvedTemplate);

    const targetSize: 'a4' | '58mm' | '76mm' | '80mm' = forceA4 ? 'a4' : receiptSize;
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
    const billedToName =
      resolvedTemplate === 'sale'
        ? (patient?.name || trx.patientName || getPatientDisplay(trx.patientId) || 'Walk-in Customer')
        : (supplier?.name || trx.supplierName || getSupplierDisplay(trx.supplierId) || 'Supplier');
    const billedToAddress = resolvedTemplate === 'sale' ? (patient?.address || '') : (supplier?.address || '');
    const billedToPhone = resolvedTemplate === 'sale' ? (patient?.phone || '') : (supplier?.contactInfo || '');

    const invoiceHeading = resolvedTemplate === 'sale' ? 'SALES INVOICE' : resolvedTemplate === 'purchase' ? 'PURCHASE INVOICE' : 'SUPPLIER INVOICE';
    const hospitalName = hospitalInfo?.name || getHospitalName(trx.hospitalId);
    const hospitalAddress = hospitalInfo?.address || '';
    const hospitalContact = [hospitalInfo?.phone || '', hospitalInfo?.email || ''].filter(Boolean).join(' | ');

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
        medicine: detail.medicineId ? getMedicineDisplay(detail.medicineId) : (detail.medicineName || 'Unknown'),
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
            const itemName = detail.medicineId ? getMedicineDisplay(detail.medicineId) : (detail.medicineName || 'Unknown');

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
            const itemName = detail.medicineId ? getMedicineDisplay(detail.medicineId) : (detail.medicineName || 'Unknown');
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

    if (targetSize === 'a4') {
      html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${escapeHtml(invoiceHeading)}</title>
            <style>
              @page { size: A4; margin: 15mm; }
              * { box-sizing: border-box; }
              body {
                margin: 0;
                background: #ffffff;
                color: #0f172a;
                font-family: Arial, Helvetica, sans-serif;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
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
                    ${showExpiryDateColumn ? '<th style="width:9%" class="text-center">Exp</th>' : ''}
                    <th style="width:6%" class="text-center">Qty</th>
                    ${showBonusColumn ? '<th style="width:6%" class="text-center">Bon</th>' : ''}
                    <th style="width:9%" class="text-center">Price</th>
                    <th style="width:7%" class="text-center">Disc</th>
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

              <div class="brand-foot">Powered by: Soft Core IT Solutions - Kabul Afghanistan</div>
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
      
      const rowsMarkupThermal = transactionDetails.length
        ? transactionDetails.map((detail, index) => {
            const amount = Number(detail.amount ?? calculateLineAmount(detail));
            const qty = Number(detail.qtty || 0);
            const netPrice = qty > 0 ? amount / qty : Number(detail.price || 0);
            const itemName = detail.medicineId ? getMedicineDisplay(detail.medicineId) : (detail.medicineName || 'Unknown');
            const rowClass = index % 2 !== 0 ? 'alt' : '';
            return `
              <tr class="${rowClass}">
                <td style="text-align:left;">#${String(index + 1).padStart(2, '0')} ${escapeHtml(itemName).substring(0, 25)}</td>
                <td>${qty}</td>
                <td>${netPrice.toFixed(2)}</td>
                <td style="text-align:right;">${amount.toFixed(2)}</td>
              </tr>
            `;
          }).join('')
        : '<tr><td colspan="4" style="text-align: center;">No items</td></tr>';

      html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${escapeHtml(invoiceHeading)}</title>
            <style>
              @page { size: ${paperWidth} auto; margin: 0; }
              * { box-sizing: border-box; }
              html, body {
                margin: 0; padding: 0; width: ${paperWidth}; background: #fff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                -webkit-print-color-adjust: exact; print-color-adjust: exact;
              }
              .screen-note { display: flex; align-items: center; justify-content: center; min-height: 100vh; color: #64748b; font-size: 14px; }
              @media screen { .receipt { display: none; } .screen-note { display: flex; } }
              @media print { .screen-note { display: none !important; } .receipt { display: block; } }

              .receipt { background-color: #fff; width: ${paperWidth}; padding: 0; margin: 0 auto; position: relative; }
              .content-wrapper { padding: 4mm 2mm; display: flex; flex-direction: column; gap: 4px; }
              
              .header-text { width: 100%; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; text-align: left; }
              .h-name { font-size: ${baseFont + 2}px; font-weight: 800; color: #000; line-height: 1.2; text-transform: uppercase; margin:0;}
              .h-contact { font-size: ${baseFont}px; color: #000; margin-top: 2px; }
              
              .blue-bar { background-color: #000; color: #fff; padding: 4px 6px; display: flex; justify-content: space-between; align-items: center; margin-top: 4px; margin-bottom: 4px; }
              .blue-bar h1 { font-size: ${baseFont + 2}px; font-weight: bold; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
              .blue-bar .meta { font-size: ${baseFont - 1}px; text-align: right; line-height: 1.2; font-weight: bold; }
              
              table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
              th { color: #000; font-size: ${baseFont - 1}px; text-transform: uppercase; text-align: center; padding: 2px; border-bottom: 1.5px solid #000; }
              th:first-child { text-align: left; }
              th:last-child { text-align: right; }
              td { font-size: ${baseFont - 1}px; text-align: center; padding: 3px 2px; border-bottom: 1px dashed #ccc; }
              td:first-child { font-weight: bold; color: #000; }
              td:last-child { font-weight: bold; color: #000; }
              tr.alt td { background-color: #fff; }
              tr td { background-color: #fff; }

              .totals-container { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 4px; margin-top: 2px;}
              .totals { width: 70%; }
              .total-row { display: flex; justify-content: space-between; font-size: ${baseFont}px; padding: 2px 0; font-weight: bold; color: #000; }
              .total-row span:first-child { color: #000; text-transform: uppercase; font-size: ${baseFont - 1}px;}
              .total-row.border-top { border-top: 1px solid #000; margin-top: 2px; padding-top: 2px; }
              .total-row.border-bottom { border-bottom: 1px solid #000; margin-bottom: 2px; padding-bottom: 2px; }
              
              .footer { display: flex; flex-direction: column; justify-content: flex-start; align-items: flex-start; margin-top: 4px; text-align: left; }
              .footer-cols { width: 100%; font-size: ${baseFont}px; color: #000; line-height: 1.4; text-align: left;}
              .footer-cols p { margin:0 0 2px 0; }
              .qr-box { flex-shrink: 0; padding-right: 10px; padding-bottom: 4px; }
              .qr-code { width: 50px; height: 50px; border: 1px solid #000; padding: 2px; background: #fff;}
            </style>
          </head>
          <body>
            <div class="screen-note">Preparing print preview...</div>
            <div class="receipt">
              <div class="content-wrapper">
                <div class="header-text">
                  <div class="h-name">${escapeHtml(hospitalName)}</div>
                  <div class="h-contact">${escapeHtml(hospitalContact)}</div>
                </div>

                <div class="blue-bar">
                  <h1>Invoice</h1>
                  <div class="meta">
                    <div>#${escapeHtml(String(trx.serialNo ?? '-'))}</div>
                    <div>Date: ${escapeHtml(invoiceDate)}</div>
                  </div>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>DESCRIPTION</th>
                      <th>QTY</th>
                      <th>PRICE</th>
                      <th>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rowsMarkupThermal}
                  </tbody>
                </table>

                <div class="totals-container">
                  <div class="qr-box">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl || qrPayload)}" class="qr-code" />
                  </div>
                  <div class="totals">
                    <div class="total-row border-top"><span>Subtotal</span> <span>${netTotal.toFixed(2)}</span></div>
                    <div class="total-row"><span>Tax</span> <span>${totalsSummary.totalTax.toFixed(2)}</span></div>
                    <div class="total-row border-bottom"><span>Discount</span> <span>${totalsSummary.totalDiscount.toFixed(2)}</span></div>
                    <div class="total-row" style="font-size: ${baseFont + 1}px;"><span>Total</span> <span>${netTotal.toFixed(2)}</span></div>
                  </div>
                </div>

                <div class="footer">
                   <div class="footer-cols">
                     <p><strong>Address:</strong> ${escapeHtml(hospitalAddress || hospitalContact)}</p>
                   </div>
                </div>
              </div>
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
    return `${patient.name} ${patient.patientId ? `(${patient.patientId})` : ''}`.trim();
  };

  const getExpiryDisplay = (date: Date | string | undefined, hospitalId: string) => {
    const h = getHospital(hospitalId);
    return formatOnlyDate(date ?? undefined, h?.timezone || 'Asia/Kabul', (h?.calendarType as 'gregorian' | 'shamsi') || 'gregorian');
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
      .filter((b) => b.expiryDate && b.expiryDate >= now)
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
  const getMedicinePrice = (id: string, type: Transaction['trxType']) => {
    const med = medicines.find((m) => m.id === id);
    if (!med) return 0;
    return type === 'purchase' || type === 'purchase_return' ? (med.costPrice ?? 0) : (med.salePrice ?? 0);
  };

  const exportToExcel = async () => {
    const { XLSX } = await loadXlsxTools();

    const workSheet = XLSX.utils.json_to_sheet(filteredTransactions.map((t) => ({
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
      body: filteredTransactions.map((t) => [
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
      const matchesTerm =
        String(t.serialNo ?? t.id).includes(term) ||
        (t.trxType || '').toLowerCase().includes(term) ||
        (t.details || []).some((d) => (d.medicineName || getMedicineName(d.medicineId)).toLowerCase().includes(term));
      const matchesType = trxTypeFilter === 'all' || t.trxType === trxTypeFilter;
      return matchesTerm && matchesType;
    });
  }, [scopedTransactions, searchTerm, trxTypeFilter, medicines]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage));
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTransactions, currentPage]);

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
      .sort((a, b) => (b.createdAt && a.createdAt ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : 0))
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
        const term = (medicineQueries[index] || '').toLowerCase();
        if (!term) return true;
        const display = `${m.brandName} ${m.genericName || ''} ${m.strength || ''} ${m.type || ''}`.toLowerCase();
        return display.includes(term);
      })
      .filter((m) => {
        if (!['sales', 'purchase_return'].includes(formData.trxType)) return true;
        if (formData.trxType === 'sales' && getShowOutOfStockMedicinesForPharmacy(formData.hospitalId)) return true;
        return getAvailableStock(m.id, undefined, formData.hospitalId) > 0;
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
    setFormData(buildInitialFormData(targetHospitalId));
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

  const handleMedicineChange = (index: number, medicineId: string) => {
    const price = getMedicinePrice(medicineId, formData.trxType);
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
    handleItemChange(index, { medicineId, price, batchNo: nextBatchNo, expiryDate });
  };

  const addItemRow = () => {
    setFormData((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }));
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
    if ((formData.trxType === 'sales' || formData.trxType === 'sales_return') && !formData.patientId) {
      toast.error('Please select a patient');
      return;
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
        patientId: formData.patientId || undefined,
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
    if ((formData.trxType === 'sales' || formData.trxType === 'sales_return') && !formData.patientId) {
      toast.error('Please select a patient');
      return;
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
        patientId: formData.patientId || undefined,
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
  const isCompactReceipt = receiptSize !== 'a4';
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

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Transaction Management</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">Track purchase and sales transactions for {isAllHospitals ? 'All Hospitals' : currentHospital.name}</p>
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
          <select
            className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs"
            title="Filter by type"
            value={trxTypeFilter}
            onChange={(e) => setTrxTypeFilter(e.target.value as any)}
          >
            <option value="all">All Types</option>
            <option value="purchase">Purchase</option>
            <option value="sales">Sales</option>
            <option value="purchase_return">Purchase Return</option>
            <option value="sales_return">Sales Return</option>
          </select>
          {canExport && (
            <button onClick={exportToExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs font-medium shadow-sm" title="Export to Excel">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
          )}
          {canExport && (
            <button onClick={exportToPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs font-medium shadow-sm" title="Export to PDF">
              <FileText className="w-3.5 h-3.5" />
              PDF
            </button>
          )}
          {canAdd && (
            <button onClick={handleAdd} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium shadow-sm">
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          )}
        </div>
      </div>

      <HospitalSelector userRole={userRole} selectedHospitalId={selectedHospitalId} onHospitalChange={setSelectedHospitalId} />

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="overflow-x-auto rounded-t-lg max-h-[calc(100vh-220px)] overflow-y-auto">
          <table className="w-full text-left border-collapse relative">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">ID</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Type</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Grand Total</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Paid</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Due</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Created</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedTransactions.length > 0 ? (
                paginatedTransactions.map((trx) => (
                  <tr key={trx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">#{trx.serialNo ?? trx.id}</td>
                    <td className="px-4 py-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${['purchase', 'purchase_return'].includes(trx.trxType)
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                      }`}>
                        {trx.trxType === 'purchase' && 'Purchase'}
                        {trx.trxType === 'sales' && 'Sales'}
                        {trx.trxType === 'purchase_return' && 'Purchase Return'}
                        {trx.trxType === 'sales_return' && 'Sales Return'}
                      </span>
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
                            title="Print"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => handleView(trx)} className="p-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-200" title="View">
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button onClick={() => handleEdit(trx)} className="p-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-200" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(trx)} className="p-1.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-200" title="Delete">
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
            >
              Prev
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              Next
            </button>
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
                onChange={(e) => setReceiptSize(e.target.value as 'a4' | '58mm' | '76mm' | '80mm')}
              >
                <option value="a4">A4 Invoice</option>
                <option value="58mm">58mm Receipt</option>
                <option value="76mm">76mm Receipt</option>
                <option value="80mm">80mm Receipt</option>
              </select>
              {canPrint && (
                <button
                  onClick={() => {
                    void handlePrintInvoice(selectedTransaction);
                  }}
                  className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
                >
                  Print Invoice
                </button>
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
                    >
                      Edit
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => {
                        setShowViewModal(false);
                        handleDelete(selectedTransaction);
                      }}
                      className="px-3 py-1.5 text-xs rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-200"
                    >
                      Delete
                    </button>
                  )}
                </>
              )}
              <button onClick={() => setShowViewModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
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
                        className={`${receiptSize === 'a4' ? 'w-24 h-24' : 'w-10 h-10'} object-contain`}
                      />
                    )}
                    <div>
                      <h1 className={`${receiptSize === 'a4' ? 'text-2xl' : 'text-base'} font-bold text-gray-900 uppercase tracking-wider`}>
                        {getHospitalName(selectedTransaction.hospitalId)}
                      </h1>
                      <p className={`${receiptSize === 'a4' ? 'text-sm' : 'text-[10px]'} text-gray-600`}>Healthcare Services & Solutions</p>
                      <p className={`${receiptSize === 'a4' ? 'text-sm' : 'text-[10px]'} text-gray-600`}>Code: {getHospital(selectedTransaction.hospitalId)?.code || '—'}</p>
                    </div>
                  </div>
                  <div className={`text-right w-1/2 ${receiptSize === 'a4' ? 'text-sm' : 'text-[10px]'}`}>
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
                            <p className="text-sm text-gray-600 mt-1">Supplier</p>
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
                      <p className="text-gray-500">Type</p>
                      <p className="font-semibold text-gray-900 capitalize">{selectedTransaction.trxType.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Invoice</p>
                      <p className="font-semibold text-gray-900">{selectedTransaction.serialNo ?? '—'}</p>
                    </div>
                    {printTemplate === 'sale' ? (
                      <div className="col-span-2">
                        <p className="text-gray-500">Customer</p>
                        <p className="font-semibold text-gray-900 break-words">{getPatientDisplay(selectedTransaction.patientId) || 'Walk-in'}</p>
                      </div>
                    ) : (
                      <div className="col-span-2">
                        <p className="text-gray-500">Supplier</p>
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
                          <th className="px-1 py-1">Item</th>
                          <th className="px-1 py-1 w-6 text-center">Qty</th>
                          <th className="px-1 py-1 w-8 text-right">Amt</th>
                        </tr>
                      ) : (
                        <tr>
                          <th className="px-3 py-2 font-medium">SN</th>
                          <th className="px-3 py-2 font-medium">Item Description</th>
                          <th className="px-3 py-2 font-medium text-center">Batch</th>
                          <th className="px-3 py-2 font-medium text-center">Expiry</th>
                          <th className="px-3 py-2 font-medium text-center">Qty</th>
                          <th className="px-3 py-2 font-medium text-center">Bonus</th>
                          <th className="px-3 py-2 font-medium text-right">Price</th>
                          {showFormulaColumns && <th className="px-3 py-2 font-medium text-right">Disc %</th>}
                          {showFormulaColumns && <th className="px-3 py-2 font-medium text-right">Tax %</th>}
                          <th className="px-3 py-2 font-medium text-right">Net Price</th>
                          <th className="px-3 py-2 font-medium text-right">Amount</th>
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
                        <span className="text-gray-600">Discount</span>
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
                      <span className="text-gray-600">Paid</span>
                      <span className="font-semibold text-gray-900">{Number(selectedTransaction.paidAmount).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-gray-600 text-red-600">Due</span>
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
                    <p className="text-gray-500 dark:text-gray-400">Hospital</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{getHospitalName(selectedTransaction.hospitalId)}</p>
                  </div>
                  {selectedTransaction.trxType === 'sales' || selectedTransaction.trxType === 'sales_return' ? (
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Customer</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{getPatientDisplay(selectedTransaction.patientId) || '—'}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Supplier</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{getSupplierDisplay(selectedTransaction.supplierId) || '—'}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Type</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{selectedTransaction.trxType}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Date</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{selectedTransaction.createdAt ? new Date(selectedTransaction.createdAt).toLocaleString() : '—'}</p>
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
                      <tr>
                        <th className="px-3 py-2">Medicine</th>
                        {activePrintColumns.showBatchColumn && <th className="px-3 py-2">Batch</th>}
                        {activePrintColumns.showExpiryDateColumn && <th className="px-3 py-2">Expiry</th>}
                        <th className="px-3 py-2">Qty</th>
                        {activePrintColumns.showBonusColumn && <th className="px-3 py-2">Bonus</th>}
                        <th className="px-3 py-2">Price</th>
                        {showFormulaColumns && <th className="px-3 py-2">Discount</th>}
                        {showFormulaColumns && <th className="px-3 py-2">Tax</th>}
                        <th className="px-3 py-2">Amount</th>
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
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-5xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {showAddModal ? 'Add Transaction' : 'Edit Transaction'}
                </h3>
                  {userRole === 'super_admin' && (
                    <select
                      className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs"
                      title="Hospital"
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
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form className="p-4 space-y-4 max-h-[75vh] overflow-y-auto" onSubmit={showAddModal ? handleSubmitAdd : handleSubmitEdit}>
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm">
                <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                {(formData.trxType === 'sales' || formData.trxType === 'sales_return') && (
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
                              setPatientSearch(`${selected.name} ${selected.patientId ? `(${selected.patientId})` : ''}`.trim());
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
                                  setPatientSearch(`${p.name} ${p.patientId ? `(${p.patientId})` : ''}`.trim());
                                  setOpenPatientDropdown(false);
                                  setHighlightedPatientIndex(-1);
                                }}
                              >
                                {p.name} {p.patientId ? `(${p.patientId})` : ''}
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

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">Type</label>
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    {[
                      { value: 'purchase', label: 'Purchase' },
                      { value: 'sales', label: 'Sales' },
                      { value: 'purchase_return', label: 'Return Out' },
                      { value: 'sales_return', label: 'Return In' },
                    ].map((opt) => (
                      <label key={opt.value} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] cursor-pointer transition h-8 ${formData.trxType === opt.value ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-200' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-gray-800/60 dark:border-gray-700 dark:text-gray-300'}`}>
                        <input
                          type="radio"
                          name="trxType"
                          value={opt.value}
                          title={`Transaction type ${opt.label}`}
                          checked={formData.trxType === opt.value}
                          className="h-2.5 w-2.5"
                          onChange={() => {
                            setFormData((prev) => ({
                              ...prev,
                              trxType: opt.value as Transaction['trxType'],
                              supplierId: ['purchase', 'purchase_return'].includes(opt.value) ? prev.supplierId : '',
                              patientId: ['sales', 'sales_return'].includes(opt.value) ? prev.patientId : '',
                              items: prev.items.map((item) => item.medicineId
                                ? { ...item, price: getMedicinePrice(item.medicineId, opt.value as Transaction['trxType']) }
                                : item
                              ),
                            }));
                            setSupplierSearch('');
                            setPatientSearch('');
                            setOpenSupplierDropdown(false);
                            setOpenPatientDropdown(false);
                            setHighlightedSupplierIndex(-1);
                            setHighlightedPatientIndex(-1);
                            setLastEditedTotal('auto');
                          }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pb-0.5">
                   <button
                    type="button"
                    onClick={addItemRow}
                    className="px-2.5 py-1.5 text-xs rounded-md text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-1 h-8"
                    title="Add new item (Ctrl+Enter)"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Item
                  </button>
                </div>
                
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

              <div
                className={`space-y-2 pr-1 ${openMedicineDropdownIndex !== null ? 'overflow-visible' : 'max-h-64 overflow-y-auto'}`}
              >
                {formData.items.map((item, index) => {
                  const medicineOptions = getMedicineOptions(index);

                  return (
                  <div key={index} className="grid grid-cols-1 lg:grid-cols-12 gap-2 border border-gray-200 dark:border-gray-700 rounded-md p-2">
                    <div className="lg:col-span-3 space-y-1">
                      <label className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Medicine</label>
                      <div className="relative">
                        <input
                          type="text"
                          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] h-8"
                          title="Medicine"
                          placeholder="Type medicine name..."
                          value={medicineQueries[index] ?? (item.medicineId ? getMedicineDisplay(item.medicineId) : '')}
                          onFocus={() => {
                            setOpenMedicineDropdownIndex(index);
                            setHighlightedMedicineIndex((prev) => ({ ...prev, [index]: 0 }));
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
                        {openMedicineDropdownIndex === index && (
                          <div className="absolute z-30 mt-1 w-full max-h-48 overflow-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow">
                            {medicineOptions
                              .map((m, optionIndex) => {
                                const display = `${m.brandName} ${m.genericName ? `(${m.genericName})` : ''} ${m.strength || ''} ${m.type || ''}`.replace(/\s+/g, ' ').trim();
                                const available = ['sales', 'purchase_return'].includes(formData.trxType)
                                  ? getAvailableStock(m.id, undefined, formData.hospitalId)
                                  : null;
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
                                        <span className={`text-[10px] font-semibold ${available > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                          {available}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            {medicineOptions.length === 0 && (
                              <div className="px-2 py-2 text-xs text-gray-500">No medicines found</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="lg:col-span-1 space-y-1">
                      <label className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Batch No</label>
                      <input
                        className="w-full max-w-[120px] rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] h-8"
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
                    <div className="lg:col-span-1 space-y-1">
                      <label className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Expiry</label>
                      <input
                        type="date"
                        className="w-full max-w-[150px] rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] h-8"
                        title="Expiry Date"
                        value={item.expiryDate ? new Date(item.expiryDate).toISOString().slice(0, 10) : ''}
                        onChange={(e) => handleItemChange(index, { expiryDate: e.target.value ? new Date(e.target.value) : undefined })}
                      />
                    </div>
                    <div className="lg:col-span-1 space-y-1">
                      <label className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Qty</label>
                      <input
                        type="number"
                        min={1}
                        className="w-full max-w-[64px] rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] h-8"
                        title="Quantity"
                        value={item.qtty}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => handleItemChange(index, { qtty: Number(e.target.value) })}
                      />
                      {['sales', 'purchase_return'].includes(formData.trxType) && item.medicineId && (
                        <div className="text-[9px] text-gray-500 dark:text-gray-400">
                          Available: {getAvailableStock(item.medicineId, item.batchNo || undefined, formData.hospitalId)}
                        </div>
                      )}
                    </div>
                    <div className="lg:col-span-1 space-y-1">
                      <label className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Bonus</label>
                      <input
                        type="number"
                        min={0}
                        className="w-full max-w-[70px] rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] h-8"
                        title="Bonus"
                        value={item.bonus ?? 0}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => handleItemChange(index, { bonus: Number(e.target.value) })}
                      />
                    </div>
                    <div className="lg:col-span-1 space-y-1">
                      <label className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Price</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className="w-full max-w-[100px] rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] h-8"
                        title="Price"
                        value={item.price}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => handleItemChange(index, { price: Number(e.target.value) })}
                      />
                    </div>
                    <div className="lg:col-span-1 space-y-1">
                      <label className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Disc %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        className="w-full max-w-[70px] rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] h-8"
                        title="Discount"
                        value={item.discount ?? 0}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => handleItemChange(index, { discount: Number(e.target.value) })}
                      />
                    </div>
                    <div className="lg:col-span-1 space-y-1">
                      <label className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Tax %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        className="w-full max-w-[70px] rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] h-8"
                        title="Tax"
                        value={item.tax ?? 0}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => handleItemChange(index, { tax: Number(e.target.value) })}
                      />
                    </div>
                    <div className="lg:col-span-1 flex items-center justify-end gap-1 pt-5 lg:pt-0">
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">Amount</div>
                      <div className="text-[11px] font-semibold text-gray-900 dark:text-white">{calculateLineAmount(item).toFixed(2)}</div>
                    </div>
                    <div className="lg:col-span-1 flex items-center justify-end gap-1 pt-5 lg:pt-0">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={addItemRow}
                          className="p-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-200"
                          title="Add row below"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => removeItemRow(index)} className="p-1 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-200" title="Remove row">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );})}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-[10px]">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600 dark:text-gray-300">Items: <strong className="text-gray-900 dark:text-white">{itemsCount}</strong></span>
                </div>
                <span className="text-gray-600 dark:text-gray-300">Grand Total: <strong className="text-gray-900 dark:text-white">{totalPreview.toFixed(2)}</strong></span>
                <span className="text-gray-600 dark:text-gray-300">Bonus: <strong className="text-gray-900 dark:text-white">{totalsSummary.totalBonus.toFixed(2)}</strong></span>
                <span className="text-gray-600 dark:text-gray-300">Discount: <strong className="text-gray-900 dark:text-white">{totalsSummary.totalDiscount.toFixed(2)}</strong></span>
                <span className="text-gray-600 dark:text-gray-300">Tax: <strong className="text-gray-900 dark:text-white">{totalsSummary.totalTax.toFixed(2)}</strong></span>
                <span className="text-gray-600 dark:text-gray-300">Net: <strong className="text-gray-900 dark:text-white">{totalPreview.toFixed(2)}</strong></span>
                <div className="flex items-center gap-2 text-[10px]">
                  <label className="text-gray-600 dark:text-gray-300">Paid</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="w-20 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-[10px]"
                    title="Paid amount"
                    value={formData.paidAmount}
                    onChange={(e) => handlePaidChange(Number(e.target.value))}
                  />
                </div>
                <span className="text-gray-600 dark:text-gray-300">Due: <strong className="text-gray-900 dark:text-white">{Number(formData.dueAmount || 0).toFixed(2)}</strong></span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeTransactionModal}
                  className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : showAddModal ? 'Save' : 'Update'}
                </button>
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
            <button onClick={() => setShowDeleteModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-3 text-sm text-gray-700 dark:text-gray-200">
            <p>Are you sure you want to delete transaction <strong>#{selectedTransaction?.id}</strong>? This action cannot be undone.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowDeleteModal(false)} className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700">Cancel</button>
              <button onClick={handleConfirmDelete} className="px-3 py-2 text-sm rounded-md bg-rose-600 text-white hover:bg-rose-700">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
