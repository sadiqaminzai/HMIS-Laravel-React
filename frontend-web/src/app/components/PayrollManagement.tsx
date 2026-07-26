import React, { useMemo, useState } from 'react';
import { Plus, Search, Check, Send, Ban, Trash2, Eye, Pencil, Printer } from 'lucide-react';
import { Hospital, UserRole, PayrollItem } from '../types';
import { usePayroll } from '../context/PayrollContext';
import { useAuth } from '../context/AuthContext';
import { HospitalSelector, useHospitalFilter } from './HospitalSelector';
import { toast } from 'sonner';

interface PayrollManagementProps {
  hospital: Hospital;
  userRole: UserRole;
}

export function PayrollManagement({ hospital, userRole }: PayrollManagementProps) {
  const {
    payrollBatches,
    payrollItems,
    generatePayroll,
    approvePayrollBatch,
    postPayrollBatch,
    voidPayrollBatch,
    deletePayrollBatch,
    updatePayrollItem,
    getPayslip,
    loading,
  } = usePayroll();
  const { hasPermission } = useAuth();
  const { selectedHospitalId, setSelectedHospitalId, currentHospital, filterByHospital } = useHospitalFilter(hospital, userRole);

  const canGenerate = hasPermission('generate_payroll') || hasPermission('manage_payroll_batches');
  const canApprove = hasPermission('approve_payroll') || hasPermission('manage_payroll_batches');
  const canDeleteBatch = hasPermission('delete_payroll_batches') || hasPermission('manage_payroll_batches');
  const canEditItem = hasPermission('edit_payroll_items') || hasPermission('manage_payroll_items');
  const canPrint = hasPermission('print_payslips') || hasPermission('manage_payroll_items') || hasPermission('manage_payroll_batches');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [batchCurrentPage, setBatchCurrentPage] = useState(1);
  const [itemCurrentPage, setItemCurrentPage] = useState(1);
  const batchItemsPerPage = 10;
  const itemItemsPerPage = 10;
  const [generateForm, setGenerateForm] = useState({
    hospitalId: currentHospital.id,
    payrollMonth: new Date().toISOString().slice(0, 7),
    currency: 'AFN',
    notes: '',
  });

  React.useEffect(() => {
    setGenerateForm((prev) => ({ ...prev, hospitalId: currentHospital.id }));
  }, [currentHospital.id]);

  const scopedBatches = useMemo(() => filterByHospital(payrollBatches), [payrollBatches, filterByHospital]);
  const scopedItems = useMemo(() => filterByHospital(payrollItems), [payrollItems, filterByHospital]);

  const filteredBatches = useMemo(
    () => scopedBatches.filter((batch) => {
      const search = searchTerm.toLowerCase();
      return (
        batch.payrollMonth.toLowerCase().includes(search) ||
        batch.status.toLowerCase().includes(search) ||
        (batch.generatedBy || '').toLowerCase().includes(search)
      );
    }),
    [scopedBatches, searchTerm]
  );

  const selectedBatchItems = useMemo(
    () => scopedItems.filter((item) => item.payrollBatchId === selectedBatchId),
    [scopedItems, selectedBatchId]
  );

  const paginatedBatches = useMemo(() => {
    const startIndex = (batchCurrentPage - 1) * batchItemsPerPage;
    return filteredBatches.slice(startIndex, startIndex + batchItemsPerPage);
  }, [filteredBatches, batchCurrentPage]);

  const batchTotalPages = Math.max(1, Math.ceil(filteredBatches.length / batchItemsPerPage));

  const paginatedSelectedBatchItems = useMemo(() => {
    const startIndex = (itemCurrentPage - 1) * itemItemsPerPage;
    return selectedBatchItems.slice(startIndex, startIndex + itemItemsPerPage);
  }, [selectedBatchItems, itemCurrentPage]);

  const itemTotalPages = Math.max(1, Math.ceil(selectedBatchItems.length / itemItemsPerPage));

  React.useEffect(() => {
    setBatchCurrentPage(1);
  }, [searchTerm, selectedHospitalId]);

  React.useEffect(() => {
    if (batchCurrentPage > batchTotalPages) {
      setBatchCurrentPage(batchTotalPages);
    }
  }, [batchCurrentPage, batchTotalPages]);

  React.useEffect(() => {
    setItemCurrentPage(1);
  }, [selectedBatchId]);

  React.useEffect(() => {
    if (itemCurrentPage > itemTotalPages) {
      setItemCurrentPage(itemTotalPages);
    }
  }, [itemCurrentPage, itemTotalPages]);

  const onGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canGenerate) {
      toast.warning('You are not authorized to generate payroll');
      return;
    }

    if (generating) return;

    if (userRole === 'super_admin' && !generateForm.hospitalId) {
      toast.error('Please select a hospital');
      return;
    }

    if (!generateForm.payrollMonth) {
      toast.error('Please select payroll month');
      return;
    }

    setGenerating(true);
    try {
      const batch = await generatePayroll({
        hospitalId: generateForm.hospitalId,
        payrollMonth: generateForm.payrollMonth,
        currency: generateForm.currency || 'AFN',
        notes: generateForm.notes || undefined,
      });

      if (!batch) return;
      setSelectedBatchId(batch.id);
      toast.success('Payroll generated successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to generate payroll');
    } finally {
      setGenerating(false);
    }
  };

  const onApprove = async (batchId: string) => {
    if (!canApprove) {
      toast.warning('You are not authorized to approve payroll');
      return;
    }

    try {
      await approvePayrollBatch(batchId);
      toast.success('Payroll batch approved');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to approve payroll batch');
    }
  };

  const onPost = async (batchId: string) => {
    if (!canApprove) {
      toast.warning('You are not authorized to post payroll');
      return;
    }

    const paymentMethod = window.prompt('Payment method for this batch (optional)', 'bank_transfer') || undefined;

    try {
      await postPayrollBatch(batchId, paymentMethod);
      toast.success('Payroll batch posted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to post payroll batch');
    }
  };

  const onVoid = async (batchId: string) => {
    if (!canApprove) {
      toast.warning('You are not authorized to void payroll');
      return;
    }

    const confirmed = window.confirm('Void this payroll batch?');
    if (!confirmed) return;

    try {
      await voidPayrollBatch(batchId);
      toast.success('Payroll batch voided');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to void payroll batch');
    }
  };

  const onDeleteBatch = async (batchId: string) => {
    if (!canDeleteBatch) {
      toast.warning('You are not authorized to delete payroll batches');
      return;
    }

    const confirmed = window.confirm('Delete this payroll batch?');
    if (!confirmed) return;

    try {
      await deletePayrollBatch(batchId);
      if (selectedBatchId === batchId) setSelectedBatchId('');
      toast.success('Payroll batch deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete payroll batch');
    }
  };

  const onAdjustItem = async (item: PayrollItem) => {
    if (!canEditItem) {
      toast.warning('You are not authorized to edit payroll items');
      return;
    }

    const allowancesInput = window.prompt('Allowances total', String(item.allowancesTotal));
    if (allowancesInput === null) return;

    const deductionsInput = window.prompt('Deductions total', String(item.deductionsTotal));
    if (deductionsInput === null) return;

    const overtimeInput = window.prompt('Overtime amount', String(item.overtimeAmount));
    if (overtimeInput === null) return;

    const adjustmentsInput = window.prompt('Adjustments amount', String(item.adjustmentsAmount));
    if (adjustmentsInput === null) return;

    try {
      await updatePayrollItem({
        id: item.id,
        allowancesTotal: Number(allowancesInput || 0),
        deductionsTotal: Number(deductionsInput || 0),
        overtimeAmount: Number(overtimeInput || 0),
        adjustmentsAmount: Number(adjustmentsInput || 0),
      });
      toast.success('Payroll item adjusted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to adjust payroll item');
    }
  };

  const onPrintPayslip = async (payrollItemId: string) => {
    if (!canPrint) {
      toast.warning('You are not authorized to print payslips');
      return;
    }

    try {
      const payslip = await getPayslip(payrollItemId);
      const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
      if (!win) {
        toast.error('Popup blocked. Please allow popups and try again.');
        return;
      }

      const breakdown = payslip.breakdown || {};
      win.document.write(`
        <html>
          <head>
            <title>Payslip ${payslip.slip_number || ''}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; }
              h1 { margin-bottom: 4px; }
              .meta { color: #555; margin-bottom: 16px; }
              table { width: 100%; border-collapse: collapse; margin-top: 12px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background: #f5f5f5; }
            </style>
          </head>
          <body>
            <h1>Payslip</h1>
            <div class="meta">
              <div>Slip #: ${payslip.slip_number || '-'}</div>
              <div>Employee: ${payslip.employee?.first_name || ''} ${payslip.employee?.last_name || ''}</div>
              <div>Month: ${payslip.batch?.payroll_month || '-'}</div>
              <div>Status: ${payslip.status || '-'}</div>
            </div>
            <table>
              <tr><th>Base Salary</th><td>${Number(breakdown.base_salary || 0).toFixed(2)}</td></tr>
              <tr><th>Allowances</th><td>${Number(breakdown.allowances_total || 0).toFixed(2)}</td></tr>
              <tr><th>Deductions</th><td>${Number(breakdown.deductions_total || 0).toFixed(2)}</td></tr>
              <tr><th>Overtime</th><td>${Number(breakdown.overtime_amount || 0).toFixed(2)}</td></tr>
              <tr><th>Adjustments</th><td>${Number(breakdown.adjustments_amount || 0).toFixed(2)}</td></tr>
              <tr><th>Payable Days</th><td>${Number(breakdown.payable_days || 0).toFixed(2)}</td></tr>
              <tr><th><strong>Final Amount</strong></th><td><strong>${Number(breakdown.final_amount || 0).toFixed(2)}</strong></td></tr>
            </table>
          </body>
        </html>
      `);
      win.document.close();
      win.focus();
      win.print();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to print payslip');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payroll</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Monthly payroll generation, approval, posting, and payslips.</p>
        </div>
      </div>

      <form onSubmit={onGenerate} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        {userRole === 'super_admin' && (
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Hospital</label>
            <div className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 px-3.5 py-2 text-sm text-gray-700 dark:text-gray-200">
              {currentHospital.name}
            </div>
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Payroll Month</label>
          <input
            type="text"
            value={generateForm.payrollMonth}
            onChange={(e) => setGenerateForm((prev) => ({ ...prev, payrollMonth: e.target.value }))}
            title="Payroll month"
            placeholder="YYYY-MM"
            pattern="^\d{4}-(0[1-9]|1[0-2])$"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Currency</label>
          <input
            value={generateForm.currency}
            onChange={(e) => setGenerateForm((prev) => ({ ...prev, currency: e.target.value }))}
            title="Currency"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
            required
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Notes</label>
          <input
            value={generateForm.notes}
            onChange={(e) => setGenerateForm((prev) => ({ ...prev, notes: e.target.value }))}
            title="Payroll notes"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
          />
        </div>
        <div className="md:col-span-5 flex justify-end">
          <button
            type="submit"
            disabled={generating}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-[10px] text-sm font-medium flex items-center gap-2 shadow-sm transition-all focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 active:scale-95 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {generating ? 'Generating...' : 'Generate Payroll'}
          </button>
        </div>
      </form>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            title="Search payroll batches"
            placeholder="Search payroll batches..."
            className="w-full pl-10 pr-4 py-2.5 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          />
        </div>
        <HospitalSelector
          userRole={userRole}
          selectedHospitalId={selectedHospitalId}
          onHospitalChange={setSelectedHospitalId}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-[12px] border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[1080px]">
            <thead className="bg-gray-50/80 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 font-semibold sticky top-0 backdrop-blur-sm z-10">
              <tr>
                <th className="px-3 py-2.5 text-xs font-medium">Month</th>
                <th className="px-3 py-2.5 text-xs font-medium">Employees</th>
                <th className="px-3 py-2.5 text-xs font-medium">Gross</th>
                <th className="px-3 py-2.5 text-xs font-medium">Deductions</th>
                <th className="px-3 py-2.5 text-xs font-medium">Net</th>
                <th className="px-3 py-2.5 text-xs font-medium">Status</th>
                <th className="px-3 py-2.5 text-xs font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedBatches.map((batch) => (
                <tr key={batch.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/40 transition-colors border-b border-gray-100 dark:border-gray-800/50">
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-900 dark:text-white font-medium">{batch.payrollMonth}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{batch.totalEmployees}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{batch.grossAmount.toFixed(2)} {batch.currency}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{batch.deductionsAmount.toFixed(2)} {batch.currency}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{batch.netAmount.toFixed(2)} {batch.currency}</td>
                  <td className="px-3 py-2.5 text-xs font-medium">
                    <span className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold ${batch.status === 'posted'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : batch.status === 'voided'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : batch.status === 'approved'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : batch.status === 'generated'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {batch.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-medium">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setSelectedBatchId(batch.id)}
                        className="p-1.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                        title="View Items"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {batch.status === 'generated' && (
                        <button
                          onClick={() => onApprove(batch.id)}
                          className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors text-emerald-600 hover:bg-emerald-100"
                          title="Approve"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      {batch.status === 'approved' && (
                        <button
                          onClick={() => onPost(batch.id)}
                          className="p-2.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-blue-600 hover:bg-blue-100"
                          title="Post"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      {(batch.status === 'generated' || batch.status === 'approved' || batch.status === 'posted') && (
                        <button
                          onClick={() => onVoid(batch.id)}
                          className="p-1.5 rounded bg-orange-50 text-orange-600 hover:bg-orange-100"
                          title="Void"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                      {(batch.status === 'draft' || batch.status === 'generated' || batch.status === 'voided') && (
                        <button
                          onClick={() => onDeleteBatch(batch.id)}
                          className="p-2.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-red-600 hover:bg-red-100"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredBatches.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                    No payroll batches found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {batchTotalPages > 1 && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
            <div className="text-xs text-gray-500 dark:text-gray-400">Page {batchCurrentPage} of {batchTotalPages}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBatchCurrentPage((page) => Math.max(1, page - 1))}
                disabled={batchCurrentPage === 1}
                className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setBatchCurrentPage((page) => Math.min(batchTotalPages, page + 1))}
                disabled={batchCurrentPage === batchTotalPages}
                className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedBatchId && (
        <div className="bg-white dark:bg-gray-800 rounded-[12px] border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-3 py-2.5 text-xs font-medium border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Payroll Items</h2>
            <button onClick={() => setSelectedBatchId('')} className="text-sm text-gray-500 hover:text-gray-700">Close</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[1100px]">
              <thead className="bg-gray-50/80 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 font-semibold sticky top-0 backdrop-blur-sm z-10">
                <tr>
                  <th className="px-3 py-2.5 text-xs font-medium">Employee</th>
                  <th className="px-3 py-2.5 text-xs font-medium">Slip</th>
                  <th className="px-3 py-2.5 text-xs font-medium">Base</th>
                  <th className="px-3 py-2.5 text-xs font-medium">Allowances</th>
                  <th className="px-3 py-2.5 text-xs font-medium">Deductions</th>
                  <th className="px-3 py-2.5 text-xs font-medium">Final</th>
                  <th className="px-3 py-2.5 text-xs font-medium">Status</th>
                  <th className="px-3 py-2.5 text-xs font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedSelectedBatchItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/40 transition-colors border-b border-gray-100 dark:border-gray-800/50">
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-900 dark:text-white font-medium">
                      <div>{item.employee?.fullName || '-'}</div>
                      <div className="text-xs text-gray-500">{item.employee?.employeeCode || ''}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{item.slipNumber || '-'}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{item.baseSalary.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{item.allowancesTotal.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{item.deductionsTotal.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{item.finalAmount.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">{item.status}</td>
                    <td className="px-3 py-2.5 text-xs font-medium">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => onAdjustItem(item)}
                          className="p-2.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-blue-600 hover:bg-blue-100"
                          title="Adjust"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onPrintPayslip(item.id)}
                          className="p-1.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                          title="Print Payslip"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && selectedBatchItems.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No payroll items found for this batch
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {itemTotalPages > 1 && (
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
              <div className="text-xs text-gray-500 dark:text-gray-400">Page {itemCurrentPage} of {itemTotalPages}</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setItemCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={itemCurrentPage === 1}
                  className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setItemCurrentPage((page) => Math.min(itemTotalPages, page + 1))}
                  disabled={itemCurrentPage === itemTotalPages}
                  className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
