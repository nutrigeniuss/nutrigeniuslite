import { useEffect, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { useDebounce } from '@/hooks/useDebounce';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Apple, ArrowLeft, Beef, Droplets, Flame, Pencil, Plus, Search, Trash2, Wheat } from 'lucide-react';
import { logger, errorMessage } from '@/lib/logger';
import FoodFormModal from '@/components/foods/FoodFormModal';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { hasAdminAccess } from '@/lib/authz';
import { deleteFoodById, hideFoodFromMyList, listFoods, readHiddenMyFoodIds, type CatalogFoodRecord } from '@/lib/catalogData';
import { FOOD_CATEGORY_COLORS, FOOD_CATEGORY_FILTERS, normalizeFoodCategory } from '@/lib/foodCategories';
import { buildFoodReferenceView } from '@/lib/foodNutrients';
import { readMyFoodsCache, writeMyFoodsCache } from '@/lib/myFoodsCache';
import { queryKeys } from '@/lib/query-client';
import { normalizeSearchText } from '@/lib/searchText';

type HouseholdMeasure = {
  name: string;
  weight_grams: number;
};

type FoodRecord = CatalogFoodRecord & {
  household_measures?: HouseholdMeasure[] | null;
};

const isAdminPublishedMasterFood = (food: FoodRecord, userId?: string | null): boolean => {
  if (!userId) {
    return false;
  }

  return food.review_status === 'approved'
    && Boolean(food.published_at)
    && (food.submitted_by_nutritionist_id || food.nutritionist_id) === userId;
};

// Indicador discreto de estado: un punto de color en vez de una etiqueta de
// texto llamativa. Verde = aprobado/publicado, naranja = pendiente, rojo =
// rechazado. Pensado para nutricionistas recelosos con lo que agregan; el
// estado se comunica sutil (con tooltip para el detalle).
const getFoodReviewDot = (status?: FoodRecord['review_status'] | null): { label: string; dotClass: string } => {
  if (status === 'approved') {
    return { label: 'Publicado · Visible para todos', dotClass: 'bg-emerald-500' };
  }

  if (status === 'rejected') {
    return { label: 'Rechazado', dotClass: 'bg-red-500' };
  }

  return { label: 'Pendiente de validación', dotClass: 'bg-amber-500' };
};

const FoodStatusDot = ({ status }: { status?: FoodRecord['review_status'] | null }) => {
  const { label, dotClass } = getFoodReviewDot(status);
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${dotClass}`}
    />
  );
};

export default function MyFoods() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [category, setCategory] = useState('Todos');
  const [showForm, setShowForm] = useState(false);
  const [editFood, setEditFood] = useState<FoodRecord | null>(null);
  const [foodToDelete, setFoodToDelete] = useState<string | null>(null);

  const {
    data: foods = [],
    isLoading,
    error,
  } = useQuery<FoodRecord[]>({
    queryKey: queryKeys.foods(user?.id),
    enabled: Boolean(user?.id),
    // Arranque instantáneo desde localStorage: si hay cache válido (<24h)
    // la vista pinta los alimentos en frame 1; react-query refresca en
    // background y reescribe el cache cuando llegan los datos frescos.
    initialData: () => {
      const uid = user?.id;
      if (!uid) return undefined;
      const cached = readMyFoodsCache<FoodRecord>(uid);
      return cached
        ? cached.map((food) => ({ ...food, category: normalizeFoodCategory(food.category) }))
        : undefined;
    },
    queryFn: async () => {
      const result = await listFoods(user!.id, { includeAllReviewStatuses: true, scopeBySubmitter: true });
      const hidden = readHiddenMyFoodIds(user!.id);
      const normalized = (result.data as FoodRecord[])
        .filter((food) => !food.id || !hidden.has(String(food.id)))
        .map((food) => ({
          ...food,
          category: normalizeFoodCategory(food.category),
        }));
      writeMyFoodsCache(user!.id, normalized);
      return normalized;
    },
    // El estado (pendiente/aprobado/rechazado) cambia por acciones del admin en
    // otra sesión, así que en "Mis Alimentos" la exactitud importa más que
    // ahorrar un refetch: re-consultamos siempre al abrir la vista y al volver
    // a enfocar la ventana. La initialData del cache da el pintado instantáneo.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!error) return;
    logger.error('Error cargando alimentos:', { error: error instanceof Error ? error.message : String(error) });
    toast({
      title: 'No se pudieron cargar los alimentos',
      description: error instanceof Error ? error.message : 'Intenta nuevamente.',
      variant: 'destructive',
    });
  }, [error]);

  const loading = isLoading;

  const invalidateFoods = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.foods(user?.id) });
  };

  const handleDelete = (id: string, event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    setFoodToDelete(id);
  };

  const confirmDelete = async (): Promise<void> => {
    if (!foodToDelete) return;

    // Un alimento aprobado ya pertenece al catálogo maestro (comunidad): no se
    // puede borrar (RLS) y no debe quitárselo a los demás. Para el nutricionista
    // la acción se ve igual (papelera + "Eliminar"), pero por detrás solo lo
    // oculta de SU lista; sigue en la comunidad. Deliberadamente no se lo
    // explicamos en la UI (los nutris son recelosos con lo que aportan).
    const target = foods.find((food) => food.id === foodToDelete);
    const isApprovedCommunityFood = target?.review_status === 'approved';

    try {
      if (isApprovedCommunityFood) {
        await hideFoodFromMyList(foodToDelete, user?.id);
      } else {
        await deleteFoodById(foodToDelete, user?.id);
      }
    } catch (error) {
      logger.error('Error eliminando alimento', { error: errorMessage(error) });
      toast({
        title: 'No se pudo eliminar el alimento',
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
        variant: 'destructive',
      });
      return;
    }

    // Actualización optimista: quita el item del cache sin esperar refetch.
    queryClient.setQueryData<FoodRecord[]>(queryKeys.foods(user?.id), (previous) =>
      (previous || []).filter((food) => food.id !== foodToDelete),
    );
    invalidateFoods();
    setFoodToDelete(null);
    toast({
      title: 'Alimento eliminado',
      description: 'El alimento se quitó de tu catálogo.',
    });
  };

  // Ids de alimentos maestros que tienen una revisión pendiente/rechazada del
  // propio nutricionista: ocultamos el original y mostramos solo la revisión,
  // para no cargar la vista con dos entradas casi iguales.
  const supersededOriginalIds = new Set(
    foods.map((food) => food.supersedes_food_id).filter((value): value is string => Boolean(value)),
  );

  const ownFoods = foods.filter((food) => {
    if (supersededOriginalIds.has(food.id)) return false;
    if (hasAdminAccess(user as never) && isAdminPublishedMasterFood(food, user?.id)) return false;
    return true;
  });

  const filtered = ownFoods.filter((food) => {
    const matchSearch = normalizeSearchText(food.name).includes(normalizeSearchText(debouncedSearch));
    const matchCategory = category === 'Todos' || food.category === category;
    return matchSearch && matchCategory;
  });

  const visibleFoods = filtered;

  const personalFoodsCount = ownFoods.length;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link to="/app" className="ng-muted mb-2 inline-flex items-center gap-1 hover:text-brand-500">
            <ArrowLeft className="h-4 w-4" /> Calculadora
          </Link>
          <h1 className="ng-page-title">Mis Alimentos</h1>
          <p className="ng-muted mt-0.5">
            {personalFoodsCount} alimento{personalFoodsCount !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex w-full items-center gap-2 lg:w-auto">
          <button
            onClick={() => {
              setEditFood(null);
              setShowForm(true);
            }}
            className="ng-btn-primary h-10 w-full px-4 text-sm lg:w-auto"
          >
            <Plus className="w-4 h-4" />
            Nuevo alimento
          </button>
        </div>
      </div>

      <div className="mb-4 space-y-3 ng-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-500" />
          <input
            type="text"
            aria-label="Buscar alimento"
            placeholder="Buscar alimento por nombre..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="ng-input !mt-0 pl-9"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {FOOD_CATEGORY_FILTERS.map((itemCategory) => (
            <button
              key={itemCategory}
              onClick={() => setCategory(itemCategory)}
              className={category === itemCategory ? 'ng-pill ng-pill-active' : 'ng-pill ng-pill-idle'}
            >
              {itemCategory}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Cargando...</div>
      ) : visibleFoods.length === 0 ? (
        <div className="text-center py-20">
          <Apple className="w-14 h-14 text-[#c7cdfd] mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            {personalFoodsCount === 0 ? 'Tu catálogo de alimentos está vacío' : 'No hay alimentos que coincidan'}
          </p>
          {personalFoodsCount === 0 && (
            <button
              onClick={() => {
                setEditFood(null);
                setShowForm(true);
              }}
              className="mt-4 text-brand-500 text-sm font-medium hover:underline"
            >
              + Agregar primer alimento
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {visibleFoods.map((food) => {
              const referenceFood = buildFoodReferenceView(food);

              return (
                <article key={food.id} className="ng-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <FoodStatusDot status={food.review_status} />
                        <p className="text-sm font-semibold text-slate-800">{food.name}</p>
                        {food.supersedes_food_id ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700" title="Cambio propuesto a un alimento ya publicado">
                            revisión
                          </span>
                        ) : null}
                      </div>
                      {food.category ? (
                        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${FOOD_CATEGORY_COLORS[food.category] || 'bg-slate-100 text-slate-600'}`}>
                          {food.category}
                        </span>
                      ) : null}
                      {food.notes && <p className="mt-2 text-xs text-slate-400">{food.notes}</p>}
                      {(food.household_measures || []).length > 0 ? (
                        <p className="mt-1 text-[10px] text-slate-400">
                          {(food.household_measures || []).map((measure) => `${measure.name} (${measure.weight_grams}g)`).join(' · ')}
                        </p>
                      ) : null}
                      {food.review_status === 'rejected' && food.review_notes ? (
                        <p className="mt-1 text-[10px] text-rose-500">{food.review_notes}</p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditFood(food);
                          setShowForm(true);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 transition-colors hover:bg-brand-50"
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-500 hover:text-brand-500" />
                      </button>
                      <button
                        onClick={(event) => void handleDelete(food.id, event)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 transition-colors hover:bg-red-100"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-slate-500 hover:text-red-500" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-[10px] bg-[#f7f8ff] p-3 text-center">
                    <div>
                      <p className="text-[11px] text-slate-400">Porción</p>
                      <p className="text-sm font-semibold text-slate-600">100g</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400">Kcal</p>
                      <p className="text-sm font-semibold text-coral-700">{referenceFood.calories ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400">Proteína</p>
                      <p className="text-sm font-semibold text-energy-600">{referenceFood.protein ?? '—'}g</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400">Carbohidratos</p>
                      <p className="text-sm font-semibold text-brand-500">{referenceFood.carbs ?? '—'}g</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[11px] text-slate-400">Grasas</p>
                      <p className="text-sm font-semibold text-coral-700">{referenceFood.fat ?? '—'}g</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="ng-card hidden overflow-x-auto lg:block">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 border-b border-slate-100 bg-[#fafbfd] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <span>Nombre</span>
                <span>Categoría</span>
                <span className="text-center">Porción</span>
                <span className="text-center flex items-center justify-center gap-1"><Flame className="w-3 h-3 text-coral-700" /> Kcal</span>
                <span className="text-center flex items-center justify-center gap-1"><Beef className="w-3 h-3 text-energy-600" /> Prot</span>
                <span className="text-center flex items-center justify-center gap-1"><Wheat className="w-3 h-3 text-brand-500" /> HC</span>
                <span className="text-center flex items-center justify-center gap-1"><Droplets className="w-3 h-3 text-coral-700" /> Gras</span>
                <span></span>
              </div>

              {visibleFoods.map((food, index) => {
                const referenceFood = buildFoodReferenceView(food);

                return (
                <div
                  key={food.id}
                  className={`grid grid-cols-[2fr_1.2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3.5 items-center hover:bg-slate-50 transition-colors group ${
                    index !== 0 ? 'border-t border-slate-50' : ''
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <FoodStatusDot status={food.review_status} />
                      <p className="text-sm font-medium text-slate-800 line-clamp-1">{food.name}</p>
                      {food.supersedes_food_id ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700" title="Cambio propuesto a un alimento ya publicado">
                          revisión
                        </span>
                      ) : null}
                    </div>
                    {food.notes && <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{food.notes}</p>}
                    {(food.household_measures || []).length > 0 && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {(food.household_measures || []).map((measure) => `${measure.name} (${measure.weight_grams}g)`).join(' · ')}
                      </p>
                    )}
                    {food.review_status === 'rejected' && food.review_notes ? (
                      <p className="text-[10px] text-rose-500 mt-1">{food.review_notes}</p>
                    ) : null}
                  </div>

                  <div>
                    {food.category && (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${FOOD_CATEGORY_COLORS[food.category] || 'bg-slate-100 text-slate-600'}`}>
                        {food.category}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-500 text-center">100g</p>
                  <p className="text-sm font-medium text-coral-700 text-center">{referenceFood.calories ?? '—'}</p>
                  <p className="text-sm text-energy-600 text-center">{referenceFood.protein ?? '—'}g</p>
                  <p className="text-sm text-brand-500 text-center">{referenceFood.carbs ?? '—'}g</p>
                  <p className="text-sm text-coral-700 text-center">{referenceFood.fat ?? '—'}g</p>

                  <div className="flex items-center gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
                    <button
                      onClick={() => {
                        setEditFood(food);
                        setShowForm(true);
                      }}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-brand-50 flex items-center justify-center transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-500 hover:text-brand-500" />
                    </button>
                    <button
                      onClick={(event) => void handleDelete(food.id, event)}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-red-100 flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-slate-500 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              );})}
            </div>
          </div>
        </>
      )}

      {showForm && (
        <FoodFormModal
          food={editFood}
          nutritionistId={user?.id}
          onClose={() => {
            setShowForm(false);
            setEditFood(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditFood(null);
            invalidateFoods();
          }}
        />
      )}

      <ConfirmationDialog
        open={Boolean(foodToDelete)}
        onOpenChange={(open: boolean) => {
          if (!open) setFoodToDelete(null);
        }}
        title="Eliminar alimento"
        description="Esta acción quitará el alimento de tu catálogo y no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}