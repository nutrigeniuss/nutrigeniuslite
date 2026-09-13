/**
 * Vista previa de impresión HTML (iframe) antes de abrir el diálogo del navegador.
 * Misma idea que DietPrintView: ver el documento → Imprimir / Guardar PDF → Cerrar.
 *
 * Importante (producción / Vercel):
 * - Un iframe con `blob:` queda bloqueado si CSP no incluye `frame-src blob:`
 *   (cae a `default-src 'self'`). Eso muestra el icono de documento roto.
 * - `srcdoc` carga el HTML en el mismo origen y no depende de blob.
 */

const OVERLAY_ID = 'nutrigenius-html-print-preview';

type OpenHtmlPrintPreviewOptions = {
  html: string;
  title?: string;
  /** Prefijo del nombre si hay que descargar el HTML como fallback. */
  downloadName?: string;
};

function removeExistingOverlay(): void {
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById('nutrigenius-print-frame')?.remove();
  document.getElementById('nutrigenius-gestation-print-frame')?.remove();
  document.getElementById('nutrigenius-lab-print-frame')?.remove();
}

/**
 * Muestra un overlay a pantalla completa con el informe y botones
 * «Cerrar vista previa» e «Imprimir / Guardar PDF».
 * Devuelve true si se pudo montar la vista previa.
 */
export function openHtmlPrintPreview({
  html,
  title = 'Vista previa del reporte',
  downloadName = 'reporte.html',
}: OpenHtmlPrintPreviewOptions): boolean {
  try {
    removeExistingOverlay();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', title);

    overlay.innerHTML = `
      <style>
        #${OVERLAY_ID} {
          position: fixed;
          inset: 0;
          z-index: 99999;
          background: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(4px);
          overflow: auto;
          -webkit-overflow-scrolling: touch;
          padding: 5rem 0.75rem 1.5rem;
          box-sizing: border-box;
        }
        #${OVERLAY_ID} .ng-print-toolbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100000;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.5rem;
          padding: 0.65rem 0.75rem;
          background: #fff;
          border-bottom: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
        }
        #${OVERLAY_ID} .ng-print-toolbar .ng-print-title {
          flex: 1 1 100%;
          order: 3;
          text-align: center;
          font: 600 0.75rem/1.25 system-ui, sans-serif;
          color: #334155;
        }
        @media (min-width: 640px) {
          #${OVERLAY_ID} {
            padding: 5.5rem 1rem 2rem;
          }
          #${OVERLAY_ID} .ng-print-toolbar {
            flex-wrap: nowrap;
            gap: 0.75rem;
            padding: 0.75rem 1.25rem;
          }
          #${OVERLAY_ID} .ng-print-toolbar .ng-print-title {
            flex: 1 1 auto;
            order: 0;
            font-size: 0.875rem;
          }
        }
        #${OVERLAY_ID} .ng-print-toolbar button {
          font: 600 0.8125rem/1 system-ui, sans-serif;
          border-radius: 0.75rem;
          padding: 0.65rem 0.9rem;
          min-height: 2.75rem;
          cursor: pointer;
          border: 0;
          touch-action: manipulation;
        }
        #${OVERLAY_ID} .ng-print-close {
          background: transparent;
          color: #94a3b8;
        }
        #${OVERLAY_ID} .ng-print-close:hover { color: #3b5feb; }
        #${OVERLAY_ID} .ng-print-go {
          margin-left: auto;
          background: #3b5feb;
          color: #fff;
          box-shadow: 0 8px 18px rgba(59, 95, 235, 0.22);
        }
        #${OVERLAY_ID} .ng-print-go:hover { background: #3355d8; }
        #${OVERLAY_ID} .ng-print-sheet {
          width: min(210mm, 100%);
          margin: 0 auto;
          background: #fff;
          border-radius: 1rem;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.12);
          overflow: hidden;
        }
        #${OVERLAY_ID} iframe {
          display: block;
          width: 100%;
          min-height: 70vh;
          border: 0;
          background: #fff;
        }
        @media print {
          body > *:not(#${OVERLAY_ID}) { display: none !important; }
          #${OVERLAY_ID} {
            position: static !important;
            inset: auto !important;
            background: #fff !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          #${OVERLAY_ID} .ng-print-toolbar { display: none !important; }
          #${OVERLAY_ID} .ng-print-sheet {
            width: 100% !important;
            margin: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
        }
      </style>
      <div class="ng-print-toolbar">
        <button type="button" class="ng-print-close" data-ng-print-close>Cerrar</button>
        <div class="ng-print-title"></div>
        <button type="button" class="ng-print-go" data-ng-print-go>Imprimir / PDF</button>
      </div>
      <div class="ng-print-sheet">
        <iframe title="${title.replace(/"/g, '')}"></iframe>
      </div>
    `;

    const titleEl = overlay.querySelector('.ng-print-title');
    if (titleEl) titleEl.textContent = title;

    const iframe = overlay.querySelector('iframe');
    if (!(iframe instanceof HTMLIFrameElement)) {
      throw new Error('No se pudo crear la vista previa');
    }

    // srcdoc: mismo origen, no lo bloquea CSP default-src (a diferencia de blob:).
    iframe.srcdoc = html;

    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    const resizeIframe = () => {
      try {
        const doc = iframe.contentDocument;
        const body = doc?.body;
        const root = doc?.documentElement;
        if (!body || !root) return;
        const height = Math.max(body.scrollHeight, root.scrollHeight, window.innerHeight * 0.7);
        iframe.style.height = `${height + 24}px`;
      } catch {
        iframe.style.height = `${Math.max(window.innerHeight * 0.75, 480)}px`;
      }
    };

    iframe.addEventListener('load', () => {
      resizeIframe();
      setTimeout(resizeIframe, 150);
      setTimeout(resizeIframe, 500);
    });

    overlay.querySelector('[data-ng-print-close]')?.addEventListener('click', close);
    overlay.querySelector('[data-ng-print-go]')?.addEventListener('click', () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.print();
      }
    });

    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    // Si load tarda, al menos se ve el marco.
    setTimeout(resizeIframe, 50);
    return true;
  } catch {
    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      /* ignore */
    }
    return false;
  }
}
