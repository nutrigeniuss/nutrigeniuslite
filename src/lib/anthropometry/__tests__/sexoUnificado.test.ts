import { describe, expect, it } from 'vitest';

import { normalizeSex } from '../indicators/shared';
import { parseSex } from '../pediatric';
import { parseSexKey } from '@/lib/lab/labAnalytes';
import { calcTMB } from '../../../components/patient/requerimiento/logic';
import { RDI_GROUPS, findRdiGroup } from '@/lib/rdi';
import { SEX_LABEL } from '../types';

// Cinco módulos leen el sexo del paciente y los cinco tienen que entenderlo
// igual. Llegaron a no hacerlo: la letra "M" era MUJER en antropometría de
// adulto, VARÓN en pediatría y en laboratorio, y el requerimiento comparaba con
// la cadena exacta 'Masculino'. El mismo paciente cambiaba de sexo al cambiar
// de pestaña, y con él los cortes de riesgo, el peso ideal, la TMB y el rango
// de referencia de la hemoglobina.
//
// LA REGLA, fijada por el nutricionista: M es masculino y F es femenino, en
// todos los módulos, como en cualquier ficha clínica.
//
// Esta prueba existe para que no vuelvan a separarse. Si alguien añade un
// quinto lector o toca uno de los cuatro, aquí se nota.

const ENTRADAS: [string, 'M' | 'F' | null][] = [
  ['Masculino', 'M'], ['masculino', 'M'], ['MASCULINO', 'M'], ['  Masculino  ', 'M'],
  ['Hombre', 'M'], ['hombre', 'M'], ['Varón', 'M'], ['Varon', 'M'], ['varón', 'M'],
  ['male', 'M'], ['Male', 'M'], ['Niño', 'M'], ['nino', 'M'], ['boy', 'M'],
  ['Femenino', 'F'], ['femenino', 'F'], ['FEMENINO', 'F'], ['Mujer', 'F'], ['mujer', 'F'],
  ['female', 'F'], ['Niña', 'F'], ['nina', 'F'], ['girl', 'F'],
  // La inicial sola: M masculino, F femenino.
  ['M', 'M'], ['m', 'M'], ['F', 'F'], ['f', 'F'],
  // "Mujer" empieza por eme y sigue siendo femenino: la palabra manda sobre la
  // inicial. Igual que "femenino" no puede caer en el patrón de "niño".
  ['Mujer', 'F'], ['MUJER', 'F'],
  // Desconocidos: null en los cuatro, nunca un sexo por defecto.
  ['', null], ['   ', null], ['otro', null], ['x', null], ['1', null],
];

describe('los cinco lectores del sexo dicen lo mismo', () => {
  it('antropometría de adulto', () => {
    for (const [texto, esperado] of ENTRADAS) {
      expect(normalizeSex(texto), `"${texto}"`).toBe(esperado);
    }
  });

  it('antropometría pediátrica', () => {
    for (const [texto, esperado] of ENTRADAS) {
      const pediatrico = esperado === 'M' ? 'boys' : esperado === 'F' ? 'girls' : null;
      expect(parseSex(texto), `"${texto}"`).toBe(pediatrico);
    }
  });

  it('laboratorio (rangos de referencia por sexo)', () => {
    for (const [texto, esperado] of ENTRADAS) {
      const lab = esperado === 'M' ? 'male' : esperado === 'F' ? 'female' : null;
      expect(parseSexKey(texto), `"${texto}"`).toBe(lab);
    }
  });

  it('objetivos de micronutrientes (RDI por sexo y edad)', () => {
    // Quinto lector: tenía su propia heurística y daba por MASCULINO todo lo
    // que no empezara por "f".
    for (const [texto, esperado] of ENTRADAS) {
      const grupo = findRdiGroup({ ageYears: 30, sex: texto });
      if (esperado === null) {
        expect(grupo, `"${texto}"`).toBeNull(); // sin sexo no se inventan objetivos
      } else {
        expect(grupo?.population, `"${texto}"`).toBe(esperado === 'M' ? 'male' : 'female');
      }
    }
  });

  it('y las etiquetas de esos grupos usan el vocabulario único', () => {
    // Masculino / Femenino, nunca "Hombres" ni "Mujeres".
    const adultos = RDI_GROUPS.filter((g) => g.population === 'male' || g.population === 'female');
    expect(adultos.length).toBeGreaterThan(0);
    for (const grupo of adultos) {
      expect(grupo.label, grupo.label).toMatch(/^(Masculino|Femenino) /);
    }
  });

  it('requerimiento calórico (elige la ecuación de TMB)', () => {
    const medicion = { weight: 70, height: 175 } as never;
    const AL = new Date('2026-08-21');
    const tmb = (gender: string) =>
      calcTMB('Mifflin-St Jeor', { birth_date: '1990-01-01', gender } as never, medicion, AL);

    const varon = tmb('Masculino')!;
    const mujer = tmb('Femenino')!;
    expect(varon - mujer).toBeCloseTo(166, 1); // las dos ecuaciones difieren en 166 kcal

    for (const [texto, esperado] of ENTRADAS) {
      if (esperado === null) {
        // Sin sexo no hay ecuación que elegir: no se calcula, no se supone.
        expect(tmb(texto), `"${texto}"`).toBeNull();
        continue;
      }
      expect(tmb(texto), `"${texto}"`).toBeCloseTo(esperado === 'M' ? varon : mujer, 1);
    }
  });
});

// El otro lado del mismo problema: además de LEERLO igual, hay que ESCRIBIRLO
// igual. "Mujer", "Hombre" y "varón" son el mismo dato con otras palabras, y lo
// que se escribe de tres formas se acaba leyendo de tres.
describe('el sexo se escribe siempre igual: Masculino / Femenino', () => {
  it('el vocabulario está en un solo sitio', () => {
    expect(SEX_LABEL).toEqual({ M: 'Masculino', F: 'Femenino' });
  });

  it('los textos de los indicadores lo usan', async () => {
    const { calcPCTPercent } = await import('../indicators/circumferences');
    const { calcComplexionFrame, idealWeightByComplexion } = await import('../indicators/complexion');

    expect(calcPCTPercent(12, 'M').detail).toContain('Masculino');
    expect(calcPCTPercent(12, 'F').detail).toContain('Femenino');

    // Talla fuera de la cobertura de la tabla → cita el rango de su sexo.
    const frame = calcComplexionFrame(200, 17, 'M').value;
    expect(idealWeightByComplexion(200, 'M', frame).detail).toContain('Masculino');
    expect(idealWeightByComplexion(140, 'F', frame).detail).toContain('Femenino');
  });

  it('ningún texto visible dice varón, hombre ni mujer', async () => {
    const { calcPCTPercent } = await import('../indicators/circumferences');
    for (const sexo of ['M', 'F'] as const) {
      expect(calcPCTPercent(12, sexo).detail).not.toMatch(/var[oó]n|hombre|mujer/i);
    }
  });
});
