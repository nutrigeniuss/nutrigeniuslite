import { describe, it, expect } from 'vitest';
import { calcTMB, formatSigned, FORMULA, FORMULAS } from '../logic';
import type { MeasurementRecord, PatientRequirementRecord } from '../types';

const HOY = new Date(2026, 7, 21); // 21/08/2026, fijo para que el test no dependa del reloj.

// MIFFLIN-ST JEOR VA CON LOS COEFICIENTES ORIGINALES: 9.99 y 4.92.
//
// Son los publicados por Mifflin et al. en 1990. La versión redondeada a 10 y 5
// está igual de extendida y es la que usaba esta app hasta el 31-08-2026, pero
// se cambió a propósito a los exactos por decisión del nutricionista.
//
// La diferencia es de 2 a 4 kcal por paciente: despreciable en la consulta,
// pero sistemática. Si alguien ve "9.99" y le parece un error de tipeo, NO lo
// redondee: primero pregunte.

const paciente = (birth_date: string | null, gender = 'Masculino'): PatientRequirementRecord =>
  ({ birth_date, gender } as PatientRequirementRecord);

const medicion = (weight: number, height: number): MeasurementRecord => ({ weight, height });

// Edad que cumple N años exactos HOY.
const naceHace = (years: number) => `${2026 - years}-08-21`;

describe('calcTMB — tramos de lactante (FAO/OMS/OPS)', () => {
  // El bug: la edad se redondeaba a años enteros, así que TODO menor de un año
  // caía en la fórmula de 0-6 meses y la de 6-12 meses era código muerto.
  it('un bebé de 10 meses usa la fórmula de 6-12 meses, no la de 0-6', () => {
    const bebe = paciente('2025-10-14'); // 10 meses al 21/08/2026
    const tmb = calcTMB('FAO/OMS/OPS', bebe, medicion(9, 72), HOY);
    expect(tmb).toBeCloseTo(-99.4 + 88.6 * 9, 4); // 698.0, antes daba 683.2
  });

  it('un bebé de 3 meses sí usa la fórmula de 0-6 meses', () => {
    const bebe = paciente('2026-05-21'); // 3 meses exactos
    expect(calcTMB('FAO/OMS/OPS', bebe, medicion(6, 60), HOY)).toBeCloseTo(-152 + 92.8 * 6, 4);
  });

  it('el corte de los 6 meses cae en el día exacto', () => {
    const antes = calcTMB('FAO/OMS/OPS', paciente('2026-02-22'), medicion(8, 65), HOY); // 5 meses y 30 días
    const justo = calcTMB('FAO/OMS/OPS', paciente('2026-02-21'), medicion(8, 65), HOY); // 6 meses exactos
    expect(antes).toBeCloseTo(-152 + 92.8 * 8, 4);
    expect(justo).toBeCloseTo(-99.4 + 88.6 * 8, 4);
  });

  it('al cumplir un año pasa al tramo infantil, no al de lactante', () => {
    const unAnio = paciente(naceHace(1));
    expect(calcTMB('FAO/OMS/OPS', unAnio, medicion(10, 76), HOY))
      .toBeCloseTo(310.2 + 63.3 * 10 - 0.263 * 10 * 10, 4);
  });
});

describe('calcTMB — el cumpleaños cae en el día correcto', () => {
  // Con `diferencia / 365.25` la edad saltaba un día antes de tiempo, y en los
  // cortes de 30 y 60 años eso cambia de tramo de fórmula.
  it('la víspera de cumplir 30 sigue en el tramo de 18-30', () => {
    const vispera = calcTMB('FAO/OMS/OPS', paciente('1996-08-22'), medicion(70, 175), HOY);
    expect(vispera).toBeCloseTo(15.057 * 70 + 692.2, 4); // 1746.2
  });

  it('el día que cumple 30 pasa al tramo de 30-60', () => {
    const cumple = calcTMB('FAO/OMS/OPS', paciente('1996-08-21'), medicion(70, 175), HOY);
    expect(cumple).toBeCloseTo(11.472 * 70 + 873.1, 4); // 1676.1
  });

  it('lo mismo en el corte de los 60', () => {
    expect(calcTMB('FAO/OMS/OPS', paciente('1966-08-22'), medicion(70, 175), HOY))
      .toBeCloseTo(11.472 * 70 + 873.1, 4);
    expect(calcTMB('FAO/OMS/OPS', paciente('1966-08-21'), medicion(70, 175), HOY))
      .toBeCloseTo(11.711 * 70 + 587.7, 4);
  });

  it('Schofield respeta los mismos cortes', () => {
    expect(calcTMB('Schofield', paciente('2023-08-22'), medicion(14, 95), HOY)) // 2 años y 364 días
      .toBeCloseTo(0.167 * 14 + 15.174 * 95 - 617.6, 4);
    expect(calcTMB('Schofield', paciente('2023-08-21'), medicion(14, 95), HOY)) // 3 años exactos
      .toBeCloseTo(19.59 * 14 + 1.303 * 95 + 414.9, 4);
  });
});

describe('calcTMB — la edad entra como decimal donde multiplica', () => {
  // 12 meses = 1 año, 1 año y 6 meses = 1.5, 10 meses = 0.833.
  // Antes se truncaba a años enteros, un error siempre hacia abajo de hasta
  // 11 meses.
  it('40 años y 6 meses se calcula como 40.5, no como 40', () => {
    const p = paciente('1986-02-21'); // 40 años y 6 meses al 21/08/2026
    const esperado = 88.362 + 13.397 * 70 + 4.799 * 175 - 5.677 * 40.5;
    expect(calcTMB('Harris-Benedict', p, medicion(70, 175), HOY)).toBeCloseTo(esperado, 4);
    // Y NO el valor viejo, que truncaba a 40.
    expect(calcTMB('Harris-Benedict', p, medicion(70, 175), HOY))
      .not.toBeCloseTo(88.362 + 13.397 * 70 + 4.799 * 175 - 5.677 * 40, 4);
  });

  it('10 meses son 0.833 años en Mifflin', () => {
    const p = paciente('2025-10-21'); // 10 meses exactos
    expect(calcTMB('Mifflin-St Jeor', p, medicion(9, 72), HOY))
      .toBeCloseTo(9.99 * 9 + 6.25 * 72 - 4.92 * (10 / 12) + 5, 4);
  });

  it('un año y medio son 1.5 años', () => {
    const p = paciente('2025-02-21');
    expect(calcTMB('Mifflin-St Jeor', p, medicion(11, 82), HOY))
      .toBeCloseTo(9.99 * 11 + 6.25 * 82 - 4.92 * 1.5 + 5, 4);
  });

  it('los DÍAS no mueven el resultado: solo cuentan años y meses', () => {
    const medida = medicion(70, 175);
    // Mismo mes cumplido (40 años y 6 meses), distinto día dentro del mes.
    const alDia = calcTMB('Harris-Benedict', paciente('1986-02-21'), medida, HOY);
    const veinteDiasMas = calcTMB('Harris-Benedict', paciente('1986-02-01'), medida, HOY);
    expect(alDia).toBe(veinteDiasMas);
  });

  it('el decimal NO altera la elección de tramo: 29 y 11 meses sigue en 18-30', () => {
    // Con la edad decimal (29.92) el tramo se elige igual que con la entera.
    expect(calcTMB('FAO/OMS/OPS', paciente('1996-09-21'), medicion(70, 175), HOY))
      .toBeCloseTo(15.057 * 70 + 692.2, 4);
  });
});

describe('calcTMB — fórmulas lineales y casos sin dato', () => {
  it('Harris-Benedict y Mifflin usan los años cumplidos', () => {
    const p = paciente(naceHace(40));
    expect(calcTMB('Harris-Benedict', p, medicion(70, 175), HOY))
      .toBeCloseTo(88.362 + 13.397 * 70 + 4.799 * 175 - 5.677 * 40, 4);
    expect(calcTMB('Mifflin-St Jeor', p, medicion(70, 175), HOY))
      .toBeCloseTo(9.99 * 70 + 6.25 * 175 - 4.92 * 40 + 5, 4);
  });

  it('distingue el sexo del paciente', () => {
    const f = paciente(naceHace(40), 'Femenino');
    expect(calcTMB('Mifflin-St Jeor', f, medicion(60, 160), HOY))
      .toBeCloseTo(9.99 * 60 + 6.25 * 160 - 4.92 * 40 - 161, 4);
  });

  it('sin fecha de nacimiento, sin peso o sin talla no calcula nada', () => {
    expect(calcTMB('Harris-Benedict', paciente(null), medicion(70, 175), HOY)).toBeNull();
    expect(calcTMB('Harris-Benedict', paciente(naceHace(40)), medicion(0, 175), HOY)).toBeNull();
    expect(calcTMB('Harris-Benedict', paciente(naceHace(40)), null, HOY)).toBeNull();
  });

  it('una fecha de nacimiento futura no produce un número, produce nada', () => {
    // Antes daba edad negativa y devolvía un valor con pinta de válido.
    expect(calcTMB('Harris-Benedict', paciente('2027-01-01'), medicion(70, 175), HOY)).toBeNull();
  });

  it('una fórmula desconocida devuelve null', () => {
    expect(calcTMB('Inventada', paciente(naceHace(40)), medicion(70, 175), HOY)).toBeNull();
  });
});

describe('formatSigned · el signo del desglose del VCT', () => {
  it('antepone "+" solo a los positivos', () => {
    expect(formatSigned(230)).toBe('+230');
    expect(formatSigned(1)).toBe('+1');
  });

  // El fallo real: con un NAF por debajo de 1 la contribución de actividad es
  // NEGATIVA, y `+${valor}` producía "+-230" en pantalla.
  it('no antepone "+" a un negativo: nunca "+-230"', () => {
    expect(formatSigned(-230)).toBe('-230');
    expect(formatSigned(-230)).not.toContain('+');
  });

  it('el cero va sin signo', () => {
    expect(formatSigned(0)).toBe('0');
  });
});

// ── El candado ───────────────────────────────────────────────────────────────
// El nombre de la fórmula se GUARDA EN LA BASE (`selected_formula`, una fila
// por paciente) y `calcTMB` lo compara para elegir la ecuación. Si se renombra
// una y el cálculo no se entera, devuelve null y el requerimiento sale VACÍO —
// no solo para los pacientes nuevos, también para todos los que ya tenían
// guardado el nombre viejo.
//
// Es el mismo fallo que el 31-08-2026 hizo desaparecer el índice cintura-talla
// de la ficha del niño, pero aquí lo que se apaga es el cálculo de calorías.
describe('todas las fórmulas del desplegable saben calcular', () => {
  const paciente30 = paciente(naceHace(30));
  const medida = medicion(70, 175);

  for (const formula of FORMULAS) {
    it(`"${formula}" devuelve un número, no null`, () => {
      const tmb = calcTMB(formula, paciente30, medida, HOY);

      expect(tmb, `la fórmula "${formula}" no fue reconocida por calcTMB`).not.toBeNull();
      expect(Number.isFinite(tmb as number)).toBe(true);
      expect(tmb as number).toBeGreaterThan(0);
    });
  }

  it('la lista del desplegable y las constantes no se pueden desincronizar', () => {
    expect(FORMULAS).toEqual([
      FORMULA.harrisBenedict,
      FORMULA.mifflin,
      FORMULA.faoOmsOps,
      FORMULA.schofield,
    ]);
  });

  // Los textos son los que están GUARDADOS en la base de pacientes. Cambiarlos
  // exige además una migración de la columna, no basta con editar la cadena.
  it('el texto guardado en la base no cambia por accidente', () => {
    expect(FORMULA.harrisBenedict).toBe('Harris-Benedict');
    expect(FORMULA.mifflin).toBe('Mifflin-St Jeor');
    expect(FORMULA.faoOmsOps).toBe('FAO/OMS/OPS');
    expect(FORMULA.schofield).toBe('Schofield');
  });
});
