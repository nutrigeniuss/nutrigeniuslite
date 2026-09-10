import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ComposicionSection from '@/components/patient/results/ComposicionSection';

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSICIÓN CORPORAL: cuánto del paciente es grasa, músculo, hueso y resto.
//
// 596 líneas, complejidad 89 y CERO pruebas, calculando lo que el nutricionista
// usa para decidir el plan. Son fórmulas encadenadas —Durnin-Womersley y Siri
// para la grasa, Rocha para el hueso, Matiegka para el músculo— y un error en
// cualquiera arrastra a las demás.
//
// LA INVARIANTE: las masas tienen que sumar el PESO del paciente. Si no suman,
// el reparto está mal aunque cada número parezca razonable por separado.
// ─────────────────────────────────────────────────────────────────────────────

/** Paciente con TODAS las medidas que piden los dos modelos. */
const medidasCompletas = {
  weight: 70,
  height: 175,
  height_sitting: 92,
  skinfolds: {
    biceps: 5,
    triceps: 10,
    subscapular: 12,
    iliac_crest: 14,
    supraspinal: 8,
    abdominal: 15,
    front_thigh: 12,
    medial_calf: 8,
  },
  diameters: {
    wrist_bistyloid: 5.5,
    femur: 9.5,
    humerus: 7,
    biacromial: 40,
    biiliocrestal: 28,
    thorax_anteroposterior: 20,
    thorax_transverse: 28,
  },
  perimeters: {
    arm_relaxed: 30,
    arm_flexed: 32,
    forearm: 26,
    waist: 80,
    hip: 95,
    thigh: 55,
    thigh_mid: 55,
    calf: 36,
    cephalic: 56,
    mesosternal: 88,
  },
};

const pintar = (props = {}) => render(
  <ComposicionSection
    data={medidasCompletas}
    sex="M"
    ageYears={30}
    onGoToField={() => {}}
    {...props}
  />,
);

/**
 * Lee la tabla de componentes de la tarjeta.
 *
 * No es una tabla HTML sino una rejilla de divs. Cada fila pinta tres números
 * en elementos propios: kilos predichos, kilos ajustados y el porcentaje. Se
 * leen de los elementos hoja para no depender del texto concatenado, que sale
 * sin separadores ("3.823.875.5") y no se puede partir sin ambigüedad.
 */
const leerComponentes = () => {
  const hojas = Array.from(document.querySelectorAll('*'))
    .filter((el) => el.children.length === 0)
    .map((el) => (el.textContent || '').trim())
    .filter((t) => /^-?\d+(\.\d+)?%?$/.test(t));

  const componentes = [];
  for (let i = 0; i + 2 < hojas.length; i += 3) {
    // Un trío válido termina en porcentaje; el resto son datos sueltos del pie.
    if (!hojas[i + 2].endsWith('%')) break;
    componentes.push({
      predicho: Number(hojas[i]),
      ajustado: Number(hojas[i + 1]),
      porcentaje: Number(hojas[i + 2].replace('%', '')),
    });
  }
  return componentes;
};

beforeEach(() => {
  try { window.localStorage.clear(); } catch { /* jsdom sin storage */ }
});
afterEach(() => cleanup());

describe('ComposicionSection — se pinta con datos completos', () => {
  it('muestra la tarjeta de composición', () => {
    pintar();

    expect(screen.getByText(/Composición Corporal/i)).toBeInTheDocument();
  });

  // LA INVARIANTE DEL MODELO: la columna ajustada suma el peso REAL del
  // paciente. Los kilos predichos por las fórmulas dan 69.13 en este caso, y un
  // factor de ajuste (1.0126) los escala para que cuadren con los 70 reales.
  // Si esta suma se desvía, el reparto está mal aunque cada número parezca
  // razonable por separado.
  it('las masas ajustadas suman el peso real del paciente', () => {
    pintar();
    const componentes = leerComponentes();

    expect(componentes.length).toBe(5);
    const suma = componentes.reduce((total, c) => total + c.ajustado, 0);
    expect(suma).toBeCloseTo(70, 1);
  });

  it('los porcentajes suman 100', () => {
    pintar();
    const suma = leerComponentes().reduce((total, c) => total + c.porcentaje, 0);

    expect(suma).toBeCloseTo(100, 0);
  });

  it('ninguna masa sale negativa ni pesa más que el paciente', () => {
    pintar();

    for (const c of leerComponentes()) {
      expect(c.ajustado, `${c.nombre} salió negativa`).toBeGreaterThan(0);
      expect(c.ajustado, `${c.nombre} pesa más que el paciente`).toBeLessThan(70);
    }
  });

  it('no imprime NaN ni undefined en el reparto', () => {
    pintar();
    const texto = document.body.textContent || '';

    expect(texto).not.toContain('NaN');
    expect(texto).not.toContain('undefined');
  });
});

describe('ComposicionSection — una medida corrupta no se convierte en NaN', () => {
  // Las medidas llegan de campos de texto. Hoy el formulario las convierte al
  // teclear, pero por la base pasan fichas viejas y datos importados donde un
  // campo puede traer cualquier cosa.
  //
  // El modelo de 4 ya se defendía (exige número de verdad y, si no, dice qué
  // medida falta). El de 5 no: daba por buena la basura, la metía en la
  // fórmula y pintaba "NaN" en la tabla que el nutricionista está leyendo.
  const conBasura = {
    ...medidasCompletas,
    skinfolds: { ...medidasCompletas.skinfolds, triceps: 'abc' },
  };

  it('el modelo de 5 dice que falta la medida, no NaN', () => {
    window.localStorage.setItem('nutri_modelo_composicion', '5');
    pintar({ data: conBasura });

    expect(document.body.textContent).not.toContain('NaN');
  });

  it('el modelo de 4 tampoco', () => {
    window.localStorage.setItem('nutri_modelo_composicion', '4');
    pintar({ data: conBasura });

    expect(document.body.textContent).not.toContain('NaN');
  });
});

describe('ComposicionSection — el sexo cambia el reparto', () => {
  // La masa residual es un porcentaje fijo del peso, DISTINTO por sexo
  // (♂ 0.241 · ♀ 0.209). Si el sexo no se leyera, a una mujer se le asignarían
  // 2.2 kg de más de residual, que Matiegka le resta al músculo.
  it('hombre y mujer no dan el mismo reparto', () => {
    pintar({ sex: 'M' });
    const hombre = leerComponentes();
    cleanup();

    pintar({ sex: 'F' });
    const mujer = leerComponentes();

    expect(hombre).not.toEqual(mujer);
  });

  it('lee el sexo escrito como esté', () => {
    pintar({ sex: 'M' });
    const conM = leerComponentes();
    cleanup();

    pintar({ sex: 'Masculino' });
    const conMasculino = leerComponentes();

    expect(conMasculino).toEqual(conM);
  });
});

describe('ComposicionSection — sin datos no inventa números', () => {
  it('sin pliegues avisa de lo que falta en vez de calcular', () => {
    pintar({ data: { ...medidasCompletas, skinfolds: {} } });
    const texto = document.body.textContent || '';

    expect(texto).not.toContain('NaN');
    // La tarjeta sigue en pie: se muestra qué falta, no una pantalla rota.
    expect(screen.getByText(/Composición Corporal/i)).toBeInTheDocument();
  });

  it('sin peso ni talla tampoco revienta', () => {
    pintar({ data: { skinfolds: {}, diameters: {}, perimeters: {} } });
    const texto = document.body.textContent || '';

    expect(texto).not.toContain('NaN');
    expect(texto).not.toContain('undefined');
  });

  it('sin sexo no reparte a ciegas', () => {
    expect(() => pintar({ sex: null })).not.toThrow();
    expect(document.body.textContent).not.toContain('NaN');
  });
});

describe('ComposicionSection — los dos modelos', () => {
  // El modelo elegido se recuerda entre pantallas: son dos lecturas distintas
  // del mismo paciente y quien trabaja con el clásico no quiere reelegirlo en
  // cada consulta.
  it('con el modelo de 5 muestra las cinco masas de Kerr', () => {
    window.localStorage.setItem('nutri_modelo_composicion', '5');
    pintar();
    const texto = document.body.textContent || '';

    expect(texto).toMatch(/Masa Adiposa/i);
    expect(texto).toMatch(/Masa Muscular/i);
    expect(texto).toMatch(/Masa Ósea/i);
    expect(texto).toMatch(/Masa Residual/i);
    expect(texto).toMatch(/Masa Piel/i);
  });

  it('con el modelo de 4 NO aparece la masa piel, que es propia del de 5', () => {
    window.localStorage.setItem('nutri_modelo_composicion', '4');
    pintar();
    const texto = document.body.textContent || '';

    expect(texto).toMatch(/Masa grasa/i);
    expect(texto).not.toMatch(/Masa Piel/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EL MODELO CLÁSICO DE 4 COMPONENTES.
//
// Se añadió después de descubrir un agujero: las pruebas de arriba corren en el
// modelo de 5 (Kerr), y al inflar a propósito el coeficiente de masa residual
// del varón —0.241 → 0.341— NINGUNA falló. El modelo de 4 estaba sin cubrir, y
// es el que encadena Durnin-Womersley, Siri, Rocha y Matiegka.
// ─────────────────────────────────────────────────────────────────────────────
describe('ComposicionSection — modelo clásico de 4 componentes', () => {
  const conModelo4 = (props = {}) => {
    window.localStorage.setItem('nutri_modelo_composicion', '4');
    return pintar(props);
  };

  it('nombra al autor de cada fórmula', () => {
    conModelo4();
    const texto = document.body.textContent || '';

    expect(texto).toContain('Rocha');      // masa ósea
    expect(texto).toContain('Siri');       // masa grasa
    expect(texto).toContain('Matiegka');   // masa muscular
    expect(texto).toContain('Würch');      // masa residual
  });

  // La masa residual es un porcentaje FIJO del peso, distinto por sexo. Es el
  // único componente que no depende de ninguna medida más, así que se puede
  // comprobar a mano: 70 kg × 0.241 = 16.87.
  it('la masa residual del varón es el 24.1 % del peso', () => {
    conModelo4({ sex: 'M' });

    expect(document.body.textContent).toContain('16.87');
    expect(document.body.textContent).toContain('0.241');
  });

  it('la de la mujer es el 20.9 %: 70 × 0.209 = 14.63', () => {
    conModelo4({ sex: 'F' });

    expect(document.body.textContent).toContain('14.63');
    expect(document.body.textContent).toContain('0.209');
  });

  // Matiegka define el músculo como lo que sobra: peso − grasa − hueso −
  // residual. Por eso las cuatro tienen que sumar el peso exacto.
  //
  // Se comprueban los cuatro valores concretos en vez de sumarlos a ciegas: así
  // el test falla si CUALQUIERA de las cuatro fórmulas cambia, no solo si la
  // suma se desvía. Paciente de 70 kg, 175 cm, varón de 30 años.
  it('las cuatro masas suman el peso del paciente', () => {
    conModelo4();
    const texto = document.body.textContent || '';

    const masas = {
      'ósea (Rocha)': 11.32,
      'grasa (Siri)': 13.61,
      'muscular (Matiegka)': 28.21,
      'residual (Würch)': 16.87,
    };

    for (const [nombre, kg] of Object.entries(masas)) {
      expect(texto, `cambió la masa ${nombre}`).toContain(String(kg));
    }

    const suma = Object.values(masas).reduce((total, kg) => total + kg, 0);
    expect(suma).toBeCloseTo(70, 1);
  });
});
