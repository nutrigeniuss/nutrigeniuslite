/**
 * Limpia borradores locales de la calculadora (ficha + dietas de sesión).
 * Se llama al cerrar sesión para no dejar datos en un navegador compartido.
 */
import { clearSessionDietStorage } from '@/lib/sessionDietDb';

export function clearLiteSessionStorage(): void {
  try {
    localStorage.removeItem('ng_lite_calc_ficha_v1');
    localStorage.removeItem('ng_lite_calc_ficha_v2');
    clearSessionDietStorage();

    const prefixes = [
      'ng_lite_calc_ficha',
      'ng_session_diet',
      'nutrigenius_session',
      'ng_calc_ficha',
    ];
    for (const key of Object.keys(localStorage)) {
      if (prefixes.some((p) => key.startsWith(p))) localStorage.removeItem(key);
    }
  } catch {
    /* ignore quota / private mode */
  }
}
