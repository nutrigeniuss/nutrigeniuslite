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
      key: 'peso',
      label: 'Peso',
      value: v(w) ? w : null,
      unit: 'kg',
      hint: null,
      tone: null,
      accent: false,
    },
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
      className="grid grid-cols-2 gap-2 rounded-[1.5rem] border border-slate-200/80 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:grid-cols-3 sm:gap-3 sm:p-4 lg:grid-cols-6"
    >
      {cells.map((cell) => (
        <SummaryCell key={cell.key} {...cell} />
      ))}
    </div>
  );
}

function SummaryCell({ label, value, unit, hint, tone, missing, accent }) {
  const showHint = hint || missing;
  return (
    <div className="min-w-0 rounded-2xl bg-[#fafbfd] px-2.5 py-2.5 sm:px-3">
      <p className="ng-label !normal-case !tracking-normal">{label}</p>
      <p className={`ng-metric mt-1 ${accent ? 'text-coral-500' : ''}`}>
        {value != null && value !== '' ? value : '—'}
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
