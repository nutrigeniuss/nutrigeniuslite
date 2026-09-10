import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

// ─────────────────────────────────────────────────────────────────────────────
// GUARDAR UN ALIMENTO DEL CATÁLOGO DE INTERCAMBIOS.
//
// Tiene un caso torcido que no se ve leyendo la pantalla: los alimentos del
// catálogo OFICIAL no viven en la base, vienen de un archivo estático y su id
// no es un uuid. Para editar uno hay que sembrar primero todo el catálogo en la
// base y luego buscar su gemelo por nombre.
//
// Y si la siembra falla, NO se cierra el editor ni se refresca: se deja al
// nutricionista donde estaba, con lo que escribió, para que pueda reintentar.
// Ese detalle es el que estas pruebas protegen.
// ─────────────────────────────────────────────────────────────────────────────

const crearAlimento = vi.fn();
const actualizarAlimento = vi.fn();
const sembrarCatalogo = vi.fn();
const cargarGrupos = vi.fn();

vi.mock('@/lib/exchangeFoodsData', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    createExchangeFood: (...a: unknown[]) => crearAlimento(...a),
    updateExchangeFood: (...a: unknown[]) => actualizarAlimento(...a),
    deleteExchangeFood: vi.fn(),
    seedExchangeFoodsFromStatic: (...a: unknown[]) => sembrarCatalogo(...a),
    loadExchangeGroups: (...a: unknown[]) => cargarGrupos(...a),
  };
});

const avisos: { title?: string; description?: string }[] = [];
vi.mock('@/components/ui/use-toast', () => ({
  toast: (aviso: { title?: string; description?: string }) => { avisos.push(aviso); },
}));

const ExchangeFoodCatalog = (await import('@/components/exchanges/ExchangeFoodCatalog')).default;

/** Un alimento que YA vive en la base: su id es un uuid. */
const DE_LA_BASE = {
  id: '11111111-2222-4333-8444-555555555555',
  name: 'Arroz cocido',
  grams_raw: 50,
  grams_cooked: 150,
  measure: '1/2 taza',
  source: 'custom' as const,
};

/** Un alimento del catálogo oficial: su id NO es un uuid. */
const DEL_CATALOGO_OFICIAL = {
  id: 'cereal-arroz',
  name: 'Arroz oficial',
  grams_raw: 50,
  grams_cooked: 150,
  measure: '1/2 taza',
  source: 'static' as const,
};

const grupoCon = (...alimentos: unknown[]) => [
  { key: 'cereales', label: 'Cereales', foods: alimentos },
];

/**
 * Abre el editor del primer alimento de la lista y envía el formulario.
 *
 * EL TOPE DE ESPERA ES EXPLÍCITO Y NO EL DE POR DEFECTO. Antes usaba el
 * de la librería —un segundo— y esta prueba fallaba de vez en cuando SOLO en
 * la corrida completa: con 136 archivos en paralelo, la carga del catálogo a
 * veces no llegaba a tiempo y la búsqueda moría con «Unable to find
 * role=button and name /editar/i» sobre una pantalla todavía a medio pintar.
 * Aislada pasaba siempre, que es lo que despistaba.
 *
 * Subir el tope no tapa ningún fallo: lo que se comprueba es que los botones
 * ACABAN apareciendo, y un segundo era un número arbitrario, no un requisito.
 * Si de verdad se rompiera la carga, la prueba seguiría fallando — cinco
 * segundos más tarde.
 */
const ESPERA = { timeout: 5000 };

const editarPrimerAlimento = async () => {
  const botones = await screen.findAllByRole('button', { name: /editar/i }, ESPERA);
  fireEvent.click(botones[0]);

  const formulario = await waitFor(() => {
    const f = document.querySelector('form');
    if (!f) throw new Error('el editor no se abrió');
    return f;
  }, ESPERA);
  fireEvent.submit(formulario);
};

beforeEach(() => {
  vi.clearAllMocks();
  avisos.length = 0;
  crearAlimento.mockResolvedValue({});
  actualizarAlimento.mockResolvedValue({});
  sembrarCatalogo.mockResolvedValue({ skipped: false, inserted: 120 });
});

afterEach(() => cleanup());

describe('ExchangeFoodCatalog — editar un alimento que ya vive en la base', () => {
  it('lo actualiza directo, sin sembrar nada', async () => {
    cargarGrupos.mockResolvedValue(grupoCon(DE_LA_BASE));

    render(<ExchangeFoodCatalog />);
    await editarPrimerAlimento();

    await waitFor(() => expect(actualizarAlimento).toHaveBeenCalledTimes(1), ESPERA);
    expect(actualizarAlimento.mock.calls[0][0]).toBe(DE_LA_BASE.id);
    expect(sembrarCatalogo).not.toHaveBeenCalled();
  });
});

describe('ExchangeFoodCatalog — editar uno del catálogo oficial', () => {
  it('siembra el catálogo y actualiza el gemelo que quedó en la base', async () => {
    // Antes de sembrar solo está el estático; después aparece su gemelo real.
    const gemelo = { ...DE_LA_BASE, name: 'Arroz oficial' };
    cargarGrupos
      .mockResolvedValueOnce(grupoCon(DEL_CATALOGO_OFICIAL))
      .mockResolvedValue(grupoCon(gemelo));

    render(<ExchangeFoodCatalog />);
    await editarPrimerAlimento();

    await waitFor(() => expect(sembrarCatalogo).toHaveBeenCalledTimes(1), ESPERA);
    await waitFor(() => expect(actualizarAlimento).toHaveBeenCalledTimes(1), ESPERA);
    expect(actualizarAlimento.mock.calls[0][0]).toBe(gemelo.id);
  });

  it('si tras sembrar no aparece el gemelo, lo crea en vez de perder el cambio', async () => {
    cargarGrupos.mockResolvedValue(grupoCon(DEL_CATALOGO_OFICIAL));

    render(<ExchangeFoodCatalog />);
    await editarPrimerAlimento();

    await waitFor(() => expect(sembrarCatalogo).toHaveBeenCalledTimes(1), ESPERA);
    await waitFor(() => expect(crearAlimento).toHaveBeenCalledTimes(1), ESPERA);
    expect(actualizarAlimento).not.toHaveBeenCalled();
  });

  // EL DETALLE QUE IMPORTA: si la siembra falla, el editor NO se cierra. El
  // nutricionista se queda donde estaba, con lo que escribió, y puede
  // reintentar. Cerrarlo le haría perder el trabajo sin explicación.
  it('si la siembra falla, no guarda nada y deja el editor abierto', async () => {
    cargarGrupos.mockResolvedValue(grupoCon(DEL_CATALOGO_OFICIAL));
    sembrarCatalogo.mockRejectedValue(new Error('sin permisos'));

    render(<ExchangeFoodCatalog />);
    await editarPrimerAlimento();

    await waitFor(() => expect(sembrarCatalogo).toHaveBeenCalledTimes(1), ESPERA);
    expect(actualizarAlimento).not.toHaveBeenCalled();
    expect(crearAlimento).not.toHaveBeenCalled();
    // El formulario sigue en pantalla.
    expect(document.querySelector('form')).not.toBeNull();
  });
});
