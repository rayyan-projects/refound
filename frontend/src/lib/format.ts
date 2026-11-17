const dateParts = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' });
// Fixed three-letter months: newer ICU data renders September as "Sept" in en-GB.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateFmt = {
  format(d: Date): string {
    const parts = Object.fromEntries(dateParts.formatToParts(d).map((p) => [p.type, p.value]));
    return `${Number(parts.day)} ${MONTHS[Number(parts.month) - 1]} ${parts.year}`;
  },
};
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
const countFmt = new Intl.NumberFormat('en-US');

/** The backend stores naive UTC timestamps ("2026-11-14T09:12:44.512339", no "Z"). */
export function parseServerDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(s.trim());
  const d = new Date(hasZone ? s.trim() : `${s.trim()}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(d: Date | null): string {
  return d ? dateFmt.format(d) : 'Unknown date';
}

export function formatTime(d: Date | null): string {
  return d ? timeFmt.format(d) : '';
}

export function formatDateTime(d: Date | null): string {
  return d ? `${dateFmt.format(d)}, ${timeFmt.format(d)}` : 'Unknown date';
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatDayHeading(d: Date | null, now: Date = new Date()): string {
  if (!d) return 'Unknown date';
  if (sameDay(d, now)) return 'Today';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return 'Yesterday';
  return formatDate(d);
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function formatCount(n: number): string {
  return countFmt.format(n);
}

export function plural(n: number, one: string, many: string): string {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}
