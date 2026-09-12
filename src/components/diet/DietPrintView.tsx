import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DietEditorItem, DietEditorMeal } from './dietEditorTypes';
import BackLink from '@/components/ui/back-link';
import { extractUsedRecipes } from '@/lib/extractUsedRecipes';
import { publicSiteLabel } from '@/lib/publicSite';
import { getCurrentLocale } from '@/lib/formatLocale';

type PrintRecipeIngredient = {
  name?: string;
  quantity?: number | string;
  unit?: string;
};

type PrintRecipe = {
  id?: string;
  name?: string;
  image_url?: string;
  description?: string;
  instructions?: string;
  prep_time?: number | string;
  cook_time?: number | string;
  difficulty?: string;
  servings?: number | string;
  calories_per_serving?: number;
  protein_per_serving?: number;
  carbs_per_serving?: number;
  fat_per_serving?: number;
  fiber_per_serving?: number;
  ingredients?: PrintRecipeIngredient[];
};

type MealGroup = {
  name: string | null;
  items: DietEditorItem[];
  isRecipe: boolean;
  imageUrl?: string;
  // recipe instance id, when the group came from an expanded recipe addition
  recipeInstanceId?: string;
};

type RecipeGroupMarker = {
  instance_id?: string;
  name?: string;
  image_url?: string;
};

type MealSectionProps = {
  meal: DietEditorMeal;
};

type DayPrintProps = {
  title: string;
  date: string;
  patientName?: string;
  meals: DietEditorMeal[];
  targetCalories: number;
  // Marca del nutricionista: logo + nombre de su clínica para personalizar el PDF.
  brandLogoUrl?: string | null;
  brandName?: string | null;
};

type DietPrintViewProps = DayPrintProps & {
  onClose: () => void;
  // Recipes catalog. The print view picks only the ones actually used in
  // the meals and renders one recipe card per unique recipe at the end.
  recipes?: PrintRecipe[];
};

const fmt = (value?: number | null): number => (value ? Math.round(value * 10) / 10 : 0);

const groupMealItems = (items: DietEditorItem[]): MealGroup[] => {
  const groups: MealGroup[] = [];
  let currentGroup: MealGroup | null = null;
  // Recipe-instance index so all ingredients from the same "Add recipe"
  // action collapse into one group, regardless of order in the meal.
  const recipeBlockIdx = new Map<string, number>();

  items.forEach((item) => {
    // Path A — legacy is_recipe single-line entry (e.g. recipes added before
    // ingredient expansion existed). Kept as its own group for back-compat.
    if (item.is_recipe) {
      if (currentGroup) { groups.push(currentGroup); currentGroup = null; }
      groups.push({ name: item.name || null, items: [item], isRecipe: true });
      return;
    }

    // Path B — ingredients expanded from a recipe carry recipe_group.
    // Group them visually under the recipe's name + photo.
    const rg = item.recipe_group as RecipeGroupMarker | undefined;
    const instanceId = rg?.instance_id;
    if (instanceId) {
      if (currentGroup) { groups.push(currentGroup); currentGroup = null; }
      const existingIdx = recipeBlockIdx.get(instanceId);
      if (existingIdx != null) {
        groups[existingIdx].items.push(item);
      } else {
        recipeBlockIdx.set(instanceId, groups.length);
        groups.push({
          name: rg?.name || null,
          items: [item],
          isRecipe: true,
          imageUrl: rg?.image_url,
          recipeInstanceId: instanceId,
        });
      }
      return;
    }

    // Path C — standalone ingredient (not part of any recipe)
    if (!currentGroup) currentGroup = { name: null, items: [], isRecipe: false };
    currentGroup.items.push(item);
  });

  if (currentGroup) groups.push(currentGroup);
  return groups;
};

function MealSection({ meal }: MealSectionProps) {
  if (!meal.items || meal.items.length === 0) return null;

  const groups = groupMealItems(meal.items);
  const totalCal = meal.items.reduce((sum, item) => sum + (item.calories || 0) * (item.quantity || 1), 0);
  const totalProtein = meal.items.reduce((sum, item) => sum + (item.protein || 0) * (item.quantity || 1), 0);
  const totalCarbs = meal.items.reduce((sum, item) => sum + (item.carbs || 0) * (item.quantity || 1), 0);
  const totalFat = meal.items.reduce((sum, item) => sum + (item.fat || 0) * (item.quantity || 1), 0);

  return (
    <div className="mb-6 print-meal">
      <div className="flex items-baseline gap-3 mb-1">
        <h2 className="text-lg font-semibold text-slate-800" style={{ fontFamily: 'Georgia, serif' }}>
          {meal.name}
        </h2>
        {meal.time ? <span className="text-xs text-slate-400">{meal.time}</span> : null}
      </div>
      <div className="border-b-2 border-brand-500 mb-3" />

      <div className="pl-8 space-y-3">
        {groups.map((group, groupIndex) => {
          // Recipe block: photo on the left, name + ingredients on the right
          if (group.isRecipe && group.recipeInstanceId) {
            return (
              <div
                key={`${group.recipeInstanceId}-${groupIndex}`}
                className="flex gap-4 border-l-2 border-[#a5b6fb] pl-3 py-1 break-inside-avoid"
              >
                {group.imageUrl ? (
                  <img
                    src={group.imageUrl}
                    alt={group.name || 'Receta'}
                    className="w-20 h-20 rounded-lg object-cover border border-[#c7d3fd] flex-shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-brand-50 to-[#e0e7ff] flex items-center justify-center flex-shrink-0">
                    <span className="text-brand-500 text-2xl">🍴</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-brand-500 leading-tight">{group.name || 'Receta'}</p>
                  <ul className="mt-1 space-y-0.5">
                    {group.items.map((item, itemIndex) => (
                      <li
                        key={item.id || `${item.name || 'ing'}-${itemIndex}`}
                        className="text-sm text-slate-600 leading-snug"
                      >
                        <span className="text-slate-400 mr-1">•</span>
                        {item.name}
                        {item.unit ? `, ${item.unit}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          }

          // Legacy single-line recipe (is_recipe with no ingredient expansion)
          if (group.isRecipe) {
            return (
              <div key={`${group.name || 'group'}-${groupIndex}`} className="break-inside-avoid">
                {group.name ? <p className="text-sm font-semibold text-slate-700 mb-0.5 border-b border-slate-200 pb-0.5">{group.name}</p> : null}
                {group.items.map((item, itemIndex) => (
                  <p key={item.id || `${item.name || 'item'}-${itemIndex}`} className="text-sm text-slate-600 leading-snug">
                    {item.name}
                    {item.unit ? `, ${item.unit}` : ''}
                  </p>
                ))}
              </div>
            );
          }

          // Standalone ingredients (not from any recipe)
          return (
            <div key={`standalone-${groupIndex}`} className="break-inside-avoid">
              {group.items.map((item, itemIndex) => (
                <p
                  key={item.id || `${item.name || 'item'}-${itemIndex}`}
                  className="text-sm text-slate-600 leading-snug"
                >
                  {item.name}
                  {item.unit ? `, ${item.unit}` : ''}
                </p>
              ))}
            </div>
          );
        })}
      </div>

      {/* Tip del nutricionista para este tiempo de comida. En recuadro y no como
          línea suelta para que el paciente lo distinga de la lista de alimentos.
          whitespace-pre-line conserva los saltos de línea que haya escrito. */}
      {meal.notes ? (
        <div className="mt-2 rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2">
          <p className="whitespace-pre-line text-xs italic leading-relaxed text-slate-600">
            <em>Nota: {meal.notes}</em>
          </p>
        </div>
      ) : null}

      {totalCal ? (
        <div className="flex gap-4 pl-8 mt-1">
          <span className="text-[10px] text-coral-700 font-semibold">{Math.round(totalCal)} kcal</span>
          <span className="text-[10px] text-brand-500">P: {fmt(totalProtein)}g</span>
          <span className="text-[10px] text-[#16a34a]">C: {fmt(totalCarbs)}g</span>
          <span className="text-[10px] text-amber-500">G: {fmt(totalFat)}g</span>
        </div>
      ) : null}
    </div>
  );
}

function DayPrint({ title, date, patientName, meals, targetCalories, brandLogoUrl, brandName }: DayPrintProps) {
  const totalCal = meals.reduce((sum, meal) => sum + meal.items.reduce((itemSum, item) => itemSum + (item.calories || 0) * (item.quantity || 1), 0), 0);
  const totalProtein = meals.reduce((sum, meal) => sum + meal.items.reduce((itemSum, item) => itemSum + (item.protein || 0) * (item.quantity || 1), 0), 0);
  const totalCarbs = meals.reduce((sum, meal) => sum + meal.items.reduce((itemSum, item) => itemSum + (item.carbs || 0) * (item.quantity || 1), 0), 0);
  const totalFat = meals.reduce((sum, meal) => sum + meal.items.reduce((itemSum, item) => itemSum + (item.fat || 0) * (item.quantity || 1), 0), 0);

  let formattedDate = date;
  try {
    formattedDate = format(new Date(`${date}T00:00:00`), "d 'de' MMMM 'de' yyyy", { locale: es });
  } catch {
    formattedDate = date;
  }

  const patientBadge = patientName?.split(' ').slice(0, 2).join('\n') || 'Paciente';

  return (
    <div className="print-page bg-white" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="relative mb-8">
        <div className="h-16 w-full" style={{ background: 'linear-gradient(135deg, #3b5feb 0%, #4130c9 40%, #312a8f 100%)', clipPath: 'polygon(0 0, 75% 0, 55% 100%, 0 100%)' }} />
        <div className="absolute inset-0 flex items-center px-6">
          <div>
            <p className="text-white text-xs font-medium opacity-80">Plan Alimentario</p>
            <p className="text-white font-bold text-sm">{patientName}</p>
          </div>
        </div>
        <div className="absolute right-6 top-1 flex flex-col items-center">
          {brandLogoUrl ? (
            <img
              src={brandLogoUrl}
              alt={brandName || 'Logo de la clínica'}
              className="w-14 h-14 rounded-lg object-contain bg-white border border-[#c7d3fd] p-1"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-slate-100 border-2 border-[#7d93f7] flex items-center justify-center overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
              <span className="text-slate-400 text-[10px] text-center font-medium leading-tight px-1">{patientBadge}</span>
            </div>
          )}
          <p className="text-[9px] text-slate-500 mt-0.5 font-medium text-center max-w-[90px] leading-tight">{brandName || patientName}</p>
        </div>
      </div>

      <p className="text-center text-sm font-medium text-slate-600 mb-6 capitalize">{formattedDate}</p>

      <div className="flex items-center gap-6 justify-center mb-6 bg-slate-50 border border-slate-100 rounded-xl px-6 py-3">
        <div className="text-center">
          <p className="text-lg font-bold text-coral-700">{Math.round(totalCal)}</p>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">kcal</p>
        </div>
        <div className="h-8 w-px bg-slate-200" />
        <div className="text-center">
          <p className="text-base font-bold text-brand-500">{fmt(totalProtein)}g</p>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Proteína</p>
        </div>
        <div className="h-8 w-px bg-slate-200" />
        <div className="text-center">
          <p className="text-base font-bold text-[#16a34a]">{fmt(totalCarbs)}g</p>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Carbs</p>
        </div>
        <div className="h-8 w-px bg-slate-200" />
        <div className="text-center">
          <p className="text-base font-bold text-amber-500">{fmt(totalFat)}g</p>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Grasas</p>
        </div>
        {targetCalories > 0 ? (
          <>
            <div className="h-8 w-px bg-slate-200" />
            <div className="text-center">
              <p className="text-base font-bold text-slate-400">{targetCalories}</p>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Objetivo</p>
            </div>
          </>
        ) : null}
      </div>

      <div className="space-y-1">
        {meals.filter((meal) => meal.items && meal.items.length > 0).map((meal) => (
          <MealSection key={meal.id} meal={meal} />
        ))}
      </div>

      <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center">
        <p className="text-[9px] text-slate-400">Generado por {brandName || 'NutriGenius'} · {new Date().toLocaleDateString(getCurrentLocale())}</p>
        {publicSiteLabel() ? <p className="text-[9px] text-brand-500 font-medium">{publicSiteLabel()}</p> : null}
      </div>
    </div>
  );
}

// Splits a recipe's `instructions` string (newline-separated steps) into an
// array. Trims empties so trailing newlines or double-blanks don't produce
// "Paso 4: ".
const parseSteps = (text?: string): string[] => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
};

type RecipePageProps = { recipe: PrintRecipe };

function RecipePage({ recipe }: RecipePageProps) {
  const steps = parseSteps(recipe.instructions);
  const prep = Number(recipe.prep_time) || 0;
  const cook = Number(recipe.cook_time) || 0;
  const totalTime = prep + cook;
  const servings = Number(recipe.servings) || 1;

  return (
    <div className="print-page bg-white" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header band — consistent visual identity with the day plan */}
      <div className="relative mb-6">
        <div className="h-14 w-full" style={{ background: 'linear-gradient(135deg, #3b5feb 0%, #4130c9 40%, #312a8f 100%)', clipPath: 'polygon(0 0, 70% 0, 50% 100%, 0 100%)' }} />
        <div className="absolute inset-0 flex items-center px-6">
          <div>
            <p className="text-white text-[10px] font-semibold uppercase tracking-widest opacity-80">Recetario</p>
            <p className="text-white font-bold text-base leading-tight">{recipe.name || 'Receta'}</p>
          </div>
        </div>
      </div>

      {/* Photo + meta block */}
      <div className="flex gap-5 mb-6">
        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt={recipe.name || 'Receta'}
            className="w-40 h-40 rounded-xl object-cover border border-[#c7d3fd] flex-shrink-0"
          />
        ) : (
          <div className="w-40 h-40 rounded-xl bg-gradient-to-br from-brand-50 to-[#e0e7ff] flex items-center justify-center flex-shrink-0">
            <span className="text-brand-500 text-5xl">🍽️</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          {recipe.description ? (
            <p className="text-sm text-slate-600 leading-snug mb-3 italic">{recipe.description}</p>
          ) : null}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
            {totalTime > 0 ? (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Tiempo</p>
                <p className="text-slate-700 font-semibold">{totalTime} min{prep > 0 && cook > 0 ? ` · ${prep} prep + ${cook} cocción` : ''}</p>
              </div>
            ) : null}
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Porciones</p>
              <p className="text-slate-700 font-semibold">{servings}</p>
            </div>
            {recipe.difficulty ? (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Dificultad</p>
                <p className="text-slate-700 font-semibold">{recipe.difficulty}</p>
              </div>
            ) : null}
          </div>

          {/* Macros per serving */}
          {recipe.calories_per_serving != null ? (
            <div className="mt-3 flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-lg px-4 py-2 w-fit">
              <div className="text-center">
                <p className="text-base font-bold text-orange-500">{Math.round(Number(recipe.calories_per_serving) || 0)}</p>
                <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">kcal</p>
              </div>
              <div className="h-7 w-px bg-slate-200" />
              <div className="text-center">
                <p className="text-sm font-bold text-sky-500">{fmt(recipe.protein_per_serving)}g</p>
                <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">Prot</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-amber-600">{fmt(recipe.carbs_per_serving)}g</p>
                <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">Carbs</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-rose-500">{fmt(recipe.fat_per_serving)}g</p>
                <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">Gras</p>
              </div>
              <p className="text-[9px] text-slate-400 italic ml-1">por porción</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Two-column body: Ingredientes | Preparación */}
      <div className="grid grid-cols-[1fr_2fr] gap-6">
        <section>
          <h3 className="text-xs font-bold text-brand-500 uppercase tracking-wider mb-2 border-b border-[#a5b6fb] pb-1">
            Ingredientes
          </h3>
          {Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 ? (
            <ul className="space-y-1.5">
              {recipe.ingredients.map((ing, idx) => (
                <li key={idx} className="text-sm text-slate-700 leading-snug flex items-baseline gap-2">
                  <span className="text-[#7d93f7] flex-shrink-0">▸</span>
                  <span>
                    {ing.quantity != null ? <span className="font-semibold tabular-nums">{ing.quantity} </span> : null}
                    {ing.unit ? <span className="text-slate-500">{ing.unit} </span> : null}
                    <span>{ing.name}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 italic">Sin ingredientes registrados</p>
          )}
        </section>

        <section>
          <h3 className="text-xs font-bold text-brand-500 uppercase tracking-wider mb-2 border-b border-[#a5b6fb] pb-1">
            Preparación
          </h3>
          {steps.length > 0 ? (
            <ol className="space-y-2">
              {steps.map((step, idx) => (
                <li key={idx} className="text-sm text-slate-700 leading-relaxed flex gap-2.5 break-inside-avoid">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">{idx + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-slate-400 italic">Sin pasos de preparación registrados</p>
          )}
        </section>
      </div>

      <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center">
        <p className="text-[9px] text-slate-400">Recetario · Generado por NutriGenius</p>
        {publicSiteLabel() ? <p className="text-[9px] text-brand-500 font-medium">{publicSiteLabel()}</p> : null}
      </div>
    </div>
  );
}

export default function DietPrintView({ title, date, patientName, meals, targetCalories, recipes, onClose, brandLogoUrl, brandName }: DietPrintViewProps) {
  const handlePrint = (): void => {
    window.print();
  };

  // Pick the recipes actually used in the plan (deduped by id, then name).
  // Same recipe in lunch + dinner → printed ONCE in the recetario.
  const usedRecipes = extractUsedRecipes(meals, recipes || []);

  let formattedDate = date;
  try {
    formattedDate = format(new Date(`${date}T00:00:00`), "d 'de' MMMM 'de' yyyy", { locale: es });
  } catch {
    formattedDate = date;
  }

  // Render through a Portal so .print-overlay becomes a direct child of
  // <body>. This is essential for the @media print rule
  // "body > *:not(.print-overlay) { display: none }" to leave only the
  // overlay visible during printing. Without the portal, the overlay
  // would sit inside #root and the rule would hide its ancestor → blank PDF.
  return createPortal(
    <>
      <style>{`
        /* On screen: stack the sheets vertically (column), centered.
           The flex container previously defaulted to row → sheets sat
           side-by-side, which made multi-page plans unreadable. */
        @media screen {
          .print-overlay {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding-left: 0.75rem;
            padding-right: 0.75rem;
          }
          .print-sheet {
            background: white;
            width: min(210mm, calc(100vw - 1.5rem));
            max-width: 100%;
            min-height: 0;
            padding: clamp(14px, 4vw, 24mm) clamp(12px, 3.5vw, 20mm) clamp(14px, 3vw, 20mm);
            box-sizing: border-box;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            border-radius: 16px;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          .print-sheet + .print-sheet {
            margin-top: 24px;
          }
          .print-toolbar-mobile {
            flex-wrap: wrap;
            gap: 0.5rem;
            padding-left: 0.75rem;
            padding-right: 0.75rem;
          }
          .print-toolbar-mobile .print-toolbar-title {
            order: 3;
            flex: 1 1 100%;
            text-align: center;
            font-size: 0.75rem;
          }
          @media (min-width: 640px) {
            .print-toolbar-mobile .print-toolbar-title {
              order: 0;
              flex: 1 1 auto;
              font-size: 0.875rem;
            }
          }
        }
        /* On print: hide every body child EXCEPT our portal-rendered
           print overlay. The previous "body > *" rule hid #root, which
           contains the rest of the app — but #root also contained the
           overlay before we moved it to a portal, so it got hidden too
           and the PDF came out blank. With the portal, .print-overlay
           is a direct child of body and we can exclude it surgically. */
        @media print {
          body > *:not(.print-overlay) { display: none !important; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .print-overlay {
            display: block !important;
            position: static !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            z-index: auto !important;
          }
          .no-print { display: none !important; }
          .print-sheet {
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            min-height: 0 !important;
          }
          .print-page {
            page-break-after: always;
            break-after: page;
          }
          .print-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          @page { margin: 1.5cm 2cm; size: A4; }
        }
      `}</style>

      <div className="print-overlay fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto py-8">
        <div className="no-print print-toolbar-mobile fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-sm px-3 py-3 sm:px-6 flex items-center gap-2 sm:gap-3">
          <BackLink onClick={onClose} label="Cerrar" variant="overlay-close" compact />
          <span className="print-toolbar-title text-sm font-semibold text-slate-700 truncate">{title} · {formattedDate}</span>
          <button
            type="button"
            onClick={handlePrint}
            className="ml-auto flex min-h-11 touch-manipulation items-center gap-2 text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-white px-3 sm:px-5 py-2 rounded-xl shadow transition-colors"
          >
            🖨️ <span className="sm:hidden">PDF</span><span className="hidden sm:inline">Imprimir / Guardar PDF</span>
          </button>
        </div>

        <div className="mt-20 sm:mt-16 no-print" />
        <div className="print-sheet">
          <DayPrint title={title} date={date} patientName={patientName} meals={meals} targetCalories={targetCalories} brandLogoUrl={brandLogoUrl} brandName={brandName} />
        </div>

        {/* Recetario — one page per unique recipe used in the plan.
            Same recipe in multiple meals = printed once (extractUsedRecipes
            dedups). Each .print-page inside gets its own A4 sheet via
            page-break-after. The .print-sheet wrapper provides on-screen
            chrome that gets stripped during print. */}
        {usedRecipes.map((recipe) => (
          <div key={recipe.id || recipe.name} className="print-sheet">
            <RecipePage recipe={recipe} />
          </div>
        ))}
      </div>
    </>,
    document.body,
  );
}