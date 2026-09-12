// Configuración y helpers puros del detalle de consulta antropométrica (sin
// React). Extraídos de ConsultDetail.jsx: estructura de pestañas/secciones,
// metadatos por campo (rangos ISAK, badges 4C/5C) y utilidades ISAK/conteo.

// Limita a máximo 2 decimales al parsear una medición ingresada por el usuario.
export const parseNum2 = (raw) => {
  if (raw === "" || raw === null || raw === undefined) return null;
  const v = parseFloat(raw);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
};

export const GROUPS = [
  {
    key: "antro",
    label: "Antropometría",
    tabs: [
      { key: "peso", label: "Peso / talla" },
      { key: "bio",  label: "Bioimpedancia" },
      { key: "per",  label: "Perímetros" },
      { key: "pli",  label: "Pliegues" },
      { key: "dia",  label: "Diámetros" },
      { key: "res",  label: "Resultados" },
    ],
  },
  {
    key: "cal",
    label: "Calorías",
    tabs: [{ key: "cal", label: "Calorías" }],
  },
  {
    key: "bioq",
    label: "Bioquímica",
    tabs: [{ key: "bioq", label: "Bioquímica" }],
  },
  {
    key: "dietetica",
    label: "Dietética",
    tabs: [{ key: "dietetica", label: "Recordatorio 24h" }],
  },
  {
    key: "dieta",
    label: "Dieta",
    tabs: [
      { key: "alimentos", label: "Alimentos" },
      { key: "intercambios", label: "Intercambios" },
      { key: "artificial", label: "Artificial" },
    ],
  },
];

export const TABS = GROUPS.flatMap(g => g.tabs);
export const TAB_KEYS = TABS.map(t => t.key);
export const ANTRO_GROUP = GROUPS.find((g) => g.key === "antro");
export const ANTRO_TAB_KEYS = ANTRO_GROUP?.tabs.map((t) => t.key) || [];
export const MEASURE_TAB_KEYS = ANTRO_TAB_KEYS.filter((k) => k !== "res");

export const SECTIONS = {
  peso: [
    {
      title: "Medidas básicas",
      fields: [
        ["weight",         "Peso",         "kg"],
        ["height",         "Talla",        "cm"],
        ["height_sitting", "Talla sentado","cm"],
      ],
    },
  ],
  bio: [
    {
      title: "Bioimpedancia",
      fields: [
        ["fat_total",    "Grasa total",               "%"],
        ["fat_upper",    "Grasa sección superior",    "%"],
        ["fat_lower",    "Grasa sección inferior",    "%"],
        ["visceral_fat", "Grasa visceral",            "rating"],
        ["lean_mass",    "Masa libre de grasa",       "kg"],
        ["muscle_mass",  "Masa muscular",             "kg"],
        ["bone_mass",    "Peso óseo",                 "kg"],
        ["body_water",   "Agua corporal",             "%"],
        ["metabolic_age","Edad metabólica",           "años"],
      ],
    },
  ],
  per: [
    {
      title: "Cabeza y cuello",
      fields: [
        ["cephalic", "Cefálico", "cm"],
        ["neck",     "Cuello",   "cm"],
      ],
    },
    {
      title: "Tronco",
      fields: [
        ["mesosternal",   "Mesoesternal",        "cm"],
        ["umbilical",     "Umbilical",            "cm"],
        ["abdominal_per", "Perímetro Abdominal",  "cm"],
        ["waist",         "Cintura",              "cm"],
        ["hip",           "Cadera",               "cm"],
      ],
    },
    {
      title: "Extremidades superiores",
      fields: [
        ["arm_relaxed",    "Perímetro del brazo",           "cm"],
        ["arm_contracted", "Perímetro del brazo contraído", "cm"],
        ["forearm",        "Antebrazo",                 "cm"],
        ["wrist",          "Muñeca",                    "cm"],
      ],
    },
    {
      title: "Extremidades inferiores",
      fields: [
        ["thigh_1cm",  "Muslo (1cm)",  "cm"],
        ["thigh_mid",  "Muslo medio",  "cm"],
        ["calf",       "Pantorrilla",  "cm"],
        ["ankle",      "Tobillo",      "cm"],
      ],
    },
  ],
  pli: [
    {
      title: "Tronco",
      fields: [
        ["subscapular",   "Subescapular", "mm"],
        ["iliac_crest",   "Suprailíaco",  "mm"],
        ["supraspinal",   "Supraespinal", "mm"],
        ["abdominal",     "Abdominal",    "mm"],
        ["medial_axillar","Axilar medial","mm"],
        ["pectoral",      "Pectoral",     "mm"],
      ],
    },
    {
      title: "Extremidades",
      fields: [
        ["triceps",    "Tríceps",           "mm"],
        ["biceps",     "Bíceps",            "mm"],
        ["front_thigh","Muslo frontal",      "mm"],
        ["medial_calf","Pantorrilla media", "mm"],
      ],
    },
  ],
  dia: [
    {
      title: "Diámetros",
      fields: [
        ["biacromial",             "Biacromial",                "cm"],
        ["biiliocrestal",          "Biiliocrestal",             "cm"],
        ["foot_length",            "Longitud del pie",          "cm"],
        ["thorax_transverse",      "Transverso del tórax",      "cm"],
        ["thorax_anteroposterior", "Anteroposterior del tórax", "cm"],
        ["humerus",                "Húmero",                    "cm"],
        ["wrist_bistyloid",        "Bistiloideo de la muñeca",  "cm"],
        ["femur",                  "Fémur",                     "cm"],
        ["bimalleolar",            "Bimaleolar",                "cm"],
      ],
    },
  ],
};

export const TAB_PATH = { peso: null, bio: "bioimpedance", per: "perimeters", pli: "skinfolds", dia: "diameters" };
export const GROUP_ACCENTS = {
  datos: "border-brand-500 text-brand-500",
  antro: "border-brand-500 text-brand-500",
  cal: "border-[#16a34a] text-[#16a34a]",
  bioq: "border-coral-500 text-coral-700",
  dietetica: "border-brand-500 text-brand-700",
  dieta: "border-coral-500 text-coral-700",
};

// ── Metadatos por campo: rangos fisiológicos plausibles + flags de requisito
// para los modelos de 4-comp (clásico Durnin-Womersley + Rocha + Würch + Matiegka)
// y 5-comp (Kerr 1988 · Phantom). Se usan para:
//   • placeholder con rango sugerido,
//   • borde ámbar si el valor cae fuera del rango plausible,
//   • badges "4C"/"5C" indicando obligatoriedad para cada modelo,
//   • tooltip con `hint` para campos confundibles (ej. diámetro vs perímetro).
// Unidades: peso=kg, talla/perímetros/diámetros=cm, pliegues=mm.
export const FIELD_META = {
  // Peso / Talla. ISAK Nivel 1: tomar 2 mediciones (3 si difieren); TEM ≤ 1%
  // para tallas y ≤ 0.5% para peso. Usamos 1% como umbral común conservador,
  // que sigue siendo aceptable para peso en condiciones clínicas reales.
  weight:         { min: 20,  max: 300, plausibleMin: 35,  plausibleMax: 200, req4: true, req5: true, isak: true, temPct: 1 },
  height:         { min: 100, max: 230, plausibleMin: 140, plausibleMax: 210, req4: true, req5: true, isak: true, temPct: 1 },
  height_sitting: { min: 50,  max: 140, plausibleMin: 75,  plausibleMax: 110, req5: true, isak: true, temPct: 1 },

  // Perímetros (cinta métrica). ISAK Nivel 1: TEM ≤ 1% entre repeticiones.
  cephalic:    { min: 40, max: 70,  plausibleMin: 50, plausibleMax: 62,  req5: true, isak: true, temPct: 1 },
  neck:        { min: 25, max: 60,  plausibleMin: 30, plausibleMax: 50 },
  mesosternal: { min: 50, max: 140, plausibleMin: 75, plausibleMax: 115, req5: true, isak: true, temPct: 1,
                 hint: "Perímetro torácico al final de espiración normal, a la altura del 4º espacio intercostal." },
  umbilical:    { min: 50, max: 180, plausibleMin: 65, plausibleMax: 130 },
  abdominal_per: { min: 50, max: 180, plausibleMin: 60, plausibleMax: 140, req5: true, isak: true, temPct: 1,
                   hint: "Punto medio entre el borde costal inferior y la cresta ilíaca anterosuperior. Indicador de riesgo metabólico (OMS 2000)." },
  waist:        { min: 50, max: 180, plausibleMin: 60, plausibleMax: 130, req5: true, isak: true, temPct: 1 },
  hip:         { min: 60, max: 180, plausibleMin: 80, plausibleMax: 140 },
  arm_relaxed: { min: 15, max: 55,  plausibleMin: 22, plausibleMax: 42,  req5: true, isak: true, temPct: 1 },
  arm_contracted: { min: 15, max: 60, plausibleMin: 23, plausibleMax: 45 },
  forearm:     { min: 15, max: 40,  plausibleMin: 20, plausibleMax: 32,  req5: true, isak: true, temPct: 1 },
  wrist:       { min: 10, max: 25,  plausibleMin: 13, plausibleMax: 20 },
  thigh_1cm:   { min: 25, max: 90,  plausibleMin: 35, plausibleMax: 75 },
  thigh_mid:   { min: 25, max: 90,  plausibleMin: 35, plausibleMax: 70,  req5: true, isak: true, temPct: 1 },
  calf:        { min: 20, max: 55,  plausibleMin: 28, plausibleMax: 45,  req5: true, isak: true, temPct: 1 },
  ankle:       { min: 15, max: 35,  plausibleMin: 18, plausibleMax: 28 },

  // Pliegues (plicómetro, mm). ISAK Nivel 1: TEM ≤ 5%.
  subscapular:    { min: 2, max: 60, plausibleMin: 4, plausibleMax: 35, req4: true, req5: true, isak: true, temPct: 5 },
  iliac_crest:    { min: 2, max: 60, plausibleMin: 4, plausibleMax: 40, req4: true, isak: true, temPct: 5 },
  supraspinal:    { min: 2, max: 50, plausibleMin: 3, plausibleMax: 30, req5: true, isak: true, temPct: 5 },
  abdominal:      { min: 2, max: 70, plausibleMin: 4, plausibleMax: 45, req5: true, isak: true, temPct: 5 },
  medial_axillar: { min: 2, max: 50, plausibleMin: 4, plausibleMax: 30 },
  pectoral:       { min: 2, max: 50, plausibleMin: 3, plausibleMax: 30 },
  triceps:        { min: 2, max: 50, plausibleMin: 3, plausibleMax: 35, req4: true, req5: true, isak: true, temPct: 5 },
  biceps:         { min: 2, max: 30, plausibleMin: 2, plausibleMax: 20, req4: true, isak: true, temPct: 5 },
  front_thigh:    { min: 2, max: 60, plausibleMin: 4, plausibleMax: 40, req5: true, isak: true, temPct: 5 },
  medial_calf:    { min: 2, max: 40, plausibleMin: 3, plausibleMax: 25, req5: true, isak: true, temPct: 5 },

  // Diámetros (paquímetro/calibrador, cm). ISAK Nivel 1: TEM ≤ 1%.
  biacromial:             { min: 25,  max: 50, plausibleMin: 30,  plausibleMax: 45,  req5: true, isak: true, temPct: 1 },
  biiliocrestal:          { min: 18,  max: 40, plausibleMin: 22,  plausibleMax: 35,  req5: true, isak: true, temPct: 1 },
  foot_length:            { min: 18,  max: 32, plausibleMin: 21,  plausibleMax: 30 },
  thorax_transverse:      { min: 18,  max: 40, plausibleMin: 22,  plausibleMax: 35,  req5: true, isak: true, temPct: 1 },
  thorax_anteroposterior: { min: 12,  max: 30, plausibleMin: 14,  plausibleMax: 25,  req5: true, isak: true, temPct: 1 },
  humerus:                { min: 4,   max: 10, plausibleMin: 5,   plausibleMax: 8.5, req5: true, isak: true, temPct: 1 },
  wrist_bistyloid:        { min: 3.5, max: 8,  plausibleMin: 4.2, plausibleMax: 7,   req4: true, req5: true, isak: true, temPct: 1,
                            hint: "ANCHO con paquímetro entre apófisis estiloides del radio y cúbito (no perímetro). Adulto: ~5–7 cm." },
  femur:                  { min: 6,   max: 13, plausibleMin: 7,   plausibleMax: 11,  req4: true, req5: true, isak: true, temPct: 1,
                            hint: "ANCHO con paquímetro entre cóndilos medial y lateral del fémur (no perímetro). Adulto: ~8–10 cm." },
  bimalleolar:            { min: 4,   max: 10, plausibleMin: 5,   plausibleMax: 9 },
};

export const DEFAULT_MEALS = [
  { id: 1, time: "08:00", name: "Desayuno", content: "" },
  { id: 2, time: "13:00", name: "Almuerzo", content: "" },
];

// ISAK: protocolo estándar de antropometría exige tomar 2 mediciones por sitio
// y, si difieren más del límite técnico (TEM), una tercera; el valor final es
// la MEDIANA cuando hay 3 y la MEDIA cuando hay 2.
export function computeFinalISAK(values) {
  const nums = (values || [])
    .filter(v => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)))
    .map(Number);
  if (nums.length === 0) return null;
  if (nums.length === 1) return nums[0];
  if (nums.length === 2) return +((nums[0] + nums[1]) / 2).toFixed(2);
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]; // mediana
}

// TEM relativo (%) = (rango / media) × 100. Indicador de consistencia entre
// mediciones repetidas. ISAK Nivel 1 acepta ≤5% para pliegues, ≤1% para
// perímetros y diámetros. Devuelve null si hay menos de 2 mediciones válidas.
export function computeTEM(values) {
  const nums = (values || [])
    .filter(v => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)))
    .map(Number);
  if (nums.length < 2) return null;
  const mean = nums.reduce((s, n) => s + n, 0) / nums.length;
  if (mean === 0) return 0;
  const range = Math.max(...nums) - Math.min(...nums);
  return +((range / mean) * 100).toFixed(1);
}

export function countFilled(tabKey, data) {
  const path = TAB_PATH[tabKey];
  const sections = SECTIONS[tabKey] || [];
  const allFields = sections.flatMap(s => s.fields);
  const src = path ? (data[path] || {}) : data;
  return allFields.filter(([key]) => src[key] !== null && src[key] !== undefined && src[key] !== "").length;
}

// Cuenta los campos requeridos para un modelo (req4|req5) que ya están llenos.
// Permite mostrar progreso en la barra lateral con verde cuando ambos modelos
// tienen toda su información mínima cubierta.
export function countRequired(tabKey, data, flag) {
  const path = TAB_PATH[tabKey];
  const sections = SECTIONS[tabKey] || [];
  const allFields = sections.flatMap(s => s.fields);
  const src = path ? (data[path] || {}) : data;
  const reqKeys = allFields.filter(([key]) => FIELD_META[key]?.[flag]).map(([k]) => k);
  if (reqKeys.length === 0) return { filled: 0, total: 0 };
  const filled = reqKeys.filter(k => src[k] !== null && src[k] !== undefined && src[k] !== "").length;
  return { filled, total: reqKeys.length };
}
