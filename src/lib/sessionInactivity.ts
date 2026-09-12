/** Inactividad máxima antes de cerrar sesión (opción A: también tras cerrar el navegador). */
export const INACTIVITY_LIMIT_MS = 60 * 60 * 1000; // 1 hora

const STORAGE_KEY = 'ng_lite_last_activity_at';

/** Throttle de escritura a storage (evita spam en cada mousemove). */
export const ACTIVITY_TOUCH_THROTTLE_MS = 15_000;

/** Intervalo de comprobación en pestaña abierta. */
export const INACTIVITY_CHECK_INTERVAL_MS = 30_000;

export function readLastActivityAt(now = Date.now()): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0 || value > now + 60_000) return null;
    return value;
  } catch {
    return null;
  }
}

export function touchLastActivity(now = Date.now()): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(now));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearLastActivity(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** true si hay marca de actividad y ya pasó el límite. Sin marca = no expirado aún (se toca al entrar). */
export function isInactivityExpired(now = Date.now(), limitMs = INACTIVITY_LIMIT_MS): boolean {
  const last = readLastActivityAt(now);
  if (last == null) return false;
  return now - last >= limitMs;
}
