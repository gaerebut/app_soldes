/** Format a Date object as YYYY-MM-DD in local timezone */
export function toLocalDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayStr(): string {
  return toLocalDateStr(new Date());
}

export function formatDateFR(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

export function formatDateShort(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${day}/${month}`;
}

export function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function getExpiryColor(dateStr: string | null): string {
  if (!dateStr) return '#94A3B8';
  const days = daysUntil(dateStr);
  if (days < 0) return '#DC2626';
  if (days <= 1) return '#DC2626';
  if (days <= 3) return '#F59E0B';
  return '#16A34A';
}

/** Pad an EAN to 13 digits with leading zeros */
export function padEAN13(ean: string): string {
  const digits = ean.replace(/\D/g, '');
  return digits.padStart(13, '0');
}
