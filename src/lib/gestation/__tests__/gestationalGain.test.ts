import { describe, expect, it } from 'vitest';
import {
  assessGestation,
  calcPrePregnancyBmi,
  estimatedDueDate,
  formatGestationalAge,
  gainRange,
  gestationalAgeAt,
  prePregnancyCategory,
} from '../gestationalGain';

describe('caso del Excel del nutricionista', () => {
  // Gestante de 30 años: peso actual 65 kg, pregestacional 64 kg, talla 168 cm,
  // semana 15, embarazo único. El Excel arroja IMC 22.68 (NORMAL), peso
  // recomendado 65.3-67 kg, ganancia mínima 1.3 y máxima 3, y como ganó 1 kg el
  // diagnóstico es "baja ganancia de peso".
  const result = assessGestation({
    prePregnancyKg: 64,
    currentWeightKg: 65,
    heightCm: 168,
    week: 15,
    type: 'single',
  });

  it('calcula el IMC pregestacional y su categoría', () => {
    expect(result.bmi).toBe(22.68);
    expect(result.category).toBe('normal');
    expect(result.categoryLabel).toBe('Normal');
  });

  it('toma de la tabla el rango de ganancia de la semana 15', () => {
    expect(result.range).toEqual({ min: 1.3, max: 3 });
  });

  it('traduce el rango a peso absoluto recomendado', () => {
    expect(result.recommendedWeight).toEqual({ min: 65.3, max: 67 });
  });

  it('diagnostica baja ganancia porque ganó 1 kg y el mínimo era 1.3', () => {
    expect(result.gainKg).toBe(1);
    expect(result.diagnosis).toBe('Baja ganancia de peso');
    expect(result.severity).toBe('warn');
  });
});

describe('categorías de IMC pregestacional', () => {
  it('usa los cortes estándar', () => {
    expect(prePregnancyCategory(18.4)).toBe('underweight');
    expect(prePregnancyCategory(18.5)).toBe('normal');
    expect(prePregnancyCategory(24.9)).toBe('normal');
    expect(prePregnancyCategory(25)).toBe('overweight');
    expect(prePregnancyCategory(29.9)).toBe('overweight');
    expect(prePregnancyCategory(30)).toBe('obesity');
  });

  it('no clasifica sin IMC', () => {
    expect(prePregnancyCategory(null)).toBeNull();
    expect(calcPrePregnancyBmi(64, null)).toBeNull();
    expect(calcPrePregnancyBmi(null, 168)).toBeNull();
  });
});

describe('diagnóstico según el rango', () => {
  const base = { prePregnancyKg: 64, heightCm: 168, week: 15, type: 'single' as const };

  it('adecuada cuando cae dentro, incluidos los extremos', () => {
    expect(assessGestation({ ...base, currentWeightKg: 65.3 }).diagnosis).toBe('Ganancia adecuada');
    expect(assessGestation({ ...base, currentWeightKg: 66 }).diagnosis).toBe('Ganancia adecuada');
    expect(assessGestation({ ...base, currentWeightKg: 67 }).diagnosis).toBe('Ganancia adecuada');
  });

  it('alta cuando supera el máximo', () => {
    const result = assessGestation({ ...base, currentWeightKg: 68 });
    expect(result.diagnosis).toBe('Alta ganancia de peso');
    expect(result.severity).toBe('bad');
  });

  it('baja cuando no llega al mínimo, incluso si perdió peso', () => {
    expect(assessGestation({ ...base, currentWeightKg: 63 }).diagnosis).toBe('Baja ganancia de peso');
    expect(assessGestation({ ...base, currentWeightKg: 63 }).gainKg).toBe(-1);
  });

  it('lista lo que falta en vez de estimar', () => {
    const result = assessGestation({ currentWeightKg: 65, week: 15 });
    expect(result.diagnosis).toBeNull();
    expect(result.missing).toEqual(['Peso pregestacional', 'Talla']);
  });
});

describe('tabla de ganancia', () => {
  it('los totales de la semana 40 coinciden con el IOM 2009', () => {
    expect(gainRange('underweight', 40)).toEqual({ min: 12.5, max: 18 });
    expect(gainRange('normal', 40)).toEqual({ min: 11.5, max: 16 });
    expect(gainRange('overweight', 40)).toEqual({ min: 7, max: 11.5 });
    expect(gainRange('obesity', 40)).toEqual({ min: 5, max: 9 });
  });

  it('los totales de gemelar también', () => {
    expect(gainRange('normal', 40, 'twin')).toEqual({ min: 17, max: 25 });
    expect(gainRange('overweight', 40, 'twin')).toEqual({ min: 14, max: 23 });
    expect(gainRange('obesity', 40, 'twin')).toEqual({ min: 11, max: 19 });
  });

  // El IOM no publica rangos de gemelar con bajo peso previo: no se estiman.
  it('delgada con embarazo múltiple no tiene tabla', () => {
    expect(gainRange('underweight', 20, 'twin')).toBeNull();

    const result = assessGestation({ prePregnancyKg: 48, currentWeightKg: 52, heightCm: 168, week: 20, type: 'twin' });
    expect(result.category).toBe('underweight');
    expect(result.diagnosis).toBeNull();
    expect(result.notes).toContain('No hay tabla de ganancia de peso para embarazo múltiple en esta condición.');
  });

  // La columna de múltiple arranca en la semana 14, igual que en el IOM.
  it('gemelar tampoco tiene tabla en el primer trimestre', () => {
    expect(gainRange('normal', 13, 'twin')).toBeNull();
    expect(gainRange('normal', 13)).toEqual({ min: 0.5, max: 2 });
    expect(gainRange('normal', 14, 'twin')).toEqual({ min: 1.1, max: 2.8 });
  });

  it('fuera del rango de semanas usa el extremo más cercano y avisa', () => {
    expect(gainRange('normal', 42)).toEqual(gainRange('normal', 40));
    expect(assessGestation({ prePregnancyKg: 64, currentWeightKg: 76, heightCm: 168, week: 42 }).notes[0])
      .toContain('semana 40');
  });
});

describe('edad gestacional', () => {
  it('se calcula desde la FUM a la fecha del control, no a hoy', () => {
    // 2026-07-29 son 105 días después del 2026-04-15 → 15 semanas exactas.
    const age = gestationalAgeAt({ fum: '2026-04-15' }, '2026-07-29');
    expect(age).toMatchObject({ weeks: 15, days: 0, source: 'fum' });

    // Un control anterior debe mostrar la semana que tenía entonces.
    expect(gestationalAgeAt({ fum: '2026-04-15' }, '2026-06-24')).toMatchObject({ weeks: 10 });
  });

  it('reporta los días sueltos sobre la semana cumplida', () => {
    const age = gestationalAgeAt({ fum: '2026-04-15' }, '2026-08-01');
    expect(age).toMatchObject({ weeks: 15, days: 3 });
    expect(formatGestationalAge(age)).toBe('15 s 3 d');
  });

  // Caso de la paciente que no recuerda su FUM: se proyecta desde la ecografía.
  it('sin FUM se proyecta desde la ecografía', () => {
    const pregnancy = { ultrasound: { weeks: 12, days: 2, onDate: '2026-07-01' } };
    expect(gestationalAgeAt(pregnancy, '2026-07-01')).toMatchObject({ weeks: 12, days: 2, source: 'ultrasound' });
    // 28 días después = 4 semanas más.
    expect(gestationalAgeAt(pregnancy, '2026-07-29')).toMatchObject({ weeks: 16, days: 2, source: 'ultrasound' });
  });

  // Antes mandaba la FUM y la ecografia se ignoraba aunque la contradijera.
  // Ahora es al reves: la FUM depende de que la paciente recuerde la fecha y de
  // que haya ovulado el dia 14, y un error ahi desplaza la semana gestacional y
  // con ella todo el rango de ganancia de peso esperada.
  it('la ecografia manda sobre la FUM cuando existen las dos', () => {
    const age = gestationalAgeAt({ fum: '2026-04-15', ultrasound: { weeks: 20, onDate: '2026-07-01' } }, '2026-07-29');
    expect(age?.source).toBe('ultrasound');
    // 20 semanas el 01-07 + 28 dias hasta el 29-07 = 24 semanas.
    expect(age?.weeks).toBe(24);
    // La FUM habria dado 15, nueve semanas menos.
  });

  it('sin ecografia sigue valiendo la FUM', () => {
    const age = gestationalAgeAt({ fum: '2026-04-15' }, '2026-07-29');
    expect(age?.source).toBe('fum');
    expect(age?.weeks).toBe(15);
  });

  // La fecha de parto tiene que salir de la misma fuente que la semana, o la
  // pantalla se contradice consigo misma.
  it('la fecha probable de parto sigue la misma prioridad', () => {
    const conEco = estimatedDueDate({ fum: '2026-04-15', ultrasound: { weeks: 20, onDate: '2026-07-01' } });
    const soloFum = estimatedDueDate({ fum: '2026-04-15' });

    expect(conEco).not.toBe(soloFum);
    // 20 semanas el 01-07 -> faltan 140 dias para las 40 -> 18-11-2026.
    expect(conEco).toBe('2026-11-18');
    // Naegele: 15-04 + 280 dias.
    expect(soloFum).toBe('2027-01-20');
  });

  it('devuelve null sin datos o con fechas imposibles', () => {
    expect(gestationalAgeAt(null, '2026-07-29')).toBeNull();
    expect(gestationalAgeAt({}, '2026-07-29')).toBeNull();
    // Control anterior a la FUM.
    expect(gestationalAgeAt({ fum: '2026-08-15' }, '2026-07-29')).toBeNull();
  });
});

describe('fecha probable de parto', () => {
  it('sale de la FUM más 280 días', () => {
    expect(estimatedDueDate({ fum: '2026-04-15' })).toBe('2027-01-20');
  });

  it('sin FUM se deriva de la ecografía', () => {
    // 12 s 2 d el 2026-07-01 → faltan 280 − 86 = 194 días.
    expect(estimatedDueDate({ ultrasound: { weeks: 12, days: 2, onDate: '2026-07-01' } })).toBe('2027-01-11');
  });

  it('null cuando no hay ninguna referencia', () => {
    expect(estimatedDueDate({})).toBeNull();
  });
});
