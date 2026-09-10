import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  Layers,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Database,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';
import {
  buildMergedGroups,
  createExchangeFood,
  deleteExchangeFood,
  getGroupLabel,
  listExchangeGroupKeys,
  loadExchangeGroups,
  seedExchangeFoodsFromStatic,
  updateExchangeFood,
  type ExchangeFood,
  type ExchangeFoodInput,
  type ExchangeGroup,
} from '@/lib/exchangeFoodsData';
import { hydrateExchangeGroupsRuntime } from '@/lib/exchangeRuntime';
import { normalizeSearchText } from '@/lib/searchText';
import { EXCHANGE_GROUPS as STATIC_EXCHANGE_GROUPS } from '@/components/exchanges/exchangeData';

// Visor + editor del catálogo de alimentos por intercambios.
// Solo el administrador puede modificar (RLS lo refuerza); los demás usuarios ven el resultado mergeado.

type EditorState = {
  open: boolean;
  mode: 'create' | 'edit';
  groupKey: string;
  foodId: string | null;
  name: string;
  gramsRaw: string;
  gramsCooked: string;
  measure: string;
};

const emptyEditor = (groupKey = ''): EditorState => ({
  open: false,
  mode: 'create',
  groupKey,
  foodId: null,
  name: '',
  gramsRaw: '',
  gramsCooked: '',
  measure: '',
});

const formatGrams = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const num = Number(value);
  return Number.isInteger(num) ? `${num} g` : `${num.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')} g`;
};

const parseOptionalNumber = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(',', '.'));
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return parsed;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ExchangeFoodCatalog() {
  const [groups, setGroups] = useState<ExchangeGroup[]>(() => buildMergedGroups([]));
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<EditorState>(emptyEditor());
  const [isSaving, setIsSaving] = useState(false);
  const [foodToDelete, setFoodToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  const groupKeys = useMemo(() => listExchangeGroupKeys(), []);

  // ¿Hay al menos un grupo con foods 'custom'? Sirve para sugerir la siembra inicial.
  const hasAnyCustom = useMemo(
    () => groups.some((group) => group.foods.some((food) => food.source === 'custom')),
    [groups],
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const next = await loadExchangeGroups();
      setGroups(next);
      // Notifica al resto de la app (creador de dietas, vista del paciente) los nuevos datos.
      void hydrateExchangeGroupsRuntime({ force: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar el catálogo.';
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const groupTabs = useMemo(
    () => [
      { key: 'all', label: 'Todos los grupos' },
      ...groups.map((g) => ({ key: g.key, label: g.shortLabel || g.label })),
    ],
    [groups],
  );

  // Aplica búsqueda + filtro por grupo.
  const filteredGroups = useMemo(() => {
    const term = normalizeSearchText(search);
    const base = selectedGroup === 'all' ? groups : groups.filter((g) => g.key === selectedGroup);
    if (!term) return base;
    return base
      .map((group) => ({
        ...group,
        foods: group.foods.filter((food) => normalizeSearchText(food.name).includes(term)),
      }))
      .filter((group) => group.foods.length > 0);
  }, [selectedGroup, search, groups]);

  const totalFoods = useMemo(() => groups.reduce((acc, g) => acc + g.foods.length, 0), [groups]);
  const visibleFoods = useMemo(
    () => filteredGroups.reduce((acc, g) => acc + g.foods.length, 0),
    [filteredGroups],
  );

  const openCreate = (groupKey?: string) => {
    setEditor({
      ...emptyEditor(groupKey || (selectedGroup === 'all' ? groupKeys[0] : selectedGroup)),
      open: true,
      mode: 'create',
    });
  };

  const openEdit = (groupKey: string, food: ExchangeFood) => {
    setEditor({
      open: true,
      mode: 'edit',
      groupKey,
      foodId: food.id,
      name: food.name,
      gramsRaw: food.grams_raw === null ? '' : String(food.grams_raw),
      gramsCooked: food.grams_cooked === null ? '' : String(food.grams_cooked),
      measure: food.measure || '',
    });
  };

  const closeEditor = () => setEditor((prev) => ({ ...prev, open: false }));

  // Antes de editar/borrar un alimento estático debemos copiarlo a la tabla. Si el admin
  // edita por primera vez, ofrecemos sembrar el catálogo completo para evitar mezclas raras.
  const ensureSeeded = useCallback(async (): Promise<boolean> => {
    if (hasAnyCustom) return true;
    try {
      setIsSeeding(true);
      const result = await seedExchangeFoodsFromStatic();
      if (!result.skipped) {
        toast({
          title: 'Catálogo migrado a Supabase',
          description: `Se importaron ${result.inserted} alimentos del catálogo oficial. Ya puedes editarlos.`,
        });
      }
      await refresh();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo migrar el catálogo.';
      toast({ title: 'Error al migrar catálogo', description: message, variant: 'destructive' });
      return false;
    } finally {
      setIsSeeding(false);
    }
  }, [hasAnyCustom, refresh]);

  /**
   * Guarda los cambios de un alimento que ya existía.
   *
   * Los del catálogo OFICIAL no viven en la base: vienen de un archivo estático
   * y su id no es un uuid. Para poder editarlos hay que sembrar antes todo el
   * catálogo en la base y luego buscar el gemelo por nombre. Si tras sembrar no
   * aparece (nombre cambiado, grupo distinto), se crea en vez de perder el
   * cambio del nutricionista.
   *
   * Devuelve `false` si la siembra falló, para que quien llama sepa que NO debe
   * cerrar el editor.
   */
  const guardarAlimentoExistente = async (
    foodId: string,
    payload: ExchangeFoodInput,
  ): Promise<boolean> => {
    if (UUID_RE.test(foodId)) {
      await updateExchangeFood(foodId, payload);
      return true;
    }

    const sembrado = await ensureSeeded();
    if (!sembrado) return false;

    const actualizados = await loadExchangeGroups();
    const gemelo = actualizados
      .find((g) => g.key === editor.groupKey)
      ?.foods.find(
        (f) => f.source === 'custom' && f.name.toLowerCase() === editor.name.trim().toLowerCase(),
      );

    if (gemelo) await updateExchangeFood(gemelo.id, payload);
    else await createExchangeFood(payload);

    return true;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor.name.trim()) {
      toast({
        title: 'Falta el nombre',
        description: 'El alimento debe tener un nombre.',
        variant: 'destructive',
      });
      return;
    }
    const gramsRaw = parseOptionalNumber(editor.gramsRaw);
    const gramsCooked = parseOptionalNumber(editor.gramsCooked);
    if (gramsRaw === null && gramsCooked === null) {
      toast({
        title: 'Faltan gramos',
        description: 'Indica al menos los gramos en crudo o cocido.',
        variant: 'destructive',
      });
      return;
    }

    const payload: ExchangeFoodInput = {
      group_key: editor.groupKey,
      name: editor.name,
      grams_raw: gramsRaw,
      grams_cooked: gramsCooked,
      measure: editor.measure,
    };

    try {
      setIsSaving(true);
      if (editor.mode === 'create') {
        await createExchangeFood(payload);
        toast({ title: 'Alimento agregado', description: `${editor.name} se añadió al catálogo.` });
      } else if (editor.foodId) {
        const guardado = await guardarAlimentoExistente(editor.foodId, payload);
        // La siembra pudo fallar. En ese caso NO se cierra el editor: el
        // nutricionista se queda donde estaba, con lo que escribió, y puede
        // reintentar sin perder el trabajo.
        if (!guardado) return;
        toast({ title: 'Cambios guardados', description: `${editor.name} se actualizó correctamente.` });
      }
      closeEditor();
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el alimento.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!foodToDelete) return;
    try {
      setIsDeleting(true);
      await deleteExchangeFood(foodToDelete.id);
      toast({ title: 'Alimento eliminado', description: `${foodToDelete.name} se quitó del catálogo.` });
      setFoodToDelete(null);
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSeedClick = async () => {
    await ensureSeeded();
  };

  const totalStaticFoods = useMemo(
    () =>
      (STATIC_EXCHANGE_GROUPS as Array<{ foods: unknown[] }>).reduce(
        (acc, g) => acc + g.foods.length,
        0,
      ),
    [],
  );

  return (
    <section className="space-y-5">
      {/* Encabezado con resumen y acciones globales */}
      <header className="rounded-[16px] border border-[#e2e8f0]/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Base de alimentos por intercambios</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Catálogo maestro usado por el creador de dietas por intercambios y por la vista del paciente.
              Como administrador puedes agregar, editar o quitar alimentos en cada grupo. Los aportes
              nutricionales del grupo (kcal, proteínas, carbohidratos, grasas) son fijos y no se editan aquí.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!hasAnyCustom ? (
              <button
                type="button"
                onClick={() => void handleSeedClick()}
                disabled={isSeeding}
                className="inline-flex items-center gap-2 rounded-[10px] border border-[#d7dbff] bg-white px-4 py-2.5 text-sm font-semibold text-brand-500 transition-colors hover:bg-[#f7f8ff] disabled:opacity-60"
                title={`Copia los ${totalStaticFoods} alimentos del catálogo oficial a Supabase para poder editarlos.`}
              >
                {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                {isSeeding ? 'Migrando...' : 'Migrar catálogo oficial'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => openCreate()}
              className="inline-flex items-center gap-2 rounded-[10px] bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              <Plus className="h-4 w-4" />
              Nuevo alimento
            </button>
          </div>
        </div>

        {/* Tarjetas resumen */}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-[14px] bg-[#f7f8ff] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Alimentos visibles</p>
            <p className="mt-1 text-[24px] font-bold text-slate-900">{isLoading ? '...' : visibleFoods}</p>
            <p className="text-xs text-slate-500">de {totalFoods} en total</p>
          </div>
          <div className="rounded-[14px] bg-[#f7f8ff] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Grupos activos</p>
            <p className="mt-1 text-[24px] font-bold text-slate-900">{groups.length}</p>
            <p className="text-xs text-slate-500">categorías estandarizadas</p>
          </div>
          <div className="rounded-[14px] bg-[#f7f8ff] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Estado del catálogo</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {hasAnyCustom ? (
                <span className="inline-flex items-center gap-1 text-energy-700">
                  <CheckCircle2 className="h-4 w-4" /> Editable en Supabase
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[#c67a00]">
                  <AlertCircle className="h-4 w-4" /> Mostrando catálogo oficial
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {hasAnyCustom
                ? 'Tus cambios se sincronizan con todos los nutricionistas.'
                : 'Migra el catálogo a Supabase para empezar a editar.'}
            </p>
          </div>
        </div>

        {loadError ? (
          <div className="mt-4 rounded-[14px] border border-[#ffd7d5] bg-coral-50 px-4 py-3 text-sm text-[#b8403c]">
            {loadError}
          </div>
        ) : null}
      </header>

      {/* Buscador y pestañas de grupo */}
      <div className="rounded-[16px] border border-[#e2e8f0]/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-500" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar alimento por nombre"
            className="w-full rounded-[10px] border border-[#dde3f0]/80 bg-[#f7f8ff] py-2.5 pl-9 pr-4 text-sm text-slate-700 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {groupTabs.map((tab) => {
            const isActive = selectedGroup === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSelectedGroup(tab.key)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${
                  isActive ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Listado por grupo */}
      <div className="space-y-5">
        {isLoading ? (
          <div className="rounded-[16px] border border-dashed border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-brand-500" />
            Cargando catálogo...
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400">
            No se encontraron alimentos con ese criterio.
          </div>
        ) : (
          filteredGroups.map((group) => (
            <article
              key={group.key}
              className="overflow-hidden rounded-[16px] border border-slate-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
            >
              <header
                className={`flex flex-col gap-2 px-5 py-4 md:flex-row md:items-center md:justify-between ${
                  group.headerBg || 'bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-800">
                    {getGroupLabel(group.key, 'patient')}
                  </h3>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {group.foods.length} alimentos
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
                  <span className="rounded-full bg-white px-2.5 py-1">{group.kcal} kcal</span>
                  <span className="rounded-full bg-white px-2.5 py-1">{group.protein} g prot</span>
                  <span className="rounded-full bg-white px-2.5 py-1">{group.carbs} g cho</span>
                  <span className="rounded-full bg-white px-2.5 py-1">{group.fat} g gr</span>
                  <button
                    type="button"
                    onClick={() => openCreate(group.key)}
                    className="ml-1 inline-flex items-center gap-1 rounded-[8px] bg-brand-500 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-brand-600"
                  >
                    <Plus className="h-3 w-3" />
                    Agregar
                  </button>
                </div>
              </header>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-3">Alimento</th>
                      <th className="px-5 py-3">Crudo</th>
                      <th className="px-5 py-3">Cocido</th>
                      <th className="px-5 py-3">Medida casera</th>
                      <th className="px-5 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.foods.map((food) => (
                      <tr
                        key={`${group.key}-${food.id}`}
                        className="border-t border-slate-100 hover:bg-slate-50/40"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">{food.name}</span>
                            {food.source === 'static' ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Oficial
                              </span>
                            ) : (
                              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-500">
                                Personalizado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{formatGrams(food.grams_raw)}</td>
                        <td className="px-5 py-3 text-slate-600">{formatGrams(food.grams_cooked)}</td>
                        <td className="px-5 py-3 text-slate-500">{food.measure || '—'}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(group.key, food)}
                              className="inline-flex items-center gap-1 rounded-[8px] bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </button>
                            {food.source === 'custom' ? (
                              <button
                                type="button"
                                onClick={() => setFoodToDelete({ id: food.id, name: food.name })}
                                className="inline-flex items-center gap-1 rounded-[8px] bg-coral-50 px-2.5 py-1.5 text-xs font-semibold text-coral-700 transition-colors hover:bg-coral-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Eliminar
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Modal de creación / edición */}
      {editor.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-[16px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {editor.mode === 'create' ? 'Nuevo alimento' : 'Editar alimento'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Los cambios se guardan en Supabase y son visibles para todos los nutricionistas.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-[8px] bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-200"
              >
                Cerrar
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grupo</label>
                <select
                  value={editor.groupKey}
                  onChange={(event) => setEditor((prev) => ({ ...prev, groupKey: event.target.value }))}
                  className="mt-1 w-full rounded-[10px] border border-[#dde3f0]/80 bg-[#f7f8ff] px-4 py-2.5 text-sm text-slate-700 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                >
                  {groupKeys.map((key) => (
                    <option key={key} value={key}>
                      {getGroupLabel(key, 'patient')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</label>
                <input
                  type="text"
                  value={editor.name}
                  onChange={(event) => setEditor((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Ej. Arroz blanco"
                  className="mt-1 w-full rounded-[10px] border border-[#dde3f0]/80 bg-[#f7f8ff] px-4 py-2.5 text-sm text-slate-700 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Gramos en crudo
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={editor.gramsRaw}
                    onChange={(event) => setEditor((prev) => ({ ...prev, gramsRaw: event.target.value }))}
                    placeholder="20"
                    className="mt-1 w-full rounded-[10px] border border-[#dde3f0]/80 bg-[#f7f8ff] px-4 py-2.5 text-sm text-slate-700 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Gramos en cocido
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={editor.gramsCooked}
                    onChange={(event) =>
                      setEditor((prev) => ({ ...prev, gramsCooked: event.target.value }))
                    }
                    placeholder="48"
                    className="mt-1 w-full rounded-[10px] border border-[#dde3f0]/80 bg-[#f7f8ff] px-4 py-2.5 text-sm text-slate-700 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Medida casera</label>
                <input
                  type="text"
                  value={editor.measure}
                  onChange={(event) => setEditor((prev) => ({ ...prev, measure: event.target.value }))}
                  placeholder="2 cdas crudas o 1/3 taza cocida"
                  className="mt-1 w-full rounded-[10px] border border-[#dde3f0]/80 bg-[#f7f8ff] px-4 py-2.5 text-sm text-slate-700 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={isSaving}
                  className="rounded-[10px] bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isSaving
                    ? 'Guardando...'
                    : editor.mode === 'create'
                      ? 'Agregar alimento'
                      : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmationDialog
        open={!!foodToDelete}
        onOpenChange={(open: boolean) => {
          if (!open) setFoodToDelete(null);
        }}
        title="Eliminar alimento"
        description={
          foodToDelete
            ? `¿Seguro que quieres eliminar "${foodToDelete.name}" del catálogo? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel={isDeleting ? 'Eliminando...' : 'Eliminar'}
        onConfirm={() => {
          void handleDelete();
        }}
      />
    </section>
  );
}
