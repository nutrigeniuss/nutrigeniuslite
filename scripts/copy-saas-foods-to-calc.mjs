/**
 * Copia alimentos maestros exportados del SaaS Lite → proyecto Calc.
 *
 * Uso:
 *   SRC already exported to scripts/tmp/saas-master-foods.json
 *   set DEST_URL + DEST_SERVICE_ROLE_KEY, then:
 *   node scripts/copy-saas-foods-to-calc.mjs
 *
 * No commitear keys. El JSON de export está en scripts/tmp/ (gitignored).
 */
import fs from 'node:fs';
import path from 'node:path';

const DEST_URL = (process.env.DEST_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const DEST_KEY = process.env.DEST_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const INPUT = process.env.FOODS_JSON || path.join('scripts', 'tmp', 'saas-master-foods.json');
const BATCH = 100;

if (!DEST_URL || !DEST_KEY) {
  console.error('Falta DEST_URL y DEST_SERVICE_ROLE_KEY (service_role del proyecto ywpgsnjj…).');
  process.exit(1);
}
if (!fs.existsSync(INPUT)) {
  console.error('No existe el export:', INPUT);
  process.exit(1);
}

const foods = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
console.log('Importando', foods.length, 'alimentos maestros →', DEST_URL);

const headers = {
  apikey: DEST_KEY,
  Authorization: `Bearer ${DEST_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates,return=minimal',
};

// Upsert by name is not native without unique constraint; insert in batches.
// Skip rows already present by name.
async function fetchExistingNames() {
  const names = new Set();
  let from = 0;
  const page = 1000;
  for (;;) {
    const res = await fetch(
      `${DEST_URL}/rest/v1/foods?select=name&nutritionist_id=is.null&order=name.asc&offset=${from}&limit=${page}`,
      { headers: { apikey: DEST_KEY, Authorization: `Bearer ${DEST_KEY}` } },
    );
    if (!res.ok) throw new Error(await res.text());
    const rows = await res.json();
    rows.forEach((r) => names.add(String(r.name || '').trim().toLowerCase()));
    if (rows.length < page) break;
    from += page;
  }
  return names;
}

const existing = await fetchExistingNames();
console.log('Ya hay', existing.size, 'maestros en destino');

/** Solo columnas que existen en supabase/foods.sql de Calc. */
const ALLOWED = new Set([
  'nutritionist_id',
  'submitted_by_nutritionist_id',
  'reviewed_by_nutritionist_id',
  'review_status',
  'review_notes',
  'reviewed_at',
  'published_at',
  'supersedes_food_id',
  'name',
  'category',
  'country',
  'portion_grams',
  'calories',
  'protein',
  'carbs',
  'fat',
  'notes',
  'nutrients',
  'household_measures',
  'alcohol',
  'ash',
  'caffeine',
  'calcium',
  'available_carbs',
  'alpha_carotene',
  'beta_carotene',
  'fiber',
  'sodium',
]);

const toCalcRow = (food) => {
  const row = {};
  for (const [key, value] of Object.entries(food)) {
    if (!ALLOWED.has(key)) continue;
    row[key] = value;
  }
  row.nutritionist_id = null;
  row.submitted_by_nutritionist_id = null;
  row.reviewed_by_nutritionist_id = null;
  row.supersedes_food_id = null;
  row.review_status = row.review_status || 'approved';
  if (!Array.isArray(row.household_measures)) row.household_measures = [];
  return row;
};

const toInsert = foods.filter((f) => !existing.has(String(f.name || '').trim().toLowerCase()));
console.log('Por insertar:', toInsert.length);

let inserted = 0;
for (let i = 0; i < toInsert.length; i += BATCH) {
  const chunk = toInsert.slice(i, i + BATCH).map(toCalcRow);
  const res = await fetch(`${DEST_URL}/rest/v1/foods`, {
    method: 'POST',
    headers,
    body: JSON.stringify(chunk),
  });
  if (!res.ok) {
    console.error('Error batch', i, await res.text());
    process.exit(1);
  }
  inserted += chunk.length;
  console.log('insertados', inserted, '/', toInsert.length);
}

console.log('Listo. Insertados:', inserted);
