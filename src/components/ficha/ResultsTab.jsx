import React from "react";
import { calcAge, normalizeSex } from "@/lib/anthropometry";
import { GoToFieldContext } from "./results/resultsShared";
import ResultsPrintButton from "./results/ResultsPrintButton";
import PesoSection from "./results/PesoSection";
import GestacionSection from "./results/GestacionSection";
import { activePregnancy } from "@/lib/gestation/gestationalGain";
import PerimetroSection from "./results/PerimetroSection";
import PlieguesSection from "./results/PlieguesSection";
import ComposicionSection from "./results/ComposicionSection";
import SomatocartaSection from "./results/SomatocartaSection";
import ResultsSummary from "./results/ResultsSummary";

export default function ResultsTab({ data, sex, patient, onGoToField, onSetField }) {
  const ageYears = calcAge(patient?.birth_date, data?.date);
  const normSex = normalizeSex(sex ?? patient?.gender ?? patient?.sex);
  const pregnancy = activePregnancy(patient?.pregnancies);

  if (pregnancy) {
    return (
      <GoToFieldContext.Provider value={onGoToField}>
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex justify-end">
            <ResultsPrintButton patient={patient} measurement={data} />
          </div>
          <GestacionSection data={data} patient={patient} pregnancy={pregnancy} />
        </div>
      </GoToFieldContext.Provider>
    );
  }

  return (
    <GoToFieldContext.Provider value={onGoToField}>
      <div className="mx-auto max-w-5xl space-y-5 p-5 sm:p-6">
        <div className="flex justify-end">
          <ResultsPrintButton patient={patient} measurement={data} />
        </div>
        <ResultsSummary data={data} sex={normSex} ageYears={ageYears} />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <PesoSection data={data} sex={normSex} ageYears={ageYears} patient={patient} onSetField={onSetField} />
          <PerimetroSection data={data} sex={normSex} ageYears={ageYears} />
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <PlieguesSection data={data} sex={normSex} ageYears={ageYears} />
          <ComposicionSection data={data} sex={normSex} ageYears={ageYears} onGoToField={onGoToField} />
        </div>
        <SomatocartaSection data={data} sex={sex} />
      </div>
    </GoToFieldContext.Provider>
  );
}
