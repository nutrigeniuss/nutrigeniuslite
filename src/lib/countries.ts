// Catálogo de países soportados por el sistema de alimentos.
// Usamos ISO 3166-1 alpha-2 (dos letras) + un código especial 'INT' para
// alimentos universales (USDA, FAO). Agregar un país nuevo es tan simple
// como añadir una entrada aquí — no requiere cambios en BD ni migraciones.

export type CountryCode = string;

export type CountryOption = {
  code: CountryCode;
  name: string;
  flag: string;
};

export const SUPPORTED_COUNTRIES: CountryOption[] = [
  { code: 'PE', name: 'Perú', flag: '🇵🇪' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'MX', name: 'México', flag: '🇲🇽' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨' },
  { code: 'BO', name: 'Bolivia', flag: '🇧🇴' },
  { code: 'ES', name: 'España', flag: '🇪🇸' },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
  { code: 'INT', name: 'Internacional', flag: '🌐' },
];

export const DEFAULT_COUNTRY: CountryCode = 'PE';

// Países de los que puede ser un PACIENTE. Es una lista más larga que la de
// arriba a propósito, y son cosas distintas:
//
//   SUPPORTED_COUNTRIES → de qué países hay base de alimentos.
//   PATIENT_COUNTRIES   → de dónde puede ser la persona que se atiende.
//
// Un nutricionista peruano atiende a un venezolano sin que exista una base de
// alimentos venezolana, así que restringir esto a la primera lista quitaría
// opciones que hoy existen. Sale de la lista que estaba escrita a mano dentro
// de DatosGenerales.tsx —una tercera copia del mismo concepto— convertida a
// códigos ISO, que es lo que se guarda desde agosto de 2026.
export const PATIENT_COUNTRIES: CountryOption[] = [
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'BO', name: 'Bolivia', flag: '🇧🇴' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'CR', name: 'Costa Rica', flag: '🇨🇷' },
  { code: 'CU', name: 'Cuba', flag: '🇨🇺' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨' },
  { code: 'SV', name: 'El Salvador', flag: '🇸🇻' },
  { code: 'ES', name: 'España', flag: '🇪🇸' },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
  { code: 'GT', name: 'Guatemala', flag: '🇬🇹' },
  { code: 'HN', name: 'Honduras', flag: '🇭🇳' },
  { code: 'MX', name: 'México', flag: '🇲🇽' },
  { code: 'NI', name: 'Nicaragua', flag: '🇳🇮' },
  { code: 'PA', name: 'Panamá', flag: '🇵🇦' },
  { code: 'PY', name: 'Paraguay', flag: '🇵🇾' },
  { code: 'PE', name: 'Perú', flag: '🇵🇪' },
  { code: 'DO', name: 'República Dominicana', flag: '🇩🇴' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪' },
];

// Bases "universales": alimentos internacionales (USDA, FAO) que SIEMPRE
// acompañan a la base nacional del nutricionista, sin importar su país.
export const UNIVERSAL_FOOD_COUNTRIES: CountryCode[] = ['US', 'INT'];

// Búsqueda rápida por código → opción completa (con bandera y nombre).
const COUNTRY_MAP = new Map<CountryCode, CountryOption>(
  SUPPORTED_COUNTRIES.map((option) => [option.code, option]),
);

/**
 * Devuelve la información de un país (nombre + bandera) a partir de su código.
 * Si el código no está registrado, devuelve un fallback con el mismo código
 * como nombre, para que la UI no se rompa ante datos antiguos o inválidos.
 */
export const getCountryOption = (code?: string | null): CountryOption => {
  if (!code) return COUNTRY_MAP.get(DEFAULT_COUNTRY) as CountryOption;
  const normalized = String(code).trim().toUpperCase();
  return (
    COUNTRY_MAP.get(normalized)
    || { code: normalized, name: normalized, flag: '🏳️' }
  );
};

/**
 * Normaliza cualquier entrada de usuario a un código de país válido.
 * Si no coincide con ninguno soportado, devuelve DEFAULT_COUNTRY.
 */
/**
 * Conjunto de países cuyos alimentos del CATÁLOGO MAESTRO puede ver un
 * nutricionista: su base nacional + las universales (USDA/Internacional).
 * Los alimentos PROPIOS del nutricionista se incluyen aparte, sin importar país.
 */
export const getSearchableFoodCountries = (country?: string | null): CountryCode[] => {
  const base = normalizeCountryCode(country);
  return Array.from(new Set([base, ...UNIVERSAL_FOOD_COUNTRIES]));
};

/**
 * ¿Este alimento es visible para un nutricionista de `country`?
 *  - Alimentos propios (nutritionist_id === ownId) → SIEMPRE visibles.
 *  - Catálogo maestro → solo si su país está en la base nacional + universales.
 * Se usa para el filtrado client-side (modo caché) espejando el filtro server.
 */
export const isFoodVisibleForCountry = (
  food: { country?: string | null; nutritionist_id?: string | null } | null | undefined,
  country: string | null | undefined,
  ownNutritionistId?: string | null,
): boolean => {
  if (!food) return false;
  if (ownNutritionistId && food.nutritionist_id === ownNutritionistId) return true;
  return getSearchableFoodCountries(country).includes(normalizeCountryCode(food.country));
};

// Nombres escritos a mano → código. `patients.country` se guardó durante meses
// como NOMBRE ("Perú") mientras `nutritionists.country` guardaba el CÓDIGO
// ("PE"), así que hay filas antiguas con las dos formas.
//
// Sin esta tabla, `normalizeCountryCode('México')` no reconocía nada y caía al
// país por defecto: devolvía 'PE'. Con un solo país eso no se notaba —el
// desenlace acertaba por casualidad—, pero al entrar México o Chile, un paciente
// suyo se leería como peruano.
//
// Se escriben sin tilde y en mayúsculas porque la clave se busca ya normalizada,
// y se incluyen las variantes que la gente teclea de verdad.
const CODE_BY_NAME: Record<string, CountryCode> = {
  // Se generan de las dos listas para no mantener una tercera a mano: cualquier
  // país que se añada arriba queda reconocido por su nombre automáticamente.
  ...Object.fromEntries(
    [...SUPPORTED_COUNTRIES, ...PATIENT_COUNTRIES].map((pais) => [
      pais.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase(),
      pais.code,
    ]),
  ),
  // Variantes que la gente teclea de verdad y que no son el nombre oficial.
  EEUU: 'US',
  'ESTADOS UNIDOS DE AMERICA': 'US',
  INTERNACIONAL: 'INT',
};

/**
 * Quita tildes y pasa a mayúsculas, para que "México" y "MEXICO" sean lo mismo.
 *
 * El rango va escrito con escapes (\u0300-\u036f) y no con los caracteres
 * literales: son marcas combinantes, invisibles en el editor, y se pierden al
 * copiar el archivo entre programas. Mismo criterio que en api/manifest-dieta.js.
 */
const sinTildes = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

export const normalizeCountryCode = (value?: string | null): CountryCode => {
  if (!value) return DEFAULT_COUNTRY;
  const normalized = String(value).trim().toUpperCase();
  if (COUNTRY_MAP.has(normalized)) return normalized;

  // Antes que el descarte: un nombre escrito no puede acabar en el país por
  // defecto, que es como un paciente mexicano se volvía peruano.
  const porNombre = CODE_BY_NAME[sinTildes(String(value))];
  if (porNombre) return porNombre;

  // Preserva cualquier código con formato ISO alpha-2/'INT' aunque no esté en el
  // catálogo mostrado (p.ej. PY, UY, GT que ofrece el onboarding). Así no se
  // pierde el país real del usuario ni se colapsa erróneamente a PE. Coincide
  // con el CHECK de la BD (^[A-Z]{2,3}$).
  if (/^[A-Z]{2,3}$/.test(normalized)) return normalized;
  return DEFAULT_COUNTRY;
};

// Códigos ISO alpha-3 para mostrar como etiqueta (PER, MEX, ARG…). Windows no
// renderiza los emojis de bandera, así que en la UI usamos imagen real + este
// código en texto (ver componente CountryFlag).
const ALPHA3_BY_CODE: Record<string, string> = {
  PE: 'PER', MX: 'MEX', CO: 'COL', AR: 'ARG', CL: 'CHL', EC: 'ECU', BO: 'BOL',
  VE: 'VEN', PY: 'PRY', UY: 'URY', GT: 'GTM', HN: 'HND', SV: 'SLV', NI: 'NIC',
  CR: 'CRI', PA: 'PAN', CU: 'CUB', DO: 'DOM', ES: 'ESP', US: 'USA', INT: 'INT',
};

/** Código de 3 letras (PER, MEX…) para etiquetas. Fallback: el propio código. */
export const getCountryAlpha3 = (code?: string | null): string => {
  const normalized = normalizeCountryCode(code);
  return ALPHA3_BY_CODE[normalized] || normalized;
};

/**
 * URL de la bandera (imagen real) por código ISO alpha-2. Usamos flagcdn porque
 * los emojis de bandera no se renderizan en Windows. 'INT' (universal) no tiene
 * bandera → devuelve null y la UI cae al ícono 🌐.
 */
export const getCountryFlagUrl = (code?: string | null, size: '20x15' | '40x30' | '80x60' = '20x15'): string | null => {
  const alpha2 = normalizeCountryCode(code).toLowerCase();
  if (!/^[a-z]{2}$/.test(alpha2)) return null; // 'int' u otros no-ISO2
  return `https://flagcdn.com/${size}/${alpha2}.png`;
};
