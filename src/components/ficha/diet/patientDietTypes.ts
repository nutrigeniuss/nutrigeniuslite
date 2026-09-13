// Este archivo concentra los contratos compartidos del flujo de dietas del paciente.
// Cuando se agreguen nuevas vistas o editores, conviene extender estos tipos aquí
// antes que redefinir estructuras en cada componente.

export type PatientDietRecord = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  name?: string | null;
  last_name?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  sex?: string | null;
  target_calories?: number | null;
  target_protein?: number | null;
  target_carbs?: number | null;
  target_fat?: number | null;
  macro_pct_carbs?: number | null;
  macro_pct_protein?: number | null;
  macro_pct_fat?: number | null;
  requirement?: PatientRequirementSnapshot | null;
  measurements?: PatientMeasurementRecord[];
  [key: string]: unknown;
};

export type PatientRequirementSnapshot = {
  activity_level?: string | null;
  activity_factor?: number | null;
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

export type PatientMeasurementRecord = {
  date?: string | null;
  weight?: number | null;
  height?: number | null;
  requirement?: PatientRequirementSnapshot | null;
  [key: string]: unknown;
};

export type DietItem = {
  id?: string;
  name?: string;
  unit?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  quantity?: number;
  [key: string]: unknown;
};

export type DietMeal = {
  id?: string;
  name?: string;
  time?: string;
  notes?: string;
  items?: DietItem[];
  exchanges?: Record<string, number>;
  [key: string]: unknown;
};

export type DietPlan = {
  id: string;
  nutritionist_id?: string | null;
  patient_id?: string;
  patient_name?: string;
  date?: string | null;
  title?: string;
  target_calories?: number | null;
  target_protein?: number | null;
  target_carbs?: number | null;
  target_fat?: number | null;
  meals?: DietMeal[];
  created_at?: string;
  is_catalog?: boolean;
  [key: string]: unknown;
};

export type ExchangePlan = {
  id: string;
  nutritionist_id?: string | null;
  patient_id?: string;
  patient_name?: string;
  date?: string | null;
  title?: string;
  meals?: DietMeal[];
  active_group_keys?: string[];
  food_list_selections?: Record<string, string[]>;
  scenarios?: ExchangeScenario[];
  active_scenario_key?: string | null;
  [key: string]: unknown;
};

export type ExchangeScenario = {
  key: string;
  meals?: DietMeal[];
  active_group_keys?: string[];
  food_list_selections?: Record<string, string[]>;
  [key: string]: unknown;
};