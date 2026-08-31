/**
 * Stable id + timestamp helpers.
 *
 * Ids are opaque strings everywhere in the domain, so swapping this for
 * Firestore document ids or database uuids touches only this file.
 */

let counter = 0;

export function newId(prefix = 'id'): string {
  counter += 1;
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${time}${counter.toString(36)}${rand}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Deterministic id for seed data, so re-seeding produces identical references
 * and cross-record links (ability -> node, quest -> node) stay intact.
 */
export function seedId(prefix: string, slug: string): string {
  return `${prefix}_${slug}`;
}

export function stamp<T extends object>(record: T): T & { createdAt: string; updatedAt: string } {
  const at = nowIso();
  return { ...record, createdAt: at, updatedAt: at };
}

export function touch<T extends { updatedAt: string }>(record: T): T {
  return { ...record, updatedAt: nowIso() };
}

/** Days between two ISO dates, positive when `b` is later than `a`. */
export function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.floor(ms / 86_400_000);
}

/** Local calendar day key (YYYY-MM-DD) used for streaks and "today" filters. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isSameDay(a: string, b: string): boolean {
  return dayKey(a) === dayKey(b);
}

export function daysUntil(iso: string, from: string = new Date().toISOString()): number {
  const a = new Date(from);
  const b = new Date(iso);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** "Today" / "Yesterday" / a short date, for last-checked and log rows. */
export function formatRelativeDay(iso: string | null): string {
  if (!iso) return 'Never';
  const days = -daysUntil(iso);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return `${days} days ago`;
  if (days < 0) return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
