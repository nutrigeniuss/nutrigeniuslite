# WhatsApp + PDF en dietas (Lite)

## Objetivo
Desde el editor de dieta (alimentos e intercambios), en móvil: menú **Opciones** con PDF/Imprimir y WhatsApp. WhatsApp genera el PDF del plan y abre el envío al celular de la ficha.

## Datos
- Campo opcional `whatsapp` en la ficha de sesión (cabecera).
- Se persiste en `localStorage` con el resto de la ficha.
- Se pasa a los editores vía query `whatsapp=` al navegar.

## Flujo WhatsApp
1. Si no hay número válido → toast pidiendo celular en la ficha.
2. Generar PDF del plan (mismo contenido que impresión).
3. Intentar `navigator.share({ files: [pdf], text })` (móvil).
4. Abrir `wa.me/{phone}?text=…` para el chat del paciente.
5. Si no hay Web Share → descargar PDF + abrir WhatsApp.

## UI
- **Opciones**: PDF / Imprimir · WhatsApp
- Escritorio: mismos accesos (Imprimir + WhatsApp o menú).
