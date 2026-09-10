import React from "react";
import { AlertTriangle } from "lucide-react";
import { SectionCard, v } from "./resultsShared";
import { componentLevel } from "./somatotype";
import { computeSomatotype } from "@/lib/anthropometry/composition";

// ── Somatocarta ───────────────────────────────────────────────────────────────
// Implementación basada en el método Heath-Carter (Cabañas-Armesilla, 2009;
// Carter, 1996; ISAK, 2001), tal como lo describe el artículo de referencia
// «El somatotipo-morfología en los deportistas» (Martínez-Sanz et al., 2011).
// El CÁLCULO vive en lib/anthropometry/composition (el mismo que el informe
// impreso); aquí solo se dibuja. El nivel cualitativo por componente —"Bajo",
// "Moderado", "Alto"— sí es presentación y vive en ./somatotype.
// Extraído de ResultsTab.jsx.
export default function SomatocartaSection({ data, sex: _sex }) {
  const sk = data.skinfolds || {};
  const dia = data.diameters || {};
  const p = data.perimeters || {};
  const w = data.weight, h = data.height;

  // ── El cálculo NO vive aquí ────────────────────────────────────────────────
  // Está en lib/anthropometry/composition, que es exactamente el mismo que usa
  // el informe impreso y la evolución. Antes había DOS implementaciones de las
  // tres fórmulas de Heath-Carter, una para la pantalla y otra para el papel.
  // Daban lo mismo —se comprobó— pero nada las mantenía sincronizadas: quien
  // corrigiera un coeficiente en una, la otra se quedaba con el viejo, y el
  // paciente se llevaría impreso un somatotipo distinto del que se le enseñó.
  //
  // Heath-Carter no usa el sexo: las tres fórmulas salen de pliegues, diámetros,
  // perímetros, peso y talla. Por eso `sex` no se le pasa al cálculo.
  const { endo, meso, ecto, x, y, triad, classification: interpretation } = computeSomatotype({
    weight: w, height: h, skinfolds: sk, diameters: dia, perimeters: p,
  });

  // "Se pudo calcular el componente" es exactamente "salió un número". Tenerlo
  // como variable aparte era otra copia de la misma condición.
  const hasEndo = endo !== null;
  const hasMeso = meso !== null;
  const hasEcto = ecto !== null;
  const canDraw = x !== null && y !== null;

  // ── Geometría de la somatocarta ────────────────────────────────────────────
  // Proporciones tomadas de la figura 3 del artículo (Cabañas-Armesilla, 2009;
  // Martínez-Sanz et al., 2011): X ∈ [-8, +8], Y ∈ [-8, +16].
  //   Vértices teóricos:
  //     A (Mesomorfo)   = (0, 16)
  //     B (Endomorfo)   = (-8, -8)
  //     C (Ectomorfo)   = (+8, -8)
  // Convertimos a píxeles con un viewBox holgado para que las etiquetas
  // (MESOMORFO arriba, ENDOMORFO/ECTOMORFO abajo) y la grilla X (-8..+8) e
  // Y (-8..+16) entren completas sin recortes en móvil ni desktop.
  const VB_W = 460;
  const VB_H = 460;
  const PAD_TOP = 36;     // espacio para la etiqueta "MESOMORFO"
  const PAD_BOTTOM = 56;  // espacio para "ENDOMORFO" / "ECTOMORFO" + ejes
  const PAD_X = 70;       // espacio lateral para etiquetas "ENDOMORFO"/"ECTOMORFO"
  const CX = VB_W / 2;
  const SCALE_X = (VB_W - 2 * PAD_X) / 16;             // 16 unidades en X
  const SCALE_Y = (VB_H - PAD_TOP - PAD_BOTTOM) / 24;  // 24 unidades en Y (-8..+16)
  const ORIGIN_Y = PAD_TOP + 16 * SCALE_Y;             // y=0 en píxel
  const toPx = (xv, yv) => [CX + xv * SCALE_X, ORIGIN_Y - yv * SCALE_Y];

  // Vértices del dominio teórico
  const [mx, my] = toPx(0, 16);     // Mesomorfo
  const [enx, eny] = toPx(-8, -8);  // Endomorfo
  const [ecx, ecy] = toPx(8, -8);   // Ectomorfo

  // Curvas suaves hacia afuera para emular la cúpula del Excel/artículo.
  const [cLx, cLy] = toPx(-7.5, 6);
  const [cRx, cRy] = toPx(7.5, 6);
  const domainPath = `M ${enx} ${eny} L ${ecx} ${ecy} Q ${cRx} ${cRy} ${mx} ${my} Q ${cLx} ${cLy} ${enx} ${eny} Z`;

  // Detección de fuera de rango (auto-clamp + aviso de unidades).
  const X_BOUND = 9;
  const Y_TOP = 17;
  const Y_BOT = -9;
  const outOfRange = canDraw && (Math.abs(x) > X_BOUND || y > Y_TOP || y < Y_BOT);
  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
  const xPlot = canDraw ? clamp(x, -X_BOUND, X_BOUND) : 0;
  const yPlot = canDraw ? clamp(y, Y_BOT, Y_TOP) : 0;
  const [dotX, dotY] = canDraw ? toPx(xPlot, yPlot) : [null, null];

  const components = [
    { name: 'Endomorfia', val: endo, missing: !hasEndo, color: '#06a510', help: 'Adiposidad relativa (pliegues TR+SE+SI)' },
    { name: 'Mesomorfia', val: meso, missing: !hasMeso, color: '#3b5feb', help: 'Robustez músculo-esquelética' },
    { name: 'Ectomorfia', val: ecto, missing: !hasEcto, color: '#ff5c57', help: 'Linealidad relativa (índice ponderal)' },
  ];

  return (
    <SectionCard title="Somatotipo Clínico" color="teal">
      <div className="grid gap-5 lg:grid-cols-[minmax(220px,260px)_1fr]">
        {/* Panel izquierdo: componentes + ejes + interpretación */}
        <div className="space-y-3">
          {components.map(({ name, val, missing: m, color, help }) => {
            const lvl = m ? null : componentLevel(val);
            return (
              <div key={name} className="rounded-[12px] border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-sm font-semibold text-slate-700">{name}</span>
                  </div>
                  {m ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  ) : (
                    <div className="flex items-center gap-2">
                      {lvl ? (
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: `${lvl.color}20`, color: lvl.color }}
                        >
                          {lvl.label}
                        </span>
                      ) : null}
                      <span className="text-base font-bold tabular-nums" style={{ color }}>{val}</span>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 ml-4">{help}</p>
              </div>
            );
          })}

          {/* Coordenadas X / Y de la carta */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="rounded-[10px] border border-slate-100 bg-white px-3 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Eje X</p>
              <p className="text-sm font-bold text-slate-700 tabular-nums">{x !== null ? x : '—'}</p>
            </div>
            <div className="rounded-[10px] border border-slate-100 bg-white px-3 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Eje Y</p>
              <p className="text-sm font-bold text-slate-700 tabular-nums">{y !== null ? y : '—'}</p>
            </div>
          </div>

          {/* Interpretación clínica destacada (13 zonas A–L de Heath-Carter) */}
          {interpretation ? (
            <div className="rounded-[12px] bg-gradient-to-r from-brand-500 to-[#6c63ff] px-3 py-3 text-center shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Somatotipo</p>
              {triad ? <p className="text-[11px] font-mono font-bold text-white/85 mt-0.5">{triad}</p> : null}
              <p className="text-sm font-extrabold text-white mt-1">{interpretation}</p>
            </div>
          ) : null}

          {(() => {
            // Construye una lista clara de mediciones faltantes, agrupadas por
            // componente (Endo/Meso/Ecto), para que el nutricionista sepa
            // exactamente qué le falta capturar y pueda completar la somatocarta.
            const missingDetail = [];
            if (!hasEndo) {
              const fields = [
                !v(sk.triceps) && 'pliegue tríceps',
                !v(sk.subscapular) && 'pliegue subescapular',
                !v(sk.supraspinal) && 'pliegue supraespinal',
              ].filter(Boolean);
              if (fields.length) missingDetail.push({ comp: 'Endomorfia', fields });
            }
            if (!hasMeso) {
              const fields = [
                !v(h) && 'talla',
                !v(dia.humerus) && 'diámetro de húmero',
                !v(dia.femur) && 'diámetro de fémur',
                !v(p.arm_contracted) && 'perímetro de brazo contraído',
                !v(p.calf) && 'perímetro de pantorrilla',
                // Los perímetros van corregidos por el pliegue de la zona.
                !v(sk.triceps) && 'pliegue tríceps',
                !v(sk.medial_calf) && 'pliegue de pantorrilla',
              ].filter(Boolean);
              if (fields.length) missingDetail.push({ comp: 'Mesomorfia', fields });
            }
            if (!hasEcto) {
              const fields = [
                !v(w) && 'peso',
                !v(h) && 'talla',
              ].filter(Boolean);
              if (fields.length) missingDetail.push({ comp: 'Ectomorfia', fields });
            }
            if (missingDetail.length === 0) return null;
            return (
              <div className="mt-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-amber-700 leading-tight">
                      Para completar la somatocarta, registra:
                    </p>
                    <ul className="mt-1.5 space-y-0.5">
                      {missingDetail.map(({ comp, fields }) => (
                        <li key={comp} className="text-[11px] text-amber-700 leading-snug">
                          <span className="font-semibold">{comp}:</span>{' '}
                          {fields.join(', ')}.
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Panel derecho: somatocarta triangular */}
        <div className="rounded-[14px] border border-slate-100 bg-gradient-to-b from-slate-50 to-white p-3">
          {canDraw ? (
            <>
              {outOfRange ? (
                <div className="mb-2 flex items-start gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 leading-snug">
                    Coordenadas fuera del dominio teórico (X={x}, Y={y}). El punto se ancló al borde. Verifica las unidades de diámetros (cm) y perímetros (cm).
                  </p>
                </div>
              ) : null}
              {/* Wrapper con tamaño contenido: el SVG mantiene su relación 1:1
                  pero limitamos su altura/anchura para que no domine la vista. */}
              <div className="mx-auto w-full max-w-[480px]">
              <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="block w-full h-auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Somatocarta">
                <defs>
                  <linearGradient id="somatoFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#eef1fe" />
                    <stop offset="100%" stopColor="#f8fafc" />
                  </linearGradient>
                  <radialGradient id="somatoDot" cx="0.5" cy="0.5" r="0.5">
                    <stop offset="0%" stopColor="#ff5c57" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#ff5c57" stopOpacity="0" />
                  </radialGradient>
                  {/* Recortamos la grilla y las medianas al dominio para que
                      no se desborden visualmente. */}
                  <clipPath id="somatoClip">
                    <path d={domainPath} />
                  </clipPath>
                </defs>

                {/* Dominio teórico (cúpula triangular) */}
                <path d={domainPath} fill="url(#somatoFill)" stroke="#a5b4fc" strokeWidth="1.5" />

                {/* Grilla interna (recortada al dominio) */}
                <g clipPath="url(#somatoClip)">
                  {/* Verticales cada 2 unidades */}
                  {[-6, -4, -2, 2, 4, 6].map((n) => {
                    const [gx1, gy1] = toPx(n, -8);
                    const [, gy2] = toPx(n, 16);
                    return (
                      <line key={`gv-${n}`} x1={gx1} y1={gy1} x2={gx1} y2={gy2}
                        stroke="#e2e8f0" strokeWidth="0.6" />
                    );
                  })}
                  {/* Horizontales cada 2 unidades */}
                  {[-6, -4, -2, 2, 4, 6, 8, 10, 12, 14].map((n) => {
                    const [gx1, gy1] = toPx(-8, n);
                    const [gx2] = toPx(8, n);
                    return (
                      <line key={`gh-${n}`} x1={gx1} y1={gy1} x2={gx2} y2={gy1}
                        stroke="#e2e8f0" strokeWidth="0.6" />
                    );
                  })}
                  {/* Medianas A–L (centro hacia los tres vértices y sus puntos
                      medios) — referencia clásica del Heath-Carter. */}
                  {(() => {
                    const [c0x, c0y] = toPx(0, 0);
                    const [mDEx, mDEy] = toPx(-4, 4);   // entre Endo y Meso
                    const [mEFx, mEFy] = toPx(4, 4);    // entre Ecto y Meso
                    const [mEEx, mEEy] = toPx(0, -8);   // entre Endo y Ecto (base)
                    return (
                      <g stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="2 3" opacity="0.9">
                        <line x1={c0x} y1={c0y} x2={mx} y2={my} />
                        <line x1={c0x} y1={c0y} x2={enx} y2={eny} />
                        <line x1={c0x} y1={c0y} x2={ecx} y2={ecy} />
                        <line x1={c0x} y1={c0y} x2={mDEx} y2={mDEy} />
                        <line x1={c0x} y1={c0y} x2={mEFx} y2={mEFy} />
                        <line x1={c0x} y1={c0y} x2={mEEx} y2={mEEy} />
                      </g>
                    );
                  })()}
                </g>

                {/* Eje X (línea Y=0 prolongada) y eje Y (línea X=0 prolongada) */}
                {(() => {
                  const [axL, ay0] = toPx(-9, 0);
                  const [axR] = toPx(9, 0);
                  const [, ayT] = toPx(0, 17);
                  const [, ayB] = toPx(0, -9);
                  return (
                    <g>
                      <line x1={axL} y1={ay0} x2={axR} y2={ay0} stroke="#94a3b8" strokeWidth="1" />
                      <line x1={CX} y1={ayT} x2={CX} y2={ayB} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
                    </g>
                  );
                })()}

                {/* Marcas de escala — eje X */}
                {[-8, -6, -4, -2, 0, 2, 4, 6, 8].map((n) => {
                  const [tx, ty] = toPx(n, 0);
                  return (
                    <g key={`tx-${n}`}>
                      <line x1={tx} y1={ty - 3} x2={tx} y2={ty + 3} stroke="#64748b" strokeWidth="1" />
                      <text x={tx} y={ty + 14} fontSize="9" fill="#64748b" textAnchor="middle" fontWeight="500">{n}</text>
                    </g>
                  );
                })}
                {/* Marcas de escala — eje Y */}
                {[-8, -4, 4, 8, 12, 16].map((n) => {
                  const [ty, tyP] = toPx(0, n);
                  return (
                    <g key={`ty-${n}`}>
                      <line x1={ty - 3} y1={tyP} x2={ty + 3} y2={tyP} stroke="#64748b" strokeWidth="1" />
                      <text x={ty - 7} y={tyP + 3} fontSize="9" fill="#64748b" textAnchor="end" fontWeight="500">{n}</text>
                    </g>
                  );
                })}

                {/* Etiquetas de los vértices con valores del componente */}
                <g>
                  <text x={mx} y={my - 18} fontSize="13" fontWeight="700" fill="#1e293b" textAnchor="middle" letterSpacing="1">MESOMORFO</text>
                  {meso !== null ? <text x={mx} y={my - 6} fontSize="11" fontWeight="700" fill="#3b5feb" textAnchor="middle">{meso}</text> : null}

                  <text x={enx} y={eny + 22} fontSize="13" fontWeight="700" fill="#1e293b" textAnchor="middle" letterSpacing="1">ENDOMORFO</text>
                  {endo !== null ? <text x={enx} y={eny + 36} fontSize="11" fontWeight="700" fill="#06a510" textAnchor="middle">{endo}</text> : null}

                  <text x={ecx} y={ecy + 22} fontSize="13" fontWeight="700" fill="#1e293b" textAnchor="middle" letterSpacing="1">ECTOMORFO</text>
                  {ecto !== null ? <text x={ecx} y={ecy + 36} fontSize="11" fontWeight="700" fill="#ff5c57" textAnchor="middle">{ecto}</text> : null}
                </g>

                {/* Punto del paciente con crosshair de precisión y badge de coordenadas */}
                {(() => {
                  // Línea horizontal al eje Y (referencia X)
                  const xAxisY = toPx(0, 0)[1];
                  const yAxisX = CX;
                  // Posición del badge (encima/abajo según haya espacio)
                  const above = dotY - my > 60;
                  const badgeY = above ? dotY - 26 : dotY + 32;
                  const coordText = `(${x}, ${y})`;
                  // Estimación del ancho del badge (8px aprox por carácter a 10px)
                  const badgeW = Math.max(60, coordText.length * 6.2 + 16);
                  return (
                    <g>
                      {/* Crosshair tenue: líneas hasta los ejes */}
                      <line x1={dotX} y1={dotY} x2={dotX} y2={xAxisY}
                        stroke="#ff5c57" strokeWidth="1" strokeDasharray="3 3" opacity="0.55" />
                      <line x1={dotX} y1={dotY} x2={yAxisX} y2={dotY}
                        stroke="#ff5c57" strokeWidth="1" strokeDasharray="3 3" opacity="0.55" />

                      {/* Halo radial */}
                      <circle cx={dotX} cy={dotY} r={20} fill="url(#somatoDot)" />
                      {/* Anillo exterior */}
                      <circle cx={dotX} cy={dotY} r={9} fill="white" stroke="#ff5c57" strokeWidth="2.5" />
                      {/* Punto central pequeño y preciso */}
                      <circle cx={dotX} cy={dotY} r={3.5} fill="#ff5c57" />

                      {/* Badge con coordenadas exactas */}
                      <g transform={`translate(${dotX - badgeW / 2}, ${badgeY - 12})`}>
                        <rect width={badgeW} height="20" rx="10" fill="#1e293b" />
                        <text x={badgeW / 2} y="14" fontSize="10" fontWeight="700" fill="white" textAnchor="middle">
                          {coordText}
                        </text>
                      </g>

                      {outOfRange ? (
                        <text x={dotX + 14} y={dotY - 12} fontSize="11" fontWeight="700" fill="#b45309">!</text>
                      ) : null}
                    </g>
                  );
                })()}
              </svg>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-56 text-center px-4">
              <AlertTriangle className="w-8 h-8 text-amber-300 mb-2" />
              <p className="text-sm font-semibold text-slate-500">Somatocarta no disponible</p>
              <p className="text-xs text-slate-400 mt-1">Faltan pliegues (TR, SE, SI) y/o diámetros óseos (húmero, fémur) para calcular los componentes.</p>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
