import { describe, it, expect, afterEach } from 'vitest';
import { attachPatientManifest, patientManifestHref } from '../patientManifest';
import { buildManifest } from '../../../../api/manifest-dieta.js';

// El manifiesto decide qué icono se guarda el paciente en su celular y qué abre
// al tocarlo. Si se dejara el general, tendría un icono llamado "NutriGenius"
// que le abre la pagina de inicio del NUTRICIONISTA, no su dieta.

afterEach(() => {
  document.head.innerHTML = '';
});

describe('patientManifestHref', () => {
  it('apunta al endpoint, NO a un blob', () => {
    // La política de seguridad del sitio lleva `manifest-src 'self'`, que no
    // admite `blob:`. Con el blob, el navegador descartaba el manifiesto en
    // silencio y Chrome no ofrecía instalar nunca: solo se notaba en el sitio
    // desplegado, porque en desarrollo esa política no se aplica.
    const href = patientManifestHref({ shareKey: 'yzvsurvrdytxrvw' });
    expect(href.startsWith('/api/manifest-dieta?')).toBe(true);
    expect(href).not.toContain('blob:');
  });

  it('escapa el nombre del consultorio en vez de romper la dirección', () => {
    const href = patientManifestHref({ shareKey: 'abcdefghijklmn', brandName: 'Nutrición & Salud' });
    expect(href).toContain('marca=Nutrici%C3%B3n+%26+Salud');
  });

  it('sin marca no manda el parámetro vacío', () => {
    expect(patientManifestHref({ shareKey: 'abcdefghijklmn', brandName: '  ' })).not.toContain('marca=');
  });
});

describe('buildManifest (lo que sirve el endpoint)', () => {
  it('arranca en el enlace del paciente, no en la raíz', () => {
    const m = buildManifest('yzvsurvrdytxrvw');
    expect(m.start_url).toBe('/dieta/yzvsurvrdytxrvw');
    expect(m.scope).toBe('/dieta/yzvsurvrdytxrvw');
  });

  it('lleva el nombre del consultorio cuando lo hay', () => {
    // Lo que se lee bajo el icono es el nombre de su nutricionista, que para
    // el paciente significa algo; "NutriGenius" no.
    expect(buildManifest('abcdefghijklmn', 'Nutrición Quispe').name).toBe('Mi plan · Nutrición Quispe');
  });

  it('sin marca no deja un nombre a medias', () => {
    expect(buildManifest('abcdefghijklmn', '   ').name).toBe('Mi plan de alimentación');
  });

  it('usa el azul de marca y no el verde del manifiesto general', () => {
    expect(buildManifest('abcdefghijklmn').theme_color).toBe('#3b5feb');
  });

  it('lleva los dos iconos que Chrome exige para poder instalar', () => {
    // Sin un icono de 192 y otro de 512, Chrome no considera la página
    // instalable y no ofrece el botón.
    const tamanos = buildManifest('abcdefghijklmn').icons.map((icono) => icono.sizes);
    expect(tamanos).toContain('192x192');
    expect(tamanos).toContain('512x512');
  });
});

describe('attachPatientManifest', () => {
  it('pone el manifiesto del paciente en el documento', () => {
    attachPatientManifest({ shareKey: 'abcdefghijklmn' });
    const link = document.querySelector('link[rel="manifest"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toContain('/api/manifest-dieta?');
  });

  it('al salir devuelve el manifiesto que había antes', () => {
    // Si no lo restaurara, volver a la aplicación del nutricionista dejaría la
    // pestaña con el manifiesto del paciente puesto.
    const original = document.createElement('link');
    original.rel = 'manifest';
    original.href = '/manifest.json';
    document.head.appendChild(original);

    const quitar = attachPatientManifest({ shareKey: 'abcdefghijklmn' });
    expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toContain('/api/manifest-dieta?');

    quitar();
    expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('/manifest.json');
  });

  it('si no había ninguno, al salir no deja uno colgado', () => {
    const quitar = attachPatientManifest({ shareKey: 'abcdefghijklmn' });
    quitar();
    expect(document.querySelector('link[rel="manifest"]')).toBeNull();
  });
});
