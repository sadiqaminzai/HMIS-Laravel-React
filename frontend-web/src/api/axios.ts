import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
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
