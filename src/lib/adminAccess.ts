export type AccessDays = 30 | 45 | 90 | null;

export const ACCESS_DAY_OPTIONS: { value: AccessDays; label: string }[] = [
  { value: 30, label: '30 días' },
  { value: 45, label: '45 días' },
  { value: 90, label: '90 días' },
  { value: null, label: 'Sin vencimiento' },
];

export function expiresAtFromDays(days: AccessDays, now: Date = new Date()): string | null {
  if (days === null) return null;
  const ms = now.getTime() + days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

/** Lee borrador de duración; `null` es «sin vencimiento», no fallback. */
export function resolveDurationDraft(
  drafts: Record<string, AccessDays>,
  id: string,
  fallback: AccessDays = 45,
): AccessDays {
  return Object.prototype.hasOwnProperty.call(drafts, id) ? drafts[id]! : fallback;
}

export function buildGrantProfilePatch(days: AccessDays, now: Date = new Date()) {
  return {
    access_mode: 'manual_preview' as const,
    is_active: true as const,
    access_expires_at: expiresAtFromDays(days, now),
    updated_at: now.toISOString(),
  };
}

export function buildRevokeProfilePatch(now: Date = new Date()) {
  return {
    access_mode: 'lite_disabled' as const,
    is_active: false as const,
    access_expires_at: null,
    updated_at: now.toISOString(),
  };
}

export function isAdminProfile(row: { role?: string | null; access_mode?: string | null }): boolean {
  return row.role === 'admin' || row.access_mode === 'internal_admin';
}

export type AdminRowStatus = 'admin' | 'active' | 'pending' | 'disabled' | 'expired';

export function resolveAdminRowStatus(
  row: {
    role?: string | null;
    access_mode?: string | null;
    is_active?: boolean | null;
    access_expires_at?: string | null;
  },
  now: Date = new Date(),
): AdminRowStatus {
  if (isAdminProfile(row)) return 'admin';

  const expired =
    typeof row.access_expires_at === 'string' &&
    !Number.isNaN(Date.parse(row.access_expires_at)) &&
    Date.parse(row.access_expires_at) < now.getTime();

  if (expired) return 'expired';
  if (row.access_mode === 'lite_disabled' || row.is_active === false) return 'disabled';
  if (row.is_active === true) return 'active';
  return 'pending';
}
