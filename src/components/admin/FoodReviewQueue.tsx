import { useCallback, useEffect, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import FoodFormModal from '@/components/foods/FoodFormModal';
import {
  type CatalogFoodRecord,
  incorporateEditedFood,
  listReviewQueueFoods,
  updateFoodReview,
} from '@/lib/catalogData';
import { clearFoodCatalogCache } from '@/lib/foodCatalogCache';

type QueueStatus = 'pending' | 'rejected';

type Props = {
  status: QueueStatus;
  onBusyChange?: (busy: boolean) => void;
  onError?: (message: string | null) => void;
  onMessage?: (message: string | null) => void;
};

export default function FoodReviewQueue({ status, onBusyChange, onError, onMessage }: Props) {
  const [rows, setRows] = useState<CatalogFoodRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [editSource, setEditSource] = useState<CatalogFoodRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    onError?.(null);
    try {
      const result = await listReviewQueueFoods({
        status,
        page: 0,
        pageSize: 100,
        searchTerm: search.trim() || undefined,
      });
      setRows(result.data);
      setTotal(result.total);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'No se pudo cargar la bandeja');
    } finally {
      setLoading(false);
    }
  }, [onError, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const withBusy = async (fn: () => Promise<void>) => {
    onBusyChange?.(true);
    onError?.(null);
    try {
      await fn();
      clearFoodCatalogCache();
      await load();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Operación fallida');
    } finally {
      onBusyChange?.(false);
    }
  };

  const approve = (food: CatalogFoodRecord) =>
    withBusy(async () => {
      await updateFoodReview(food.id, { review_status: 'approved', review_notes: null });
      onMessage?.(`“${food.name}” aprobado · ya es de todos`);
    });

  const reject = (food: CatalogFoodRecord) =>
    withBusy(async () => {
      await updateFoodReview(food.id, {
        review_status: 'rejected',
        review_notes: rejectNotes[food.id]?.trim() || null,
      });
      onMessage?.(`“${food.name}” rechazado · el nutri lo conserva privado`);
    });

  return (
    <section className="ng-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="ng-section-title">
            {status === 'pending' ? 'Pendientes' : 'Rechazados'} · {total}
          </p>
          <p className="ng-muted mt-1">
            {status === 'pending'
              ? 'Aprobar publica el mismo alimento. Editar e incorporar crea la versión maestra y deja la del nutri privada.'
              : 'Últimos 30 días. Editar e incorporar rescata una versión corregida a la base maestra.'}
          </p>
        </div>
        <input
          className="ng-input !mt-0 !w-auto rounded-full px-3 py-1.5 text-xs"
          placeholder="Filtrar…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          {status === 'pending' ? 'No hay pendientes' : 'No hay rechazados recientes'}
        </p>
      ) : (
        <div className="max-h-[32rem] space-y-3 overflow-y-auto">
          {rows.map((food) => (
            <div key={food.id} className="rounded-2xl bg-[#fafbfd] px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{food.name}</p>
                  <p className="ng-muted">
                    {food.category || 'Sin categoría'} · {food.portion_grams || 100}g · {food.calories || 0} kcal
                    · P{food.protein || 0} C{food.carbs || 0} G{food.fat || 0}
                  </p>
                  {food.nutritionist_id ? (
                    <p className="mt-1 text-[11px] text-slate-400">Nutri: {food.nutritionist_id.slice(0, 8)}…</p>
                  ) : null}
                  {food.review_notes ? (
                    <p className="mt-1 text-[11px] text-rose-500">{food.review_notes}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {status === 'pending' ? (
                    <>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600"
                        onClick={() => void approve(food)}
                      >
                        <Check className="h-3.5 w-3.5" /> Aprobar
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-600"
                        onClick={() => setEditSource(food)}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Editar e incorporar
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full bg-coral-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-coral-600"
                        onClick={() => void reject(food)}
                      >
                        <X className="h-3.5 w-3.5" /> Rechazar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-600"
                      onClick={() => setEditSource(food)}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar e incorporar
                    </button>
                  )}
                </div>
              </div>
              {status === 'pending' ? (
                <input
                  className="ng-input mt-2 !rounded-xl text-xs"
                  placeholder="Nota de rechazo (opcional)"
                  value={rejectNotes[food.id] || ''}
                  onChange={(e) =>
                    setRejectNotes((prev) => ({ ...prev, [food.id]: e.target.value }))
                  }
                />
              ) : null}
            </div>
          ))}
        </div>
      )}

      {editSource ? (
        <FoodFormModal
          food={editSource}
          title="Editar e incorporar a la base maestra"
          onClose={() => setEditSource(null)}
          onSubmitOverride={async (data) => {
            await incorporateEditedFood(editSource.id, data as CatalogFoodRecord);
          }}
          onSaved={() => {
            setEditSource(null);
            clearFoodCatalogCache();
            onMessage?.('Versión corregida en la base maestra · el original del nutri queda privado');
            void load();
          }}
        />
      ) : null}
    </section>
  );
}
