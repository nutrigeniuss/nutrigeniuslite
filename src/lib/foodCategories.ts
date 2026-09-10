const normalizeCategoryKey = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]/g, ' ')
  .trim()
  .replace(/\s+/g, ' ')
  .toUpperCase();

export const FOOD_CATEGORIES = [
  'FRUTAS Y DERIVADOS',
  'PESCADOS Y MARISCOS',
  'CARNES Y DERIVADOS',
  'CEREALES Y DERIVADOS',
  'VERDURAS',
  'GRASA, ACEITES Y OLEAGINOSAS',
  'LECHES Y DERIVADOS',
  'BEBIDAS',
  'HUEVOS Y DERIVADOS',
  'PRODUCTOS AZUCARADOS',
  'MISCELANEOS',
  'ALIMENTOS INFANTILES',
  'LEGUMINOSAS Y DERIVADOS',
  'TUBÉRCULOS, RAÍCES Y DERIVADOS',
] as const;

export const FOOD_CATEGORY_FILTERS = ['Todos', ...FOOD_CATEGORIES];

export const FOOD_CATEGORY_COLORS: Record<string, string> = {
  'FRUTAS Y DERIVADOS': 'bg-rose-50 text-rose-700',
  'PESCADOS Y MARISCOS': 'bg-cyan-50 text-cyan-700',
  'CARNES Y DERIVADOS': 'bg-red-50 text-red-700',
  'CEREALES Y DERIVADOS': 'bg-amber-50 text-amber-700',
  'VERDURAS': 'bg-green-50 text-green-700',
  'GRASA, ACEITES Y OLEAGINOSAS': 'bg-yellow-50 text-yellow-700',
  'LECHES Y DERIVADOS': 'bg-sky-50 text-sky-700',
  'BEBIDAS': 'bg-teal-50 text-teal-700',
  'HUEVOS Y DERIVADOS': 'bg-orange-50 text-orange-700',
  'PRODUCTOS AZUCARADOS': 'bg-pink-50 text-pink-700',
  'MISCELANEOS': 'bg-slate-100 text-slate-700',
  'ALIMENTOS INFANTILES': 'bg-violet-50 text-violet-700',
  'LEGUMINOSAS Y DERIVADOS': 'bg-lime-50 text-lime-700',
  'TUBÉRCULOS, RAÍCES Y DERIVADOS': 'bg-stone-100 text-stone-700',
};

const FOOD_CATEGORY_ALIASES: Record<string, string> = {
  FRUTAS: 'FRUTAS Y DERIVADOS',
  'FRUTAS Y DERIVADOS': 'FRUTAS Y DERIVADOS',
  'PESCADOS Y MARISCOS': 'PESCADOS Y MARISCOS',
  'CARNES Y AVES': 'CARNES Y DERIVADOS',
  'CARNES Y DERIVADOS': 'CARNES Y DERIVADOS',
  'CEREALES Y TUBERCULOS': 'CEREALES Y DERIVADOS',
  'CEREALES Y DERIVADOS': 'CEREALES Y DERIVADOS',
  VERDURAS: 'VERDURAS',
  'GRASAS Y ACEITES': 'GRASA, ACEITES Y OLEAGINOSAS',
  'GRASA ACEITES Y OLEAGINOSAS': 'GRASA, ACEITES Y OLEAGINOSAS',
  'GRASA, ACEITES Y OLEAGINOSAS': 'GRASA, ACEITES Y OLEAGINOSAS',
  LACTEOS: 'LECHES Y DERIVADOS',
  'LECHES Y DERIVADOS': 'LECHES Y DERIVADOS',
  BEBIDAS: 'BEBIDAS',
  HUEVOS: 'HUEVOS Y DERIVADOS',
  'HUEVOS Y DERIVADOS': 'HUEVOS Y DERIVADOS',
  'AZUCARES Y DULCES': 'PRODUCTOS AZUCARADOS',
  'PRODUCTOS AZUCARADOS': 'PRODUCTOS AZUCARADOS',
  OTROS: 'MISCELANEOS',
  MISCELANEOS: 'MISCELANEOS',
  'ALIMENTOS INFANTILES': 'ALIMENTOS INFANTILES',
  LEGUMINOSAS: 'LEGUMINOSAS Y DERIVADOS',
  'LEGUMINOSAS Y DERIVADOS': 'LEGUMINOSAS Y DERIVADOS',
  'TUBERCULOS RAICES Y DERIVADOS': 'TUBÉRCULOS, RAÍCES Y DERIVADOS',
  'TUBÉRCULOS, RAÍCES Y DERIVADOS': 'TUBÉRCULOS, RAÍCES Y DERIVADOS',
};

const FOOD_CATEGORY_BY_NORMALIZED_KEY: Record<string, string> = Object.fromEntries(
  FOOD_CATEGORIES.map((category) => [normalizeCategoryKey(category), category]),
);

export const normalizeFoodCategory = (value?: string | null): string => {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return '';

  const normalizedKey = normalizeCategoryKey(trimmedValue);
  return FOOD_CATEGORY_ALIASES[normalizedKey] || FOOD_CATEGORY_BY_NORMALIZED_KEY[normalizedKey] || '';
};