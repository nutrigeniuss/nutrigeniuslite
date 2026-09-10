import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// CONTRATO DE COLOR DE LOS DOS PANELES DE RESUMEN.
//
// El panel del creador de dietas y el de intercambios tenían cada uno su copia
// de la paleta de macros, con los mismos valores escritos a mano. Estas pruebas
// congelan los colores que pintan HOY, para poder apuntarlos a la fuente única
// (@/lib/macroColors) sin cambiar lo que ve el nutricionista.
//
// Criterio: CHO amarillo (#fbbf24 / #d97706), PRO rojo (#ff4444 / #dc2626),
// GRA celeste (#22d3ee / #0891b2).

vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'nutri-1', country: 'PE' } }),
}));

const LeftPanel = (await import('@/components/diet/DietSummaryPanel')).default;
const ResumenPanel = (await import('@/components/exchanges/ResumenPanel')).default;

afterEach(() => cleanup());

// jsdom normaliza los colores en línea a rgb(), así que se comparan en ese
// formato en vez de en hexadecimal.
const aRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

const CHO_CLARO = aRgb('#fbbf24');
const PRO_CLARO = aRgb('#ff4444');
const GRA_CLARO = aRgb('#22d3ee');
const CHO_OSCURO = aRgb('#d97706');
const PRO_OSCURO = aRgb('#dc2626');
const GRA_OSCURO = aRgb('#0891b2');

/** Colores de fondo en línea (las barras de progreso de cada macro). */
const fondosEnLinea = () =>
  Array.from(document.querySelectorAll('[style*="background-color"]'))
    .map((el) => el.getAttribute('style'))
    .join(' | ');

/** Colores de texto en línea (los porcentajes). */
const textosEnLinea = () =>
  Array.from(document.querySelectorAll('[style*="color"]'))
    .map((el) => el.getAttribute('style'))
    .join(' | ');

describe('DietSummaryPanel — colores de macros', () => {
  const props = {
    totals: { calories: 1800, carbs: 200, protein: 90, fat: 60 },
    targets: { calories: 2000, carbs: 250, protein: 100, fat: 70 },
    // La vista "Por comida" solo lista comidas con calorías, y las calcula
    // sumando sus items: una comida sin items no aparece.
    meals: [
      {
        id: 'm1',
        name: 'Desayuno',
        time: '08:00',
        items: [{ calories: 400, protein: 20, carbs: 50, fat: 15, quantity: 1 }],
      },
    ],
    patientId: 'p1',
    onPrint: () => {},
    onClose: () => {},
  };

  const pintar = () =>
    render(
      <MemoryRouter>
        <LeftPanel {...props} />
      </MemoryRouter>,
    );

  it('pinta las barras con el amarillo, el rojo y el celeste del criterio', () => {
    pintar();
    const fondos = fondosEnLinea();

    expect(fondos).toContain(CHO_CLARO); // amarillo
    expect(fondos).toContain(PRO_CLARO); // rojo
    expect(fondos).toContain(GRA_CLARO); // celeste
  });

  it('pinta los porcentajes con el tono oscuro de cada macro', () => {
    pintar();
    const textos = textosEnLinea();

    expect(textos).toContain(CHO_OSCURO);
    expect(textos).toContain(PRO_OSCURO);
    expect(textos).toContain(GRA_OSCURO);
  });

  // Los chips del resumen por comida son donde PRO había quedado celeste y GRA
  // rojo, o sea al revés que el resto de la app.
  it('los chips por comida usan las clases del criterio', () => {
    pintar();
    // Los chips viven en la otra vista del panel.
    fireEvent.click(screen.getByText('Por comida'));
    const html = document.body.innerHTML;

    expect(html).toContain('text-amber-600');
    expect(html).toContain('text-red-600');
    expect(html).toContain('text-cyan-600');
  });
});

describe('ResumenPanel (intercambios) — colores de macros', () => {
  const props = {
    totals: { kcal: 1800, protein: 90, carbs: 200, fat: 60 },
    targetKcal: 2000,
    macroTargets: { carbs: 250, protein: 100, fat: 70 },
    groupColTotals: [],
    meals: [],
  };

  it('usa los mismos tres colores que el panel de dietas', () => {
    render(<ResumenPanel {...props} />);
    const todo = fondosEnLinea() + ' | ' + textosEnLinea();

    expect(todo).toContain(CHO_CLARO);
    expect(todo).toContain(PRO_CLARO);
    expect(todo).toContain(GRA_CLARO);
  });
});
