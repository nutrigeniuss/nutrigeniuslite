/**
 * Exporta alimentos maestros del SaaS Lite (BASE) a scripts/tmp/saas-master-foods.json
 * Requiere SRC_URL + SRC_SERVICE_ROLE_KEY en el entorno.
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC_URL = (process.env.SRC_URL || '').replace(/\/$/, '');
const SRC_KEY = process.env.SRC_SERVICE_ROLE_KEY || process.env.SRC_KEY || '';
const OUT = process.env.OUT || path.join('scripts', 'tmp', 'saas-master-foods.json');
const PAGE = 1000;

if (!SRC_URL || !SRC_KEY) {
  console.error('Falta SRC_URL y SRC_SERVICE_ROLE_KEY');
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });

const all = [];
let from = 0;
for (;;) {
  const res = await fetch(
    `${SRC_URL}/rest/v1/foods?select=*&nutritionist_id=is.null&order=name.asc&offset=${from}&limit=${PAGE}`,
    {
      headers: {
        apikey: SRC_KEY,
        Authorization: `Bearer ${SRC_KEY}`,
        Prefer: 'count=exact',
      },
    },
  );
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  all.push(...rows);
  console.log('fetched', all.length, res.headers.get('content-range'));
  if (rows.length < PAGE) break;
  from += PAGE;
}

const cleaned = all.map(({ id, created_at, updated_at, ...rest }) => ({
  ...rest,
  nutritionist_id: null,
  review_status: rest.review_status || 'approved',
  published_at: rest.published_at || new Date().toISOString(),
}));

fs.writeFileSync(OUT, JSON.stringify(cleaned));
console.log('wrote', cleaned.length, '→', OUT);
