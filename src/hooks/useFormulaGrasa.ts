import { usePreferenciaProfesional, leerPreferenciaProfesional } from './usePreferenciaProfesional';

// Fórmula de % de grasa que prefiere el nutricionista.
//
// Se guarda como PREFERENCIA DEL PROFESIONAL, no en la consulta. En la consulta
// significaría que cada evaluación queda marcada con la fórmula que estaba
// puesta ese día: dos consultas del mismo paciente con fórmulas distintas y una
// evolución que compara peras con manzanas sin que nadie lo note.
//
// CADA TARJETA GUARDA LA SUYA, por decisión de Edhel: el % de grasa que se
// informa y el que alimenta el fraccionamiento de 4 componentes se pueden
// querer con fórmulas distintas. El precio es que las dos tarjetas pueden
// mostrar porcentajes distintos a la vez; ambas dicen debajo con qué fórmula
// están calculadas, que es lo que evita que se confundan.

export type FormulaGrasa = 'siri' | 'yuhasz' | 'faulkner' | 'rfm';

/** Qué tarjeta pregunta. Cada una recuerda su elección por separado. */
export type AmbitoFormula = 'pliegues' | 'composicion';

const VALIDAS: readonly FormulaGrasa[] = ['siri', 'yuhasz', 'faulkner', 'rfm'];
const POR_DEFECTO: FormulaGrasa = 'siri';
const CLAVE = (ambito: AmbitoFormula) => `nutri_formula_grasa_${ambito}`;

export const leerFormulaGrasa = (ambito: AmbitoFormula): FormulaGrasa =>
  leerPreferenciaProfesional(CLAVE(ambito), POR_DEFECTO, VALIDAS);

export const useFormulaGrasa = (ambito: AmbitoFormula) => {
  const { valor, setValor } = usePreferenciaProfesional(CLAVE(ambito), POR_DEFECTO, VALIDAS);
  return { formula: valor, setFormula: setValor };
};
