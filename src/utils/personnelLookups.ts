// src/utils/personnelLookups.ts

export type PersonnelLookupItem = { id: string; fullName: string };

/** Ofis kullanıcıları + saha ekibi; aynı id tekrar etmez, isme göre sıralı. */
export function mergeOfficeAndFieldPersonnel(
  officeUsers: PersonnelLookupItem[],
  fieldTeams: PersonnelLookupItem[],
): PersonnelLookupItem[] {
  const byId = new Map<string, PersonnelLookupItem>();
  for (const u of officeUsers) byId.set(u.id, u);
  for (const p of fieldTeams) {
    if (!byId.has(p.id)) byId.set(p.id, p);
  }
  return [...byId.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr'));
}
