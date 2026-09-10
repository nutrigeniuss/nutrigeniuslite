import { describe, expect, it } from 'vitest';

import {
  ambAssessment,
  armCircumferenceAssessment,
  subscapularAssessment,
  tricepsAssessment,
  triSubSumAssessment,
} from '../indicators/percentiles';
import { valueToPercentile } from '../indicators/shared';

// Los indicadores por percentil (perímetro de brazo, AMB, pliegues) sacan su
// etiqueta de dónde cae el valor dentro de una fila [P5..P95]. El fallo que
// motiva estas pruebas: cuando el valor se salía de la tabla se devolvía el
// percentil del propio borde (5 o 95), así que "por encima del p95" quedaba
// dentro de `pct <= 95` y un brazo de 40 cm en un hombre de 29 años salía
// "Normal". Las bandas de los extremos eran inalcanzables — código muerto que
// escondía justo los casos que el indicador existe para detectar.
//
// De ahí que estas pruebas miren sobre todo los BORDES: fuera de tabla, y el
// valor que cae EXACTAMENTE en el corte (que sí sigue siendo p5 / p95).

describe('valueToPercentile: los extremos se salen de la escala', () => {
  const row = { ageMin: 25, ageMax: 29.9, p: [27, 28, 28.7, 29.8, 31.8, 34.2, 35.5, 36.6, 38.3] };

  it('por encima del último corte devuelve 100, no 95', () => {
    expect(valueToPercentile(row, 40)).toBe(100);
  });

  it('por debajo del primer corte devuelve 0, no 5', () => {
    expect(valueToPercentile(row, 20)).toBe(0);
  });

  it('el valor exacto del corte sigue siendo su percentil', () => {
    expect(valueToPercentile(row, 27)).toBe(5);
    expect(valueToPercentile(row, 38.3)).toBe(95);
    expect(valueToPercentile(row, 31.8)).toBe(50);
  });
});

describe('armCircumferenceAssessment (Frisancho)', () => {
  it('40 cm a los 29 años: por encima del p95, no es normal', () => {
    const varon = armCircumferenceAssessment(40, 29, 'M');
    expect(varon.classification).toBe('Riesgo de obesidad/hipertrofia');
    expect(varon.severity).toBe('warn');
    expect(varon.detail).toBe('Por encima del percentil 95');

    const mujer = armCircumferenceAssessment(40, 29, 'F');
    expect(mujer.classification).toBe('Riesgo de obesidad/hipertrofia');
  });

  it('por debajo del p5 avisa de riesgo de desnutrición', () => {
    const r = armCircumferenceAssessment(20, 29, 'M'); // p5 = 27.0 cm
    expect(r.classification).toBe('Riesgo de desnutrición');
    expect(r.severity).toBe('bad');
  });

  it('la mediana de la fila es normal', () => {
    const r = armCircumferenceAssessment(31.8, 29, 'M'); // p50
    expect(r.classification).toBe('Normal');
    expect(r.detail).toBe('Percentil 50');
  });

  it('el p5 y el p95 exactos siguen siendo normales', () => {
    expect(armCircumferenceAssessment(27, 29, 'M').classification).toBe('Normal');
    expect(armCircumferenceAssessment(38.3, 29, 'M').classification).toBe('Normal');
  });
});

describe('ambAssessment (Frisancho)', () => {
  it('por encima del p95 llega a la banda alta', () => {
    const r = ambAssessment(90, 29, 'M'); // p95 = 74.5 cm²
    expect(r.classification).toBe('Musculatura alta: buena nutrición');
  });

  it('por debajo del p5 es musculatura reducida', () => {
    const r = ambAssessment(25, 29, 'M'); // p5 = 36.6 cm²
    expect(r.classification).toBe('Musculatura reducida');
    expect(r.severity).toBe('bad');
  });
});

describe('pliegues', () => {
  it('tríceps por encima de la tabla es exceso de grasa', () => {
    const r = tricepsAssessment(60, 29, 'M');
    expect(r.classification).toBe('Exceso de masa grasa u obesidad');
  });

  it('tríceps por debajo de la tabla es depleción', () => {
    const r = tricepsAssessment(1, 29, 'M');
    expect(r.classification).toBe('Magro o deplección de masa grasa');
  });

  it('subescapular y suma tri+sub también clasifican fuera de tabla', () => {
    expect(subscapularAssessment(80, 29, 'F').classification).toBe('Exceso de masa grasa u obesidad');
    expect(triSubSumAssessment(60, 80, 29, 'F').classification).toBe('Exceso de masa grasa u obesidad');
  });
});

// Las tablas de Frisancho no llegan hasta el final de la vida: pliegues y AMB
// terminan a los 74.9 años y el perímetro del brazo a los 79.9. A quien pasa de
// ahí se le aplica la última fila — es la mejor referencia que hay — pero antes
// no se decía, y un paciente de 82 recibía el patrón de uno de 70-79 como si
// fuera suyo. Ahora el resultado lleva de qué franja etaria salió.
describe('edad fuera de la tabla', () => {
  it('el perímetro del brazo a los 82 años avisa de la franja usada', () => {
    const r = armCircumferenceAssessment(30, 82, 'M');
    expect(r.outOfTable).toBe(true);
    expect(r.detail).toBe('Percentil 42 · tabla de 70-79 años');
    expect(r.classification).toBe('Normal'); // sigue clasificando, no se calla
  });

  it('el AMB y los pliegues se salen de tabla ya a los 78 (llegan a 74.9)', () => {
    expect(ambAssessment(50, 78, 'M').detail).toContain('tabla de 70-74 años');
    expect(tricepsAssessment(12, 78, 'M').detail).toContain('tabla de 70-74 años');
    expect(subscapularAssessment(15, 78, 'M').detail).toContain('tabla de 70-74 años');
    expect(triSubSumAssessment(12, 15, 78, 'M').detail).toContain('tabla de 70-74 años');
  });

  it('dentro de la tabla no se añade nota', () => {
    const r = armCircumferenceAssessment(31.8, 29, 'M');
    expect(r.outOfTable).toBe(false);
    expect(r.detail).toBe('Percentil 50');
  });

  it('el brazo a los 78 todavía está dentro de su tabla (llega a 79.9)', () => {
    expect(armCircumferenceAssessment(30, 78, 'M').outOfTable).toBe(false);
  });
});
