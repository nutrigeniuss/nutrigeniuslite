import { useEffect, useState } from 'react';

// Preferencias de trabajo del nutricionista: cómo prefiere MIRAR los datos.
//
// No son datos clínicos y por eso no viven en la consulta. Guardarlas ahí
// significaría que cada evaluación queda marcada con la vista que estaba puesta
// ese día, y dos consultas del mismo paciente podrían acabar comparadas con
// criterios distintos sin que nadie lo note. Como preferencia se aplican igual
// a todos los pacientes, así que su evolución sigue siendo comparable.
//
// Existe este archivo porque el mismo fallo apareció cuatro veces: un ajuste
// que el nutricionista elige, se pierde al cambiar de pantalla, y hay que
// volver a elegirlo. La fórmula de grasa, el modelo de composición, la pestaña
// del calculador... Cada uno se arregló por separado hasta que quedó claro que
// era un patrón y no una casualidad.

/**
 * Preferencia recordada en este navegador.
 *
 * @param clave      Nombre con el que se guarda. Único por preferencia.
 * @param porDefecto Valor de partida y refugio si lo guardado no sirve.
 * @param valores    Los valores aceptables. Lo que no esté aquí se descarta:
 *                   si en el almacenamiento hay basura —o el nombre de una
 *                   opción que ya no existe— se vuelve al valor por defecto en
 *                   vez de intentar calcular con algo desconocido.
 */
export function usePreferenciaProfesional<T extends string>(
  clave: string,
  porDefecto: T,
  valores: readonly T[],
) {
  const evento = `pref:${clave}`;

  const esValido = (valor: unknown): valor is T =>
    typeof valor === 'string' && (valores as readonly string[]).includes(valor);

  const leer = (): T => {
    try {
      const guardado = localStorage.getItem(clave);
      return esValido(guardado) ? guardado : porDefecto;
    } catch {
      return porDefecto;
    }
  };

  const [valor, setValorEstado] = useState<T>(leer);

  // Dos tarjetas de la misma pantalla pueden usar la misma preferencia; sin
  // este aviso, cambiarla en una dejaría la otra con el valor anterior hasta
  // recargar.
  useEffect(() => {
    const alCambiar = (e: Event) => {
      const siguiente = (e as CustomEvent<string>).detail;
      if (esValido(siguiente)) setValorEstado(siguiente);
    };
    window.addEventListener(evento, alCambiar);
    return () => window.removeEventListener(evento, alCambiar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evento]);

  const setValor = (siguiente: T) => {
    if (!esValido(siguiente)) return;
    try {
      localStorage.setItem(clave, siguiente);
    } catch {
      /* almacenamiento no disponible: se pierde al recargar, pero funciona */
    }
    window.dispatchEvent(new CustomEvent<string>(evento, { detail: siguiente }));
    setValorEstado(siguiente);
  };

  return { valor, setValor };
}

/** Lectura puntual, sin montar un componente (la usa el generador de PDF). */
export function leerPreferenciaProfesional<T extends string>(
  clave: string,
  porDefecto: T,
  valores: readonly T[],
): T {
  try {
    const guardado = localStorage.getItem(clave);
    return typeof guardado === 'string' && (valores as readonly string[]).includes(guardado)
      ? (guardado as T)
      : porDefecto;
  } catch {
    return porDefecto;
  }
}
