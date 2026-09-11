import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Stethoscope, CalendarDays, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { Hospital, UserRole } from '../../types';
import { TabbedModulePage, type ModuleTab } from '../TabbedModulePage';
import { ReportTable, type ReportColumn, type ReportSummaryItem } from './ReportTable';
import { DateRangeFilter, useReport } from './reportPrimitives';
import { formatMoneyIn, formatNumberIn } from '../../utils/money';
import { StatusBadge } from '../ui/StatusBadge';
import {
  getClinicalReport,
  type ClinicalDayRow,
  type ClinicalDesk,
  type ClinicalDetailRow,
  type ClinicalDoctorRow,
  type ClinicalServiceRow,
} from '../../api/clinicalReports';

/**
 * Surgery, Room Booking, X-Ray and Ultrasound reports.
 *
 * One page, four desks. These modules raise different documents but a report
 * asks all four the same questions -- when, for whom, by which doctor, charged
 * what, collected what -- so they share a page rather than being four
 * copy-pasted files that drift apart one column at a time.
 */

const DESK_PERMISSION: Record<ClinicalDesk, string> = {
  surgery: 'view_reports_surgery',
  'room-booking': 'view_reports_room_booking',
  xray: 'view_reports_xray',
  ultrasound: 'view_reports_ultrasound',
};

const DESKS: Record<
  ClinicalDesk,
  { title: string; subtitle: string; serviceLabel: string; serviceTabLabel: string }
> = {
  surgery: {
    title: 'Surgery Reports',
    subtitle: 'Operations performed, by period, doctor and procedure',
    serviceLabel: 'Procedure',
    serviceTabLabel: 'Procedure Wise',
  },
  'room-booking': {
    title: 'Room Booking Reports',
    subtitle: 'Admissions and bed charges, by period, doctor and room',
    serviceLabel: 'Room',
    serviceTabLabel: 'Room Wise',
  },
  xray: {
    title: 'X-Ray Reports',
    subtitle: 'Films taken and fees collected, by period, doctor and study',
    serviceLabel: 'Study',
    serviceTabLabel: 'Study Wise',
  },
  ultrasound: {
    title: 'Ultrasound Reports',
    subtitle: 'Scans performed and fees collected, by period, doctor and exam type',
    serviceLabel: 'Exam Type',
    serviceTabLabel: 'Exam Type Wise',
  },
};

interface ClinicalReportsProps {
  hospital: Hospital;
  userRole: UserRole;
  desk: ClinicalDesk;
}

interface DeskTabProps {
  desk: ClinicalDesk;
  hospitalId: number;
  hospitalName: string;
  currency: string;
  language: string;
  groupBy: 'detail' | 'doctor' | 'date' | 'service';
}

function DeskTab({ desk, hospitalId, hospitalName, currency, language, groupBy }: DeskTabProps) {
  const config = DESKS[desk];
  const [from, setFrom] = useState(format(new Date(), 'yyyy-MM-01'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  /*
   * No Doctor dropdown here, deliberately.
   *
   * This desk already carries a Doctor Wise tab, which answers "how did each
   * doctor do" completely and in one place. Repeating a doctor combobox on the
   * Date Wise and Detail tabs as well gave two controls for one question and
   * made the toolbar look like a filter panel rather than a report. The tab is
   * the answer; the period is the only filter these tabs need.
   */
  const report = useReport<ClinicalDetailRow | ClinicalDoctorRow | ClinicalDayRow | ClinicalServiceRow>(
    useMemo(() => (params: any) => getClinicalReport(desk, params), [desk]),
    useMemo(
      () => ({
        hospital_id: hospitalId,
        date_from: from,
        date_to: to,
        group_by: groupBy,
      }),
      [hospitalId, from, to, groupBy]
    )
  );

  const money = (key: string): ReportColumn<any> => ({
    key,
    label: {
      gross_amount: 'Gross',
      discount_amount: 'Discount',
      net_amount: 'Net',
      paid_amount: 'Paid',
      due_amount: 'Due',
      gross_total: 'Gross',
      discount_total: 'Discount',
      net_total: 'Net',
      paid_total: 'Paid',
      due_total: 'Due',
    }[key] as string,
    kind: 'currency',
    total: true,
  });

  const detailColumns: ReportColumn<ClinicalDetailRow>[] = [
    { key: 'entry_date', label: 'Date', kind: 'date' },
    {
      key: 'patient_name',
      label: 'Patient',
      render: (row) => (
        <span>
          {row.patient_name}
          {row.patient_code ? (
            <span className="ml-1 text-[10px] text-gray-400">#{row.patient_code}</span>
          ) : null}
        </span>
      ),
    },
    { key: 'doctor_name', label: 'Doctor' },
    { key: 'service_name', label: config.serviceLabel },
    money('gross_amount'),
    money('discount_amount'),
    money('net_amount'),
    money('paid_amount'),
    money('due_amount'),
    {
      key: 'payment_status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.payment_status} />,
    },
  ];

  const groupedColumns = (firstKey: string, firstLabel: string): ReportColumn<any>[] => [
    { key: firstKey, label: firstLabel, kind: firstKey === 'day' ? 'date' : 'text' },
    { key: 'entries', label: 'Entries', kind: 'number', total: true },
    money('gross_total'),
    money('discount_total'),
    money('net_total'),
    money('paid_total'),
    money('due_total'),
  ];

  const columns =
    groupBy === 'detail'
      ? (detailColumns as ReportColumn<any>[])
      : groupBy === 'doctor'
        ? groupedColumns('doctor_name', 'Doctor')
        : groupBy === 'date'
          ? groupedColumns('day', 'Date')
          : groupedColumns('service_name', config.serviceLabel);

  const due = report.summary.due_total ?? 0;
  const summary: ReportSummaryItem[] = [
    { label: 'Entries', value: formatNumberIn(report.summary.entries ?? 0, language) },
    { label: 'Gross', value: formatMoneyIn(report.summary.gross_total ?? 0, currency, language) },
    {
      label: 'Discount',
      value: formatMoneyIn(report.summary.discount_total ?? 0, currency, language),
      tone: (report.summary.discount_total ?? 0) > 0 ? 'warn' : 'default',
    },
    {
      label: 'Net',
      value: formatMoneyIn(report.summary.net_total ?? 0, currency, language),
      tone: 'good',
    },
    {
      label: 'Collected / Due',
      value: `${formatMoneyIn(report.summary.paid_total ?? 0, currency, language)} / ${formatMoneyIn(due, currency, language)}`,
      tone: due > 0 ? 'bad' : 'good',
    },
  ];

  return (
    <ReportTable
      title={`${config.title} (${
        groupBy === 'detail'
          ? 'Detail'
          : groupBy === 'doctor'
            ? 'Doctor Wise'
            : groupBy === 'date'
              ? 'Date Wise'
              : config.serviceTabLabel
      })`}
      hospitalName={hospitalName}
      periodLabel={`${from} to ${to}`}
      columns={columns}
      rows={report.rows}
      summary={summary}
      loading={report.loading}
      error={report.error}
      currency={currency}
      language={language}
      rowClassName={(row: any) => ((row.due_amount ?? row.due_total ?? 0) > 0 ? 'bg-amber-50/60 dark:bg-amber-950/20' : '')}
      emptyMessage="No entries for this period."
      filters={<DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />}
    />
  );
}

export function ClinicalReports({ hospital, desk }: ClinicalReportsProps) {
  const { i18n } = useTranslation();
  const config = DESKS[desk];

  const shared = {
    desk,
    hospitalId: Number(hospital.id),
    hospitalName: hospital.name,
    currency: 'AFN',
    language: i18n.language,
  };

  /*
   * The desk's own permission, plus the two broad ones.
   *
   * `view_reports`/`manage_reports` are kept so existing roles keep working;
   * `view_reports_surgery` and friends are the fine grain to grant instead when
   * someone should see one desk and not the rest.
   *
   * All four tabs share it deliberately: they are four arrangements of the same
   * rows, so a right to see one is a right to see all four.
   */
  const permissions = [DESK_PERMISSION[desk], 'view_reports', 'manage_reports'];

  const tabs: ModuleTab[] = [
    {
      key: 'detail',
      label: 'Detail',
      icon: <FileText className="w-3.5 h-3.5" />,
      anyPermissions: permissions,
      render: () => <DeskTab {...shared} groupBy="detail" />,
    },
    {
      key: 'doctor',
      label: 'Doctor Wise',
      icon: <Stethoscope className="w-3.5 h-3.5" />,
      anyPermissions: permissions,
      render: () => <DeskTab {...shared} groupBy="doctor" />,
    },
    {
      key: 'date',
      label: 'Date Wise',
      icon: <CalendarDays className="w-3.5 h-3.5" />,
      anyPermissions: permissions,
      render: () => <DeskTab {...shared} groupBy="date" />,
    },
    {
      key: 'service',
      label: config.serviceTabLabel,
      icon: <Layers className="w-3.5 h-3.5" />,
      anyPermissions: permissions,
      render: () => <DeskTab {...shared} groupBy="service" />,
    },
  ];

  return <TabbedModulePage title={config.title} subtitle={config.subtitle} tabs={tabs} />;
}

export default ClinicalReports;
