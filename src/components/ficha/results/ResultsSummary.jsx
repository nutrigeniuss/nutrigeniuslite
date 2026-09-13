import React from 'react';
import {
  abdominalPerimeterRisk,
  bodyFatDurninSiri,
  bodyFatFaulkner,
  bodyFatGallagherAssessment,
  bodyFatRFM,
  bodyFatYuhasz,
  calcBMI,
  calcWHR,
  calcWHtR,
} from '@/lib/anthropometry';
import { useFormulaGrasa } from '@/hooks/useFormulaGrasa';
import { formatCalc } from '@/lib/formatCalc';
import { SEVERITY_CLASS, v } from './resultsShared';

function n(x) {
  return v(x) && Number.isFinite(Number(x)) ? Number(x) : null;
}

const FAT_FORMULAS = {
  siri: {
    label: 'Siri',
    calc: (sk, age, sex) => bodyFatDurninSiri(
      n(sk.biceps), n(sk.triceps), n(sk.subscapular), n(sk.iliac_crest), n(age), sex,
    ),
  },
  yuhasz: {
    label: 'Yuhasz',
    calc: (sk, _age, sex) => bodyFatYuhasz(
      n(sk.triceps), n(sk.subscapular), n(sk.supraspinal), n(sk.abdominal),
      n(sk.front_thigh), n(sk.medial_calf), sex,
    ),
  },
  faulkner: {
    label: 'Faulkner',
    calc: (sk) => bodyFatFaulkner(
      n(sk.triceps), n(sk.subscapular), n(sk.supraspinal), n(sk.abdominal),
    ),
  },
  rfm: {
    label: 'RFM',
    calc: (_sk, _age, sex, data) => bodyFatRFM(n(data.height), n(data.perimeters?.waist), sex),
  },
};

/**
 * Franja de escaneo Fitia: 6 métricas clave antes del detalle clínico.
 * `sex` debe llegar ya normalizado ('M'|'F'|null).
 */
export default function ResultsSummary({ data, sex, ageYears }) {
  const sk = data?.skinfolds || {};
  const p = data?.perimeters || {};
  const w = data?.weight;
  const h = data?.height;

  const bmi = calcBMI(w, h, ageYears);
  const { formula: fatKey } = useFormulaGrasa('pliegues');
  const fatSpec = FAT_FORMULAS[fatKey] || FAT_FORMULAS.siri;
  const fatResult = fatSpec.calc(sk, ageYears, sex, data);
  const fatPct = fatResult?.value ?? null;
  const fatDx = bodyFatGallagherAssessment(fatPct, ageYears, sex);

  const whr = calcWHR(p.waist, p.hip, sex);
  const whtr = calcWHtR(p.waist, h, ageYears);
  const abd = abdominalPerimeterRisk(p.abdominal_per, sex);

  const cells = [
    {
      key: 'imc',
      label: 'IMC',
      value: bmi.value,
      unit: null,
      hint: bmi.classification,
      tone: bmi.severity,
      accent: false,
    },
    {
      key: 'grasa',
      label: '% Grasa',
      value: fatPct,
      unit: '%',
      hint: fatDx.classification || fatSpec.label,
      tone: fatDx.severity,
      accent: true,
    },
    {
      key: 'icc',
      label: 'ICC',
      value: whr.value,
      unit: null,
      hint: whr.classification,
      tone: whr.severity,
      missing: whr.missing?.length > 0,
      accent: false,
    },
    {
      key: 'ict',
      label: 'ICT',
      value: whtr.value,
      unit: null,
      hint: whtr.classification,
      tone: whtr.severity,
      missing: whtr.missing?.length > 0,
      accent: false,
    },
    {
      key: 'abd',
      label: 'Abdominal',
      value: v(p.abdominal_per) ? p.abdominal_per : null,
      unit: 'cm',
      hint: abd.classification,
      tone: abd.severity,
      missing: abd.missing?.length > 0,
      accent: false,
    },
  ];

  return (
    <div
      data-testid="results-summary"
      className="overflow-hidden rounded-[1.5rem] border border-brand-200/70 bg-white shadow-[0_10px_28px_rgba(59,95,235,0.08)]"
    >
      <div className="bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2.5 text-white">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">Resultados</p>
        <p className="text-sm font-bold">Resumen antropométrico</p>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 sm:gap-3 sm:p-4 lg:grid-cols-5">
        {cells.map((cell) => (
          <SummaryCell key={cell.key} {...cell} />
        ))}
      </div>
    </div>
  );
}

function SummaryCell({ label, value, unit, hint, tone, missing, accent }) {
  const showHint = hint || missing;
  const display = value != null && value !== ''
    ? (typeof value === 'number' ? formatCalc(value) : value)
    : '—';
  return (
    <div className="min-w-0 rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white px-2.5 py-2.5 sm:px-3">
      <p className="ng-label !normal-case !tracking-normal">{label}</p>
      <p className={`ng-metric mt-1 ${accent ? 'text-coral-500' : ''}`}>
        {display}
        {unit && value != null && value !== '' ? (
          <span className="ml-0.5 text-xs font-semibold text-slate-400">{unit}</span>
        ) : null}
      </p>
      {showHint ? (
        <div className="mt-1.5">
          {hint && tone ? (
            <span className={`ng-chip inline-flex max-w-full truncate rounded-full px-2 py-0.5 ${SEVERITY_CLASS[tone] || SEVERITY_CLASS.info}`}>
              {hint}
            </span>
          ) : hint ? (
            <p className="ng-chip truncate text-slate-400">{hint}</p>
          ) : (
            <p className="ng-chip text-slate-400">Faltan datos</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
