// Perímetro abdominal, índices cintura/cadera y cintura/talla, AMB y CMB.
import { SEX_LABEL, type IndicatorResult, type Sex, type WaistRisk } from '../types';
import { isNum, round } from './shared';

/**
 * Riesgo cardiometabólico por perímetro abdominal (OMS 2000).
 * Aplica a adultos y adultos mayores (≥18 años).
 *   ♂: <94 cm bajo · 94–<102 cm alto · ≥102 cm muy alto.
 *   ♀: <80 cm bajo · 80–<88 cm  alto · ≥88 cm  muy alto.
 * Ref: WHO (2000) Obesity: Preventing and Managing the Global Epidemic. TRS 894.
 *
 * NOTA: El perímetro abdominal (a la altura del punto medio entre el borde
 * costal inferior y la cresta ilíaca) es el indicador correcto para riesgo
 * metabólico. La cintura (punto de menor circunferencia del tronco) se usa
 * para ICC e ICT.
 */
export const abdominalPerimeterRisk = (
  abdominalCm?: number | null,
  sex?: Sex | null,
): IndicatorResult<WaistRisk> => {
  if (!isNum(abdominalCm) || !sex) {
    const missing: string[] = [];
    if (!isNum(abdominalCm)) missing.push('Perímetro Abdominal');
    if (!sex) missing.push('Sexo');
    return { value: null, missing };
  }
  const cuts = sex === 'F' ? { high: 80, veryHigh: 88 } : { high: 94, veryHigh: 102 };
  let risk: WaistRisk;
  let label: string;
  let severity: IndicatorResult['severity'];
  if (abdominalCm < cuts.high) {
    risk = 'bajo';
    label = 'Riesgo bajo';
    severity = 'good';
  } else if (abdominalCm < cuts.veryHigh) {
    risk = 'alto';
    label = 'Riesgo alto';
    severity = 'warn';
  } else {
    risk = 'muy_alto';
    label = 'Riesgo muy alto';
    severity = 'bad';
  }
  const cut1 = cuts.high;
  const cut2 = cuts.veryHigh;
  return {
    value: risk,
    classification: label,
    severity,
    detail: `Corte: ${cut1} cm (alto) / ${cut2} cm (muy alto) · OMS 2000 · Adultos y adultos mayores`,
  };
};

/** @deprecated Usar abdominalPerimeterRisk. Alias temporal para no romper callers existentes. */
export const waistRisk = abdominalPerimeterRisk;

/**
 * ICC = cintura/cadera. Excel R50-R51:
 *   ♀ <0.85 normal · ≥0.85 riesgo significativo.
 *   ♂ <0.90 normal · ≥0.90 riesgo significativo.
 */
export const calcWHR = (
  waistCm?: number | null,
  hipCm?: number | null,
  sex?: Sex | null
): IndicatorResult<number> => {
  const missing: string[] = [];
  if (!isNum(waistCm)) missing.push('Cintura');
  if (!isNum(hipCm)) missing.push('Cadera');
  if (!sex) missing.push('Sexo');
  if (missing.length || !isNum(waistCm) || !isNum(hipCm) || !sex) return { value: null, missing };
  const value = round(waistCm / hipCm, 2);
  const cut = sex === 'F' ? 0.85 : 0.9;
  const isHigh = value >= cut;
  return {
    value,
    classification: isHigh ? 'Riesgo significativo' : 'Normal',
    severity: isHigh ? 'bad' : 'good',
    detail: `Corte ${sex === 'F' ? '0.85' : '0.90'}`,
  };
};

/**
 * ICT = cintura/talla (Ashwell et al. 2012). Se aplica DESDE LOS 5 AÑOS: el
 * mismo criterio vale para el niño de cinco y para el adulto de setenta, que es
 * justo la virtud del indicador — no necesita tabla por edad ni por sexo.
 *
 *   < 0.4        Bajo peso / Delgadez extrema
 *   0.4 a < 0.5  Saludable            (verde)
 *   0.5 a < 0.6  Riesgo aumentado     (amarillo)
 *   ≥ 0.6        Riesgo alto          (rojo)
 *
 * Faltaba el tramo de abajo: por debajo de 0.4 la app decía "Saludable", y un
 * ICT de 0.33 no es salud, es delgadez extrema. Y las dos etiquetas de arriba
 * iban un escalón subidas ("elevado" donde toca "aumentado"), lo que teñía de
 * alarma la banda más poblada de la consulta.
 *
 * Por debajo de los 5 años NO se clasifica: la relación cintura/talla del
 * lactante y del preescolar es otra y estos cortes no le corresponden.
 */
export const WHTR_MIN_AGE_YEARS = 5;

/**
 * Las cuatro clasificaciones del ICT, en un solo sitio.
 *
 * NO son solo texto de pantalla: `pediatric/index.ts` las usa como CLAVE para
 * saber de qué color pintar la fila, y si no encuentra la clave NO MUESTRA EL
 * INDICADOR. Al renombrarlas a mano el 31-08-2026, el ICT desapareció sin aviso
 * de la ficha del niño y del informe impreso.
 *
 * Por eso viven aquí exportadas: quien necesite la etiqueta la importa, y un
 * cambio de texto llega solo a todos los sitios en vez de romper uno en
 * silencio.
 */
export const WHTR_LABELS = {
  bajoPeso: 'Bajo peso / Delgadez extrema',
  saludable: 'Normopeso / Saludable',
  riesgoAumentado: 'Sobrepeso / Riesgo aumentado',
  riesgoAlto: 'Obesidad / Riesgo alto',
  noAplica: 'No aplica',
} as const;

export const calcWHtR = (
  waistCm?: number | null,
  heightCm?: number | null,
  ageYears?: number | null,
): IndicatorResult<number> => {
  const missing: string[] = [];
  if (!isNum(waistCm)) missing.push('Cintura');
  if (!isNum(heightCm)) missing.push('Talla');
  if (missing.length || !isNum(waistCm) || !isNum(heightCm)) return { value: null, missing };
  const value = round(waistCm / heightCm, 2);

  // Edad desconocida → se clasifica igual: en el panel de adulto no hay menores
  // de 5 años, y callarse el diagnóstico por un dato de filiación que falta
  // sería peor que darlo.
  if (isNum(ageYears) && ageYears < WHTR_MIN_AGE_YEARS) {
    return {
      value,
      classification: WHTR_LABELS.noAplica,
      severity: 'info',
      detail: `El criterio ICT se usa desde los ${WHTR_MIN_AGE_YEARS} años`,
    };
  }

  let label: string;
  let severity: IndicatorResult['severity'];
  if (value < 0.4) {
    label = WHTR_LABELS.bajoPeso;
    severity = 'warn';
  } else if (value < 0.5) {
    label = WHTR_LABELS.saludable;
    severity = 'good';
  } else if (value < 0.6) {
    label = WHTR_LABELS.riesgoAumentado;
    severity = 'warn';
  } else {
    label = WHTR_LABELS.riesgoAlto;
    severity = 'bad';
  }
  return { value, classification: label, severity, detail: 'Ashwell 2012 · desde los 5 años' };
};

/**
 * AMB (Área Muscular del Brazo) según fórmula Excel R27 (Frisancho corregida):
 *   AMB = (((PB − PT × π))² / (4π)) − k, k = 10♂, 6.5♀.
 *   PB en cm, PT (pliegue tríceps) convertido de mm a cm (÷10).
 */
export const calcAMB = (
  armCircumferenceCm?: number | null,
  tricepsMm?: number | null,
  sex?: Sex | null
): IndicatorResult<number> => {
  const missing: string[] = [];
  if (!isNum(armCircumferenceCm)) missing.push('Perímetro brazo');
  if (!isNum(tricepsMm)) missing.push('Pliegue tríceps');
  if (!sex) missing.push('Sexo');
  if (missing.length || !isNum(armCircumferenceCm) || !isNum(tricepsMm) || !sex) {
    return { value: null, missing };
  }
  const tricepsCm = tricepsMm / 10;
  const k = sex === 'M' ? 10 : 6.5;
  const value = round((armCircumferenceCm - tricepsCm * Math.PI) ** 2 / (4 * Math.PI) - k, 2);
  return { value, detail: 'Frisancho corregido' };
};

/**
 * CMB = PB − π × (PT / 10).
 * PB en cm, PT en mm (÷10 para convertir a cm).
 * Ref: Longo E, Navarro E.
 */
export const calcCMB = (
  armCircumferenceCm?: number | null,
  tricepsMm?: number | null
): IndicatorResult<number> => {
  if (!isNum(armCircumferenceCm) || !isNum(tricepsMm)) {
    const missing: string[] = [];
    if (!isNum(armCircumferenceCm)) missing.push('Perímetro brazo');
    if (!isNum(tricepsMm)) missing.push('Pliegue tríceps');
    return { value: null, missing };
  }
  return { value: round(armCircumferenceCm - Math.PI * (tricepsMm / 10), 2) };
};

/**
 * Edad mínima del criterio: la cohorte de Wu et al. (2017) es de 40 a 90 años
 * (NHANES III). Por debajo de esa edad el estudio no dice nada, y aplicarle sus
 * cortes a un paciente de 25 sería inventar un diagnóstico.
 */
export const CMB_MIN_AGE_YEARS = 40;

/**
 * Puntos de corte de los terciles de CMB/MAMC (cm), Wu et al. 2017 (NHANES III).
 * `t2` separa el tercil bajo del medio y `t3` el medio del alto.
 *
 * Los extremos que publica el estudio (♂ 18–40 cm, ♀ 15–44 cm) son el rango
 * observado en su muestra, no un límite del criterio: un valor por encima sigue
 * siendo tercil alto. De los datos absurdos ya avisa el rango plausible de la
 * casilla al capturar la medida.
 */
const CMB_TERTILES: Record<Sex, { t2: number; t3: number }> = {
  M: { t2: 27.3, t3: 29.6 },
  F: { t2: 22.3, t3: 24.6 },
};

/**
 * ¿Hay criterio de CMB para esta edad? Sin él la fila NO se muestra: un número
 * sin lectura clínica al lado invita a interpretarlo a ojo, que es justo lo que
 * pasaba con la escala anterior.
 */
export const cmbCriterionApplies = (ageYears?: number | null): boolean =>
  isNum(ageYears) && ageYears >= CMB_MIN_AGE_YEARS;

/**
 * Tercil de CMB y lo que significa para la mortalidad (Wu C-Y et al., 2017,
 * NHANES III, 40–90 años). Devuelve el número de tercil (1, 2 o 3).
 *
 * ♂ — el tercil manda: T1 (<27.3) es el grupo de referencia y el de mayor
 *     mortalidad; T2 (27.3–29.6) HR 0.83 (p=0.033); T3 (≥29.6) HR 0.76
 *     (p=0.018), un 24 % menos de mortalidad que T1.
 * ♀ — no se halló asociación significativa en ningún tercil (T2 p=0.075,
 *     T3 p=0.583). Se informa el tercil, pero SIN pintarlo como bueno o malo:
 *     decir "riesgo reducido" en mujeres sería atribuirle al estudio algo que
 *     no encontró.
 *
 * Sustituye a la antigua escala de "% del estándar" (Longo & Navarro), que
 * clasificaba como OBESIDAD un CMB alto — es decir, mucho músculo — y contradecía
 * al AMB, que se calcula con los mismos dos datos.
 */
export const classifyCMB = (
  cmbCm?: number | null,
  sex?: Sex | null,
  ageYears?: number | null,
): IndicatorResult<number> => {
  if (!isNum(cmbCm) || !sex) {
    const missing: string[] = [];
    if (!isNum(cmbCm)) missing.push('CMB');
    if (!sex) missing.push('Sexo');
    return { value: null, missing };
  }

  if (!isNum(ageYears)) {
    return {
      value: null,
      classification: 'No aplica',
      severity: 'info',
      detail: `Falta la fecha de nacimiento · el criterio es desde los ${CMB_MIN_AGE_YEARS} años`,
    };
  }
  if (ageYears < CMB_MIN_AGE_YEARS) {
    return {
      value: null,
      classification: 'No aplica',
      severity: 'info',
      detail: `Sin criterio validado antes de los ${CMB_MIN_AGE_YEARS} años · Wu 2017 estudió 40–90 años`,
    };
  }

  const { t2, t3 } = CMB_TERTILES[sex];
  const tertile = cmbCm >= t3 ? 3 : cmbCm >= t2 ? 2 : 1;
  const source = 'Wu 2017 · NHANES III · 40–90 años';

  if (sex === 'M') {
    const byTertile = {
      1: { classification: 'Tercil bajo (T1)', severity: 'warn' as const,
           note: `Menos de ${t2} cm · mayor mortalidad (grupo de referencia)` },
      2: { classification: 'Tercil medio (T2)', severity: 'good' as const,
           note: `${t2}–${t3} cm · menor mortalidad que T1 (HR 0.83)` },
      3: { classification: 'Tercil alto (T3)', severity: 'good' as const,
           note: `Desde ${t3} cm · 24 % menos mortalidad que T1 (HR 0.76)` },
    }[tertile];
    return {
      value: tertile,
      classification: byTertile.classification,
      severity: byTertile.severity,
      detail: `${byTertile.note} · ${source}`,
    };
  }

  const byTertile = {
    1: { classification: 'Tercil bajo (T1)', note: `Menos de ${t2} cm · grupo de referencia` },
    2: { classification: 'Tercil medio (T2)', note: `${t2}–${t3} cm · sin asociación con mortalidad (p=0.075)` },
    3: { classification: 'Tercil alto (T3)', note: `Desde ${t3} cm · sin asociación con mortalidad (p=0.583)` },
  }[tertile];
  return {
    value: tertile,
    classification: byTertile.classification,
    severity: 'info',
    detail: `${byTertile.note} · ${source}`,
  };
};

/** Valores estándar del pliegue cutáneo tricipital (mm), Longo E, Navarro E. */
const PCT_STANDARD: Record<Sex, number> = { M: 12.5, F: 16.5 };

/**
 * %PCT = (pliegue tricipital actual / estándar) × 100.
 *
 * Es el gemelo calórico del %CMB: el pliegue tricipital estima la reserva de
 * GRASA y el %CMB la de MÚSCULO. Por eso se leen juntos — un paciente puede
 * tener la grasa conservada y el músculo agotado, y mirar solo uno lo esconde.
 *
 * Escala completa:
 *   ≥ 120 %   → Obesidad
 *   > 110 %   → Sobrepeso
 *   90–110 %  → Normal
 *   80–89 %   → Desnutrición leve
 *   60–79 %   → Desnutrición moderada
 *   < 60 %    → Desnutrición severa
 *
 * Los tramos por debajo son de Longo & Navarro, que solo describe la
 * desnutrición: en su tabla todo lo que pasa de 90 % es "normal". Pero un
 * pliegue del 150 % del estándar no es normal, es exceso de grasa, y dejarlo
 * en verde escondería justo lo contrario de lo que la tabla vigila. De ahí los
 * dos tramos superiores.
 *
 * Los cortes se implementan continuos: leídos como los escribe la fuente
 * ("80-89 / 60-79 / <60") un 79,5 no caería en ninguno.
 */
export const calcPCTPercent = (
  tricepsMm?: number | null,
  sex?: Sex | null,
): IndicatorResult<number> => {
  if (!isNum(tricepsMm) || !sex) {
    const missing: string[] = [];
    if (!isNum(tricepsMm)) missing.push('Pliegue tríceps');
    if (!sex) missing.push('Sexo');
    return { value: null, missing };
  }
  const standard = PCT_STANDARD[sex];
  const pct = round((tricepsMm / standard) * 100, 1);
  let classification: string;
  let severity: IndicatorResult['severity'];
  if (pct >= 120) {
    classification = 'Obesidad';
    severity = 'bad';
  } else if (pct > 110) {
    classification = 'Sobrepeso';
    severity = 'warn';
  } else if (pct >= 90) {
    classification = 'Normal';
    severity = 'good';
  } else if (pct >= 80) {
    classification = 'Desnutrición leve';
    severity = 'warn';
  } else if (pct >= 60) {
    classification = 'Desnutrición moderada';
    severity = 'bad';
  } else {
    classification = 'Desnutrición severa';
    severity = 'bad';
  }
  return {
    value: pct,
    classification,
    severity,
    detail: `Estándar ${SEX_LABEL[sex]}: ${standard} mm · Longo & Navarro`,
  };
};
