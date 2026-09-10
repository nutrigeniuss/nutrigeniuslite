import { describe, it, expect } from 'vitest';
import { calcPCTPercent } from '../indicators';

// Valores estandar y cortes de Longo E, Navarro E. "Tecnica dietoterapica",
// 1a edicion, Buenos Aires: El Ateneo.
//
//   PCT estandar   varon 12.5 mm   mujer 16.5 mm   -> desnutricion CALORICA
//
//   >=90 normal · 80-89 leve · 60-79 moderada · <60 severa
//
// El %CMB de esta misma fuente se retiro: clasificaba como OBESIDAD un brazo
// muy musculado. El musculo se valora ahora por terciles (Wu 2017), en
// `cmbTercilesWu.test.ts`.

describe('%PCT — desnutricion calorica', () => {
  it('usa el estandar que corresponde al sexo', () => {
    expect(calcPCTPercent(12.5, 'M').value).toBe(100);
    expect(calcPCTPercent(16.5, 'F').value).toBe(100);
  });

  it('clasifica segun los cortes de la fuente', () => {
    expect(calcPCTPercent(12.5, 'M').classification).toBe('Normal');
    expect(calcPCTPercent(12.5 * 0.85, 'M').classification).toBe('Desnutrición leve');
    expect(calcPCTPercent(12.5 * 0.70, 'M').classification).toBe('Desnutrición moderada');
    expect(calcPCTPercent(12.5 * 0.50, 'M').classification).toBe('Desnutrición severa');
  });

  // La fuente escribe los tramos como "80-89 / 60-79 / <60" y leidos asi
  // dejarian sin clasificar el 79,5. Cada valor tiene que caer en un tramo.
  it('los bordes no quedan sin clasificar', () => {
    expect(calcPCTPercent(12.5 * 0.90, 'M').classification).toBe('Normal');
    expect(calcPCTPercent(12.5 * 0.80, 'M').classification).toBe('Desnutrición leve');
    expect(calcPCTPercent(12.5 * 0.60, 'M').classification).toBe('Desnutrición moderada');
    expect(calcPCTPercent(12.5 * 0.795, 'M').classification).toBe('Desnutrición moderada');
  });

  // Longo & Navarro solo describe la desnutricion; todo lo que pasa de 90 %
  // seria "normal" en su tabla. Un pliegue del 150 % del estandar no es normal,
  // es exceso de grasa, y dejarlo en verde esconderia lo contrario de lo que la
  // tabla vigila.
  it('tambien valora el exceso, no solo el defecto', () => {
    expect(calcPCTPercent(12.5 * 1.10, 'M').classification).toBe('Normal');
    expect(calcPCTPercent(12.5 * 1.15, 'M').classification).toBe('Sobrepeso');
    expect(calcPCTPercent(12.5 * 1.20, 'M').classification).toBe('Obesidad');
    expect(calcPCTPercent(12.5 * 1.50, 'M').classification).toBe('Obesidad');
  });

  it('sin pliegue o sin sexo dice que falta', () => {
    expect(calcPCTPercent(null, 'M').missing).toContain('Pliegue tríceps');
    expect(calcPCTPercent(12.5, null).missing).toContain('Sexo');
  });

  // El PCT mide la reserva de GRASA. La de MUSCULO se valora aparte (terciles
  // de CMB), y por eso un paciente puede tener una conservada y la otra no.
  it('la reserva grasa se valora por si sola', () => {
    expect(calcPCTPercent(12.5, 'M').classification).toBe('Normal');
    expect(calcPCTPercent(12.5 * 0.65, 'M').classification).toBe('Desnutrición moderada');
  });
});
