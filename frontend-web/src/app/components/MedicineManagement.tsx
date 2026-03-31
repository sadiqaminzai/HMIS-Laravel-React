import React, { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, FileSpreadsheet, FileText, Pencil, Pill, Plus, Search, Trash2, X, Upload, Download } from 'lucide-react';
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
import { Hospital, Medicine, UserRole } from '../types';

interface MedicineManagementProps {
  hospital: Hospital;
  userRole?: UserRole;
}

type SortField = 'brandName' | 'genericName' | 'medicineType' | 'strength';

export function MedicineManagement({ hospital, userRole = 'admin' }: MedicineManagementProps) {
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  const { medicines, addMedicine, updateMedicine, deleteMedicine, loading } = useMedicines();
  const { manufacturers } = useManufacturers();
  const { medicineTypes } = useMedicineTypes();
  const { hospitals } = useHospitals();
  const { hasPermission } = useAuth();
  const canAdd = hasPermission('add_medicines') || hasPermission('manage_medicines');
  const canEdit = hasPermission('edit_medicines') || hasPermission('manage_medicines');
  const canDelete = hasPermission('delete_medicines') || hasPermission('manage_medicines');
  const canExport = hasPermission('export_medicines') || hasPermission('manage_medicines');
  const canImport = hasPermission('import_medicines') || hasPermission('manage_medicines');
  const importInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      status: medicine.status,
      hospitalId: medicine.hospitalId,
    });
    setShowEditModal(true);
  };

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
          {canImport && (
            <>
              <button
                onClick={downloadImportTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors text-xs font-medium shadow-sm"
                title="Download import template"
              >
                <Download className="w-3.5 h-3.5" />
                Template
              </button>
              <button
                onClick={() => importInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-md hover:bg-violet-700 transition-colors text-xs font-medium shadow-sm"
                title="Import medicines"
              >
                <Upload className="w-3.5 h-3.5" />
                Import
              </button>
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
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Manufacturer</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Stock</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Cost</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Sale</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedMedicines.length > 0 ? (
                paginatedMedicines.map((medicine) => (
                  <tr key={medicine.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
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
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{medicine.stock ?? 0}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{medicine.costPrice ?? 0}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{medicine.salePrice ?? 0}</td>
                    <td className="px-4 py-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${medicine.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200'
                      }`}>
                        {medicine.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleView(medicine)} className="p-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-200" title="View">
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button onClick={() => handleEdit(medicine)} className="p-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-200" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(medicine)} className="p-1.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-200" title="Delete">
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
            >
              Prev
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Medicine Details</h3>
            <button onClick={() => setShowViewModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {selectedMedicine && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Brand</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedMedicine.brandName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Generic</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedMedicine.genericName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Strength</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedMedicine.strength || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Type</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{getMedicineTypeName(selectedMedicine.medicineTypeId)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Manufacturer</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{getManufacturerName(selectedMedicine.manufacturerId)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Stock</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedMedicine.stock ?? 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Cost Price</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedMedicine.costPrice ?? 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Sale Price</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedMedicine.salePrice ?? 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Hospital</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{getHospitalName(selectedMedicine.hospitalId)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Status</p>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${selectedMedicine.status === 'active'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200'
                  }`}>
                    {selectedMedicine.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      <div className={`fixed inset-0 z-50 ${showAddModal ? 'flex' : 'hidden'} items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-3xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Add Medicine</h3>
            <button onClick={() => setShowAddModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form className="p-4 space-y-3 max-h-[70vh] overflow-y-auto" onSubmit={handleSubmitAdd}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1">Brand Name <span className="text-red-500">*</span></label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs h-9"
                  title="Brand Name"
                  value={formData.brandName}
                  onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Generic Name</label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs h-9"
                  title="Generic Name"
                  value={formData.genericName}
                  onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Strength</label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs h-9"
                  title="Strength"
                  value={formData.strength}
                  onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Type</label>
                <select
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs h-9"
                  title="Medicine Type"
                  value={formData.medicineTypeId}
                  onChange={(e) => setFormData({ ...formData, medicineTypeId: e.target.value })}
                  required
                >
                  <option value="">Select type</option>
                  {hospitalSpecificTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Manufacturer</label>
                <select
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs h-9"
                  title="Manufacturer"
                  value={formData.manufacturerId}
                  onChange={(e) => setFormData({ ...formData, manufacturerId: e.target.value })}
                >
                  <option value="">Select manufacturer</option>
                  {hospitalSpecificManufacturers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Stock</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 text-xs h-9"
                  title="Stock is managed by purchase/sales transactions"
                  value={formData.stock}
                  readOnly
                  disabled
                />
                <p className="text-[10px] text-gray-500">Stock updates automatically from transactions.</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Cost Price</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs h-9"
                  title="Cost Price"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Sale Price</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs h-9"
                  title="Sale Price"
                  value={formData.salePrice}
                  onChange={(e) => setFormData({ ...formData, salePrice: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Status</label>
                <select
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs h-9"
                  title="Status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              {userRole === 'super_admin' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Hospital</label>
                  <select
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs h-9"
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
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-700">Cancel</button>
              <button
                type="submit"
                disabled={submitting}
                className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Edit Modal */}
      <div className={`fixed inset-0 z-50 ${showEditModal ? 'flex' : 'hidden'} items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-3xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Edit Medicine</h3>
            <button onClick={() => setShowEditModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form className="p-4 space-y-4 max-h-[70vh] overflow-y-auto" onSubmit={handleSubmitEdit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1">Brand Name <span className="text-red-500">*</span></label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  title="Brand Name"
                  value={formData.brandName}
                  onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Generic Name</label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  title="Generic Name"
                  value={formData.genericName}
                  onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Strength</label>
                <input
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  title="Strength"
                  value={formData.strength}
                  onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Type</label>
                <select
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  title="Medicine Type"
                  value={formData.medicineTypeId}
                  onChange={(e) => setFormData({ ...formData, medicineTypeId: e.target.value })}
                  required
                >
                  <option value="">Select type</option>
                  {hospitalSpecificTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Manufacturer</label>
                <select
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  title="Manufacturer"
                  value={formData.manufacturerId}
                  onChange={(e) => setFormData({ ...formData, manufacturerId: e.target.value })}
                >
                  <option value="">Select manufacturer</option>
                  {hospitalSpecificManufacturers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Stock</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm"
                  title="Stock is managed by purchase/sales transactions"
                  value={formData.stock}
                  readOnly
                  disabled
                />
                <p className="text-[10px] text-gray-500">Stock updates automatically from transactions.</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Cost Price</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  title="Cost Price"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Sale Price</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  title="Sale Price"
                  value={formData.salePrice}
                  onChange={(e) => setFormData({ ...formData, salePrice: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Status</label>
                <select
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  title="Status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              {userRole === 'super_admin' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Hospital</label>
                  <select
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
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
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowEditModal(false)} className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700">Cancel</button>
              <button
                type="submit"
                disabled={submitting}
                className="px-3 py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : 'Update'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Delete Modal */}
      <div className={`fixed inset-0 z-50 ${showDeleteModal ? 'flex' : 'hidden'} items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Delete Medicine</h3>
            <button onClick={() => setShowDeleteModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-3 text-sm text-gray-700 dark:text-gray-200">
            <p>Are you sure you want to delete <strong>{selectedMedicine?.brandName}</strong>? This action cannot be undone.</p>
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