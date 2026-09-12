/**
 * Limpia borradores locales de la calculadora (ficha + dietas de sesión).
 * Se llama al cerrar sesión para no dejar datos en un navegador compartido.
 */
export function clearLiteSessionStorage(): void {
  try {
    const exact = [
      'ng_lite_calc_ficha_v1',
      'ng_lite_calc_ficha_v2',
      'ng_lite_calc_diet_plans_v1',
      'ng_lite_calc_exchange_diets_v1',
    ];
    for (const key of exact) localStorage.removeItem(key);

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
