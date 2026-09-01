import axios from 'axios';

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const resolveApiBaseUrl = () => {
  const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

  if (configuredBaseUrl) {
    if (/^https?:\/\//i.test(configuredBaseUrl)) {
      return stripTrailingSlash(configuredBaseUrl);
    }

    if (typeof window !== 'undefined') {
      const hostBase = `${window.location.protocol}//${window.location.hostname}`;
      if (configuredBaseUrl.startsWith('/')) {
        return stripTrailingSlash(`${hostBase}${configuredBaseUrl}`);
      }

      return stripTrailingSlash(`${hostBase}/${configuredBaseUrl.replace(/^\/+/, '')}`);
    }
  }

  if (typeof window !== 'undefined') {
    return stripTrailingSlash(`${window.location.protocol}//${window.location.hostname}/shifaascript/backend/public/api`);
  }

  return 'http://localhost/shifaascript/backend/public/api';
};

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  // A file upload must not inherit the instance's JSON content type. With it
  // set, axios serialises the FormData as JSON and sends "{}" -- the request
  // arrives with no file at all and the server rejects it as missing. Clearing
  // the header lets the browser write multipart/form-data with the boundary
  // that actually delimits the parts.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers = config.headers || {};
    delete (config.headers as Record<string, unknown>)['Content-Type'];
    delete (config.headers as Record<string, unknown>)['content-type'];
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    // If token expired/invalid, clear stored auth so app can redirect to login.
    if (status === 401) {
      try {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      } catch {
        // ignore
      }
    }

    return Promise.reject(error);
  }
);

export default api;
