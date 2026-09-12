import { createRoot } from 'react-dom/client';
import { DietPrintDocument } from '@/components/diet/DietPrintView';
import type { DietEditorMeal } from '@/components/diet/dietEditorTypes';
import { elementToPdfFile } from '@/lib/pdfFromHtml';

type PrintRecipe = {
  id?: string;
  name?: string;
  [key: string]: unknown;
};

export async function dietPlanToPdfFile(input: {
  title: string;
  date: string;
  patientName?: string;
  meals: DietEditorMeal[];
  targetCalories: number;
  recipes?: PrintRecipe[];
  brandLogoUrl?: string | null;
  brandName?: string | null;
  filename?: string;
}): Promise<File> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-12000px;top:0;width:210mm;background:#fff;z-index:-1;';
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    root.render(
      <DietPrintDocument
        title={input.title}
        date={input.date}
        patientName={input.patientName}
        meals={input.meals}
        targetCalories={input.targetCalories}
        recipes={input.recipes || []}
        brandLogoUrl={input.brandLogoUrl}
        brandName={input.brandName}
      />,
    );

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
    await new Promise((r) => window.setTimeout(r, 300));

    const safeName = (input.filename || input.title || 'plan-alimentario')
      .replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/gi, '')
      .trim()
      .slice(0, 40) || 'plan-alimentario';

    return await elementToPdfFile(host, `${safeName}.pdf`);
  } finally {
    root.unmount();
    host.remove();
  }
}
