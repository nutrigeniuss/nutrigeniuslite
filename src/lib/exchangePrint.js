// Construcción del HTML A4 imprimible del plan por intercambios (sin React).
// Extraído de ExchangeDietCreator.jsx para poder testear el HTML sin montar el
// editor. La vista previa la abre openHtmlPrintPreview (overlay + iframe).
import { getOrderedGroups, scenarioLabel } from "@/lib/exchangePlan";
import { getPatientGroupLabel } from "@/components/exchanges/exchangeData";
import { esc } from "@/lib/anthropometry/printReport/format";

const safeUrl = (url) => {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw, "https://example.invalid");
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return esc(parsed.href);
  } catch {
    /* ignore */
  }
  return "";
};

const getFoodQty = (food) => {
  let qty = food.measure || '';
  if (food.grams_raw) qty += ` (${food.grams_raw}g crudo)`;
  else if (food.grams_cooked) qty += ` (${food.grams_cooked}g cocido)`;
  return esc(qty);
};

// Devuelve el documento HTML completo del plan por intercambios listo para
// imprimir. Recibe la data ya resuelta del editor (escenarios, escenario activo,
// grupos/comidas activos, totales, selección de alimentos por grupo, etc.).
export function buildExchangePrintHtml({
  scenarios,
  activeScenario,
  activeGroups,
  meals,
  totalsKcal,
  title,
  patientName,
  date,
  allUsedFoodGroups,
  mergedFoodSelections,
  brandLogoUrl,
  brandName,
}) {
  const printedScenarios = scenarios
    .map((scenario) => {
      const scenarioGroups = getOrderedGroups(scenario.active_group_keys || []).filter((group) =>
        (scenario.meals || []).some((meal) => parseFloat(meal.exchanges?.[group.key] || 0) > 0)
      );

      const scenarioMeals = (scenario.meals || []).filter((meal) =>
        scenarioGroups.some((group) => parseFloat(meal.exchanges?.[group.key] || 0) > 0)
      );

      const totalScenarioKcal = scenarioMeals.reduce(
        (sum, meal) => sum + scenarioGroups.reduce((groupSum, group) => groupSum + parseFloat(meal.exchanges?.[group.key] || 0) * group.kcal, 0),
        0,
      );

      return {
        scenario,
        groups: scenarioGroups,
        meals: scenarioMeals,
        totalKcal: Math.round(totalScenarioKcal),
      };
    })
    .filter((entry) => entry.groups.length > 0);

  const plansToPrint = printedScenarios.length > 0 ? printedScenarios : [{
    scenario: activeScenario,
    groups: activeGroups,
    meals: meals.filter((meal) => activeGroups.some((group) => parseFloat(meal.exchanges?.[group.key] || 0) > 0)),
    totalKcal: Math.round(totalsKcal || 0),
  }];

  const coverPlanSummary = plansToPrint.map((entry, index) => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;min-width:0;width:100%;">
      <div>
        <div style="font-size:16px;font-weight:700;color:#1e293b;">${esc(scenarioLabel(entry.scenario, index, "Plan Alimenticio"))}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px;">Distribución por intercambios</div>
      </div>
      <div style="font-size:20px;font-weight:800;color:#0f766e;white-space:nowrap;">${esc(entry.totalKcal)} kcal</div>
    </div>
  `).join('');

  const planPages = plansToPrint.map((entry, index) => {
    const mealsContent = entry.meals.map((meal) => {
      const mealExchanges = entry.groups.filter((group) => parseFloat(meal.exchanges?.[group.key] || 0) > 0);
      if (mealExchanges.length === 0) return '';

      return `<div style="display:flex;gap:24px;margin-bottom:20px;align-items:flex-start;">
        <div style="width:120px;flex-shrink:0;text-align:right;padding-top:2px;border-right:2px solid #e2e8f0;padding-right:16px;">
          <div style="font-weight:700;font-size:13px;color:#1e293b;">${esc(meal.name)}</div>
          ${meal.time ? `<div style="font-size:11px;color:#94a3b8;">${esc(meal.time)}</div>` : ''}
        </div>
        <div style="flex:1;padding-left:16px;">
          ${mealExchanges.map((group) => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="width:8px;height:8px;border-radius:50%;background:#14b8a6;display:inline-block;flex-shrink:0;"></span>
            <span style="font-size:13px;color:#334155;"><strong>${esc(meal.exchanges[group.key])}</strong> ${esc(getPatientGroupLabel(group))}</span>
          </div>`).join('')}
        </div>
      </div>`;
    }).join('');

    return `<section style="min-height:100vh; padding:12px 0; page-break-before:always;">
      <div style="margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;">
          <div>
            <h1 style="font-size:26px;font-weight:700;color:#1e293b;margin-bottom:6px;">${esc(scenarioLabel(entry.scenario, index, "Plan Alimenticio"))}</h1>
            <p style="font-size:14px;color:#0f766e;font-weight:600;">${esc(title)}</p>
          </div>
          <div style="text-align:right;font-size:13px;color:#64748b;line-height:1.6;">
            <div><strong>Paciente:</strong> ${esc(patientName)}</div>
            <div><strong>Fecha:</strong> ${esc(date)}</div>
            <div><strong>Energía:</strong> ${esc(entry.totalKcal)} kcal</div>
          </div>
        </div>
      </div>
      <div>
        ${mealsContent || '<p style="font-size:13px;color:#94a3b8;">Sin intercambios registrados en este plan.</p>'}
      </div>
    </section>`;
  }).join('');

  const groupsContent = allUsedFoodGroups.map((group) => {
    const sel = mergedFoodSelections[group.key] || [];
    const foods = group.foods.filter((food) => sel.includes(food.id));
    if (foods.length === 0) return '';

    const half = Math.ceil(foods.length / 2);
    const col1 = foods.slice(0, half);
    const col2 = foods.slice(half);

    return `<div style="margin-bottom:28px;page-break-inside:avoid;">
      <div style="display:flex;align-items:center;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;margin-bottom:8px;">
        <span style="width:10px;height:10px;border-radius:50%;background:#14b8a6;display:inline-block;"></span>
        <span style="font-weight:700;font-size:14px;color:#1e293b;">${esc(getPatientGroupLabel(group))}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="border:1px solid #e2e8f0;padding:6px 10px;text-align:left;font-weight:600;color:#475569;">Alimento</th>
          <th style="border:1px solid #e2e8f0;padding:6px 10px;text-align:left;font-weight:600;color:#475569;">Cantidad</th>
          <th style="border:1px solid #e2e8f0;padding:6px 10px;text-align:left;font-weight:600;color:#475569;">Alimento</th>
          <th style="border:1px solid #e2e8f0;padding:6px 10px;text-align:left;font-weight:600;color:#475569;">Cantidad</th>
        </tr></thead>
        <tbody>${col1.map((food, i) => `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'};">
          <td style="border:1px solid #e2e8f0;padding:5px 10px;color:#334155;">${esc(food.name)}</td>
          <td style="border:1px solid #e2e8f0;padding:5px 10px;color:#475569;">${getFoodQty(food)}</td>
          ${col2[i] ? `<td style="border:1px solid #e2e8f0;padding:5px 10px;color:#334155;">${esc(col2[i].name)}</td><td style="border:1px solid #e2e8f0;padding:5px 10px;color:#475569;">${getFoodQty(col2[i])}</td>` : `<td style="border:1px solid #e2e8f0;"></td><td style="border:1px solid #e2e8f0;"></td>`}
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  }).join('');

  const logoSrc = safeUrl(brandLogoUrl);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${esc(title)}</title><style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:Arial,sans-serif;color:#1e293b;padding:12px;}
img{max-width:100%;height:auto;}
table{width:100%;max-width:100%;}
@media screen and (max-width:640px){
  body{padding:8px;font-size:14px;}
  h1{font-size:22px !important;}
  h2{font-size:16px !important;}
  section{min-height:auto !important;padding:16px 8px !important;}
}
@page{margin:2cm;}
</style></head><body>
    <section style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px;">
      ${logoSrc ? `<img src="${logoSrc}" alt="${esc(brandName || 'Logo')}" style="max-height:72px;max-width:min(220px,100%);object-fit:contain;margin-bottom:20px;"/>` : ''}
      ${brandName ? `<div style="font-size:15px;font-weight:700;color:#334155;margin-bottom:20px;">${esc(brandName)}</div>` : ''}
      <h1 style="font-size:32px;font-weight:800;color:#1e293b;margin-bottom:12px;">Plan Alimenticio</h1>
      <h2 style="font-size:18px;font-weight:700;color:#0f766e;margin-bottom:28px;">${esc(title)}</h2>
      <div style="font-size:16px;color:#334155;line-height:1.8;margin-bottom:28px;">
        <div><strong>Paciente:</strong> ${esc(patientName)}</div>
        <div><strong>Fecha:</strong> ${esc(date)}</div>
      </div>
      <div style="display:grid;gap:12px;max-width:720px;width:100%;">
        ${coverPlanSummary}
      </div>
    </section>
    ${planPages}
    <section style="page-break-before:always; min-height:100vh; padding:12px 0;">
      <h2 style="font-size:22px;font-weight:bold;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-bottom:12px;">Grupos de alimentos seleccionados</h2>
      ${groupsContent || '<p style="font-size:13px;color:#94a3b8;">No hay grupos de alimentos seleccionados para imprimir.</p>'}
    </section>
  </body></html>`;
}
