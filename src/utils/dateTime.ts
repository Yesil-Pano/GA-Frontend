// src/utils/dateTime.ts

const TR_TIMEZONE = 'Europe/Istanbul';

/** API'den gelen UTC zamanı Türkiye saatine çevirir → 01.09.2026 00:00 */
export function formatTurkeyDateTime(value: string | null | undefined): string {
  if (!value) return '';

  const date = parseApiDateTime(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: TR_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Yalnızca tarih → 01.09.2026 */
export function formatTurkeyDate(value: string | null | undefined): string {
  if (!value) return '';

  const date = parseApiDateTime(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: TR_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/** datetime-local input için Türkiye duvar saati (YYYY-MM-DDTHH:mm). */
export function toTurkeyDateTimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const date = parseApiDateTime(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TR_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

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

export function parseApiDateTime(value: string): Date {
  // API iç format: yyyy-MM-dd HH:mm (UTC)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value) && !value.includes('T')) {
    return new Date(value.replace(' ', 'T') + ':00Z');
  }
  // Zaten TR gösterim formatı gelmiş olabilir (rapor vb.)
  if (/^\d{2}\.\d{2}\.\d{4}/.test(value)) {
    const [datePart, timePart = '00:00'] = value.split(' ');
    const [day, month, year] = datePart.split('.');
    const [hour, minute] = timePart.split(':');
    return new Date(Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    ));
  }
  return new Date(value);
}
