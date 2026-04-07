import React, { useMemo, useState } from 'react';
import { Box, FileSpreadsheet, FileText, Search, X } from 'lucide-react';
import { Hospital, Stock, UserRole } from '../types';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { useStocks } from '../context/StockContext';
import { useMedicines } from '../context/MedicineContext';
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
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  const { stocks, loading } = useStocks();
  const { medicines } = useMedicines();
  const { hospitals } = useHospitals();
  const { hasPermission } = useAuth();
  const canExport = hasPermission('export_stocks') || hasPermission('manage_stocks');
  const canPrint = hasPermission('print_stocks') || hasPermission('manage_stocks');
  const canReconcile = hasPermission('edit_stocks') || hasPermission('manage_stocks');

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMedicineId, setSelectedMedicineId] = useState('all');
  const [batchFilter, setBatchFilter] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [reconcileDate, setReconcileDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reconcileRows, setReconcileRows] = useState<Array<any>>([]);

  const scopedStocks = filterByHospital(stocks);

  const getHospital = (id: string) => hospitals.find((h) => h.id === id);
  const getHospitalName = (id: string) => getHospital(id)?.name || 'Unknown';
  const getMedicineName = (id: string) => medicines.find((m) => m.id === id)?.brandName || 'Unknown';

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

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredStocks.length / itemsPerPage));

  const paginatedStocks = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredStocks.slice(start, start + itemsPerPage);
  }, [filteredStocks, currentPage]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedMedicineId, batchFilter, selectedHospitalId]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
                setCurrentPage(1);
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
              <option key={m.id} value={m.id}>{m.brandName}</option>
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

          {canPrint && (
            <button onClick={() => setShowPrintModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors text-xs font-medium shadow-sm" title="Print View">
              Print
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
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Medicine</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Batch</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Stock Qty</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Bonus Qty</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Total Qty</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Hospital</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredStocks.length > 0 ? (
                paginatedStocks.map((stock: Stock) => (
                  <tr key={stock.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-amber-100 dark:bg-amber-900/30 rounded-md flex items-center justify-center border border-amber-200 dark:border-amber-800">
                          <Box className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span className="text-xs font-semibold text-gray-900 dark:text-white">{stock.medicineName || getMedicineName(stock.medicineId)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{stock.batchNo || '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{stock.stockQty}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{stock.bonusQty ?? 0}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{Number(stock.stockQty || 0) + Number(stock.bonusQty || 0)}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{getHospitalName(stock.hospitalId)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    {loading ? 'Loading stocks...' : 'No stocks found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span>
            Showing <strong>{paginatedStocks.length}</strong> of <strong>{filteredStocks.length}</strong> stock rows {isAllHospitals ? '(all hospitals)' : `for ${currentHospital.name}`}
          </span>
          <div className="flex items-center gap-3">
            <span>
              Total Stock Qty (incl. bonus): <strong>{totalStockQty}</strong>
            </span>
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
                >
                  Print
                </button>
              )}
              <button onClick={() => setShowPrintModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
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
                      <th className="px-3 py-2">Medicine</th>
                      <th className="px-3 py-2">Batch</th>
                      <th className="px-3 py-2">Stock Qty</th>
                      <th className="px-3 py-2">Bonus Qty</th>
                      <th className="px-3 py-2">Total Qty</th>
                      <th className="px-3 py-2">Hospital</th>
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
              >
                Refresh
              </button>
              {canReconcile && (
                <button
                  onClick={saveReconciliation}
                  className="px-2 py-1 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Save
                </button>
              )}
              <button onClick={() => setShowReconcileModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="p-4 max-h-[70vh] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 sticky top-0">
                <tr>
                  <th className="px-3 py-2">Medicine</th>
                  <th className="px-3 py-2">Batch</th>
                  <th className="px-3 py-2">Expiry</th>
                  <th className="px-3 py-2">System Qty</th>
                  <th className="px-3 py-2">System Bonus</th>
                  <th className="px-3 py-2">System Total</th>
                  <th className="px-3 py-2">Physical Qty</th>
                  <th className="px-3 py-2">Physical Bonus</th>
                  <th className="px-3 py-2">Variance</th>
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
