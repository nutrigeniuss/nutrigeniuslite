import { getCurrentLocale } from '@/lib/formatLocale';
// Helpers de formato y filas reutilizables para el reporte antropométrico imprimible.

// Tipos laxos: las llamadas vienen de JSX sin tipado estricto.
export type AnyRecord = Record<string, any>;

// Predicate "tiene valor" (no null, undefined ni cadena vacía).
export const v = (val: unknown): boolean => val !== null && val !== undefined && val !== '';

export const fmtNum = (v: number | null | undefined, digits = 2): string =>
  v == null || !Number.isFinite(v) ? '—' : v.toFixed(Math.min(digits, 2));

export const fmtDate = (iso?: string | null): string => {
  if (!iso) return '—';
  try {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString(getCurrentLocale(), { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
};

// Escape mínimo para evitar inyección al construir HTML.
export const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Severidad → color hex (alineado con los chips de la app).
const SEVERITY_COLOR: Record<string, { bg: string; fg: string }> = {
  good: { bg: '#dcfce7', fg: '#15803d' },
  warn: { bg: '#fef9c3', fg: '#a16207' },
  bad:  { bg: '#fee2e2', fg: '#b91c1c' },
  info: { bg: '#f1f5f9', fg: '#475569' },
};

export const chip = (label?: string, severity?: string): string => {
  if (!label) return '';
  const c = SEVERITY_COLOR[severity || 'info'] || SEVERITY_COLOR.info;
  return `<span class="chip" style="background:${c.bg};color:${c.fg}">${esc(label)}</span>`;
};

// `row` es "defensivo": si el valor principal no existe o no se pudo calcular,
// devuelve cadena vacía y la fila se omite completamente. Esto cumple el
// requerimiento del usuario: solo se incluyen indicadores con valor calculado;
// los faltantes no aparecen en el PDF.
export const row = (
  label: string,
  value: number | string | null | undefined,
  unit = '',
  extra = '',
): string => {
  if (value == null || value === '' || (typeof value === 'number' && !Number.isFinite(value))) {
    return '';
  }
  const valStr = typeof value === 'number'
    ? `${fmtNum(value, value < 10 ? 2 : 1)}${unit ? ` ${unit}` : ''}`
    : String(value);
  return `
  <tr>
    <td class="lbl">${esc(label)}</td>
    <td class="val">${esc(valStr)}</td>
    <td class="extra">${extra}</td>
  </tr>`;
};

// Variante para celdas donde el "valor" es HTML pre-construido (rangos, chips).
export const rowHtml = (label: string, valueHtml: string, extra = ''): string => {
  if (!valueHtml) return '';
  return `
  <tr>
    <td class="lbl">${esc(label)}</td>
    <td class="val">${valueHtml}</td>
    <td class="extra">${extra}</td>
  </tr>`;
};

// Envuelve una sección: si no hay filas, no se renderiza el bloque.
export const section = (
  title: string,
  dotClass: string,
  rowsHtml: string,
  opts: { headerCols?: string; before?: string } = {},
): string => {
  if (!rowsHtml.trim()) return '';
  const thead = opts.headerCols ? `<thead><tr>${opts.headerCols}</tr></thead>` : '';
  return `
    <section class="section">
      <h2><span class="dot ${dotClass}"></span>${esc(title)}</h2>
      ${opts.before || ''}
      <table class="data-table">${thead}<tbody>${rowsHtml}</tbody></table>
    </section>`;
};
