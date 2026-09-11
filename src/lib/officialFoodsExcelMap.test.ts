import { describe, expect, it } from 'vitest';
import { normalizeExcelHeader, resolveOfficialExcelField } from './officialFoodsExcelMap';

describe('normalizeExcelHeader', () => {
  it('lowercases, strips accents, collapses spaces', () => {
    expect(normalizeExcelHeader('  Proteínas  ')).toBe('proteinas');
    expect(normalizeExcelHeader('ALIMENTO')).toBe('alimento');
  });
});

describe('resolveOfficialExcelField', () => {
  it('maps core columns', () => {
    expect(resolveOfficialExcelField('ALIMENTO')).toBe('name');
    expect(resolveOfficialExcelField('categoria')).toBe('category');
    expect(resolveOfficialExcelField('medida casera')).toBe('measure');
    expect(resolveOfficialExcelField('gramos o ml de la medida casera')).toBe('measure_grams');
    expect(resolveOfficialExcelField('porcion_gramos')).toBe('portion_grams');
    expect(resolveOfficialExcelField('calorias')).toBe('calories');
    expect(resolveOfficialExcelField('proteínas')).toBe('protein');
    expect(resolveOfficialExcelField('carbohidratos totales')).toBe('carbs');
    expect(resolveOfficialExcelField('carbohidratos disponibles')).toBe('available_carbs');
    expect(resolveOfficialExcelField('grasas total')).toBe('fat');
    expect(resolveOfficialExcelField('notas')).toBe('notes');
  });

  it('maps core macro headers with unit suffixes', () => {
    expect(resolveOfficialExcelField('Calorías (kcal)')).toBe('calories');
    expect(resolveOfficialExcelField('Proteínas (g)')).toBe('protein');
    expect(resolveOfficialExcelField('Carbohidratos (g)')).toBe('carbs');
    expect(resolveOfficialExcelField('Carbohidratos totales (g)')).toBe('carbs');
    expect(resolveOfficialExcelField('Carbohidratos disponibles (g)')).toBe('available_carbs');
    expect(resolveOfficialExcelField('Grasas (g)')).toBe('fat');
    expect(resolveOfficialExcelField('Grasas total (g)')).toBe('fat');
  });

  it('maps micronutrients to nutrient keys', () => {
    expect(resolveOfficialExcelField('Agua')).toBe('nutrient:water');
    expect(resolveOfficialExcelField('fibra')).toBe('nutrient:fiber');
    expect(resolveOfficialExcelField('Sodio')).toBe('nutrient:sodium');
  });

  it('returns null for unknown headers', () => {
    expect(resolveOfficialExcelField('columna inventada')).toBeNull();
  });
});
