import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  roundNutritionValue,
  getDefaultQuantityForUnit,
  highlightMatch,
  scoreByRelevance,
} from '@/components/foods/FoodSearchHelpers';

// Estos helpers los comparten los buscadores del creador de dietas y del
// recordatorio de 24 h, y no tenían NINGUNA prueba. Se escriben antes de
// tocarlos para poder demostrar que un refactor no cambia lo que hacen.

describe('roundNutritionValue', () => {
  it('redondea a un decimal', () => {
    expect(roundNutritionValue(12.34)).toBe(12.3);
    expect(roundNutritionValue(12.35)).toBe(12.4);
  });

  it('trata texto numérico como número', () => {
    expect(roundNutritionValue('7.77')).toBe(7.8);
  });

  it('devuelve 0 ante valores no numéricos o vacíos', () => {
    expect(roundNutritionValue(null)).toBe(0);
    expect(roundNutritionValue(undefined)).toBe(0);
    expect(roundNutritionValue('arroz')).toBe(0);
  });
});

describe('getDefaultQuantityForUnit', () => {
  it('propone 1 para medidas caseras (1 taza, 1 cucharada)', () => {
    expect(getDefaultQuantityForUnit({ isHousehold: true })).toBe(1);
  });

  it('propone 100 para gramos', () => {
    expect(getDefaultQuantityForUnit({ isHousehold: false })).toBe(100);
    expect(getDefaultQuantityForUnit(undefined)).toBe(100);
  });
});

describe('highlightMatch', () => {
  it('envuelve la coincidencia en <mark>', () => {
    render(<p>{highlightMatch('Arroz blanco cocido', 'blanco')}</p>);
    const marca = screen.getByText('blanco');
    expect(marca.tagName).toBe('MARK');
  });

  it('no distingue mayúsculas', () => {
    render(<p>{highlightMatch('Arroz Blanco', 'blanco')}</p>);
    expect(screen.getByText('Blanco').tagName).toBe('MARK');
  });

  it('devuelve el texto intacto si no hay búsqueda', () => {
    expect(highlightMatch('Arroz', '')).toBe('Arroz');
    expect(highlightMatch('Arroz', '   ')).toBe('Arroz');
  });

  it('devuelve el texto intacto si viene vacío', () => {
    expect(highlightMatch('', 'algo')).toBe('');
    expect(highlightMatch(null, 'algo')).toBe(null);
  });

  it('no explota con caracteres especiales de expresión regular', () => {
    expect(() => render(<p>{highlightMatch('Aceite (oliva)', '(oliva)')}</p>)).not.toThrow();
  });

  // Los catálogos importados desde Excel a veces traen el nombre como número.
  it('no explota si el nombre no es texto', () => {
    expect(() => render(<p>{highlightMatch(1234, '2')}</p>)).not.toThrow();
  });
});

describe('scoreByRelevance', () => {
  it('ordena prefijo (0) < palabra (1) < inclusión (2) < resto (3)', () => {
    expect(scoreByRelevance('Arroz blanco', 'arroz')).toBe(0);
    expect(scoreByRelevance('Harina de arroz', 'arroz')).toBe(1);
    expect(scoreByRelevance('Cebollarroz', 'arroz')).toBe(2);
    expect(scoreByRelevance('Quinua', 'arroz')).toBe(3);
  });

  it('sin búsqueda, todo empata', () => {
    expect(scoreByRelevance('Arroz', '')).toBe(0);
  });

  // ── El bug ────────────────────────────────────────────────────────────────
  // RecallFoodSearch FILTRA sin tildes ("higado" encuentra "Hígado") pero
  // ORDENA con este helper, que sí distingue tildes: el resultado aparecía
  // último (puntaje 3, "resto") en vez de primero (puntaje 0, "prefijo").
  // El creador de dietas ya lo hacía bien con su propia copia local.
  it('ignora las tildes, igual que el creador de dietas', () => {
    expect(scoreByRelevance('Hígado de pollo', 'higado')).toBe(0);
    expect(scoreByRelevance('Hígado de pollo', 'hígado')).toBe(0);
    expect(scoreByRelevance('Puré de papa', 'pure')).toBe(0);
    expect(scoreByRelevance('Sopa de plátano', 'platano')).toBe(1);
  });

  it('tolera nombre vacío', () => {
    expect(scoreByRelevance(null, 'arroz')).toBe(3);
    expect(scoreByRelevance('', 'arroz')).toBe(3);
  });
});
