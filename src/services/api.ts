// src/services/api.ts
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { getStoredPartnerKey } from '../utils/partners';
import { clearAuthSession, isSuperAdmin } from '../utils/authSession';
import {
  clearSessionTokens,
  getAccessToken,
  shouldRefreshAccessToken,
  tryRefreshSession,
} from '../utils/sessionTokens';

const api = axios.create({
  // baseURL: 'https://204.168.249.86:8443/api',
  baseURL: 'https://gorevadami.net/api',
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.request.use(async (config) => {
  let token = getAccessToken();
  if (token && shouldRefreshAccessToken(token, 30)) {
    await tryRefreshSession();
    token = getAccessToken();
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  try {
    if (token && isSuperAdmin()) {
      const partnerKey = getStoredPartnerKey();
      config.params = { ...(config.params || {}), partnerKey };
    }
  } catch {
    /* ignore */
  }

  return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const code = (error.response?.data as { code?: string })?.code;
    const original = error.config as RetryConfig | undefined;

    const isAuthEndpoint =
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/refresh');

    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      const refreshed = await tryRefreshSession();
      if (refreshed) {
        const token = getAccessToken();
        if (token) {
          original.headers.Authorization = `Bearer ${token}`;
        }
        return api.request(original);
      }
    }

    if (status === 401 || code === 'DEMO_EXPIRED' || code === 'TENANT_INACTIVE') {
      clearSessionTokens();
      clearAuthSession();
      if (code === 'DEMO_EXPIRED') {
        sessionStorage.setItem('ga_logout_reason', 'Demo süreniz dolmuştur. Erişim kapatıldı.');
      }
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
