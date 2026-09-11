import { describe, expect, it } from 'vitest';
import { buildPersistedMasterRow } from './buildPersistedMasterRow';
import type { OfficialFoodImportRecord } from './parseOfficialFoodsWorkbook';

const baseRecord = (
  overrides: Partial<OfficialFoodImportRecord> = {},
): OfficialFoodImportRecord => ({
  name: 'Arroz blanco',
  category: 'CEREALES Y DERIVADOS',
  country: 'PE',
  portion_grams: 100,
  calories: 130,
  protein: 2.7,
  carbs: 28.2,
  fat: 0.3,
  notes: null,
  household_measures: [],
  nutrients: {},
  ...overrides,
});

describe('buildPersistedMasterRow', () => {
  it('persists null macros without coercing to 0', () => {
    const row = buildPersistedMasterRow(
      baseRecord({
        calories: null,
        protein: null,
        carbs: null,
        fat: null,
      }),
    );

    expect(row.calories).toBeNull();
    expect(row.protein).toBeNull();
    expect(row.carbs).toBeNull();
    expect(row.fat).toBeNull();
  });

  it('falls back carbs to nutrients.available_carbs when carbs is null', () => {
    const row = buildPersistedMasterRow(
      baseRecord({
        carbs: null,
        available_carbs: 22.5,
        nutrients: { available_carbs: 22.5 },
      }),
    );

    expect(row.carbs).toBe(22.5);
    expect(row.available_carbs).toBe(22.5);
  });

  it('keeps explicit carbs including 0 over available_carbs fallback', () => {
    const row = buildPersistedMasterRow(
      baseRecord({
        carbs: 0,
        available_carbs: 10,
        nutrients: { available_carbs: 10 },
      }),
    );

    expect(row.carbs).toBe(0);
  });
});
