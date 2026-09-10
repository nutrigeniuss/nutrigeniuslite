import { describe, expect, it } from 'vitest';

import { calcAge, normalizeSex } from '../indicators/shared';
import { calcBMI } from '../indicators/bmi';
import { healthyWeightRange, idealWeightByBmi } from '../indicators/idealWeight';
import { bodyFatDurninSiri } from '../indicators/bodyFat';
import { parseSex } from '../pediatric';

// Dos datos de filiación —la edad y el sexo— mandan sobre casi todos los
// diagnósticos de la ficha. Estas pruebas cubren los dos fallos que tenían:
//   · la edad se tomaba del día en que se MIRA la pantalla, no del día de la
//     consulta, así que una consulta archivada cambiaba de diagnóstico sola;
//   · el sexo se leía con tres heurísticas distintas que no coincidían.

describe('la edad es la de la fecha de la consulta', () => {
  const NACIMIENTO = '1966-06-01';
  const CONSULTA = '2024-06-01';   // el paciente tenía 58
  const HOY = new Date('2026-08-21'); // hoy tiene 60

  it('una consulta archivada conserva su diagnóstico', () => {
    const edadEnConsulta = calcAge(NACIMIENTO, CONSULTA);
    expect(edadEnConsulta).toBe(58);

    // Mismo peso y talla, leídos hoy: el diagnóstico NO puede moverse.
    const imc = calcBMI(70, 164, edadEnConsulta);
    expect(imc.value).toBe(26.03);
    expect(imc.classification).toBe('Sobrepeso');

    // Con la edad de hoy (60) el mismo IMC pasaría a "Normal" por el criterio
    // de adulto mayor, y el paciente vería otra cosa que en su informe impreso.
    expect(calcBMI(70, 164, calcAge(NACIMIENTO, HOY)!).classification).toBe('Normal');
  });

  it('el peso ideal y el rango sano tampoco se mueven solos', () => {
    const enConsulta = calcAge(NACIMIENTO, CONSULTA)!;
    expect(idealWeightByBmi(164, enConsulta).value).toBe(58.36);
    expect(healthyWeightRange(164, enConsulta).max.value).toBe(66.97);
  });

  it('el % de grasa no cambia de tramo por el calendario', () => {
    // Durnin-Womersley usa constantes por década: a los 29 y a los 31 no son
    // las mismas, y con la edad de hoy una consulta vieja cambiaba de número.
    const alos29 = bodyFatDurninSiri(6, 15, 12, 14, calcAge('1995-01-01', '2024-06-01'), 'M');
    expect(alos29.value).toBe(18.12);
  });

  it('la edad es de calendario: el día del cumpleaños ya cuenta', () => {
    // Con `ms / 365.25 días` el mismo día en que cumplía 25 la app aún daba
    // 24.98 y usaba la fila de 18-24.9 de las tablas de percentiles.
    expect(calcAge('2001-03-15', '2026-03-15')).toBe(25);
    expect(calcAge('1961-07-04', '2026-07-04')).toBe(65);
    expect(calcAge('2021-02-28', '2026-02-28')).toBe(5);
  });

  it('sin fecha de referencia sigue valiendo hoy', () => {
    expect(calcAge('1990-01-01')).toBeGreaterThan(30);
    expect(calcAge(null)).toBeNull();
    expect(calcAge('2030-01-01', '2026-01-01')).toBeNull(); // futuro: no hay edad
  });
});

describe('el sexo se lee igual en toda la app', () => {
  const equivalentes: [string, 'M' | 'F'][] = [
    ['Masculino', 'M'], ['masculino', 'M'], ['MASCULINO', 'M'],
    ['Hombre', 'M'], ['Varón', 'M'], ['Varon', 'M'], ['male', 'M'], ['Niño', 'M'],
    ['Femenino', 'F'], ['femenino', 'F'], ['Mujer', 'F'], ['female', 'F'], ['Niña', 'F'], ['F', 'F'],
  ];

  it('adulto y pediatría nunca discrepan', () => {
    for (const [texto, esperado] of equivalentes) {
      expect(normalizeSex(texto), texto).toBe(esperado);
      expect(parseSex(texto), texto).toBe(esperado === 'M' ? 'boys' : 'girls');
    }
  });

  it('"Hombre" y "Varón" ya no se pierden', () => {
    // Antes devolvían null en el módulo de adulto: al paciente se le quedaban
    // sin calcular el peso ideal, el ICC, el AMB y el % de grasa.
    expect(normalizeSex('Hombre')).toBe('M');
    expect(normalizeSex('Varón')).toBe('M');
  });

  it('la inicial sola: M masculino, F femenino', () => {
    expect(normalizeSex('M')).toBe('M');
    expect(normalizeSex('F')).toBe('F');
    expect(parseSex('M')).toBe('boys');
    expect(parseSex('F')).toBe('girls');
  });

  it('"Mujer" es femenino aunque empiece por eme', () => {
    // La palabra manda sobre la inicial; solo la letra sola cae en la regla de
    // la inicial. Si no, la mitad de las pacientes serían varones.
    expect(normalizeSex('Mujer')).toBe('F');
    expect(parseSex('mujer')).toBe('girls');
  });

  it('lo desconocido es null, no un sexo por defecto', () => {
    for (const raro of ['', '  ', 'otro', 'x', null, undefined]) {
      expect(normalizeSex(raro as string)).toBeNull();
    }
  });
});
