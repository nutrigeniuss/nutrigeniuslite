// Groups a meal's items by recipe instance. Preserves original order:
// ungrouped items appear as singletons, and a recipe whose ingredients
// are interleaved with ungrouped items still renders contiguously at
// the first ingredient's position. Returns one entry per "block".
//
// Entry shape:
//   { kind: 'single', item }                     — standalone food
//   { kind: 'recipe', group, items: [...]       — ingredients from same recipe instance

export function groupItemsByRecipe(items) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const blocks = [];
  const recipeBlockIndex = new Map(); // instance_id -> index in blocks

  items.forEach((item) => {
    const group = item?.recipe_group;
    const instanceId = group?.instance_id;

    if (instanceId) {
      const existing = recipeBlockIndex.get(instanceId);
      if (existing != null) {
        blocks[existing].items.push(item);
        return;
      }
      const block = { kind: 'recipe', group, items: [item] };
      recipeBlockIndex.set(instanceId, blocks.length);
      blocks.push(block);
      return;
    }

    blocks.push({ kind: 'single', item });
  });

  // Sort ingredients within each recipe block by the stored `order` so
  // they appear in the same sequence the user defined in the recipe.
  blocks.forEach((block) => {
    if (block.kind === 'recipe') {
      block.items.sort((a, b) => {
        const oa = Number(a?.recipe_group?.order);
        const ob = Number(b?.recipe_group?.order);
        if (Number.isFinite(oa) && Number.isFinite(ob)) return oa - ob;
        return 0;
      });
    }
  });

  return blocks;
}

// Sum of (quantity × calories) for a list of items — what the user sees
// as the total when ingredients render in the meal table.
export function sumGroupCalories(items) {
  return items.reduce((sum, item) => {
    const qty = Number(item?.quantity) || 0;
    const cal = Number(item?.calories) || 0;
    return sum + qty * cal;
  }, 0);
}
