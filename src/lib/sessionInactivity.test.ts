import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  clearLastActivity,
  INACTIVITY_LIMIT_MS,
  isInactivityExpired,
  readLastActivityAt,
  touchLastActivity,
} from './sessionInactivity';

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const memory = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
  vi.stubGlobal('localStorage', memory);
  return memory;
}

describe('sessionInactivity', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('no expira si nunca hubo actividad registrada', () => {
    expect(isInactivityExpired()).toBe(false);
  });

  it('expira tras 1 hora desde el último toque', () => {
    touchLastActivity();
    expect(isInactivityExpired()).toBe(false);

    vi.setSystemTime(Date.now() + INACTIVITY_LIMIT_MS - 1);
    expect(isInactivityExpired()).toBe(false);

    vi.setSystemTime(Date.now() + 1);
    expect(isInactivityExpired()).toBe(true);
  });

  it('touch actualiza la marca y clear la borra', () => {
    touchLastActivity();
    expect(readLastActivityAt()).toBe(Date.now());
    clearLastActivity();
    expect(readLastActivityAt()).toBeNull();
  });
});
