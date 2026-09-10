import { normalizeSexRaw } from './patients/sex.js';

// RDI / IDR — Ingestas Diarias Recomendadas por grupo de población.
// Fuente: tablas DRI/FESNAD provistas por el usuario (2026).
//
// ⚠️ DATOS CLÍNICOS — PENDIENTE DE VERIFICACIÓN contra la fuente original.
// Los valores marcados con "*" en la fuente son Ingesta Adecuada (AI); aquí se
// tratan igual que un objetivo para el cálculo de % de cobertura.
//
// UNIDADES: cada valor se guarda en la MISMA unidad que la clave de alimento
// correspondiente en foodNutrients.ts (OPTIONAL_NUTRIENTS), para poder comparar
// directamente contra los totales de la dieta. Conversiones aplicadas:
//   - vitamin_b6: la clave de alimento está en mcg → RDI (mg) × 1000
//   - copper:     la clave de alimento está en mg  → RDI (µg) ÷ 1000
// Nutrientes de la tabla SIN clave de alimento (no comparables) y por tanto
// omitidos: Colina, Flúor.

export type RdiPopulation = 'infant' | 'child' | 'male' | 'female' | 'pregnant' | 'lactating';

export type RdiGroup = {
  population: RdiPopulation;
  /** Edad mínima en años, inclusive. */
  ageMinYears: number;
  /** Edad máxima en años, inclusive. */
  ageMaxYears: number;
  label: string;
  /** Objetivos por clave de nutriente de alimento, ya en la unidad de esa clave. */
  targets: Record<string, number>;
};

// Helper para legibilidad: recibe los valores en la unidad de la TABLA y aplica
// las conversiones necesarias hacia la unidad de la clave de alimento.
const g = (v: {
  vitamin_a: number; vitamin_d: number; vitamin_e: number; vitamin_k: number;
  vitamin_c: number; thiamine: number; riboflavin: number; niacin: number;
  vitamin_b6_mg: number; folate: number; vitamin_b12: number; pantothenic_acid: number;
  biotin: number; calcium: number; chromium: number; copper_ug: number;
  iodine: number; iron: number; magnesium: number; manganese: number;
  molybdenum: number; phosphorus: number; selenium: number; zinc: number;
}): Record<string, number> => ({
  vitamin_a: v.vitamin_a,
  vitamin_d: v.vitamin_d,
  vitamin_e: v.vitamin_e,
  vitamin_k: v.vitamin_k,
  vitamin_c: v.vitamin_c,
  thiamine: v.thiamine,
  riboflavin: v.riboflavin,
  niacin: v.niacin,
  vitamin_b6: v.vitamin_b6_mg * 1000, // mg → mcg (unidad de la clave de alimento)
  folate: v.folate,
  vitamin_b12: v.vitamin_b12,
  pantothenic_acid: v.pantothenic_acid,
  biotin: v.biotin,
  calcium: v.calcium,
  chromium: v.chromium,
  copper: v.copper_ug / 1000, // µg → mg (unidad de la clave de alimento)
  iodine: v.iodine,
  iron: v.iron,
  magnesium: v.magnesium,
  manganese: v.manganese,
  molybdenum: v.molybdenum,
  phosphorus: v.phosphorus,
  selenium: v.selenium,
  zinc: v.zinc,
});

// Tabla completa. El orden de columnas del helper `g` sigue las tablas de origen.
export const RDI_GROUPS: RdiGroup[] = [
  // ── Lactantes (sin distinción de sexo) ──
  { population: 'infant', ageMinYears: 0, ageMaxYears: 0, label: 'Lactante 0-6 meses', targets: g({ vitamin_a: 400, vitamin_d: 5, vitamin_e: 4, vitamin_k: 2.0, vitamin_c: 40, thiamine: 0.2, riboflavin: 0.3, niacin: 2, vitamin_b6_mg: 0.1, folate: 65, vitamin_b12: 0.4, pantothenic_acid: 1.7, biotin: 5, calcium: 210, chromium: 0.2, copper_ug: 200, iodine: 110, iron: 0.27, magnesium: 30, manganese: 0.003, molybdenum: 2, phosphorus: 100, selenium: 15, zinc: 2 }) },
  { population: 'infant', ageMinYears: 0, ageMaxYears: 0, label: 'Lactante 7-12 meses', targets: g({ vitamin_a: 500, vitamin_d: 5, vitamin_e: 5, vitamin_k: 2.5, vitamin_c: 50, thiamine: 0.3, riboflavin: 0.4, niacin: 4, vitamin_b6_mg: 0.3, folate: 80, vitamin_b12: 0.5, pantothenic_acid: 1.8, biotin: 6, calcium: 270, chromium: 5.5, copper_ug: 220, iodine: 130, iron: 11, magnesium: 75, manganese: 0.6, molybdenum: 3, phosphorus: 275, selenium: 20, zinc: 3 }) },

  // ── Niños/as (sin distinción de sexo) ──
  { population: 'child', ageMinYears: 1, ageMaxYears: 3, label: 'Niños/as 1-3 años', targets: g({ vitamin_a: 300, vitamin_d: 5, vitamin_e: 6, vitamin_k: 30, vitamin_c: 15, thiamine: 0.5, riboflavin: 0.5, niacin: 6, vitamin_b6_mg: 0.5, folate: 150, vitamin_b12: 0.9, pantothenic_acid: 2, biotin: 8, calcium: 500, chromium: 11, copper_ug: 340, iodine: 90, iron: 7, magnesium: 80, manganese: 1.2, molybdenum: 17, phosphorus: 460, selenium: 20, zinc: 3 }) },
  { population: 'child', ageMinYears: 4, ageMaxYears: 8, label: 'Niños/as 4-8 años', targets: g({ vitamin_a: 400, vitamin_d: 5, vitamin_e: 7, vitamin_k: 55, vitamin_c: 25, thiamine: 0.6, riboflavin: 0.6, niacin: 8, vitamin_b6_mg: 0.6, folate: 200, vitamin_b12: 1.2, pantothenic_acid: 3, biotin: 12, calcium: 800, chromium: 15, copper_ug: 440, iodine: 90, iron: 10, magnesium: 130, manganese: 1.5, molybdenum: 22, phosphorus: 500, selenium: 30, zinc: 5 }) },

  // ── Hombres ──
  { population: 'male', ageMinYears: 9, ageMaxYears: 13, label: 'Masculino 9-13 años', targets: g({ vitamin_a: 600, vitamin_d: 5, vitamin_e: 11, vitamin_k: 60, vitamin_c: 45, thiamine: 0.9, riboflavin: 0.9, niacin: 12, vitamin_b6_mg: 1.0, folate: 300, vitamin_b12: 1.8, pantothenic_acid: 4, biotin: 20, calcium: 1300, chromium: 25, copper_ug: 700, iodine: 120, iron: 8, magnesium: 240, manganese: 1.9, molybdenum: 34, phosphorus: 1250, selenium: 40, zinc: 8 }) },
  { population: 'male', ageMinYears: 14, ageMaxYears: 18, label: 'Masculino 14-18 años', targets: g({ vitamin_a: 900, vitamin_d: 5, vitamin_e: 15, vitamin_k: 75, vitamin_c: 75, thiamine: 1.2, riboflavin: 1.3, niacin: 16, vitamin_b6_mg: 1.3, folate: 400, vitamin_b12: 2.4, pantothenic_acid: 5, biotin: 25, calcium: 1300, chromium: 35, copper_ug: 890, iodine: 150, iron: 11, magnesium: 410, manganese: 2.2, molybdenum: 43, phosphorus: 1250, selenium: 55, zinc: 11 }) },
  { population: 'male', ageMinYears: 19, ageMaxYears: 30, label: 'Masculino 19-30 años', targets: g({ vitamin_a: 900, vitamin_d: 5, vitamin_e: 15, vitamin_k: 120, vitamin_c: 90, thiamine: 1.2, riboflavin: 1.3, niacin: 16, vitamin_b6_mg: 1.3, folate: 400, vitamin_b12: 2.4, pantothenic_acid: 5, biotin: 30, calcium: 1000, chromium: 35, copper_ug: 900, iodine: 150, iron: 8, magnesium: 400, manganese: 2.3, molybdenum: 45, phosphorus: 700, selenium: 55, zinc: 11 }) },
  { population: 'male', ageMinYears: 31, ageMaxYears: 50, label: 'Masculino 31-50 años', targets: g({ vitamin_a: 900, vitamin_d: 5, vitamin_e: 15, vitamin_k: 120, vitamin_c: 90, thiamine: 1.2, riboflavin: 1.3, niacin: 16, vitamin_b6_mg: 1.3, folate: 400, vitamin_b12: 2.4, pantothenic_acid: 5, biotin: 30, calcium: 1000, chromium: 35, copper_ug: 900, iodine: 150, iron: 8, magnesium: 420, manganese: 2.3, molybdenum: 45, phosphorus: 700, selenium: 55, zinc: 11 }) },
  { population: 'male', ageMinYears: 51, ageMaxYears: 70, label: 'Masculino 51-70 años', targets: g({ vitamin_a: 900, vitamin_d: 10, vitamin_e: 15, vitamin_k: 120, vitamin_c: 90, thiamine: 1.2, riboflavin: 1.3, niacin: 16, vitamin_b6_mg: 1.7, folate: 400, vitamin_b12: 2.4, pantothenic_acid: 5, biotin: 30, calcium: 1000, chromium: 30, copper_ug: 900, iodine: 150, iron: 8, magnesium: 420, manganese: 2.3, molybdenum: 45, phosphorus: 700, selenium: 55, zinc: 11 }) },
  { population: 'male', ageMinYears: 71, ageMaxYears: 200, label: 'Masculino >70 años', targets: g({ vitamin_a: 900, vitamin_d: 15, vitamin_e: 15, vitamin_k: 120, vitamin_c: 90, thiamine: 1.2, riboflavin: 1.3, niacin: 16, vitamin_b6_mg: 1.7, folate: 400, vitamin_b12: 2.4, pantothenic_acid: 5, biotin: 30, calcium: 1200, chromium: 30, copper_ug: 900, iodine: 150, iron: 8, magnesium: 420, manganese: 2.3, molybdenum: 45, phosphorus: 700, selenium: 55, zinc: 11 }) },

  // ── Mujeres ──
  { population: 'female', ageMinYears: 9, ageMaxYears: 13, label: 'Femenino 9-13 años', targets: g({ vitamin_a: 600, vitamin_d: 5, vitamin_e: 11, vitamin_k: 60, vitamin_c: 45, thiamine: 0.9, riboflavin: 0.9, niacin: 12, vitamin_b6_mg: 1.0, folate: 300, vitamin_b12: 1.8, pantothenic_acid: 4, biotin: 20, calcium: 1300, chromium: 21, copper_ug: 700, iodine: 120, iron: 8, magnesium: 240, manganese: 1.6, molybdenum: 34, phosphorus: 1250, selenium: 40, zinc: 8 }) },
  { population: 'female', ageMinYears: 14, ageMaxYears: 18, label: 'Femenino 14-18 años', targets: g({ vitamin_a: 700, vitamin_d: 5, vitamin_e: 15, vitamin_k: 75, vitamin_c: 65, thiamine: 1.0, riboflavin: 1.0, niacin: 14, vitamin_b6_mg: 1.2, folate: 400, vitamin_b12: 2.4, pantothenic_acid: 5, biotin: 25, calcium: 1300, chromium: 24, copper_ug: 890, iodine: 150, iron: 15, magnesium: 360, manganese: 1.6, molybdenum: 43, phosphorus: 1250, selenium: 55, zinc: 9 }) },
  { population: 'female', ageMinYears: 19, ageMaxYears: 30, label: 'Femenino 19-30 años', targets: g({ vitamin_a: 700, vitamin_d: 5, vitamin_e: 15, vitamin_k: 90, vitamin_c: 75, thiamine: 1.1, riboflavin: 1.1, niacin: 14, vitamin_b6_mg: 1.3, folate: 400, vitamin_b12: 2.4, pantothenic_acid: 5, biotin: 30, calcium: 1000, chromium: 25, copper_ug: 900, iodine: 150, iron: 18, magnesium: 310, manganese: 1.8, molybdenum: 45, phosphorus: 700, selenium: 55, zinc: 8 }) },
  { population: 'female', ageMinYears: 31, ageMaxYears: 50, label: 'Femenino 31-50 años', targets: g({ vitamin_a: 700, vitamin_d: 5, vitamin_e: 15, vitamin_k: 90, vitamin_c: 75, thiamine: 1.1, riboflavin: 1.1, niacin: 14, vitamin_b6_mg: 1.3, folate: 400, vitamin_b12: 2.4, pantothenic_acid: 5, biotin: 30, calcium: 1000, chromium: 25, copper_ug: 900, iodine: 150, iron: 18, magnesium: 320, manganese: 1.8, molybdenum: 45, phosphorus: 700, selenium: 55, zinc: 8 }) },
  { population: 'female', ageMinYears: 51, ageMaxYears: 70, label: 'Femenino 51-70 años', targets: g({ vitamin_a: 700, vitamin_d: 10, vitamin_e: 15, vitamin_k: 90, vitamin_c: 75, thiamine: 1.1, riboflavin: 1.1, niacin: 14, vitamin_b6_mg: 1.5, folate: 400, vitamin_b12: 2.4, pantothenic_acid: 5, biotin: 30, calcium: 1200, chromium: 20, copper_ug: 900, iodine: 150, iron: 8, magnesium: 320, manganese: 1.8, molybdenum: 45, phosphorus: 700, selenium: 55, zinc: 8 }) },
  { population: 'female', ageMinYears: 71, ageMaxYears: 200, label: 'Femenino >70 años', targets: g({ vitamin_a: 700, vitamin_d: 15, vitamin_e: 15, vitamin_k: 90, vitamin_c: 75, thiamine: 1.1, riboflavin: 1.1, niacin: 14, vitamin_b6_mg: 1.5, folate: 400, vitamin_b12: 2.4, pantothenic_acid: 5, biotin: 30, calcium: 1200, chromium: 20, copper_ug: 900, iodine: 150, iron: 8, magnesium: 320, manganese: 1.8, molybdenum: 45, phosphorus: 700, selenium: 55, zinc: 8 }) },

  // ── Embarazadas ──
  { population: 'pregnant', ageMinYears: 0, ageMaxYears: 18, label: 'Embarazadas ≤18 años', targets: g({ vitamin_a: 750, vitamin_d: 5, vitamin_e: 15, vitamin_k: 75, vitamin_c: 80, thiamine: 1.4, riboflavin: 1.4, niacin: 18, vitamin_b6_mg: 1.9, folate: 600, vitamin_b12: 2.6, pantothenic_acid: 6, biotin: 30, calcium: 1300, chromium: 29, copper_ug: 1000, iodine: 220, iron: 27, magnesium: 400, manganese: 2.0, molybdenum: 50, phosphorus: 1250, selenium: 60, zinc: 13 }) },
  { population: 'pregnant', ageMinYears: 19, ageMaxYears: 30, label: 'Embarazadas 19-30 años', targets: g({ vitamin_a: 770, vitamin_d: 5, vitamin_e: 15, vitamin_k: 90, vitamin_c: 85, thiamine: 1.4, riboflavin: 1.4, niacin: 18, vitamin_b6_mg: 1.9, folate: 600, vitamin_b12: 2.6, pantothenic_acid: 6, biotin: 30, calcium: 1000, chromium: 30, copper_ug: 1000, iodine: 220, iron: 27, magnesium: 350, manganese: 2.0, molybdenum: 50, phosphorus: 700, selenium: 60, zinc: 11 }) },
  { population: 'pregnant', ageMinYears: 31, ageMaxYears: 50, label: 'Embarazadas 31-50 años', targets: g({ vitamin_a: 770, vitamin_d: 5, vitamin_e: 15, vitamin_k: 90, vitamin_c: 85, thiamine: 1.4, riboflavin: 1.4, niacin: 18, vitamin_b6_mg: 1.9, folate: 600, vitamin_b12: 2.6, pantothenic_acid: 6, biotin: 30, calcium: 1000, chromium: 30, copper_ug: 1000, iodine: 220, iron: 27, magnesium: 360, manganese: 2.0, molybdenum: 50, phosphorus: 700, selenium: 60, zinc: 11 }) },

  // ── Madres lactantes ──
  { population: 'lactating', ageMinYears: 0, ageMaxYears: 18, label: 'Madres lactantes ≤18 años', targets: g({ vitamin_a: 1200, vitamin_d: 5, vitamin_e: 19, vitamin_k: 75, vitamin_c: 115, thiamine: 1.4, riboflavin: 1.6, niacin: 17, vitamin_b6_mg: 2.0, folate: 500, vitamin_b12: 2.8, pantothenic_acid: 7, biotin: 35, calcium: 1300, chromium: 44, copper_ug: 1300, iodine: 290, iron: 10, magnesium: 360, manganese: 2.6, molybdenum: 50, phosphorus: 1250, selenium: 70, zinc: 14 }) },
  { population: 'lactating', ageMinYears: 19, ageMaxYears: 30, label: 'Madres lactantes 19-30 años', targets: g({ vitamin_a: 1300, vitamin_d: 5, vitamin_e: 19, vitamin_k: 90, vitamin_c: 120, thiamine: 1.4, riboflavin: 1.6, niacin: 17, vitamin_b6_mg: 2.0, folate: 500, vitamin_b12: 2.8, pantothenic_acid: 7, biotin: 35, calcium: 1000, chromium: 45, copper_ug: 1300, iodine: 290, iron: 9, magnesium: 310, manganese: 2.6, molybdenum: 50, phosphorus: 700, selenium: 70, zinc: 12 }) },
  { population: 'lactating', ageMinYears: 31, ageMaxYears: 50, label: 'Madres lactantes 31-50 años', targets: g({ vitamin_a: 1300, vitamin_d: 5, vitamin_e: 19, vitamin_k: 90, vitamin_c: 120, thiamine: 1.4, riboflavin: 1.6, niacin: 17, vitamin_b6_mg: 2.0, folate: 500, vitamin_b12: 2.8, pantothenic_acid: 7, biotin: 35, calcium: 1000, chromium: 45, copper_ug: 1300, iodine: 290, iron: 9, magnesium: 320, manganese: 2.6, molybdenum: 50, phosphorus: 700, selenium: 70, zinc: 12 }) },
];

export type RdiPatientInput = {
  ageYears: number | null;
  /** 'Masculino' | 'Femenino' u otras variantes; se normaliza internamente. */
  sex?: string | null;
  /** Estado fisiológico especial; tiene prioridad sobre sexo/edad estándar. */
  pregnant?: boolean;
  lactating?: boolean;
};

// El sexo se lee con el parser común de la app (lib/patients/sex): M masculino,
// F femenino, y las palabras completas en cualquier grafía. Antes había aquí una
// heurística propia —la quinta del proyecto— que además daba por MASCULINO todo
// lo que no empezara por "f": un sexo vacío o mal escrito recibía en silencio
// los objetivos de micronutrientes de un varón.
const sexOf = (sex?: string | null): 'M' | 'F' | null => normalizeSexRaw(sex);

/**
 * Devuelve el grupo RDI que corresponde al paciente (o null si no hay datos
 * suficientes, p. ej. sin edad). La prioridad es: lactancia → embarazo →
 * lactante/niño por edad → adulto por sexo+edad.
 */
export const findRdiGroup = (patient: RdiPatientInput): RdiGroup | null => {
  const { ageYears } = patient;
  if (ageYears == null) return null;

  const inRange = (population: RdiPopulation): RdiGroup | undefined =>
    RDI_GROUPS.find((group) => group.population === population && ageYears >= group.ageMinYears && ageYears <= group.ageMaxYears);

  if (patient.lactating) return inRange('lactating') ?? null;
  if (patient.pregnant) return inRange('pregnant') ?? null;
  if (ageYears < 1) return inRange('infant') ?? null;
  if (ageYears < 9) return inRange('child') ?? null;
  // Sin sexo legible no hay grupo: los objetivos de hierro y calcio difieren
  // tanto entre sexos que dar los de uno "por defecto" es peor que no dar nada.
  const sex = sexOf(patient.sex);
  if (!sex) return null;
  return (sex === 'F' ? inRange('female') : inRange('male')) ?? null;
};

/**
 * Objetivos RDI por clave de nutriente de alimento para el paciente dado.
 * Devuelve {} si no se puede clasificar (sin edad).
 */
export const getRdiTargets = (patient: RdiPatientInput): Record<string, number> => {
  return findRdiGroup(patient)?.targets ?? {};
};
