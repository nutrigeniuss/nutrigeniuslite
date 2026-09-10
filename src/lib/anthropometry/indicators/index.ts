// Indicadores antropométricos.
// Todas las funciones son puras: reciben los datos necesarios y devuelven IndicatorResult.
// Las constantes de referencia provienen del Excel proporcionado por el usuario
// (Docs/TABLAS (2).xlsx → tables.generated.ts) o de literatura citada en cada función.
//
// Este barrel mantiene la API pública estable: importar desde './indicators'
// (o '@/lib/anthropometry') sigue funcionando igual tras la modularización.

// Helpers públicos (no se re-exporta `isNum`, que es interno entre submódulos).
export { round, calcAge, normalizeSex, findPercentileRow, valueToPercentile } from './shared';

export { calcBMI } from './bmi';
export {
  idealWeightWest,
  idealWeightHamwi,
  idealWeightByBmi,
  imcObjetivoPara,
  imcSaludablePara,
  esAdultoMayor,
  EDAD_ADULTO_MAYOR,
  healthyWeightRange,
  percentIdealWeight,
  correctedWeight,
  adjustedWeight,
} from './idealWeight';
export type { PercentIdealWeightCategory } from './idealWeight';
export { calcComplexionFrame, idealWeightByComplexion } from './complexion';
export {
  abdominalPerimeterRisk,
  waistRisk,
  calcWHR,
  calcWHtR,
  calcAMB,
  calcCMB,
  classifyCMB,
  cmbCriterionApplies,
  CMB_MIN_AGE_YEARS,
  calcPCTPercent,
} from './circumferences';
export {
  armCircumferenceAssessment,
  ambAssessment,
  tricepsAssessment,
  subscapularAssessment,
  triSubSumAssessment,
} from './percentiles';
export { bodyFatDurninSiri, bodyFatGallagherAssessment, bodyFatFaulkner, bodyFatYuhasz, bodyFatRFM } from './bodyFat';
export { estimateHeightChumlea, estimateWeightChumlea } from './estimates';
export {
  weightChangePercent,
  nearestLossWindow,
  findLossWindow,
  LOSS_WINDOWS,
  MAX_LOSS_WINDOW_DAYS,
  type LossWindow,
  type LossWindowKey,
  type WeightChangeResult,
} from './weightChange';
export { PLAUSIBLE_RANGES, isPlausible } from './ranges';
