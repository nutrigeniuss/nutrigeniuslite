// CSS embebido del reporte antropométrico — diseño limpio, optimizado para
// impresión A4. Vive aparte para no inflar el generador de HTML.
export const REPORT_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    background: #f8fafc;
    font-size: 12px;
    line-height: 1.45;
  }
  .page {
    background: #fff;
    max-width: 780px;
    margin: 24px auto;
    padding: 36px 40px;
    box-shadow: 0 4px 18px rgba(15,23,42,0.08);
    border-radius: 12px;
  }

  /* Encabezado */
  .report-header {
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 2px solid #3b5feb; padding-bottom: 14px; margin-bottom: 18px;
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand-mark {
    width: 42px; height: 42px; border-radius: 10px;
    background: linear-gradient(135deg,#3b5feb 0%,#7c6cff 100%);
    color: #fff; font-weight: 800; font-size: 22px;
    display: flex; align-items: center; justify-content: center;
  }
  .brand-name { font-size: 15px; font-weight: 800; letter-spacing: 0.3px; }
  .brand-sub  { font-size: 10.5px; color: #64748b; margin-top: 2px; }
  .meta { font-size: 10.5px; color: #475569; text-align: right; }
  .meta span { color: #94a3b8; margin-right: 4px; }

  /* Tarjeta de paciente */
  .patient-card {
    background: #f1f5fc; border-radius: 12px; padding: 14px 18px;
    display: flex; gap: 18px; justify-content: space-between; align-items: center;
    margin-bottom: 22px;
  }
  .patient-name { font-size: 16px; font-weight: 800; color: #0f172a; }
  .patient-grid {
    display: grid; grid-template-columns: repeat(4, auto); gap: 18px; text-align: right;
  }
  .lbl-mini {
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.7px; color: #94a3b8;
  }

  /* Secciones */
  .section { margin-top: 18px; page-break-inside: avoid; }
  .section h2 {
    font-size: 12.5px; text-transform: uppercase; letter-spacing: 1.1px;
    color: #334155; margin: 0 0 10px; display: flex; align-items: center; gap: 7px;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .dot-primary { background: #3b5feb; }
  .dot-red     { background: #ff5c57; }
  .dot-amber   { background: #f59e0b; }
  .dot-sky     { background: #0ea5e9; }

  .hero {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;
    background: #fafbff; border: 1px solid #e2e8f0; border-radius: 10px;
    padding: 14px; margin-bottom: 12px;
  }
  .hero-lbl { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.7px; }
  .hero-val { font-size: 26px; font-weight: 800; color: #3b5feb; line-height: 1.1; margin: 4px 0 6px; }
  .hero-val-sm { font-size: 18px; font-weight: 800; color: #0f172a; line-height: 1.1; margin: 4px 0 4px; }
  .unit { font-size: 11px; font-weight: 600; color: #64748b; }
  .hero-detail { font-size: 10px; color: #94a3b8; margin-top: 4px; }

  /* Tabla de datos */
  .data-table { width: 100%; border-collapse: collapse; }
  .data-table th, .data-table td {
    text-align: left; padding: 7px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle;
  }
  .data-table thead th {
    font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.6px;
    color: #94a3b8; border-bottom: 1px solid #e2e8f0; font-weight: 700;
  }
  .data-table .lbl { color: #475569; }
  .data-table .val { font-weight: 700; color: #0f172a; width: 28%; }
  .data-table .extra { width: 38%; }

  /* Chips de severidad */
  .chip {
    display: inline-block; padding: 2px 9px; border-radius: 999px;
    font-size: 10px; font-weight: 700;
  }

  /* Bullet en filas de composición */
  .bullet {
    display: inline-block; width: 9px; height: 9px; border-radius: 50%;
    margin-right: 7px; vertical-align: middle;
  }

  /* Resumen Kerr (peso real / predictivo / factor) */
  .kerr-meta {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px;
  }
  .kerr-meta > div {
    background: #fafbff; border: 1px solid #e2e8f0; border-radius: 10px;
    padding: 8px 10px; text-align: center;
  }
  .kerr-meta b { display: block; font-size: 14px; color: #0f172a; margin-top: 2px; }
  /* Variante con un solo dato (Peso real) — se muestra centrada y compacta */
  .kerr-meta--solo { grid-template-columns: minmax(160px, 240px); justify-content: center; }

  /* Somatotipo */
  .soma-section { page-break-before: avoid; }
  .soma-grid {
    display: grid; grid-template-columns: 230px 1fr; gap: 16px; align-items: stretch;
  }
  /* Variante: solo se muestra la somatocarta (sin tarjetas a la izquierda) */
  .soma-grid--chart-only { grid-template-columns: 1fr; margin-top: 10px; }
  .soma-grid--chart-only .soma-chart { max-width: 520px; margin: 0 auto; }
  .soma-comp {
    border: 1px solid #f1f5f9; background: #fafbff; border-radius: 10px;
    padding: 8px 10px; margin-bottom: 8px;
  }
  .soma-row { display: flex; align-items: center; gap: 6px; }
  .soma-name { flex: 1; font-weight: 700; color: #0f172a; font-size: 12px; }
  .soma-val  { font-size: 16px; font-weight: 800; tabular-nums: 1; }
  .soma-help { font-size: 9.5px; color: #94a3b8; margin-top: 2px; margin-left: 16px; }
  .soma-axes {
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 6px 0;
  }
  .soma-axes > div {
    background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
    padding: 6px; text-align: center;
  }
  .ax-val { font-size: 14px; font-weight: 800; color: #334155; tabular-nums: 1; }
  .soma-class {
    background: linear-gradient(135deg,#3b5feb 0%,#7c6cff 100%);
    border-radius: 12px; padding: 10px 12px; text-align: center; color: #fff;
  }
  .soma-triad { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11px; opacity: 0.9; margin-top: 2px; }
  .soma-class-name { font-size: 14px; font-weight: 800; margin-top: 4px; }
  .soma-chart { background: #fafbff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 6px; }
  .soma-chart svg { width: 100%; height: auto; display: block; }

  /* Bloque de kcal */
  .kcal-hero {
    text-align: center; padding: 16px;
    background: linear-gradient(135deg,#eef1fe 0%, #f0f9ff 100%);
    border-radius: 10px; margin-bottom: 12px;
  }
  .kcal-num  { font-size: 42px; font-weight: 800; color: #3b5feb; line-height: 1; }
  .kcal-unit { font-size: 12px; font-weight: 600; color: #64748b; margin-top: 2px; }
  .kcal-meta { display: flex; justify-content: center; gap: 18px; margin-top: 10px; font-size: 10.5px; color: #475569; flex-wrap: wrap; }
  .data-table.macros td { font-size: 12px; }
  .data-table.macros td:nth-child(2) { font-weight: 700; color: #3b5feb; }

  /* Pie */
  .report-footer {
    margin-top: 36px; padding-top: 14px; border-top: 1px solid #e2e8f0;
    display: flex; justify-content: space-between; align-items: flex-end; gap: 24px;
  }
  .signature { width: 240px; }
  .signature .line { border-top: 1px solid #94a3b8; margin-bottom: 6px; }
  .sig-lbl { font-size: 10px; color: #64748b; text-align: center; }
  .legal { font-size: 9.5px; color: #94a3b8; text-align: right; max-width: 320px; }

  /* Impresión */
  @page { size: A4; margin: 14mm; }
  @media print {
    body { background: #fff; }
    .page { box-shadow: none; margin: 0; max-width: none; padding: 0; border-radius: 0; }
  }
`;
