import { describe, expect, it } from 'vitest';
import {
  buildCredentialsWhatsAppMessage,
  normalizeWhatsAppPhone,
  whatsAppSendUrl,
} from './adminWhatsAppInvite';

describe('normalizeWhatsAppPhone', () => {
  it('strips non-digits and adds PE country code for 9-digit mobiles', () => {
    expect(normalizeWhatsAppPhone('999 888 777')).toBe('51999888777');
  });

  it('keeps numbers that already include country code', () => {
    expect(normalizeWhatsAppPhone('+51 999 888 777')).toBe('51999888777');
  });
});

describe('buildCredentialsWhatsAppMessage', () => {
  it('includes email and visible password', () => {
    const msg = buildCredentialsWhatsAppMessage({
      fullName: 'Ana',
      email: 'ana@demo.com',
      password: 'Temp1234',
    });
    expect(msg).toContain('Ana');
    expect(msg).toContain('ana@demo.com');
    expect(msg).toContain('Temp1234');
    expect(msg).toContain('/login');
  });
});

describe('whatsAppSendUrl', () => {
  it('builds wa.me link with encoded text', () => {
    const url = whatsAppSendUrl('51999888777', 'Hola Ana');
    expect(url).toBe('https://wa.me/51999888777?text=Hola%20Ana');
  });
});
