/** Analytics stub — Lite Calc no envía telemetría. */
export function track(_event?: string, _props?: Record<string, unknown>) {
  // no-op
}

export function identify(_id?: string, _traits?: Record<string, unknown>) {
  // no-op
}

export default { track, identify };
