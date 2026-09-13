// Sección del informe: lecturas de bioimpedancia tal como las reportó el equipo.
// No hay fórmulas ni diagnósticos: si no hay ningún valor, la sección no existe.

import { type AnyRecord, row, section, v } from './format';

const BIO_FIELDS: Array<[string, string, string]> = [
  ['fat_total', 'Grasa total', '%'],
  ['fat_upper', 'Grasa sección superior', '%'],
  ['fat_lower', 'Grasa sección inferior', '%'],
  ['visceral_fat', 'Grasa visceral', 'rating'],
  ['lean_mass', 'Masa libre de grasa', 'kg'],
  ['muscle_mass', 'Masa muscular', 'kg'],
  ['bone_mass', 'Peso óseo', 'kg'],
  ['body_water', 'Agua corporal', '%'],
  ['metabolic_age', 'Edad metabólica', 'años'],
];

/** HTML de la sección, o cadena vacía si no hay datos BIA. */
export function buildBioimpedanceSection(bioimpedance: AnyRecord | null | undefined): string {
  const bio = bioimpedance && typeof bioimpedance === 'object' ? bioimpedance : {};
  const rows = BIO_FIELDS.map(([key, label, unit]) => {
    const raw = bio[key];
    if (!v(raw)) return '';
    const num = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(num)) {
      return row(label, num, unit === 'rating' ? '' : unit);
    }
    return row(label, String(raw), unit === 'rating' ? '' : unit);
  }).filter(Boolean);

  if (rows.length === 0) return '';
  return section('Bioimpedancia (equipo)', 'dot-slate', rows.join(''));
}
