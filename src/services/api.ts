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
import { API_BASE_URL } from './apiConfig';

const api = axios.create({
  baseURL: API_BASE_URL,
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

function isPublicAuthRequest(url?: string): boolean {
  if (!url) return false;
  return url.includes('/auth/login')
    || url.includes('/auth/refresh')
    || url.includes('/auth/logout');
}

api.interceptors.request.use(async (config) => {
  const publicAuth = isPublicAuthRequest(config.url);
  let token = publicAuth ? null : getAccessToken();

  if (token && shouldRefreshAccessToken(token, 30)) {
    await tryRefreshSession();
    token = getAccessToken();
  }

  if (token && !publicAuth) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  try {
    if (token && !publicAuth && isSuperAdmin()) {
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
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
