import api from '../../api/axios';

export async function listTestTemplates(params: Record<string, any> = {}) {
  const { data } = await api.get('/test-templates', { params });
  return data?.data ?? data;
}
