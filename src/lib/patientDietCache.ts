// Cache (por sesión) de los planes de dieta de un paciente: "por alimentos"
// (diet_plans) y "por intercambios" (exchange_diets). Objetivo: al volver a
// entrar a la sección Dieta de un paciente, el calendario/lista aparece al
// instante con lo último conocido mientras se refresca en background, en vez
// de mostrar "Cargando…" cada vez. Mismo patrón que recipesCache/foodCatalogCache.
//
// TTL 5 minutos: los planes cambian poco entre navegaciones; el refresh en
// background corrige cualquier desync.

import { createScopedLocalCache } from '@/lib/localCache';

const dietPlansCache = createScopedLocalCache({
  keyPrefix: 'nutrigenius_patient_diet_plans_v1',
  ttlMs: 5 * 60 * 1000,
  storage: 'sessionStorage',
});

const exchangePlansCache = createScopedLocalCache({
  keyPrefix: 'nutrigenius_patient_exchange_plans_v1',
  ttlMs: 5 * 60 * 1000,
  storage: 'sessionStorage',
});

export const readPatientDietPlansCache = <T = unknown>(patientId: string): T[] | null =>
  dietPlansCache.read(patientId) as T[] | null;

export const writePatientDietPlansCache = <T = unknown>(patientId: string, data: T[]): void => {
  dietPlansCache.write(patientId, data);
};

export const readPatientExchangePlansCache = <T = unknown>(patientId: string): T[] | null =>
  exchangePlansCache.read(patientId) as T[] | null;

export const writePatientExchangePlansCache = <T = unknown>(patientId: string, data: T[]): void => {
  exchangePlansCache.write(patientId, data);
};

export const clearPatientDietCache = (patientId?: string): void => {
  dietPlansCache.clear(patientId);
  exchangePlansCache.clear(patientId);
};
