import trugoLogo from '../assets/trugo-logo.png';
import teslaLogo from '../assets/tesla-logo.png';
import yesilPanoLogo from '../assets/yesil-pano-logo.png';
import astorLogo from '../assets/astor-sarj-logo.jpg';

/** Super Admin firma seçici anahtarı. 'all' = TÜMÜ. */
export type PartnerKey = string;

export interface PartnerOption {
  key: PartnerKey;
  name: string;
  letter: string;
  tenantId: string | null;
  tokens: string[];
  color: string;
}

export interface PartnerApiItem {
  key: string;
  name: string;
  letter: string;
  tenantId: string | null;
  tokens: string[];
}

const KNOWN_LOGOS: Record<string, string> = {
  trugo: trugoLogo,
  tesla: teslaLogo,
  yesilpano: yesilPanoLogo,
  astor: astorLogo,
};

const KNOWN_COLORS: Record<string, string> = {
  yesilpano: '#000000',
  trugo: '#2563EB',
  tesla: '#DC2626',
  astor: '#16A34A',
};

const FALLBACK_COLORS = ['#2563EB', '#DC2626', '#16A34A', '#CA8A04', '#9333EA', '#0891B2', '#EA580C'];

export const RESERVED_PARTNER_COLORS = {
  yellow: '#EAB308',
  gray: '#6B7280',
  brown: '#92400E',
} as const;

export const MIXED_CLUSTER_COLOR = RESERVED_PARTNER_COLORS.gray;
export const UNKNOWN_PARTNER_COLOR = RESERVED_PARTNER_COLORS.gray;

export function getPartnerLogo(key: PartnerKey | null | undefined): string | null {
  if (!key || key === 'all') return null;
  return KNOWN_LOGOS[key.toLowerCase()] ?? null;
}

function hashColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

export function getPartnerColor(key: PartnerKey | null | undefined): string {
  if (!key || key === 'all') return UNKNOWN_PARTNER_COLOR;
  return KNOWN_COLORS[key.toLowerCase()] ?? hashColor(key.toLowerCase());
}

const STATIC_PARTNERS: PartnerOption[] = [
  { key: 'trugo', name: 'TRUGO', letter: 'T', tenantId: 'c92cc573-957b-4862-8ae7-ff380efd15ce', tokens: ['trugo'], color: KNOWN_COLORS.trugo },
  { key: 'tesla', name: 'TESLA', letter: 'T', tenantId: null, tokens: ['tesla', 'unilever', 'algida'], color: KNOWN_COLORS.tesla },
  { key: 'astor', name: 'Astor Enerji', letter: 'A', tenantId: null, tokens: ['astor'], color: KNOWN_COLORS.astor },
  { key: 'yesilpano', name: 'Yeşil Pano', letter: 'Y', tenantId: '475e2c63-5dca-41c8-ba0e-fd86917f32f0', tokens: ['yeşil', 'yesil'], color: KNOWN_COLORS.yesilpano },
];

export const ALL_PARTNER: PartnerOption = {
  key: 'all',
  name: 'TÜMÜ',
  letter: '*',
  tenantId: null,
  tokens: [],
  color: MIXED_CLUSTER_COLOR,
};

let partners: PartnerOption[] = [...STATIC_PARTNERS];
let superAdminPartners: PartnerOption[] = [ALL_PARTNER, ...partners];

function mapApiItemToPartner(item: PartnerApiItem): PartnerOption | null {
  if (item.key === 'all') return null;
  const key = item.key.trim().toLowerCase();
  if (!key) return null;
  return {
    key,
    name: item.name,
    letter: item.letter || item.name.trim()[0]?.toUpperCase() || '?',
    tenantId: item.tenantId,
    tokens: item.tokens ?? [],
    color: getPartnerColor(key),
  };
}

/** GET /api/partners yanıtını UI listesine uygular (kaynak: Tenants tablosu). */
export function applyPartnerApiData(apiItems: PartnerApiItem[]) {
  if (!Array.isArray(apiItems) || apiItems.length === 0) return;

  const merged = apiItems
    .map(mapApiItemToPartner)
    .filter((p): p is PartnerOption => p != null);

  if (merged.length === 0) return;

  partners = merged;
  const allFromApi = apiItems.find((p) => p.key === 'all');
  superAdminPartners = [
    allFromApi
      ? { ...ALL_PARTNER, name: allFromApi.name, letter: allFromApi.letter || ALL_PARTNER.letter }
      : ALL_PARTNER,
    ...partners,
  ];
}

export function getPartnersList(): PartnerOption[] {
  return partners;
}

export function getSuperAdminPartnersList(): PartnerOption[] {
  return superAdminPartners;
}

export const DEFAULT_PARTNER = ALL_PARTNER;

const STORAGE_KEY = 'ga_active_partner_key';

function migratePartnerKey(raw: string | null): PartnerKey | null {
  if (!raw) return null;
  if (raw === 'unilever') return 'tesla';
  if (raw === 'all') return 'all';
  const normalized = raw.trim().toLowerCase();
  if (getPartnersList().some((p) => p.key === normalized)) return normalized;
  return null;
}

export function getStoredPartnerKey(): PartnerKey {
  const migrated = migratePartnerKey(localStorage.getItem(STORAGE_KEY));
  if (migrated) {
    if (localStorage.getItem(STORAGE_KEY) === 'unilever') {
      localStorage.setItem(STORAGE_KEY, 'tesla');
    }
    return migrated;
  }
  return DEFAULT_PARTNER.key;
}

export function storePartnerKey(key: PartnerKey) {
  localStorage.setItem(STORAGE_KEY, key === 'all' ? 'all' : key.trim().toLowerCase());
}

export function getPartnerByKey(key: PartnerKey): PartnerOption {
  if (key === 'all') return ALL_PARTNER;
  const normalized = key.trim().toLowerCase();
  return getPartnersList().find((p) => p.key === normalized) ?? ALL_PARTNER;
}

export function getPartnerByTenantId(tenantId: string | null | undefined): PartnerOption | null {
  if (!tenantId) return null;
  const found = getPartnersList().find(
    (p) => p.tenantId && p.tenantId.toLowerCase() === tenantId.toLowerCase(),
  );
  return found ?? null;
}

export function matchesPartner(
  partner: PartnerOption,
  opts: { tenantId?: string | null; ownerCompany?: string | null; name?: string | null },
): boolean {
  if (partner.key === 'all') return true;

  const hay = `${opts.ownerCompany ?? ''} ${opts.name ?? ''}`.toLocaleLowerCase('tr-TR');

  for (const p of getPartnersList()) {
    if (p.tokens.some((t) => hay.includes(t.toLocaleLowerCase('tr-TR')))) {
      return p.key === partner.key;
    }
  }

  if (partner.tenantId && opts.tenantId && opts.tenantId.toLowerCase() === partner.tenantId.toLowerCase()) {
    return true;
  }
  return false;
}

export function resolvePartnerKey(opts: {
  tenantId?: string | null;
  ownerCompany?: string | null;
  name?: string | null;
}): string | null {
  const hay = `${opts.ownerCompany ?? ''} ${opts.name ?? ''}`.toLocaleLowerCase('tr-TR');

  for (const p of getPartnersList()) {
    if (p.tokens.some((t) => hay.includes(t.toLocaleLowerCase('tr-TR')))) {
      return p.key;
    }
  }

  if (opts.tenantId) {
    const byTenant = getPartnersList().find(
      (p) => p.tenantId && p.tenantId.toLowerCase() === opts.tenantId!.toLowerCase(),
    );
    if (byTenant) return byTenant.key;
  }

  return null;
}
