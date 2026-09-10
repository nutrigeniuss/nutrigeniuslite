import { describe, it, expect } from 'vitest';
import { groupItemsByRecipe, sumGroupCalories } from '@/components/diet/groupItemsByRecipe';

const standalone = (id, kcal = 100) => ({ id, name: `Item ${id}`, quantity: 1, calories: kcal });
const recipeItem = (id, instanceId, name, order, kcal = 50) => ({
  id,
  name: `Ing ${id}`,
  quantity: 1,
  calories: kcal,
  recipe_group: { instance_id: instanceId, name, order, servings: 1 },
});

describe('groupItemsByRecipe', () => {
  it('returns empty array for null/empty input', () => {
    expect(groupItemsByRecipe(null)).toEqual([]);
    expect(groupItemsByRecipe(undefined)).toEqual([]);
    expect(groupItemsByRecipe([])).toEqual([]);
  });

  it('wraps standalone items as single blocks', () => {
    const blocks = groupItemsByRecipe([standalone('a'), standalone('b')]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ kind: 'single', item: expect.objectContaining({ id: 'a' }) });
    expect(blocks[1]).toEqual({ kind: 'single', item: expect.objectContaining({ id: 'b' }) });
  });

  it('groups ingredients sharing the same recipe instance', () => {
    const blocks = groupItemsByRecipe([
      recipeItem('i1', 'rg-1', 'Arroz con pollo', 0),
      recipeItem('i2', 'rg-1', 'Arroz con pollo', 1),
      recipeItem('i3', 'rg-1', 'Arroz con pollo', 2),
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('recipe');
    expect(blocks[0].group.name).toBe('Arroz con pollo');
    expect(blocks[0].items.map(i => i.id)).toEqual(['i1', 'i2', 'i3']);
  });

  it('keeps independent groups when same recipe is added twice', () => {
    const blocks = groupItemsByRecipe([
      recipeItem('i1', 'rg-1', 'Arroz con pollo', 0),
      recipeItem('i2', 'rg-1', 'Arroz con pollo', 1),
      recipeItem('i3', 'rg-2', 'Arroz con pollo', 0),
      recipeItem('i4', 'rg-2', 'Arroz con pollo', 1),
    ]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].items).toHaveLength(2);
    expect(blocks[1].items).toHaveLength(2);
    expect(blocks[0].group.instance_id).toBe('rg-1');
    expect(blocks[1].group.instance_id).toBe('rg-2');
  });

  it('preserves overall order when standalone and recipe items are mixed', () => {
    const blocks = groupItemsByRecipe([
      standalone('a'),
      recipeItem('i1', 'rg-1', 'R', 0),
      standalone('b'),
      recipeItem('i2', 'rg-1', 'R', 1),
      standalone('c'),
    ]);
    // standalone a, recipe (i1+i2 collapsed into first ingredient's spot),
    // standalone b, standalone c
    expect(blocks).toHaveLength(4);
    expect(blocks[0]).toEqual({ kind: 'single', item: expect.objectContaining({ id: 'a' }) });
    expect(blocks[1].kind).toBe('recipe');
    expect(blocks[1].items.map(i => i.id)).toEqual(['i1', 'i2']);
    expect(blocks[2]).toEqual({ kind: 'single', item: expect.objectContaining({ id: 'b' }) });
    expect(blocks[3]).toEqual({ kind: 'single', item: expect.objectContaining({ id: 'c' }) });
  });

  it('sorts ingredients inside a group by recipe_group.order', () => {
    const blocks = groupItemsByRecipe([
      recipeItem('i1', 'rg-1', 'R', 2),
      recipeItem('i2', 'rg-1', 'R', 0),
      recipeItem('i3', 'rg-1', 'R', 1),
    ]);
    expect(blocks[0].items.map(i => i.id)).toEqual(['i2', 'i3', 'i1']);
  });

  it('handles items with missing order gracefully (stable order)', () => {
    const blocks = groupItemsByRecipe([
      { id: 'i1', name: 'A', recipe_group: { instance_id: 'rg-1', name: 'R', servings: 1 } },
      { id: 'i2', name: 'B', recipe_group: { instance_id: 'rg-1', name: 'R', servings: 1 } },
    ]);
    expect(blocks[0].items.map(i => i.id)).toEqual(['i1', 'i2']);
  });
});

describe('sumGroupCalories', () => {
  it('returns 0 for empty list', () => {
    expect(sumGroupCalories([])).toBe(0);
  });

  it('sums quantity × calories across items', () => {
    expect(sumGroupCalories([
      { quantity: 5, calories: 29.8 },
      { quantity: 1, calories: 104 },
      { quantity: 20, calories: 2.9 },
    ])).toBeCloseTo(5 * 29.8 + 104 + 20 * 2.9);
  });

  it('treats missing/NaN values as 0', () => {
    expect(sumGroupCalories([
      { quantity: 2, calories: 50 },
      { quantity: null, calories: 'bad' },
      { calories: 30 }, // missing quantity
    ])).toBe(100);
  });
});
