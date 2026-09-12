// Cache en memoria del catálogo (fuente = Supabase foods).

import { createLocalCache } from '@/lib/localCache';
import { FOOD_LIST_COLUMNS, listAccessibleFoods } from '@/lib/catalogData';
import { logger, errorMessage } from '@/lib/logger';

const TTL_MS = 24 * 60 * 60 * 1000;

const foodCatalogCache = createLocalCache({
  // v2: invalida caches truncadas a 1000 filas (antes de paginateAll).
  key: 'nutrigenius_food_catalog_v2',
  ttlMs: TTL_MS,
});

let memoryData: unknown[] | null = null;
let memoryTimestamp = 0;

export const readFoodCatalogCache = <T = unknown>(): T[] | null => {
  if (memoryData && Date.now() - memoryTimestamp <= TTL_MS) return memoryData as T[];
  const fromDisk = foodCatalogCache.read() as T[] | null;
  if (fromDisk) {
    memoryData = fromDisk as unknown[];
    memoryTimestamp = Date.now();
  }
  return fromDisk;
};

export const writeFoodCatalogCache = <T = unknown>(data: T[]): void => {
  if (Array.isArray(data)) {
    memoryData = data as unknown[];
    memoryTimestamp = Date.now();
  }
  foodCatalogCache.write(data);
};

export const clearFoodCatalogCache = (): void => {
  memoryData = null;
  memoryTimestamp = 0;
  inflight = null;
  foodCatalogCache.clear();
  try {
    localStorage.removeItem('nutrigenius_food_catalog_v1');
  } catch {
    /* ignore */
  }
};

let inflight: Promise<unknown[]> | null = null;

export const prefetchFoodCatalog = async <T = unknown>(): Promise<T[]> => {
  if (inflight) return inflight as Promise<T[]>;
  inflight = listAccessibleFoods(undefined, FOOD_LIST_COLUMNS)
    .then((result) => {
      const data = (result?.data ?? []).map((food) => ({ ...food, _lite: true })) as unknown[];
      writeFoodCatalogCache(data);
      return data;
    })
    .catch((error) => {
      logger.error('No se pudo cargar el catálogo de alimentos', {
        error: errorMessage(error),
      });
      return [] as unknown[];
    })
    .finally(() => {
      inflight = null;
    });
  return inflight as Promise<T[]>;
};
