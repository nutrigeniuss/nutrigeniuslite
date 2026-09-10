import { describe, it, expect } from 'vitest';
import { LABEL_GROUP, LABEL_FIELD } from '../resultsShared';
import { SECTIONS, TAB_KEYS } from '../../consult/consultConfig';

// Las pildoras de "falta esta medida" llevan a la pestana de captura y resaltan
// la casilla. Para eso hacen falta dos mapas, y ya se han quedado cortos dos
// veces: primero no navegaba "Pantorrilla medial" y luego navegaban pero no
// resaltaban las de composicion corporal. Desde fuera el sintoma es el mismo
// -no pasa nada al pulsar- y no lo detecta ninguna otra prueba.

// consultConfig es JavaScript, asi que aqui las secciones llegan sin tipar.
type Seccion = { title: string; fields: string[][] };
const SECCIONES = SECTIONS as unknown as Record<string, Seccion[]>;
const A_PESTANA = LABEL_GROUP as Record<string, string>;
const A_CAMPO = LABEL_FIELD as Record<string, string>;

const CAMPOS_REALES = new Set(
  Object.values(SECCIONES).flatMap((secciones) =>
    secciones.flatMap((s) => s.fields.map(([clave]) => clave)),
  ),
);

describe('mapas de etiqueta → pestaña y campo', () => {
  it('toda etiqueta que navega tambien sabe que casilla resaltar', () => {
    const sinCampo = Object.keys(A_PESTANA).filter((etiqueta) => !A_CAMPO[etiqueta]);
    expect(sinCampo, `estas llevan a la pestana pero no resaltan nada: ${sinCampo.join(', ')}`).toEqual([]);
  });

  it('los campos apuntados existen de verdad en el formulario', () => {
    const inventados = Object.entries(A_CAMPO)
      .filter(([, campo]) => !CAMPOS_REALES.has(campo))
      .map(([etiqueta, campo]) => `${etiqueta} -> ${campo}`);
    expect(inventados, `apuntan a campos que no existen: ${inventados.join(', ')}`).toEqual([]);
  });

  it('las pestanas indicadas existen', () => {
    const desconocidas = Object.entries(A_PESTANA)
      .filter(([, pestana]) => !TAB_KEYS.includes(pestana))
      .map(([etiqueta, pestana]) => `${etiqueta} -> ${pestana}`);
    expect(desconocidas).toEqual([]);
  });

  // El campo tiene que vivir en la pestana a la que se navega, o se abre una
  // pestana y se resalta algo que esta en otra.
  it('cada campo esta en la pestana a la que se manda', () => {
    const descolocadas: string[] = [];
    for (const [etiqueta, pestana] of Object.entries(A_PESTANA)) {
      const campo = A_CAMPO[etiqueta];
      if (!campo) continue;
      const seccion = SECCIONES[pestana];
      const estaAhi = seccion?.some((s) => s.fields.some(([clave]) => clave === campo));
      if (!estaAhi) descolocadas.push(`${etiqueta}: campo ${campo} no esta en la pestana ${pestana}`);
    }
    expect(descolocadas).toEqual([]);
  });
});
