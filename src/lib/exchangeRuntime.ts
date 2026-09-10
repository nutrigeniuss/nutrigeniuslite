import { EXCHANGE_GROUPS } from '@/components/exchanges/exchangeData';
import { loadExchangeGroups, type ExchangeFood } from '@/lib/exchangeFoodsData';
import { logger } from '@/lib/logger';

// Hidrata en runtime el array exportado EXCHANGE_GROUPS con los alimentos guardados en Supabase.
// Estrategia minimalmente invasiva: el array sigue siendo el mismo objeto que importa el resto
// de la app (creador de dietas, vista del paciente, etc.). Solo mutamos la lista `foods` de cada
// grupo si el admin ya migró el catálogo a Supabase. Cuando aún no se ha migrado, la lista
// estática sigue siendo la fuente.

let hydrationPromise: Promise<void> | null = null;
let lastHydratedAt = 0;
const listeners = new Set<() => void>();

// Cuánto tiempo cacheamos la última hidratación antes de volver a consultar Supabase.
// Suficiente para que un nutricionista navegue por la app sin redobles de fetch,
// pero corto para que ediciones del admin se reflejen pronto al recargar.
const HYDRATION_TTL_MS = 60_000;

const notifyListeners = () => {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      logger.warn('[exchangeRuntime] listener error', { error: error instanceof Error ? error.message : String(error) });
    }
  }
};

// Convierte el modelo ExchangeFood (lib) al esquema esperado por exchangeData.jsx.
const toLegacyFood = (food: ExchangeFood) => ({
  id: food.id,
  name: food.name,
  grams_raw: food.grams_raw,
  grams_cooked: food.grams_cooked,
  measure: food.measure || '',
});

const performHydration = async (): Promise<void> => {
  const groups = await loadExchangeGroups();
  // Indexamos por key para no depender del orden.
  const byKey: Record<string, ExchangeFood[]> = {};
  for (const group of groups) {
    byKey[group.key] = group.foods;
  }
  // Mutamos la lista `foods` solo si Supabase devolvió contenido custom para ese grupo.
  // Si el admin aún no migró, mantenemos el catálogo estático intacto.
  for (const staticGroup of EXCHANGE_GROUPS as Array<{ key: string; foods: unknown[] }>) {
    const dynamic = byKey[staticGroup.key];
    if (!dynamic || dynamic.length === 0) continue;
    const hasCustom = dynamic.some((f) => f.source === 'custom');
    if (!hasCustom) continue;
    staticGroup.foods = dynamic.map(toLegacyFood);
  }
  lastHydratedAt = Date.now();
  notifyListeners();
};

// Dispara la hidratación. Re-usa la promesa en vuelo si ya hay una.
// Por defecto respeta el TTL para evitar fetches redundantes.
export const hydrateExchangeGroupsRuntime = (options?: { force?: boolean }): Promise<void> => {
  const force = options?.force === true;
  if (!force && lastHydratedAt && Date.now() - lastHydratedAt < HYDRATION_TTL_MS) {
    return Promise.resolve();
  }
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = performHydration()
    .catch((error) => {
      logger.warn('[exchangeRuntime] No se pudo hidratar el catálogo:', { error: error instanceof Error ? error.message : String(error) });
    })
    .finally(() => {
      hydrationPromise = null;
    });
  return hydrationPromise;
};

// Permite que un componente se entere cuando termina la hidratación para forzar re-render.
export const subscribeToExchangeGroupsHydration = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getLastHydrationAt = (): number => lastHydratedAt;
