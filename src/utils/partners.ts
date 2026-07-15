export type PartnerKey = 'trugo' | 'unilever' | 'astor' | 'yesilpano';

export interface PartnerOption {
  key: PartnerKey;
  name: string;
  letter: string;
  /** Varsa tenant UUID — Super Admin filtre + tenant admin kilidi */
  tenantId: string | null;
  /** OwnerCompany / isim eşlemesi */
  tokens: string[];
}

export const PARTNERS: PartnerOption[] = [
  {
    key: 'trugo',
    name: 'Trugo Şarj İstasyonları',
    letter: 'T',
    tenantId: 'c92cc573-957b-4862-8ae7-ff380efd15ce',
    tokens: ['trugo'],
  },
  {
    key: 'unilever',
    name: 'Unilever Algida',
    letter: 'A',
    tenantId: null,
    tokens: ['unilever', 'algida'],
  },
  {
    key: 'astor',
    name: 'Astor Enerji',
    letter: 'E',
    tenantId: null,
    tokens: ['astor'],
  },
  {
    key: 'yesilpano',
    name: 'Yeşil Pano Projesi',
    letter: 'Y',
    tenantId: '475e2c63-5dca-41c8-ba0e-fd86917f32f0',
    tokens: ['yeşil', 'yesil'],
  },
];

export const DEFAULT_PARTNER = PARTNERS[0];

const STORAGE_KEY = 'ga_active_partner_key';

export function getStoredPartnerKey(): PartnerKey {
  const raw = localStorage.getItem(STORAGE_KEY) as PartnerKey | null;
  if (raw && PARTNERS.some((p) => p.key === raw)) return raw;
  return DEFAULT_PARTNER.key;
}

export function storePartnerKey(key: PartnerKey) {
  localStorage.setItem(STORAGE_KEY, key);
}

export function getPartnerByKey(key: PartnerKey): PartnerOption {
  return PARTNERS.find((p) => p.key === key) ?? DEFAULT_PARTNER;
}

export function matchesPartner(
  partner: PartnerOption,
  opts: { tenantId?: string | null; ownerCompany?: string | null; name?: string | null },
): boolean {
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
