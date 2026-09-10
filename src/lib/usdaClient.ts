// Cliente único de la USDA FoodData Central.
//
// Antes esta llamada estaba copiada en cinco componentes de interfaz
// (FoodSearch, RecipesModal, RecallFoodSearch, IngredientSearch e
// IngredientSearchModal): cada uno leía la clave del entorno, armaba la misma
// URL y repetía el mismo manejo de errores. Cambiar un parámetro obligaba a
// tocar los cinco, y ya habían empezado a divergir (uno pedía 20 resultados y
// los otros 25).
//
// Inversión de dependencias: la interfaz ya no conoce el proveedor externo.
// Si mañana la USDA cambia de URL, sube de versión o hay que meter una caché,
// se corrige AQUÍ y punto.
//
// IMPORTANTE — lo que este módulo NO hace: no interpreta los nutrientes. Cada
// pantalla guarda un conjunto de campos distinto (el editor de recetas guarda
// 10 nutrientes, el creador de dietas 6 y el modal de ingredientes 4), y
// unificarlos cambiaría lo que queda grabado en las dietas ya existentes. Esa
// decisión es clínica, no técnica, y no se toma en una refactorización.

const USDA_API_KEY = import.meta.env.VITE_USDA_API_KEY || 'DEMO_KEY';

const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

// Ya viene codificado para la URL (espacios y paréntesis) tal como estaba en
// los cinco sitios originales. Se conserva literal para que la petición que
// sale a la red sea byte por byte la misma de antes.
const USDA_DATA_TYPES = 'Foundation,SR%20Legacy,Survey%20(FNDDS),Branded';

/** Cuántos resultados pide la mayoría de pantallas. */
export const USDA_DEFAULT_PAGE_SIZE = 25;

/** Registro crudo de la USDA, tal como lo devuelve su API. */
export type UsdaFood = {
  fdcId?: number;
  description?: string;
  brandName?: string;
  brandOwner?: string;
  foodNutrients?: Array<{ nutrientId?: number; value?: number }>;
  foodMeasures?: Array<{
    gramWeight?: number;
    disseminationText?: string;
    measureUnitName?: string;
  }>;
  [key: string]: unknown;
};

export type UsdaSearchOptions = {
  /** Resultados a pedir. El recordatorio de 24 h usa 20; el resto, 25. */
  pageSize?: number;
  /** Permite cancelar la petición si el componente se desmonta. */
  signal?: AbortSignal;
};

/**
 * Busca alimentos en la USDA.
 *
 * Falla en silencio devolviendo `[]`, igual que hacían los cinco componentes:
 * la búsqueda en una base externa es un extra, y si se cae no debe tumbar la
 * pantalla en la que el nutricionista está trabajando.
 */
export const searchUsdaFoods = async (
  query: string,
  options: UsdaSearchOptions = {},
): Promise<UsdaFood[]> => {
  const pageSize = options.pageSize ?? USDA_DEFAULT_PAGE_SIZE;
  const url =
    `${USDA_SEARCH_URL}?query=${encodeURIComponent(query)}` +
    `&pageSize=${pageSize}` +
    `&dataType=${USDA_DATA_TYPES}` +
    `&api_key=${USDA_API_KEY}`;

  const payload = await fetch(url, { signal: options.signal })
    .then((response) => response.json())
    .catch(() => ({ foods: [] }));

  return payload?.foods || [];
};

/** Códigos de nutriente de la USDA usados en la app. */
export const USDA_NUTRIENT_IDS = {
  calories: 1008,
  protein: 1003,
  carbs: 1005,
  fat: 1004,
  fiber: 1079,
  sodium: 1093,
  calcium: 1087,
  iron: 1089,
  potassium: 1092,
  vitaminC: 1162,
} as const;

/**
 * Lee un nutriente del registro crudo. Devuelve 0 si no viene, que es
 * exactamente lo que hacían los helpers `get(id)` locales.
 */
export const usdaNutrient = (food: UsdaFood, nutrientId: number): number =>
  food?.foodNutrients?.find((nutrient) => nutrient.nutrientId === nutrientId)?.value || 0;

/** Redondeo a un decimal, el que usan todas las pantallas para los macros. */
export const roundUsdaValue = (value: number): number => Math.round(value * 10) / 10;

/** Una opción del desplegable de unidades: gramos o una medida casera. */
export type UsdaUnitOption = {
  label: string;
  grams: number;
  isHousehold: boolean;
};

/**
 * Arma las unidades elegibles de un alimento de la USDA: siempre "gramos",
 * más cada medida casera que la USDA reporte con peso válido (por ejemplo
 * "1 cup (240g)").
 *
 * Estaba copiado literal en los cinco buscadores. Las cinco copias variaban
 * solo en el formato del código —una recorría `(food.foodMeasures || [])` y
 * otra preguntaba `if (food.foodMeasures?.length > 0)`— pero producían
 * exactamente la misma lista, incluidos los casos borde (sin medidas, lista
 * vacía o pesos en cero).
 */
export const getUsdaUnits = (food: UsdaFood): UsdaUnitOption[] => {
  const base: UsdaUnitOption[] = [{ label: 'gramos', grams: 1, isHousehold: false }];

  (food?.foodMeasures || []).forEach((measure) => {
    const grams = measure?.gramWeight;
    // `Number(grams) > 0` reproduce EXACTAMENTE la comparación suelta que hacían
    // las cinco copias (`if (m.gramWeight > 0)`): descarta undefined, null y
    // texto no numérico, y acepta un peso que llegue como cadena, como antes.
    if (!(Number(grams) > 0)) return;

    base.push({
      label: `${measure.disseminationText || measure.measureUnitName} (${Math.round(grams as number)}g)`,
      grams: grams as number,
      isHousehold: true,
    });
  });

  return base;
};
