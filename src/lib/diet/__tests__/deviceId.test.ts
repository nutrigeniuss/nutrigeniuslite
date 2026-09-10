import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { obtenerIdDeCelular, describirEsteCelular } from '../deviceId';

// EL IDENTIFICADOR DEL CELULAR ES LO QUE EVITA QUE EL PACIENTE TENGA QUE
// ESCRIBIR SU FECHA DE NACIMIENTO CADA VEZ QUE ABRE SU DIETA.
//
// Si cambiara entre visitas, cada vez sería un celular nuevo: le pediría la
// fecha una y otra vez y en tres aperturas se comería el tope de tres. Por eso
// lo que se prueba aquí es, sobre todo, que NO CAMBIE.

const CLAVE = 'nutrigenius.dieta.celular';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('obtenerIdDeCelular', () => {
  it('devuelve el mismo entre visitas', () => {
    const primera = obtenerIdDeCelular();
    const segunda = obtenerIdDeCelular();
    expect(segunda).toBe(primera);
  });

  it('lo deja guardado con el formato que exige el servidor', () => {
    const id = obtenerIdDeCelular();
    // Entre 20 y 64, solo letras minúsculas, números y guiones: cualquier otra
    // cosa la rechaza `patient_shared_diet` y el paciente se queda sin dieta.
    expect(id).toMatch(/^[a-z0-9-]{20,64}$/);
    expect(window.localStorage.getItem(CLAVE)).toBe(id);
  });

  it('un valor manipulado a mano se descarta y se genera otro válido', () => {
    // Sin esto se mandaría al servidor algo que va a rechazar, y el paciente
    // vería «no encontramos este plan» sin ninguna forma de arreglarlo.
    window.localStorage.setItem(CLAVE, 'corto');
    expect(obtenerIdDeCelular()).toMatch(/^[a-z0-9-]{20,64}$/);
  });

  it('sin localStorage sigue funcionando en vez de reventar', () => {
    // Modo incógnito. La dieta tiene que abrirse igual —le pedirá la fecha cada
    // vez, que es incómodo pero es abrir— y no quedarse en una pantalla rota.
    const romper = () => { throw new Error('sin almacenamiento'); };
    vi.stubGlobal('localStorage', { getItem: romper, setItem: romper });

    expect(obtenerIdDeCelular()).toMatch(/^[a-z0-9-]{20,64}$/);
  });

  it('dos navegadores distintos no comparten identificador', () => {
    const primero = obtenerIdDeCelular();
    window.localStorage.clear();
    expect(obtenerIdDeCelular()).not.toBe(primero);
  });
});

describe('describirEsteCelular', () => {
  const conUserAgent = (ua: string): string => {
    vi.stubGlobal('navigator', { userAgent: ua });
    return describirEsteCelular();
  };

  it('nombra el navegador y el sistema', () => {
    expect(conUserAgent('Mozilla/5.0 (Linux; Android 13; SM-A155M) Chrome/120.0 Mobile Safari/537.36'))
      .toBe('Chrome en Android');
    expect(conUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Version/17.0 Safari/604.1'))
      .toBe('Safari en iPhone');
  });

  it('Edge no se hace pasar por Chrome', () => {
    // Los dos llevan «Chrome/» en el user agent, y el orden de los ifs es lo
    // único que los distingue.
    expect(conUserAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36 Edg/120.0'))
      .toBe('Edge en Windows');
  });

  it('un user agent desconocido no deja la fila vacía', () => {
    expect(conUserAgent('algo raro')).toBe('Navegador');
  });
});
