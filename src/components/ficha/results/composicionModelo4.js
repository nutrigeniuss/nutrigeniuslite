// El modelo clásico de 4 componentes, tal como lo necesita la tarjeta.
//
// LAS FÓRMULAS NO VIVEN AQUÍ. Están en `lib/anthropometry/composition`, que es
// exactamente lo mismo que usa el informe impreso. Este archivo solo traduce
// ese resultado a lo que la pantalla dibuja.
//
// POR QUÉ SE UNIFICÓ: había DOS implementaciones de las mismas cuatro fórmulas
// —Durnin-Womersley/Siri, Rocha, Würch, Matiegka—, una para la pantalla y otra
// para el papel. Se comprobó que daban lo mismo en las ocho combinaciones de
// fórmula de grasa y sexo, así que ningún paciente vio números distintos. Pero
// nada las mantenía sincronizadas: quien corrigiera un coeficiente en una, la
// otra se quedaba con el viejo, y el paciente se llevaría impreso un número
// distinto del que el nutricionista tenía delante.
//
// LO QUE SÍ VIVE AQUÍ es lo que solo la pantalla necesita: las píldoras
// clicables de "te falta esta medida", que además del texto necesitan saber a
// qué pestaña del formulario llevar.
import { AUTOR_GRASA, compute4Components } from '@/lib/anthropometry/composition';
import { LABEL_GROUP } from './resultsShared';

/**
 * Las cuatro fórmulas de masa grasa entre las que se puede elegir.
 *
 * Los nombres salen de la misma fuente que los usa el cálculo: si se copiaran
 * aquí, el selector podría acabar ofreciendo un autor y calculando con otro.
 *
 * La elección se recuerda como preferencia del profesional, aparte de la de
 * Derivados de Pliegues (ver useFormulaGrasa).
 */
export const AUTORES_GRASA = Object.fromEntries(
  Object.entries(AUTOR_GRASA).map(([clave, etiqueta]) => [clave, { etiqueta }]),
);

/**
 * Convierte "Fémur" en una píldora que sabe llevar a la pestaña de diámetros.
 *
 * El grupo sale de LABEL_GROUP —el mismo mapa que usa el resto de la pantalla—
 * y no de una lista propia: al poder elegir otra fórmula de grasa aparecen
 * pliegues que antes no estaban (supraespinal, muslo frontal...), y con una
 * lista corta esas píldoras no habrían llevado a ninguna parte.
 */
const pildoras = (etiquetas) => (etiquetas || []).map((label) => ({
  label,
  group: LABEL_GROUP[label] ?? null,
}));

/**
 * Reparte el peso en masa grasa, ósea, residual y muscular.
 *
 * El orden del cálculo no es casual y está en el módulo de cálculo: la masa
 * muscular es lo que SOBRA tras restar las otras tres (Matiegka). Por eso
 * cambiar de fórmula de grasa MUEVE TAMBIÉN EL MÚSCULO; no es presentación.
 *
 * @param data       Medición: weight, height, skinfolds, diameters, perimeters.
 * @param sex        Sexo escrito como esté; se normaliza en el cálculo.
 * @param ageYears   Edad, que necesita Durnin-Womersley.
 * @param autorGrasa Clave de AUTORES_GRASA elegida por el nutricionista.
 */
export const calcularModelo4 = (data, sex, ageYears, autorGrasa) => {
  const resultado = compute4Components({
    weight: data?.weight,
    height: data?.height,
    sex,
    ageYears,
    skinfolds: data?.skinfolds || {},
    diameters: data?.diameters || {},
    perimeters: data?.perimeters || {},
    formulaGrasa: autorGrasa,
  });

  const [osea, grasa, muscular, residual] = resultado.rows;

  return {
    porcentajeGrasa: resultado.fatPct,
    masaGrasa: grasa.kg,
    masaOsea: osea.kg,
    masaResidual: residual.kg,
    masaMuscular: muscular.kg,
    // La resta SIN recortar a 0. La pantalla la enseña cuando sale negativa:
    // saber que da −3.4 kg dice cuánto hay que revisar; "es inconsistente", no.
    masaMuscularCruda: resultado.masaMuscularCruda,
    muscularInconsistente: resultado.masaMuscularCruda !== null && resultado.masaMuscularCruda < 0,
    detalleGrasa: resultado.detalleGrasa,
    esFemenino: resultado.esFemenino,
    // El rótulo con su fracción ("Würch (♂ 0.241)") viene del cálculo, para que
    // el número del texto no pueda separarse del que se usó.
    autorResidual: residual.autor,
    faltantes: {
      mg: pildoras(grasa.missing),
      mo: pildoras(osea.missing),
      mr: pildoras(residual.missing),
      // La muscular no tiene medidas propias: hereda lo que falte a las otras
      // tres, y decirlo así es más claro que repetir la lista entera.
      mm: muscular.kg !== null ? [] : [{ label: 'Requiere MG, MO y MR', group: null }],
    },
  };
};
