import { describe, it, expect } from 'vitest';
import { calcularModelo5 } from '../composicionModelo5';

// ─────────────────────────────────────────────────────────────────────────────
// EL MODELO DE 5 COMPONENTES DE KERR, MASA POR MASA.
//
// Estas pruebas nacieron de un agujero. Al sacar el modelo de la tarjeta se
// rompió A PROPÓSITO la fórmula del músculo —dejó de restar el pliegue que
// cubre el brazo, que es la corrección entera— y las 16 pruebas de la tarjeta
// siguieron TODAS en verde.
//
// El motivo es el propio modelo: las masas se reescalan al peso de la báscula,
// así que la suma da 70 kg y los porcentajes dan 100 % aunque el reparto
// interno esté equivocado. La tarjeta comprobaba justo eso: la suma. Un
// paciente podía salir con 8 kg de músculo de más y 8 de grasa de menos sin que
// nada chirriara.
//
// Por eso aquí se fija CADA masa por separado, con los números del paciente de
// referencia. Si cambia cualquier coeficiente de cualquiera de las cinco
// fórmulas, falla y se ve cuál.
// ─────────────────────────────────────────────────────────────────────────────

/** Varón de 70 kg y 175 cm con TODAS las medidas que pide Kerr. */
const medidasCompletas = {
  weight: 70,
  height: 175,
  height_sitting: 92,
  skinfolds: {
    biceps: 5, triceps: 10, subscapular: 12, iliac_crest: 14,
    supraspinal: 8, abdominal: 15, front_thigh: 12, medial_calf: 8,
  },
  diameters: {
    wrist_bistyloid: 5.5, femur: 9.5, humerus: 7, biacromial: 40,
    biiliocrestal: 28, thorax_anteroposterior: 20, thorax_transverse: 28,
  },
  perimeters: {
    arm_relaxed: 30, arm_flexed: 32, forearm: 26, waist: 80, hip: 95,
    thigh: 55, thigh_mid: 55, calf: 36, cephalic: 56, mesosternal: 88,
  },
};

/** Lee una masa por su nombre, que es como aparece en la tarjeta. */
const masa = (resultado, nombre) => resultado.componentes.find((c) => c.name === nombre);

/** Las cinco masas predichas, en un objeto plano fácil de comparar. */
const predichas = (resultado) => Object.fromEntries(
  resultado.componentes.map((c) => [c.name, c.kgPred]),
);

const varon = (extra = {}) => calcularModelo5({ ...medidasCompletas, ...extra }, false);
const mujer = (extra = {}) => calcularModelo5({ ...medidasCompletas, ...extra }, true);

describe('modelo de 5 — las cinco masas del paciente de referencia', () => {
  // EL CANDADO PRINCIPAL. Cada número sale de una fórmula distinta con sus
  // propias constantes Phantom; fijarlos uno a uno es lo que hace que un
  // coeficiente cambiado se note, en vez de esconderse en el reescalado.
  it('cada fórmula da su masa, y no la del vecino', () => {
    expect(predichas(varon())).toEqual({
      'Masa Piel': 3.82,
      'Masa Adiposa': 18.11,
      'Masa Muscular': 30.27,
      'Masa Ósea': 8.3,
      'Masa Residual': 8.62,
    });
  });

  // El peso predictivo se suma ANTES de redondear cada masa, así que la suma de
  // la columna que se ve en pantalla puede quedar un céntimo de kilo por debajo
  // (69.12 frente a 69.13). Es correcto —redondear cinco veces y sumar arrastra
  // más error que sumar y redondear una— y queda escrito para que nadie lo
  // "arregle" haciendo que cuadre a la vista.
  it('el peso predictivo es la suma de las cinco', () => {
    const r = varon();
    const suma = r.componentes.reduce((s, c) => s + c.kgPred, 0);

    expect(r.pesoPredictivo).toBe(69.13);
    expect(suma).toBeCloseTo(69.13, 1);
  });

  // El paciente pesa 70 y las fórmulas predicen 69.13: 1.2 % por debajo.
  it('dice cuánto se desvía de la báscula', () => {
    expect(varon().deltaPct).toBe(-1.2);
  });

  // LA RECONCILIACIÓN: el factor escala las cinco para que sumen el peso REAL.
  // Es la columna que lee el nutricionista.
  it('el factor de ajuste lleva las masas al peso real', () => {
    const r = varon();

    expect(r.factorAjuste).toBe(1.0126);
    const sumaAjustada = r.componentes.reduce((s, c) => s + c.kgAdj, 0);
    expect(sumaAjustada).toBeCloseTo(70, 1);
  });
});

describe('modelo de 5 — el sexo solo mueve la piel', () => {
  // En Kerr el sexo entra en UN solo sitio: el grosor de piel y el coeficiente
  // de superficie corporal. Las otras cuatro masas salen de perímetros y
  // diámetros medidos, que no se corrigen por sexo.
  //
  // Importa que esté escrito: si algún día el sexo se colara en otra fórmula,
  // aquí se vería. Y al revés — si dejara de llegar, la piel sería la única
  // pista, y es la masa más pequeña de las cinco.
  it('la piel de la mujer pesa más; las otras cuatro no se mueven', () => {
    const h = predichas(varon());
    const m = predichas(mujer());

    expect(m['Masa Piel']).toBe(3.9);
    expect(h['Masa Piel']).toBe(3.82);

    for (const nombre of ['Masa Adiposa', 'Masa Muscular', 'Masa Ósea', 'Masa Residual']) {
      expect(m[nombre], `${nombre} cambió con el sexo y no debería`).toBe(h[nombre]);
    }
  });
});

describe('modelo de 5 — las correcciones que definen el modelo', () => {
  // ESTA es la prueba que el sabotaje habría roto. Los perímetros se miden por
  // fuera, así que incluyen la grasa que los cubre: Kerr resta π·pliegue/10
  // para quedarse con el músculo. Si esa resta desaparece o cambia de signo, un
  // paciente con más grasa en el brazo sale con MÁS músculo, que es al revés.
  it('más pliegue en el brazo = MENOS músculo, no más', () => {
    const flaco = varon({ skinfolds: { ...medidasCompletas.skinfolds, triceps: 10 } });
    const graso = varon({ skinfolds: { ...medidasCompletas.skinfolds, triceps: 20 } });

    expect(masa(graso, 'Masa Muscular').kgPred)
      .toBeLessThan(masa(flaco, 'Masa Muscular').kgPred);
  });

  // Lo mismo con la cintura: la residual descuenta el pliegue abdominal.
  it('más pliegue abdominal = MENOS residual', () => {
    const mas = varon({ skinfolds: { ...medidasCompletas.skinfolds, abdominal: 30 } });

    expect(masa(mas, 'Masa Residual').kgPred)
      .toBeLessThan(masa(varon(), 'Masa Residual').kgPred);
  });

  // La residual es la ÚNICA que escala con la talla SENTADO (89.92 cm en el
  // Phantom). Confundirla con la talla de pie es un error fácil de cometer y
  // difícil de ver: los números siguen saliendo, solo que mal.
  it('la talla sentado mueve la residual y NADA más', () => {
    const otra = predichas(varon({ height_sitting: 85 }));
    const base = predichas(varon());

    expect(otra['Masa Residual']).not.toBe(base['Masa Residual']);
    for (const nombre of ['Masa Piel', 'Masa Adiposa', 'Masa Muscular', 'Masa Ósea']) {
      expect(otra[nombre], `${nombre} depende de la talla sentado y no debería`).toBe(base[nombre]);
    }
  });
});

describe('modelo de 5 — sin las medidas, no inventa', () => {
  it('sin los seis pliegues no hay masa adiposa, y dice cuáles faltan', () => {
    const r = varon({ skinfolds: {} });
    const adiposa = masa(r, 'Masa Adiposa');

    expect(adiposa.kgPred).toBeNull();
    expect(adiposa.missing.map((f) => f.label)).toEqual([
      'Tríceps', 'Subescapular', 'Supraespinal', 'Abdominal', 'Muslo frontal', 'Pantorrilla media',
    ]);
  });

  // Es todo o nada: sin las cinco masas no hay peso predictivo que reconciliar,
  // y sin peso predictivo no hay factor. Media reconciliación sería peor que
  // ninguna, porque la columna ajustada parecería válida.
  it('si falta UNA sola masa no hay peso predictivo ni factor', () => {
    const r = varon({ perimeters: { ...medidasCompletas.perimeters, cephalic: null } });

    expect(masa(r, 'Masa Ósea').kgPred).toBeNull();
    expect(r.pesoPredictivo).toBeNull();
    expect(r.factorAjuste).toBeNull();
    // Y ninguna fila se ajusta, ni las que sí se pudieron calcular.
    expect(r.componentes.every((c) => c.kgAdj === null)).toBe(true);
  });

  // La ósea se calcula en dos trozos —cabeza y cuerpo— porque la cabeza no
  // escala con la estatura. Hacen falta LOS DOS.
  it('la masa ósea necesita cabeza Y cuerpo', () => {
    const sinCabeza = varon({ perimeters: { ...medidasCompletas.perimeters, cephalic: null } });
    const sinCuerpo = varon({ diameters: { ...medidasCompletas.diameters, humerus: null } });

    expect(masa(sinCabeza, 'Masa Ósea').kgPred).toBeNull();
    expect(masa(sinCuerpo, 'Masa Ósea').kgPred).toBeNull();
  });

  it('sin nada medido no revienta: cinco filas, todas vacías', () => {
    const r = calcularModelo5({}, false);

    expect(r.componentes).toHaveLength(5);
    expect(r.componentes.every((c) => c.kgPred === null && c.kgAdj === null)).toBe(true);
    expect(r.pesoPredictivo).toBeNull();
  });

  // Las píldoras de "te falta esto" son clicables y llevan a la pestaña del
  // formulario. Sin el grupo correcto llevan a ninguna parte, que fue justo el
  // fallo del bistiloideo en el modelo de 4.
  it('cada medida que falta apunta a su pestaña', () => {
    const r = calcularModelo5({}, false);
    const grupos = {};
    for (const c of r.componentes) {
      for (const f of c.missing) grupos[f.label] = f.group;
    }

    expect(grupos['Talla sentado']).toBe('peso');
    expect(grupos['Tórax AP']).toBe('dia');
    expect(grupos.Cintura).toBe('per');
    expect(grupos['Pliegue abdominal']).toBe('pli');
    expect(grupos.Cefálico).toBe('per');
  });
});

describe('modelo de 5 — avisa de lo que huele a mal medido', () => {
  // No corrige nada: avisa. Un pliegue de 1 mm da un número que parece
  // razonable al llegar a la tabla.
  it('un pliegue de menos de 2 mm es sospechoso', () => {
    const r = varon({ skinfolds: { ...medidasCompletas.skinfolds, triceps: 1 } });

    expect(r.avisos.join(' ')).toMatch(/Tríceps.*1 mm/);
  });

  it('un tórax de menos de 70 cm también', () => {
    const r = varon({ perimeters: { ...medidasCompletas.perimeters, mesosternal: 65 } });

    expect(r.avisos.join(' ')).toMatch(/mesoesternal/i);
  });

  // Cuando el peso predicho se aleja más de un 10 % del real, el aviso dice qué
  // revisar —talla sentado y diámetros del tórax— en vez del símbolo |Δ%|.
  it('con más de 10 % de desvío dice qué medidas repetir', () => {
    const r = varon({ weight: 100 });

    expect(r.deltaPct).toBeLessThan(-10);
    const aviso = r.avisos.join(' ');
    expect(aviso).toMatch(/menor al peso real/);
    expect(aviso).toMatch(/talla sentado/i);
  });

  it('con las medidas en orden no avisa de nada', () => {
    expect(varon().avisos).toEqual([]);
  });
});
