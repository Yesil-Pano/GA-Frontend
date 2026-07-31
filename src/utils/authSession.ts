export const EMPTY_TENANT_ID = '00000000-0000-0000-0000-000000000000';
export const AUTH_PROFILE_KEY = 'ga_auth_profile';

/** Eski token'lar için geriye dönük uyumluluk */
const LEGACY_SUPER_ADMIN_EMAIL = 'admin@theobuz.com';

export interface AuthProfile {
  userId?: string;
  username?: string;
  email?: string;
  fullName?: string;
  tenantId?: string | null;
  roles: string[];
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!base64) return null;
    return JSON.parse(window.atob(base64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseJwtPayload(token?: string | null): Record<string, unknown> | null {
  const t = token ?? localStorage.getItem('token');
  if (!t) return null;
  return decodeJwtPayload(t);
}

export function getJwtTenantId(token?: string | null): string | null {
  const payload = parseJwtPayload(token);
  if (!payload) return null;
  return typeof payload.TenantId === 'string' ? payload.TenantId : null;
}

function getEmailFromPayload(payload: Record<string, unknown>): string | undefined {
  const email = payload.email ?? payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
  return typeof email === 'string' ? email : undefined;
}

export function getRolesFromPayload(payload: Record<string, unknown>): string[] {
  const roles: string[] = [];
  const keys = [
    'role',
    'roles',
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
  ];
  for (const key of keys) {
    const val = payload[key];
    if (typeof val === 'string') roles.push(val);
    else if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === 'string') roles.push(item);
      }
    }
  }
  return roles;
}

export function getRolesFromToken(token?: string | null): string[] {
  const payload = parseJwtPayload(token);
  return payload ? getRolesFromPayload(payload) : [];
}

export function getAuthProfile(): AuthProfile | null {
  try {
    const raw = localStorage.getItem(AUTH_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthProfile;
    if (!Array.isArray(parsed.roles)) parsed.roles = [];
    return parsed;
  } catch {
    return null;
  }
}

export function saveAuthProfile(profile: AuthProfile): void {
  localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(profile));
}

export function saveAuthProfileFromLogin(data: {
  userId?: string;
  username?: string;
  fullName?: string;
  roles?: string[];
}): void {
  const existing = getAuthProfile();
  saveAuthProfile({
    userId: data.userId ?? existing?.userId,
    username: data.username ?? existing?.username,
    fullName: data.fullName ?? existing?.fullName,
    email: existing?.email,
    tenantId: existing?.tenantId,
    roles: data.roles ?? existing?.roles ?? [],
  });
}

export function saveAuthProfileFromMeResponse(data: {
  id?: string;
  email?: string;
  fullName?: string;
  tenantId?: string | null;
  roles?: string[];
}): void {
  saveAuthProfile({
    userId: data.id,
    email: data.email,
    fullName: data.fullName,
    tenantId: data.tenantId ?? EMPTY_TENANT_ID,
    roles: data.roles ?? [],
  });
}

export function clearAuthSession(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('isAuthenticated');
  localStorage.removeItem(AUTH_PROFILE_KEY);
}

export function hasRole(roleName: string, profile?: AuthProfile | null): boolean {
  const normalized = roleName.toLowerCase();
  const p = profile ?? getAuthProfile();
  if (p?.roles.some((r) => r.toLowerCase() === normalized)) return true;
  return getRolesFromToken().some((r) => r.toLowerCase() === normalized);
}

/** Süper Admin: boş tenant, SuperAdmin rolü veya (eski token) legacy e-posta */
export function isSuperAdmin(profile?: AuthProfile | null): boolean {
  const p = profile ?? getAuthProfile();
  if (p) {
    if (!p.tenantId || p.tenantId === EMPTY_TENANT_ID) return true;
    if (p.roles.some((r) => r.toLowerCase() === 'superadmin')) return true;
  }

  const payload = parseJwtPayload();
  if (payload) {
    const tenantId = typeof payload.TenantId === 'string' ? payload.TenantId : null;
    if (!tenantId || tenantId === EMPTY_TENANT_ID) return true;
    if (getRolesFromPayload(payload).some((r) => r.toLowerCase() === 'superadmin')) return true;
    const email = getEmailFromPayload(payload);
    if (email?.toLowerCase() === LEGACY_SUPER_ADMIN_EMAIL) return true;
  }

  return false;
}

export function isTenantAdmin(profile?: AuthProfile | null): boolean {
  return hasRole('TenantAdmin', profile);
}
