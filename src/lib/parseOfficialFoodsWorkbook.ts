import {
  resolveOfficialExcelField,
  type OfficialExcelField,
} from './officialFoodsExcelMap';

export type OfficialFoodImportRecord = {
  name: string;
  category: string | null;
  country: 'PE';
  portion_grams: 100;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes: string | null;
  household_measures: Array<{
    name: string;
    weight_grams: number;
    quantity: number;
    sort_order: number;
  }>;
  nutrients: Record<string, number | null>;
  fiber?: number | null;
  sodium?: number | null;
  available_carbs?: number | null;
};

export type OfficialFoodsParseResult = {
  foods: OfficialFoodImportRecord[];
  skippedRows: number;
};

type FieldIndexMap = Partial<Record<OfficialExcelField, number>>;

type ParsedRow = {
  name: string;
  category: string | null;
  measureName: string | null;
  grams: number;
  notes: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  availableCarbs: number | null;
  nutrients: Record<string, number | null>;
  nutrientCellCount: number;
};

const UNIT_PATTERN = /^(g|mg|ug|µg|mcg|kcal|kcal\/g|ml)$/i;

const MACRO_FIELDS = ['calories', 'protein', 'carbs', 'fat', 'available_carbs'] as const;

function isUnitRow(row: unknown[]): boolean {
  const nonEmpty = row.filter(
    (cell) => cell !== null && cell !== undefined && String(cell).trim() !== '',
  );
  if (nonEmpty.length === 0) {
    return false;
  }

  const unitMatches = nonEmpty.filter((cell) => UNIT_PATTERN.test(String(cell).trim())).length;
  return unitMatches > nonEmpty.length / 2;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim().replace(',', '.');
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function getString(row: unknown[], index: number | undefined): string | null {
  if (index === undefined) {
    return null;
  }

  const value = row[index];
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed || null;
}

function buildFieldIndexMap(headers: unknown[]): FieldIndexMap {
  const map: FieldIndexMap = {};

  headers.forEach((header, index) => {
    const field = resolveOfficialExcelField(header);
    if (field && map[field] === undefined) {
      map[field] = index;
    }
  });

  return map;
}

function countNumericNutrients(parsed: Omit<ParsedRow, 'name' | 'category' | 'measureName' | 'grams' | 'notes'>): number {
  let count = 0;

  for (const field of MACRO_FIELDS) {
    if (parsed[field === 'available_carbs' ? 'availableCarbs' : field] !== null) {
      count += 1;
    }
  }

  for (const value of Object.values(parsed.nutrients)) {
    if (value !== null) {
      count += 1;
    }
  }

  return count;
}

function readParsedRow(row: unknown[], fieldMap: FieldIndexMap, name: string): ParsedRow {
  const nutrients: Record<string, number | null> = {};
  let calories: number | null = null;
  let protein: number | null = null;
  let carbs: number | null = null;
  let fat: number | null = null;
  let availableCarbs: number | null = null;

  for (const [field, index] of Object.entries(fieldMap) as Array<[OfficialExcelField, number]>) {
    const value = toNumber(row[index]);

    if (field === 'calories') {
      calories = value;
    } else if (field === 'protein') {
      protein = value;
    } else if (field === 'carbs') {
      carbs = value;
    } else if (field === 'fat') {
      fat = value;
    } else if (field === 'available_carbs') {
      availableCarbs = value;
    } else if (field.startsWith('nutrient:')) {
      nutrients[field.slice('nutrient:'.length)] = value;
    }
  }

  const nutrientCellCount = countNumericNutrients({
    calories,
    protein,
    carbs,
    fat,
    availableCarbs,
    nutrients,
    nutrientCellCount: 0,
  });

  const measureName = getString(row, fieldMap.measure);
  const measureGrams = toNumber(row[fieldMap.measure_grams ?? -1]);
  const portionGrams = toNumber(row[fieldMap.portion_grams ?? -1]);
  const hasNutrients = nutrientCellCount > 0;

  let grams = measureGrams ?? portionGrams ?? (hasNutrients ? 100 : 0);
  if (grams <= 0 && hasNutrients) {
    grams = 100;
  }

  return {
    name,
    category: getString(row, fieldMap.category),
    measureName,
    grams,
    notes: getString(row, fieldMap.notes),
    calories,
    protein,
    carbs,
    fat,
    availableCarbs,
    nutrients,
    nutrientCellCount,
  };
}

function scaleNutrients(
  parsed: ParsedRow,
  targetGrams: number,
): Pick<
  OfficialFoodImportRecord,
  'calories' | 'protein' | 'carbs' | 'fat' | 'available_carbs' | 'nutrients' | 'fiber' | 'sodium'
> {
  const factor = targetGrams / parsed.grams;
  const scaleValue = (value: number | null): number | null =>
    value === null ? null : value * factor;

  const nutrients: Record<string, number | null> = {};
  for (const [key, value] of Object.entries(parsed.nutrients)) {
    nutrients[key] = scaleValue(value);
  }

  const fiber = nutrients.fiber ?? null;
  const sodium = nutrients.sodium ?? null;

  return {
    calories: scaleValue(parsed.calories) ?? 0,
    protein: scaleValue(parsed.protein) ?? 0,
    carbs: scaleValue(parsed.carbs) ?? 0,
    fat: scaleValue(parsed.fat) ?? 0,
    available_carbs: scaleValue(parsed.availableCarbs),
    nutrients,
    fiber,
    sodium,
  };
}

function pickAnchorRow(rows: ParsedRow[]): ParsedRow {
  const candidates = rows.filter((row) => row.nutrientCellCount > 0 && row.grams > 0);
  if (candidates.length === 0) {
    return rows[0];
  }

  return candidates.reduce((best, current) => {
    const bestDistance = Math.abs(best.grams - 100);
    const currentDistance = Math.abs(current.grams - 100);

    if (currentDistance < bestDistance) {
      return current;
    }

    if (currentDistance === bestDistance && current.nutrientCellCount > best.nutrientCellCount) {
      return current;
    }

    return best;
  });
}

function buildFoodRecord(groupKey: string, rows: ParsedRow[]): OfficialFoodImportRecord {
  const anchor = pickAnchorRow(rows);
  const scaled = scaleNutrients(anchor, 100);

  const householdMeasures: OfficialFoodImportRecord['household_measures'] = [];
  const seenMeasures = new Set<string>();

  for (const row of rows) {
    if (!row.measureName || row.grams <= 0) {
      continue;
    }

    const measureKey = normalizeName(row.measureName);
    if (seenMeasures.has(measureKey)) {
      continue;
    }

    seenMeasures.add(measureKey);
    householdMeasures.push({
      name: row.measureName,
      weight_grams: row.grams,
      quantity: 1,
      sort_order: householdMeasures.length,
    });
  }

  const record: OfficialFoodImportRecord = {
    name: anchor.name,
    category: anchor.category ?? rows.find((row) => row.category)?.category ?? null,
    country: 'PE',
    portion_grams: 100,
    calories: scaled.calories,
    protein: scaled.protein,
    carbs: scaled.carbs,
    fat: scaled.fat,
    notes: anchor.notes ?? rows.find((row) => row.notes)?.notes ?? null,
    household_measures: householdMeasures,
    nutrients: scaled.nutrients,
  };

  if (scaled.fiber !== null && scaled.fiber !== undefined) {
    record.fiber = scaled.fiber;
  }

  if (scaled.sodium !== null && scaled.sodium !== undefined) {
    record.sodium = scaled.sodium;
  }

  if (scaled.available_carbs !== null && scaled.available_carbs !== undefined) {
    record.available_carbs = scaled.available_carbs;
  }

  return record;
}

export function parseOfficialFoodsRows(rows: unknown[][]): OfficialFoodsParseResult {
  if (rows.length === 0) {
    throw new Error('Falta la columna alimento en la plantilla.');
  }

  const headers = rows[0] ?? [];
  const fieldMap = buildFieldIndexMap(headers);

  if (fieldMap.name === undefined) {
    throw new Error('Falta la columna alimento en la plantilla.');
  }

  let dataStartIndex = 1;
  if (rows.length > 1 && isUnitRow(rows[1] ?? [])) {
    dataStartIndex = 2;
  }

  const groupedRows = new Map<string, ParsedRow[]>();
  let skippedRows = 0;

  for (let index = dataStartIndex; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const name = getString(row, fieldMap.name);

    if (!name) {
      skippedRows += 1;
      continue;
    }

    const parsed = readParsedRow(row, fieldMap, name);
    const groupKey = normalizeName(name);
    const existing = groupedRows.get(groupKey);

    if (existing) {
      existing.push(parsed);
    } else {
      groupedRows.set(groupKey, [parsed]);
    }
  }

  const foods = Array.from(groupedRows.entries()).map(([groupKey, groupRows]) =>
    buildFoodRecord(groupKey, groupRows),
  );

  return { foods, skippedRows };
}
