import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Tags, CalendarDays, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { Hospital, UserRole } from '../../types';
import { TabbedModulePage, type ModuleTab } from '../TabbedModulePage';
import { ReportTable, type ReportColumn, type ReportSummaryItem } from './ReportTable';
import { DateRangeFilter, Field, inputClass, useReport } from './reportPrimitives';
import { formatMoneyIn, formatNumberIn } from '../../utils/money';
import { StatusBadge } from '../ui/StatusBadge';
import {
  getExpenseReport,
  getOtherIncomeReport,
  type MoneyDetailRow,
  type MoneyGroupRow,
} from '../../api/clinicalReports';

/**
 * Expense and Other Income reports.
 *
 * These used to be a "Reports" entry inside the Expenses and Other Income
 * data-entry menus. Reading a report and typing an entry are different jobs
 * done by different people, and every other report in the hospital is found
 * under Reports -- so they moved here and the data-entry menus kept only the
 * data entry.
 */

type MoneyKind = 'expense' | 'other-income';

const KINDS: Record<MoneyKind, { title: string; subtitle: string; tone: 'bad' | 'good'; total: string }> = {
  expense: {
    title: 'Expense Reports',
    subtitle: 'What the hospital spent, by period, category and payment method',
    tone: 'bad',
    total: 'Total Spent',
  },
  'other-income': {
    title: 'Other Income Reports',
    subtitle: 'Income raised outside the clinical modules, by period and category',
    tone: 'good',
    total: 'Total Received',
  },
};

const STATUSES = ['pending', 'approved', 'paid', 'rejected', 'cancelled'];

interface MoneyReportsProps {
  hospital: Hospital;
  userRole: UserRole;
  kind: MoneyKind;
}

interface MoneyTabProps {
  kind: MoneyKind;
  hospitalId: number;
  hospitalName: string;
  currency: string;
  language: string;
  groupBy: 'detail' | 'category' | 'date' | 'method';
}

function MoneyTab({ kind, hospitalId, hospitalName, currency, language, groupBy }: MoneyTabProps) {
  const config = KINDS[kind];
  const [from, setFrom] = useState(format(new Date(), 'yyyy-MM-01'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [status, setStatus] = useState('');

  const report = useReport<MoneyDetailRow | MoneyGroupRow>(
    kind === 'expense' ? getExpenseReport : getOtherIncomeReport,
    useMemo(
      () => ({
        hospital_id: hospitalId,
        date_from: from,
        date_to: to,
        group_by: groupBy,
        status: status || undefined,
      }),
      [hospitalId, from, to, groupBy, status]
    )
  );

  const detailColumns: ReportColumn<MoneyDetailRow>[] = [
    { key: 'sequence_id', label: '#' },
    { key: 'entry_date', label: 'Date', kind: 'date' },
    { key: 'title', label: 'Title' },
    { key: 'category_name', label: 'Category' },
    { key: 'payment_method', label: 'Method' },
    { key: 'reference', label: 'Reference' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    { key: 'amount', label: 'Amount', kind: 'currency', total: true },
  ];

  const groupedColumns = (firstKey: string, firstLabel: string): ReportColumn<any>[] => [
    { key: firstKey, label: firstLabel, kind: firstKey === 'day' ? 'date' : 'text' },
    { key: 'entries', label: 'Entries', kind: 'number', total: true },
    { key: 'amount_total', label: 'Amount', kind: 'currency', total: true },
  ];

  const columns =
    groupBy === 'detail'
      ? (detailColumns as ReportColumn<any>[])
      : groupBy === 'category'
        ? groupedColumns('category_name', 'Category')
        : groupBy === 'date'
          ? groupedColumns('day', 'Date')
          : groupedColumns('payment_method', 'Payment Method');

  const summary: ReportSummaryItem[] = [
    { label: 'Entries', value: formatNumberIn(report.summary.entries ?? 0, language) },
    {
      label: config.total,
      value: formatMoneyIn(report.summary.amount_total ?? 0, currency, language),
      tone: config.tone,
    },
  ];

  return (
    <ReportTable
      title={config.title}
      hospitalName={hospitalName}
      periodLabel={`${from} to ${to}${status ? ` — ${status}` : ''}`}
      columns={columns}
      rows={report.rows}
      summary={summary}
      loading={report.loading}
      error={report.error}
      currency={currency}
      language={language}
      emptyMessage="No entries for this period and filter."
      filters={
        <>
          <DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              <option value="">All statuses</option>
              {STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          </Field>
        </>
      }
    />
  );
}

export function MoneyReports({ hospital, kind }: MoneyReportsProps) {
  const { i18n } = useTranslation();
  const config = KINDS[kind];

  const shared = {
    kind,
    hospitalId: Number(hospital.id),
    hospitalName: hospital.name,
    currency: 'AFN',
    language: i18n.language,
  };

  // The desk's own right, plus the two broad ones so existing roles keep
  // working. All four tabs share it: they are four arrangements of one set of
  // rows, not four different reports.
  const permissions = [
    kind === 'expense' ? 'view_reports_expenses' : 'view_reports_other_income',
    'view_reports',
    'manage_reports',
  ];

  const tabs: ModuleTab[] = [
    {
      key: 'detail',
      label: 'Detail',
      icon: <FileText className="w-3.5 h-3.5" />,
      anyPermissions: permissions,
      render: () => <MoneyTab {...shared} groupBy="detail" />,
    },
    {
      key: 'category',
      label: 'Category Wise',
      icon: <Tags className="w-3.5 h-3.5" />,
      anyPermissions: permissions,
      render: () => <MoneyTab {...shared} groupBy="category" />,
    },
    {
      key: 'date',
      label: 'Date Wise',
      icon: <CalendarDays className="w-3.5 h-3.5" />,
      anyPermissions: permissions,
      render: () => <MoneyTab {...shared} groupBy="date" />,
    },
    {
      key: 'method',
      label: 'Method Wise',
      icon: <Wallet className="w-3.5 h-3.5" />,
      anyPermissions: permissions,
      render: () => <MoneyTab {...shared} groupBy="method" />,
    },
  ];

  return <TabbedModulePage title={config.title} subtitle={config.subtitle} tabs={tabs} />;
}

export default MoneyReports;
