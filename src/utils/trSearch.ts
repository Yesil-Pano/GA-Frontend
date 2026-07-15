/** Türkçe duyarsız arama: İstanbul/istanbul, İzmir/izmir eşleşir. */
export function trFold(value: string): string {
  return value
    .replace(/\u0130/g, 'i') // İ → i
    .replace(/\u0049/g, 'ı') // I → ı
    .toLocaleLowerCase('tr-TR');
}

export function trIncludes(haystack: string | null | undefined, needle: string | null | undefined): boolean {
  if (!needle?.trim()) return true;
  if (!haystack) return false;
  return trFold(haystack).includes(trFold(needle.trim()));
}

export function trEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return trFold(a) === trFold(b);
}
