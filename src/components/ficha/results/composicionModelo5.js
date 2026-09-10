// El fraccionamiento de 5 componentes de Kerr (1988), tal como lo necesita la
// tarjeta.
//
// LAS FÓRMULAS NO VIVEN AQUÍ. Están en `lib/anthropometry/composition`, que es
// exactamente lo mismo que usa el informe impreso y la evolución. Este archivo
// traduce ese resultado a lo que la pantalla dibuja y añade lo único que el
// cálculo no da: los avisos de medición sospechosa.
//
// POR QUÉ SE UNIFICÓ: había DOS implementaciones de las cinco fórmulas, una
// para la pantalla y otra para el papel. Daban lo mismo, pero nada las mantenía
// sincronizadas — y la de la pantalla era la más floja de las dos: aceptaba
// cualquier cosa que no estuviera vacía, la metía en la fórmula y pintaba "NaN"
// en la tabla. Con una ficha vieja que trajera basura en un pliegue, el
// nutricionista veía "Masa Adiposa NaN". Ahora se dice qué medida falta, que es
// lo que ya hacía el modelo de 4.
//
// CÓMO FUNCIONA EL MODELO PHANTOM, en una línea: no se mide al paciente contra
// una tabla, se mide contra un humano de referencia de 170.18 cm. La
// reconciliación final escala las cinco masas para que sumen el peso de la
// báscula, y esa columna ajustada es la que el nutricionista lee.
import {
  compute5Components,
  ETIQUETAS_PLIEGUES,
  PLIEGUES_ADIPOSA,
} from '@/lib/anthropometry/composition';
import { LABEL_GROUP, v } from './resultsShared';

/** Convierte "Cintura" en una píldora que sabe llevar a su pestaña. */
const pildoras = (etiquetas) => (etiquetas || []).map((label) => ({
  label,
  group: LABEL_GROUP[label] ?? null,
}));

/**
 * Lo que huele a medida mal tomada.
 *
 * No corrige nada: avisa. Un pliegue de 1 mm o un tórax imposible dan números
 * que parecen razonables al llegar a la tabla, y sin este aviso el
 * nutricionista no tiene por qué sospechar de la medición.
 */
const avisosDeCalidad = ({ sk, p, w, pesoPredictivo, deltaPct }) => {
  const avisos = [];

  for (const k of PLIEGUES_ADIPOSA) {
    if (v(sk[k]) && sk[k] < 2) {
      avisos.push(`Pliegue ${ETIQUETAS_PLIEGUES[k]} = ${sk[k]} mm (≤ 2 mm, verifica medición)`);
    }
  }

  if (v(p.mesosternal) && p.mesosternal < 70) {
    avisos.push(`Perímetro mesoesternal = ${p.mesosternal} cm (< 70 cm; revisar tórax)`);
  }

  if (deltaPct !== null && Math.abs(deltaPct) > 10) {
    // Se dice qué significa la diferencia y qué revisar, en lugar del símbolo
    // técnico |Δ%|, e incluyendo la dirección (sobre o subestima).
    const direccion = deltaPct > 0 ? 'mayor' : 'menor';
    const absPct = Math.abs(deltaPct).toFixed(1);
    avisos.push(
      `El peso estimado por las masas (${pesoPredictivo} kg) es ${absPct}% ${direccion} al peso real (${w} kg). `
      + 'Suele indicar errores en talla sentado o en los diámetros del tórax (transverso/anteroposterior). Te recomendamos repetir esas mediciones.'
    );
  }

  return avisos;
};

/**
 * Reparte el peso en piel, adiposa, muscular, ósea y residual.
 *
 * @param data       Medición: weight, height, height_sitting, skinfolds,
 *                   diameters, perimeters.
 * @param esFemenino Sexo ya resuelto a booleano. En Kerr el sexo entra en UN
 *                   solo sitio —el grosor de piel y el coeficiente de
 *                   superficie corporal—; las otras cuatro masas salen de
 *                   medidas que no se corrigen por sexo.
 * @returns componentes listos para pintar (predicho, ajustado y qué falta),
 *          el peso predictivo, el factor de ajuste, la desviación y los avisos.
 */
export const calcularModelo5 = (data, esFemenino) => {
  const sk = data?.skinfolds || {};
  const p = data?.perimeters || {};

  const resultado = compute5Components({
    weight: data?.weight,
    height: data?.height,
    height_sitting: data?.height_sitting,
    sex: esFemenino ? 'F' : 'M',
    skinfolds: sk,
    diameters: data?.diameters || {},
    perimeters: p,
  });

  return {
    // La columna principal es la AJUSTADA: es el resultado clínicamente válido
    // tras la reconciliación con el peso de la báscula.
    componentes: resultado.rows.map((fila) => ({
      name: fila.name,
      kgPred: fila.kg,
      kgAdj: fila.kgAdj,
      missing: pildoras(fila.missing),
    })),
    pesoPredictivo: resultado.pesoPredictivo,
    factorAjuste: resultado.factorAjuste,
    deltaPct: resultado.deltaPct,
    avisos: avisosDeCalidad({
      sk,
      p,
      w: data?.weight,
      pesoPredictivo: resultado.pesoPredictivo,
      deltaPct: resultado.deltaPct,
    }),
  };
};
