// Tipos del calculador de NAF/MET por actividades.
import type { ReactNode } from 'react';
import type { MetCatalogItem } from '../metCatalog.generated';

export type SelectedActivity = MetCatalogItem & {
  hours: number;
  mins: number;
};

export type MetDay = {
  id: string;
  label: string;
  activities: SelectedActivity[];
  /**
   * Cuántos días de la SEMANA representa este perfil (1–7). Es lo que convierte
   * el promedio de los días en un promedio ponderado: sin él, un sábado de
   * gimnasio pesa igual que los cinco días de oficina.
   *
   * Opcional a propósito. Los requerimientos guardados antes de que el campo
   * existiera no lo traen, y ahí se lee como 1 — que reproduce exactamente el
   * promedio simple de siempre. Ningún paciente ya calculado cambia de número
   * por actualizar la app.
   */
  weekDays?: number;
};


export type QuickTemplate = {
  id: string;
  label: string;
  description: string;
  items: Array<{
    match: string;
    category?: string;
    hours: number;
    mins: number;
  }>;
};

export type MetCalculatorProps = {
  weight?: number | null;
  basalKcal?: number | null;
  onNAFCalculated?: (result: { naf: number; factor: number; mode: 'base' | 'corrected' }) => void;
  /** Días iniciales para hidratar el estado (persistencia entre montajes). */
  initialDays?: MetDay[] | null;
  /** Reporta cambios en los días al contenedor para autoguardado. */
  onDaysChange?: (days: MetDay[]) => void;
  /**
   * Modo con el que arrancar: MET del compendio o MET corregido por el
   * metabolismo del paciente. Se recibe de fuera porque hay que RECORDARLO
   * entre visitas: no es una preferencia de la sesión, cambia el NAF y con él
   * las calorías del plan.
   */
  initialNafMode?: NafMode | null;
  /** Reporta el cambio de modo al contenedor para que lo guarde. */
  onNafModeChange?: (mode: NafMode) => void;
  /** Acción compacta en la cabecera (p. ej. interruptor Nivel/MET). */
  headerExtra?: ReactNode;
};

export type NafMode = 'base' | 'corrected';

export type NafCalculation = {
  naf: number;
  factor: number;
  totalMetHours: number;
};

export type DayMetrics = {
  baseCalculation: NafCalculation;
  correctedCalculation: NafCalculation;
  totalHours: number;
};

export type QuickDurationOption = {
  label: string;
  hours: number;
  mins: number;
};
