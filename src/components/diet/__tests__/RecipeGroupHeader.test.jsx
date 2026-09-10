import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import RecipeGroupHeader from '@/components/diet/RecipeGroupHeader';

// The header is a <tr>; wrap it so the renderer doesn't complain about
// orphan rows. The wrapper has no impact on the tested behavior.
function renderInTable(ui) {
  return render(
    <table>
      <tbody>{ui}</tbody>
    </table>
  );
}

const baseGroup = {
  instance_id: 'rg-1',
  recipe_id: 'recipe-uuid',
  name: 'Arroz con pollo',
  image_url: 'https://example.com/arroz.jpg',
  servings: 1,
};

beforeEach(() => cleanup());

describe('RecipeGroupHeader - render basics', () => {
  it('renders recipe name and kcal total', () => {
    renderInTable(
      <RecipeGroupHeader
        group={baseGroup}
        totalKcal={328}
        ingredientCount={4}
        collapsed={false}
        onToggleCollapse={() => {}}
        onRemoveGroup={() => {}}
        onInspect={() => {}}
        colSpan={4}
      />
    );
    expect(screen.getByText('Arroz con pollo')).toBeInTheDocument();
    expect(screen.getByText(/328 kcal/)).toBeInTheDocument();
  });

  it('renders ingredient count (singular vs plural)', () => {
    const { rerender } = renderInTable(
      <RecipeGroupHeader group={baseGroup} totalKcal={100} ingredientCount={1} collapsed={false} colSpan={4} />
    );
    expect(screen.getByText(/1 ingrediente(?!s)/)).toBeInTheDocument();

    rerender(
      <table><tbody>
        <RecipeGroupHeader group={baseGroup} totalKcal={100} ingredientCount={5} collapsed={false} colSpan={4} />
      </tbody></table>
    );
    expect(screen.getByText(/5 ingredientes/)).toBeInTheDocument();
  });

  it('renders servings line only when > 1', () => {
    const { rerender } = renderInTable(
      <RecipeGroupHeader group={{ ...baseGroup, servings: 1 }} totalKcal={100} ingredientCount={3} collapsed={false} colSpan={4} />
    );
    expect(screen.queryByText(/porciones/)).toBeNull();

    rerender(
      <table><tbody>
        <RecipeGroupHeader group={{ ...baseGroup, servings: 2 }} totalKcal={100} ingredientCount={3} collapsed={false} colSpan={4} />
      </tbody></table>
    );
    expect(screen.getByText(/2 porciones/)).toBeInTheDocument();
  });

  it('uses "Receta" fallback when group.name is blank/missing', () => {
    renderInTable(
      <RecipeGroupHeader
        group={{ ...baseGroup, name: '' }}
        totalKcal={100} ingredientCount={1} collapsed={false} colSpan={4}
      />
    );
    expect(screen.getByText('Receta')).toBeInTheDocument();
  });
});

describe('RecipeGroupHeader - defensive numeric coercion', () => {
  it('handles servings stored as string ("2") without breaking math', () => {
    renderInTable(
      <RecipeGroupHeader
        group={{ ...baseGroup, servings: '2' }}
        totalKcal={100} ingredientCount={3} collapsed={false} colSpan={4}
      />
    );
    expect(screen.getByText(/2 porciones/)).toBeInTheDocument();
  });

  it('falls back to integer count when ingredientCount is non-finite', () => {
    renderInTable(
      <RecipeGroupHeader
        group={baseGroup}
        totalKcal={100} ingredientCount={NaN} collapsed={false} colSpan={4}
      />
    );
    expect(screen.getByText(/0 ingredientes/)).toBeInTheDocument();
  });

  it('renders 0 kcal when totalKcal is NaN', () => {
    renderInTable(
      <RecipeGroupHeader
        group={baseGroup}
        totalKcal={NaN} ingredientCount={1} collapsed={false} colSpan={4}
      />
    );
    expect(screen.getByText(/0 kcal/)).toBeInTheDocument();
  });
});

describe('RecipeGroupHeader - actions', () => {
  it('toggle collapse fires onToggleCollapse', () => {
    const onToggle = vi.fn();
    renderInTable(
      <RecipeGroupHeader
        group={baseGroup}
        totalKcal={100} ingredientCount={1}
        collapsed={false} onToggleCollapse={onToggle} colSpan={4}
      />
    );
    fireEvent.click(screen.getByLabelText('Colapsar receta'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('label flips when collapsed', () => {
    renderInTable(
      <RecipeGroupHeader
        group={baseGroup}
        totalKcal={100} ingredientCount={1}
        collapsed={true} onToggleCollapse={() => {}} colSpan={4}
      />
    );
    expect(screen.getByLabelText('Expandir receta')).toBeInTheDocument();
  });

  it('inspect button fires onInspect', () => {
    const onInspect = vi.fn();
    renderInTable(
      <RecipeGroupHeader
        group={baseGroup}
        totalKcal={100} ingredientCount={1}
        collapsed={false} onInspect={onInspect} colSpan={4}
      />
    );
    fireEvent.click(screen.getByLabelText('Ver detalle nutricional de la receta'));
    expect(onInspect).toHaveBeenCalledTimes(1);
  });

  it('remove button fires onRemoveGroup', () => {
    const onRemove = vi.fn();
    renderInTable(
      <RecipeGroupHeader
        group={baseGroup}
        totalKcal={100} ingredientCount={1}
        collapsed={false} onRemoveGroup={onRemove} colSpan={4}
      />
    );
    fireEvent.click(screen.getByLabelText('Eliminar receta completa'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('inspect button is omitted when onInspect prop is undefined', () => {
    renderInTable(
      <RecipeGroupHeader
        group={baseGroup}
        totalKcal={100} ingredientCount={1}
        collapsed={false} colSpan={4}
      />
    );
    expect(screen.queryByLabelText('Ver detalle nutricional de la receta')).toBeNull();
  });
});

describe('RecipeGroupHeader - image fallback', () => {
  it('renders <img> when image_url is provided', () => {
    renderInTable(
      <RecipeGroupHeader
        group={baseGroup}
        totalKcal={100} ingredientCount={1} collapsed={false} colSpan={4}
      />
    );
    expect(screen.getByAltText('Arroz con pollo')).toBeInTheDocument();
  });

  it('renders ChefHat fallback when image_url is missing', () => {
    const { container } = renderInTable(
      <RecipeGroupHeader
        group={{ ...baseGroup, image_url: undefined }}
        totalKcal={100} ingredientCount={1} collapsed={false} colSpan={4}
      />
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('swaps to fallback when img onError fires (broken URL)', () => {
    renderInTable(
      <RecipeGroupHeader
        group={baseGroup}
        totalKcal={100} ingredientCount={1} collapsed={false} colSpan={4}
      />
    );
    const img = screen.getByAltText('Arroz con pollo');
    fireEvent.error(img);
    expect(screen.queryByAltText('Arroz con pollo')).toBeNull();
  });
});
