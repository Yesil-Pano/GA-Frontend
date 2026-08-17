// src/utils/sessionTokens.ts

const ACCESS_KEY = 'token';
const REFRESH_KEY = 'refresh_token';
export const REMEMBER_ME_KEY = 'ga_remember_me';

export function decodeJwtExp(token: string): number | null {
  try {
    const base64 = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!base64) return null;
    const payload = JSON.parse(window.atob(base64)) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

export function shouldRefreshAccessToken(token: string, withinMinutes = 30): boolean {
  const exp = decodeJwtExp(token);
  if (!exp) return true;
  const nowSec = Math.floor(Date.now() / 1000);
  return exp - nowSec <= withinMinutes * 60;
}

function getActiveStorage(): Storage | null {
  if (sessionStorage.getItem(ACCESS_KEY) || sessionStorage.getItem(REFRESH_KEY)) {
    return sessionStorage;
  }
  if (localStorage.getItem(ACCESS_KEY) || localStorage.getItem(REFRESH_KEY)) {
    return localStorage;
  }
  return null;
}

export function getRememberMePreference(): boolean {
  return localStorage.getItem(REMEMBER_ME_KEY) !== 'false';
}

export function setRememberMePreference(remember: boolean): void {
  localStorage.setItem(REMEMBER_ME_KEY, remember ? 'true' : 'false');
}

export function saveSessionTokens(
  accessToken: string,
  refreshToken?: string | null,
  rememberMe = true,
): void {
  clearSessionTokens();
  setRememberMePreference(rememberMe);
  const store = rememberMe ? localStorage : sessionStorage;
  store.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) {
    store.setItem(REFRESH_KEY, refreshToken);
  }
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_KEY) ?? localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_KEY) ?? localStorage.getItem(REFRESH_KEY);
}

export function hasStoredSession(): boolean {
  return !!(getAccessToken() || getRefreshToken());
}

export function clearSessionTokens(): void {
  for (const store of [sessionStorage, localStorage]) {
    store.removeItem(ACCESS_KEY);
    store.removeItem(REFRESH_KEY);
  }
}

let refreshInFlight: Promise<boolean> | null = null;

export async function tryRefreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
      const { refreshAuthSession } = await import('../services/authApi');
      const data = await refreshAuthSession(refreshToken);
      if (!data.token) return false;

      const rememberMe = getActiveStorage() === localStorage || getRememberMePreference();
      saveSessionTokens(data.token, data.refreshToken ?? refreshToken, rememberMe);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function logoutSession(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      const { logoutAuthSession } = await import('../services/authApi');
      await logoutAuthSession(refreshToken);
    } catch {
      /* sunucu revoke başarısız olsa da yerel oturumu kapat */
    }
  }
  clearSessionTokens();
}
