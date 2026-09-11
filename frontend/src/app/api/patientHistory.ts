import api from '../../api/axios';

/**
 * One patient's record across every module.
 *
 * The server assembles the timeline -- nine modules, one sorted list -- so the
 * page never has to fetch nine endpoints and merge them by hand.
 */

export interface PatientHistoryEvent {
  id: string;
  module: string;
  date: string | null;
  title: string;
  reference: string | null;
  doctor_name: string | null;
  gross_amount: number;
  net_amount: number;
  status: string | null;
  payment_status: string | null;
}

export interface PatientHistoryProfile {
  id: number;
  patient_id: string;
  name: string;
  phone: string | null;
  age: number | null;
  gender: string | null;
  address: string | null;
  hospital_id: number;
  registered_at: string | null;
}

export interface PatientHistoryResponse {
  patient: PatientHistoryProfile;
  rows: PatientHistoryEvent[];
  summary: {
    events: number;
    modules: number;
    billed: number;
    first_visit: string | null;
    last_visit: string | null;
  };
  meta: {
    from: string;
    to: string;
    by_module: Record<string, number>;
    /** Modules whose query failed on this schema; named so nothing is silently missing. */
    skipped_modules: string[];
  };
}

export interface PatientSearchResult {
  id: number;
  patient_id: string;
  name: string;
  phone: string | null;
  age: number | null;
  gender: string | null;
}

export async function searchPatients(params: {
  hospital_id?: number;
  search?: string;
  /**
   * Defaults to 50, which is plenty for a typed search. The A–Z dropdown asks
   * for far more, because it is browsed rather than searched and a list that
   * stops at the letter B is not an alphabet.
   */
  per_page?: number;
}): Promise<PatientSearchResult[]> {
  const { data } = await api.get('/patients', {
    params: { per_page: 50, ...params },
  });
  // The endpoint paginates, so the rows are under `data` -- but a plain array
  // is accepted too, in case the shape changes.
  const rows = Array.isArray(data) ? data : (data?.data ?? []);

  return rows.map((row: any) => ({
    id: Number(row.id),
    patient_id: String(row.patient_id ?? ''),
    name: String(row.name ?? '-'),
    phone: row.phone ?? null,
    age: row.age ?? null,
    gender: row.gender ?? null,
  }));
}

export async function getPatientHistory(
  patientId: number,
  params: { date_from?: string; date_to?: string; module?: string } = {}
): Promise<PatientHistoryResponse> {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== '' && value !== null)
  );

  const { data } = await api.get(`/patients/${patientId}/history`, { params: clean });
  return data;
}

export interface PatientHistoryEventDetail {
  module: string;
  title: string;
  /** Labelled fields, already plain text — the server strips stored HTML. */
  fields: Array<{ label: string; value: string }>;
  /** Line items, where the record has any (prescription lines, lab results). */
  items: { columns: string[]; rows: Array<Array<string | null>> } | null;
}

/**
 * One record from the timeline, in full.
 *
 * `eventId` is the composite id the timeline row carries ("Laboratory-1403"),
 * split here so callers pass the row back rather than reassembling it.
 */
export async function getPatientHistoryEvent(
  patientId: number,
  eventId: string
): Promise<PatientHistoryEventDetail> {
  const separator = eventId.lastIndexOf('-');
  const module = eventId.slice(0, separator);
  const recordId = eventId.slice(separator + 1);

  const { data } = await api.get(
    `/patients/${patientId}/history/${encodeURIComponent(module)}/${recordId}`
  );

  return data;
}
