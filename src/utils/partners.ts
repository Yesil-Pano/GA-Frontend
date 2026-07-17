export type RealPartnerKey = 'trugo' | 'tesla' | 'astor' | 'yesilpano';
export type PartnerKey = RealPartnerKey | 'all';

export interface PartnerOption {
  key: PartnerKey;
  name: string;
  letter: string;
  /** Varsa tenant UUID — Super Admin filtre + tenant admin kilidi */
  tenantId: string | null;
  /** OwnerCompany / isim eşlemesi */
  tokens: string[];
  /** Harita / rozet rengi (TÜMÜ için nötr) */
  color: string;
}

/** Firma renkleri (Super Admin harita) */
export const PARTNER_COLORS: Record<RealPartnerKey, string> = {
  yesilpano: '#000000', // Siyah
  trugo: '#2563EB', // Mavi
  tesla: '#DC2626', // Kırmızı
  astor: '#16A34A', // Yeşil
};

/** Rezerv (şimdilik kullanılmıyor) */
export const RESERVED_PARTNER_COLORS = {
  yellow: '#EAB308',
  gray: '#6B7280',
  brown: '#92400E',
} as const;

export const MIXED_CLUSTER_COLOR = RESERVED_PARTNER_COLORS.gray;
export const UNKNOWN_PARTNER_COLOR = RESERVED_PARTNER_COLORS.gray;

export const PARTNERS: PartnerOption[] = [
  {
    key: 'trugo',
    name: 'Trugo Şarj İstasyonları',
    letter: 'T',
    tenantId: 'c92cc573-957b-4862-8ae7-ff380efd15ce',
    tokens: ['trugo'],
    color: PARTNER_COLORS.trugo,
  },
  {
    key: 'tesla',
    name: 'TESLA',
    letter: 'S',
    tenantId: null,
    // Eski Unilever Algida verisi + yeni TESLA adı
    tokens: ['tesla', 'unilever', 'algida'],
    color: PARTNER_COLORS.tesla,
  },
  {
    key: 'astor',
    name: 'Astor Enerji',
    letter: 'E',
    tenantId: null,
    tokens: ['astor'],
    color: PARTNER_COLORS.astor,
  },
  {
    key: 'yesilpano',
    name: 'Yeşil Pano Projesi',
    letter: 'Y',
    tenantId: '475e2c63-5dca-41c8-ba0e-fd86917f32f0',
    tokens: ['yeşil', 'yesil'],
    color: PARTNER_COLORS.yesilpano,
  },
];

export const ALL_PARTNER: PartnerOption = {
  key: 'all',
  name: 'TÜMÜ',
  letter: '*',
  tenantId: null,
  tokens: [],
  color: MIXED_CLUSTER_COLOR,
};

/** Super Admin seçicide: TÜMÜ + firmalar */
export const SUPER_ADMIN_PARTNERS: PartnerOption[] = [ALL_PARTNER, ...PARTNERS];

export const DEFAULT_PARTNER = ALL_PARTNER;

const STORAGE_KEY = 'ga_active_partner_key';

function migratePartnerKey(raw: string | null): PartnerKey | null {
  if (!raw) return null;
  if (raw === 'unilever') return 'tesla';
  if (raw === 'all' || PARTNERS.some((p) => p.key === raw)) return raw as PartnerKey;
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
  localStorage.setItem(STORAGE_KEY, key);
}

export function getPartnerByKey(key: PartnerKey): PartnerOption {
  if (key === 'all') return ALL_PARTNER;
  return PARTNERS.find((p) => p.key === key) ?? DEFAULT_PARTNER;
}

export function getPartnerColor(key: PartnerKey | null | undefined): string {
  if (!key || key === 'all') return UNKNOWN_PARTNER_COLOR;
  return PARTNER_COLORS[key] ?? UNKNOWN_PARTNER_COLOR;
}

export function matchesPartner(
  partner: PartnerOption,
  opts: { tenantId?: string | null; ownerCompany?: string | null; name?: string | null },
): boolean {
  if (partner.key === 'all') return true;

  const hay = `${opts.ownerCompany ?? ''} ${opts.name ?? ''}`.toLocaleLowerCase('tr-TR');

  // OwnerCompany / isim token eşlemesi TenantId'den önce gelir
  for (const p of PARTNERS) {
    if (p.tokens.some((t) => hay.includes(t.toLocaleLowerCase('tr-TR')))) {
      return p.key === partner.key;
    }
  }

  if (partner.tenantId && opts.tenantId && opts.tenantId.toLowerCase() === partner.tenantId.toLowerCase()) {
    return true;
  }
  return false;
}

/** İstasyon / iş emri / ekip kaydından firma anahtarı çıkarır */
export function resolvePartnerKey(opts: {
  tenantId?: string | null;
  ownerCompany?: string | null;
  name?: string | null;
}): RealPartnerKey | null {
  const hay = `${opts.ownerCompany ?? ''} ${opts.name ?? ''}`.toLocaleLowerCase('tr-TR');

  for (const p of PARTNERS) {
    if (p.tokens.some((t) => hay.includes(t.toLocaleLowerCase('tr-TR')))) {
      return p.key as RealPartnerKey;
    }
  }

  if (opts.tenantId) {
    const byTenant = PARTNERS.find(
      (p) => p.tenantId && p.tenantId.toLowerCase() === opts.tenantId!.toLowerCase(),
    );
    if (byTenant) return byTenant.key as RealPartnerKey;
  }

  return null;
}
