import { describe, expect, it } from 'vitest';
import { buildDietFoodsPrintHtml } from './dietFoodsPrintHtml';

describe('buildDietFoodsPrintHtml', () => {
  it('incluye paciente, comida y alimento sin oklch', () => {
    const html = buildDietFoodsPrintHtml({
      title: 'Plan 1800',
      date: '2026-09-12',
      patientName: 'Ana Pérez',
      targetCalories: 1800,
      meals: [
        {
          id: 'd1',
          name: 'Desayuno',
          time: '08:00',
          items: [
            { id: 'i1', name: 'Arroz blanco, cocido', quantity: 100, unit: 'gramos', calories: 1.15 },
          ],
        },
      ],
    });

    expect(html).toContain('Ana Pérez');
    expect(html).toContain('Desayuno');
    expect(html).toContain('Arroz blanco, cocido');
    expect(html).not.toMatch(/oklch/i);
    expect(html).toContain('#3b5feb');
  });
});
