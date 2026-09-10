// Sección "Somatotipo" del reporte con somatocarta Heath-Carter en SVG embebido.
import type { computeSomatotype } from '../composition';
import { esc, fmtNum } from './format';

// Replica las proporciones de la UI (X ∈ [-8,8], Y ∈ [-8,16]) y dibuja la
// triada como un punto rojo dentro de la cúpula Heath-Carter.
export function buildSomatotypeSection(soma: ReturnType<typeof computeSomatotype>): string {
  const { endo, meso, ecto, x, y, triad, classification } = soma;
  if (endo == null || meso == null || ecto == null || x == null || y == null) return '';

  // Geometría — viewBox idéntico al usado por React para conservar proporciones.
  const VB_W = 460, VB_H = 460;
  const PAD_TOP = 36, PAD_BOTTOM = 56, PAD_X = 70;
  const CX = VB_W / 2;
  const SCALE_X = (VB_W - 2 * PAD_X) / 16;
  const SCALE_Y = (VB_H - PAD_TOP - PAD_BOTTOM) / 24;
  const ORIGIN_Y = PAD_TOP + 16 * SCALE_Y;
  const toPx = (xv: number, yv: number): [number, number] => [CX + xv * SCALE_X, ORIGIN_Y - yv * SCALE_Y];

  const [mx, my] = toPx(0, 16);
  const [enx, eny] = toPx(-8, -8);
  const [ecx, ecy] = toPx(8, -8);
  const [cLx, cLy] = toPx(-7.5, 6);
  const [cRx, cRy] = toPx(7.5, 6);
  const domainPath = `M ${enx} ${eny} L ${ecx} ${ecy} Q ${cRx} ${cRy} ${mx} ${my} Q ${cLx} ${cLy} ${enx} ${eny} Z`;

  // Clamp del punto al dominio para evitar dibujarlo fuera del SVG.
  const clamp = (val: number, mn: number, mx2: number) => Math.min(Math.max(val, mn), mx2);
  const xPlot = clamp(x, -9, 9);
  const yPlot = clamp(y, -9, 17);
  const [dotX, dotY] = toPx(xPlot, yPlot);

  // Niveles cualitativos (mismo criterio que la UI).
  const level = (val: number): { label: string; color: string } => {
    if (val < 3) return { label: 'Bajo', color: '#94a3b8' };
    if (val < 5.5) return { label: 'Moderado', color: '#06a510' };
    if (val < 7) return { label: 'Alto', color: '#f59e0b' };
    return { label: 'Muy alto', color: '#ff5c57' };
  };

  // Líneas de la grilla (cada 2 unidades en X, cada 4 en Y).
  const gridLines: string[] = [];
  for (let gx = -8; gx <= 8; gx += 2) {
    const [px, py1] = toPx(gx, -8);
    const [, py2] = toPx(gx, 16);
    gridLines.push(`<line x1="${px}" y1="${py1}" x2="${px}" y2="${py2}" stroke="#e2e8f0" stroke-width="0.5" stroke-dasharray="2 3" />`);
  }
  for (let gy = -8; gy <= 16; gy += 4) {
    const [px1, py] = toPx(-8, gy);
    const [px2] = toPx(8, gy);
    gridLines.push(`<line x1="${px1}" y1="${py}" x2="${px2}" y2="${py}" stroke="#e2e8f0" stroke-width="0.5" stroke-dasharray="2 3" />`);
  }

  // Marcas numéricas X (-8..+8 cada 2).
  const xMarks: string[] = [];
  for (let gx = -8; gx <= 8; gx += 2) {
    const [px, py] = toPx(gx, 0);
    xMarks.push(`<text x="${px}" y="${py + 14}" text-anchor="middle" font-size="9" fill="#94a3b8">${gx}</text>`);
  }
  // Marcas Y (-8..+16 cada 4).
  const yMarks: string[] = [];
  for (let gy = -8; gy <= 16; gy += 4) {
    if (gy === 0) continue;
    const [px, py] = toPx(0, gy);
    yMarks.push(`<text x="${px + 4}" y="${py + 3}" text-anchor="start" font-size="9" fill="#94a3b8">${gy}</text>`);
  }

  // Componente individual (chip + valor + etiqueta cualitativa).
  const compRow = (name: string, val: number, color: string, help: string) => {
    const lvl = level(val);
    return `
      <div class="soma-comp">
        <div class="soma-row">
          <span class="bullet" style="background:${color}"></span>
          <span class="soma-name">${esc(name)}</span>
          <span class="chip" style="background:${lvl.color}20;color:${lvl.color}">${esc(lvl.label)}</span>
          <span class="soma-val" style="color:${color}">${fmtNum(val, 2)}</span>
        </div>
        <div class="soma-help">${esc(help)}</div>
      </div>`;
  };

  return `
    <section class="section soma-section">
      <h2><span class="dot dot-primary"></span>Somatotipo clínico</h2>

      ${classification ? `
        <div class="soma-class">
          <div class="lbl-mini" style="color:#fff;opacity:.75">Somatotipo</div>
          ${triad ? `<div class="soma-triad">${esc(triad)}</div>` : ''}
          <div class="soma-class-name">${esc(classification)}</div>
        </div>` : ''}

      <div class="soma-grid soma-grid--chart-only">
        <div class="soma-chart">
          <svg viewBox="0 0 ${VB_W} ${VB_H}" xmlns="http://www.w3.org/2000/svg">
            <!-- Cúpula Heath-Carter -->
            <path d="${domainPath}" fill="#eef1fe" stroke="#a5b4fc" stroke-width="1.2" />
            <!-- Grilla -->
            ${gridLines.join('')}
            <!-- Ejes -->
            <line x1="${toPx(-8, 0)[0]}" y1="${toPx(0, 0)[1]}" x2="${toPx(8, 0)[0]}" y2="${toPx(0, 0)[1]}" stroke="#94a3b8" stroke-width="0.6" />
            <line x1="${toPx(0, -8)[0]}" y1="${toPx(0, -8)[1]}" x2="${toPx(0, 16)[0]}" y2="${toPx(0, 16)[1]}" stroke="#94a3b8" stroke-width="0.6" stroke-dasharray="3 3" />
            <!-- Diagonales (líneas a vértices) -->
            <line x1="${toPx(0, 0)[0]}" y1="${toPx(0, 0)[1]}" x2="${enx}" y2="${eny}" stroke="#cbd5e1" stroke-width="0.5" stroke-dasharray="2 4" />
            <line x1="${toPx(0, 0)[0]}" y1="${toPx(0, 0)[1]}" x2="${ecx}" y2="${ecy}" stroke="#cbd5e1" stroke-width="0.5" stroke-dasharray="2 4" />
            <!-- Etiquetas vértices -->
            <text x="${mx}" y="${my - 12}" text-anchor="middle" font-size="13" font-weight="700" fill="#0f172a">MESOMORFO</text>
            <text x="${mx}" y="${my + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#3b5feb">${fmtNum(meso, 2)}</text>
            <text x="${enx}" y="${eny + 18}" text-anchor="middle" font-size="13" font-weight="700" fill="#0f172a">ENDOMORFO</text>
            <text x="${enx}" y="${eny + 32}" text-anchor="middle" font-size="11" font-weight="700" fill="#06a510">${fmtNum(endo, 2)}</text>
            <text x="${ecx}" y="${ecy + 18}" text-anchor="middle" font-size="13" font-weight="700" fill="#0f172a">ECTOMORFO</text>
            <text x="${ecx}" y="${ecy + 32}" text-anchor="middle" font-size="11" font-weight="700" fill="#ff5c57">${fmtNum(ecto, 2)}</text>
            ${xMarks.join('')}
            ${yMarks.join('')}
            <!-- Punto del paciente -->
            <circle cx="${dotX}" cy="${dotY}" r="9" fill="none" stroke="#ff5c57" stroke-width="2" opacity="0.55" />
            <circle cx="${dotX}" cy="${dotY}" r="4" fill="#ff5c57" />
            <text x="${dotX}" y="${dotY - 14}" text-anchor="middle" font-size="10" font-weight="700" fill="#0f172a">(${fmtNum(x, 2)}, ${fmtNum(y, 2)})</text>
          </svg>
        </div>
      </div>
    </section>`;
}
