/** API'den gelen UTC zamanı Türkiye saatine (GMT+3) çevirir. */
export function formatTurkeyDateTime(value: string | null | undefined): string {
  if (!value) return '';

  const date = parseApiDateTime(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = turkeyParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

/** datetime-local input için Türkiye duvar saati (YYYY-MM-DDTHH:mm). */
export function toTurkeyDateTimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const date = parseApiDateTime(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = turkeyParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** Gerçek başlangıç → bitiş süresi (dakika). */
export function durationMinutes(
  startedAt?: string | null,
  completedAt?: string | null,
): number | null {
  if (!startedAt || !completedAt) return null;
  const start = parseApiDateTime(startedAt);
  const end = parseApiDateTime(completedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const mins = Math.round((end.getTime() - start.getTime()) / 60_000);
  return mins < 0 ? 0 : mins;
}

function turkeyParts(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
}

export function parseApiDateTime(value: string): Date {
  // Eski format: "yyyy-MM-dd HH:mm" (UTC, timezone bilgisi yok)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value) && !value.includes('T')) {
    return new Date(value.replace(' ', 'T') + ':00Z');
  }
  return new Date(value);
}
