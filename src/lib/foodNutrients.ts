export type FoodNutrientDefinition = {
  key: string;
  label: string;
  unit: string;
};

type FoodLike = Record<string, unknown>;

export const FIXED_NUTRIENTS: FoodNutrientDefinition[] = [
  { key: 'calories', label: 'Calorias (kcal)', unit: 'kcal' },
  { key: 'protein', label: 'Proteinas (g)', unit: 'g' },
  { key: 'available_carbs', label: 'Carbohidratos (g)', unit: 'g' },
  { key: 'fat', label: 'Grasas (g)', unit: 'g' },
];

// El orden dgit add .e esta lista es el que el usuario verá en el selector
// "Añadir otro nutriente" del modal de alimentos. Sigue el listado de
// referencia clínico aprobado: macros y minerales primero, vitaminas,
// índices clínicos, lípidos, azúcares (incluidos polialcoholes y
// oligosacáridos), aminoácidos, carotenoides y por último compuestos
// bioactivos / antinutrientes. NO ordenar alfabéticamente.
export const OPTIONAL_NUTRIENTS: FoodNutrientDefinition[] = [
  // — Hidratación / sub-macros —
  { key: 'water', label: 'Agua (g)', unit: 'g' },
  { key: 'cholesterol', label: 'Colesterol (mg)', unit: 'mg' },
  { key: 'fiber', label: 'Fibra (g)', unit: 'g' },
  { key: 'ashes', label: 'Cenizas (g)', unit: 'g' },
  // — Minerales mayores —
  { key: 'calcium', label: 'Calcio (mg)', unit: 'mg' },
  { key: 'copper', label: 'Cobre (mg)', unit: 'mg' },
  { key: 'folate', label: 'Vitamina B9 (ug)', unit: 'ug' },
  { key: 'iron', label: 'Hierro (mg)', unit: 'mg' },
  { key: 'magnesium', label: 'Magnesio (mg)', unit: 'mg' },
  { key: 'manganese', label: 'Manganeso (mg)', unit: 'mg' },
  { key: 'niacin', label: 'Niacina (mg)', unit: 'mg' },
  { key: 'pantothenic_acid', label: 'Vitamina B5 (mg)', unit: 'mg' },
  { key: 'phosphorus', label: 'Fosforo (mg)', unit: 'mg' },
  { key: 'potassium', label: 'Potasio (mg)', unit: 'mg' },
  { key: 'retinol', label: 'Retinol (mcg)', unit: 'mcg' },
  { key: 'riboflavin', label: 'Riboflavina (mg)', unit: 'mg' },
  { key: 'selenium', label: 'Selenio (mcg)', unit: 'mcg' },
  { key: 'sodium', label: 'Sodio (mg)', unit: 'mg' },
  { key: 'thiamine', label: 'Tiamina (mg)', unit: 'mg' },
  // — Vitaminas —
  { key: 'vitamin_a', label: 'Vitamina A (mcg)', unit: 'mcg' },
  { key: 'vitamin_b12', label: 'Vitamina B12 (ug)', unit: 'ug' },
  { key: 'vitamin_b6', label: 'Vitamina B6 (mcg)', unit: 'mcg' },
  { key: 'vitamin_c', label: 'Vitamina C (mg)', unit: 'mg' },
  { key: 'vitamin_d', label: 'Vitamina D (mcg)', unit: 'mcg' },
  { key: 'vitamin_d2', label: 'Vitamina D2 (mcg)', unit: 'mcg' },
  { key: 'vitamin_d3', label: 'Vitamina D3 (mcg)', unit: 'mcg' },
  { key: 'vitamin_e', label: 'Vitamina E (mg)', unit: 'mg' },
  { key: 'vitamin_k', label: 'Vitamina K (mcg)', unit: 'mcg' },
  { key: 'biotin', label: 'Vitamina B7 - Biotina (mcg)', unit: 'mcg' },
  // — Minerales traza —
  { key: 'zinc', label: 'Zinc (mg)', unit: 'mg' },
  { key: 'iodine', label: 'Yodo (mcg)', unit: 'mcg' },
  { key: 'chromium', label: 'Cromo (mcg)', unit: 'mcg' },
  { key: 'molybdenum', label: 'Molibdeno (mcg)', unit: 'mcg' },
  { key: 'chloride', label: 'Cloro (mg)', unit: 'mg' },
  { key: 'sulfur', label: 'Azufre (mg)', unit: 'mg' },
  { key: 'boron', label: 'Boro (mg)', unit: 'mg' },
  // — Índices clínicos / energía —
  { key: 'glycemic_index', label: 'Indice Glucemico (IG)', unit: '' },
  { key: 'glycemic_load', label: 'Carga Glucemica (CG)', unit: '' },
  { key: 'energy_density', label: 'Densidad Energetica (kcal/g)', unit: 'kcal/g' },
  // — Fibras y otros componentes —
  { key: 'soluble_fiber', label: 'Fibra Soluble (g)', unit: 'g' },
  { key: 'insoluble_fiber', label: 'Fibra Insoluble (g)', unit: 'g' },
  { key: 'alcohol', label: 'Alcohol (g)', unit: 'g' },
  // — Lípidos detallados —
  { key: 'mufa', label: 'Grasa monoinsaturada (g)', unit: 'g' },
  { key: 'pufa', label: 'Grasa poliinsaturada (g)', unit: 'g' },
  { key: 'saturated_fat', label: 'Grasa saturada (g)', unit: 'g' },
  { key: 'trans_fat', label: 'Grasas trans (g)', unit: 'g' },
  { key: 'omega3_total', label: 'Omega-3 Total (g)', unit: 'g' },
  { key: 'epa', label: 'EPA - Acido eicosapentaenoico (g)', unit: 'g' },
  { key: 'dha', label: 'DHA - Acido docosahexaenoico (g)', unit: 'g' },
  { key: 'ala', label: 'ALA - Acido alfa-linolenico (g)', unit: 'g' },
  { key: 'omega6_total', label: 'Omega-6 Total (g)', unit: 'g' },
  { key: 'linoleic_acid', label: 'Acido Linoleico (g)', unit: 'g' },
  { key: 'omega6_omega3_ratio', label: 'Relacion Omega-6 / Omega-3', unit: '' },
  // — Azúcares simples + polialcoholes + oligosacáridos —
  // Los seis siguientes (sorbitol/manitol/rafinosa/estaquiosa/nistosa/kestosa)
  // son nuevos en el catálogo: clínicamente relevantes para protocolos
  // FODMAP y SIBO.
  { key: 'fructose', label: 'Fructosa (g)', unit: 'g' },
  { key: 'glucose', label: 'Glucosa (g)', unit: 'g' },
  { key: 'lactose', label: 'Lactosa (g)', unit: 'g' },
  { key: 'sorbitol', label: 'Sorbitol (g)', unit: 'g' },
  { key: 'mannitol', label: 'Manitol (g)', unit: 'g' },
  { key: 'raffinose', label: 'Rafinosa (g)', unit: 'g' },
  { key: 'stachyose', label: 'Estaquiosa (g)', unit: 'g' },
  { key: 'nystose', label: 'Nistosa (g)', unit: 'g' },
  { key: 'kestose', label: 'Kestosa (g)', unit: 'g' },
  { key: 'galactose', label: 'Galactosa (g)', unit: 'g' },
  { key: 'maltose', label: 'Maltosa (g)', unit: 'g' },
  { key: 'starch', label: 'Almidon (g)', unit: 'g' },
  { key: 'sucrose', label: 'Sacarosa (g)', unit: 'g' },
  // — Aminoácidos —
  { key: 'aspartic_acid', label: 'Acido Aspartico (g)', unit: 'g' },
  { key: 'threonine', label: 'Treonina (g)', unit: 'g' },
  { key: 'serine', label: 'Serina (g)', unit: 'g' },
  { key: 'glutamic_acid', label: 'Acido Glutamico (g)', unit: 'g' },
  { key: 'proline', label: 'Prolina (g)', unit: 'g' },
  { key: 'glycine', label: 'Glicina (g)', unit: 'g' },
  { key: 'alanine', label: 'Alanina (g)', unit: 'g' },
  { key: 'cysteine', label: 'Cisteina (g)', unit: 'g' },
  { key: 'valine', label: 'Valina (g)', unit: 'g' },
  { key: 'methionine', label: 'Metionina (g)', unit: 'g' },
  { key: 'isoleucine', label: 'Isoleucina (g)', unit: 'g' },
  { key: 'leucine', label: 'Leucina (g)', unit: 'g' },
  { key: 'tyrosine', label: 'Tirosina (g)', unit: 'g' },
  { key: 'phenylalanine', label: 'Fenilalanina (g)', unit: 'g' },
  { key: 'histidine', label: 'Histidina (g)', unit: 'g' },
  { key: 'lysine', label: 'Lisina (g)', unit: 'g' },
  { key: 'arginine', label: 'Arginina (g)', unit: 'g' },
  { key: 'tryptophan', label: 'Triptofano (g)', unit: 'g' },
  // — Carotenoides y compuestos liposolubles —
  { key: 'alpha_carotene', label: 'Alfa caroteno (ug)', unit: 'ug' },
  { key: 'beta_carotene', label: 'Beta caroteno (mcg)', unit: 'mcg' },
  { key: 'choline', label: 'Colina (mg)', unit: 'mg' },
  { key: 'beta_cryptoxanthin', label: 'Criptoxantina Beta (mcg)', unit: 'mcg' },
  { key: 'fluoride', label: 'Fluoruro (mcg)', unit: 'mcg' },
  { key: 'lutein_zeaxanthin', label: 'Luteina Zeaxantina (mcg)', unit: 'mcg' },
  { key: 'lycopene', label: 'Licopeno (mcg)', unit: 'mcg' },
  // — Bioactivos / antinutrientes —
  { key: 'caffeine', label: 'Cafeina (mg)', unit: 'mg' },
  { key: 'theobromine', label: 'Teobromina (mg)', unit: 'mg' },
  { key: 'polyphenols', label: 'Polifenoles totales (mg)', unit: 'mg' },
  { key: 'flavonoids', label: 'Flavonoides (mg)', unit: 'mg' },
  { key: 'oxalates', label: 'Oxalatos (mg)', unit: 'mg' },
  { key: 'purines', label: 'Purinas (mg)', unit: 'mg' },
];

export const DEFAULT_MICRONUTRIENT_TARGETS: Record<string, number> = {
  fiber: 25,
  sodium: 2300,
  vitamin_c: 90,
  calcium: 1000,
  iron: 18,
  vitamin_d: 15,
  vitamin_b12: 2.4,
  potassium: 4700,
  magnesium: 400,
  zinc: 11,
};

export const PRIMARY_MICRONUTRIENT_KEYS = ['fiber', 'sodium'];

export const EXTENDED_MICRONUTRIENT_KEYS = [
  'vitamin_c',
  'calcium',
  'iron',
  'vitamin_d',
  'vitamin_b12',
  'potassium',
  'magnesium',
  'zinc',
];

const NUTRIENT_DEFINITIONS_BY_KEY = OPTIONAL_NUTRIENTS.reduce<Record<string, FoodNutrientDefinition>>((accumulator, nutrient) => {
  accumulator[nutrient.key] = nutrient;
  return accumulator;
}, {});

const roundToDecimals = (value: number, decimals = 4): number => {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
};

const toFiniteNumber = (value: unknown): number | null => {
  if (value == null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getFoodPortionGrams = (food: FoodLike): number => {
  const portionGrams = toFiniteNumber(food.portion_grams);
  return portionGrams && portionGrams > 0 ? portionGrams : 100;
};

export const getFoodMacroValue = (
  food: FoodLike,
  key: 'calories' | 'protein' | 'carbs' | 'fat',
): number | null => {
  const directValue = toFiniteNumber(food[key]);
  if (directValue != null) {
    return directValue;
  }

  if (key === 'carbs') {
    return getFoodNutrientValue(food, 'available_carbs');
  }

  // Compatibilidad con importaciones antiguas donde la columna "calorias"
  // terminó guardada en calories_kj por una colisión de alias ya corregida.
  if (key === 'calories') {
    return getFoodNutrientValue(food, 'calories_kj');
  }

  return null;
};

// Vista de macros expuesta de manera explícita para que los consumidores
// (tablas, modales) accedan a calories/protein/carbs/fat sin pasar por
// `unknown` y puedan renderizarlos directo en JSX.
export type FoodReferenceView = FoodLike & {
  portion_grams: number;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  nutrients: Record<string, unknown>;
};

export const buildFoodReferenceView = (
  food: FoodLike,
  referenceGrams = 100,
): FoodReferenceView => {
  const factor = referenceGrams / getFoodPortionGrams(food);
  const scaledNutrients = scaleFoodForDisplay(food, factor);
  const calories = getFoodMacroValue(food, 'calories');
  const protein = getFoodMacroValue(food, 'protein');
  const carbs = getFoodMacroValue(food, 'carbs');
  const fat = getFoodMacroValue(food, 'fat');

  return {
    ...food,
    portion_grams: referenceGrams,
    calories: calories == null ? null : roundToDecimals(calories * factor),
    protein: protein == null ? null : roundToDecimals(protein * factor),
    carbs: carbs == null ? null : roundToDecimals(carbs * factor),
    fat: fat == null ? null : roundToDecimals(fat * factor),
    nutrients: {
      ...(food.nutrients && typeof food.nutrients === 'object' && !Array.isArray(food.nutrients) ? food.nutrients as Record<string, unknown> : {}),
      ...scaledNutrients,
    },
    ...scaledNutrients,
  };
};

export const getFoodNutrientValue = (food: FoodLike, key: string): number | null => {
  const directValue = toFiniteNumber(food[key]);
  if (directValue != null) {
    return directValue;
  }

  const nestedValue = food.nutrients;
  if (!nestedValue || typeof nestedValue !== 'object' || Array.isArray(nestedValue)) {
    return null;
  }

  return toFiniteNumber((nestedValue as Record<string, unknown>)[key]);
};

export const scaleFoodNutrientsForPlan = (
  food: FoodLike,
  factor: number,
  // `round` se activa por defecto porque la mayoría de consumidores escala con
  // factor = totalGrams / portion_grams (valor final ya cercano al display).
  // El creador de dietas usa factor "por gramo" (1/portionGrams), donde el
  // redondeo a 1 decimal pierde precisión que reaparece amplificada al
  // multiplicar por la cantidad. En ese caso se debe pasar `round: false` y
  // delegar el redondeo al render.
  options: { round?: boolean } = {},
): Record<string, number> & { nutrients: Record<string, number> } => {
  const shouldRound = options.round !== false;
  const scaledNutrients = OPTIONAL_NUTRIENTS.reduce<Record<string, number>>((accumulator, nutrient) => {
    const numericValue = getFoodNutrientValue(food, nutrient.key);

    if (numericValue == null) {
      return accumulator;
    }

    const scaled = numericValue * factor;
    accumulator[nutrient.key] = shouldRound ? Math.round(scaled * 10) / 10 : scaled;
    return accumulator;
  }, {});

  return {
    ...scaledNutrients,
    nutrients: scaledNutrients,
  } as Record<string, number> & { nutrients: Record<string, number> };
};

export const scaleFoodForDisplay = (
  food: FoodLike,
  factor: number,
): Record<string, number> => {
  return OPTIONAL_NUTRIENTS.reduce<Record<string, number>>((accumulator, nutrient) => {
    const numericValue = getFoodNutrientValue(food, nutrient.key);
    if (numericValue == null) {
      return accumulator;
    }

    accumulator[nutrient.key] = Math.round(numericValue * factor * 10) / 10;
    return accumulator;
  }, {});
};

export const calculatePlanItemTotals = (items: Array<Record<string, unknown>>): Record<string, number> => {
  const totals = OPTIONAL_NUTRIENTS.reduce<Record<string, number>>((accumulator, nutrient) => {
    accumulator[nutrient.key] = 0;
    return accumulator;
  }, {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  items.forEach((item) => {
    const quantity = toFiniteNumber(item.quantity) ?? 1;

    totals.calories += (getFoodMacroValue(item, 'calories') ?? 0) * quantity;
    totals.protein += (getFoodMacroValue(item, 'protein') ?? 0) * quantity;
    totals.carbs += (getFoodMacroValue(item, 'carbs') ?? 0) * quantity;
    totals.fat += (getFoodMacroValue(item, 'fat') ?? 0) * quantity;

    OPTIONAL_NUTRIENTS.forEach((nutrient) => {
      const value = getFoodNutrientValue(item, nutrient.key);
      if (value == null) {
        return;
      }

      totals[nutrient.key] += value * quantity;
    });
  });

  return totals;
};

export const buildMicronutrientSummary = (
  totals: Record<string, number>,
  keys: string[],
  targetOverrides?: Record<string, number>,
): Array<{ key: string; label: string; unit: string; target: number; value: number }> => {
  return keys.map((key) => {
    const definition = NUTRIENT_DEFINITIONS_BY_KEY[key];
    return {
      key,
      label: definition?.label?.replace(/\s*\([^)]*\)\s*$/, '') || key,
      unit: definition?.unit || '',
      // Prioriza el objetivo específico (p. ej. RDI del paciente) sobre el genérico.
      target: targetOverrides?.[key] ?? DEFAULT_MICRONUTRIENT_TARGETS[key] ?? 0,
      value: Math.round((totals[key] || 0) * 10) / 10,
    };
  });
};