/**
 * Limpieza de storage local.
 *
 * - clearLiteSessionStorage: solo al dar «Nueva ficha» (borra ficha + dietas).
 * - clearAuthSensitiveCaches: al cerrar sesión / cambiar de usuario — limpia
 *   catálogos por usuario para no filtrar alimentos privados en PC compartida,
 *   pero CONSERVA la ficha/dietas hasta «Nueva ficha» (regla de producto Lite).
 */
import { clearSessionDietStorage } from '@/lib/sessionDietDb';
import { clearFoodCatalogCache } from '@/lib/foodCatalogCache';
import { clearMyFoodsCache } from '@/lib/myFoodsCache';

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

/** Cachés que no deben sobrevivir un cambio de cuenta. */
export function clearAuthSensitiveCaches(userId?: string | null): void {
  try {
    clearFoodCatalogCache(userId || undefined);
    clearMyFoodsCache(userId || undefined);
    // Barrido de prefijos (incluye claves legacy globales v1/v2).
    const prefixes = [
      'nutrigenius_food_catalog_',
      'nutrigenius_my_foods_',
      'ng_calc_lab_ranges_',
      'ng_calc_hidden_my_foods_',
    ];
    for (const key of Object.keys(localStorage)) {
      if (prefixes.some((p) => key.startsWith(p))) localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}
