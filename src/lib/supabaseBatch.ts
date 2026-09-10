// =============================================================================
// Helpers de batching/paginación para Supabase / PostgREST.
// -----------------------------------------------------------------------------
// Propósito: centralizar dos patrones que venían repetidos (o ausentes) por el
// código y que ya generaron incidentes en producción (URL demasiado larga en
// `.in(...)` con muchos UUID, y listas truncadas por el cap de filas por
// defecto de PostgREST).
//
// Uso típico:
//
//   // 1) Consultar por `.in(col, ids)` con ids potencialmente masivos:
//   const rows = await chunkedIn<Row>(ids, (chunk) =>
//     supabase.from('food_household_measures')
//       .select('*')
//       .in('food_id', chunk),
//   );
//
//   // 2) Traer una lista completa sin asumir el cap de PostgREST:
//   const rows = await paginateAll<Row>((from, to) =>
//     supabase.from('foods').select('*').order('created_at').range(from, to),
//   );
// =============================================================================

import type { PostgrestError } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// -------- Constantes sensatas para SaaS multi-tenant -----------------------

// Tamaño máximo de lote para `.in(col, values)`. Se eligió 100 porque:
//  * Un UUID serializa a ~36 chars; 100 * (36 + 3) ≈ 4 KB bajo el límite real
//    de URL de PostgREST/Supabase (~8 KB operativo, 16 KB técnico).
//  * Deja margen para filtros/columnas adicionales en la misma query.
//  * Evita construir URLs patológicamente largas aunque el caller pase miles
//    de ids (por ejemplo al hidratar medidas caseras para todo el catálogo).
export const SUPABASE_IN_BATCH_SIZE = 100;

// Tamaño de página por defecto para `.range(from, to)`. 1000 coincide con el
// cap clásico de PostgREST, así que cada página trae el máximo permitido y la
// paginación termina en cuanto venga una página incompleta.
export const SUPABASE_PAGE_SIZE = 1000;

// Tope defensivo para evitar bucles infinitos si la DB devuelve siempre una
// página completa (cambios concurrentes + ordering no determinista).
const PAGINATE_MAX_PAGES = 200; // = 200k filas máx por llamada, suficiente.

// -------- Tipos mínimos ----------------------------------------------------

type SupabaseQueryResult<T> = {
  data: T[] | null;
  error: PostgrestError | null;
};

type ChunkedInBuilder<T> = (chunk: string[]) => PromiseLike<SupabaseQueryResult<T>>;
type PaginateBuilder<T> = (from: number, to: number) => PromiseLike<SupabaseQueryResult<T>>;

// -------- chunkedIn --------------------------------------------------------

/**
 * Ejecuta `buildQuery` varias veces sobre lotes de `values`, concatenando los
 * resultados. Devuelve un array plano preservando el orden de los lotes.
 *
 * - Deduplica y descarta valores vacíos antes de batir.
 * - Si un lote falla, re-lanza el error de Supabase tal cual (caller decide).
 * - Si no hay valores, devuelve `[]` sin tocar la red.
 */
export const chunkedIn = async <T>(
  values: Array<string | null | undefined>,
  buildQuery: ChunkedInBuilder<T>,
  batchSize: number = SUPABASE_IN_BATCH_SIZE,
): Promise<T[]> => {
  const unique = Array.from(
    new Set((values || []).filter((value): value is string => Boolean(value))),
  );

  if (unique.length === 0) {
    return [];
  }

  const chunks: string[][] = [];
  const size = batchSize > 0 ? batchSize : SUPABASE_IN_BATCH_SIZE;
  for (let index = 0; index < unique.length; index += size) {
    chunks.push(unique.slice(index, index + size));
  }

  // Se disparan en paralelo: Supabase tolera paralelismo moderado y mejora la
  // latencia percibida. Si llegara a ser problema se puede serializar.
  const batches = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await buildQuery(chunk);
      if (error) {
        throw error;
      }
      return (data || []) as T[];
    }),
  );

  return batches.flat();
};

// -------- paginateAll ------------------------------------------------------

/**
 * Recorre una consulta con `.range(from, to)` hasta vaciarla. El caller
 * construye la query base en cada iteración (order + filters + range) para
 * no depender del tipado interno de Supabase.
 *
 * Termina cuando una página trae menos filas que `pageSize`, o al alcanzar
 * el tope defensivo `PAGINATE_MAX_PAGES` (log + early return para evitar
 * bloquear la UI ante escenarios patológicos).
 */
export const paginateAll = async <T>(
  buildQuery: PaginateBuilder<T>,
  pageSize: number = SUPABASE_PAGE_SIZE,
): Promise<T[]> => {
  const size = pageSize > 0 ? pageSize : SUPABASE_PAGE_SIZE;
  const results: T[] = [];

  for (let page = 0; page < PAGINATE_MAX_PAGES; page += 1) {
    const from = page * size;
    const to = from + size - 1;

    const { data, error } = await buildQuery(from, to);
    if (error) {
      throw error;
    }

    const rows = (data || []) as T[];
    results.push(...rows);

    // Última página: vino incompleta (o vacía).
    if (rows.length < size) {
      return results;
    }
  }

  // Si llegamos aquí es un síntoma, no un flujo normal. Dejamos evidencia
  // para la pipeline de observabilidad y devolvemos lo acumulado.
  logger.warn(
    '[supabaseBatch] paginateAll alcanzó PAGINATE_MAX_PAGES; el dataset podría estar truncado.',
    { pageSize: size, maxPages: PAGINATE_MAX_PAGES, collected: results.length },
  );
  return results;
};
