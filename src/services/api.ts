import axios from 'axios';
import { getStoredPartnerKey } from '../utils/partners';

const api = axios.create({
  baseURL: 'https://204.168.249.86:8443/api'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  try {
    if (token) {
      const payload = JSON.parse(window.atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.email === 'admin@theobuz.com') {
        const partnerKey = getStoredPartnerKey();
        config.params = { ...(config.params || {}), partnerKey };
      }
    }
  } catch {
    /* ignore */
  }

  return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    if (status === 401 || code === 'DEMO_EXPIRED' || code === 'TENANT_INACTIVE') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (code === 'DEMO_EXPIRED') {
        sessionStorage.setItem('ga_logout_reason', 'Demo süreniz dolmuştur. Erişim kapatıldı.');
      }
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
