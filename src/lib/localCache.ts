// Factories genéricas para caches en localStorage con TTL.
//
// Dos formas:
//   1. `createLocalCache` — cache global de una lista (key fija).
//      Pensado para catálogos compartidos (alimentos públicos, recetas, etc.).
//
//   2. `createScopedLocalCache` — cache por scopeId (típicamente userId).
//      Pensado para datos por usuario (lista de pacientes propios).
//
// Ambas comparten el mismo formato de payload (`CachedEntry`) y la misma
// estrategia de TTL: si el timestamp es más viejo que `ttlMs`, `read()`
// devuelve `null` y el caller hace fetch fresco. Writes son no-throw —
// QuotaExceededError u otros se silencian porque el cache es solo una
// optimización, no debe romper la app.

type CachedEntry<T> = {
  data: T[];
  timestamp: number;
};

export type LocalCache<T> = {
  read: () => T[] | null;
  write: (data: T[]) => void;
  clear: () => void;
};

export type ScopedLocalCache<T> = {
  read: (scopeId: string) => T[] | null;
  /**
   * Como `read`, pero devuelve el dato aunque haya pasado el TTL.
   *
   * Es la mitad "stale" de stale-while-revalidate: sirve para pintar algo en el
   * primer fotograma mientras la consulta fresca viaja. Con `read` a secas, una
   * entrada caducada se descarta entera y la pantalla vuelve a "Cargando…"
   * aunque tuviéramos la lista de hace dos minutos.
   *
   * Solo para datos que se refrescan de inmediato y donde ver algo un segundo
   * desactualizado no lleva a ninguna decisión equivocada.
   */
  readStale: (scopeId: string) => T[] | null;
  write: (scopeId: string, data: T[]) => void;
  // Sin scopeId limpia toda la familia de claves con el mismo prefix.
  clear: (scopeId?: string) => void;
};

const parseEntry = <T>(raw: string | null, ttlMs: number): T[] | null => {
  if (!raw) return null;
  const entry = JSON.parse(raw) as CachedEntry<T>;
  if (!entry || typeof entry.timestamp !== 'number' || !Array.isArray(entry.data)) return null;
  if (Date.now() - entry.timestamp > ttlMs) return null;
  return entry.data;
};

const getStorage = (type: 'localStorage' | 'sessionStorage'): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window[type] : null;
  } catch {
    return null;
  }
};

export const createLocalCache = <T = unknown>(
  opts: { key: string; ttlMs: number; storage?: 'localStorage' | 'sessionStorage' },
): LocalCache<T> => {
  const store = () => getStorage(opts.storage ?? 'localStorage');
  return {
    read: () => {
      try {
        return parseEntry<T>(store()?.getItem(opts.key) ?? null, opts.ttlMs);
      } catch {
        return null;
      }
    },
    write: (data) => {
      try {
        if (!Array.isArray(data)) return;
        store()?.setItem(opts.key, JSON.stringify({ data, timestamp: Date.now() } satisfies CachedEntry<T>));
      } catch {
        /* QuotaExceededError u otros — silencioso por diseño */
      }
    },
    clear: () => {
      try {
        store()?.removeItem(opts.key);
      } catch {
        /* no-op */
      }
    },
  };
};

export const createScopedLocalCache = <T = unknown>(
  opts: { keyPrefix: string; ttlMs: number; storage?: 'localStorage' | 'sessionStorage' },
): ScopedLocalCache<T> => {
  const store = () => getStorage(opts.storage ?? 'localStorage');
  const cacheKey = (scopeId: string): string => `${opts.keyPrefix}:${scopeId}`;

  return {
    read: (scopeId) => {
      try {
        if (!scopeId) return null;
        return parseEntry<T>(store()?.getItem(cacheKey(scopeId)) ?? null, opts.ttlMs);
      } catch {
        return null;
      }
    },
    readStale: (scopeId) => {
      try {
        if (!scopeId) return null;
        return parseEntry<T>(store()?.getItem(cacheKey(scopeId)) ?? null, Number.POSITIVE_INFINITY);
      } catch {
        return null;
      }
    },
    write: (scopeId, data) => {
      try {
        if (!scopeId || !Array.isArray(data)) return;
        store()?.setItem(cacheKey(scopeId), JSON.stringify({ data, timestamp: Date.now() } satisfies CachedEntry<T>));
      } catch {
        /* QuotaExceededError u otros — silencioso por diseño */
      }
    },
    clear: (scopeId) => {
      try {
        const s = store();
        if (!s) return;
        if (scopeId) {
          s.removeItem(cacheKey(scopeId));
          return;
        }
        for (let i = s.length - 1; i >= 0; i -= 1) {
          const key = s.key(i);
          if (key && key.startsWith(`${opts.keyPrefix}:`)) {
            s.removeItem(key);
          }
        }
      } catch {
        /* no-op */
      }
    },
  };
};
