import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import ExchangeTable from '../ExchangeTable';

/**
 * Adaptación a móvil de la matriz de intercambios (comidas × grupos).
 *
 * En escritorio la tabla es `table-fixed w-full` y reparte el ancho disponible.
 * En un teléfono eso aplasta las columnas: con 5 grupos quedan unos 40 px por
 * columna y los steppers dejan de ser pulsables. En móvil la tabla crece y se
 * desplaza en horizontal, con la primera columna fija para no perder de vista
 * a qué tiempo de comida corresponde la fila que se está tocando.
 *
 * Se prueban las clases porque son el mecanismo: no hay layout real en jsdom,
 * pero si `sticky left-0` o `table-fixed` desaparecen, la adaptación se rompe.
 */

const grupos = [
  { key: 'cereales', label: 'Cereales' },
  { key: 'frutas', label: 'Frutas' },
  { key: 'lacteos', label: 'Lácteos' },
  { key: 'carnes', label: 'Carnes' },
  { key: 'grasas', label: 'Grasas' },
];

const props = {
  firstColumnWidth: 228,
  isCompactTable: false,
  isUltraCompactTable: false,
  showGroupPicker: false,
  setShowGroupPicker: vi.fn(),
  activeGroupKeys: grupos.map((g) => g.key),
  addGroup: vi.fn(),
  activeGroups: grupos,
  draggedGroupKey: null,
  dragOverGroupKey: null,
  removeGroup: vi.fn(),
  handleGroupDragEnter: vi.fn(),
  handleGroupDragStart: vi.fn(),
  clearGroupDragState: vi.fn(),
  handleGroupDrop: vi.fn(),
  handleMoveGroupClick: vi.fn(),
  meals: [
    { id: 'm1', name: 'Desayuno', time: '07:00', exchanges: { cereales: 2 } },
    { id: 'm2', name: 'Almuerzo', time: '13:00', exchanges: {} },
  ],
  updateActiveScenario: vi.fn(),
  updateExchange: vi.fn(),
  removeMeal: vi.fn(),
  addMeal: vi.fn(),
  groupColTotals: grupos.map((group) => ({ group, total: group.key === 'cereales' ? 2 : 0 })),
};

const primeraColumnaDeCuerpo = (container) =>
  container.querySelector('tbody tr td:first-child');

describe('ExchangeTable · adaptación a móvil', () => {
  it('en escritorio reparte el ancho y NO fija la primera columna', () => {
    const { container } = render(<ExchangeTable {...props} isMobile={false} />);

    const tabla = container.querySelector('table');
    expect(tabla.className).toContain('table-fixed');
    expect(primeraColumnaDeCuerpo(container).className).not.toContain('sticky');
  });

  it('en móvil deja crecer la tabla en vez de aplastar las columnas', () => {
    const { container } = render(<ExchangeTable {...props} isMobile />);

    const tabla = container.querySelector('table');
    // `table-fixed` es justo lo que aplasta: reparte el ancho del contenedor
    // entre todas las columnas pase lo que pase.
    expect(tabla.className).not.toContain('table-fixed');
    expect(tabla.className).toContain('min-w-full');
  });

  it('en móvil fija la primera columna en todas sus filas', () => {
    const { container } = render(<ExchangeTable {...props} isMobile />);

    // Cabecera, filas de comida, fila de "agregar" y fila de totales: si alguna
    // se quedara sin fijar, esa fila se desalinearía al desplazarse.
    const celdasFijas = container.querySelectorAll('.sticky.left-0');
    expect(celdasFijas.length).toBe(1 + props.meals.length + 2);

    for (const celda of celdasFijas) {
      // Sin fondo opaco, las celdas que pasan por debajo se transparentan.
      expect(celda.className).toMatch(/bg-/);
    }
  });

  it('el contenedor permite desplazamiento horizontal', () => {
    const { container } = render(<ExchangeTable {...props} isMobile />);
    expect(container.querySelector('.overflow-x-auto')).toBeTruthy();
  });

  it('en móvil las columnas de grupo tienen ancho mínimo para los steppers', () => {
    const { container } = render(<ExchangeTable {...props} isMobile />);

    // El ancho dejó de ser un número fijo y pasó a ser continuo: `clamp` con
    // suelo (para que el paso "− valor +" nunca se aplaste), un tramo que sigue
    // al ancho de la ventana, y techo (el ancho cómodo de escritorio).
    //
    // Se comprueba la FORMA, no los números: que haya suelo en px, un tramo en
    // vw y un techo en px, y que el suelo deje sitio al stepper. Afinar los
    // valores es normal —ya se hizo dos veces— y no debe romper el test; lo que
    // sí debe romperlo es volver a un ancho fijo o quedarse sin suelo.
    const cabecerasDeGrupo = [...container.querySelectorAll('thead th')].filter((th) => {
      const m = /^clamp\(\s*([\d.]+)px\s*,\s*[\d.]+vw\s*,\s*([\d.]+)px\s*\)$/.exec(th.style.minWidth);
      if (!m) return false;
      const [suelo, techo] = [Number(m[1]), Number(m[2])];
      return suelo >= 48 && techo > suelo;
    });
    expect(cabecerasDeGrupo.length).toBe(grupos.length);
  });

  it('sin la prop isMobile se comporta como escritorio', () => {
    // El valor por defecto importa: ExchangeTable se usa desde más de un sitio y
    // no todos pasan isMobile.
    const { container } = render(<ExchangeTable {...props} />);
    expect(container.querySelector('table').className).toContain('table-fixed');
  });
});
