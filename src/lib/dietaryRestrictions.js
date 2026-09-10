// Deriva las restricciones dietéticas de un paciente a partir de sus diagnósticos
// e intolerancias/alergias alimentarias. Función PURA y única fuente de verdad:
// la consumen la ficha, los editores de dieta y el contexto del asistente IA, de
// modo que nunca se descuadran entre pantallas.
//
// IMPORTANTE: este módulo se mantiene en JS plano (sin alias `@/`, sin TS) porque
// lo importa `src/lib/ai/patientContext.js`, que a su vez se ejecuta en el runtime
// Node del backend (`api/ai/*`) mediante rutas relativas. Un import con alias o a
// un `.ts` rompería ahí.

/**
 * @typedef {'diagnosis' | 'intolerancia' | 'alergia'} RestrictionSource
 * @typedef {{ label: string, detail?: string, source: RestrictionSource, origin: string }} DietaryRestriction
 */

const normalize = (value) =>
  String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Tabla de reglas condicionales: si el nombre normalizado del diagnóstico contiene
// alguno de los `keywords`, se agrega la restricción. `exclude` evita solapes
// (p. ej. "diabetes insípida" no debe activar la de diabetes mellitus).
const DIAGNOSIS_RULES = [
  { keywords: ['hipertension', 'hta', 'presion alta'], label: 'Hiposódica', detail: 'Baja en sodio', origin: 'HTA' },
  { keywords: ['dislipidemia', 'colesterol', 'hipercolesterol', 'trigliceridos'], label: 'Baja en grasa saturada', detail: 'Control de lípidos', origin: 'Dislipidemia' },
  { keywords: ['higado graso', 'ehgna', 'esteatosis', 'hepatico graso'], label: 'Baja en azúcares y grasa', detail: 'Manejo de hígado graso', origin: 'Hígado graso' },
  { keywords: ['diabetes'], exclude: ['insipida'], label: 'Control de carbohidratos', detail: 'Distribución y tipo de CHO', origin: 'Diabetes' },
  { keywords: ['resistencia insulin', 'resistencia a la insulina', 'insulinorresistencia'], label: 'Bajo índice glucémico', detail: 'Preferir bajo IG', origin: 'Resist. insulínica' },
  { keywords: ['sop', 'ovario poliquistico', 'ovarico poliquistico', 'poliquistico'], label: 'Bajo índice glucémico', detail: 'Preferir bajo IG', origin: 'SOP' },
  { keywords: ['hiperuricemia', 'gota', 'acido urico'], label: 'Baja en purinas', detail: 'Limitar purinas', origin: 'Hiperuricemia' },
  { keywords: ['renal', 'insuficiencia renal', 'erc', 'nefropat'], label: 'Baja en proteína y potasio', detail: 'Ajuste renal', origin: 'Enf. renal' },
  { keywords: ['celiac', 'celiaqu'], label: 'Sin gluten', detail: 'Exclusión estricta de gluten', origin: 'Celiaquía' },
];

const parsePathologies = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  return String(value).split(',').map((part) => part.trim()).filter(Boolean);
};

/**
 * Calcula las restricciones dietéticas del paciente.
 * Fuentes:
 *  - Diagnósticos → vía tabla de reglas condicionales (DIAGNOSIS_RULES).
 *  - Intolerancias/alergias alimentarias → 1:1 como "Sin {alimento}".
 * Se deduplican por etiqueta; si dos diagnósticos generan la misma, sale una sola
 * combinando los orígenes.
 * @param {{ health_conditions?: any } | null | undefined} patient
 * @returns {DietaryRestriction[]}
 */
export const deriveDietaryRestrictions = (patient) => {
  const hc = (patient && patient.health_conditions) || {};
  /** @type {Map<string, DietaryRestriction>} */
  const byLabel = new Map();

  const add = (restriction) => {
    const key = normalize(restriction.label);
    const existing = byLabel.get(key);
    if (existing) {
      const origins = existing.origin.split(' · ');
      if (!origins.includes(restriction.origin)) {
        existing.origin = [...origins, restriction.origin].join(' · ');
      }
      return;
    }
    byLabel.set(key, { ...restriction });
  };

  // 1) Diagnósticos → reglas condicionales
  parsePathologies(hc.current_pathologies).forEach((name) => {
    const normalized = normalize(name);
    DIAGNOSIS_RULES.forEach((rule) => {
      const hit = rule.keywords.some((keyword) => normalized.includes(keyword));
      const blocked = (rule.exclude || []).some((keyword) => normalized.includes(keyword));
      if (hit && !blocked) {
        add({ label: rule.label, detail: rule.detail, source: 'diagnosis', origin: rule.origin });
      }
    });
  });

  // 2) Intolerancias / alergias alimentarias → 1:1
  const foods = Array.isArray(hc.food_intolerances) ? hc.food_intolerances : [];
  foods.forEach((food) => {
    const name = ((food && food.name) || '').trim();
    if (!name) return;
    const isAllergy = food && food.kind === 'alergia';
    add({
      label: `Sin ${name.toLowerCase()}`,
      source: isAllergy ? 'alergia' : 'intolerancia',
      origin: isAllergy ? 'Alergia' : 'Intol.',
    });
  });

  return Array.from(byLabel.values());
};

/**
 * Versión compacta en texto plano para prompts del asistente IA.
 * Ej.: "Hiposódica (HTA); Sin lactosa (Intol.); Sin mariscos (Alergia)"
 * @param {DietaryRestriction[]} restrictions
 * @returns {string}
 */
export const formatDietaryRestrictionsForAI = (restrictions) =>
  (restrictions || []).map((r) => `${r.label} (${r.origin})`).join('; ');
