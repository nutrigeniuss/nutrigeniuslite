import React, { useMemo, useState } from "react";
import { Check, ChefHat, Clock, Plus } from "lucide-react";
import CountryFlag from "@/components/CountryFlag";

// Renders a list of recipes as a visual grid of cards (photo-first).
// Used inside the FoodSearchDrawer's "Mis Recetas" tab. Foods stay as a
// table because they're abstract; recipes are recognized visually so
// the grid matches how the nutritionist actually thinks about them.
//
// Click "+" on a card → adds 1 serving of that recipe via onAdd.
// Click multiple cards in succession → drawer stays open, ideal for
// piling several recipes into one meal.

const ALL_CATEGORIES_KEY = "__all__";

// Square thumbnail with graceful onError fallback. Mirrors the pattern
// used in the Inspector drawer — single visual language across the app.
function RecipeThumbnail({ imageUrl, alt }) {
  const [errored, setErrored] = useState(false);
  React.useEffect(() => { setErrored(false); }, [imageUrl]);

  if (imageUrl && !errored) {
    return (
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        onError={() => setErrored(true)}
        className="w-full aspect-[4/3] object-cover"
      />
    );
  }
  return (
    <div
      className="w-full aspect-[4/3] bg-gradient-to-br from-[#e2e8ff] to-emerald-100 flex items-center justify-center"
      aria-hidden="true"
    >
      <ChefHat className="w-10 h-10 text-brand-500/80" />
    </div>
  );
}

function RecipeCard({ recipe, added, onAdd, highlight }) {
  const kcal = Math.round(Number(recipe.calories_per_serving) || 0);
  const servings = Number(recipe.servings) || 1;
  const totalTime = (Number(recipe.prep_time) || 0) + (Number(recipe.cook_time) || 0);

  return (
    <article
      className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-brand-500/30 transition-all"
      data-testid={`recipe-card-${recipe.id}`}
    >
      <div className="relative">
        <RecipeThumbnail imageUrl={recipe.image_url} alt={recipe.name || "Receta"} />

        {/* Quick-add button — top-right overlay. Visible always (not only
            on hover) so touch users on tablets get the same affordance. */}
        <button
          type="button"
          onClick={() => onAdd(recipe)}
          aria-label={`Agregar ${recipe.name || "receta"} al tiempo de comida`}
          className={`absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition-all hover:scale-110 ${
            added
              ? "bg-emerald-500 text-white"
              : "bg-white text-brand-500 hover:bg-brand-500 hover:text-white"
          }`}
        >
          {added ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>

        {recipe.category ? (
          <span className="absolute bottom-2 left-2 inline-flex items-center rounded-full bg-white/95 backdrop-blur px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 shadow-sm">
            {recipe.category}
          </span>
        ) : null}
        {recipe.country ? (
          <span className="absolute bottom-2 right-2 inline-flex items-center rounded-full bg-white/95 backdrop-blur px-2 py-0.5 text-[10px] text-slate-600 shadow-sm">
            <CountryFlag code={recipe.country} />
          </span>
        ) : null}
      </div>

      <div className="p-3 flex-1 flex flex-col">
        <h3 className="text-sm font-bold text-slate-800 leading-snug line-clamp-2" title={recipe.name}>
          {highlight ? highlight(recipe.name) : recipe.name}
        </h3>
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500">
          <span className="font-semibold text-orange-500 tabular-nums">{kcal} kcal</span>
          <span className="text-slate-300">·</span>
          <span>{servings} {servings === 1 ? "porción" : "porciones"}</span>
          {totalTime > 0 ? (
            <>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-0.5">
                <Clock className="w-3 h-3" /> {totalTime}min
              </span>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function RecipeGridView({
  recipes,
  loading,
  added,
  onAdd,
  highlight,
  emptyMessage = "Sin recetas guardadas",
  noResultsMessage = "Sin resultados",
  searchActive = false,
}) {
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES_KEY);

  // Unique non-empty categories present in the current filtered recipe set,
  // preserving the order they first appear. Stable for chip filter UI.
  const categories = useMemo(() => {
    const seen = new Set();
    const out = [];
    (recipes || []).forEach((r) => {
      const c = (r?.category && String(r.category).trim()) || "";
      if (c && !seen.has(c)) {
        seen.add(c);
        out.push(c);
      }
    });
    return out;
  }, [recipes]);

  const filtered = useMemo(() => {
    if (activeCategory === ALL_CATEGORIES_KEY) return recipes || [];
    return (recipes || []).filter((r) => r?.category === activeCategory);
  }, [recipes, activeCategory]);

  // Reset the chip filter to "all" when the upstream recipe set changes
  // in a way that removes the currently-active category (otherwise the
  // grid looks empty and the user can't tell why).
  React.useEffect(() => {
    if (activeCategory !== ALL_CATEGORIES_KEY && !categories.includes(activeCategory)) {
      setActiveCategory(ALL_CATEGORIES_KEY);
    }
  }, [categories, activeCategory]);

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-slate-400" data-testid="recipe-grid-loading">
        Cargando recetas...
      </div>
    );
  }

  const hasRecipes = (recipes?.length || 0) > 0;
  const hasResults = filtered.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Category filter chips — only render when ≥2 categories exist
          (a single-category list doesn't benefit from filtering) */}
      {categories.length >= 2 ? (
        <div
          className="flex-shrink-0 flex gap-1.5 px-6 pt-2 pb-3 overflow-x-auto border-b border-slate-100"
          data-testid="recipe-category-chips"
        >
          <button
            type="button"
            onClick={() => setActiveCategory(ALL_CATEGORIES_KEY)}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
              activeCategory === ALL_CATEGORIES_KEY
                ? "bg-brand-500 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Todas
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                activeCategory === cat
                  ? "bg-brand-500 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      ) : null}

      {/* Grid (or empty state) */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!hasRecipes ? (
          <div className="py-16 text-center text-sm text-slate-400" data-testid="recipe-grid-empty">
            {emptyMessage}
          </div>
        ) : !hasResults ? (
          <div className="py-16 text-center text-sm text-slate-400" data-testid="recipe-grid-no-results">
            {searchActive ? noResultsMessage : "No hay recetas en esta categoría"}
          </div>
        ) : (
          <div
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
            data-testid="recipe-grid"
          >
            {filtered.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                added={!!added?.[recipe.id]}
                onAdd={onAdd}
                highlight={highlight}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
