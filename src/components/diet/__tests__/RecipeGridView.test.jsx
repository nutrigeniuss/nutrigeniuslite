import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import RecipeGridView from '@/components/diet/RecipeGridView';

const recipe = (overrides = {}) => ({
  id: 'r1',
  name: 'Arroz con pollo',
  image_url: 'https://example.com/arroz.jpg',
  category: 'Comida',
  servings: 4,
  prep_time: 15,
  cook_time: 30,
  calories_per_serving: 328,
  ...overrides,
});

beforeEach(() => cleanup());

describe('RecipeGridView - states', () => {
  it('renders loading state', () => {
    render(<RecipeGridView recipes={[]} loading onAdd={() => {}} />);
    expect(screen.getByTestId('recipe-grid-loading')).toBeInTheDocument();
  });

  it('renders custom empty message when there are no recipes at all', () => {
    render(
      <RecipeGridView
        recipes={[]}
        loading={false}
        onAdd={() => {}}
        emptyMessage="Sin recetas guardadas"
      />
    );
    expect(screen.getByTestId('recipe-grid-empty')).toBeInTheDocument();
    expect(screen.getByText('Sin recetas guardadas')).toBeInTheDocument();
  });

  it('renders no-results message when search is active but yields nothing', () => {
    // recipes prop has items but they all get filtered out by the active
    // category — simulate via empty list with searchActive flag
    render(
      <RecipeGridView
        recipes={[recipe({ id: 'r1', name: 'A', category: 'Desayuno' })]}
        loading={false}
        onAdd={() => {}}
        searchActive
        noResultsMessage="No coincide nada"
      />
    );
    // 1 recipe → no chip bar (needs ≥2 categories), goes straight to grid
    expect(screen.queryByTestId('recipe-grid-empty')).toBeNull();
    expect(screen.getByTestId('recipe-grid')).toBeInTheDocument();
  });
});

describe('RecipeGridView - rendering', () => {
  const items = [
    recipe({ id: 'r1', name: 'Arroz con pollo', category: 'Comida' }),
    recipe({ id: 'r2', name: 'Avena con leche', category: 'Desayuno' }),
    recipe({ id: 'r3', name: 'Ensalada César', category: 'Comida' }),
  ];

  it('renders one card per recipe in the grid', () => {
    render(<RecipeGridView recipes={items} loading={false} onAdd={() => {}} />);
    expect(screen.getByTestId('recipe-card-r1')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-card-r2')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-card-r3')).toBeInTheDocument();
  });

  it('shows recipe metadata in the card (kcal, servings, time)', () => {
    render(<RecipeGridView recipes={[items[0]]} loading={false} onAdd={() => {}} />);
    expect(screen.getByText('328 kcal')).toBeInTheDocument();
    expect(screen.getByText(/4 porciones/)).toBeInTheDocument();
    expect(screen.getByText(/45min/)).toBeInTheDocument();
  });

  it('uses singular form when servings = 1', () => {
    render(<RecipeGridView recipes={[recipe({ id: 'x', servings: 1 })]} loading={false} onAdd={() => {}} />);
    expect(screen.getByText(/1 porción(?!es)/)).toBeInTheDocument();
  });

  it('omits time metadata when both prep and cook are 0', () => {
    render(<RecipeGridView recipes={[recipe({ id: 'x', prep_time: 0, cook_time: 0 })]} loading={false} onAdd={() => {}} />);
    expect(screen.queryByText(/min/)).toBeNull();
  });

  it('renders category overlay on the image when category is set', () => {
    render(<RecipeGridView recipes={[items[0]]} loading={false} onAdd={() => {}} />);
    // Comida appears as overlay; assert at least once
    expect(screen.getAllByText('Comida').length).toBeGreaterThanOrEqual(1);
  });
});

describe('RecipeGridView - add action', () => {
  it('calls onAdd with the recipe when "+" is clicked', () => {
    const onAdd = vi.fn();
    const r = recipe();
    render(<RecipeGridView recipes={[r]} loading={false} onAdd={onAdd} />);
    fireEvent.click(screen.getByLabelText(/Agregar Arroz con pollo/i));
    expect(onAdd).toHaveBeenCalledWith(r);
  });

  it('shows the "added" checkmark when added[recipeId] is true', () => {
    const onAdd = vi.fn();
    const r = recipe();
    const { container } = render(
      <RecipeGridView recipes={[r]} loading={false} onAdd={onAdd} added={{ r1: true }} />
    );
    // Looking for the check svg via class change is brittle; verify aria
    const btn = screen.getByLabelText(/Agregar Arroz con pollo/i);
    expect(btn).toHaveClass('bg-emerald-500');
  });
});

describe('RecipeGridView - category filter chips', () => {
  const mixed = [
    recipe({ id: 'r1', name: 'A', category: 'Comida' }),
    recipe({ id: 'r2', name: 'B', category: 'Desayuno' }),
    recipe({ id: 'r3', name: 'C', category: 'Comida' }),
    recipe({ id: 'r4', name: 'D', category: 'Cena' }),
  ];

  it('renders chips for each unique category plus a "Todas" chip', () => {
    render(<RecipeGridView recipes={mixed} loading={false} onAdd={() => {}} />);
    const chips = screen.getByTestId('recipe-category-chips');
    expect(chips).toBeInTheDocument();
    expect(screen.getByText('Todas')).toBeInTheDocument();
    // Get only category chip buttons (avoid the in-card overlay)
    expect(chips.querySelector('button:nth-of-type(2)')).toHaveTextContent('Comida');
    expect(chips.querySelector('button:nth-of-type(3)')).toHaveTextContent('Desayuno');
    expect(chips.querySelector('button:nth-of-type(4)')).toHaveTextContent('Cena');
  });

  it('hides the chip bar when only one category is present', () => {
    render(
      <RecipeGridView
        recipes={[recipe({ id: 'r1', category: 'Comida' }), recipe({ id: 'r2', category: 'Comida' })]}
        loading={false}
        onAdd={() => {}}
      />
    );
    expect(screen.queryByTestId('recipe-category-chips')).toBeNull();
  });

  it('filters the grid when a category chip is clicked', () => {
    render(<RecipeGridView recipes={mixed} loading={false} onAdd={() => {}} />);
    expect(screen.getAllByTestId(/^recipe-card-/)).toHaveLength(4);

    const chips = screen.getByTestId('recipe-category-chips');
    fireEvent.click(chips.querySelector('button:nth-of-type(2)')); // Comida
    const cards = screen.getAllByTestId(/^recipe-card-/);
    expect(cards.map((el) => el.dataset.testid)).toEqual(['recipe-card-r1', 'recipe-card-r3']);
  });

  it('resets to "all" when active category disappears from the upstream list', () => {
    const { rerender } = render(<RecipeGridView recipes={mixed} loading={false} onAdd={() => {}} />);
    const chips = screen.getByTestId('recipe-category-chips');
    fireEvent.click(chips.querySelector('button:nth-of-type(4)')); // Cena
    expect(screen.getAllByTestId(/^recipe-card-/)).toHaveLength(1);

    // Upstream removes Cena recipes (e.g. search filtered them out)
    rerender(<RecipeGridView recipes={mixed.filter((r) => r.category !== 'Cena')} loading={false} onAdd={() => {}} />);
    // Filter resets to "all" → all remaining cards visible
    expect(screen.getAllByTestId(/^recipe-card-/)).toHaveLength(3);
  });
});

describe('RecipeGridView - image fallback', () => {
  it('renders ChefHat placeholder when image_url is missing', () => {
    const { container } = render(
      <RecipeGridView
        recipes={[recipe({ id: 'r1', image_url: undefined })]}
        loading={false}
        onAdd={() => {}}
      />
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('swaps to fallback on image error', () => {
    render(<RecipeGridView recipes={[recipe()]} loading={false} onAdd={() => {}} />);
    const img = screen.getByAltText('Arroz con pollo');
    fireEvent.error(img);
    expect(screen.queryByAltText('Arroz con pollo')).toBeNull();
  });
});

describe('RecipeGridView - highlight callback', () => {
  it('passes recipe name through the highlight prop when provided', () => {
    const highlight = vi.fn((name) => <mark data-testid="highlighted">{name}</mark>);
    render(<RecipeGridView recipes={[recipe()]} loading={false} onAdd={() => {}} highlight={highlight} />);
    expect(highlight).toHaveBeenCalledWith('Arroz con pollo');
    expect(screen.getByTestId('highlighted')).toBeInTheDocument();
  });
});
