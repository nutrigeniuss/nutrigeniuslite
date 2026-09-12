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

/**
 * Acceso alineado con `has_lite_access()` en Supabase:
 * admin siempre; resto solo con is_active y sin vencimiento / lite_disabled.
 * `manual_preview` es etiqueta de grant, no bypass si is_active=false.
 */
export function resolveLiteAccess(profile: LiteAccessProfile): LiteAccessStatus {
  if (profile.role === 'admin' || profile.accessMode === 'internal_admin') {
    return 'active';
  }
  if (profile.accessMode === 'lite_disabled') {
    return 'disabled';
  }
  if (isAccessExpired(profile.accessExpiresAt)) {
    return 'disabled';
  }
  if (profile.isActive === true) {
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
