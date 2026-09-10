/**
 * Almacén local de dietas para NutriGenius Lite Calc.
 * Misma forma de API que supabase.from(...).select/insert/update/delete
 * para diet_plans y exchange_diets — sin gestión de pacientes en servidor.
 */

type Row = Record<string, unknown> & { id?: string };

const KEYS: Record<string, string> = {
  diet_plans: 'ng_lite_calc_diet_plans_v1',
  exchange_diets: 'ng_lite_calc_exchange_diets_v1',
};

function readAll(table: string): Row[] {
  try {
    const raw = localStorage.getItem(KEYS[table] || table);
    return raw ? (JSON.parse(raw) as Row[]) : [];
  } catch {
    return [];
  }
}

function writeAll(table: string, rows: Row[]) {
  localStorage.setItem(KEYS[table] || table, JSON.stringify(rows));
}

function uid() {
  return crypto.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type Filter = { col: string; op: 'eq' | 'in'; val: unknown };

class LocalQuery {
  private table: string;
  private filters: Filter[] = [];
  private limitN: number | null = null;
  private wantSingle = false;
  private wantMaybeSingle = false;
  private selectCols: string | null = null;
  private orderCol: string | null = null;
  private ascending = true;
  private mutation: null | { type: 'insert' | 'update' | 'delete'; payload?: Row | Row[] } = null;

  constructor(table: string) {
    this.table = table;
  }

  select(cols = '*') {
    this.selectCols = cols;
    return this;
  }

  insert(payload: Row | Row[]) {
    this.mutation = { type: 'insert', payload };
    return this;
  }

  update(payload: Row) {
    this.mutation = { type: 'update', payload };
    return this;
  }

  delete() {
    this.mutation = { type: 'delete' };
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push({ col, op: 'eq', val });
    return this;
  }

  in(col: string, val: unknown[]) {
    this.filters.push({ col, op: 'in', val });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.ascending = opts?.ascending !== false;
    return this;
  }

  limit(n: number) {
    this.limitN = n;
    return this;
  }

  single() {
    this.wantSingle = true;
    return this;
  }

  maybeSingle() {
    this.wantMaybeSingle = true;
    return this;
  }

  private applyFilters(rows: Row[]) {
    return rows.filter((row) =>
      this.filters.every((f) => {
        if (f.op === 'eq') return row[f.col] === f.val;
        if (f.op === 'in') return Array.isArray(f.val) && f.val.includes(row[f.col]);
        return true;
      }),
    );
  }

  private project(row: Row) {
    if (!this.selectCols || this.selectCols === '*') return row;
    const cols = this.selectCols.split(',').map((c) => c.trim());
    const out: Row = {};
    cols.forEach((c) => {
      out[c] = row[c];
    });
    return out;
  }

  then<TResult1 = { data: unknown; error: null | { message: string } }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null | { message: string } }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute(): { data: unknown; error: null | { message: string } } {
    try {
      let rows = readAll(this.table);

      if (this.mutation?.type === 'insert') {
        const incoming = Array.isArray(this.mutation.payload)
          ? this.mutation.payload
          : [this.mutation.payload as Row];
        const created = incoming.map((row) => ({
          ...row,
          id: row.id || uid(),
          created_at: row.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        rows = [...rows, ...created];
        writeAll(this.table, rows);
        let data: unknown = created;
        if (this.wantSingle || this.wantMaybeSingle) data = created[0] || null;
        return { data, error: null };
      }

      if (this.mutation?.type === 'update') {
        const matched = this.applyFilters(rows);
        const payload = this.mutation.payload as Row;
        rows = rows.map((row) => {
          const hit = matched.some((m) => m.id === row.id);
          return hit ? { ...row, ...payload, updated_at: new Date().toISOString() } : row;
        });
        writeAll(this.table, rows);
        const updated = this.applyFilters(rows).map((r) => this.project(r));
        let data: unknown = updated;
        if (this.wantSingle || this.wantMaybeSingle) {
          data = updated[0] || null;
          if (this.wantSingle && !updated[0]) {
            return { data: null, error: { message: 'No rows updated' } };
          }
        }
        return { data, error: null };
      }

      if (this.mutation?.type === 'delete') {
        const matchedIds = new Set(this.applyFilters(rows).map((r) => r.id));
        rows = rows.filter((r) => !matchedIds.has(r.id));
        writeAll(this.table, rows);
        return { data: null, error: null };
      }

      // select
      let result = this.applyFilters(rows).map((r) => this.project(r));
      if (this.orderCol) {
        const col = this.orderCol;
        result = [...result].sort((a, b) => {
          const av = a[col];
          const bv = b[col];
          if (av === bv) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return (av > bv ? 1 : -1) * (this.ascending ? 1 : -1);
        });
      }
      if (this.limitN != null) result = result.slice(0, this.limitN);
      if (this.wantSingle) {
        if (!result[0]) return { data: null, error: { message: 'No rows' } };
        return { data: result[0], error: null };
      }
      if (this.wantMaybeSingle) return { data: result[0] || null, error: null };
      return { data: result, error: null };
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : 'local db error' } };
    }
  }
}

export function isSessionDietTable(table: string) {
  return table === 'diet_plans' || table === 'exchange_diets';
}

export function localFrom(table: string) {
  return new LocalQuery(table);
}
