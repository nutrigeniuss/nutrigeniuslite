import { describe, it, expect } from 'vitest';
import { calcCMB, classifyCMB, cmbCriterionApplies, CMB_MIN_AGE_YEARS } from '../indicators';

// Wu C-Y et al. (2017), NHANES III, poblacion de 40 a 90 anios.
//
//   Varon  T1 <27.3 · T2 27.3-29.6 · T3 >=29.6   -> gradiente de mortalidad
//   Mujer  T1 <22.3 · T2 22.3-24.6 · T3 >=24.6   -> SIN asociacion significativa
//
// Sustituye al "% del estandar" de Longo & Navarro, que clasificaba como
// OBESIDAD un brazo muy musculado y contradecia al AMB, calculado con los
// mismos dos datos.

describe('CMB — formula', () => {
  it('descuenta la grasa del contorno del brazo', () => {
    // 40 cm de brazo con 5 mm de pliegue: 40 - pi*0.5 = 38.43 cm
    expect(calcCMB(40, 5).value).toBe(38.43);
  });

  it('sin brazo o sin pliegue dice cual falta', () => {
    expect(calcCMB(null, 5).missing).toContain('Perímetro brazo');
    expect(calcCMB(40, null).missing).toContain('Pliegue tríceps');
  });
});

describe('CMB — terciles en varones', () => {
  it('clasifica por los cortes de la fuente', () => {
    expect(classifyCMB(27.0, 'M', 60).classification).toBe('Tercil bajo (T1)');
    expect(classifyCMB(28.0, 'M', 60).classification).toBe('Tercil medio (T2)');
    expect(classifyCMB(31.0, 'M', 60).classification).toBe('Tercil alto (T3)');
  });

  it('los bordes exactos caen en el tercil superior', () => {
    expect(classifyCMB(27.3, 'M', 60).value).toBe(2);
    expect(classifyCMB(29.6, 'M', 60).value).toBe(3);
  });

  it('un brazo muy musculado ya no se lee como obesidad', () => {
    const muyMusculado = classifyCMB(38.43, 'M', 60);
    expect(muyMusculado.classification).toBe('Tercil alto (T3)');
    expect(muyMusculado.severity).toBe('good');
  });

  it('el tercil bajo es el de mayor mortalidad', () => {
    expect(classifyCMB(24, 'M', 60).severity).toBe('warn');
  });
});

describe('CMB — terciles en mujeres', () => {
  it('usa los cortes de mujer, no los de varon', () => {
    // 23 cm es tercil MEDIO en mujer y seria tercil BAJO con los cortes de varon.
    expect(classifyCMB(23, 'F', 60).classification).toBe('Tercil medio (T2)');
    expect(classifyCMB(23, 'M', 60).classification).toBe('Tercil bajo (T1)');
  });

  // El estudio no hallo asociacion significativa en mujeres (T2 p=0.075,
  // T3 p=0.583). Pintar el tercil alto de verde seria atribuirle a la fuente
  // un hallazgo que no tiene.
  it('no atribuye beneficio donde el estudio no lo encontro', () => {
    expect(classifyCMB(26, 'F', 60).severity).toBe('info');
    expect(classifyCMB(23, 'F', 60).severity).toBe('info');
    expect(classifyCMB(20, 'F', 60).severity).toBe('info');
  });
});

describe('CMB — franja de edad', () => {
  it('el criterio solo existe desde los 40 anios', () => {
    expect(cmbCriterionApplies(CMB_MIN_AGE_YEARS)).toBe(true);
    expect(cmbCriterionApplies(39)).toBe(false);
    expect(cmbCriterionApplies(null)).toBe(false);
  });

  it('por debajo de 40 no emite diagnostico', () => {
    const joven = classifyCMB(38.43, 'M', 29);
    expect(joven.value).toBeNull();
    expect(joven.classification).toBe('No aplica');
  });

  it('sin fecha de nacimiento tampoco lo inventa', () => {
    expect(classifyCMB(38.43, 'M', null).classification).toBe('No aplica');
  });

  it('sin sexo o sin CMB dice que falta', () => {
    expect(classifyCMB(30, null, 60).missing).toContain('Sexo');
    expect(classifyCMB(null, 'M', 60).missing).toContain('CMB');
  });
});
