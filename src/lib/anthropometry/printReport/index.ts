// Generador de reporte imprimible (PDF) de una consulta antropométrica.
//
// Estrategia: en lugar de añadir dependencias pesadas (jspdf, html2canvas)
// abrimos un iframe oculto con HTML auto-contenido y disparamos `print()`.
// El navegador ofrece "Guardar como PDF" en el diálogo de impresión, lo que
// cumple con el requerimiento (descargar/enviar al paciente) sin sumar bundle.
//
// Ventajas:
//  • Cero dependencias nuevas.
//  • CSS @media print controla márgenes, saltos de página y tipografía.
//  • Fácil de personalizar (logo, branding, firma).
//
// Para usar:
//   import { printConsultReport } from '@/lib/anthropometry/printReport';
//   printConsultReport({ patient, measurement });

import {
  ambAssessment,
  armCircumferenceAssessment,
  bodyFatDurninSiri,
  bodyFatFaulkner,
  bodyFatRFM,
  bodyFatYuhasz,
  bodyFatGallagherAssessment,
  calcAge,
  calcAMB,
  calcBMI,
  calcCMB,
  classifyCMB,
  calcComplexionFrame,
  calcWHR,
  calcWHtR,
  correctedWeight,
  healthyWeightRange,
  idealWeightByBmi,
  idealWeightByComplexion,
  idealWeightHamwi,
  idealWeightWest,
  normalizeSex,
  subscapularAssessment,
  tricepsAssessment,
  triSubSumAssessment,
  abdominalPerimeterRisk,
} from '../indicators';


import type { Sex } from '../types';
import {
  assessPatientMeasurement,
  formatAgeFromDates,
} from '../pediatric';
import {
  activePregnancy,
  formatGestationalAge,
  gestationalAgeAt,
  GAIN_TABLE_SOURCE,
} from '@/lib/gestation/gestationalGain';
import { type AnyRecord, esc, fmtDate, fmtNum, v } from './format';
import { leerFormulaGrasa } from '@/hooks/useFormulaGrasa';
import { buildGestationSection } from './gestation';
import { buildPediatricSections } from './pediatria';
import { buildRequirementSection } from './requerimiento';
import { buildIdealWeightSection } from './pesoIdeal';
import { buildPerimeterAndSkinfoldSections } from './perimetrosYPliegues';
import { buildCompositionSections } from './composicion';
import { REPORT_CSS } from './styles';
import { getCurrentLocale } from '@/lib/formatLocale';
import { openHtmlPrintPreview } from '@/lib/htmlPrintPreview';

interface PrintReportInput {
  patient: AnyRecord;
  measurement: AnyRecord;
  /** Nombre comercial de la clínica/profesional (opcional, para encabezado). */
  brand?: string;
  /** Logo de la clínica (URL) para personalizar el encabezado del reporte. */
  brandLogoUrl?: string | null;
}

/**
 * Arma el HTML completo del informe de una consulta.
 *
 * Se exporta para poder probarlo: `printConsultReport` abre un diálogo de
 * impresión, que no se puede verificar; el HTML sí. Los números que salen aquí
 * son los que el paciente se lleva impresos en la mano.
 */
export function buildHtml({ patient, measurement, brand = 'NutriGenius', brandLogoUrl }: PrintReportInput): string {
  // Datos básicos del paciente.
  const fullName = [patient?.name, patient?.last_name].filter(Boolean).join(' ') || patient?.full_name || 'Paciente';
  const sex: Sex | null = normalizeSex(patient?.gender || patient?.sex);
  const consultDate = measurement?.date || measurement?.created_at || null;
  // Edad A LA FECHA DE LA CONSULTA. El informe se entrega impreso: si se vuelve
  // a generar meses después y la edad es la de hoy, salen otros números (otro
  // tramo de IMC, otro peso ideal) sobre las mismas medidas, y el paciente
  // tiene en la mano dos papeles que no coinciden.
  const ageYears = calcAge(patient?.birth_date, consultDate);
  const ageStr = ageYears != null ? `${Math.floor(ageYears)} años` : '—';
  const sexStr = sex === 'M' ? 'Masculino' : sex === 'F' ? 'Femenino' : '—';

  // Mediciones primarias.
  const w = measurement?.weight ?? null;
  const h = measurement?.height ?? null;

  // Perímetros y pliegues (estructura típica de `data`).
  const peri: AnyRecord = measurement?.perimeters || {};
  const skin: AnyRecord = measurement?.skinfolds || {};

  // ── Evaluación pediátrica (OMS/MINSA) ──────────────────────────────────────
  // Si el paciente es niño/adolescente (<19 años), el reporte usa los indicadores
  // OMS por edad y sexo (z-scores) en lugar de las fórmulas de adulto (peso ideal,
  // composición, somatotipo), que no aplican en esa etapa.
  const pediatric = assessPatientMeasurement({
    gender: patient?.gender || patient?.sex,
    birthDate: patient?.birth_date,
    measurementDate: consultDate,
    weightKg: v(w) ? Number(w) : null,
    heightCm: v(h) ? Number(h) : null,
    headCircCm: v(peri.cephalic) ? Number(peri.cephalic) : null,
    armCircCm: v(peri.arm_relaxed) ? Number(peri.arm_relaxed) : null,
    tricepsSkinfoldMm: v(skin.triceps) ? Number(skin.triceps) : null,
    subscapularSkinfoldMm: v(skin.subscapular) ? Number(skin.subscapular) : null,
    abdominalCm: v(peri.abdominal_per) ? Number(peri.abdominal_per) : null,
    waistCm: v(peri.waist) ? Number(peri.waist) : null,
    pathologies: patient?.health_conditions?.current_pathologies,
  });
  const isChild = !!pediatric && pediatric.results.length > 0;

  // Gestación activa: manda sobre el resto de la evaluación (y sobre el bloque
  // pediátrico, que no puede coexistir con un embarazo).
  const pregnancy = activePregnancy(patient?.pregnancies);
  const gestAge = pregnancy ? gestationalAgeAt(pregnancy, consultDate) : null;
  const isZemel = pediatric?.standard === 'zemel';
  const pedAgeStr = formatAgeFromDates(patient?.birth_date, consultDate);

  // Indicadores principales.
  const bmi = calcBMI(w, h, ageYears);
  const west = idealWeightWest(h, sex);
  const hamwi = idealWeightHamwi(h, sex);
  const byBmi = idealWeightByBmi(h, ageYears);
  const frame = calcComplexionFrame(h, peri.wrist, sex);
  const byComplex = idealWeightByComplexion(h, sex, frame.value as any);
  const range = healthyWeightRange(h, ageYears);
  const corrected = correctedWeight(w, west.value, bmi.category);

  // Riesgo cardiometabólico.
  const whr = calcWHR(peri.waist, peri.hip, sex);
  const whtr = calcWHtR(peri.waist, h, ageYears);
  const wRisk = abdominalPerimeterRisk(peri.abdominal_per, sex);

  // AMB / brazo / CMB.
  const amb = calcAMB(peri.arm_relaxed, skin.triceps, sex);
  const ambDx = ambAssessment(amb.value, ageYears, sex);
  const armDx = armCircumferenceAssessment(peri.arm_relaxed, ageYears, sex);
  const cmb = calcCMB(peri.arm_relaxed, skin.triceps);
  const cmbDx = classifyCMB(cmb.value, sex, ageYears);

  // % Grasa con la formula que el nutricionista tiene elegida en la tarjeta de
  // Derivados de Pliegues -no siempre Siri- y diagnostico Gallagher, que se
  // aplica igual sobre el porcentaje final venga de donde venga.
  //
  // Es una preferencia aparte de la de composicion corporal: son dos tarjetas
  // independientes y cada una recuerda la suya. Ver useFormulaGrasa.
  const formulaPliegues = leerFormulaGrasa('pliegues');
  const numSk = (x: unknown) => (x != null && x !== '' && Number.isFinite(Number(x)) ? Number(x) : null);
  const fat =
    formulaPliegues === 'yuhasz'
      ? bodyFatYuhasz(
          numSk(skin.triceps), numSk(skin.subscapular), numSk(skin.supraspinal), numSk(skin.abdominal),
          numSk(skin.front_thigh), numSk(skin.medial_calf), sex,
        )
      : formulaPliegues === 'faulkner'
        ? bodyFatFaulkner(numSk(skin.triceps), numSk(skin.subscapular), numSk(skin.supraspinal), numSk(skin.abdominal))
        : formulaPliegues === 'rfm'
          ? bodyFatRFM(numSk(h), numSk(peri.waist), sex)
          // Los pliegues pasan por numSk como en las otras tres ramas. Sin esa
          // conversión, una medición guardada como texto (fichas viejas, datos
          // importados) hacía que el informe dijera "faltan pliegues" mientras la
          // pantalla mostraba el porcentaje — y Siri es la fórmula por defecto.
          : bodyFatDurninSiri(
              numSk(skin.biceps), numSk(skin.triceps), numSk(skin.subscapular),
              numSk(skin.iliac_crest), ageYears, sex,
            );
  const AUTOR_GRASA = { siri: 'Durnin-Womersley + Siri', yuhasz: 'Yuhasz', faulkner: 'Faulkner', rfm: 'RFM' } as const;
  const fatDx = bodyFatGallagherAssessment(fat.value, ageYears, sex);

  // Diagnósticos por pliegue individual y suma TR+SE (Frisancho).
  const triDx = tricepsAssessment(skin.triceps, ageYears, sex);
  const subDx = subscapularAssessment(skin.subscapular, ageYears, sex);
  // triSubSumAssessment espera los dos pliegues por separado (calcula la suma
  // internamente para reusar el guard de "falta uno"). Antes pasábamos el sum
  // pre-calculado, lo que causaba un mismatch de tipos y rompía typecheck CI.
  const triSubDx = triSubSumAssessment(
    v(skin.triceps) ? Number(skin.triceps) : null,
    v(skin.subscapular) ? Number(skin.subscapular) : null,
    ageYears,
    sex,
  );
  // El sum sigue calculándose abajo para mostrarlo en el reporte impreso.
  const triSubSum = v(skin.triceps) && v(skin.subscapular)
    ? Number(skin.triceps) + Number(skin.subscapular)
    : null;

  // Masa magra estimada a partir de % grasa (kg).
  const leanMass = fat.value != null && v(w)
    ? +(Number(w) * (1 - Number(fat.value) / 100)).toFixed(2)
    : null;
  const fatMass = fat.value != null && v(w)
    ? +(Number(w) * (Number(fat.value) / 100)).toFixed(2)
    : null;

  // Requerimiento calórico (si la consulta lo tiene guardado). Lo desglosa
  // ./requerimiento, que es quien lo pinta.
  const req: AnyRecord = measurement?.requirement || {};

  // ── Secciones ──
  const headerHtml = `
    <header class="report-header">
      <div class="brand">
        ${brandLogoUrl
          ? `<img src="${esc(brandLogoUrl)}" alt="${esc(brand)}" style="width:44px;height:44px;object-fit:contain;border-radius:8px;background:#fff;border:1px solid #e2e8f0;" />`
          : `<div class="brand-mark">${esc(brand[0] || 'N')}</div>`}
        <div>
          <div class="brand-name">${esc(brand)}</div>
          <div class="brand-sub">Reporte de Evaluación Antropométrica</div>
        </div>
      </div>
      <div class="meta">
        <div><span>Fecha:</span> ${esc(fmtDate(consultDate))}</div>
        <div><span>Generado:</span> ${esc(new Date().toLocaleDateString(getCurrentLocale()))}</div>
      </div>
    </header>

    <section class="patient-card">
      <div>
        <div class="lbl-mini">Paciente</div>
        <div class="patient-name">${esc(fullName)}</div>
      </div>
      <div class="patient-grid">
        <div><div class="lbl-mini">Sexo</div><div>${esc(sexStr)}</div></div>
        <div><div class="lbl-mini">Edad</div><div>${esc(isChild && pedAgeStr ? pedAgeStr : ageStr)}</div></div>
        ${gestAge ? `<div><div class="lbl-mini">Gestación</div><div>${esc(formatGestationalAge(gestAge))}</div></div>` : ''}
        <div><div class="lbl-mini">Talla</div><div>${fmtNum(h, 1)} cm</div></div>
        <div><div class="lbl-mini">Peso</div><div>${fmtNum(w, 1)} kg</div></div>
      </div>
    </section>
  `;

  // ── Sección: Estado general y peso ideal ──
  // Las cuatro fórmulas, su valoración por % de peso ideal y los tres bloques
  // grandes de la cabecera viven en ./pesoIdeal.
  const seccion1 = buildIdealWeightSection({
    w, ageYears, bmi, west, hamwi, byBmi, byComplex, frame, range, corrected,
  });

  // ── Secciones: riesgo por perímetros y derivados de pliegues ──
  // Se leen juntas y comparten el aviso de "esto salió de la tabla de al
  // lado"; viven en ./perimetrosYPliegues.
  const { perimetros: seccion2, pliegues: seccionPliegues } = buildPerimeterAndSkinfoldSections({
    peri, skin, ageYears, whr, whtr, amb, ambDx, armDx, cmb, cmbDx, wRisk,
    triDx, subDx, triSubDx, triSubSum,
  });

  // ── Secciones: composición corporal y somatotipo ──
  // Las cuatro comparten el mismo input de cálculo —incluida la fórmula de
  // grasa que el nutricionista tiene puesta— y viven en ./composicion.
  const {
    porcentajeGrasa: seccion3, cuatro: seccion4comp, cinco: seccion5comp, somatotipo: seccionSoma,
  } = buildCompositionSections({
    patient, measurement, consultDate, sex, ageYears, w, h, skin, peri,
    fat, fatDx, fatMass, leanMass, autorGrasa: AUTOR_GRASA[formulaPliegues],
  });

  // ── Sección: Requerimiento calórico ──
  // El cálculo de gramos por macro vive en ./requerimiento, junto al HTML que
  // los pinta: no se usan en ningún otro sitio del informe.
  const seccion4 = buildRequirementSection(req);
  // ── Secciones pediátricas ──
  // La tabla de z-scores y las curvas de crecimiento viven en ./pediatria: son
  // 75 líneas con su propia lógica clínica y aquí solo sumaban ruido.
  const { tabla: seccionPediatrica, curvas: seccionCurvasOMS } = buildPediatricSections({
    patient, measurement, consultDate, pediatric, isZemel,
  });

  const footer = `
    <footer class="report-footer">
      <div class="signature">
        <div class="line"></div>
        <div class="sig-lbl">Firma y sello del nutricionista</div>
      </div>
      <div class="legal">
        Reporte generado por ${esc(brand)} · Documento informativo, no reemplaza la consulta presencial.
      </div>
    </footer>
  `;

  // La sección de gestación vive en ./gestation: son 80 líneas con su propia
  // lógica clínica y aquí sólo sumaban ruido. En gestación REEMPLAZA a todo el
  // bloque de adulto, porque esos indicadores no están validados en embarazo.
  const seccionGestante = pregnancy && gestAge
    ? buildGestationSection({ patient, pregnancy, gestAge, weight: w, height: h })
    : '';

  // CSS embebido — diseño limpio, optimizado para impresión A4.
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Reporte antropométrico – ${esc(fullName)}</title>
<style>${REPORT_CSS}
  .gain-chart { border: 1px solid #e2e8f0; border-radius: 10px; background: #fafbff; padding: 6px; }
  .gain-chart svg { width: 100%; height: auto; display: block; }
  .lbl-mini { font-size: 9.5px; color: #94a3b8; }
</style>
</head>
<body>
  <div class="page">
    ${headerHtml}
    ${seccionGestante
      ? `${seccionGestante}${seccion4}`
      : isChild
        ? `${seccionPediatrica}${seccionCurvasOMS}${seccion4}`
        : `${seccion1}${seccion2}${seccionPliegues}${seccion3}${seccion4comp}${seccion5comp}${seccionSoma}${seccion4}`}
    ${footer}
    ${seccionGestante ? `<p class="lbl-mini" style="margin-top:10px">Fuente de los rangos: ${esc(GAIN_TABLE_SOURCE)}</p>` : ''}
  </div>
</body>
</html>`;
}

/**
 * Abre la vista previa del reporte (cerrar / imprimir PDF).
 * Devuelve true si se pudo mostrar la vista previa.
 */
export function printConsultReport(input: PrintReportInput): boolean {
  const html = buildHtml(input);
  return openHtmlPrintPreview({
    html,
    title: 'Vista previa · Informe antropométrico',
    downloadName: 'reporte-antropometrico.html',
  });
}
