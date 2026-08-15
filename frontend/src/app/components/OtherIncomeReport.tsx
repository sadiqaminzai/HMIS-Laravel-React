import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { OtherIncome, Hospital, UserRole } from '../types';
import { useOtherIncomes } from '../context/OtherIncomeContext';

interface OtherIncomeReportProps {
  hospital: Hospital;
  userRole: UserRole;
}

export function OtherIncomeReport({ hospital }: OtherIncomeReportProps) {
  const { t } = useTranslation();
  const { otherIncomes } = useOtherIncomes();
  const [statusFilter, setStatusFilter] = useState<'all' | OtherIncome['status']>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const filteredOtherIncomes = useMemo(() => {
    return otherIncomes
      .filter((e) => e.hospitalId === hospital.id)
      .filter((e) => (statusFilter === 'all' ? true : e.status === statusFilter))
      .filter((e) => {
        if (!startDate && !endDate) return true;
        const dateStr = format(e.incomeDate, 'yyyy-MM-dd');
        if (startDate && dateStr < startDate) return false;
        if (endDate && dateStr > endDate) return false;
        return true;
      })
      .sort((a, b) => b.incomeDate.getTime() - a.incomeDate.getTime());
  }, [otherIncomes, hospital.id, statusFilter, startDate, endDate]);

  const totalAmount = filteredOtherIncomes.reduce((sum, item) => sum + (item.amount || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Other Income Report</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Filter and review other income approvals.</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ui.status')}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              title={t('ui.status')}
              className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">{t('ui.all')}</option>
              <option value="pending">{t('ui.pending')}</option>
              <option value="approved">{t('ui.approved')}</option>
              <option value="rejected">{t('ui.rejected')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ui.startDate')}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="Start date"
              className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ui.endDate')}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="End date"
              className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="ml-auto">
            <div className="text-xs text-gray-500">Total Amount</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">{totalAmount.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
              <tr>
                <th className="px-3 py-2">{t('table.id')}</th>
                <th className="px-3 py-2">{t('table.title')}</th>
                <th className="px-3 py-2">{t('table.category')}</th>
                <th className="px-3 py-2">{t('table.amount')}</th>
                <th className="px-3 py-2">{t('table.date')}</th>
                <th className="px-3 py-2">{t('table.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredOtherIncomes.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-3 py-2">{hospital.code}-{entry.sequenceId}</td>
                  <td className="px-3 py-2">{entry.title}</td>
                  <td className="px-3 py-2">{entry.category?.name || 'Category'}</td>
                  <td className="px-3 py-2">{entry.amount.toFixed(2)}</td>
                  <td className="px-3 py-2">{format(entry.incomeDate, 'dd MMM yyyy')}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${entry.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : entry.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                      {entry.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredOtherIncomes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-xs text-gray-500">No other incomes found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
