import { describe, expect, it } from 'vitest';
import { buildDietWhatsAppMessage } from './shareDietWhatsApp';
import { normalizeWhatsAppPhone } from './adminWhatsAppInvite';

describe('buildDietWhatsAppMessage', () => {
  it('incluye nombre y título', () => {
    const msg = buildDietWhatsAppMessage({
      patientName: 'Ana Pérez',
      planTitle: 'Plan 1800 kcal',
    });
    expect(msg).toContain('Ana');
    expect(msg).toContain('Plan 1800 kcal');
  });
});

describe('normalizeWhatsAppPhone (ficha)', () => {
  it('antepone 51 a celular PE', () => {
    expect(normalizeWhatsAppPhone('999888777')).toBe('51999888777');
  });
});
