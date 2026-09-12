import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Trash2, Upload } from 'lucide-react';
import BackNav from '@/components/BackNav';
import FoodReviewQueue from '@/components/admin/FoodReviewQueue';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { clearFoodCatalogCache } from '@/lib/foodCatalogCache';
import { FOODS_JSON_EXAMPLE } from '@/lib/localFoodCatalog';
import { parseOfficialFoodsWorkbook } from '@/lib/readOfficialFoodsXlsx';
import { importMasterFoodsBatch } from '@/lib/importMasterFoodsBatch';

type FoodRow = {
  id: string;
  name: string;
  category: string | null;
  portion_grams: number | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  nutritionist_id: string | null;
};

type AdminFoodsTab = 'catalog' | 'pending' | 'rejected';

/** Solo Maestro: base maestra + bandeja de revisión. */
export default function FoodsCatalogPage() {
  const { admin, user } = useAuth();
  const [tab, setTab] = useState<AdminFoodsTab>('catalog');
  const [foods, setFoods] = useState<FoodRow[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Supabase no configurado');
      return;
    }
    const { data, error: qErr } = await supabase
      .from('foods')
      .select('id, name, category, portion_grams, calories, protein, carbs, fat, nutritionist_id')
      .is('nutritionist_id', null)
      .order('name');
    if (qErr) {
      setError(qErr.message);
      return;
    }
    setFoods((data as FoodRow[]) || []);
    setError(null);
    clearFoodCatalogCache();
  }, []);

  useEffect(() => {
    if (tab === 'catalog') void load();
  }, [load, tab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return foods;
    return foods.filter((f) => f.name.toLowerCase().includes(q) || (f.category || '').toLowerCase().includes(q));
  }, [foods, query]);

  if (!admin) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <p className="text-sm text-slate-500">Solo el módulo maestro puede subir la base de alimentos.</p>
        <Link to="/app" className="mt-4 inline-block text-sm font-semibold text-brand-500">Volver</Link>
      </div>
    );
  }

  const onImportXlsx = async (file: File) => {
    if (!user?.id) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    setProgress(null);
    try {
      const { foods: parsedFoods, skippedRows } = await parseOfficialFoodsWorkbook(file);
      if (parsedFoods.length === 0) {
        throw new Error('No se encontraron alimentos en el Excel.');
      }
      const { insertedCount, updatedCount } = await importMasterFoodsBatch(parsedFoods, {
        submittedByUserId: user.id,
        onProgress: (done, total) => {
          setProgress(`Guardando ${done}/${total}…`);
        },
      });
      await load();
      setMessage(
        `${parsedFoods.length} alimentos · ${insertedCount} nuevos · ${updatedCount} actualizados · ${skippedRows} filas omitidas`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo importar el Excel');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const onImportFile = async (file: File, mode: 'replace' | 'merge') => {
    if (!supabase || !user?.id) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    setProgress(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const rows = Array.isArray(parsed) ? parsed : parsed?.foods;
      if (!Array.isArray(rows)) throw new Error('El JSON debe ser un array de alimentos');

      if (mode === 'replace') {
        const { error: delErr } = await supabase.from('foods').delete().is('nutritionist_id', null);
        if (delErr) throw delErr;
      }

      const payload = rows
        .filter((r: { name?: string }) => r && String(r.name || '').trim())
        .map((r: Record<string, unknown>) => ({
          name: String(r.name).trim(),
          category: (r.category as string) || null,
          country: (r.country as string) || 'PE',
          portion_grams: Number(r.portion_grams) || 100,
          calories: Number(r.calories) || 0,
          protein: Number(r.protein) || 0,
          carbs: Number(r.carbs) || 0,
          fat: Number(r.fat) || 0,
          fiber: r.fiber == null ? null : Number(r.fiber) || 0,
          sodium: r.sodium == null ? null : Number(r.sodium) || 0,
          notes: (r.notes as string) || null,
          household_measures: Array.isArray(r.household_measures) ? r.household_measures : [],
          nutritionist_id: null,
          review_status: 'approved',
          published_at: new Date().toISOString(),
          submitted_by_nutritionist_id: user.id,
        }));

      const chunk = 100;
      for (let i = 0; i < payload.length; i += chunk) {
        const { error: insErr } = await supabase.from('foods').insert(payload.slice(i, i + chunk));
        if (insErr) throw insErr;
      }

      await load();
      setMessage(`Importados ${payload.length} alimentos al catálogo maestro (Supabase).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo importar');
    } finally {
      setBusy(false);
    }
  };

  const removeFood = async (row: FoodRow) => {
    if (!supabase) return;
    const { error: delErr } = await supabase.from('foods').delete().eq('id', row.id);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    await load();
  };

  const downloadExample = () => {
    const blob = new Blob([JSON.stringify(FOODS_JSON_EXAMPLE, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alimentos-ejemplo.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { key: AdminFoodsTab; label: string }[] = [
    { key: 'catalog', label: 'Catálogo' },
    { key: 'pending', label: 'Pendientes' },
    { key: 'rejected', label: 'Rechazados' },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <BackNav to="/admin" label="Volver al módulo maestro" />
          <h1 className="ng-page-title mt-3">Base de alimentos</h1>
          <p className="ng-muted mt-1">
            Catálogo maestro y revisión de aportes de nutricionistas.
          </p>
        </div>
        {tab === 'catalog' ? (
          <button type="button" onClick={downloadExample} className="ng-btn-ghost">
            <Download className="h-3.5 w-3.5" /> Ejemplo JSON
          </button>
        ) : null}
      </div>

      <div className="mb-5 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                setMessage(null);
                setError(null);
              }}
              className={`relative px-3 pb-3 pt-1 text-sm font-semibold transition ${
                active ? 'text-brand-500' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
              {active ? <span className="absolute -bottom-px left-2 right-2 h-0.5 rounded-t bg-brand-500" /> : null}
            </button>
          );
        })}
      </div>

      {message ? <p className="mb-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mb-3 rounded-2xl bg-coral-50 px-4 py-3 text-sm text-coral-600">{error}</p> : null}

      {tab === 'pending' || tab === 'rejected' ? (
        <FoodReviewQueue
          status={tab}
          onBusyChange={setBusy}
          onError={setError}
          onMessage={setMessage}
        />
      ) : (
        <>
          <section className="ng-card mb-5 p-4 sm:p-5">
            <p className="ng-section-title">Importar Excel (plantilla oficial)</p>
            <p className="ng-muted mt-1">
              Misma plantilla del SaaS. Filas repetidas = medidas caseras. Si el nombre ya existe se reemplaza; si no, se agrega.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <label className={`ng-btn-primary cursor-pointer ${busy ? 'opacity-50' : ''}`}>
                <Upload className="h-3.5 w-3.5" /> Subir .xlsx
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onImportXlsx(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            {progress ? <p className="ng-muted mt-2">{progress}</p> : null}
          </section>

          <section className="ng-card mb-5 p-4 sm:p-5">
            <p className="ng-section-title">Importar JSON</p>
            <p className="ng-muted mt-1">
              name, calories, protein, carbs, fat, portion_grams, category (opcional).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <label className={`ng-btn-primary cursor-pointer ${busy ? 'opacity-50' : ''}`}>
                <Upload className="h-3.5 w-3.5" /> Reemplazar maestros
                <input type="file" accept="application/json,.json" className="hidden" disabled={busy} onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onImportFile(file, 'replace');
                  e.target.value = '';
                }} />
              </label>
              <label className={`ng-btn-ghost cursor-pointer ${busy ? 'opacity-50' : ''}`}>
                <Upload className="h-3.5 w-3.5" /> Fusionar
                <input type="file" accept="application/json,.json" className="hidden" disabled={busy} onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onImportFile(file, 'merge');
                  e.target.value = '';
                }} />
              </label>
            </div>
          </section>

          <section className="ng-card p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="ng-section-title">{foods.length} alimentos maestros</p>
              <input className="ng-input !mt-0 !w-auto rounded-full px-3 py-1.5 text-xs" placeholder="Filtrar…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="max-h-[28rem] space-y-2 overflow-y-auto">
              {filtered.map((food) => (
                <div key={food.id} className="flex items-start justify-between gap-3 rounded-2xl bg-[#fafbfd] px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{food.name}</p>
                    <p className="ng-muted">
                      {food.category || 'Sin categoría'} · {food.portion_grams || 100}g · {food.calories || 0} kcal · P{food.protein || 0} C{food.carbs || 0} G{food.fat || 0}
                    </p>
                  </div>
                  <button type="button" className="rounded-full p-2 text-coral-500 hover:bg-white disabled:opacity-50" disabled={busy} onClick={() => void removeFood(food)} aria-label={`Eliminar ${food.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {filtered.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">Sin base maestra todavía</p> : null}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
