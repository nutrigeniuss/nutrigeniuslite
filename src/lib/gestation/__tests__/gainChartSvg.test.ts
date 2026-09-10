import { describe, expect, it } from 'vitest';
import { buildGainChartSVG, computeGainChartLayout } from '../gainChartSvg';

describe('buildGainChartSVG', () => {
  it('dibuja la banda recomendada de la categoría', () => {
    const svg = buildGainChartSVG({ category: 'normal' });
    expect(svg).toContain('<svg');
    // El polígono de la banda se cierra con Z.
    expect(svg).toMatch(/<path d="M [\d.]+ [\d.]+ .* Z"/);
    expect(svg).toContain('fill="#06a510"');
  });

  // Delgada + múltiple no tiene tabla: no se puede inventar una banda.
  it('sin tabla para el caso, no dibuja banda', () => {
    const svg = buildGainChartSVG({ category: 'underweight', type: 'twin' });
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('fill="#06a510"');
  });

  it('grafica un punto por control y los une cuando hay dos o más', () => {
    const one = buildGainChartSVG({ category: 'normal', points: [{ week: 15, gainKg: 1 }] });
    expect((one.match(/<circle/g) || []).length).toBe(1);
    // Con un solo punto no hay trayectoria que trazar.
    expect(one).not.toContain('stroke="#3b5feb"');

    const many = buildGainChartSVG({
      category: 'normal',
      points: [{ week: 10, gainKg: 0.5 }, { week: 15, gainKg: 1 }, { week: 20, gainKg: 3 }],
    });
    expect((many.match(/<circle/g) || []).length).toBe(3);
    expect(many).toContain('stroke="#3b5feb"');
  });

  it('colorea cada punto según su diagnóstico', () => {
    const svg = buildGainChartSVG({
      category: 'normal',
      points: [
        { week: 15, gainKg: 1, severity: 'warn' },
        { week: 20, gainKg: 5, severity: 'good' },
        { week: 25, gainKg: 12, severity: 'bad' },
      ],
    });
    expect(svg).toContain('#c2410c'); // baja ganancia
    expect(svg).toContain('#15803d'); // adecuada
    expect(svg).toContain('#b91c1c'); // alta
  });

  it('marca la semana del último control con una línea punteada', () => {
    const svg = buildGainChartSVG({ category: 'normal', highlightWeek: 25 });
    expect(svg).toContain('stroke-dasharray="3 3"');
    expect(svg).toContain('#ec4899');
  });

  it('ignora puntos con datos no numéricos en lugar de romper el dibujo', () => {
    const svg = buildGainChartSVG({
      category: 'normal',
      points: [{ week: 15, gainKg: 1 }, { week: Number.NaN, gainKg: 2 }],
    });
    expect((svg.match(/<circle/g) || []).length).toBe(1);
  });
});

describe('computeGainChartLayout', () => {
  const options = {
    category: 'normal' as const,
    points: [
      { week: 25, gainKg: 6, date: '2026-07-29', weightKg: 76 },
      { week: 30, gainKg: 8, date: '2026-08-29', weightKg: 78 },
    ],
  };

  // La capa de hover de la pantalla se ubica con estas coordenadas: si se
  // desalinearan del SVG, el tooltip aparecería lejos del punto.
  it('devuelve una posición por punto, en píxeles y en porcentaje', () => {
    const layout = computeGainChartLayout(options);
    expect(layout.points).toHaveLength(2);
    for (const entry of layout.points) {
      expect(entry.leftPct).toBeGreaterThan(0);
      expect(entry.leftPct).toBeLessThan(100);
      expect(entry.topPct).toBeGreaterThan(0);
      expect(entry.topPct).toBeLessThan(100);
      expect(entry.leftPct).toBeCloseTo((entry.cx / layout.width) * 100, 6);
    }
  });

  it('a más semanas, más a la derecha; a más ganancia, más arriba', () => {
    const [first, second] = computeGainChartLayout(options).points;
    expect(second.cx).toBeGreaterThan(first.cx);
    expect(second.cy).toBeLessThan(first.cy);
  });

  it('conserva el punto original para el contenido del tooltip', () => {
    const [first] = computeGainChartLayout(options).points;
    expect(first.point).toMatchObject({ date: '2026-07-29', weightKg: 76, gainKg: 6 });
  });

  it('descarta los puntos no numéricos igual que el dibujo', () => {
    const layout = computeGainChartLayout({
      category: 'normal',
      points: [{ week: 25, gainKg: 6 }, { week: 30, gainKg: Number.NaN }],
    });
    expect(layout.points).toHaveLength(1);
  });
});
