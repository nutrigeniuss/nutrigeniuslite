import { describe, expect, it } from 'vitest';
import { nearestLossWindow, weightChangePercent } from '../indicators/weightChange';

describe('nearestLossWindow', () => {
  it('propone la ventana cuya ancla está más cerca del intervalo real', () => {
    expect(nearestLossWindow(5)).toBe('1w');
    expect(nearestLossWindow(38)).toBe('1m');
    expect(nearestLossWindow(70)).toBe('3m');
    expect(nearestLossWindow(160)).toBe('6m');
  });

  // Cortes en 18, 60 y 135 días (puntos medios entre anclas).
  it('cambia de ventana en el punto medio entre anclas', () => {
    expect(nearestLossWindow(18)).toBe('1w');
    expect(nearestLossWindow(19)).toBe('1m');
    expect(nearestLossWindow(60)).toBe('1m');
    expect(nearestLossWindow(61)).toBe('3m');
    expect(nearestLossWindow(135)).toBe('3m');
    expect(nearestLossWindow(136)).toBe('6m');
  });

  it('no propone ventana fuera de la cobertura de la tabla', () => {
    expect(nearestLossWindow(280)).toBeNull();
    expect(nearestLossWindow(null)).toBeNull();
  });
});

describe('weightChangePercent', () => {
  it('calcula el porcentaje respecto del peso usual', () => {
    expect(weightChangePercent(70, 63.9, 30).value).toBe(8.71);
    expect(weightChangePercent(70, 78.9, 30).value).toBe(-12.71);
  });

  // Tabla 6 (Luna D.): el valor que cae justo en el corte de "significativa"
  // se clasifica como significativa; por debajo, no significativa.
  it('aplica los cortes de 1 semana (1-2 % / >2 %)', () => {
    expect(weightChangePercent(100, 99.5, 7).classification).toBe('No significativa');
    expect(weightChangePercent(100, 99, 7).classification).toBe('Pérdida significativa');
    expect(weightChangePercent(100, 98, 7).classification).toBe('Pérdida significativa');
    expect(weightChangePercent(100, 97.9, 7).classification).toBe('Pérdida severa');
  });

  it('aplica los cortes de 1 mes (5 % / >5 %)', () => {
    expect(weightChangePercent(100, 95.5, 30).classification).toBe('No significativa');
    expect(weightChangePercent(100, 95, 30).classification).toBe('Pérdida significativa');
    expect(weightChangePercent(100, 94.9, 30).classification).toBe('Pérdida severa');
  });

  it('aplica los cortes de 3 meses (7-8 % / >8 %)', () => {
    expect(weightChangePercent(100, 93.5, 90).classification).toBe('No significativa');
    expect(weightChangePercent(100, 93, 90).classification).toBe('Pérdida significativa');
    expect(weightChangePercent(100, 92, 90).classification).toBe('Pérdida significativa');
    expect(weightChangePercent(100, 91.9, 90).classification).toBe('Pérdida severa');
  });

  it('aplica los cortes de 6 meses (10 % / >10 %)', () => {
    expect(weightChangePercent(100, 90.5, 180).classification).toBe('No significativa');
    expect(weightChangePercent(100, 90, 180).classification).toBe('Pérdida significativa');
    expect(weightChangePercent(100, 89.9, 180).classification).toBe('Pérdida severa');
  });

  // El mismo 6 % es severo en un mes e irrelevante en tres: por eso la ventana
  // se muestra y se puede corregir.
  it('clasifica el mismo porcentaje distinto según la ventana', () => {
    expect(weightChangePercent(100, 94, 30).classification).toBe('Pérdida severa');
    expect(weightChangePercent(100, 94, 90).classification).toBe('No significativa');
  });

  it('respeta la ventana elegida por el nutricionista sobre la automática', () => {
    const auto = weightChangePercent(100, 94, 90);
    expect(auto.window?.key).toBe('3m');
    expect(auto.windowIsManual).toBe(false);

    const manual = weightChangePercent(100, 94, 90, '1m');
    expect(manual.window?.key).toBe('1m');
    expect(manual.windowIsManual).toBe(true);
    expect(manual.classification).toBe('Pérdida severa');
  });

  // Sin ventana se informa el % pero no se arriesga una severidad.
  it('no clasifica sin tiempo transcurrido ni fuera de cobertura', () => {
    expect(weightChangePercent(70, 63.9, null).classification).toBeUndefined();
    expect(weightChangePercent(70, 63.9, 400).classification).toBeUndefined();
    expect(weightChangePercent(70, 63.9, null).value).toBe(8.71);
  });

  // Una ganancia de peso no tiene cortes en esta tabla: llamarla "no
  // significativa" haría creer que se evaluó contra un criterio.
  it('no clasifica las ganancias de peso', () => {
    const result = weightChangePercent(70, 78.9, 30);
    expect(result.classification).toBeUndefined();
    expect(result.severity).toBe('info');
  });

  it('lista los datos que faltan en vez de calcular', () => {
    expect(weightChangePercent(null, 63.9, 30).missing).toEqual(['Peso habitual']);
    expect(weightChangePercent(70, null, 30).missing).toEqual(['Peso actual']);
    expect(weightChangePercent(null, null, 30).missing).toEqual(['Peso habitual', 'Peso actual']);
  });
});
