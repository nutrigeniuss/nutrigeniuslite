// Cache (por usuario) del catálogo personal "Mis Alimentos".
//
// Antes MyFoods usaba la caché GLOBAL del catálogo (nutrigenius_food_catalog_v1),
// la misma que consumen el buscador de dietas y recetas. Como MyFoods escribe
// solo el subconjunto del nutricionista, clobbereaba el catálogo completo (y a
// su vez leía datos que no eran suyos como initialData). Esta caché dedicada,
// scopeada por userId, evita esa contaminación y da un arranque instantáneo
// correcto para "Mis Alimentos".

import { createScopedLocalCache } from '@/lib/localCache';

const myFoodsCache = createScopedLocalCache({
  keyPrefix: 'nutrigenius_my_foods_v1',
  ttlMs: 24 * 60 * 60 * 1000,
  storage: 'localStorage',
});

export const readMyFoodsCache = <T = unknown>(userId: string): T[] | null =>
  myFoodsCache.read(userId) as T[] | null;

export const writeMyFoodsCache = <T = unknown>(userId: string, data: T[]): void => {
  myFoodsCache.write(userId, data);
};

export const clearMyFoodsCache = (userId?: string): void => {
  myFoodsCache.clear(userId);
};
