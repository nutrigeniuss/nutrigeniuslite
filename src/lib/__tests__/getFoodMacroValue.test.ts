import { describe, it, expect } from 'vitest';
import { getFoodMacroValue } from '@/lib/foodNutrients';

describe('getFoodMacroValue — carbohidratos', () => {
  it('usa available_carbs cuando carbs es null', () => {
    expect(getFoodMacroValue({ available_carbs: 77.2 }, 'carbs')).toBe(77.2);
  });

  it('usa nutrients.available_carbs cuando carbs es 0 (dato incompleto del catálogo)', () => {
    expect(
      getFoodMacroValue(
        { carbs: 0, nutrients: { available_carbs: 77.2 } },
        'carbs',
      ),
    ).toBe(77.2);
  });

  it('respeta carbs > 0 aunque haya available_carbs', () => {
    expect(
      getFoodMacroValue(
        { carbs: 12, available_carbs: 77 },
        'carbs',
      ),
    ).toBe(12);
  });

  it('deja carbs en 0 si no hay available_carbs (aceite, etc.)', () => {
    expect(getFoodMacroValue({ carbs: 0 }, 'carbs')).toBe(0);
  });
});
