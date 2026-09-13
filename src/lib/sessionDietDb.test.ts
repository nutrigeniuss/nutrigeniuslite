import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionDietStorage, localFrom } from './sessionDietDb';
import { SESSION_FICHA_ID } from './sessionFicha';

function stubLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
  });
}

describe('sessionDietDb · ficha de sesión', () => {
  beforeEach(() => {
    stubLocalStorage();
    clearSessionDietStorage();
  });

  it('guarda patient_id vacío como session-ficha y lo lista', async () => {
    const inserted = await localFrom('diet_plans').insert({
      nutritionist_id: 'nutri-1',
      title: 'Lunes',
      patient_id: '',
      date: '2026-09-15',
      meals: [],
    });
    expect(inserted.error).toBeNull();

    const { data, error } = await localFrom('diet_plans')
      .select('*')
      .eq('patient_id', SESSION_FICHA_ID)
      .eq('is_catalog', false);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect((data as Array<{ patient_id?: string }>).length).toBe(1);
    expect((data as Array<{ patient_id?: string }>)[0].patient_id).toBe(SESSION_FICHA_ID);
  });

  it('lista planes viejos sin is_catalog al filtrar is_catalog=false', async () => {
    localStorage.setItem(
      'ng_lite_calc_diet_plans_v1',
      JSON.stringify([
        {
          id: 'legacy-1',
          nutritionist_id: 'nutri-1',
          title: 'Martes',
          patient_id: SESSION_FICHA_ID,
          date: '2026-09-16',
          meals: [],
        },
      ]),
    );

    const { data } = await localFrom('diet_plans')
      .select('*')
      .eq('patient_id', SESSION_FICHA_ID)
      .eq('is_catalog', false);

    expect((data as unknown[]).length).toBe(1);
  });
});
