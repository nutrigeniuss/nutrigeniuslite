import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import FoodSearchModal from '@/components/diet/FoodSearchModal';

beforeEach(() => cleanup());

describe('FoodSearchModal - render lifecycle', () => {
  it('renders nothing when open is false', () => {
    render(
      <FoodSearchModal open={false} onClose={() => {}}>
        <div>child</div>
      </FoodSearchModal>
    );
    expect(screen.queryByTestId('food-search-modal')).toBeNull();
  });

  it('renders dialog with default title when open', () => {
    render(
      <FoodSearchModal open onClose={() => {}}>
        <div>child</div>
      </FoodSearchModal>
    );
    expect(screen.getByTestId('food-search-modal')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Agregar alimento')).toBeInTheDocument();
  });

  it('uses custom title when provided', () => {
    render(
      <FoodSearchModal open onClose={() => {}} title="Agregar a Desayuno">
        <div>child</div>
      </FoodSearchModal>
    );
    expect(screen.getByText('Agregar a Desayuno')).toBeInTheDocument();
  });

  it('renders children content inside the body slot', () => {
    render(
      <FoodSearchModal open onClose={() => {}}>
        <div data-testid="search-body">food search content</div>
      </FoodSearchModal>
    );
    expect(screen.getByTestId('search-body')).toBeInTheDocument();
    expect(screen.getByText('food search content')).toBeInTheDocument();
  });
});

describe('FoodSearchModal - close actions', () => {
  it('fires onClose when X button clicked', () => {
    const onClose = vi.fn();
    render(<FoodSearchModal open onClose={onClose}><div>x</div></FoodSearchModal>);
    fireEvent.click(screen.getByLabelText('Cerrar buscador de alimentos'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fires onClose when overlay clicked', () => {
    const onClose = vi.fn();
    render(<FoodSearchModal open onClose={onClose}><div>x</div></FoodSearchModal>);
    fireEvent.click(screen.getByTestId('food-search-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fires onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<FoodSearchModal open onClose={onClose}><div>x</div></FoodSearchModal>);
    act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not fire Esc handler when modal is closed', () => {
    const onClose = vi.fn();
    render(<FoodSearchModal open={false} onClose={onClose}><div>x</div></FoodSearchModal>);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('uses latest onClose reference across re-renders (stable listener)', () => {
    const firstClose = vi.fn();
    const secondClose = vi.fn();
    const { rerender } = render(
      <FoodSearchModal open onClose={firstClose}><div>x</div></FoodSearchModal>
    );
    rerender(<FoodSearchModal open onClose={secondClose}><div>x</div></FoodSearchModal>);
    act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });
    expect(firstClose).not.toHaveBeenCalled();
    expect(secondClose).toHaveBeenCalledTimes(1);
  });
});

describe('FoodSearchModal - autofocus convention', () => {
  it('moves focus to element marked with data-autofocus when opened', async () => {
    render(
      <FoodSearchModal open onClose={() => {}}>
        <input data-autofocus aria-label="search" />
        <button>other</button>
      </FoodSearchModal>
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(document.activeElement).toBe(screen.getByLabelText('search'));
  });
});

describe('FoodSearchModal - footer hint', () => {
  it('renders the persistent open + Esc instruction', () => {
    render(<FoodSearchModal open onClose={() => {}}><div>x</div></FoodSearchModal>);
    expect(screen.getByText(/Agrega varios alimentos sin cerrar/i)).toBeInTheDocument();
    expect(screen.getByText('Esc')).toBeInTheDocument();
  });
});
