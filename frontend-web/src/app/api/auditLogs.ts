import api from '../../api/axios';

export interface AuditLogApi {
  id: number;
  hospital_id: number | null;
  user_id: number | null;
  user_name: string | null;
  user_role: string | null;
  module: string;
  action: string;
  record_id: string | null;
  record_label: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  url: string | null;
  method: string | null;
  description: string | null;
  created_at: string;
}

export interface AuditLogFilterOptions {
  modules: string[];
  actions: string[];
  users: Array<{ id: string; name: string | null }>;
}

export interface AuditLogPage {
  data: AuditLogApi[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface AuditLogQuery {
  search?: string;
  module?: string;
  action?: string;
  user_id?: string;
  start_date?: string;
  end_date?: string;
  hospital_id?: string;
  page?: number;
  per_page?: number;
}

/** Strip empty filter values so they are not sent as blank query params. */
function clean(params: AuditLogQuery): Record<string, any> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== 'all')
  );
}

export async function listAuditLogs(params: AuditLogQuery = {}): Promise<AuditLogPage> {
  const { data } = await api.get('/audit-logs', { params: clean(params) });
  return data;
}

export async function getAuditLogFilters(params: AuditLogQuery = {}): Promise<AuditLogFilterOptions> {
  const { data } = await api.get('/audit-logs/filters', { params: clean(params) });
  return data;
}

export async function exportAuditLogs(params: AuditLogQuery = {}): Promise<AuditLogApi[]> {
  const { data } = await api.get('/audit-logs/export', { params: clean(params) });
  return data?.data ?? data;
}

/**
 * Report an activity the API cannot observe on its own (printing a document,
 * exporting a grid). Best-effort: a failure here must never block the user.
 */
export async function recordAuditEvent(payload: {
  module: string;
  action: 'print' | 'export' | 'view';
  record_id?: string | number | null;
  record_label?: string | null;
  description?: string | null;
}): Promise<void> {
  try {
    await api.post('/audit-logs/events', {
      ...payload,
      record_id: payload.record_id == null ? undefined : String(payload.record_id),
    });
  } catch {
    // Auditing is never allowed to interrupt the user's action.
  }
}
