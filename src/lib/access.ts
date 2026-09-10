export type LiteAccessStatus = 'pending' | 'active' | 'disabled';

export type LiteAccessProfile = {
  accessMode?: string | null;
  accessExpiresAt?: string | null;
  isActive?: boolean | null;
  role?: string | null;
};

const isAccessExpired = (accessExpiresAt?: string | null): boolean => {
  if (!accessExpiresAt) return false;
  const ms = Date.parse(accessExpiresAt);
  return !Number.isNaN(ms) && ms < Date.now();
};

/** Acceso a la calculadora: admin siempre; manual_preview activo; resto pendiente/revocado. */
export function resolveLiteAccess(profile: LiteAccessProfile): LiteAccessStatus {
  if (profile.accessMode === 'lite_disabled' || profile.isActive === false || isAccessExpired(profile.accessExpiresAt)) {
    return 'disabled';
  }
  if (profile.role === 'admin' || profile.accessMode === 'internal_admin' || profile.accessMode === 'manual_preview') {
    return 'active';
  }
  return 'pending';
}

export function canUseCalculator(status: LiteAccessStatus): boolean {
  return status === 'active';
}

export function isAdmin(profile: LiteAccessProfile | null | undefined): boolean {
  return profile?.role === 'admin' || profile?.accessMode === 'internal_admin';
}
