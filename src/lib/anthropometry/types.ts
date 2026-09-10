// Tipos compartidos del módulo de antropometría.

/** 'M' = masculino, 'F' = femenino. Es lo que las tablas del Excel usan. */
export type Sex = 'M' | 'F';

/**
 * Cómo se ESCRIBE el sexo en cualquier texto que vea el usuario: "Masculino" y
 * "Femenino", nunca "varón", "hombre" ni "mujer".
 *
 * Un mismo dato escrito de tres formas se acaba leyendo de tres formas: de ahí
 * venía que la letra "M" significara MUJER en un módulo y VARÓN en otro. La
 * lectura la unifica lib/patients/sex.js; la escritura, esta constante.
 */
export const SEX_LABEL: Record<Sex, string> = { M: 'Masculino', F: 'Femenino' };

/** Una fila de tabla de percentiles para un rango de edad. */
export type PercentileRow = {
  /** Edad mínima inclusiva en años (p. ej. 18.0). */
  ageMin: number;
  /** Edad máxima inclusiva en años (p. ej. 24.9). */
  ageMax: number;
  /** Valores ordenados según `PERCENTILES` (5,10,15,25,50,75,85,90,95). */
  p: readonly number[];
};

/** Rango de peso saludable (kg) para una complexión y talla dadas. */
export type ComplexionWeightRange = {
  /** Peso mínimo del rango (kg). */
  min: number;
  /** Peso máximo del rango (kg). */
  max: number;
};

/** Fila de la tabla de peso por talla y complexión.
 *  Cada complexión expresa un rango (min-max) de peso saludable, según la
 *  tabla "Peso ideal por complexión" del Excel/manual del usuario. */
export type ComplexionRow = {
  heightCm: number;
  sex: Sex;
  /** Rango para complexión chica/pequeña (kg). */
  small: ComplexionWeightRange;
  /** Rango para complexión mediana (kg). */
  medium: ComplexionWeightRange;
  /** Rango para complexión grande (kg). */
  large: ComplexionWeightRange;
};

export type ComplexionFrame = 'small' | 'medium' | 'large';

/** Categorías OMS de IMC para adultos (18-59) y adulto mayor (≥60). */
export type BmiCategory =
  | 'delgadez_g3'
  | 'delgadez_g2'
  | 'delgadez_g1'
  | 'delgadez_am' // adulto mayor: solo "Delgadez"
  | 'normal'
  | 'sobrepeso'
  | 'obesidad_g1'
  | 'obesidad_g2'
  | 'obesidad_g3'
  | 'obesidad_am'; // adulto mayor: solo "Obesidad"

/** Resultado uniforme de cualquier indicador antropométrico. */
export type IndicatorResult<TValue = number> = {
  /** Valor numérico calculado (puede ser null si faltan datos). */
  value: TValue | null;
  /** Etiqueta de la clasificación clínica (p. ej. "Normal", "Riesgo alto"). */
  classification?: string;
  /** Token semántico para colorear en la UI: 'good' | 'warn' | 'bad' | 'info'. */
  severity?: 'good' | 'warn' | 'bad' | 'info';
  /** Detalle adicional para tooltips (p. ej. percentil exacto, fórmula). */
  detail?: string;
  /** Lista de campos que faltaron y bloquearon el cálculo. */
  missing?: readonly string[];
};

/** Riesgo cardiometabólico por circunferencia de cintura. */
export type WaistRisk = 'bajo' | 'alto' | 'muy_alto';
