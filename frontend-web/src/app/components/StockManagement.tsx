import React, { useMemo, useState } from 'react';
import { Box, FileSpreadsheet, FileText, Search, X } from 'lucide-react';
import { Hospital, Stock, UserRole } from '../types';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { useStocks } from '../context/StockContext';
import { useMedicines } from '../context/MedicineContext';
import { useHospitals } from '../context/HospitalContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface StockManagementProps {
  hospital: Hospital;
  userRole?: UserRole;
}

export function StockManagement({ hospital, userRole = 'admin' }: StockManagementProps) {
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital, isAllHospitals } = useHospitalFilter(hospital, userRole);
  const { stocks, loading } = useStocks();
  const { medicines } = useMedicines();
  const { hospitals } = useHospitals();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMedicineId, setSelectedMedicineId] = useState('all');
  const [batchFilter, setBatchFilter] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);

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
      head: [['Medicine', 'Batch', 'Stock Qty', 'Hospital']],
      body: filteredStocks.map((s) => [
        s.medicineName || getMedicineName(s.medicineId),
        s.batchNo || '—',
        s.stockQty,
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
              onChange={(e) => setSearchTerm(e.target.value)}
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
          <button onClick={exportToExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs font-medium shadow-sm" title="Export to Excel">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </button>
          <button onClick={exportToPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs font-medium shadow-sm" title="Export to PDF">
            <FileText className="w-3.5 h-3.5" />
            PDF
          </button>
          <button onClick={() => setShowPrintModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors text-xs font-medium shadow-sm" title="Print View">
            Print
          </button>
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
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Hospital</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredStocks.length > 0 ? (
                filteredStocks.map((stock: Stock) => (
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
                    <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{getHospitalName(stock.hospitalId)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    {loading ? 'Loading stocks...' : 'No stocks found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span>
            Showing <strong>{filteredStocks.length}</strong> of <strong>{scopedStocks.length}</strong> stock rows {isAllHospitals ? '(all hospitals)' : `for ${currentHospital.name}`}
          </span>
        </div>
      </div>

      {/* Print Modal */}
      <div className={`fixed inset-0 z-50 ${showPrintModal ? 'flex' : 'hidden'} items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-5xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Stock Print View</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTimeout(() => window.print(), 100)}
                className="px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
              >
                Print
              </button>
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
                      <th className="px-3 py-2">Hospital</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredStocks.map((stock) => (
                      <tr key={stock.id}>
                        <td className="px-3 py-2">{stock.medicineName || getMedicineName(stock.medicineId)}</td>
                        <td className="px-3 py-2">{stock.batchNo || '—'}</td>
                        <td className="px-3 py-2">{stock.stockQty}</td>
                        <td className="px-3 py-2">{getHospitalName(stock.hospitalId)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto print:hidden">
            <p className="text-sm text-gray-600 dark:text-gray-300">Use the Print button to generate a printable stock report with hospital details.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
