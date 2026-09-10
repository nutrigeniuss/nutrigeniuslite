// El nivel cualitativo de cada componente del somatotipo: "Bajo", "Moderado",
// "Alto", "Muy alto", con su color.
//
// Esto SÍ es presentación: convierte un número en algo que se lee de un
// vistazo. El CÁLCULO del somatotipo —y su clasificación clínica en las 13
// zonas de Heath-Carter— viven en lib/anthropometry/composition, que es lo
// mismo que usa el informe impreso.
//
// Aquí hubo una segunda copia de esa clasificación, idéntica a la de la
// librería salvo por los tipos. Se borró al unificar: dos copias de un
// criterio clínico solo se distinguen el día que alguien corrige una.

// Nivel cualitativo por componente según los rangos clínicos del artículo.
// Bajo 0.5–2.5 · Moderado 3–5.5 · Alto 5.5–7 · Muy alto ≥ 7.5
export function componentLevel(val) {
  if (val == null || Number.isNaN(val)) return null;
  if (val < 3) return { label: 'Bajo', color: '#94a3b8' };
  if (val < 5.5) return { label: 'Moderado', color: '#06a510' };
  if (val < 7) return { label: 'Alto', color: '#f59e0b' };
  return { label: 'Muy alto', color: '#ff5c57' };
}
