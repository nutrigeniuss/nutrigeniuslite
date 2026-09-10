// Tipos del módulo de dieta del paciente (planes por alimentos e intercambios).
import type { DietMeal, DietPlan, ExchangeScenario, PatientDietRecord } from '../patientDietTypes';
import type { PatientUpdateFn } from '@/lib/patients/types';

export type PatientDietProps = {
  patient: PatientDietRecord;
  tab?: 'alimentos' | 'intercambios';
  onUpdate: PatientUpdateFn;
  registerAutosave?: (handler: (() => Promise<void>) | null) => void;
};

export type DietCatalogInsertPayload = {
  nutritionist_id: string;
  patient_id: string;
  patient_name: string;
  date: string;
  title?: string;
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fat: number;
  meals: DietMeal[];
};

export type ExchangeInsertPayload = {
  nutritionist_id: string;
  title?: string;
  patient_id: string;
  patient_name: string;
  date?: string | null;
  meals?: DietMeal[];
  active_group_keys?: string[];
  food_list_selections?: Record<string, string[]>;
  scenarios?: ExchangeScenario[];
  active_scenario_key?: string | null;
};

export type PendingDietAction =
  | { kind: 'alimentos-nuevo'; date: string }
  | { kind: 'alimentos-catalogo'; date: string; catalogPlan: DietPlan }
  | { kind: 'alimentos-copia'; date: string; sourcePlanId: string }
  | { kind: 'intercambios-nuevo'; date: string; title: string };

export type DatePromptModalProps = {
  open: boolean;
  title: string;
  description?: string;
  value: string;
  planName: string;
  onChange: (value: string) => void;
  onPlanNameChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
};

export type ExchangeMacroBreakdown = {
  carbs: number;
  protein: number;
  fat: number;
};

export type ExchangeMacroBarProps = {
  label: string;
  value: number;
  fillClassName: string;
};
