import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildHtml } from '@/lib/anthropometry/printReport';

// ─────────────────────────────────────────────────────────────────────────────
// EL INFORME QUE EL PACIENTE SE LLEVA IMPRESO.
//
// 677 líneas, complejidad 170 y CERO pruebas, generando el papel con datos de
// salud que el nutricionista entrega en consulta. Si un número sale mal aquí,
// sale mal en la mano del paciente y nadie lo revisa contra la pantalla.
//
// Lo que más se protege es que el informe sea REPRODUCIBLE: reimprimir la
// misma consulta seis meses después tiene que dar exactamente el mismo papel.
// ─────────────────────────────────────────────────────────────────────────────

const adulto = (extra: Record<string, unknown> = {}) => ({
  name: 'Ana',
  last_name: 'Quispe',
  gender: 'Femenino',
  birth_date: '1990-03-15',
  ...extra,
});

const medicion = (extra: Record<string, unknown> = {}) => ({
  date: '2026-03-15', // cumple 36 años exactos ese día
  weight: 62,
  height: 160,
  ...extra,
});

afterEach(() => vi.useRealTimers());

describe('printReport — identidad del paciente', () => {
  it('escribe el nombre completo en el informe', () => {
    const html = buildHtml({ patient: adulto(), measurement: medicion() });

    expect(html).toContain('Ana Quispe');
  });

  it('cae a "Paciente" si no hay nombre, en vez de imprimir vacío', () => {
    const html = buildHtml({ patient: { birth_date: '1990-03-15' }, measurement: medicion() });

    expect(html).toContain('Paciente');
  });

  // El sexo cambia la ecuación de casi todo. Se guarda escrito de varias
  // formas según por dónde entró el dato, y todas deben leerse igual.
  it('lee el sexo esté como esté escrito', () => {
    for (const escrito of ['Masculino', 'masculino', 'M', 'male', 'Hombre']) {
      const html = buildHtml({ patient: adulto({ gender: escrito }), measurement: medicion() });
      expect(html, escrito).toContain('Masculino');
    }

    for (const escrito of ['Femenino', 'femenino', 'F', 'female', 'Mujer']) {
      const html = buildHtml({ patient: adulto({ gender: escrito }), measurement: medicion() });
      expect(html, escrito).toContain('Femenino');
    }
  });

  it('sin sexo no inventa uno: pone un guion', () => {
    const html = buildHtml({ patient: adulto({ gender: null }), measurement: medicion() });

    expect(html).not.toContain('>Masculino<');
    expect(html).not.toContain('>Femenino<');
  });
});

describe('printReport — la edad es la de la CONSULTA, no la de hoy', () => {
  // Éste es el corazón de la reproducibilidad. Si la edad se tomara del reloj,
  // reimprimir la consulta un año después daría otro tramo de IMC, otro peso
  // ideal y otros números sobre las MISMAS medidas: el paciente tendría dos
  // papeles distintos de la misma cita.
  it('el informe no cambia aunque se reimprima años después', () => {
    const entrada = { patient: adulto(), measurement: medicion() };
    // El sello "Generado:" SÍ debe cambiar: dice cuándo se imprimió el papel.
    // Todo lo demás —edad, diagnósticos, números— tiene que ser idéntico.
    const sinElSello = (html: string) => html.replace(/<div><span>Generado:<\/span>[^<]*<\/div>/, '');

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16'));
    const reciénImpreso = buildHtml(entrada);

    vi.setSystemTime(new Date('2031-11-02'));
    const reimpresoCincoAñosDespués = buildHtml(entrada);

    expect(sinElSello(reimpresoCincoAñosDespués)).toBe(sinElSello(reciénImpreso));
  });

  it('el sello de "Generado" sí registra cuándo se imprimió', () => {
    const entrada = { patient: adulto(), measurement: medicion() };

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2031-11-02'));

    expect(buildHtml(entrada)).toContain('Generado:');
    expect(buildHtml(entrada)).toContain('2031');
  });

  it('calcula la edad con la fecha de la medición', () => {
    // Nacida el 15-03-1990, medida el 15-03-2026: 36 años cumplidos ese día.
    const html = buildHtml({ patient: adulto(), measurement: medicion() });

    expect(html).toContain('36 años');
  });

  it('la víspera del cumpleaños todavía tiene un año menos', () => {
    const html = buildHtml({
      patient: adulto(),
      measurement: medicion({ date: '2026-03-14' }),
    });

    expect(html).toContain('35 años');
  });

  it('sin fecha de nacimiento no inventa una edad', () => {
    const html = buildHtml({ patient: adulto({ birth_date: null }), measurement: medicion() });

    expect(html).not.toMatch(/\d+ años/);
  });
});

describe('printReport — un niño NO se evalúa con fórmulas de adulto', () => {
  // Peso ideal, composición corporal y somatotipo no aplican en menores: ahí
  // van los indicadores OMS por edad y sexo. Mezclarlos daría un diagnóstico
  // equivocado en el papel.
  const nina = {
    name: 'Luz',
    gender: 'Femenino',
    birth_date: '2018-03-15', // 8 años en la consulta
  };

  it('usa las curvas de crecimiento OMS', () => {
    const html = buildHtml({
      patient: nina,
      measurement: { date: '2026-03-15', weight: 25, height: 128 },
    });

    expect(html).toContain('Curvas de crecimiento OMS');
  });

  it('no imprime las fórmulas de peso ideal de adulto', () => {
    const html = buildHtml({
      patient: nina,
      measurement: { date: '2026-03-15', weight: 25, height: 128 },
    });

    expect(html).not.toContain('Hamwi');
    expect(html).not.toContain('Durnin-Womersley');
  });

  it('el adulto sí las lleva', () => {
    const html = buildHtml({ patient: adulto(), measurement: medicion() });

    expect(html).toContain('Hamwi');
  });
});

describe('printReport — aguanta los datos incompletos', () => {
  it('sin peso ni talla no revienta ni imprime números falsos', () => {
    const html = buildHtml({
      patient: adulto(),
      measurement: { date: '2026-03-15' },
    });

    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
  });

  it('con una medición vacía tampoco', () => {
    const html = buildHtml({ patient: adulto(), measurement: {} });

    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
  });

  it('con un paciente vacío tampoco', () => {
    const html = buildHtml({ patient: {}, measurement: {} });

    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
  });
});

describe('printReport — la marca del profesional', () => {
  it('usa NutriGenius si no se indica otra', () => {
    const html = buildHtml({ patient: adulto(), measurement: medicion() });

    expect(html).toContain('NutriGenius');
  });

  it('usa el nombre de la clínica cuando llega', () => {
    const html = buildHtml({
      patient: adulto(),
      measurement: medicion(),
      brand: 'Clínica San Borja',
    });

    expect(html).toContain('Clínica San Borja');
  });
});

describe('printReport — bioimpedancia', () => {
  it('omite la sección si no hay lecturas BIA', () => {
    const html = buildHtml({ patient: adulto(), measurement: medicion() });
    expect(html).not.toContain('Bioimpedancia (equipo)');
  });

  it('incluye las lecturas capturadas del equipo', () => {
    const html = buildHtml({
      patient: adulto(),
      measurement: medicion({
        bioimpedance: { fat_total: 28.5, muscle_mass: 22.1, body_water: 52 },
      }),
    });
    expect(html).toContain('Bioimpedancia (equipo)');
    expect(html).toContain('Grasa total');
    expect(html).toContain('28.5');
    expect(html).toContain('Masa muscular');
    expect(html).toContain('Agua corporal');
  });
});
