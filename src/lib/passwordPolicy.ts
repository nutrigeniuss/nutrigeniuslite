/** Longitud mínima de contraseña en Lite (UI + edge admin-manage-user). */
export const MIN_PASSWORD_LENGTH = 10;

/** Devuelve mensaje de error o null si la contraseña es válida. */
export function validatePassword(password: string): string | null {
  if (!password || !password.trim()) {
    return 'La contraseña es obligatoria';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`;
  }
  return null;
}
