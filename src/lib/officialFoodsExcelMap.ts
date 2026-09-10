export type OfficialExcelField =
  | 'category'
  | 'name'
  | 'measure'
  | 'measure_grams'
  | 'portion_grams'
  | 'notes'
  | 'calories'
  | 'protein'
  | 'carbs'
  | 'available_carbs'
  | 'fat'
  | `nutrient:${string}`;

export function normalizeExcelHeader(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLabelUnit(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/** Plantilla header aliases → OPTIONAL_NUTRIENTS keys (explicit, no runtime import). */
const NUTRIENT_HEADER_ALIASES: ReadonlyArray<readonly [label: string, key: string]> = [
  ['Agua (g)', 'water'],
  ['Colesterol (mg)', 'cholesterol'],
  ['Fibra (g)', 'fiber'],
  ['Cenizas (g)', 'ashes'],
  ['Calcio (mg)', 'calcium'],
  ['Cobre (mg)', 'copper'],
  ['Vitamina B9 (ug)', 'folate'],
  ['Hierro (mg)', 'iron'],
  ['Magnesio (mg)', 'magnesium'],
  ['Manganeso (mg)', 'manganese'],
  ['Niacina (mg)', 'niacin'],
  ['Vitamina B5 (mg)', 'pantothenic_acid'],
  ['Fosforo (mg)', 'phosphorus'],
  ['Potasio (mg)', 'potassium'],
  ['Retinol (mcg)', 'retinol'],
  ['Riboflavina (mg)', 'riboflavin'],
  ['Selenio (mcg)', 'selenium'],
  ['Sodio (mg)', 'sodium'],
  ['Tiamina (mg)', 'thiamine'],
  ['Vitamina A (mcg)', 'vitamin_a'],
  ['Vitamina B12 (ug)', 'vitamin_b12'],
  ['Vitamina B6 (mcg)', 'vitamin_b6'],
  ['Vitamina C (mg)', 'vitamin_c'],
  ['Vitamina D (mcg)', 'vitamin_d'],
  ['Vitamina D2 (mcg)', 'vitamin_d2'],
  ['Vitamina D3 (mcg)', 'vitamin_d3'],
  ['Vitamina E (mg)', 'vitamin_e'],
  ['Vitamina K (mcg)', 'vitamin_k'],
  ['Vitamina B7 - Biotina (mcg)', 'biotin'],
  ['Zinc (mg)', 'zinc'],
  ['Yodo (mcg)', 'iodine'],
  ['Cromo (mcg)', 'chromium'],
  ['Molibdeno (mcg)', 'molybdenum'],
  ['Cloro (mg)', 'chloride'],
  ['Azufre (mg)', 'sulfur'],
  ['Boro (mg)', 'boron'],
  ['Indice Glucemico (IG)', 'glycemic_index'],
  ['Carga Glucemica (CG)', 'glycemic_load'],
  ['Densidad Energetica (kcal/g)', 'energy_density'],
  ['Fibra Soluble (g)', 'soluble_fiber'],
  ['Fibra Insoluble (g)', 'insoluble_fiber'],
  ['Alcohol (g)', 'alcohol'],
  ['Grasa monoinsaturada (g)', 'mufa'],
  ['Grasa poliinsaturada (g)', 'pufa'],
  ['Grasa saturada (g)', 'saturated_fat'],
  ['Grasas trans (g)', 'trans_fat'],
  ['Omega-3 Total (g)', 'omega3_total'],
  ['EPA - Acido eicosapentaenoico (g)', 'epa'],
  ['DHA - Acido docosahexaenoico (g)', 'dha'],
  ['ALA - Acido alfa-linolenico (g)', 'ala'],
  ['Omega-6 Total (g)', 'omega6_total'],
  ['Acido Linoleico (g)', 'linoleic_acid'],
  ['Relacion Omega-6 / Omega-3', 'omega6_omega3_ratio'],
  ['Fructosa (g)', 'fructose'],
  ['Glucosa (g)', 'glucose'],
  ['Lactosa (g)', 'lactose'],
  ['Sorbitol (g)', 'sorbitol'],
  ['Manitol (g)', 'mannitol'],
  ['Rafinosa (g)', 'raffinose'],
  ['Estaquiosa (g)', 'stachyose'],
  ['Nistosa (g)', 'nystose'],
  ['Kestosa (g)', 'kestose'],
  ['Galactosa (g)', 'galactose'],
  ['Maltosa (g)', 'maltose'],
  ['Almidon (g)', 'starch'],
  ['Sacarosa (g)', 'sucrose'],
  ['Acido Aspartico (g)', 'aspartic_acid'],
  ['Treonina (g)', 'threonine'],
  ['Serina (g)', 'serine'],
  ['Acido Glutamico (g)', 'glutamic_acid'],
  ['Prolina (g)', 'proline'],
  ['Glicina (g)', 'glycine'],
  ['Alanina (g)', 'alanine'],
  ['Cisteina (g)', 'cysteine'],
  ['Valina (g)', 'valine'],
  ['Metionina (g)', 'methionine'],
  ['Isoleucina (g)', 'isoleucine'],
  ['Leucina (g)', 'leucine'],
  ['Tirosina (g)', 'tyrosine'],
  ['Fenilalanina (g)', 'phenylalanine'],
  ['Histidina (g)', 'histidine'],
  ['Lisina (g)', 'lysine'],
  ['Arginina (g)', 'arginine'],
  ['Triptofano (g)', 'tryptophan'],
  ['Alfa caroteno (ug)', 'alpha_carotene'],
  ['Beta caroteno (mcg)', 'beta_carotene'],
  ['Colina (mg)', 'choline'],
  ['Criptoxantina Beta (mcg)', 'beta_cryptoxanthin'],
  ['Fluoruro (mcg)', 'fluoride'],
  ['Luteina Zeaxantina (mcg)', 'lutein_zeaxanthin'],
  ['Licopeno (mcg)', 'lycopene'],
  ['Cafeina (mg)', 'caffeine'],
  ['Teobromina (mg)', 'theobromine'],
  ['Polifenoles totales (mg)', 'polyphenols'],
  ['Flavonoides (mg)', 'flavonoids'],
  ['Oxalatos (mg)', 'oxalates'],
  ['Purinas (mg)', 'purines'],
];

const CORE_FIELD_ALIASES: Record<string, OfficialExcelField> = {
  alimento: 'name',
  categoria: 'category',
  'medida casera': 'measure',
  'gramos o ml de la medida casera': 'measure_grams',
  porcion_gramos: 'portion_grams',
  calorias: 'calories',
  proteinas: 'protein',
  carbohidratos: 'carbs',
  'carbohidratos totales': 'carbs',
  'carbohidratos disponibles': 'available_carbs',
  grasas: 'fat',
  'grasas total': 'fat',
  notas: 'notes',
};

function buildOfficialExcelFieldMap(): Record<string, OfficialExcelField> {
  const map: Record<string, OfficialExcelField> = { ...CORE_FIELD_ALIASES };

  for (const [label, key] of NUTRIENT_HEADER_ALIASES) {
    const nutrientField = `nutrient:${key}` as OfficialExcelField;
    map[normalizeExcelHeader(label)] = nutrientField;
    map[normalizeExcelHeader(stripLabelUnit(label))] = nutrientField;
  }

  return map;
}

const OFFICIAL_EXCEL_FIELD_BY_HEADER = buildOfficialExcelFieldMap();

export function resolveOfficialExcelField(header: unknown): OfficialExcelField | null {
  const normalized = normalizeExcelHeader(header);
  if (!normalized) {
    return null;
  }

  return OFFICIAL_EXCEL_FIELD_BY_HEADER[normalized] ?? null;
}
