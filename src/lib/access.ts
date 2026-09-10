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

/** Acceso: admin siempre; is_active / manual_preview activos; resto pendiente o revocado. */
export function resolveLiteAccess(profile: LiteAccessProfile): LiteAccessStatus {
  if (profile.role === 'admin' || profile.accessMode === 'internal_admin') {
    return 'active';
  }
  if (profile.accessMode === 'lite_disabled' || isAccessExpired(profile.accessExpiresAt)) {
    return 'disabled';
  }
  if (profile.isActive === true || profile.accessMode === 'manual_preview') {
    return 'active';
  }
  if (profile.isActive === false) {
    return 'disabled';
  }
  return 'pending';
}

export function canUseCalculator(status: LiteAccessStatus): boolean {
  return status === 'active';
}

export function isAdmin(profile: LiteAccessProfile | null | undefined): boolean {
  // Solo rol admin / internal_admin. Tener acceso activo NO abre Maestro.
  return profile?.role === 'admin' || profile?.accessMode === 'internal_admin';
}
