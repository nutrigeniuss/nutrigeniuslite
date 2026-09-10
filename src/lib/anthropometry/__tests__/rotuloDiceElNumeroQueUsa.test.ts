import { describe, expect, it } from 'vitest';

import { buildHtml } from '@/lib/anthropometry/printReport';
import { healthyWeightRange, idealWeightByBmi } from '../indicators/idealWeight';

// ─────────────────────────────────────────────────────────────────────────────
// EL RÓTULO TIENE QUE DECIR EL MISMO NÚMERO QUE SE USÓ PARA CALCULAR.
//
// El informe imprime "IMC objetivo (21.7) — 55.55 kg". Ese 21.7 del rótulo y el
// 21.7 con el que se calcularon los 55.55 kg salían de DOS SITIOS DISTINTOS: la
// fórmula lo tenía en `idealWeight.ts` y el informe se lo escribía a mano en el
// texto. La pantalla llevaba una tercera copia.
//
// Mientras los tres números coincidan no se nota nada. El día que alguien
// cambie el criterio clínico en la fórmula —que es donde toca cambiarlo— el
// papel seguiría diciendo el número viejo AL LADO del kilo nuevo. Es el mismo
// patrón que borró el ICT en silencio: un texto de pantalla haciendo de
// constante.
//
// Estas pruebas no comprueban que ponga "21.7". Comprueban que el número del
// rótulo y el número del cálculo sean EL MISMO, salga de donde salga.
// ─────────────────────────────────────────────────────────────────────────────

const paciente = (extra: Record<string, unknown> = {}) => ({
  name: 'Ana', last_name: 'Quispe', gender: 'Femenino', birth_date: '1990-03-15', ...extra,
});
const medicion = { date: '2026-03-15', weight: 62, height: 160 };

/** El número que el informe escribe en "IMC objetivo (X)". */
const imcObjetivoDelRotulo = (html: string) => {
  const m = html.match(/IMC objetivo \(([\d.]+)\)/);
  return m ? Number(m[1]) : null;
};

/** Los dos números de "Rango saludable (IMC X–Y)". */
const rangoDelRotulo = (html: string) => {
  const m = html.match(/Rango saludable \(IMC ([\d.]+)[–-]([\d.]+)\)/);
  return m ? { min: Number(m[1]), max: Number(m[2]) } : null;
};

/** Los kilos que el informe imprime para la fila del IMC objetivo. */
const kilosDeLaFila = (html: string) => {
  const m = html.match(/IMC objetivo \([\d.]+\)<\/td>\s*<td[^>]*><b>([\d.]+)<\/b>/);
  return m ? Number(m[1]) : null;
};

const pesoPorImc = (imc: number, tallaCm: number) => +(imc * (tallaCm / 100) ** 2).toFixed(2);

describe('el rótulo del IMC objetivo dice el número con el que se calculó', () => {
  it.each([
    ['adulto', '1990-03-15'],
    ['adulto mayor', '1950-03-15'],
  ])('en %s, el rótulo y los kilos salen del mismo IMC', (_caso, birth_date) => {
    const html = buildHtml({ patient: paciente({ birth_date }), measurement: medicion });

    const rotulo = imcObjetivoDelRotulo(html);
    const kilos = kilosDeLaFila(html);

    expect(rotulo, 'el informe no imprimió el rótulo del IMC objetivo').not.toBeNull();
    expect(kilos, 'el informe no imprimió los kilos del IMC objetivo').not.toBeNull();
    // Si el rótulo dice 21.7, los kilos tienen que ser 21.7 × talla².
    expect(kilos).toBe(pesoPorImc(rotulo as number, medicion.height));
  });

  // Y contra la fórmula, que es la fuente: lo que el informe rotula tiene que
  // ser lo mismo que `idealWeightByBmi` usó de verdad.
  it.each([
    ['adulto', '1990-03-15', 36],
    ['adulto mayor', '1950-03-15', 76],
  ])('en %s coincide con lo que devuelve la fórmula', (_caso, birth_date, ageYears) => {
    const html = buildHtml({ patient: paciente({ birth_date }), measurement: medicion });

    expect(kilosDeLaFila(html)).toBe(idealWeightByBmi(medicion.height, ageYears).value);
  });
});

describe('el rótulo del rango saludable dice sus propios números', () => {
  it.each([
    ['adulto', '1990-03-15', 36],
    ['adulto mayor', '1950-03-15', 76],
  ])('en %s, los IMC del rótulo son los del cálculo', (_caso, birth_date, ageYears) => {
    const html = buildHtml({ patient: paciente({ birth_date }), measurement: medicion });
    const rotulo = rangoDelRotulo(html);
    const rango = healthyWeightRange(medicion.height, ageYears);

    expect(rotulo, 'el informe no imprimió el rótulo del rango saludable').not.toBeNull();
    expect(rango.min.value).toBe(pesoPorImc((rotulo as { min: number }).min, medicion.height));
    expect(rango.max.value).toBe(pesoPorImc((rotulo as { max: number }).max, medicion.height));
  });

  // El corte de los 60 años es clínico y vive en la fórmula. Si el informe
  // llevara su propio corte, un paciente de 60 vería el rótulo de adulto joven
  // encima de los kilos de adulto mayor.
  it('a los 60 años cumplidos ya se usan los cortes de adulto mayor', () => {
    const joven = buildHtml({ patient: paciente({ birth_date: '1967-03-16' }), measurement: medicion });
    const mayor = buildHtml({ patient: paciente({ birth_date: '1966-03-15' }), measurement: medicion });

    expect(imcObjetivoDelRotulo(joven)).not.toBe(imcObjetivoDelRotulo(mayor));
    expect(kilosDeLaFila(joven)).toBe(idealWeightByBmi(medicion.height, 59).value);
    expect(kilosDeLaFila(mayor)).toBe(idealWeightByBmi(medicion.height, 60).value);
  });
});
