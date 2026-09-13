/** Id fijo del paciente de consulta en Lite (calculadora de sesión). */
export const SESSION_FICHA_ID = 'session-ficha';

export function isSessionFichaId(id: string | null | undefined): boolean {
  return !id || id === SESSION_FICHA_ID;
}

/** Id con el que se guardan/listan las dietas de la ficha actual. */
export function resolveSessionPatientId(urlPatientId: string | null | undefined): string {
  const raw = (urlPatientId || '').trim();
  if (!raw || raw === SESSION_FICHA_ID) return SESSION_FICHA_ID;
  return raw;
}
