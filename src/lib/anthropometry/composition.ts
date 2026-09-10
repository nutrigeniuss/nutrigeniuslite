// Cálculos de composición corporal y somatotipo. ESTA ES LA ÚNICA
// implementación: la usan la tarjeta de la pantalla, el informe impreso y la
// evolución.
//
// Durante un tiempo hubo dos —una aquí y otra dentro del componente— y este
// mismo comentario decía "por ahora ambas implementaciones conviven". Daban
// los mismos números, se comprobó, pero nada las mantenía sincronizadas: quien
// corrigiera un coeficiente en una, la otra se quedaba con el viejo, y el
// paciente se llevaría impreso un número distinto del que el nutricionista
// tenía delante. La pantalla ahora adapta lo que sale de aquí
// (components/patient/results/composicionModelo4.js y ...Modelo5.js).
//
// DÓNDE ESTÁN LAS PRUEBAS QUE FIJAN ESTOS NÚMEROS: las masas de Kerr, una a
// una y con los cortes del modelo, están en
// components/patient/results/__tests__/composicionModelo5.test.js — corren
// contra este archivo a través del adaptador. `__tests__/composition.test.ts`
// no las cubría.
//
// Modelos implementados:
//   • 4 componentes clásico — Durnin-Womersley + Siri (MG), Rocha (MO),
//     Würch (MR), Matiegka (MM = peso − MG − MO − MR).
//   • 5 componentes Kerr 1988 — Phantom; devuelve masas predictivas + ajustadas
//     por el factor proporcional `peso_real / peso_predictivo`.
//   • Somatotipo Heath-Carter — endomorfia, mesomorfia, ectomorfia + ejes
//     X/Y de la somatocarta + clasificación textual.

import { bodyFatDurninSiri, bodyFatFaulkner, bodyFatRFM, bodyFatYuhasz, normalizeSex } from './indicators';
import type { IndicatorResult, Sex } from './types';

type Num = number | null | undefined;

const v = (val: unknown): boolean => val !== null && val !== undefined && val !== '';
const num = (x: Num): number | null => (v(x) && Number.isFinite(Number(x)) ? Number(x) : null);
const r2 = (n: number | null): number | null => (n === null ? null : +n.toFixed(2));

// ── Constantes Phantom (Kerr-Ross 1991) ─────────────────────────────────────
// Apéndice B del artículo Ross-Kerr 1991. **NO MODIFICAR sin verificar contra
// el artículo original** (regla RN-H.16 del manual): un cambio aquí altera la
// composición de 5 componentes de TODO el histórico de pacientes, no solo la
// de las consultas nuevas. Y ahora alcanza a la pantalla, al informe impreso
// y a la evolución a la vez, que es justo el punto de tener una sola copia.
const KERR = {
  skin: {
    density: 1.05,
    Tsk:  { M: 2.07, F: 1.96 },
    Csa:  { adultM: 68.308, adultF: 73.704 },
  },
  adipose:  { obsP: 116.41, obsS: 34.79, massP: 25.6, massS: 5.85 },
  muscle:   { obsP: 207.21, obsS: 13.74, massP: 24.5, massS: 5.4  },
  bone:     { obsP: 98.88,  obsS: 5.33,  massP: 6.70, massS: 1.34 },
  bonehead: { obsP: 56.0,   obsS: 1.44,  massP: 1.20, massS: 0.18 },
  residual: { obsP: 109.35, obsS: 7.08,  massP: 6.10, massS: 1.24 },
  Hp: 170.18,
  Hsp: 89.92,
};

const phantomZ = (observed: number, P: number, S: number, scale: number) =>
  (observed * scale - P) / S;

const phantomMass = (z: number, P: number, S: number, scale: number) =>
  (z * S + P) / Math.pow(scale, 3);

// ── Tipos públicos ──────────────────────────────────────────────────────────

export interface CompositionInput {
  weight?: Num;
  height?: Num;
  height_sitting?: Num;
  sex?: string | null;
  ageYears?: Num;
  skinfolds?: Record<string, Num>;
  diameters?: Record<string, Num>;
  perimeters?: Record<string, Num>;
  /**
   * Fórmula con la que estimar la masa grasa del modelo de 4 componentes.
   * Por defecto Siri, que es como se calculó siempre.
   *
   * Importa que sea configurable porque el informe impreso tiene que decir lo
   * mismo que la pantalla: si el nutricionista trabaja con Yuhasz y el PDF
   * saliera con Siri, estaría entregando al paciente unos números que él no ha
   * visto y que no sabe defender.
   */
  formulaGrasa?: FormulaGrasaComposicion;
}

export type FormulaGrasaComposicion = 'siri' | 'yuhasz' | 'faulkner' | 'rfm';

/** Nombre corto del autor de cada fórmula de grasa, para citarlo en pantalla. */
export const AUTOR_GRASA = { siri: 'Siri', yuhasz: 'Yuhasz', faulkner: 'Faulkner', rfm: 'RFM' } as const;

/** Los seis pliegues de la masa adiposa de Kerr, en el orden de la suma. */
export const PLIEGUES_ADIPOSA = [
  'triceps', 'subscapular', 'supraspinal', 'abdominal', 'front_thigh', 'medial_calf',
] as const;

/** Nombre visible de cada pliegue. Coincide con las claves de LABEL_GROUP. */
export const ETIQUETAS_PLIEGUES: Record<string, string> = {
  triceps: 'Tríceps',
  subscapular: 'Subescapular',
  supraspinal: 'Supraespinal',
  abdominal: 'Abdominal',
  front_thigh: 'Muslo frontal',
  medial_calf: 'Pantorrilla media',
};

export interface ComponentRow {
  name: string;
  /** Kg crudo / predictivo. Null si faltan datos. */
  kg: number | null;
  /** % sobre peso real. Null si no se pudo calcular. */
  pct: number | null;
  /** Medidas que faltan para poder calcularlo. Vacío si salió el número. */
  missing?: string[];
  /** Autor de la fórmula usada, para poder citarlo en el informe. */
  autor?: string;
}

export interface FiveCompRow extends ComponentRow {
  /** Kg ajustado al peso real (Kerr 1988 sec. 6). Null si modelo incompleto. */
  kgAdj: number | null;
}

export interface FourCompResult {
  rows: ComponentRow[];
  total: number;
  /** % de grasa con la fórmula elegida. Null si faltan pliegues. */
  fatPct: number | null;
  /** El resultado completo de la fórmula de grasa (densidad, detalle, missing). */
  detalleGrasa: IndicatorResult<number>;
  /**
   * La resta de Matiegka SIN recortar a 0.
   *
   * Con mediciones inconsistentes (MG+MO+MR > peso) sale negativa, que es
   * físicamente imposible. La fila se recorta a 0, pero saber que dio −3.4 kg
   * dice CUÁNTO hay que revisar; "es inconsistente", no.
   */
  masaMuscularCruda: number | null;
  esFemenino: boolean;
}

export interface FiveCompResult {
  rows: FiveCompRow[];
  pesoPredictivo: number | null;
  factorAjuste: number | null;
  deltaPct: number | null;
}

export interface SomatotypeResult {
  endo: number | null;
  meso: number | null;
  ecto: number | null;
  /** Eje X de la somatocarta (ecto − endo). */
  x: number | null;
  /** Eje Y de la somatocarta (2·meso − endo − ecto). */
  y: number | null;
  /** Triada redondeada a 1 decimal: "2.1 – 4.5 – 3.0". */
  triad: string | null;
  /** Clasificación clínica textual (ej. "Mesomorfo-Endomorfo"). */
  classification: string | null;
}

// ── 4 componentes (Durnin-Womersley + Siri / Rocha / Würch / Matiegka) ──────

// ── El modelo clásico de 4 componentes, masa por masa ───────────────────────
// Cuatro autores encadenados, y el orden importa: la masa muscular es lo que
// SOBRA tras restar las otras tres (Matiegka). Por eso cambiar de fórmula de
// grasa mueve también el músculo; no es un detalle de presentación.

/** Porcentaje del peso que Würch asigna a la masa residual, según sexo. */
export const FRACCION_RESIDUAL = { femenino: 0.209, masculino: 0.241 } as const;

/**
 * 1) MASA GRASA — la fórmula la elige el nutricionista.
 *
 * Por defecto Durnin-Womersley + Siri, que es como se calculó siempre. Las
 * otras tres piden pliegues distintos, y por eso el "qué falta" sale de la
 * propia fórmula y no de una lista escrita aquí.
 */
const componenteGrasa = (
  input: CompositionInput, sex: Sex | null, w: number | null, h: number | null,
  sk: Record<string, Num>, formula: FormulaGrasaComposicion,
) => {
  const detalle =
    formula === 'yuhasz'
      ? bodyFatYuhasz(
          num(sk.triceps), num(sk.subscapular), num(sk.supraspinal), num(sk.abdominal),
          num(sk.front_thigh), num(sk.medial_calf), sex,
        )
      : formula === 'faulkner'
        ? bodyFatFaulkner(num(sk.triceps), num(sk.subscapular), num(sk.supraspinal), num(sk.abdominal))
        : formula === 'rfm'
          ? bodyFatRFM(h, num((input.perimeters || {}).waist), sex)
          : bodyFatDurninSiri(
              num(sk.biceps), num(sk.triceps), num(sk.subscapular), num(sk.iliac_crest),
              num(input.ageYears), sex,
            );

  const porcentaje = detalle.value;
  return {
    detalle,
    porcentaje,
    masa: porcentaje !== null && w !== null ? +((porcentaje / 100) * w).toFixed(2) : null,
    faltantes: [...(detalle.missing ?? []), ...(w === null ? ['Peso'] : [])],
  };
};

/**
 * 2) MASA ÓSEA — Rocha: 3.02 · (A² · DM · DF · 400)^0.712, TODO EN METROS.
 *
 * "Bistiloideo de la muñeca" y no "Muñeca" a secas: hay DOS medidas de muñeca.
 * Esta es el DIÁMETRO entre apófisis estiloides, que es lo que pide Rocha; el
 * otro es el PERÍMETRO, que se usa para la complexión. Poniendo "Muñeca" la
 * píldora llevaba al perímetro —otra pestaña y otra medida— y el nutricionista
 * la rellenaba sin que el cálculo avanzara.
 */
const componenteOseaRocha = (h: number | null, dia: Record<string, Num>) => {
  const tallaM = h !== null ? h / 100 : null;
  const munecaM = num(dia.wrist_bistyloid) !== null ? Number(dia.wrist_bistyloid) / 100 : null;
  const femurM = num(dia.femur) !== null ? Number(dia.femur) / 100 : null;

  return {
    masa: tallaM !== null && munecaM !== null && femurM !== null
      ? +(3.02 * Math.pow(tallaM * tallaM * munecaM * femurM * 400, 0.712)).toFixed(2)
      : null,
    faltantes: [
      ...(h === null ? ['Talla'] : []),
      ...(munecaM === null ? ['Bistiloideo de la muñeca'] : []),
      ...(femurM === null ? ['Fémur'] : []),
    ],
  };
};

/**
 * 3) MASA RESIDUAL — Würch: un porcentaje FIJO del peso, distinto por sexo.
 *
 * Es el único componente que no depende de ninguna otra medida. El rótulo lleva
 * su propia fracción ("Würch (♂ 0.241)") y se arma DESDE la constante: si se
 * escribiera a mano, cambiar el criterio dejaría el texto diciendo el número
 * viejo al lado del kilo nuevo.
 */
const componenteResidualWurch = (w: number | null, isFemale: boolean) => {
  const fraccion = isFemale ? FRACCION_RESIDUAL.femenino : FRACCION_RESIDUAL.masculino;
  return {
    masa: w !== null ? +(w * fraccion).toFixed(2) : null,
    autor: `Würch (${isFemale ? '♀' : '♂'} ${fraccion})`,
    faltantes: w === null ? ['Peso'] : [],
  };
};

export function compute4Components(input: CompositionInput): FourCompResult {
  const w = num(input.weight);
  const h = num(input.height);
  const sk = input.skinfolds || {};
  const dia = input.diameters || {};
  const sex = normalizeSex(input.sex);
  const isFemale = sex === 'F';
  const formula = input.formulaGrasa || 'siri';

  const grasa = componenteGrasa(input, sex, w, h, sk, formula);
  const osea = componenteOseaRocha(h, dia);
  const residual = componenteResidualWurch(w, isFemale);

  // 4) MASA MUSCULAR — Matiegka: lo que sobra. Con mediciones inconsistentes
  // (MG+MO+MR > peso) la resta da negativo, que es físicamente imposible: se
  // recorta a 0 y quien llama recibe también la resta cruda para poder avisar.
  const muscularCruda = w !== null && grasa.masa !== null && osea.masa !== null && residual.masa !== null
    ? +(w - grasa.masa - osea.masa - residual.masa).toFixed(2)
    : null;
  const masaMuscular = muscularCruda !== null ? Math.max(0, muscularCruda) : null;

  const pct = (mass: number | null): number | null =>
    mass !== null && w !== null && w > 0 ? +((mass / w) * 100).toFixed(1) : null;

  // Sin el "qué falta", el informe impreso solo podía omitir en silencio las
  // filas que no salían, y quien lo leía no sabía si el componente no aplicaba
  // o si es que faltaba una medida por tomar.
  const rows: ComponentRow[] = [
    { name: 'Masa ósea', kg: osea.masa, pct: pct(osea.masa), autor: 'Rocha', missing: osea.faltantes },
    { name: 'Masa grasa', kg: grasa.masa, pct: pct(grasa.masa), autor: AUTOR_GRASA[formula], missing: grasa.faltantes },
    {
      name: 'Masa muscular',
      kg: masaMuscular,
      pct: pct(masaMuscular),
      autor: 'Matiegka',
      // Se calcula por resta, así que le falta lo que les falte a las otras.
      missing: masaMuscular === null
        ? Array.from(new Set([...grasa.faltantes, ...osea.faltantes, ...residual.faltantes]))
        : [],
    },
    { name: 'Masa residual', kg: residual.masa, pct: pct(residual.masa), autor: residual.autor, missing: residual.faltantes },
  ];

  return {
    rows,
    total: rows.reduce((s, r) => s + (r.kg ?? 0), 0),
    fatPct: grasa.porcentaje,
    detalleGrasa: grasa.detalle,
    masaMuscularCruda: muscularCruda,
    esFemenino: isFemale,
  };
}

// ── 5 componentes (Kerr Phantom 1988) ───────────────────────────────────────

// ── El modelo de 5 componentes, masa por masa ───────────────────────────────
// Cada una es una fórmula distinta, con sus propias medidas y sus propias
// unidades, y devuelve DOS cosas: el kilo y qué medida falta para poder
// calcularlo.
//
// Van juntas a propósito. "Qué falta" no es presentación: sale de la MISMA
// condición que decide si la masa se puede calcular. Separarlas es como
// aparecen avisos que piden algo que el cálculo no usa —o peor, cómo una masa
// se queda sin calcular sin decir por qué.
//
// Las etiquetas son las de LABEL_GROUP, para que quien las pinte pueda llevar
// al campo correcto del formulario.

/** El kilo de un componente y lo que falta para poder calcularlo. */
type Componente = { masa: number | null; faltantes: string[] };

/**
 * 1) PIEL — Apéndice B: fórmula directa, NO pasa por el Phantom.
 *
 *   SA(cm²) = Csa · W^0.425 · H(cm)^0.725   (DuBois 1916, Csa por sexo)
 *   Ms(kg)  = SA(cm²)/10000 · Tsk(mm) · 1.05
 *
 * Las unidades cuadran: 1 m² · 1 mm · 1 g/cm³ = 10⁴cm² · 0.1cm · g/cm³ = 1 kg.
 */
const componentePiel = (w: number | null, h: number | null, isFemale: boolean): Componente => {
  const faltantes = [
    ...(w === null ? ['Peso'] : []),
    ...(h === null ? ['Talla'] : []),
  ];
  if (w === null || h === null) return { masa: null, faltantes };

  const Csa = isFemale ? KERR.skin.Csa.adultF : KERR.skin.Csa.adultM;
  // SA en m² — la talla entra en cm tal cual, no convertida a metros.
  const SA = (Csa * Math.pow(w, 0.425) * Math.pow(h, 0.725)) / 10000;
  const Tsk = isFemale ? KERR.skin.Tsk.F : KERR.skin.Tsk.M;
  return { masa: SA * Tsk * KERR.skin.density, faltantes };
};

/**
 * 2) MASA ADIPOSA — la suma de los seis pliegues, contra el Phantom.
 *
 *   SGRASA = TR+SE+SI+AB+MF+MC (mm)
 *   ZGRASA = (SGRASA · 170.18/HT − 116.41) / 34.79
 *   M_ad   = (ZGRASA · 5.85 + 25.6) / (170.18/HT)³
 */
const componenteAdiposa = (
  sk: Record<string, Num>, h: number | null, scaleHt: number | null,
): Componente => {
  const valores = PLIEGUES_ADIPOSA.map((k) => num(sk[k]));
  const faltantes = [
    ...PLIEGUES_ADIPOSA.filter((k) => num(sk[k]) === null).map((k) => ETIQUETAS_PLIEGUES[k]),
    ...(h === null ? ['Talla'] : []),
  ];

  const suma = valores.every((x) => x !== null)
    ? valores.reduce((s, x) => s + (x as number), 0)
    : null;
  if (suma === null || scaleHt === null) return { masa: null, faltantes };

  const z = phantomZ(suma, KERR.adipose.obsP, KERR.adipose.obsS, scaleHt);
  return { masa: phantomMass(z, KERR.adipose.massP, KERR.adipose.massS, scaleHt), faltantes };
};

/**
 * 3) MASA MUSCULAR — cinco perímetros CORREGIDOS restando el pliegue que los
 * cubre; sin esa resta se estaría contando grasa como músculo.
 *
 *   SMU  = CAGR + FAH + CTHG + CCAG + CCHG (cm)
 *     CAGR = brazo relajado − π · TR / 10      CTHG = muslo medio  − π · MF / 10
 *     CCAG = pantorrilla    − π · MC / 10      CCHG = mesoesternal − π · SE / 10
 *     FAH  = antebrazo (el único sin corregir)
 *   ZMU  = (SMU · 170.18/HT − 207.21) / 13.74
 *   M_mu = (ZMU · 5.4 + 24.5) / (170.18/HT)³
 */
const componenteMuscular = (
  sk: Record<string, Num>, peri: Record<string, Num>, h: number | null, scaleHt: number | null,
): Componente => {
  const armR = num(peri.arm_relaxed);
  const fore = num(peri.forearm);
  const thigh = num(peri.thigh_mid);
  const calf = num(peri.calf);
  const meso = num(peri.mesosternal);
  const triSk = num(sk.triceps);
  const thSk = num(sk.front_thigh);
  const caSk = num(sk.medial_calf);
  const subSk = num(sk.subscapular);

  const faltantes = [
    ...(armR === null ? ['Perímetro del brazo'] : []),
    ...(fore === null ? ['Antebrazo'] : []),
    ...(thigh === null ? ['Muslo medio'] : []),
    ...(calf === null ? ['Pantorrilla'] : []),
    ...(meso === null ? ['Mesoesternal'] : []),
    ...(triSk === null ? ['Pliegue tríceps'] : []),
    ...(thSk === null ? ['Pliegue muslo frontal'] : []),
    ...(caSk === null ? ['Pliegue pantorrilla'] : []),
    ...(subSk === null ? ['Pliegue subescapular'] : []),
    ...(h === null ? ['Talla'] : []),
  ];

  const completo = [armR, fore, thigh, calf, meso, triSk, thSk, caSk, subSk].every((x) => x !== null);
  if (!completo || scaleHt === null) return { masa: null, faltantes };

  const cagr = (armR as number) - Math.PI * (triSk as number) / 10;
  const cthg = (thigh as number) - Math.PI * (thSk as number) / 10;
  const ccag = (calf as number) - Math.PI * (caSk as number) / 10;
  const cchg = (meso as number) - Math.PI * (subSk as number) / 10;
  const smu = cagr + (fore as number) + cthg + ccag + cchg;
  const z = phantomZ(smu, KERR.muscle.obsP, KERR.muscle.obsS, scaleHt);
  return { masa: phantomMass(z, KERR.muscle.massP, KERR.muscle.massS, scaleHt), faltantes };
};

/**
 * 4) MASA ÓSEA — en dos trozos, porque la cabeza NO escala con la estatura.
 *
 *   Cabeza:  ZCEF    = (cefálico − 56.0) / 1.44
 *            HCABEZA = ZCEF · 0.18 + 1.20
 *   Cuerpo:  SCUERPO = BIAC + BILL + 2·HUM + 2·FEM
 *            ZCUERPO = (SCUERPO · 170.18/HT − 98.88) / 5.33
 *            HCUERPO = (ZCUERPO · 1.34 + 6.70) / (170.18/HT)³
 *
 * Hacen falta LAS DOS: con una sola no hay masa ósea.
 */
const componenteOsea = (
  dia: Record<string, Num>, peri: Record<string, Num>, h: number | null, scaleHt: number | null,
): Componente => {
  const faltantes = [
    ...(num(dia.biacromial) === null ? ['Biacromial'] : []),
    ...(num(dia.biiliocrestal) === null ? ['Biiliocrestal'] : []),
    ...(num(dia.humerus) === null ? ['Húmero'] : []),
    ...(num(dia.femur) === null ? ['Fémur'] : []),
    ...(num(peri.cephalic) === null ? ['Cefálico'] : []),
    ...(h === null ? ['Talla'] : []),
  ];

  let cabeza: number | null = null;
  if (num(peri.cephalic) !== null) {
    const z = (Number(peri.cephalic) - KERR.bonehead.obsP) / KERR.bonehead.obsS;
    cabeza = z * KERR.bonehead.massS + KERR.bonehead.massP;
  }

  let cuerpo: number | null = null;
  const tieneCuerpo = [dia.biacromial, dia.biiliocrestal, dia.humerus, dia.femur]
    .every((x) => num(x) !== null);
  if (tieneCuerpo && scaleHt !== null) {
    const suma = Number(dia.biacromial) + Number(dia.biiliocrestal)
      + 2 * Number(dia.humerus) + 2 * Number(dia.femur);
    const z = phantomZ(suma, KERR.bone.obsP, KERR.bone.obsS, scaleHt);
    cuerpo = phantomMass(z, KERR.bone.massP, KERR.bone.massS, scaleHt);
  }

  return {
    masa: cabeza !== null && cuerpo !== null ? cabeza + cuerpo : null,
    faltantes,
  };
};

/**
 * 5) MASA RESIDUAL — vísceras y tronco. La ÚNICA que escala con la talla
 * SENTADO (89.92 cm en el Phantom) y no con la talla de pie.
 *
 *   SRES  = APCH + TRCH + (cintura − π · abdominal / 10)
 *   ZRES  = (SRES · 89.92/SITHT − 109.35) / 7.08
 *   M_res = (ZRES · 1.24 + 6.10) / (89.92/SITHT)³
 */
const componenteResidual = (
  sk: Record<string, Num>, dia: Record<string, Num>, peri: Record<string, Num>,
  hSit: number | null, scaleHsit: number | null,
): Componente => {
  const apch = num(dia.thorax_anteroposterior);
  const trch = num(dia.thorax_transverse);
  const waist = num(peri.waist);
  const abdSk = num(sk.abdominal);

  const faltantes = [
    ...(apch === null ? ['Tórax AP'] : []),
    ...(trch === null ? ['Tórax transversal'] : []),
    ...(waist === null ? ['Cintura'] : []),
    ...(abdSk === null ? ['Pliegue abdominal'] : []),
    ...(hSit === null ? ['Talla sentado'] : []),
  ];

  const completo = [apch, trch, waist, abdSk].every((x) => x !== null);
  if (!completo || scaleHsit === null) return { masa: null, faltantes };

  const cwag = (waist as number) - Math.PI * (abdSk as number) / 10;
  const sres = (apch as number) + (trch as number) + cwag;
  const z = phantomZ(sres, KERR.residual.obsP, KERR.residual.obsS, scaleHsit);
  return { masa: phantomMass(z, KERR.residual.massP, KERR.residual.massS, scaleHsit), faltantes };
};

export function compute5Components(input: CompositionInput): FiveCompResult {
  const w = num(input.weight);
  const h = num(input.height);
  const hSit = num(input.height_sitting);
  const sk = input.skinfolds || {};
  const dia = input.diameters || {};
  const peri = input.perimeters || {};
  const isFemale = normalizeSex(input.sex) === 'F';

  // Razones de escala del Phantom: de pie para casi todo, sentado para la
  // residual.
  const scaleHt = h !== null ? KERR.Hp / h : null;
  const scaleHsit = hSit !== null ? KERR.Hsp / hSit : null;

  const piel = componentePiel(w, h, isFemale);
  const adiposa = componenteAdiposa(sk, h, scaleHt);
  const muscular = componenteMuscular(sk, peri, h, scaleHt);
  const osea = componenteOsea(dia, peri, h, scaleHt);
  const residual = componenteResidual(sk, dia, peri, hSit, scaleHsit);

  // ── Peso predictivo + factor de ajuste proporcional ────────────────────────
  // Sec. 6 del paper: M_T = piel + adiposo + músculo + hueso + residual.
  //
  // Es TODO O NADA: sin las cinco masas no hay peso predictivo que reconciliar,
  // y sin él no hay factor. Media reconciliación sería peor que ninguna, porque
  // la columna ajustada parecería válida.
  const masas = [piel.masa, adiposa.masa, muscular.masa, osea.masa, residual.masa];
  const allKerr = masas.every((m) => m !== null);
  const pesoPredictivo = allKerr
    ? +(masas as number[]).reduce((s, m) => s + m, 0).toFixed(2)
    : null;
  const factorAjuste = allKerr && w !== null && (pesoPredictivo as number) > 0
    ? +(w / (pesoPredictivo as number)).toFixed(4)
    : null;
  const deltaPct = pesoPredictivo !== null && w !== null
    ? +(((pesoPredictivo - w) / w) * 100).toFixed(1)
    : null;

  const adj = (m: number | null): number | null =>
    factorAjuste !== null && m !== null ? +(m * factorAjuste).toFixed(2) : null;
  const pct = (mass: number | null): number | null =>
    mass !== null && w !== null && w > 0 ? +((mass / w) * 100).toFixed(1) : null;

  const buildRow = (name: string, componente: Componente): FiveCompRow => ({
    name,
    kg: r2(componente.masa),
    kgAdj: adj(componente.masa),
    pct: pct(adj(componente.masa)),
    missing: componente.faltantes,
  });

  return {
    rows: [
      buildRow('Masa Piel', piel),
      buildRow('Masa Adiposa', adiposa),
      buildRow('Masa Muscular', muscular),
      buildRow('Masa Ósea', osea),
      buildRow('Masa Residual', residual),
    ],
    pesoPredictivo,
    factorAjuste,
    deltaPct,
  };
}

// ── Somatotipo Heath-Carter ─────────────────────────────────────────────────

const TOL = 0.5;
function classifySomatotype(endo: number | null, meso: number | null, ecto: number | null): string | null {
  if (endo == null || meso == null || ecto == null) return null;
  const eq = (a: number, b: number) => Math.abs(a - b) <= TOL;
  const ranked = [
    { key: 'endo', val: endo },
    { key: 'meso', val: meso },
    { key: 'ecto', val: ecto },
  ].sort((a, b) => b.val - a.val);
  const [first, second, third] = ranked;

  if (first.val - third.val <= 1 && first.val >= 2 && first.val <= 4.5) return 'Central';
  if (!eq(first.val, second.val) && eq(second.val, third.val)) {
    if (first.key === 'meso') return 'Mesomorfo balanceado';
    if (first.key === 'endo') return 'Endomorfo balanceado';
    if (first.key === 'ecto') return 'Ectomorfo balanceado';
  }
  if (eq(first.val, second.val) && !eq(second.val, third.val)) {
    const pair = new Set([first.key, second.key]);
    if (pair.has('meso') && pair.has('endo')) return 'Mesomorfo-Endomorfo';
    if (pair.has('meso') && pair.has('ecto')) return 'Mesomorfo-Ectomorfo';
    if (pair.has('endo') && pair.has('ecto')) return 'Endomorfo-Ectomorfo';
  }
  const compoundMap: Record<string, string> = {
    'endo|meso': 'Meso-Endomorfo',
    'endo|ecto': 'Ecto-Endomorfo',
    'meso|endo': 'Endo-Mesomorfo',
    'meso|ecto': 'Ecto-Mesomorfo',
    'ecto|meso': 'Meso-Ectomorfo',
    'ecto|endo': 'Endo-Ectomorfo',
  };
  return compoundMap[`${first.key}|${second.key}`] ?? null;
}

// ── Somatotipo de Heath-Carter, componente por componente ───────────────────
// Tres números que describen la FORMA del cuerpo, no su peso:
//   endomorfia  cuánta adiposidad relativa
//   mesomorfia  cuánta robustez músculo-esquelética
//   ectomorfia  cuánta linealidad (lo estirado que es para su peso)
//
// Ninguna de las tres usa el sexo. Salen de pliegues, diámetros, perímetros,
// peso y talla, y por eso el mismo cálculo vale para cualquier paciente.

/**
 * ENDOMORFIA — la adiposidad relativa, ajustada por estatura.
 *
 *   X    = (TR + SE + SI) · 170.18/talla
 *   endo = −0.7182 + 0.1451·X − 0.00068·X² + 0.0000014·X³
 *
 * El ajuste por estatura es lo que la hace comparable entre personas: los
 * mismos milímetros de pliegue pesan distinto en alguien de 150 que de 190.
 */
const calcularEndomorfia = (
  tri: number | null, sub: number | null, supra: number | null, h: number | null,
): number | null => {
  if (tri === null || sub === null || supra === null || h === null) return null;
  const correccion = KERR.Hp / h;
  const sp3 = (tri + sub + supra) * correccion;
  return +(-0.7182 + 0.1451 * sp3 - 0.00068 * sp3 ** 2 + 0.0000014 * sp3 ** 3).toFixed(2);
};

/**
 * MESOMORFIA — la robustez músculo-esquelética (Heath-Carter clásico).
 *
 *   meso = 0.858·húmero + 0.601·fémur + 0.188·brazoCorr + 0.161·pantorrillaCorr
 *          − 0.131·talla + 4.5
 *
 * Los perímetros van CORREGIDOS por el pliegue de la zona (convención ISAK):
 * el perímetro se mide por fuera e incluye la grasa que lo cubre.
 *
 * SI EL PLIEGUE FALTA, NO SE CALCULA. Tratarlo como cero deja el perímetro
 * entero y sube la mesomorfia sin decirlo —0.16 puntos por la pantorrilla, 0.28
 * por el tríceps en un adulto medio—. Antes salía un número redondo y creíble
 * que no era el del paciente; ahora el indicador se declara incompleto y la
 * ficha pide el pliegue que falta.
 *
 * La talla entra en CENTÍMETROS, no en metros (Cabañas-Armesilla, 2009).
 */
const calcularMesomorfia = (medidas: {
  hum: number | null; fem: number | null; armC: number | null; calf: number | null;
  tri: number | null; calfSk: number | null; h: number | null;
}): number | null => {
  const { hum, fem, armC, calf, tri, calfSk, h } = medidas;
  if ([hum, fem, armC, calf, tri, calfSk, h].some((x) => x === null)) return null;

  const brazoCorr = (armC as number) - (tri as number) / 10;
  const pantorrillaCorr = (calf as number) - (calfSk as number) / 10;
  return +(
    0.858 * (hum as number) + 0.601 * (fem as number)
    + 0.188 * brazoCorr + 0.161 * pantorrillaCorr
    - 0.131 * (h as number) + 4.5
  ).toFixed(2);
};

/**
 * ECTOMORFIA — la linealidad, por el índice ponderal IP = talla / ∛peso.
 *
 *   IP ≥ 40.75          → 0.732·IP − 28.58
 *   38.25 < IP < 40.75  → 0.463·IP − 17.63
 *   IP ≤ 38.25          → 0.1
 *
 * El 0.1 del tramo bajo es el valor del artículo (no 0.5, que llegó a estar
 * escrito aquí por error).
 */
const calcularEctomorfia = (w: number | null, h: number | null): number | null => {
  // El peso tiene que ser mayor que cero: con cero, la raíz cúbica da cero y el
  // índice se va a infinito en vez de declararse incalculable.
  if (w === null || h === null || w <= 0) return null;

  const ip = h / Math.cbrt(w);
  if (ip >= 40.75) return +(0.732 * ip - 28.58).toFixed(2);
  if (ip > 38.25) return +(0.463 * ip - 17.63).toFixed(2);
  return 0.1;
};

export function computeSomatotype(input: CompositionInput): SomatotypeResult {
  const sk = input.skinfolds || {};
  const dia = input.diameters || {};
  const peri = input.perimeters || {};

  const w = num(input.weight);
  const h = num(input.height);
  const tri = num(sk.triceps);

  const endo = calcularEndomorfia(tri, num(sk.subscapular), num(sk.supraspinal), h);
  const meso = calcularMesomorfia({
    hum: num(dia.humerus),
    fem: num(dia.femur),
    armC: num(peri.arm_contracted),
    calf: num(peri.calf),
    calfSk: num(sk.medial_calf),
    tri,
    h,
  });
  const ecto = calcularEctomorfia(w, h);

  // Ejes de la somatocarta, convención clásica:
  //   X = ecto − endo  (endomorfo a la izquierda, ectomorfo a la derecha)
  //   Y = 2·meso − (endo + ecto)
  const x = endo !== null && ecto !== null ? +(ecto - endo).toFixed(2) : null;
  const y = meso !== null && endo !== null && ecto !== null
    ? +(2 * meso - (endo + ecto)).toFixed(2)
    : null;

  // Notación clásica: la tríada a un decimal, "2.1 – 4.5 – 3.0".
  const triad = endo !== null && meso !== null && ecto !== null
    ? `${endo.toFixed(1)} – ${meso.toFixed(1)} – ${ecto.toFixed(1)}`
    : null;

  return {
    endo, meso, ecto, x, y, triad,
    classification: classifySomatotype(endo, meso, ecto),
  };
}
