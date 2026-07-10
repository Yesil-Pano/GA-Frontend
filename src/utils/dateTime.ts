/** API'den gelen UTC zamanı Türkiye saatine (GMT+3) çevirir. */
export function formatTurkeyDateTime(value: string | null | undefined): string {
  if (!value) return '';

  const date = parseApiDateTime(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

function parseApiDateTime(value: string): Date {
  // Eski format: "yyyy-MM-dd HH:mm" (UTC, timezone bilgisi yok)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value) && !value.includes('T')) {
    return new Date(value.replace(' ', 'T') + ':00Z');
  }
  return new Date(value);
}
