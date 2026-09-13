import { esc } from '@/lib/anthropometry/printReport/format';
import type { DietEditorItem, DietEditorMeal } from '@/components/diet/dietEditorTypes';

const qtyLabel = (item: DietEditorItem): string => {
  const q = item.quantity != null && Number.isFinite(Number(item.quantity))
    ? String(item.quantity)
    : '';
  const u = (item.unit || '').trim();
  if (q && u) return `${q} ${u}`;
  if (q) return q;
  if (u) return u;
  return '—';
};

const itemKcal = (item: DietEditorItem): number => {
  const cal = Number(item.calories) || 0;
  const qty = Number(item.quantity);
  const mult = Number.isFinite(qty) && qty > 0 ? qty : 1;
  return Math.round(cal * mult);
};

const mealKcal = (meal: DietEditorMeal): number =>
  (meal.items || []).reduce((sum, item) => sum + itemKcal(item), 0);

/**
 * HTML imprimible del plan por alimentos con estilos hex inline.
 * Evita Tailwind/oklch: html2canvas no parsea oklch() (error al enviar WhatsApp).
 */
export function buildDietFoodsPrintHtml(input: {
  title: string;
  date: string;
  patientName?: string;
  meals: DietEditorMeal[];
  targetCalories?: number;
  brandName?: string | null;
}): string {
  const title = input.title || 'Plan alimentario';
  const patient = input.patientName || 'Paciente';
  const date = input.date || '';
  const target = input.targetCalories != null ? Math.round(Number(input.targetCalories)) : null;

  const dayTotal = (input.meals || []).reduce((sum, meal) => sum + mealKcal(meal), 0);

  const mealsHtml = (input.meals || [])
    .filter((meal) => (meal.items || []).length > 0)
    .map((meal) => {
      const rows = (meal.items || []).map((item) => {
        const kcal = itemKcal(item);
        return `<tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#334155;">${esc(item.name || 'Alimento')}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#64748b;white-space:nowrap;">${esc(qtyLabel(item))}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;text-align:right;font-weight:600;white-space:nowrap;">${kcal} kcal</td>
        </tr>`;
      }).join('');

      return `<section style="margin:0 0 22px;page-break-inside:avoid;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #3b5feb;">
          <div>
            <div style="font-size:15px;font-weight:700;color:#0f172a;">${esc(meal.name || 'Comida')}</div>
            ${meal.time ? `<div style="font-size:12px;color:#94a3b8;margin-top:2px;">${esc(meal.time)}</div>` : ''}
          </div>
          <div style="font-size:13px;font-weight:700;color:#3b5feb;">${mealKcal(meal)} kcal</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="text-align:left;padding:6px 10px;color:#64748b;font-weight:600;">Alimento</th>
              <th style="text-align:left;padding:6px 10px;color:#64748b;font-weight:600;">Cantidad</th>
              <th style="text-align:right;padding:6px 10px;color:#64748b;font-weight:600;">Energía</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${meal.notes ? `<p style="margin-top:8px;font-size:12px;color:#64748b;">${esc(meal.notes)}</p>` : ''}
      </section>`;
    })
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${esc(title)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#ffffff;padding:20px;}
@page{margin:14mm;}
</style></head><body>
  <header style="margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #3b5feb;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#3b5feb;margin-bottom:6px;">Plan alimentario</div>
    <h1 style="font-size:22px;font-weight:800;color:#0f172a;margin-bottom:8px;">${esc(title)}</h1>
    <div style="font-size:13px;color:#475569;line-height:1.6;">
      <div><strong>Paciente:</strong> ${esc(patient)}</div>
      ${date ? `<div><strong>Fecha:</strong> ${esc(date)}</div>` : ''}
      ${target != null ? `<div><strong>Objetivo:</strong> ${target} kcal</div>` : ''}
      <div><strong>Total del plan:</strong> ${dayTotal} kcal</div>
      ${input.brandName ? `<div style="margin-top:4px;color:#3b5feb;font-weight:600;">${esc(input.brandName)}</div>` : ''}
    </div>
  </header>
  ${mealsHtml || '<p style="color:#94a3b8;">Sin alimentos en el plan.</p>'}
  <footer style="margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
    Generado con NutriGenius Lite
  </footer>
</body></html>`;
}
