// =============================================================================
// Logger estructurado para el frontend.
// -----------------------------------------------------------------------------
// Mismo contrato que supabase/functions/_shared/logger.ts pero adaptado al
// navegador:
//   * En producción emite JSON por línea (fácil de capturar con un shipper
//     desde la consola si se habilita).
//   * En desarrollo imprime legible para DevTools.
//   * Redacta tokens/emails antes de serializar.
//
// NO envía logs a un servicio externo todavía — la intención es dejar
// preparado el contrato para que cuando se conecte un transport (Axiom,
// Logflare, Sentry, un endpoint propio), el call-site no cambie.
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = Record<string, unknown>;

const REDACTED_KEYS = new Set([
  'authorization',
  'apikey',
  'api_key',
  'token',
  'access_token',
  'refresh_token',
  'password',
  'secret',
]);

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const isDev = (() => {
  try {
    return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
})();

const minLevel: LogLevel = isDev ? 'debug' : 'info';

const redactValue = (key: string, value: unknown): unknown => {
  if (REDACTED_KEYS.has(key.toLowerCase())) return '[REDACTED]';
  if (typeof value === 'string') {
    return value.replace(
      /([a-zA-Z0-9._+-]{1,64})@([a-zA-Z0-9.-]{1,253})/g,
      (_m, local: string, domain: string) => {
        const shown = local.length > 2 ? `${local.slice(0, 2)}***` : '***';
        return `${shown}@${domain}`;
      },
    );
  }
  return value;
};

const sanitize = (ctx: LogContext, seen = new WeakSet<object>()): LogContext => {
  const out: LogContext = {};
  for (const [k, v] of Object.entries(ctx || {})) {
    if (v && typeof v === 'object') {
      if (seen.has(v as object)) { out[k] = '[Circular]'; continue; }
      seen.add(v as object);
      if (Array.isArray(v)) {
        out[k] = v.map((e) => (e && typeof e === 'object' ? sanitize(e as LogContext, seen) : redactValue(k, e)));
      } else {
        out[k] = sanitize(v as LogContext, seen);
      }
    } else {
      out[k] = redactValue(k, v);
    }
  }
  return out;
};

// Transport hook — receives sanitized log events so external services
// (Sentry, Axiom, Logflare, own endpoint) can ship them without the
// call-sites knowing. Only invoked for warn/error to keep network noise
// down; debug/info stay in the console. Transports must never throw
// (errors inside them are swallowed to keep the logger non-blocking).
export type LogTransport = (event: {
  level: LogLevel;
  msg: string;
  ctx: LogContext;
  ts: string;
}) => void;

const transports: LogTransport[] = [];

/**
 * Registers a transport that will receive every warn/error after
 * sanitization. Returns an unregister function so tests can clean up.
 */
export const registerTransport = (transport: LogTransport): (() => void) => {
  transports.push(transport);
  return () => {
    const idx = transports.indexOf(transport);
    if (idx >= 0) transports.splice(idx, 1);
  };
};

// Exposed for tests; production code should not touch this directly.
export const _clearTransports = (): void => {
  transports.length = 0;
};

const dispatchToTransports = (
  level: LogLevel,
  msg: string,
  payload: LogContext,
  ts: string,
): void => {
  // Only warn/error fan out — debug/info would generate too much volume
  // and aren't actionable in a remote dashboard.
  if (level !== 'warn' && level !== 'error') return;
  for (const transport of transports) {
    try {
      transport({ level, msg, ctx: payload, ts });
    } catch {
      // Swallow — a broken transport should never crash the logger.
      // Use raw console.error to avoid re-entering the logger and looping.
      console.error('[logger] transport threw, ignoring');
    }
  }
};

export class Logger {
  private readonly baseContext: LogContext;
  constructor(baseContext: LogContext = {}) {
    this.baseContext = baseContext;
  }
  with(extra: LogContext): Logger {
    return new Logger({ ...this.baseContext, ...extra });
  }
  debug(msg: string, ctx?: LogContext) { this.emit('debug', msg, ctx); }
  info(msg: string, ctx?: LogContext) { this.emit('info', msg, ctx); }
  warn(msg: string, ctx?: LogContext) { this.emit('warn', msg, ctx); }
  error(msg: string, ctx?: LogContext) { this.emit('error', msg, ctx); }

  private emit(level: LogLevel, msg: string, ctx?: LogContext) {
    if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return;
    const payload = sanitize({ ...this.baseContext, ...(ctx || {}) });
    const ts = new Date().toISOString();
    if (isDev) {
      const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      fn(`[${level}]`, msg, payload);
    } else {
      const line = JSON.stringify({ ts, level, msg, ...payload });
      if (level === 'error' || level === 'warn') console.error(line);
      else console.log(line);
    }
    dispatchToTransports(level, msg, payload, ts);
  }
}

// Logger raíz de la app. Los call-sites que quieran contexto adicional deben
// hacer `logger.with({ patientId })` y NO mutar este singleton.
export const logger = new Logger({ app: 'nutrigenius-web' });

/**
 * Saca el texto de un error para registrarlo, venga como venga.
 *
 * En un `catch` de TypeScript el error es `unknown`, y en la práctica llega de
 * todas las formas: un Error, el objeto de PostgrestError, un string suelto o
 * cualquier cosa que alguien haya lanzado.
 *
 * Se registra SOLO el mensaje, nunca el objeto completo: un error de Supabase
 * puede arrastrar la petición que lo originó, y con ella cabeceras con el
 * token de sesión. El logger redacta lo que reconoce, pero lo que no se pasa
 * no hay que redactarlo.
 */
export const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(error);
};
