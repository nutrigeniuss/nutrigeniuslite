import fs from 'node:fs';

const foods = JSON.parse(fs.readFileSync('scripts/tmp/saas-master-foods.json', 'utf8'));

const esc = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};

const cols = [
  'nutritionist_id',
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
  'review_status',
  'published_at',
  'fiber',
  'sodium',
];

const pick = (f) => cols.map((c) => {
  if (c === 'nutritionist_id') return 'NULL';
  if (c === 'review_status') return esc(f.review_status || 'approved');
  if (c === 'fiber') return esc(f.fiber ?? f.nutrients?.fiber ?? null);
  if (c === 'sodium') return esc(f.sodium ?? f.nutrients?.sodium ?? null);
  return esc(f[c] ?? null);
});

const BATCH = 40;
const parts = [];
parts.push('-- Master foods from SaaS Lite → NutriGenius Calc');
parts.push('-- Project: ywpgsnjjtjwkbiutiwjj — pegar en SQL Editor');
parts.push('begin;');

for (let i = 0; i < foods.length; i += BATCH) {
  const chunk = foods.slice(i, i + BATCH);
  const values = chunk.map((f) => `(${pick(f).join(',')})`).join(',\n');
  parts.push(`insert into public.foods (${cols.join(',')}) values\n${values};`);
}

parts.push('commit;');
parts.push(`-- rows: ${foods.length}`);
fs.writeFileSync('scripts/tmp/saas-master-foods.sql', parts.join('\n'));
console.log('sql bytes', fs.statSync('scripts/tmp/saas-master-foods.sql').size, 'rows', foods.length);
