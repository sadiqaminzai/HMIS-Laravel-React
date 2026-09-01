import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, FileSpreadsheet, FileText, Search, X } from 'lucide-react';
import { Hospital, Stock, UserRole } from '../types';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { useStocks } from '../context/StockContext';
import { useMedicines } from '../context/MedicineContext';
import { formatQuantityInSaleUnit, medicineDisplayName } from '../utils/medicineUnits';
import {
  CellNumber,
  CellStack,
  CellText,
  DataTableBody,
  DataTableCard,
  DataTableHead,
  RowIcon,
  TableEmpty,
  TableLoading,
  Th,
  Tr,
  usePagination,
  useTableSort,
} from './DataTable';
import { useHospitals } from '../context/HospitalContext';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import api from '../../api/axios';
import { toast } from 'sonner';

interface StockManagementProps {
  hospital: Hospital;
  userRole?: UserRole;
}

export function StockManagement({ hospital, userRole = 'admin' }: StockManagementProps) {
  const { t } = useTranslation();
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  const { stocks, loading } = useStocks();
  const { medicines } = useMedicines();
  const { hospitals } = useHospitals();
  const { hasPermission } = useAuth();
  const canExport = hasPermission('export_stocks') || hasPermission('manage_stocks');
  const canPrint = hasPermission('print_stocks') || hasPermission('manage_stocks');
  const canReconcile = hasPermission('edit_stocks') || hasPermission('manage_stocks');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMedicineId, setSelectedMedicineId] = useState('all');
  const [batchFilter, setBatchFilter] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [reconcileDate, setReconcileDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reconcileRows, setReconcileRows] = useState<Array<any>>([]);

  const scopedStocks = filterByHospital(stocks);

  const getHospital = (id: string) => hospitals.find((h) => h.id === id);
  const getHospitalName = (id: string) => getHospital(id)?.name || 'Unknown';
  const getMedicineById = (id: string) => medicines.find((m) => String(m.id) === String(id));
  /**
   * Brand + strength + form. The stock list showed the brand alone, so three
   * different products could appear as the same line and there was no way to
   * tell which one a batch belonged to.
   */
  const getMedicineName = (id: string) => medicineDisplayName(getMedicineById(id));

  /** Piece counts shown in the unit the pharmacy actually handles. */
  const inSaleUnit = (pieces: number, medicineId: string) =>
    formatQuantityInSaleUnit(pieces, getMedicineById(medicineId));

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

  const exportToExcel = () => {
    const workSheet = XLSX.utils.json_to_sheet(filteredStocks.map((s) => ({
      Medicine: s.medicineName || getMedicineName(s.medicineId),
      Batch: s.batchNo || '',
      StockQty: s.stockQty,
      BonusQty: s.bonusQty ?? 0,
      TotalQty: Number(s.stockQty || 0) + Number(s.bonusQty || 0),
      Hospital: getHospitalName(s.hospitalId),
    })));
    const workBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workBook, workSheet, 'Stocks');
    XLSX.writeFile(workBook, 'Stocks_List.xlsx');
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
    doc.text('Stocks Report', logoDataUrl ? 34 : 14, headerY);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    if (!isAllHospitals) {
      doc.text(`Hospital: ${currentHospital.name}`, 14, 36);
      doc.text(`Code: ${getHospital(currentHospital.id)?.code || '—'}`, 14, 42);
    }

    autoTable(doc, {
      head: [['Medicine', 'Batch', 'Stock Qty', 'Bonus Qty', 'Total Qty', 'Hospital']],
      body: filteredStocks.map((s) => [
        s.medicineName || getMedicineName(s.medicineId),
        s.batchNo || '—',
        s.stockQty,
        s.bonusQty ?? 0,
        Number(s.stockQty || 0) + Number(s.bonusQty || 0),
        getHospitalName(s.hospitalId),
      ]),
      startY: isAllHospitals ? 40 : 50,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [66, 139, 202] },
    });

    doc.save('Stocks_Report.pdf');
  };

  const filteredStocks = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return scopedStocks.filter((s) => {
      const matchesSearch =
        getMedicineName(s.medicineId).toLowerCase().includes(term) ||
        (s.batchNo || '').toLowerCase().includes(term);
      const matchesMedicine = selectedMedicineId === 'all' || s.medicineId === selectedMedicineId;
      const matchesBatch = !batchFilter || (s.batchNo || '').toLowerCase().includes(batchFilter.toLowerCase());
      return matchesSearch && matchesMedicine && matchesBatch;
    });
  }, [scopedStocks, searchTerm, selectedMedicineId, batchFilter, medicines]);

  /**
   * Rows shaped for sorting.
   *
   * The sortable values are precomputed rather than read off the raw stock row,
   * because the columns show a derived product name and quantities converted
   * into the selling unit -- sorting the underlying piece counts would order
   * the list differently from what is on screen.
   */
  const sortableStocks = useMemo(() => filteredStocks.map((stock) => {
    const medicine = getMedicineById(stock.medicineId);
    const stockPieces = Number(stock.stockQty || 0);
    const bonusPieces = Number(stock.bonusQty || 0);
    return {
      stock,
      medicineName: medicine ? medicineDisplayName(medicine) : (stock.medicineName || 'Unknown'),
      batchNo: stock.batchNo || '',
      hospitalName: getHospitalName(stock.hospitalId),
      stockQty: formatQuantityInSaleUnit(stockPieces, medicine).value,
      bonusQty: formatQuantityInSaleUnit(bonusPieces, medicine).value,
      totalQty: formatQuantityInSaleUnit(stockPieces + bonusPieces, medicine).value,
      stockPieces,
      bonusPieces,
      totalPieces: stockPieces + bonusPieces,
    };
  }), [filteredStocks, medicines]);

  const sort = useTableSort<any>(sortableStocks, 'medicineName');
  const { page, setPage, totalPages, pageRows: paginatedStocks } = usePagination<any>(sort.rows, 25);

  React.useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedMedicineId, batchFilter, selectedHospitalId]);


  const totalStockQty = useMemo(() => {
    return filteredStocks.reduce((sum, s) => sum + Number(s.stockQty || 0) + Number(s.bonusQty || 0), 0);
  }, [filteredStocks]);

  const loadReconciliation = async () => {
    const hospitalId = isAllHospitals ? null : selectedHospitalId || currentHospital.id;
    if (!hospitalId) {
      toast.error('Please select a hospital for reconciliation');
      return;
    }
    try {
      const { data } = await api.get('/stock-reconciliation', {
        params: {
          date: reconcileDate,
          hospital_id: hospitalId,
        },
      });
      setReconcileRows(data.rows || []);
      setShowReconcileModal(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load reconciliation');
    }
  };

  const saveReconciliation = async () => {
    const hospitalId = isAllHospitals ? null : selectedHospitalId || currentHospital.id;
    if (!hospitalId) {
      toast.error('Please select a hospital for reconciliation');
      return;
    }
    try {
      await api.post('/stock-reconciliation', {
        date: reconcileDate,
        hospital_id: hospitalId,
        items: reconcileRows.map((row) => ({
          medicine_id: row.medicine_id,
          batch_no: row.batch_no || null,
          physical_qty: row.physical_qty ?? 0,
          physical_bonus: row.physical_bonus ?? 0,
        })),
      });
      toast.success('Reconciliation saved');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save reconciliation');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Stock Management</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">Track batch-wise stocks for {isAllHospitals ? 'All Hospitals' : currentHospital.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search stock..."
              className="w-48 pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <select
            className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs"
            title="Filter by medicine"
            value={selectedMedicineId}
            onChange={(e) => setSelectedMedicineId(e.target.value)}
          >
            <option value="all">All Medicines</option>
            {medicines.map((m) => (
              <option key={m.id} value={m.id}>{medicineDisplayName(m)}</option>
            ))}
          </select>
          <input
            type="text"
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            placeholder="Batch no"
            className="w-32 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-xs"
          />
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

          {canPrint && (
            <button onClick={() => setShowPrintModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors text-xs font-medium shadow-sm" title="Print View">{t('ui.print')}</button>
          )}
        </div>
      </div>

      <HospitalSelector userRole={userRole} selectedHospitalId={selectedHospitalId} onHospitalChange={setSelectedHospitalId} />

      <DataTableCard
        total={filteredStocks.length}
        shown={paginatedStocks.length}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noun="stock rows"
        maxHeight="calc(100vh - 300px)"
      >
        <DataTableHead>
          <Th sort={sort} field="medicineName">{t('table.medicine')}</Th>
          <Th sort={sort} field="batchNo">{t('table.batch')}</Th>
          <Th sort={sort} field="stockQty">{t('table.stockQty')}</Th>
          <Th sort={sort} field="bonusQty">{t('table.bonusQty')}</Th>
          <Th sort={sort} field="totalQty">{t('table.totalQty')}</Th>
          <Th sort={sort} field="hospitalName">{t('table.hospital')}</Th>
        </DataTableHead>
        <DataTableBody>
          {loading ? (
            <TableLoading colSpan={6} />
          ) : paginatedStocks.length === 0 ? (
            <TableEmpty colSpan={6} message="No stocks found" icon={<Box className="w-6 h-6 text-gray-400" />} />
          ) : (
            paginatedStocks.map((row: any) => (
              <Tr key={row.stock.id}>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-3">
                    <RowIcon tone="amber">
                      <Box className="w-4 h-4" />
                    </RowIcon>
                    <CellStack primary={row.medicineName} />
                  </div>
                </td>
                <td className="px-4 py-2"><CellText mono>{row.batchNo || '—'}</CellText></td>
                {/* Counted in the product's own selling unit; the raw piece
                    figure the database holds is on hover. */}
                <td className="px-4 py-2" title={`${row.stockPieces} pieces`}>
                  <CellNumber>{formatQuantityInSaleUnit(row.stockPieces, getMedicineById(row.stock.medicineId)).text}</CellNumber>
                </td>
                <td className="px-4 py-2" title={`${row.bonusPieces} pieces`}>
                  <CellNumber tone="muted">{formatQuantityInSaleUnit(row.bonusPieces, getMedicineById(row.stock.medicineId)).text}</CellNumber>
                </td>
                <td className="px-4 py-2" title={`${row.totalPieces} pieces`}>
                  <CellNumber tone="money">{formatQuantityInSaleUnit(row.totalPieces, getMedicineById(row.stock.medicineId)).text}</CellNumber>
                </td>
                <td className="px-4 py-2"><CellText>{row.hospitalName}</CellText></td>
              </Tr>
            ))
          )}
        </DataTableBody>
      </DataTableCard>

      {/* Print Modal */}
      <div className={`fixed inset-0 z-50 ${showPrintModal && canPrint ? 'flex' : 'hidden'} items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-5xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Stock Print View</h3>
            <div className="flex items-center gap-2">
              {canPrint && (
                <button
                  onClick={() => setTimeout(() => window.print(), 100)}
                  className="px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                >{t('ui.print')}</button>
              )}
              <button onClick={() => setShowPrintModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label={t('ui.close')}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <style>
            {`
              @media print {
                body * { visibility: hidden; }
                #stock-print-view, #stock-print-view * { visibility: visible; }
                #stock-print-view {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  min-height: 100%;
                  padding: 40px;
                  background: white;
                }
                @page { margin: 0; }
              }
            `}
          </style>
          <div id="stock-print-view" className="hidden">
            <div className="space-y-6">
              <div className="flex items-start justify-between border-b-2 border-gray-800 pb-4">
                <div className="flex items-center gap-4">
                  {!isAllHospitals && getHospital(currentHospital.id)?.logo && (
                    <img
                      src={getHospital(currentHospital.id)?.logo}
                      alt="Hospital Logo"
                      className="w-16 h-16 object-contain"
                    />
                  )}
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Stock Report</h1>
                    <p className="text-sm text-gray-600">Hospital: {isAllHospitals ? 'All Hospitals' : currentHospital.name}</p>
                    {!isAllHospitals && (
                      <p className="text-sm text-gray-600">Code: {getHospital(currentHospital.id)?.code || '—'}</p>
                    )}
                  </div>
                </div>
                <div className="text-right text-gray-600 text-sm">
                  <p>Printed on</p>
                  <p className="font-semibold text-gray-900">{new Date().toLocaleDateString()}</p>
                </div>
              </div>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="px-3 py-2">{t('table.medicine')}</th>
                      <th className="px-3 py-2">{t('table.batch')}</th>
                      <th className="px-3 py-2">{t('table.stockQty')}</th>
                      <th className="px-3 py-2">{t('table.bonusQty')}</th>
                      <th className="px-3 py-2">{t('table.totalQty')}</th>
                      <th className="px-3 py-2">{t('table.hospital')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredStocks.map((stock) => (
                      <tr key={stock.id}>
                        <td className="px-3 py-2">{stock.medicineName || getMedicineName(stock.medicineId)}</td>
                        <td className="px-3 py-2">{stock.batchNo || '—'}</td>
                        <td className="px-3 py-2">{stock.stockQty}</td>
                        <td className="px-3 py-2">{stock.bonusQty ?? 0}</td>
                        <td className="px-3 py-2">{Number(stock.stockQty || 0) + Number(stock.bonusQty || 0)}</td>
                        <td className="px-3 py-2">{getHospitalName(stock.hospitalId)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-gray-600">
                Total Stock Qty (incl. bonus): <span className="font-semibold text-gray-900">{totalStockQty}</span>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto print:hidden">
            <p className="text-sm text-gray-600 dark:text-gray-300">Use the Print button to generate a printable stock report with hospital details.</p>
          </div>
        </div>
      </div>

      {/* Reconciliation Modal */}
      <div className={`fixed inset-0 z-50 ${showReconcileModal ? 'flex' : 'hidden'} items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-6xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Stock Reconciliation</h3>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={reconcileDate}
                onChange={(e) => setReconcileDate(e.target.value)}
                aria-label="Reconciliation date"
                className="px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
              <button
                onClick={loadReconciliation}
                className="px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
              >{t('ui.refresh')}</button>
              {canReconcile && (
                <button
                  onClick={saveReconciliation}
                  className="px-2 py-1 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                >{t('ui.save')}</button>
              )}
              <button onClick={() => setShowReconcileModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label={t('ui.close')}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="p-4 max-h-[70vh] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 sticky top-0">
                <tr>
                  <th className="px-3 py-2">{t('table.medicine')}</th>
                  <th className="px-3 py-2">{t('table.batch')}</th>
                  <th className="px-3 py-2">{t('table.expiry')}</th>
                  <th className="px-3 py-2">{t('table.systemQty')}</th>
                  <th className="px-3 py-2">{t('table.systemBonus')}</th>
                  <th className="px-3 py-2">{t('table.systemTotal')}</th>
                  <th className="px-3 py-2">{t('table.physicalQty')}</th>
                  <th className="px-3 py-2">{t('table.physicalBonus')}</th>
                  <th className="px-3 py-2">{t('table.variance')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {reconcileRows.map((row, idx) => {
                  const physicalTotal = (Number(row.physical_qty || 0) + Number(row.physical_bonus || 0));
                  const variance = row.physical_qty !== null || row.physical_bonus !== null
                    ? physicalTotal - Number(row.system_total || 0)
                    : null;
                  return (
                    <tr key={`${row.medicine_id}-${row.batch_no || 'n/a'}-${idx}`}>
                      <td className="px-3 py-2">{row.medicine_name}</td>
                      <td className="px-3 py-2">{row.batch_no || '—'}</td>
                      <td className="px-3 py-2">{row.expiry_date || '—'}</td>
                      <td className="px-3 py-2">{row.system_qty}</td>
                      <td className="px-3 py-2">{row.system_bonus}</td>
                      <td className="px-3 py-2">{row.system_total}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          value={row.physical_qty ?? 0}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            setReconcileRows((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], physical_qty: value };
                              return next;
                            });
                          }}
                          aria-label="Physical quantity"
                          className="w-20 px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          value={row.physical_bonus ?? 0}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            setReconcileRows((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], physical_bonus: value };
                              return next;
                            });
                          }}
                          aria-label="Physical bonus quantity"
                          className="w-20 px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                        />
                      </td>
                      <td className={`px-3 py-2 ${variance === null ? 'text-gray-400' : variance < 0 ? 'text-rose-600' : variance > 0 ? 'text-emerald-600' : 'text-gray-600'}`}>
                        {variance === null ? '—' : variance}
                      </td>
                    </tr>
                  );
                })}
                {reconcileRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-xs text-gray-500">
                      No reconciliation data for this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
