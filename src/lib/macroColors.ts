// Colores de los macronutrientes: UNA sola definición para toda la app.
//
//     CHO = AMARILLO · PRO = ROJO · GRA = CELESTE
//
// El criterio NO es nuevo: ya estaba escrito en
// `src/components/patient/requerimiento/logic.ts` ("que el editor y el sidebar
// hablen el mismo idioma visual"), y lo seguían el módulo de intercambios, el
// requerimiento y el resumen del recordatorio de 24 h. Las pantallas de dieta y
// recetas eran las que no se habían enterado: usaban azul para la proteína y
// rosa para la grasa, y el panel de macros, un tercer esquema con la grasa en
// naranja. Aquí se unifican los tres.
//
// Los tonos son los que ya usaba la convención, no unos nuevos: si se usara
// `red-400` de Tailwind (#f87171) el rojo saldría más pálido que el del resto
// de la app, que es #ff4444.
//
//     relleno (puntos, barras, dona)   #fbbf24 · #ff4444 · #22d3ee
//     texto   (números, porcentajes)   #d97706 · #dc2626 · #0891b2
//
// Las clases de Tailwind se escriben COMPLETAS a propósito: Tailwind genera el
// CSS leyendo el texto de los archivos, así que una clase armada a pedazos
// (`bg-${color}-400`) no existiría en el build y el color desaparecería en
// producción aunque en desarrollo se viera bien.

export type MacroKey = 'carbs' | 'protein' | 'fat';

export type MacroStyle = {
  /** Etiqueta corta de la cabecera de tabla: CHO, PRO, GRA. */
  label: string;
  /** Etiqueta completa: Carbohidratos, Proteínas, Grasas. */
  name: string;
  /** Punto de color junto a la etiqueta. */
  dot: string;
  /** Color del número. */
  value: string;
  /** Color de la "g" pequeña que sigue al número. */
  unit: string;
};

export const MACRO_STYLES: Record<MacroKey, MacroStyle> = {
  carbs: {
    label: 'CHO',
    name: 'Carbohidratos',
    dot: 'bg-amber-400', // #fbbf24
    value: 'text-amber-600', // #d97706
    unit: 'text-amber-400',
  },
  protein: {
    // El rojo de la convención es #ff4444; `red-400` sería más pálido y
    // desentonaría con el amarillo y el celeste, que sí son vivos.
    label: 'PRO',
    name: 'Proteínas',
    dot: 'bg-[#ff4444]',
    value: 'text-red-600', // #dc2626
    unit: 'text-[#ff4444]',
  },
  fat: {
    label: 'GRA',
    name: 'Grasas',
    dot: 'bg-cyan-400', // #22d3ee
    value: 'text-cyan-600', // #0891b2
    unit: 'text-cyan-400',
  },
};

/** Orden en el que se muestran las columnas de macros en las tablas. */
export const MACRO_ORDER: MacroKey[] = ['carbs', 'protein', 'fat'];

// Los mismos colores en hexadecimal, para los gráficos y los `style` en línea
// (la dona de macros, el panel y el modal), donde no se puede usar una clase de
// Tailwind porque el color lo consume una librería de gráficos.
//
// Se distingue `fill` de `text` porque el relleno es un tono claro y vivo, que
// como texto sobre fondo blanco no se leería.
export const MACRO_HEX: Record<MacroKey, { fill: string; text: string }> = {
  carbs: { fill: '#fbbf24', text: '#d97706' },
  protein: { fill: '#ff4444', text: '#dc2626' },
  fat: { fill: '#22d3ee', text: '#0891b2' },
};
