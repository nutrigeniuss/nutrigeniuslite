import React, { useEffect, useState } from "react";
import { ChefHat, ChevronDown, ChevronRight, Info, Trash2 } from "lucide-react";

// Header row for a recipe group inside the meal table. Rendered as a single
// <tr> spanning all columns; the visual "card" effect comes from the parent
// <tbody>'s background + border styling.
//
// Defensive: validates numeric props at render so a malformed `recipe_group`
// (e.g. servings stored as string from DB) doesn't render "NaN porciones".

const safeInt = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

export default function RecipeGroupHeader({
  group,
  totalKcal,
  ingredientCount,
  collapsed,
  onToggleCollapse,
  onRemoveGroup,
  onInspect,
  colSpan,
}) {
  const [imageErrored, setImageErrored] = useState(false);
  const imageUrl = group?.image_url;
  useEffect(() => { setImageErrored(false); }, [imageUrl]);

  const safeCount = safeInt(ingredientCount, 0);
  const safeServings = safeInt(group?.servings, 1);
  const safeKcal = Number.isFinite(Number(totalKcal)) ? Math.round(Number(totalKcal)) : 0;
  const groupName = (group?.name && String(group.name).trim()) || "Receta";
  return (
    <tr className="bg-gradient-to-r from-brand-50/60 to-transparent border-b border-[#e2e8ff]">
      <td colSpan={colSpan} className="px-3 py-2.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-6 w-6 items-center justify-center rounded-md text-brand-500 hover:bg-[#e2e8ff]/70 transition"
            aria-label={collapsed ? "Expandir receta" : "Colapsar receta"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {imageUrl && !imageErrored ? (
            <img
              src={imageUrl}
              alt={groupName}
              onError={() => setImageErrored(true)}
              className="w-12 h-12 rounded-lg object-cover border border-[#c7d0fc] shadow-sm flex-shrink-0"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#e2e8ff] to-emerald-100 flex items-center justify-center flex-shrink-0"
              aria-hidden="true"
            >
              <ChefHat className="w-5 h-5 text-brand-500" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-brand-600 truncate leading-tight" title={groupName}>
              {groupName}
            </p>
            <p className="text-[11px] text-brand-500/80 mt-0.5">
              {safeCount} {safeCount === 1 ? "ingrediente" : "ingredientes"}
              {safeServings > 1 ? ` · ${safeServings} porciones` : ""}
              {" · "}
              <span className="font-semibold text-brand-600">{safeKcal} kcal</span>
            </p>
          </div>

          {onInspect ? (
            <button
              type="button"
              onClick={onInspect}
              className="flex h-7 w-7 items-center justify-center rounded-md text-brand-500/70 hover:bg-sky-50 hover:text-sky-600 transition"
              aria-label="Ver detalle nutricional de la receta"
              title="Ver macros y micronutrientes de la receta completa"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          ) : null}

          {onRemoveGroup ? (
            <button
              type="button"
              onClick={onRemoveGroup}
              className="flex h-7 w-7 items-center justify-center rounded-md text-brand-500/60 hover:bg-rose-50 hover:text-rose-500 transition"
              aria-label="Eliminar receta completa"
              title="Eliminar receta completa"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
