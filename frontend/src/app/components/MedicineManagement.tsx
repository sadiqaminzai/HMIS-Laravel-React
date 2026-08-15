import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Printer, FileSpreadsheet, FileText, Pencil, Pill, Plus, Search, Trash2, X, Upload, Download } from 'lucide-react';
import { DetailModalHeader } from './ui/ModalParts';
import Barcode from 'react-barcode';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { useMedicines } from '../context/MedicineContext';
import { useManufacturers } from '../context/ManufacturerContext';
import { useMedicineTypes } from '../context/MedicineTypeContext';
import { useHospitals } from '../context/HospitalContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Hospital, Medicine, SaleUnit, UserRole } from '../types';

interface MedicineManagementProps {
  hospital: Hospital;
  userRole?: UserRole;
}

type SortField = 'brandName' | 'genericName' | 'medicineType' | 'strength'
  | 'manufacturer' | 'stock' | 'cost' | 'sale' | 'status';

export function MedicineManagement({ hospital, userRole = 'admin' }: MedicineManagementProps) {
  const { t } = useTranslation();
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  const { medicines, addMedicine, updateMedicine, deleteMedicine, generateBarcode, loading } = useMedicines();
  const { manufacturers } = useManufacturers();
  const { medicineTypes } = useMedicineTypes();
  const { hospitals } = useHospitals();
  const { hasPermission } = useAuth();
  const { getDefaultBarcodeType, getDefaultSaleUnit, getBarcodeLabel, getBarcodeScanningEnabled, loadHospitalSetting } = useSettings();
  const barcodeScanningEnabled = getBarcodeScanningEnabled(currentHospital.id);
  const canAdd = hasPermission('add_medicines') || hasPermission('manage_medicines');
  const canEdit = hasPermission('edit_medicines') || hasPermission('manage_medicines');
  const canDelete = hasPermission('delete_medicines') || hasPermission('manage_medicines');
  const canExport = hasPermission('export_medicines') || hasPermission('manage_medicines');
  const canImport = hasPermission('import_medicines') || hasPermission('manage_medicines');
  const canManageBarcodes = hasPermission('manage_medicine_barcodes') || hasPermission('manage_medicines');
  const importInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Batch label printing: which medicines are selected and how many copies each.
  const [selectedForLabels, setSelectedForLabels] = useState<Set<string>>(new Set());
  const [labelCopies, setLabelCopies] = useState(1);

  const [sortField, setSortField] = useState<SortField>('brandName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [formData, setFormData] = useState({
    brandName: '',
    genericName: '',
    strength: '',
    medicineTypeId: '',
    manufacturerId: '',
    stock: 0,
    costPrice: 0,
    salePrice: 0,
    piecesPerStrip: 1,
    stripsPerPack: 1,
    packPrice: 0,
    stripPrice: 0,
    packLabel: '',
    stripLabel: '',
    sellableUnits: ['piece'] as SaleUnit[],
    defaultSaleUnit: 'piece' as SaleUnit,
    barcode: '',
    barcodeType: 'manual' as 'manual' | 'manufacturer' | 'system',
    status: 'active' as 'active' | 'inactive',
    hospitalId: currentHospital.id,
  });

  const scopedMedicines = filterByHospital(medicines);
  const scopedManufacturers = filterByHospital(manufacturers);
  const scopedMedicineTypes = filterByHospital(medicineTypes);

  const getHospitalName = (id: string) => hospitals.find((h) => h.id === id)?.name || 'Unknown';
  const getHospital = (id: string) => hospitals.find((h) => h.id === id);
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
  const getMedicineTypeName = (id: string) => scopedMedicineTypes.find((t) => t.id === id)?.name || 'N/A';
  const getManufacturerName = (id: string) => scopedManufacturers.find((m) => m.id === id)?.name || 'N/A';

  const filteredMedicines = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return scopedMedicines;
    const compactTerm = term.replace(/\s+/g, '');
    return scopedMedicines.filter((m) => {
      const display = `${m.brandName} (${m.genericName || ''}) ${m.strength || ''} ${m.type || ''}`
        .replace(/\s+/g, ' ')
        .toLowerCase();
      const compactDisplay = display.replace(/\s+/g, '');
      const typeName = getMedicineTypeName(m.medicineTypeId).toLowerCase();
      const manufacturer = getManufacturerName(m.manufacturerId).toLowerCase();
      return (
        display.includes(term) ||
        compactDisplay.includes(compactTerm) ||
        typeName.includes(term) ||
        manufacturer.includes(term)
      );
    });
  }, [scopedMedicines, searchTerm, scopedManufacturers, scopedMedicineTypes]);

  const sortedMedicines = useMemo(() => {
    const sortValue = (m: Medicine) => {
      switch (sortField) {
        case 'brandName':
          return m.brandName.toLowerCase();
        case 'genericName':
          return m.genericName.toLowerCase();
        case 'medicineType':
          return getMedicineTypeName(m.medicineTypeId).toLowerCase();
        case 'strength':
          return (m.strength || '').toLowerCase();
        case 'manufacturer':
          return getManufacturerName(m.manufacturerId).toLowerCase();
        // Returned as numbers so the comparator below sorts them numerically --
        // as strings, "100" would sort before "20".
        case 'stock':
          return Number(m.stock ?? 0);
        case 'cost':
          return Number(m.costPrice ?? 0);
        case 'sale':
          return Number(m.salePrice ?? 0);
        case 'status':
          return (m.status || 'active').toLowerCase();
        default:
          return '';
      }
    };
    return [...filteredMedicines].sort((a, b) => {
      const aVal = sortValue(a);
      const bVal = sortValue(b);
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDirection === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filteredMedicines, sortField, sortDirection, scopedMedicineTypes, scopedManufacturers]);

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(sortedMedicines.length / itemsPerPage));

  const paginatedMedicines = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedMedicines.slice(start, start + itemsPerPage);
  }, [sortedMedicines, currentPage]);

  // Rows on the current page that actually have a barcode, i.e. the ones the
  // "select all" checkbox can meaningfully tick for batch label printing.
  const printablePageMedicines = useMemo(
    () => paginatedMedicines.filter((m) => Boolean(m.barcode)),
    [paginatedMedicines]
  );

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedHospitalId]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-60" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 text-blue-600 dark:text-blue-400" />
      : <ArrowDown className="w-3 h-3 text-blue-600 dark:text-blue-400" />;
  };

  const exportToExcel = () => {
    const workSheet = XLSX.utils.json_to_sheet(sortedMedicines.map((m) => ({
      BrandName: m.brandName,
      GenericName: m.genericName,
      Strength: m.strength,
      Type: getMedicineTypeName(m.medicineTypeId),
      Manufacturer: getManufacturerName(m.manufacturerId),
      Stock: m.stock ?? 0,
      CostPrice: m.costPrice ?? 0,
      SalePrice: m.salePrice ?? 0,
      Status: m.status,
      Hospital: getHospitalName(m.hospitalId),
    })));
    const workBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workBook, workSheet, 'Medicines');
    XLSX.writeFile(workBook, 'Medicines_List.xlsx');
  };

  const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

  const readField = (row: Record<string, any>, aliases: string[]) => {
    const map = Object.keys(row).reduce<Record<string, any>>((acc, key) => {
      acc[normalizeKey(key)] = row[key];
      return acc;
    }, {});

    for (const alias of aliases) {
      const value = map[normalizeKey(alias)];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  };

  const resolveImportHospitalId = () => {
    if (userRole === 'super_admin') {
      if (!selectedHospitalId || selectedHospitalId === 'all') {
        toast.error('Please select a specific hospital before importing medicines.');
        return '';
      }
      return selectedHospitalId;
    }
    return currentHospital.id;
  };

  const downloadImportTemplate = () => {
    const templateRows = [
      {
        brand_name: 'Paracetamol',
        generic_name: 'Acetaminophen',
        strength: '500mg',
        medicine_type: 'Tablet',
        manufacturer: 'Acme Pharma',
        stock: 100,
        cost_price: 8,
        sale_price: 12,
        status: 'active',
      },
      {
        brand_name: 'Ibuprofen',
        generic_name: 'Ibuprofen',
        strength: '400mg',
        medicine_type: 'Tablet',
        manufacturer: 'Global Med',
        stock: 50,
        cost_price: 10,
        sale_price: 15,
        status: 'inactive',
      },
    ];
    const sheet = XLSX.utils.json_to_sheet(templateRows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'MedicinesTemplate');
    XLSX.writeFile(book, 'Medicines_Import_Template.xlsx');
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const hospitalId = resolveImportHospitalId();
    if (!hospitalId) return;

    const hospitalTypes = scopedMedicineTypes.filter((t) => t.hospitalId === hospitalId);
    const hospitalManufacturers = scopedManufacturers.filter((m) => m.hospitalId === hospitalId);

    const typeByName = new Map(hospitalTypes.map((t) => [t.name.toLowerCase().trim(), t.id]));
    const manufacturerByName = new Map(hospitalManufacturers.map((m) => [m.name.toLowerCase().trim(), m.id]));

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: '' });

      if (!rows.length) {
        toast.error('Import file is empty.');
        return;
      }

      let success = 0;
      let failed = 0;

      for (const row of rows) {
        const brandName = readField(row, ['brand_name', 'brandname', 'brand']);
        const genericName = readField(row, ['generic_name', 'genericname', 'generic']);
        const strength = readField(row, ['strength']);
        const medicineTypeName = readField(row, ['medicine_type', 'medicinetype', 'type']).toLowerCase();
        const manufacturerName = readField(row, ['manufacturer', 'manufacturer_name']).toLowerCase();
        const stockValue = Number(readField(row, ['stock']) || 0);
        const costPriceValue = Number(readField(row, ['cost_price', 'costprice']) || 0);
        const salePriceValue = Number(readField(row, ['sale_price', 'saleprice']) || 0);
        const statusRaw = readField(row, ['status']);
        const status = statusRaw.toLowerCase() === 'inactive' ? 'inactive' : 'active';

        const medicineTypeId = typeByName.get(medicineTypeName);
        const manufacturerId = manufacturerByName.get(manufacturerName);

        if (!brandName || !medicineTypeId || !manufacturerId) {
          failed++;
          continue;
        }

        try {
          await addMedicine({
            hospitalId,
            brandName,
            genericName,
            strength,
            medicineTypeId,
            manufacturerId,
            stock: Number.isFinite(stockValue) ? stockValue : 0,
            costPrice: Number.isFinite(costPriceValue) ? costPriceValue : 0,
            salePrice: Number.isFinite(salePriceValue) ? salePriceValue : 0,
            status,
          });
          success++;
        } catch {
          failed++;
        }
      }

      if (success > 0) {
        toast.success(`Medicines import completed. Success: ${success}${failed ? `, Failed: ${failed}` : ''}`);
      } else {
        toast.error('No medicines were imported. Check template data, type names, and manufacturer names.');
      }
    } catch {
      toast.error('Failed to read import file. Please upload a valid CSV or XLSX file.');
    }
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
    doc.text('Medicines Report', logoDataUrl ? 34 : 14, headerY);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    if (!isAllHospitals) {
      doc.text(`Hospital: ${currentHospital.name}`, 14, 36);
      doc.text(`Code: ${getHospital(currentHospital.id)?.code || '—'}`, 14, 42);
    }

    autoTable(doc, {
      head: [['Brand', 'Generic', 'Strength', 'Type', 'Manufacturer', 'Stock', 'Cost', 'Sale', 'Status']],
      body: sortedMedicines.map((m) => [
        m.brandName,
        m.genericName,
        m.strength,
        getMedicineTypeName(m.medicineTypeId),
        getManufacturerName(m.manufacturerId),
        m.stock ?? 0,
        m.costPrice ?? 0,
        m.salePrice ?? 0,
        m.status,
      ]),
      startY: isAllHospitals ? 40 : 50,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [66, 139, 202] },
    });

    doc.save('Medicines_Report.pdf');
  };

  const handleAdd = () => {
    const targetHospitalId = userRole === 'super_admin' && selectedHospitalId !== 'all'
      ? selectedHospitalId
      : currentHospital.id;
    setFormData({
      brandName: '',
      genericName: '',
      strength: '',
      medicineTypeId: '',
      manufacturerId: '',
      stock: 0,
      costPrice: 0,
      salePrice: 0,
      piecesPerStrip: 1,
      stripsPerPack: 1,
      packPrice: 0,
      stripPrice: 0,
      packLabel: '',
      stripLabel: '',
      // Start on the hospital's configured selling unit (Settings > Pharmacy).
      sellableUnits: [getDefaultSaleUnit(currentHospital.id) === 'strip'
        ? 'pack'
        : getDefaultSaleUnit(currentHospital.id)] as SaleUnit[],
      defaultSaleUnit: (getDefaultSaleUnit(currentHospital.id) === 'strip'
        ? 'pack'
        : getDefaultSaleUnit(currentHospital.id)) as SaleUnit,
      barcode: '',
      barcodeType: getDefaultBarcodeType(currentHospital.id),
      status: 'active',
      hospitalId: targetHospitalId,
    });
    setShowAddModal(true);
  };

  const handleView = (medicine: Medicine) => {
    setSelectedMedicine(medicine);
    setShowViewModal(true);
  };

  const handleEdit = (medicine: Medicine) => {
    setSelectedMedicine(medicine);
    setFormData({
      brandName: medicine.brandName,
      genericName: medicine.genericName,
      strength: medicine.strength || '',
      medicineTypeId: medicine.medicineTypeId,
      manufacturerId: medicine.manufacturerId,
      stock: medicine.stock ?? 0,
      costPrice: medicine.costPrice ?? 0,
      salePrice: medicine.salePrice ?? 0,
      piecesPerStrip: medicine.piecesPerStrip ?? 1,
      stripsPerPack: medicine.stripsPerPack ?? 1,
      packPrice: medicine.packPrice ?? 0,
      stripPrice: medicine.stripPrice ?? 0,
      packLabel: medicine.packLabel ?? '',
      stripLabel: medicine.stripLabel ?? '',
      sellableUnits: (medicine.sellableUnits ?? ['piece']) as SaleUnit[],
      defaultSaleUnit: (medicine.defaultSaleUnit ?? 'piece') as SaleUnit,
      barcode: medicine.barcode ?? '',
      barcodeType: medicine.barcodeType ?? 'manual',
      status: medicine.status,
      hospitalId: medicine.hospitalId,
    });
    setShowEditModal(true);
  };


  /**
   * Packaging & pricing. The base inventory unit is always the piece; a pack is a
   * conversion ratio on top. "Sold loose" simply pins pack size to 1, which is
   * how every pre-existing medicine already behaves.
   */
  const renderPackagingFields = () => {
    const perStrip = Math.max(1, Number(formData.piecesPerStrip) || 1);
    const stripsPerPack = Math.max(1, Number(formData.stripsPerPack) || 1);
    // Total is always derived, never typed, so the numbers cannot drift apart.
    const totalPieces = perStrip * stripsPerPack;
    // Strip and piece prices are derived from the pack price and stored on save;
    // they are shown here as read-back, not as editable fields.
    const salePrice = Number(formData.salePrice) || 0;
    const derivedStripPrice = salePrice / stripsPerPack;
    const derivedPiecePrice = salePrice / (totalPieces || 1);

    const pieceUnit = getMedicineTypeName(formData.medicineTypeId);
    const pieceName = pieceUnit && pieceUnit !== 'N/A' ? pieceUnit : t('ui.pieces');
    const stripName = t('ui.strip');
    const packName = t('ui.pack');

    // Pack is always offerable; strip needs a genuine middle tier.
    const available: SaleUnit[] = ['piece', 'pack'];
    if (perStrip > 1) available.push('strip');

    const unitLabel = (u: SaleUnit) => (u === 'pack' ? packName : u === 'strip' ? stripName : pieceName);
    const preferred = getDefaultSaleUnit(currentHospital.id) as SaleUnit;
    const largest = (units: SaleUnit[]): SaleUnit =>
      (units.includes(preferred) ? preferred : undefined)
      || (['pack', 'strip', 'piece'] as SaleUnit[]).find((u) => units.includes(u))
      || 'piece';

    const toggleUnit = (u: SaleUnit) => {
      const next = formData.sellableUnits.includes(u)
        ? formData.sellableUnits.filter((x) => x !== u)
        : [...formData.sellableUnits, u];
      const cleaned = (next.length ? next : ['pack']) as SaleUnit[];
      setFormData({
        ...formData,
        sellableUnits: cleaned,
        // The default is simply the largest unit still selected -- no extra field.
        defaultSaleUnit: cleaned.includes(formData.defaultSaleUnit) ? formData.defaultSaleUnit : largest(cleaned),
      });
    };

    const applyCounts = (nextPerStrip: number, nextStrips: number) => {
      const ps = Math.max(1, nextPerStrip);
      const sp = Math.max(1, nextStrips);
      const nowAvailable: SaleUnit[] = ['piece', 'pack'];
      if (ps > 1) nowAvailable.push('strip');

      let units = formData.sellableUnits.filter((u) => nowAvailable.includes(u)) as SaleUnit[];
      if (!units.length) units = [largest(nowAvailable)];

      setFormData({
        ...formData,
        piecesPerStrip: ps,
        stripsPerPack: sp,
        sellableUnits: units,
        defaultSaleUnit: units.includes(formData.defaultSaleUnit) ? formData.defaultSaleUnit : largest(units),
      });
    };

    return (
      <div className="w-full rounded-md border border-gray-200 dark:border-gray-700 p-2 bg-gray-50/60 dark:bg-gray-900/30">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">{t('ui.packaging')}</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            {totalPieces > 1
              ? `1 ${packName} = ${stripsPerPack} ${stripName} × ${perStrip} = ${totalPieces} ${pieceName}`
                + (salePrice > 0
                    ? `  ·  ${stripName} ${derivedStripPrice.toFixed(2)}  ·  ${pieceName} ${derivedPiecePrice.toFixed(2)}`
                    : '')
              : ''}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
          <div>
            <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.piecesPerStrip')}</label>
            <input
              type="number" min={1} step={1}
              title={t('ui.piecesPerStrip')}
              value={formData.piecesPerStrip}
              onChange={(e) => applyCounts(Number(e.target.value) || 1, stripsPerPack)}
              className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.stripsPerPack')}</label>
            <input
              type="number" min={1} step={1}
              title={t('ui.stripsPerPack')}
              value={formData.stripsPerPack}
              onChange={(e) => applyCounts(perStrip, Number(e.target.value) || 1)}
              className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.totalPieces')}</label>
            <input
              type="number" readOnly disabled value={totalPieces} title={t('ui.totalPieces')}
              className="w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs opacity-70"
            />
          </div>
          {/* Sell-by sits on the same row as the counts now that Status has
              moved up to the product identity row. */}
          <div className="col-span-2 md:col-span-1">
            <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.sellableUnits')}</label>
            <div className="flex flex-wrap items-center gap-1.5">
            {(['pack', 'strip', 'piece'] as SaleUnit[]).map((u) => {
              const enabled = available.includes(u);
              const on = formData.sellableUnits.includes(u);
              return (
                <button
                  key={u}
                  type="button"
                  disabled={!enabled}
                  onClick={() => toggleUnit(u)}
                  title={enabled ? unitLabel(u) : t('ui.unitNotAvailable')}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors ${
                    !enabled
                      ? 'opacity-40 border-gray-300 dark:border-gray-600 cursor-not-allowed'
                      : on
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {unitLabel(u)}
                </button>
              );
            })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Stock is always HELD in pieces (the smallest sellable unit) so that partial
   * sales stay exact. This renders it in the unit the pharmacist actually thinks
   * in, with the precise piece count kept as the secondary line.
   */
  const formatStock = (med: Medicine) => {
    const pieces = Number(med.stock ?? 0);
    const perStrip = Math.max(1, Number(med.piecesPerStrip ?? 1));
    const totalPieces = Math.max(1, Number(med.packSize ?? 1));
    const pieceUnit = getMedicineTypeName(med.medicineTypeId);
    const pieceName = pieceUnit !== 'N/A' ? pieceUnit : t('ui.pieces');

    if (totalPieces <= 1 && perStrip <= 1) {
      return { primary: `${pieces} ${pieceName}`, secondary: '' };
    }

    const parts: string[] = [];
    let rest = pieces;
    if (totalPieces > 1) {
      const packs = Math.floor(rest / totalPieces);
      rest %= totalPieces;
      if (packs > 0) parts.push(`${packs} ${t('ui.pack')}`);
    }
    if (perStrip > 1) {
      const strips = Math.floor(rest / perStrip);
      rest %= perStrip;
      if (strips > 0) parts.push(`${strips} ${t('ui.strip')}`);
    }
    if (rest > 0) parts.push(`${rest} ${pieceName}`);

    return {
      primary: parts.length ? parts.join(' + ') : `0 ${pieceName}`,
      secondary: `${pieces} ${pieceName}`,
    };
  };

  const toggleLabelSelection = (id: string) => {
    setSelectedForLabels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  /** Shared label markup, sized from Settings > Barcodes. */
  /**
   * Shelf label: bars plus the human-readable number only. Name, formula and
   * strength are deliberately omitted -- the label is stamped onto packaging
   * that already carries them, and a smaller label fits more products.
   */
  const buildLabelHtml = (medicine: Medicine, svg: string) => `
      <div class="label">
        ${svg}
        <div class="code">${medicine.barcode}</div>
      </div>`;

  const labelStyles = (widthMm: number, heightMm: number) => `
    @page { size: ${widthMm}mm ${heightMm}mm; margin: 1mm; }
    body { margin:0; font-family: Arial, Helvetica, sans-serif; text-align:center; }
    .label { width:${widthMm - 2}mm; height:${heightMm - 2}mm; padding:1mm 0;
             page-break-after: always; box-sizing: border-box; overflow: hidden; }
    .label:last-child { page-break-after: auto; }
    .label { display:flex; flex-direction:column; align-items:center; justify-content:center; }
    svg { max-width:${widthMm - 4}mm; max-height:${heightMm - 6}mm; height:auto; }
    .code { font-size:7pt; letter-spacing:0.5px; margin-top:0.3mm; word-break:break-all;
            max-width:${widthMm - 4}mm; line-height:1.1; }`;

  const openLabelWindow = (inner: string, widthMm: number, heightMm: number, title: string) => {
    const win = window.open('', '_blank', 'width=520,height=420');
    if (!win) {
      toast.error(t('ui.popupBlocked'));
      return;
    }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>` +
      `<style>${labelStyles(widthMm, heightMm)}</style></head>` +
      `<body onload="window.print(); setTimeout(function(){window.close();}, 400);">${inner}</body></html>`);
    win.document.close();
  };

  /**
   * Print one label for a single medicine. The barcode SVG is rendered by
   * react-barcode in a hidden node and copied into the print window.
   */
  const printBarcodeLabel = (medicine: Medicine) => {
    if (!medicine.barcode) {
      toast.error(t('ui.noBarcodeToPrint'));
      return;
    }
    // The barcode is rendered under a different id depending on where Print
    // Label was pressed -- the edit form, the view modal, or a batch row. The
    // view modal's id was missing, so printing from there always failed.
    const svg = document.getElementById(`barcode-svg-${medicine.id}`)?.innerHTML
      || document.getElementById(`view-barcode-${medicine.id}`)?.innerHTML
      || document.getElementById(`barcode-svg-new`)?.innerHTML
      || document.getElementById(`batch-barcode-${medicine.id}`)?.innerHTML;
    if (!svg) {
      toast.error(t('ui.noBarcodeToPrint'));
      return;
    }
    const label = getBarcodeLabel(medicine.hospitalId || currentHospital.id);
    // One label per unit received, e.g. 50 boxes -> 50 stickers.
    const answer = window.prompt(t('ui.howManyLabels'), String(Math.max(1, Number(labelCopies) || 1)));
    if (answer === null) return;
    const copies = Math.min(500, Math.max(1, Number(answer) || 1));
    openLabelWindow(buildLabelHtml(medicine, svg).repeat(copies), label.widthMm, label.heightMm, medicine.brandName);
  };

  /**
   * Batch print: every selected medicine, repeated `labelCopies` times, in one
   * job so a roll-fed barcode printer runs straight through.
   */
  const printSelectedLabels = () => {
    const chosen = sortedMedicines.filter((m) => selectedForLabels.has(m.id) && m.barcode);
    if (!chosen.length) {
      toast.error(t('ui.noBarcodeToPrint'));
      return;
    }
    const copies = Math.max(1, Number(labelCopies) || 1);
    const label = getBarcodeLabel(currentHospital.id);

    let inner = '';
    let rendered = 0;
    chosen.forEach((m) => {
      const svg = document.getElementById(`batch-barcode-${m.id}`)?.innerHTML;
      if (!svg) return;
      for (let i = 0; i < copies; i++) inner += buildLabelHtml(m, svg);
      rendered += 1;
    });

    if (!rendered) {
      toast.error(t('ui.noBarcodeToPrint'));
      return;
    }
    openLabelWindow(inner, label.widthMm, label.heightMm, `${rendered} labels`);
  };

  const handleGenerateBarcode = async () => {
    if (!selectedMedicine?.id) {
      toast.error(t('ui.saveMedicineFirst'));
      return;
    }
    try {
      const updated = await generateBarcode(selectedMedicine.id);
      setFormData((prev) => ({ ...prev, barcode: updated.barcode || '', barcodeType: 'system' }));
      setSelectedMedicine(updated);
      toast.success(t('ui.barcodeGenerated'));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('ui.barcodeGenerateFailed'));
    }
  };

  /** Barcode type, value, generate + print. Shared by the Add and Edit modals. */
  const renderBarcodeFields = () => (
    !barcodeScanningEnabled ? null :
    <div className="w-full rounded-md border border-gray-200 dark:border-gray-700 p-2 bg-gray-50/60 dark:bg-gray-900/30">
      <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t('ui.barcode')}</p>
      {/* One row: a dropdown only as wide as its longest option, the value
          taking the remaining space, and the preview pushed to the right end. */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="shrink-0">
          <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.barcodeType')}</label>
          <select
            className="w-auto px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs disabled:opacity-60"
            title={t('ui.barcodeType')}
            disabled={!canManageBarcodes}
            value={formData.barcodeType}
            onChange={(e) => setFormData({ ...formData, barcodeType: e.target.value as typeof formData.barcodeType })}
          >
            <option value="manual">{t('ui.barcodeManual')}</option>
            <option value="manufacturer">{t('ui.barcodeManufacturer')}</option>
            <option value="system">{t('ui.barcodeSystem')}</option>
          </select>
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.barcodeValue')}</label>
          <input
            type="text"
            autoFocus={formData.barcodeType === 'manufacturer'}
            placeholder={formData.barcodeType === 'manufacturer' ? t('ui.scanBarcode') : t('ui.scanOrType')}
            readOnly={formData.barcodeType === 'system'}
            disabled={!canManageBarcodes || formData.barcodeType === 'system'}
            title={t('ui.barcodeValue')}
            value={formData.barcode}
            // Scanners type fast then press Enter. Selecting the existing text on
            // focus (and on Enter) means a second scan overwrites the first rather
            // than concatenating onto it.
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.select();
              }
            }}
            onChange={(e) => setFormData({ ...formData, barcode: e.target.value.trim() })}
            className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs disabled:opacity-60"
          />
        </div>
        <div className="flex items-end gap-2 shrink-0">
          {canManageBarcodes && formData.barcodeType === 'system' && (
            <button
              type="button"
              onClick={handleGenerateBarcode}
              className="px-2.5 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
            >
              {t('ui.generate')}
            </button>
          )}
          {/* The rendered barcode sits between the two actions: it is the
              result of Generate and the subject of Print, so it belongs
              between them rather than on a line of its own. */}
          {formData.barcode && (
            <div className="bg-white rounded px-1 overflow-hidden flex items-center">
              <div
                id={`barcode-svg-${selectedMedicine?.id ?? 'new'}`}
                className="[&>svg]:max-w-none [&>svg]:h-8"
              >
                <Barcode
                  value={formData.barcode}
                  height={28}
                  width={formData.barcode.length > 24 ? 0.7 : 1.1}
                  fontSize={8}
                  margin={0}
                />
              </div>
            </div>
          )}
          {formData.barcode && selectedMedicine && (
            <button
              type="button"
              onClick={() => printBarcodeLabel({ ...selectedMedicine, ...formData } as Medicine)}
              className="px-2.5 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-xs font-medium"
            >
              {t('ui.print')}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const handleDelete = (medicine: Medicine) => {
    setSelectedMedicine(medicine);
    setShowDeleteModal(true);
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.brandName.trim()) {
      toast.error('Brand name is required');
      return;
    }
    setSubmitting(true);
    try {
      await addMedicine({
        hospitalId: formData.hospitalId,
        brandName: formData.brandName,
        genericName: formData.genericName,
        strength: formData.strength,
        medicineTypeId: formData.medicineTypeId,
        manufacturerId: formData.manufacturerId,
        stock: 0,
        costPrice: formData.costPrice,
        salePrice: formData.salePrice,
        piecesPerStrip: Math.max(1, Number(formData.piecesPerStrip) || 1),
        stripsPerPack: Math.max(1, Number(formData.stripsPerPack) || 1),
        packPrice: Number(formData.packPrice) || 0,
        // Derived from the pack price so the tiers can never disagree.
        // Rounded to two decimals: an unrounded division produces values like
        // 64.285714285 that a currency field cannot hold or display.
        stripPrice: Math.max(1, Number(formData.stripsPerPack) || 1) > 1
          ? Math.round(((Number(formData.salePrice) || 0) / Math.max(1, Number(formData.stripsPerPack) || 1)) * 100) / 100
          : 0,
        stripLabel: formData.stripLabel,
        sellableUnits: formData.sellableUnits,
        defaultSaleUnit: formData.defaultSaleUnit,
        packLabel: formData.packLabel,
        barcode: formData.barcode,
        barcodeType: formData.barcodeType,
        status: formData.status,
      });
      setShowAddModal(false);
      toast.success('Medicine added successfully.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add medicine');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedicine) return;
    if (!formData.brandName.trim()) {
      toast.error('Brand name is required');
      return;
    }
    setSubmitting(true);
    try {
      await updateMedicine({
        id: selectedMedicine.id,
        hospitalId: formData.hospitalId,
        brandName: formData.brandName,
        genericName: formData.genericName,
        strength: formData.strength,
        medicineTypeId: formData.medicineTypeId,
        manufacturerId: formData.manufacturerId,
        stock: selectedMedicine.stock ?? 0,
        costPrice: formData.costPrice,
        salePrice: formData.salePrice,
        piecesPerStrip: Math.max(1, Number(formData.piecesPerStrip) || 1),
        stripsPerPack: Math.max(1, Number(formData.stripsPerPack) || 1),
        packPrice: Number(formData.packPrice) || 0,
        // Derived from the pack price so the tiers can never disagree.
        // Rounded to two decimals: an unrounded division produces values like
        // 64.285714285 that a currency field cannot hold or display.
        stripPrice: Math.max(1, Number(formData.stripsPerPack) || 1) > 1
          ? Math.round(((Number(formData.salePrice) || 0) / Math.max(1, Number(formData.stripsPerPack) || 1)) * 100) / 100
          : 0,
        stripLabel: formData.stripLabel,
        sellableUnits: formData.sellableUnits,
        defaultSaleUnit: formData.defaultSaleUnit,
        packLabel: formData.packLabel,
        barcode: formData.barcode,
        barcodeType: formData.barcodeType,
        status: formData.status,
      });
      setShowEditModal(false);
      toast.success('Medicine updated successfully.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update medicine');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedMedicine) return;
    try {
      await deleteMedicine(selectedMedicine.id);
      setShowDeleteModal(false);
      toast.success('Medicine deleted successfully.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete medicine');
    }
  };

  const hospitalSpecificTypes = scopedMedicineTypes.filter((t) => t.hospitalId === formData.hospitalId && t.status === 'active');
  const hospitalSpecificManufacturers = scopedManufacturers.filter((m) => m.hospitalId === formData.hospitalId);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Medicine Management</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">Manage medicine inventory for {isAllHospitals ? 'All Hospitals' : currentHospital.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search medicines..."
              className="w-48 pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
            {canManageBarcodes && selectedForLabels.size > 0 && (
              <div className="flex items-center gap-1.5 pr-1.5 mr-1 border-r border-gray-300 dark:border-gray-600">
                <label className="text-[10px] text-gray-600 dark:text-gray-300">{t('ui.copies')}</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  title={t('ui.copies')}
                  value={labelCopies}
                  onChange={(e) => setLabelCopies(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                  className="w-12 px-1.5 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs"
                />
                <button
                  onClick={printSelectedLabels}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-xs font-medium shadow-sm"
                  title={t('ui.printLabels')}
                >
                  <Printer className="w-3.5 h-3.5" />
                  {t('ui.printLabels')} ({selectedForLabels.size})
                </button>
              </div>
            )}
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
          {canImport && (
            <>
              <button
                onClick={downloadImportTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors text-xs font-medium shadow-sm"
                title={t('ui.downloadImportTemplate')}
              >
                <Download className="w-3.5 h-3.5" />{t('ui.template')}</button>
              <button
                onClick={() => importInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-md hover:bg-violet-700 transition-colors text-xs font-medium shadow-sm"
                title="Import medicines"
              >
                <Upload className="w-3.5 h-3.5" />{t('ui.import')}</button>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                title="Import medicines file"
                onChange={handleImportFile}
                className="hidden"
              />
            </>
          )}
          {canAdd && (
            <button onClick={handleAdd} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium shadow-sm">
              <Plus className="w-3.5 h-3.5" />{t('ui.add')}</button>
          )}
        </div>
      </div>

      {/* Off-screen barcodes for the selected medicines; printSelectedLabels
          copies their SVG into the print window. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-0 bg-white">
        {sortedMedicines
          .filter((m) => selectedForLabels.has(m.id) && m.barcode)
          .map((m) => (
            <div key={m.id} id={`batch-barcode-${m.id}`}>
              <Barcode value={m.barcode as string} height={34} width={1.3} fontSize={11} margin={0} />
            </div>
          ))}
      </div>

      <HospitalSelector userRole={userRole} selectedHospitalId={selectedHospitalId} onHospitalChange={setSelectedHospitalId} />

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="overflow-x-auto rounded-t-lg max-h-[calc(100vh-220px)] overflow-y-auto">
          <table className="w-full text-left border-collapse relative">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
              <tr>
                {canManageBarcodes && (
                  <th className="px-3 py-2.5 w-8">
                    <input
                      type="checkbox"
                      title={t('ui.selectAllForLabels')}
                      aria-label={t('ui.selectAllForLabels')}
                      className="h-3.5 w-3.5"
                      checked={printablePageMedicines.length > 0 && printablePageMedicines.every((m) => selectedForLabels.has(m.id))}
                      onChange={(e) => {
                        setSelectedForLabels((prev) => {
                          const next = new Set(prev);
                          printablePageMedicines.forEach((m) => e.target.checked ? next.add(m.id) : next.delete(m.id));
                          return next;
                        });
                      }}
                    />
                  </th>
                )}
                <th onClick={() => handleSort('brandName')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">Brand Name {renderSortIcon('brandName')}</div>
                </th>
                <th onClick={() => handleSort('genericName')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">Generic Name {renderSortIcon('genericName')}</div>
                </th>
                <th onClick={() => handleSort('strength')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">Strength {renderSortIcon('strength')}</div>
                </th>
                <th onClick={() => handleSort('medicineType')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">Type {renderSortIcon('medicineType')}</div>
                </th>
                <th onClick={() => handleSort('manufacturer')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">{t('table.manufacturer')} {renderSortIcon('manufacturer')}</div>
                </th>
                <th onClick={() => handleSort('stock')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">{t('table.stock')} {renderSortIcon('stock')}</div>
                </th>
                <th onClick={() => handleSort('cost')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">{t('table.cost')} {renderSortIcon('cost')}</div>
                </th>
                <th onClick={() => handleSort('sale')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">{t('table.sale')} {renderSortIcon('sale')}</div>
                </th>
                <th onClick={() => handleSort('status')} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-1.5">{t('table.status')} {renderSortIcon('status')}</div>
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-center">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedMedicines.length > 0 ? (
                paginatedMedicines.map((medicine) => (
                  <tr key={medicine.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                    {canManageBarcodes && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 disabled:opacity-40"
                          // Only medicines that actually carry a barcode can be printed.
                          disabled={!medicine.barcode}
                          title={medicine.barcode ? t('ui.selectForLabel') : t('ui.noBarcode')}
                          aria-label={t('ui.selectForLabel')}
                          checked={selectedForLabels.has(medicine.id)}
                          onChange={() => toggleLabelSelection(medicine.id)}
                        />
                      </td>
                    )}
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-md flex items-center justify-center border border-green-200 dark:border-green-800">
                          <Pill className="w-3 h-3 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-xs font-semibold text-gray-900 dark:text-white">{medicine.brandName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{medicine.genericName}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{medicine.strength || '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{getMedicineTypeName(medicine.medicineTypeId)}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{getManufacturerName(medicine.manufacturerId)}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">
                      {(() => {
                        const st = formatStock(medicine);
                        return (
                          <div className="leading-tight">
                            <span className="font-medium text-gray-900 dark:text-gray-100">{st.primary}</span>
                            {st.secondary && (
                              <span className="block text-[10px] text-gray-500 dark:text-gray-400">{st.secondary}</span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{medicine.costPrice ?? 0}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{medicine.salePrice ?? 0}</td>
                    <td className="px-4 py-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${medicine.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200'
                      }`}>
                        {medicine.status === 'active' ? t('ui.active') : t('ui.inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleView(medicine)} className="p-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-200" title={t('ui.view')}>
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button onClick={() => handleEdit(medicine)} className="p-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-200" title={t('ui.edit')}>
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(medicine)} className="p-1.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-200" title={t('ui.delete')}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    {loading ? 'Loading medicines...' : 'No medicines found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span>
            Showing <strong>{paginatedMedicines.length}</strong> of <strong>{sortedMedicines.length}</strong> medicines {isAllHospitals ? '(all hospitals)' : `for ${currentHospital.name}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >{t('ui.prev')}</button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >{t('ui.next')}</button>
          </div>
        </div>
      </div>

      {/* View Modal */}
      <div className={`fixed inset-0 z-50 ${showViewModal ? 'flex' : 'hidden'} items-center justify-center bg-black/50 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-5xl border border-gray-200 dark:border-gray-700">
          <DetailModalHeader
            title="Medicine Details"
            icon={<Pill className="w-4 h-4" />}
            gradient="from-slate-700 to-slate-800"
            onClose={() => setShowViewModal(false)}
          />
          <div className="p-3 space-y-2.5 max-h-[85vh] overflow-y-auto overflow-x-hidden">
            {selectedMedicine && (() => {
              const med = selectedMedicine;
              const perStrip = Math.max(1, Number(med.piecesPerStrip ?? 1));
              const stripsPerPack = Math.max(1, Number(med.stripsPerPack ?? 1));
              const totalPieces = Math.max(1, Number(med.packSize ?? 1));
              const sale = Number(med.salePrice ?? 0);
              const pieceUnit = getMedicineTypeName(med.medicineTypeId);
              const pieceName = pieceUnit !== 'N/A' ? pieceUnit : t('ui.pieces');
              const stock = Number(med.stock ?? 0);

              const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
                <div className="flex items-start justify-between gap-3 py-1 border-b border-gray-100 dark:border-gray-700/60 last:border-0">
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
                  {/* min-w-0 + break-all keeps a long QR payload inside the modal
                      instead of forcing a horizontal scrollbar. */}
                  <span className="text-xs font-semibold text-gray-900 dark:text-white text-right min-w-0 break-all">
                    {value ?? '—'}
                  </span>
                </div>
              );

              const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
                <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <p className="px-2.5 py-1 bg-gray-50 dark:bg-gray-700/40 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                    {title}
                  </p>
                  <div className="px-2.5 py-1">{children}</div>
                </div>
              );

              /* The three numbers a pharmacist checks first, pulled out of the
                 detail rows so they are readable at a glance. */
              const Stat = ({ label, value, sub: caption, tone }: {
                label: string; value: string; sub?: string; tone: string;
              }) => (
                <div className={`rounded-md border px-2.5 py-1.5 ${tone}`}>
                  <p className="text-[9px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
                  <p className="text-base font-bold leading-tight">{value}</p>
                  {caption && <p className="text-[10px] opacity-70 leading-tight">{caption}</p>}
                </div>
              );

              // Stock read back in the tiers the pharmacist actually thinks in.
              const st = formatStock(med);
              const stockBreakdown = () => st.secondary ? `${st.primary}  (${st.secondary})` : st.primary;

              return (
                <>
                  {/* Header card */}
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg p-3 border border-emerald-100 dark:border-emerald-800">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">
                          {med.brandName} {med.strength ? <span className="font-medium text-gray-600 dark:text-gray-300">{med.strength}</span> : null}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {med.genericName || '—'} · {pieceName} · {getManufacturerName(med.manufacturerId)}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${med.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200'
                      }`}>
                        {med.status === 'active' ? t('ui.active') : t('ui.inactive')}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Stat
                      label={t('ui.stock')}
                      value={st.primary}
                      sub={st.secondary}
                      tone={stock > 0
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-200'
                        : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-200'}
                    />
                    <Stat
                      label={t('ui.costPrice')}
                      value={Number(med.costPrice ?? 0).toFixed(2)}
                      tone="bg-gray-50 border-gray-200 text-gray-800 dark:bg-gray-700/40 dark:border-gray-600 dark:text-gray-100"
                    />
                    <Stat
                      label={t('ui.salePrice')}
                      value={sale.toFixed(2)}
                      sub={totalPieces > 1 ? `${pieceName} ${(sale / totalPieces).toFixed(2)}` : undefined}
                      tone="bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200"
                    />
                    <Stat
                      label={t('ui.retailPrice')}
                      value={med.packPrice ? Number(med.packPrice).toFixed(2) : '—'}
                      tone="bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
                    <Section title={t('ui.packaging')}>
                      <Row label={t('ui.piecesPerStrip')} value={perStrip} />
                      <Row label={t('ui.stripsPerPack')} value={stripsPerPack} />
                      <Row label={t('ui.totalPieces')} value={totalPieces} />
                      <Row label={t('ui.sellableUnits')} value={(med.sellableUnits ?? ['piece']).map((u) => u === 'pack' ? t('ui.pack') : u === 'strip' ? t('ui.strip') : pieceName).join(', ')} />
                      <Row label={t('ui.stock')} value={stockBreakdown()} />
                      {stripsPerPack > 1 && <Row label={t('ui.stripPrice')} value={(sale / stripsPerPack).toFixed(2)} />}
                      {totalPieces > 1 && <Row label={`${pieceName} ${t('ui.price')}`} value={(sale / totalPieces).toFixed(2)} />}
                    </Section>


                  {barcodeScanningEnabled && (
                    <Section title={t('ui.barcode')}>
                      {med.barcode ? (
                        <>
                          <Row label={t('ui.barcodeType')} value={
                            med.barcodeType === 'system' ? t('ui.barcodeSystem')
                              : med.barcodeType === 'manufacturer' ? t('ui.barcodeManufacturer')
                              : t('ui.barcodeManual')} />
                          <Row label={t('ui.barcodeValue')} value={<span className="break-all">{med.barcode}</span>} />
                          <div className="mt-2 flex items-center justify-between gap-2 bg-white rounded p-2 overflow-hidden">
                            <div
                              id={`view-barcode-${med.id}`}
                              className="origin-top scale-[0.5] sm:scale-[0.65] [&>svg]:max-w-none"
                            >
                              <Barcode
                                value={med.barcode}
                                height={38}
                                width={med.barcode.length > 24 ? 0.9 : 1.3}
                                fontSize={9}
                                margin={0}
                              />
                            </div>
                            {canManageBarcodes && (
                              <button
                                type="button"
                                onClick={() => printBarcodeLabel(med)}
                                className="px-2.5 py-1 rounded-md border border-gray-300 text-[10px] font-medium text-gray-700"
                              >
                                {t('ui.printLabel')}
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('ui.noBarcodeToPrint')}</p>
                      )}
                    </Section>
                  )}
                  </div>

                  <Section title={t('ui.recordInfo')}>
                    {/* Created and updated are each one event: who did it and
                        when, kept side by side. The previous grid filled by
                        column, which split each pair across the modal. */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-1">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-0.5">
                          {t('ui.hospital')}
                        </p>
                        <p className="text-xs font-medium text-gray-900 dark:text-white">{getHospitalName(med.hospitalId)}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">{pieceName}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-0.5">
                          {t('ui.createdBy')}
                        </p>
                        <p className="text-xs font-medium text-gray-900 dark:text-white">{med.createdBy || '—'}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          {med.createdAt ? new Date(med.createdAt).toLocaleString() : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-0.5">
                          {t('ui.updatedBy')}
                        </p>
                        <p className="text-xs font-medium text-gray-900 dark:text-white">{med.updatedBy || '—'}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          {med.updatedAt ? new Date(med.updatedAt).toLocaleString() : '—'}
                        </p>
                      </div>
                    </div>
                  </Section>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      <div className={`fixed inset-0 z-50 ${showAddModal ? 'flex' : 'hidden'} items-center justify-center bg-black/50 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-5xl border border-gray-200 dark:border-gray-700">
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">{t('ui.addMedicine')}</h2>
            <button type="button" onClick={() => setShowAddModal(false)} aria-label={t('ui.close')} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form className="p-3 space-y-2 max-h-[85vh] overflow-y-auto" onSubmit={handleSubmitAdd}>
            {/* Row 1: what the product is called. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.brandName')}<span className="text-red-500">*</span></label>
                <input
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title={t('ui.brandName')}
                  value={formData.brandName}
                  onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.genericName')}</label>
                <input
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title={t('ui.genericName')}
                  value={formData.genericName}
                  onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.strength')}</label>
                <input
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title={t('ui.strength')}
                  value={formData.strength}
                  onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                />
              </div>
            </div>

            {/* Row 2: the three prices, side by side for comparison. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.costPrice')}{Number(formData.stripsPerPack) > 1 || Number(formData.piecesPerStrip) > 1 ? ` (${formData.packLabel || t('ui.pack')})` : ''}</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title={t('ui.costPrice')}
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.salePrice')}{Number(formData.stripsPerPack) > 1 || Number(formData.piecesPerStrip) > 1 ? ` (${formData.packLabel || t('ui.pack')})` : ''}</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title={t('ui.salePrice')}
                  value={formData.salePrice}
                  onChange={(e) => setFormData({ ...formData, salePrice: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.retailPrice')}</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title={t('ui.retailPrice')}
                  value={formData.packPrice}
                  onChange={(e) => setFormData({ ...formData, packPrice: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* Row 3: classification, plus the two read-only-ish controls. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.type')}</label>
                <select
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title="Medicine Type"
                  value={formData.medicineTypeId}
                  onChange={(e) => setFormData({ ...formData, medicineTypeId: e.target.value })}
                  required
                >
                  <option value="">{t('ui.selectType')}</option>
                  {hospitalSpecificTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.manufacturer')}</label>
                <select
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title={t('ui.manufacturer')}
                  value={formData.manufacturerId}
                  onChange={(e) => setFormData({ ...formData, manufacturerId: e.target.value })}
                >
                  <option value="">Select manufacturer</option>
                  {hospitalSpecificManufacturers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              {/* Stock is derived from transactions and can never be typed, so it
                  is shown as a read-back value rather than a disabled input that
                  invites editing. That frees half the column for Status. */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.stock')}</label>
                  <div
                    title="Stock is managed by purchase and sales transactions"
                    className="w-full px-2 py-1.5 rounded border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40 text-xs font-semibold text-gray-700 dark:text-gray-200 truncate"
                  >
                    {formData.stock || 0}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.status')}</label>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.status === 'active'}
                    onClick={() => setFormData({ ...formData, status: formData.status === 'active' ? 'inactive' : 'active' })}
                    className={`w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded border text-xs transition-colors ${
                      formData.status === 'active'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300'
                        : 'bg-gray-100 border-gray-300 text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <span className="truncate">{formData.status === 'active' ? t('ui.active') : t('ui.inactive')}</span>
                    <span className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors ${
                      formData.status === 'active' ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}>
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                        formData.status === 'active' ? 'translate-x-4' : 'translate-x-0.5'
                      }`} />
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">

              {renderPackagingFields()}
              {renderBarcodeFields()}
              {userRole === 'super_admin' && (
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.hospital')}</label>
                  <select
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
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
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs">{t('ui.cancel')}</button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-xs disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? t('ui.saving') : t('ui.save')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Edit Modal */}
      <div className={`fixed inset-0 z-50 ${showEditModal ? 'flex' : 'hidden'} items-center justify-center bg-black/50 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-5xl border border-gray-200 dark:border-gray-700">
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">{t('ui.editMedicine')}</h2>
            <button type="button" onClick={() => setShowEditModal(false)} aria-label={t('ui.close')} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form className="p-3 space-y-2 max-h-[85vh] overflow-y-auto" onSubmit={handleSubmitEdit}>
            {/* Row 1: what the product is called. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.brandName')}<span className="text-red-500">*</span></label>
                <input
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title={t('ui.brandName')}
                  value={formData.brandName}
                  onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.genericName')}</label>
                <input
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title={t('ui.genericName')}
                  value={formData.genericName}
                  onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.strength')}</label>
                <input
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title={t('ui.strength')}
                  value={formData.strength}
                  onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                />
              </div>
            </div>

            {/* Row 2: the three prices, side by side for comparison. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.costPrice')}{Number(formData.stripsPerPack) > 1 || Number(formData.piecesPerStrip) > 1 ? ` (${formData.packLabel || t('ui.pack')})` : ''}</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title={t('ui.costPrice')}
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.salePrice')}{Number(formData.stripsPerPack) > 1 || Number(formData.piecesPerStrip) > 1 ? ` (${formData.packLabel || t('ui.pack')})` : ''}</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title={t('ui.salePrice')}
                  value={formData.salePrice}
                  onChange={(e) => setFormData({ ...formData, salePrice: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.retailPrice')}</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title={t('ui.retailPrice')}
                  value={formData.packPrice}
                  onChange={(e) => setFormData({ ...formData, packPrice: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* Row 3: classification, plus the two read-only-ish controls. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.type')}</label>
                <select
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title="Medicine Type"
                  value={formData.medicineTypeId}
                  onChange={(e) => setFormData({ ...formData, medicineTypeId: e.target.value })}
                  required
                >
                  <option value="">{t('ui.selectType')}</option>
                  {hospitalSpecificTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.manufacturer')}</label>
                <select
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
                  title={t('ui.manufacturer')}
                  value={formData.manufacturerId}
                  onChange={(e) => setFormData({ ...formData, manufacturerId: e.target.value })}
                >
                  <option value="">Select manufacturer</option>
                  {hospitalSpecificManufacturers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              {/* Stock is derived from transactions and can never be typed, so it
                  is shown as a read-back value rather than a disabled input that
                  invites editing. That frees half the column for Status. */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.stock')}</label>
                  <div
                    title="Stock is managed by purchase and sales transactions"
                    className="w-full px-2 py-1.5 rounded border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40 text-xs font-semibold text-gray-700 dark:text-gray-200 truncate"
                  >
                    {formData.stock || 0}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.status')}</label>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.status === 'active'}
                    onClick={() => setFormData({ ...formData, status: formData.status === 'active' ? 'inactive' : 'active' })}
                    className={`w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded border text-xs transition-colors ${
                      formData.status === 'active'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300'
                        : 'bg-gray-100 border-gray-300 text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <span className="truncate">{formData.status === 'active' ? t('ui.active') : t('ui.inactive')}</span>
                    <span className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors ${
                      formData.status === 'active' ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}>
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                        formData.status === 'active' ? 'translate-x-4' : 'translate-x-0.5'
                      }`} />
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">

              {renderPackagingFields()}
              {renderBarcodeFields()}
              {userRole === 'super_admin' && (
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">{t('ui.hospital')}</label>
                  <select
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
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
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs">{t('ui.cancel')}</button>
              <button
                type="submit"
                disabled={submitting}
                className="px-3 py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? t('ui.saving') : t('ui.update')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Delete Modal */}
      <div className={`fixed inset-0 z-50 ${showDeleteModal ? 'flex' : 'hidden'} items-center justify-center bg-black/50 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Delete Medicine</h3>
            <button onClick={() => setShowDeleteModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label={t('ui.close')}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-3 text-sm text-gray-700 dark:text-gray-200">
            <p>Are you sure you want to delete <strong>{selectedMedicine?.brandName}</strong>? This action cannot be undone.</p>
            <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs">{t('ui.cancel')}</button>
              <button onClick={handleConfirmDelete} className="px-3 py-2 text-sm rounded-md bg-rose-600 text-white hover:bg-rose-700">{t('ui.delete')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}