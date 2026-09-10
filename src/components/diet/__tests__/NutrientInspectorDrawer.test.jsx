import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import NutrientInspectorDrawer from '@/components/diet/NutrientInspectorDrawer';

const samplePayload = {
  kind: 'item',
  title: 'Pierna de pollo',
  subtitle: '1 Unidad pequeña (56.2g)',
  imageUrl: undefined,
  totals: { calories: 104, protein: 14, carbs: 0, fat: 4.9 },
  micros: [
    { key: 'sodium', label: 'Sodio', unit: 'mg', value: 72.5 },
    { key: 'calcium', label: 'Calcio', unit: 'mg', value: 10.7 },
    { key: 'vitamin_b12', label: 'Vitamina B12', unit: 'ug', value: 0.5 },
  ],
};

const recipePayload = {
  kind: 'recipe',
  title: 'Arroz con pollo',
  subtitle: '4 ingredientes',
  imageUrl: 'https://example.com/arroz.jpg',
  totals: { calories: 328, protein: 22.2, carbs: 45.9, fat: 5.6 },
  micros: [
    { key: 'fiber', label: 'Fibra', unit: 'g', value: 6.6 },
  ],
  ingredients: [
    { id: 'i1', name: 'Arroz blanco', quantity: 5, unit: 'Cucharada', calories: 149 },
    { id: 'i2', name: 'Pollo', quantity: 1, unit: 'Unidad', calories: 104 },
  ],
};

beforeEach(() => cleanup());

describe('NutrientInspectorDrawer - render lifecycle', () => {
  it('renders nothing when payload is null', () => {
    render(<NutrientInspectorDrawer payload={null} onClose={() => {}} />);
    expect(screen.queryByTestId('nutrient-inspector-drawer')).toBeNull();
  });

  it('renders dialog with title and subtitle when payload provided', () => {
    render(<NutrientInspectorDrawer payload={samplePayload} onClose={() => {}} />);
    expect(screen.getByTestId('nutrient-inspector-drawer')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Pierna de pollo')).toBeInTheDocument();
    expect(screen.getByText('1 Unidad pequeña (56.2g)')).toBeInTheDocument();
  });

  it('shows recipe label for recipe kind', () => {
    render(<NutrientInspectorDrawer payload={recipePayload} onClose={() => {}} />);
    expect(screen.getByText('Receta · Detalle')).toBeInTheDocument();
  });

  it('shows item label for item kind', () => {
    render(<NutrientInspectorDrawer payload={samplePayload} onClose={() => {}} />);
    expect(screen.getByText('Alimento · Detalle')).toBeInTheDocument();
  });
});

describe('NutrientInspectorDrawer - close actions', () => {
  it('calls onClose when X button clicked', () => {
    const onClose = vi.fn();
    render(<NutrientInspectorDrawer payload={samplePayload} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Cerrar detalle nutricional'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay clicked', () => {
    const onClose = vi.fn();
    render(<NutrientInspectorDrawer payload={samplePayload} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('nutrient-inspector-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key pressed', () => {
    const onClose = vi.fn();
    render(<NutrientInspectorDrawer payload={samplePayload} onClose={onClose} />);
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not fire Esc handler when drawer is closed', () => {
    const onClose = vi.fn();
    render(<NutrientInspectorDrawer payload={null} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('uses the latest onClose reference (stable listener)', () => {
    const firstClose = vi.fn();
    const secondClose = vi.fn();
    const { rerender } = render(<NutrientInspectorDrawer payload={samplePayload} onClose={firstClose} />);
    rerender(<NutrientInspectorDrawer payload={samplePayload} onClose={secondClose} />);
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(firstClose).not.toHaveBeenCalled();
    expect(secondClose).toHaveBeenCalledTimes(1);
  });
});

describe('NutrientInspectorDrawer - macros and micros', () => {
  it('renders the 4 macro cards with totals', () => {
    render(<NutrientInspectorDrawer payload={samplePayload} onClose={() => {}} />);
    expect(screen.getByText('Kcal')).toBeInTheDocument();
    expect(screen.getByText('Carbs')).toBeInTheDocument();
    expect(screen.getByText('Prot.')).toBeInTheDocument();
    expect(screen.getByText('Gras.')).toBeInTheDocument();
    expect(screen.getByText('104')).toBeInTheDocument();
  });

  it('renders one chip per populated micro, grouped by category', () => {
    render(<NutrientInspectorDrawer payload={samplePayload} onClose={() => {}} />);
    expect(screen.getByTestId('micro-chip-sodium')).toBeInTheDocument();
    expect(screen.getByTestId('micro-chip-calcium')).toBeInTheDocument();
    expect(screen.getByTestId('micro-chip-vitamin_b12')).toBeInTheDocument();
    expect(screen.getByTestId('micro-category-mineral')).toBeInTheDocument();
    expect(screen.getByTestId('micro-category-vitamin')).toBeInTheDocument();
  });

  it('shows empty-state message when no micros present', () => {
    render(
      <NutrientInspectorDrawer
        payload={{ ...samplePayload, micros: [] }}
        onClose={() => {}}
      />
    );
    expect(screen.getByText(/no tiene micronutrientes registrados/i)).toBeInTheDocument();
  });

  it('shows micro count badge', () => {
    render(<NutrientInspectorDrawer payload={samplePayload} onClose={() => {}} />);
    expect(screen.getByText('3 presentes')).toBeInTheDocument();
  });
});

describe('NutrientInspectorDrawer - recipe ingredients list', () => {
  it('renders the per-ingredient breakdown when kind=recipe', () => {
    render(<NutrientInspectorDrawer payload={recipePayload} onClose={() => {}} />);
    expect(screen.getByText('Ingredientes')).toBeInTheDocument();
    expect(screen.getByText('Arroz blanco')).toBeInTheDocument();
    expect(screen.getByText('Pollo')).toBeInTheDocument();
    expect(screen.getByText('149')).toBeInTheDocument();
  });

  it('omits the ingredients section when kind=item', () => {
    render(<NutrientInspectorDrawer payload={samplePayload} onClose={() => {}} />);
    expect(screen.queryByText('Ingredientes')).toBeNull();
  });
});

describe('NutrientInspectorDrawer - image fallback', () => {
  it('renders ChefHat fallback when recipe has no imageUrl', () => {
    const noImage = { ...recipePayload, imageUrl: undefined };
    const { container } = render(<NutrientInspectorDrawer payload={noImage} onClose={() => {}} />);
    // No <img>, but the gradient fallback div should be there with aria-hidden
    expect(container.querySelector('img')).toBeNull();
  });

  it('swaps to fallback when image fails to load', () => {
    render(<NutrientInspectorDrawer payload={recipePayload} onClose={() => {}} />);
    const img = screen.getByAltText('Arroz con pollo');
    expect(img).toBeInTheDocument();
    fireEvent.error(img);
    // After error, the img is removed and fallback appears
    expect(screen.queryByAltText('Arroz con pollo')).toBeNull();
  });

  it('resets errored state when imageUrl prop changes', () => {
    const { rerender } = render(<NutrientInspectorDrawer payload={recipePayload} onClose={() => {}} />);
    fireEvent.error(screen.getByAltText('Arroz con pollo'));
    expect(screen.queryByAltText('Arroz con pollo')).toBeNull();
    rerender(
      <NutrientInspectorDrawer
        payload={{ ...recipePayload, imageUrl: 'https://example.com/other.jpg' }}
        onClose={() => {}}
      />
    );
    // New URL → fresh attempt to load, img tag back in DOM
    expect(screen.getByAltText('Arroz con pollo')).toBeInTheDocument();
  });
});

describe('NutrientInspectorDrawer - swap content without close', () => {
  it('updates content when payload prop changes without unmounting', () => {
    const { rerender } = render(
      <NutrientInspectorDrawer payload={samplePayload} onClose={() => {}} />
    );
    expect(screen.getByText('Pierna de pollo')).toBeInTheDocument();

    rerender(<NutrientInspectorDrawer payload={recipePayload} onClose={() => {}} />);
    expect(screen.queryByText('Pierna de pollo')).toBeNull();
    expect(screen.getByText('Arroz con pollo')).toBeInTheDocument();
  });
});
