import api from './axios';
import { TestTemplate, TestParameter } from '../app/types';

// Response types matching backend
export interface TestTemplateResponse {
  id: number;
  hospital_id: number;
  test_code: string;
  test_name: string;
  test_type: string;
  category: string;
  description: string | null;
  sample_type: string;
  price: string;
  duration: string | null;
  instructions: string | null;
  status: 'active' | 'inactive';
  requires_result?: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  parameters: ParameterResponse[];
}

export interface ParameterResponse {
  id: number;
  test_template_id: number;
  name: string;
  unit: string | null;
  normal_range: string | null;
  description: string | null;
  sort_order: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

// Transform backend response to frontend type
function transformToFrontend(item: TestTemplateResponse): TestTemplate {
  return {
    id: String(item.id),
    hospitalId: String(item.hospital_id),
    testCode: item.test_code,
    testName: item.test_name,
    testType: item.test_type,
    category: item.category || 'Routine',
    description: item.description || undefined,
    sampleType: item.sample_type,
    parameters: (item.parameters || []).map((p) => ({
      parameterName: p.name,
      unit: p.unit || '',
      normalRange: p.normal_range || '',
      description: p.description || undefined,
    })),
    price: parseFloat(item.price) || 0,
    duration: item.duration || '',
    instructions: item.instructions || undefined,
    status: item.status,
    // Older records predate the column; a missing value means the laboratory
    // still enters results, which is what every existing test did.
    requiresResult: item.requires_result !== false,
    createdAt: new Date(item.created_at),
    createdBy: item.created_by || 'system',
    updatedAt: item.updated_at ? new Date(item.updated_at) : undefined,
    updatedBy: item.updated_by || undefined,
  };
}

// Transform frontend type to backend payload
function transformToBackend(
  template: Partial<TestTemplate> & { hospitalId: string }
): Record<string, unknown> {
  return {
    hospital_id: Number(template.hospitalId),
    test_code: template.testCode,
    test_name: template.testName,
    test_type: template.testType,
    category: template.category || 'Routine',
    description: template.description || null,
    sample_type: template.sampleType,
    price: template.price || 0,
    duration: template.duration || null,
    instructions: template.instructions || null,
    status: template.status || 'active',
    requires_result: template.requiresResult !== false,
    parameters: (template.parameters || [])
      .filter((p) => p.parameterName?.trim())
      .map((p, index) => ({
        name: p.parameterName,
        unit: p.unit || null,
        normal_range: p.normalRange || null,
        description: p.description || null,
        sort_order: index,
      })),
  };
}

export async function fetchTestTemplates(
  hospitalId?: string | number,
  search?: string,
  page = 1,
  perPage = 50
): Promise<{ data: TestTemplate[]; total: number; lastPage: number }> {
  const params: Record<string, string | number> = { page, per_page: perPage };
  if (hospitalId) params.hospital_id = hospitalId;
  if (search) params.search = search;

  const response = await api.get<PaginatedResponse<TestTemplateResponse>>(
    '/test-templates',
    { params }
  );

  return {
    data: response.data.data.map(transformToFrontend),
    total: response.data.total,
    lastPage: response.data.last_page,
  };
}

/**
 * Every test template for a hospital, walking the paginator rather than keeping
 * only the first page.
 *
 * A lab catalogue routinely runs past a hundred entries, and the single 50-row
 * request this replaces silently dropped the rest -- the tests were registered
 * but simply never appeared in the list.
 */
export async function fetchAllTestTemplates(
  hospitalId?: string | number,
  search?: string
): Promise<TestTemplate[]> {
  const records: TestTemplate[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const { data, lastPage: pages } = await fetchTestTemplates(hospitalId, search, page, 200);
    if (data.length === 0) break; // a malformed paginator must not loop forever
    records.push(...data);
    lastPage = pages;
    page += 1;
  } while (page <= lastPage && page <= 100);

  return records;
}

export async function fetchTestTemplate(id: string | number): Promise<TestTemplate> {
  const response = await api.get<{ data: TestTemplateResponse }>(
    `/test-templates/${id}`
  );
  return transformToFrontend(response.data.data);
}

export async function createTestTemplate(
  template: Partial<TestTemplate> & { hospitalId: string }
): Promise<TestTemplate> {
  const payload = transformToBackend(template);
  const response = await api.post<{ data: TestTemplateResponse }>(
    '/test-templates',
    payload
  );
  return transformToFrontend(response.data.data);
}

export async function updateTestTemplate(
  id: string | number,
  template: Partial<TestTemplate> & { hospitalId: string }
): Promise<TestTemplate> {
  const payload = transformToBackend(template);
  const response = await api.put<{ data: TestTemplateResponse }>(
    `/test-templates/${id}`,
    payload
  );
  return transformToFrontend(response.data.data);
}

export async function deleteTestTemplate(id: string | number): Promise<void> {
  await api.delete(`/test-templates/${id}`);
}
