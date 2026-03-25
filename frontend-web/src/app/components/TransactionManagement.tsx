import React, { useMemo, useState, useEffect } from 'react';
import { Eye, FileSpreadsheet, FileText, Pencil, Plus, Search, Trash2, X, ShoppingCart, Receipt, Printer } from 'lucide-react';
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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatOnlyDate } from '../utils/date';

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
  const [isPrintQueued, setIsPrintQueued] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [remoteMedicines, setRemoteMedicines] = useState<typeof medicines>([]);
  const [remoteSuppliers, setRemoteSuppliers] = useState<typeof suppliers>([]);
  const [remotePatients, setRemotePatients] = useState<typeof patients>([]);
  const [lastEditedTotal, setLastEditedTotal] = useState<'paid' | 'due' | 'auto'>('auto');
  const [openMedicineDropdownIndex, setOpenMedicineDropdownIndex] = useState<number | null>(null);
  const [medicineQueries, setMedicineQueries] = useState<Record<number, string>>({});
  const [openSupplierDropdown, setOpenSupplierDropdown] = useState(false);
  const [openPatientDropdown, setOpenPatientDropdown] = useState(false);

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

    for (const key of Object.keys(requiredByKey)) {
      const [medicineId, batchNo] = key.split('::');
      const available = getAvailableStock(medicineId, batchNo === '__all__' ? undefined : batchNo, formData.hospitalId);
      if (available < requiredByKey[key]) {
        const label = getMedicineName(medicineId);
        const batchLabel = batchNo !== '__all__' ? ` (Batch: ${batchNo})` : '';
        toast.error(`Insufficient stock for ${label}${batchLabel}. Available: ${available}, Required: ${requiredByKey[key]}.`);
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
  const getMedicineName = (id: string) => medicines.find((m) => m.id === id)?.brandName || 'Unknown';
  const getMedicineDisplay = (id: string) => {
    const med = medicines.find((m) => m.id === id);
    if (!med) return '';
    const parts = [med.brandName, med.genericName ? `(${med.genericName})` : '', med.strength || '', med.type || ''];
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

  useEffect(() => {
    if (!isPrintQueued || !showViewModal || !selectedTransaction) return;

    let rafOne = 0;
    let rafTwo = 0;

    rafOne = requestAnimationFrame(() => {
      rafTwo = requestAnimationFrame(() => {
        window.print();
        setIsPrintQueued(false);
      });
    });

    return () => {
      if (rafOne) cancelAnimationFrame(rafOne);
      if (rafTwo) cancelAnimationFrame(rafTwo);
    };
  }, [isPrintQueued, selectedTransaction, showViewModal]);

  useEffect(() => {
    if (!showViewModal && isPrintQueued) {
      setIsPrintQueued(false);
    }
  }, [isPrintQueued, showViewModal]);

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

  const exportToExcel = () => {
    const workSheet = XLSX.utils.json_to_sheet(filteredTransactions.map((t) => ({
      ID: t.id,
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
        `#${t.id}`,
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
        String(t.id).includes(term) ||
        (t.trxType || '').toLowerCase().includes(term) ||
        (t.details || []).some((d) => (d.medicineName || getMedicineName(d.medicineId)).toLowerCase().includes(term));
      const matchesType = trxTypeFilter === 'all' || t.trxType === trxTypeFilter;
      return matchesTerm && matchesType;
    });
  }, [scopedTransactions, searchTerm, trxTypeFilter, medicines]);

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
    setFormData((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
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
      await refreshMedicines();
      await refreshStocks();
      closeTransactionModal();
      toast.success('Transaction added successfully.');
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
      await refreshMedicines();
      await refreshStocks();
      closeTransactionModal();
      toast.success('Transaction updated successfully.');
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
      await refreshMedicines();
      await refreshStocks();
      setShowDeleteModal(false);
      toast.success('Transaction deleted successfully.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete transaction');
    }
  };

  const totalPreview = calculateTotals(formData.items);
  const totalsSummary = calculateTotalsSummary(formData.items);
  const isCompactReceipt = receiptSize !== 'a4';
  const isPharmacyCompact = isCompactReceipt && printTemplate === 'sale';
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
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((trx) => (
                  <tr key={trx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">#{trx.id}</td>
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
                              setSelectedTransaction(trx);
                              if (trx.trxType === 'purchase' || trx.trxType === 'purchase_return') {
                                setPrintTemplate('purchase');
                              } else {
                                setPrintTemplate('sale');
                              }
                              setShowViewModal(true);
                              setIsPrintQueued(true);
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
                    if (!selectedTransaction) return;
                    if (selectedTransaction.trxType === 'purchase' || selectedTransaction.trxType === 'purchase_return') {
                      setPrintTemplate(selectedTransaction.supplierId ? 'supplier' : 'purchase');
                    } else {
                      setPrintTemplate('sale');
                    }
                    setIsPrintQueued(true);
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
              <div className="space-y-6">
                <div className={`flex items-start justify-between border-b-2 border-gray-800 pb-4 ${receiptSize !== 'a4' ? 'gap-3' : ''}`}>
                  <div className="flex items-center gap-4">
                    {getHospital(selectedTransaction.hospitalId)?.logo && (
                      <img
                        src={getHospital(selectedTransaction.hospitalId)?.logo}
                        alt="Hospital Logo"
                        className={`${receiptSize === 'a4' ? 'w-16 h-16' : 'w-10 h-10'} object-contain`}
                      />
                    )}
                    <div>
                      <h1 className={`${receiptSize === 'a4' ? 'text-2xl' : 'text-base'} font-bold text-gray-900`}>
                        {printTemplate === 'sale' ? 'Sale Invoice' : printTemplate === 'purchase' ? 'Purchase Invoice' : 'Supplier Invoice'}
                      </h1>
                      <p className={`${receiptSize === 'a4' ? 'text-sm' : 'text-[10px]'} text-gray-600`}>Hospital: {getHospitalName(selectedTransaction.hospitalId)}</p>
                      <p className={`${receiptSize === 'a4' ? 'text-sm' : 'text-[10px]'} text-gray-600`}>Code: {getHospital(selectedTransaction.hospitalId)?.code || '—'}</p>
                      <p className={`${receiptSize === 'a4' ? 'text-sm' : 'text-[10px]'} text-gray-600`}>Invoice No: {selectedTransaction.serialNo ?? '—'}</p>
                      <p className={`${receiptSize === 'a4' ? 'text-sm' : 'text-[10px]'} text-gray-600`}>Transaction ID: #{selectedTransaction.id}</p>
                    </div>
                  </div>
                  <div className={`text-right text-gray-600 ${receiptSize === 'a4' ? 'text-sm' : 'text-[10px]'}`}>
                    <p>Printed on</p>
                    <p className="font-semibold text-gray-900">{new Date().toLocaleDateString()}</p>
                  </div>
                </div>
                {!isCompactReceipt && (
                  <div className={`flex flex-wrap items-center gap-6 ${receiptSize === 'a4' ? 'text-sm' : 'text-[10px]'}`}>
                    <div>
                      <p className="text-gray-500">Type</p>
                      <p className="font-semibold text-gray-900">{selectedTransaction.trxType}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Invoice No</p>
                      <p className="font-semibold text-gray-900">{selectedTransaction.serialNo ?? '—'}</p>
                    </div>
                    {printTemplate === 'sale' && (
                      <div>
                        <p className="text-gray-500">Patient</p>
                        <p className="font-semibold text-gray-900">{getPatientDisplay(selectedTransaction.patientId) || '—'}</p>
                      </div>
                    )}
                    {(printTemplate === 'purchase' || printTemplate === 'supplier') && (
                      <div>
                        <p className="text-gray-500">Supplier</p>
                        <p className="font-semibold text-gray-900">{getSupplierDisplay(selectedTransaction.supplierId) || '—'}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-500">Grand Total</p>
                      <p className="font-semibold text-gray-900">{selectedTransaction.grandTotal}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Paid</p>
                      <p className="font-semibold text-gray-900">{selectedTransaction.paidAmount}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Due</p>
                      <p className="font-semibold text-gray-900">{selectedTransaction.dueAmount}</p>
                    </div>
                  </div>
                )}
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <table className={`w-full text-left text-xs ${isCompactReceipt ? 'table-fixed' : ''}`}>
                    <thead className="bg-gray-100 text-gray-700">
                      {isCompactReceipt ? (
                        <tr>
                          <th className="px-1 py-1 w-4 text-center">#</th>
                          <th className="px-1 py-1">Medicine</th>
                          <th className="px-1 py-1 w-6 text-center">Qty</th>
                          <th className="px-1 py-1 w-8 text-right">Price</th>
                          {!isPharmacyCompact && <th className="px-1 py-1">Disc</th>}
                          {!isPharmacyCompact && <th className="px-1 py-1">Tax</th>}
                          <th className="px-1 py-1 w-8 text-right">Amt</th>
                        </tr>
                      ) : (
                        <tr>
                          <th className="px-3 py-2">SN</th>
                          <th className="px-3 py-2">Medicine</th>
                          {activePrintColumns.showBatchColumn && <th className="px-3 py-2">Batch</th>}
                          {activePrintColumns.showExpiryDateColumn && <th className="px-3 py-2">Expiry</th>}
                          <th className="px-3 py-2">Qty</th>
                          {activePrintColumns.showBonusColumn && <th className="px-3 py-2">Bonus</th>}
                          <th className="px-3 py-2">Price</th>
                          <th className="px-3 py-2">Discount</th>
                          <th className="px-3 py-2">Tax</th>
                          <th className="px-3 py-2">Amount</th>
                        </tr>
                      )}
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(selectedTransaction.details || []).map((d, idx) => (
                        <tr key={`${d.medicineId}-${idx}`}>
                          {isCompactReceipt ? (
                            <>
                              <td className="px-1 py-1 align-top text-center w-4">{idx + 1}</td>
                              <td className="px-1 py-1 break-words align-top">{d.medicineId ? getMedicineDisplay(d.medicineId) : (d.medicineName || 'Unknown')}</td>
                              <td className="px-1 py-1 align-top text-center w-6">{d.qtty}</td>
                              <td className="px-1 py-1 align-top text-right w-8">{d.price}</td>
                              {!isPharmacyCompact && <td className="px-1 py-1 align-top">{d.discount ?? 0}%</td>}
                              {!isPharmacyCompact && <td className="px-1 py-1 align-top">{d.tax ?? 0}%</td>}
                              <td className="px-1 py-1 align-top text-right w-8">{Number(d.amount ?? calculateLineAmount(d)).toFixed(2)}</td>
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-2">{idx + 1}</td>
                              <td className="px-3 py-2">{d.medicineId ? getMedicineDisplay(d.medicineId) : (d.medicineName || 'Unknown')}</td>
                              {activePrintColumns.showBatchColumn && <td className="px-3 py-2">{d.batchNo || '—'}</td>}
                              {activePrintColumns.showExpiryDateColumn && (
                                <td className="px-3 py-2">{d.expiryDate ? getExpiryDisplay(d.expiryDate, selectedTransaction.hospitalId) : '—'}</td>
                              )}
                              <td className="px-3 py-2">{d.qtty}</td>
                              {activePrintColumns.showBonusColumn && <td className="px-3 py-2">{d.bonus ?? 0}</td>}
                              <td className="px-3 py-2">{d.price}</td>
                              <td className="px-3 py-2">{d.discount ?? 0}%</td>
                              <td className="px-3 py-2">{d.tax ?? 0}%</td>
                              <td className="px-3 py-2">{d.amount ?? 0}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {isCompactReceipt && (
                  <div className="border-t border-gray-300 pt-2 text-[10px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Net Total</span>
                      <span className="font-semibold text-gray-900">{printNetTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Paid</span>
                      <span className="font-semibold text-gray-900">{selectedTransaction.paidAmount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Due</span>
                      <span className="font-semibold text-gray-900">{selectedTransaction.dueAmount}</span>
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
                    <p className="text-gray-500 dark:text-gray-400">Type</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{selectedTransaction.trxType}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Grand Total</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{selectedTransaction.grandTotal}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Paid</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{selectedTransaction.paidAmount}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Due</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{selectedTransaction.dueAmount}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Hospital</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{getHospitalName(selectedTransaction.hospitalId)}</p>
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
                        <th className="px-3 py-2">Discount</th>
                        <th className="px-3 py-2">Tax</th>
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
                          <td className="px-3 py-2">{d.discount ?? 0}%</td>
                          <td className="px-3 py-2">{d.tax ?? 0}%</td>
                          <td className="px-3 py-2">{d.amount ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                        onChange={(e) => {
                          setPatientSearch(e.target.value);
                          setOpenPatientDropdown(true);
                        }}
                        onFocus={() => setOpenPatientDropdown(true)}
                        onBlur={() => setTimeout(() => setOpenPatientDropdown(false), 200)}
                        placeholder="Search patient..."
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] h-8"
                      />
                      {openPatientDropdown && (
                        <div className="absolute z-20 mt-1 w-[250px] max-h-48 overflow-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                          {availablePatients
                            .filter((p) => {
                              const term = patientSearch.toLowerCase();
                              if (!term) return true;
                              return p.name.toLowerCase().includes(term) ||
                                (p.patientId || '').toLowerCase().includes(term) ||
                                (p.phone || '').toLowerCase().includes(term) ||
                                (p.address || '').toLowerCase().includes(term);
                            })
                            .sort((a, b) => (b.createdAt && a.createdAt ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : 0))
                            .slice(0, 30)
                            .map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                                onMouseDown={() => {
                                  setFormData({ ...formData, patientId: p.id });
                                  setPatientSearch(`${p.name} ${p.patientId ? `(${p.patientId})` : ''}`.trim());
                                  setOpenPatientDropdown(false);
                                }}
                              >
                                {p.name} {p.patientId ? `(${p.patientId})` : ''}
                              </button>
                            ))}
                          {availablePatients.length === 0 && (
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
                        onChange={(e) => {
                          setSupplierSearch(e.target.value);
                          setOpenSupplierDropdown(true);
                        }}
                        onFocus={() => setOpenSupplierDropdown(true)}
                        onBlur={() => setTimeout(() => setOpenSupplierDropdown(false), 200)}
                        placeholder="Search supplier..."
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] h-8"
                      />
                      {openSupplierDropdown && (
                        <div className="absolute z-20 mt-1 w-[250px] max-h-48 overflow-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                          {availableSuppliers
                            .filter((s) => {
                              const term = supplierSearch.toLowerCase();
                              if (!term) return true;
                              return s.name.toLowerCase().includes(term) ||
                                (s.contactInfo || '').toLowerCase().includes(term) ||
                                (s.address || '').toLowerCase().includes(term);
                            })
                            .slice(0, 30)
                            .map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                                onMouseDown={() => {
                                  setFormData({ ...formData, supplierId: s.id });
                                  setSupplierSearch(s.name);
                                  setOpenSupplierDropdown(false);
                                }}
                              >
                                {s.name}
                              </button>
                            ))}
                          {availableSuppliers.length === 0 && (
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
                {formData.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 lg:grid-cols-12 gap-2 border border-gray-200 dark:border-gray-700 rounded-md p-2">
                    <div className="lg:col-span-3 space-y-1">
                      <label className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Medicine</label>
                      <div className="relative">
                        <input
                          type="text"
                          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px]"
                          title="Medicine"
                          placeholder="Type medicine name..."
                          value={medicineQueries[index] ?? (item.medicineId ? getMedicineDisplay(item.medicineId) : '')}
                          onFocus={() => setOpenMedicineDropdownIndex(index)}
                          onBlur={() => setTimeout(() => setOpenMedicineDropdownIndex((prev) => (prev === index ? null : prev)), 200)}
                          onChange={(e) => {
                            const value = e.target.value;
                            setMedicineQueries((prev) => ({ ...prev, [index]: value }));
                            setMedicineSearch(value);
                            setOpenMedicineDropdownIndex(index);
                          }}
                          required
                        />
                        {openMedicineDropdownIndex === index && (
                          <div className="absolute z-30 mt-1 w-full max-h-48 overflow-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow">
                            {availableMedicines
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
                              .slice(0, 50)
                              .map((m) => {
                                const display = `${m.brandName} ${m.genericName ? `(${m.genericName})` : ''} ${m.strength || ''} ${m.type || ''}`.replace(/\s+/g, ' ').trim();
                                const available = ['sales', 'purchase_return'].includes(formData.trxType)
                                  ? getAvailableStock(m.id, undefined, formData.hospitalId)
                                  : null;
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                                    onMouseDown={() => {
                                      handleMedicineChange(index, m.id);
                                      setMedicineQueries((prev) => ({ ...prev, [index]: display }));
                                      setOpenMedicineDropdownIndex(null);
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
                            {availableMedicines.length === 0 && (
                              <div className="px-2 py-2 text-xs text-gray-500">No medicines found</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="lg:col-span-2 space-y-1">
                      <label className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Batch No</label>
                      <input
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px]"
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
                    <div className="lg:col-span-2 space-y-1">
                      <label className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Expiry</label>
                      <input
                        type="date"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px]"
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
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px]"
                        title="Quantity"
                        value={item.qtty}
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
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px]"
                        title="Bonus"
                        value={item.bonus ?? 0}
                        onChange={(e) => handleItemChange(index, { bonus: Number(e.target.value) })}
                      />
                    </div>
                    <div className="lg:col-span-1 space-y-1">
                      <label className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Price</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px]"
                        title="Price"
                        value={item.price}
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
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px]"
                        title="Discount"
                        value={item.discount ?? 0}
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
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px]"
                        title="Tax"
                        value={item.tax ?? 0}
                        onChange={(e) => handleItemChange(index, { tax: Number(e.target.value) })}
                      />
                    </div>
                    <div className="lg:col-span-1 flex items-end">
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">Amount</div>
                      <div className="ml-2 text-[11px] font-semibold text-gray-900 dark:text-white">{calculateLineAmount(item).toFixed(2)}</div>
                    </div>
                    <div className="lg:col-span-1 flex items-end justify-end">
                      <button type="button" onClick={() => removeItemRow(index)} className="p-1 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-200" title="Remove">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
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
