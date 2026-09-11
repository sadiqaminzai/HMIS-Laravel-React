import api from '../../api/axios';
import type { ReportEnvelope } from './pharmacyReports';

/**
 * Surgery, Room Booking, X-Ray, Ultrasound, Expenses and Other Income reports.
 *
 * Same envelope as the pharmacy reports, so the shared ReportTable renders all
 * of them. The four clinical desks answer the same shape of question, which is
 * why they share one row type rather than four near-identical ones.
 */

export type ClinicalDesk = 'surgery' | 'room-booking' | 'xray' | 'ultrasound';

export interface ClinicalReportParams {
  hospital_id?: number;
  date_from?: string;
  date_to?: string;
  /** 'detail' | 'doctor' | 'date' | 'service' */
  group_by?: string;
  doctor_id?: number;
  payment_status?: string;
  category_id?: number;
  payment_method?: string;
  status?: string;
}

const get = async <TRow>(path: string, params: ClinicalReportParams): Promise<ReportEnvelope<TRow>> => {
  // An undefined entry would serialise as `?doctor_id=` and be read
  // server-side as "the doctor whose id is empty", which matches nothing.
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== '' && value !== null)
  );

  const { data } = await api.get(`/reports/${path}`, { params: clean });

  return {
    rows: Array.isArray(data?.rows) ? data.rows : [],
    summary: data?.summary ?? {},
    meta: data?.meta ?? {},
  };
};

export interface ClinicalDetailRow {
  id: number;
  entry_date: string | null;
  patient_name: string;
  patient_code: string | null;
  doctor_name: string;
  service_name: string;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  paid_amount: number;
  due_amount: number;
  payment_status: string | null;
}

export interface ClinicalDoctorRow {
  doctor_id: number | null;
  doctor_name: string;
  entries: number;
  gross_total: number;
  discount_total: number;
  net_total: number;
  paid_total: number;
  due_total: number;
}

export interface ClinicalDayRow extends Omit<ClinicalDoctorRow, 'doctor_id' | 'doctor_name'> {
  day: string;
}

export interface ClinicalServiceRow extends Omit<ClinicalDoctorRow, 'doctor_id' | 'doctor_name'> {
  service_name: string;
}

export interface MoneyDetailRow {
  id: number;
  sequence_id: number | null;
  entry_date: string;
  title: string;
  category_name: string;
  payment_method: string;
  reference: string;
  status: string;
  amount: number;
}

export interface MoneyGroupRow {
  category_name?: string;
  payment_method?: string;
  day?: string;
  entries: number;
  amount_total: number;
}

export interface ReportDoctorOption {
  id: number;
  name: string;
  /** How many rows this doctor has on this desk in the chosen period. */
  entries: number;
}

export const getClinicalReport = (desk: ClinicalDesk, params: ClinicalReportParams) =>
  get<ClinicalDetailRow | ClinicalDoctorRow | ClinicalDayRow | ClinicalServiceRow>(desk, params);

/**
 * Doctors that actually appear on this desk in this period.
 *
 * Scoped to the period rather than listing every doctor in the hospital, so the
 * dropdown cannot offer a choice that returns an empty report.
 */
export const getReportDoctors = async (
  desk: ClinicalDesk,
  params: ClinicalReportParams
): Promise<ReportDoctorOption[]> => {
  const envelope = await get<ReportDoctorOption>(`${desk}/doctors`, params);
  return envelope.rows;
};

export const getExpenseReport = (params: ClinicalReportParams) =>
  get<MoneyDetailRow | MoneyGroupRow>('expenses', params);

export const getOtherIncomeReport = (params: ClinicalReportParams) =>
  get<MoneyDetailRow | MoneyGroupRow>('other-income', params);
