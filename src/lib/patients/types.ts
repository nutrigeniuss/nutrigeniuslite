/**
 * Firma compartida del guardado de la ficha del paciente.
 *
 * El `boolean` no es decorativo: es lo que permite a cada subsección saber si
 * sus cambios llegaron de verdad a la base antes de marcarse como guardada.
 * Cuando esto devolvía `Promise<void>`, un fallo era indistinguible de un
 * éxito y el trabajo del nutricionista se perdía en silencio.
 *
 *   true  -> persistido; ya se puede actualizar el snapshot de "guardado"
 *   false -> NO se guardó; hay que conservar los cambios como pendientes
 *
 * El aviso al usuario y el reintento los centraliza PatientDetail; quien llama
 * solo tiene que respetar el resultado y no dar el guardado por hecho.
 */
export type PatientUpdateFn<TUpdates = Record<string, unknown>> = (updates: TUpdates) => Promise<boolean>;
