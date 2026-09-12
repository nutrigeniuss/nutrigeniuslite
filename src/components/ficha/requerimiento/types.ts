// Tipos del módulo de requerimiento energético / macronutrientes.
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { MetDay } from '../metCalculator/types';
import type { PatientUpdateFn } from '@/lib/patients/types';

export type MacroKey = 'carbs' | 'protein' | 'fat';
export type TabKey = 'energetico' | 'macronutrientes';

export type RequirementRecord = {
  activity_level?: string | null;
  activity_factor?: number | null;
  /**
   * El factor viene de un NAF calculado a mano (o del panel MET) y no de un
   * nivel predefinido. Sin guardarlo, al reabrir la consulta se volvía a
   * "Sedentario ×1.2" aunque el factor real estuviera guardado: el número
   * seguía ahí pero la pantalla mostraba otro, y el nutricionista tenía que
   * volver a aplicarlo cada vez.
   */
  use_custom_factor?: boolean | null;
  /** Última pestaña usada: por MET o por nivel de actividad. */
  met_mode?: boolean | null;
  /**
   * Modo del calculador MET: 'base' usa el MET del compendio, 'corrected' lo
   * ajusta al metabolismo real del paciente. NO es cosmético: con el mismo día
   * cargado, uno da NAF 1.25 y el otro 1.29.
   */
  naf_mode?: 'base' | 'corrected' | null;
  thermal_effect?: boolean | null;
  calorie_adjustment?: number | null;
  selected_formula?: string | null;
  target_calories?: number | null;
  target_carbs?: number | null;
  target_protein?: number | null;
  target_fat?: number | null;
  macro_pct_carbs?: number | null;
  macro_pct_protein?: number | null;
  macro_pct_fat?: number | null;
  [key: string]: unknown;
};

export type MeasurementRecord = {
  date?: string | null;
  weight?: number | null;
  height?: number | null;
  requirement?: RequirementRecord | null;
  [key: string]: unknown;
};

export type PatientRequirementRecord = {
  birth_date?: string | null;
  gender?: string | null;
  sex?: string | null;
  requirement?: RequirementRecord | null;
  measurements?: MeasurementRecord[] | null;
  target_calories?: number | null;
  target_carbs?: number | null;
  target_protein?: number | null;
  target_fat?: number | null;
  macro_pct_carbs?: number | null;
  macro_pct_protein?: number | null;
  macro_pct_fat?: number | null;
  [key: string]: unknown;
};

export type MacroInput = {
  pct: number;
  gkg: number | null;
};

export type MacroState = Record<MacroKey, MacroInput>;

export type FormulaResult = {
  formula: string;
  basal: number | null;
  eta: number | null;
  af: number | null;
  total: number | null;
  toUse: number | null;
};

export type ActivityLevel = {
  label: string;
  desc: string;
  factor: number;
};

export type UpdatePayload = Record<string, unknown>;

export type RequerimientoProps = {
  patient: PatientRequirementRecord;
  onUpdate: PatientUpdateFn<UpdatePayload>;
  tab?: TabKey;
  fixedMeasurement?: MeasurementRecord | null;
  registerAutosave?: (handler: (() => Promise<void>) | null) => void;
  registerManualSave?: (handler: (() => Promise<void>) | null) => void;
  hideMeasurementSelector?: boolean;
  autoSaveOnChange?: boolean;
  /** Oculta la franja Edad/Sexo/Peso cuando ya hay barra global de ficha. */
  hideContextStats?: boolean;
  macroPresentation?: 'standard' | 'exchange-clinical' | 'diet-compact';
};

export type MacroSectionProps = {
  totalCal: number;
  weight: number | null;
  macros: MacroState;
  setMacros: Dispatch<SetStateAction<MacroState>>;
  setLastInputMode: Dispatch<SetStateAction<'pct' | 'g'>>;
  lastInputMode: 'pct' | 'g';
  compact?: boolean;
};

export type SummaryMetricCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
};

export type SectionCardProps = {
  step: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
};

export type SaveOrigin = 'manual' | 'autosave';

export type RequirementInputSnapshot = {
  actLevel: string;
  customFactor: number | string | null;
  useCustomFactor: boolean;
  thermalEffect: boolean;
  calAdj: number | string;
  selectedFormula: string;
  macros: MacroState;
  metDays: MetDay[];
  nafMode: 'base' | 'corrected';
  /** Pestaña elegida. Va en la instantánea para que cambiarla cuente como un
      cambio pendiente y el autoguardado la recoja; si no, se elegía "Por MET"
      y al volver seguía en niveles porque nunca se llegó a guardar. */
  metMode: boolean;
};
