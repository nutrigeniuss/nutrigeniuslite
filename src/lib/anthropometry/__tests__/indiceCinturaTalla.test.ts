import { describe, expect, it } from 'vitest';

import { calcWHtR, WHTR_LABELS } from '../indicators/circumferences';
import { evaluatePediatric } from '../pediatric';

// El ICT es el único indicador de riesgo que no necesita tabla por edad ni por
// sexo: los mismos cuatro cortes valen del niño de 5 años al adulto mayor. Por
// eso importa que los cortes estén bien y que se apliquen en los DOS paneles.
//
// Criterio (Ashwell 2012), tal como lo fijó el nutricionista:
//   < 0.4        Bajo peso / Delgadez extrema
//   0.4 a < 0.5  Saludable          (verde)
//   0.5 a < 0.6  Riesgo aumentado   (amarillo)
//   ≥ 0.6        Riesgo alto        (rojo)

describe('calcWHtR: los cuatro tramos', () => {
  // cintura / talla, con talla 100 cm para que el ratio se lea directo.
  const ict = (ratio: number, age = 30) => calcWHtR(ratio * 100, 100, age);

  it('por debajo de 0.4 es delgadez extrema, no "saludable"', () => {
    expect(ict(0.33).classification).toBe(WHTR_LABELS.bajoPeso);
    expect(ict(0.33).severity).toBe('warn');
  });

  it('de 0.4 a 0.5 es saludable', () => {
    expect(ict(0.4).classification).toBe(WHTR_LABELS.saludable);
    expect(ict(0.49).classification).toBe(WHTR_LABELS.saludable);
    expect(ict(0.4).severity).toBe('good');
  });

  it('de 0.5 a 0.6 es riesgo AUMENTADO (antes decía "elevado")', () => {
    expect(ict(0.5).classification).toBe(WHTR_LABELS.riesgoAumentado);
    expect(ict(0.51).classification).toBe(WHTR_LABELS.riesgoAumentado);
    expect(ict(0.59).classification).toBe(WHTR_LABELS.riesgoAumentado);
    expect(ict(0.5).severity).toBe('warn');
  });

  it('de 0.6 para arriba es riesgo alto', () => {
    expect(ict(0.6).classification).toBe(WHTR_LABELS.riesgoAlto);
    expect(ict(0.75).classification).toBe(WHTR_LABELS.riesgoAlto);
    expect(ict(0.6).severity).toBe('bad');
  });

  it('los bordes exactos caen en la banda MENOS severa', () => {
    // 0.40, 0.50 y 0.60 abren su tramo: es donde una etiqueta se vuelve la de
    // al lado y donde un paciente cambia de conversación.
    expect(ict(0.39).classification).toBe(WHTR_LABELS.bajoPeso);
    expect(ict(0.4).classification).toBe(WHTR_LABELS.saludable);
    expect(ict(0.49).classification).toBe(WHTR_LABELS.saludable);
    expect(ict(0.5).classification).toBe(WHTR_LABELS.riesgoAumentado);
    expect(ict(0.59).classification).toBe(WHTR_LABELS.riesgoAumentado);
    expect(ict(0.6).classification).toBe(WHTR_LABELS.riesgoAlto);
  });

  it('la etiqueta corresponde al número que se muestra, ya redondeado', () => {
    // 39.9/100 = 0.399, que en pantalla sale como 0.40. Se clasifica sobre el
    // 0.40 que el paciente ve, no sobre el 0.399 que no ve: si no, la ficha
    // diría "0.40 · Bajo peso" y parecería un error de la app. Es el mismo
    // criterio que ya usa el IMC.
    const r = calcWHtR(39.9, 100, 30);
    expect(r.value).toBe(0.4);
    expect(r.classification).toBe(WHTR_LABELS.saludable);
  });
});

describe('calcWHtR: se aplica desde los 5 años', () => {
  it('a los 5 años ya clasifica', () => {
    expect(calcWHtR(52, 110, 5).classification).toBe(WHTR_LABELS.saludable);
  });

  it('por debajo de 5 años no clasifica, pero muestra el valor', () => {
    const r = calcWHtR(47, 95, 3);
    expect(r.value).toBe(0.49);
    expect(r.classification).toBe('No aplica');
    expect(r.severity).toBe('info');
    expect(r.detail).toContain('desde los 5 años');
  });

  it('sin edad se clasifica igual: en el panel de adulto no hay preescolares', () => {
    expect(calcWHtR(80, 160).classification).toBe(WHTR_LABELS.riesgoAumentado); // 0.50
    expect(calcWHtR(100, 160).classification).toBe(WHTR_LABELS.riesgoAlto);     // 0.63
  });
});

describe('el ICT entra en la evaluación pediátrica', () => {
  const base = { sex: 'boys' as const, weightKg: 30, heightCm: 130 };

  it('un niño de 8 años con cintura alta sale en rojo', () => {
    const ped = evaluatePediatric({ ...base, ageMonths: 96, waistCm: 85 });
    const ict = ped?.results.find((r) => r.indicator === 'whtr');
    expect(ict?.valueLabel).toBe('0.65');
    expect(ict?.classification.label).toBe(WHTR_LABELS.riesgoAlto);
    expect(ict?.classification.tone).toBe('critical');
  });

  it('un niño de 8 años con cintura normal sale en verde', () => {
    const ped = evaluatePediatric({ ...base, ageMonths: 96, waistCm: 58 });
    const ict = ped?.results.find((r) => r.indicator === 'whtr');
    expect(ict?.classification.label).toBe(WHTR_LABELS.saludable);
    expect(ict?.classification.tone).toBe('normal');
  });

  it('a un preescolar de 4 años no se le pone la etiqueta', () => {
    const ped = evaluatePediatric({ ...base, ageMonths: 48, heightCm: 100, waistCm: 52 });
    expect(ped?.results.some((r) => r.indicator === 'whtr')).toBe(false);
  });

  it('sin cintura medida no aparece la fila', () => {
    const ped = evaluatePediatric({ ...base, ageMonths: 96 });
    expect(ped?.results.some((r) => r.indicator === 'whtr')).toBe(false);
  });
});

// ── El candado ───────────────────────────────────────────────────────────────
// Lo que pasó el 31-08-2026: se renombraron las etiquetas del ICT y la tabla de
// tonos de pediatría, que las usaba como CLAVE, dejó de encontrarlas. Sin tono
// la fila no se pinta, así que el indicador DESAPARECIÓ de la ficha del niño y
// del informe impreso — sin error, sin aviso, sin que ningún test lo notara.
//
// Esta prueba recorre los cuatro tramos y exige que TODOS salgan en la
// evaluación pediátrica. Si alguien vuelve a desincronizar las etiquetas, falla
// aquí en vez de en la consulta.
describe('el ICT nunca puede desaparecer de la ficha del niño', () => {
  // Mismo perfil que usan las pruebas de arriba: niño de 8 años, 30 kg, 130 cm.
  const nino = { sex: 'boys' as const, weightKg: 30, ageMonths: 96, heightCm: 130 };

  // Cinturas elegidas para caer en cada uno de los cuatro tramos con talla 130.
  const porTramo = [
    { cintura: 50, esperado: WHTR_LABELS.bajoPeso },       // 0.38
    { cintura: 58, esperado: WHTR_LABELS.saludable },      // 0.45
    { cintura: 70, esperado: WHTR_LABELS.riesgoAumentado },// 0.54
    { cintura: 85, esperado: WHTR_LABELS.riesgoAlto },     // 0.65
  ];

  for (const { cintura, esperado } of porTramo) {
    it(`con cintura ${cintura} cm sale la fila y dice "${esperado}"`, () => {
      const ped = evaluatePediatric({ ...nino, waistCm: cintura });
      const ict = ped?.results.find((r) => r.indicator === 'whtr');

      // Lo primero: que la fila EXISTA. Ése fue el fallo.
      expect(ict, 'el ICT no debe desaparecer').toBeDefined();
      expect(ict?.classification.label).toBe(esperado);
      expect(ict?.classification.tone).toBeTruthy();
    });
  }
});
