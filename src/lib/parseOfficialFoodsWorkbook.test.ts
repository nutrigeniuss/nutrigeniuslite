import { describe, expect, it } from 'vitest';
import { parseOfficialFoodsRows } from './parseOfficialFoodsWorkbook';

const headers19 = [
  'categoria', 'ALIMENTO', 'medida casera', 'gramos o ml de la medida casera', 'porcion_gramos',
  'calorias', 'Agua', 'proteínas', 'Grasas', 'Carbohidratos', 'fibra', 'Sodio', 'notas',
];
const units19 = [
  'categoria', 'ALIMENTO', 'medida casera', 'g', 'g', 'kcal', 'g', 'g', 'g', 'g', 'g', 'mg', null,
];

describe('parseOfficialFoodsRows', () => {
  it('groups repeated names into household measures and scales to 100g', () => {
    const result = parseOfficialFoodsRows([
      headers19,
      units19,
      ['CEREALES Y DERIVADOS', 'Arroz blanco cocido', 'Gramos', '100', '100', '130', null, '2.7', '0.3', '28.2', '0.4', '1', 'nota'],
      ['CEREALES Y DERIVADOS', 'Arroz blanco cocido', 'Cucharada llena', '20', null, null, null, null, null, null, null, null, null],
      ['CEREALES Y DERIVADOS', 'Arroz blanco cocido', 'Taza pequeña (250 ml)', '158', null, null, null, null, null, null, null, null, null],
    ]);
    expect(result.foods).toHaveLength(1);
    expect(result.skippedRows).toBe(0);
    const food = result.foods[0];
    expect(food.name).toBe('Arroz blanco cocido');
    expect(food.portion_grams).toBe(100);
    expect(food.calories).toBeCloseTo(130, 1);
    expect(food.protein).toBeCloseTo(2.7, 1);
    expect(food.household_measures.map((m) => m.name)).toEqual([
      'Gramos',
      'Cucharada llena',
      'Taza pequeña (250 ml)',
    ]);
    expect(food.household_measures[1].weight_grams).toBe(20);
    expect(food.household_measures[2].weight_grams).toBe(158);
  });

  it('parses plantilla-1 style without porcion_gramos and without unit row', () => {
    const headers = [
      'categoria', 'alimento', 'medida casera', 'gramos o ml de la medida casera',
      'calorias', 'proteinas', 'carbohidratos totales', 'grasas total',
    ];
    const result = parseOfficialFoodsRows([
      headers,
      ['CEREALES Y DERIVADOS', 'Arroz blanco, cocido', 'Taza loza al ras', '193.2', '222.18', '4.6368', '48.6864', '0.1932'],
      ['CEREALES Y DERIVADOS', 'Arroz blanco, cocido', 'Cucharada llena', '17.8', '20.47', '0.4272', '4.4856', '0.0178'],
    ]);
    expect(result.foods).toHaveLength(1);
    const food = result.foods[0];
    // 222.18 kcal / 193.2 g * 100 ≈ 115.0
    expect(food.calories).toBeCloseTo(115, 0);
    expect(food.household_measures).toHaveLength(2);
  });

  it('skips blank names and throws if alimento column missing', () => {
    expect(() => parseOfficialFoodsRows([['categoria', 'calorias'], ['x', 1]])).toThrow(/alimento/i);
    const result = parseOfficialFoodsRows([
      headers19,
      units19,
      ['CAT', '', 'g', '100', '100', '10', null, '1', '1', '1', null, null, null],
    ]);
    expect(result.foods).toHaveLength(0);
    expect(result.skippedRows).toBe(1);
  });
});
