import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearFoodCatalogCache,
  readFoodCatalogCache,
  writeFoodCatalogCache,
} from '@/lib/foodCatalogCache';

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const memoryStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  };
  vi.stubGlobal('localStorage', memoryStorage);
  vi.stubGlobal('window', { localStorage: memoryStorage });
}

describe('foodCatalogCache — aislamiento por usuario', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    clearFoodCatalogCache();
  });

  it('no mezcla el catálogo de dos nutricionistas', () => {
    writeFoodCatalogCache('user-a', [{ id: 'a1', name: 'Privado A' }]);
    writeFoodCatalogCache('user-b', [{ id: 'b1', name: 'Privado B' }]);

    expect(readFoodCatalogCache('user-a')?.[0]?.name).toBe('Privado A');
    expect(readFoodCatalogCache('user-b')?.[0]?.name).toBe('Privado B');
  });

  it('sin userId no lee caché ajena (evita fuga en PC compartida)', () => {
    writeFoodCatalogCache('user-a', [{ id: 'a1', name: 'Privado A' }]);
    expect(readFoodCatalogCache()).toBeNull();
    expect(readFoodCatalogCache('')).toBeNull();
  });
});
