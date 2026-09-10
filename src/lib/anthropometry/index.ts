// Punto de entrada del módulo de antropometría.
// Importa siempre desde aquí: import { calcBMI } from '@/lib/anthropometry';

export * from './types';
export * from './indicators';
export {
  PERCENTILES,
  COMPLEXION_TABLE,
  ARM_CIRC_PERCENTILES,
  AMB_PERCENTILES,
  TRICEPS_PERCENTILES,
  SUBSCAPULAR_PERCENTILES,
  TRI_SUB_SUM_PERCENTILES,
} from './tables.generated';
