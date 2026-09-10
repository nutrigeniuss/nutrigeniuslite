// El requerimiento calórico del paciente y el reparto de macronutrientes.
//
// Solo aparece si la consulta lo tiene guardado: sin kilocalorías objetivo no
// hay nada que repartir, y una tabla de macros en blanco solo confunde.
//
// El cuerpo se movió TAL CUAL, con su indentación original: lo que hay dentro
// de las plantillas es el HTML que se imprime, y reindentarlo lo cambiaría.
import { type AnyRecord, esc, fmtNum } from './format';

/**
 * Los gramos de cada macro salen de las kilocalorías y sus porcentajes.
 *
 * Carbohidratos y proteínas aportan 4 kcal por gramo; las grasas, 9. Es lo que
 * convierte "30 % de grasas" en algo que el paciente puede llevar al mercado.
 */
export const buildRequirementSection = (requirement: AnyRecord): string => {
  const targetKcal = requirement?.target_calories;
  const carbsPct = requirement?.macro_pct_carbs;
  const proteinPct = requirement?.macro_pct_protein;
  const fatPct = requirement?.macro_pct_fat;
  const formula = requirement?.selected_formula;
  const activity = requirement?.activity_level;

  const kcalTotal = Number(targetKcal) || 0;
  const gC = carbsPct != null && kcalTotal ? (kcalTotal * (Number(carbsPct) / 100)) / 4 : null;
  const gP = proteinPct != null && kcalTotal ? (kcalTotal * (Number(proteinPct) / 100)) / 4 : null;
  const gF = fatPct != null && kcalTotal ? (kcalTotal * (Number(fatPct) / 100)) / 9 : null;

  // Sección 4: Requerimiento calórico (solo si hay datos).
  const seccion4 = targetKcal
    ? `
    <section class="section">
      <h2><span class="dot dot-sky"></span>Requerimiento calórico</h2>
      <div class="kcal-hero">
        <div class="kcal-num">${fmtNum(Number(targetKcal), 0)}</div>
        <div class="kcal-unit">kcal / día</div>
        <div class="kcal-meta">
          ${formula ? `<span><b>Fórmula:</b> ${esc(formula)}</span>` : ''}
          ${activity ? `<span><b>Actividad:</b> ${esc(activity)}</span>` : ''}
        </div>
      </div>
      <table class="data-table macros">
        <thead><tr><th>Macronutriente</th><th>%</th><th>Gramos / día</th></tr></thead>
        <tbody>
          <tr><td>Carbohidratos</td><td>${fmtNum(Number(carbsPct), 0)}%</td><td>${fmtNum(gC, 0)} g</td></tr>
          <tr><td>Proteínas</td><td>${fmtNum(Number(proteinPct), 0)}%</td><td>${fmtNum(gP, 0)} g</td></tr>
          <tr><td>Grasas</td><td>${fmtNum(Number(fatPct), 0)}%</td><td>${fmtNum(gF, 0)} g</td></tr>
        </tbody>
      </table>
    </section>`
    : '';
  return seccion4;
};
