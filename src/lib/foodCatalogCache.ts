// Cache en memoria + localStorage del catálogo (fuente = Supabase foods).
// Scopeado por userId: el catálogo incluye alimentos privados del nutricionista
// y no debe filtrarse a otra cuenta en un PC compartido.

import { createScopedLocalCache } from '@/lib/localCache';
import { FOOD_LIST_COLUMNS, listAccessibleFoods } from '@/lib/catalogData';
import { logger, errorMessage } from '@/lib/logger';

const TTL_MS = 24 * 60 * 60 * 1000;
const KEY_PREFIX = 'nutrigenius_food_catalog_v3';

const foodCatalogCache = createScopedLocalCache({
  keyPrefix: KEY_PREFIX,
  ttlMs: TTL_MS,
});

type MemorySlot = { data: unknown[]; timestamp: number };
const memoryByUser = new Map<string, MemorySlot>();
const inflightByUser = new Map<string, Promise<unknown[]>>();

export const readFoodCatalogCache = <T = unknown>(userId?: string | null): T[] | null => {
  if (!userId) return null;
  const mem = memoryByUser.get(userId);
  if (mem && Date.now() - mem.timestamp <= TTL_MS) return mem.data as T[];
  const fromDisk = foodCatalogCache.read(userId) as T[] | null;
  if (fromDisk) {
    memoryByUser.set(userId, { data: fromDisk as unknown[], timestamp: Date.now() });
  }
  return fromDisk;
};

export const writeFoodCatalogCache = <T = unknown>(userId: string, data: T[]): void => {
  if (!userId || !Array.isArray(data)) return;
  memoryByUser.set(userId, { data: data as unknown[], timestamp: Date.now() });
  foodCatalogCache.write(userId, data);
};

/** Sin userId limpia toda la familia (logout / higiene de PC compartida). */
export const clearFoodCatalogCache = (userId?: string): void => {
  if (userId) {
    memoryByUser.delete(userId);
    inflightByUser.delete(userId);
    foodCatalogCache.clear(userId);
  } else {
    memoryByUser.clear();
    inflightByUser.clear();
    foodCatalogCache.clear();
  }
  try {
    localStorage.removeItem('nutrigenius_food_catalog_v1');
    localStorage.removeItem('nutrigenius_food_catalog_v2');
  } catch {
    /* ignore */
  }
};

export const prefetchFoodCatalog = async <T = unknown>(userId?: string | null): Promise<T[]> => {
  if (!userId) return [];
  const existing = inflightByUser.get(userId);
  if (existing) return existing as Promise<T[]>;

  const pending = listAccessibleFoods(undefined, FOOD_LIST_COLUMNS)
    .then((result) => {
      const data = (result?.data ?? []).map((food) => ({ ...food, _lite: true })) as unknown[];
      writeFoodCatalogCache(userId, data);
      return data;
    })
    .catch((error) => {
      logger.error('No se pudo cargar el catálogo de alimentos', {
        error: errorMessage(error),
      });
      return [] as unknown[];
    })
    .finally(() => {
      inflightByUser.delete(userId);
    });

  inflightByUser.set(userId, pending);
  return pending as Promise<T[]>;
};
