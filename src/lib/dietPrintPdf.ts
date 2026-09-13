import type { DietEditorMeal } from '@/components/diet/dietEditorTypes';
import { buildDietFoodsPrintHtml } from '@/lib/dietFoodsPrintHtml';
import { htmlToPdfFile } from '@/lib/pdfFromHtml';

/**
 * PDF del plan por alimentos vía HTML hex (sin capturar React/Tailwind).
 * html2canvas falla con oklch() de Tailwind v4.
 */
export async function dietPlanToPdfFile(input: {
  title: string;
  date: string;
  patientName?: string;
  meals: DietEditorMeal[];
  targetCalories: number;
  recipes?: unknown[];
  brandLogoUrl?: string | null;
  brandName?: string | null;
  filename?: string;
}): Promise<File> {
  const html = buildDietFoodsPrintHtml({
    title: input.title,
    date: input.date,
    patientName: input.patientName,
    meals: input.meals,
    targetCalories: input.targetCalories,
    brandName: input.brandName,
  });

  const safeName = (input.filename || input.title || 'plan-alimentario')
    .replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/gi, '')
    .trim()
    .slice(0, 40) || 'plan-alimentario';

  return htmlToPdfFile(html, `${safeName}.pdf`);
}
