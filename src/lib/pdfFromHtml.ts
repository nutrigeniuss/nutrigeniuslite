import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

function triggerDownload(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

/** Convierte un nodo del DOM (ya montado y visible u offscreen) en un PDF File. */
export async function elementToPdfFile(
  element: HTMLElement,
  filename = 'plan.pdf',
): Promise<File> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const img = canvas.toDataURL('image/jpeg', 0.92);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(img, 'JPEG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(img, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  const blob = pdf.output('blob');
  return new File([blob], filename.endsWith('.pdf') ? filename : `${filename}.pdf`, {
    type: 'application/pdf',
  });
}

/** Monta un HTML completo en un iframe oculto y lo exporta a PDF. */
export async function htmlToPdfFile(
  html: string,
  filename = 'plan.pdf',
): Promise<File> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;left:-12000px;top:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error('No se pudo preparar el PDF');

    doc.open();
    doc.write(html);
    doc.close();

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      iframe.onload = () => done();
      window.setTimeout(done, 400);
      window.setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('Tiempo agotado al generar el PDF'));
        }
      }, 12_000);
    });

    // Esperar fuentes/imágenes básicas
    await new Promise((r) => window.setTimeout(r, 250));

    const body = doc.body;
    if (!body) throw new Error('Documento vacío');

    // Ajustar alto al contenido para capturar todo el plan
    const height = Math.max(body.scrollHeight, doc.documentElement?.scrollHeight || 0, 800);
    iframe.style.height = `${height}px`;

    return await elementToPdfFile(body, filename);
  } finally {
    iframe.remove();
  }
}

export { triggerDownload as downloadPdfFile };
