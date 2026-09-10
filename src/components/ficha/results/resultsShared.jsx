import React, { useContext } from "react";
import { AlertTriangle, Baby, HeartPulse, Layers, PieChart, Scale } from "lucide-react";

// Primitivos compartidos por las secciones de ResultsTab (badges de severidad,
// avisos de campos faltantes, filas de resultado y tarjetas de sección).
// Extraído de ResultsTab.jsx para bajar el tamaño del archivo principal.

// Provee `onGoToField` a cualquier aviso de faltante (sin prop-drilling) para
// que TODOS los chips "Falta:" puedan redirigir a la pestaña de captura, igual
// que ya hacía Composición Corporal.
export const GoToFieldContext = React.createContext(null);

// Mapea severity → clases Tailwind para badges.
export const SEVERITY_CLASS = {
  good: "bg-emerald-100 text-emerald-700",
  warn: "bg-yellow-100 text-yellow-700",
  bad: "bg-red-100 text-red-700",
  info: "bg-slate-100 text-slate-600",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
export function v(val) { return val !== null && val !== undefined && val !== ""; }

// Mapa ETIQUETA HUMANA (como la devuelven los indicadores en `missing`) →
// pestaña de captura. Las etiquetas no capturables directamente (Sexo, Edad,
// % Grasa, valores derivados) se omiten a propósito → chip no clicable.
export const LABEL_GROUP = {
  // Datos básicos (pestaña "peso")
  "Peso": "peso", "Peso actual": "peso", "Peso habitual": "peso", "Talla": "peso",
  "Talla sentado": "peso",
  // Perímetros (pestaña "per")
  "Cintura": "per", "Cadera": "per", "Perímetro brazo": "per", "Perímetro de Brazo": "per",
  "Perímetro del brazo": "per", "Perímetro Abdominal": "per", "Muñeca": "per",
  "Pantorrilla": "per", "Antebrazo": "per", "Brazo relajado": "per", "Muslo medio": "per",
  "Mesoesternal": "per", "Cefálico": "per", "Cuello": "per", "Muslo (1cm)": "per",
  "Tobillo": "per",
  // Pliegues (pestaña "pli")
  "Pliegue tríceps": "pli", "Tríceps": "pli", "Pliegue subescapular": "pli", "Subescapular": "pli",
  "Bíceps": "pli", "Suprailíaco": "pli", "Supraespinal": "pli", "Abdominal": "pli",
  "Muslo frontal": "pli", "Pantorrilla media": "pli", "Axilar medial": "pli", "Pectoral": "pli",
  "Pliegue abdominal": "pli", "Pliegue muslo frontal": "pli", "Pliegue pantorrilla": "pli",
  // Diámetros (pestaña "dia")
  "Fémur": "dia", "Húmero": "dia", "Biacromial": "dia", "Biiliocrestal": "dia",
  "Tórax AP": "dia", "Tórax transversal": "dia", "Longitud del pie": "dia",
  "Bistiloideo de la muñeca": "dia", "Bimaleolar": "dia",
};

// Mapa ETIQUETA HUMANA → clave del campo en el formulario (consultConfig).
//
// Con LABEL_GROUP solo se llegaba a la pestaña correcta, y ahí el nutricionista
// tenía que buscar la medida entre veinte casillas iguales. Sabiendo también
// QUÉ campo es, se puede resaltar al llegar.
//
// Las etiquetas de la izquierda son las que devuelven los indicadores en su
// `missing`, y NO siempre coinciden literalmente con el rótulo del formulario
// ("Pliegue tríceps" frente a "Tríceps"). Por eso hace falta este mapa y no
// basta con comparar textos.
export const LABEL_FIELD = {
  "Peso": "weight", "Peso actual": "weight", "Peso habitual": "weight", "Talla": "height",
  "Talla sentado": "height_sitting",

  "Cintura": "waist", "Cadera": "hip", "Perímetro Abdominal": "abdominal_per",
  "Perímetro brazo": "arm_relaxed", "Perímetro de Brazo": "arm_relaxed",
  "Perímetro del brazo": "arm_relaxed", "Brazo relajado": "arm_relaxed",
  "Muñeca": "wrist", "Antebrazo": "forearm", "Pantorrilla": "calf",
  "Muslo medio": "thigh_mid", "Mesoesternal": "mesosternal", "Cefálico": "cephalic",
  "Cuello": "neck", "Muslo (1cm)": "thigh_1cm", "Tobillo": "ankle",

  "Pliegue tríceps": "triceps", "Tríceps": "triceps",
  "Pliegue subescapular": "subscapular", "Subescapular": "subscapular",
  "Bíceps": "biceps", "Suprailíaco": "iliac_crest", "Supraespinal": "supraspinal",
  "Abdominal": "abdominal", "Pliegue abdominal": "abdominal",
  "Muslo frontal": "front_thigh", "Pliegue muslo frontal": "front_thigh",
  "Pantorrilla media": "medial_calf", "Pliegue pantorrilla": "medial_calf",
  "Axilar medial": "medial_axillar", "Pectoral": "pectoral",

  "Fémur": "femur", "Húmero": "humerus", "Biacromial": "biacromial",
  "Biiliocrestal": "biiliocrestal", "Tórax AP": "thorax_anteroposterior",
  "Tórax transversal": "thorax_transverse", "Longitud del pie": "foot_length",
  "Bistiloideo de la muñeca": "wrist_bistyloid", "Bimaleolar": "bimalleolar",
};

// Chip list compacto para campos faltantes. Si recibe `onGoToField`, cada chip
// se vuelve clicable y lleva al usuario a la pestaña de captura correspondiente.
// Diseño minimal: un único icono y pills color ámbar; sin texto "Falta:" para
// evitar la duplicación que aparecía con el wrapper viejo `MissingAlert`.
export function MissingFieldsChips({ fields, onGoToField }) {
  if (!fields || fields.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
      {fields.map(({ label, group }, i) => {
        const clickable = Boolean(onGoToField && group);
        const base = "text-[10.5px] font-semibold px-2 py-0.5 rounded-full border transition";
        const cls = clickable
          ? `${base} border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-400 cursor-pointer`
          : `${base} border-amber-200 bg-amber-50/60 text-amber-700`;
        return clickable ? (
          <button
            key={`${label}-${i}`}
            type="button"
            // Se manda también el campo concreto para poder resaltarlo al
            // llegar; sin eso la pestaña se abre y hay que buscar la medida a
            // ojo entre las demás.
            onClick={() => onGoToField(group, LABEL_FIELD[label] ?? null)}
            className={cls}
            title={`Ir a capturar “${label}”`}
          >
            {label}
          </button>
        ) : (
          <span key={`${label}-${i}`} className={cls}>{label}</span>
        );
      })}
    </div>
  );
}

// Aviso de faltantes. Ahora renderiza chips clicables: cada etiqueta se mapea a
// su pestaña de captura (LABEL_GROUP) y, si hay `onGoToField` en contexto, el
// chip redirige al formulario correspondiente. Las etiquetas no capturables
// directamente (Sexo, Edad, % Grasa, derivados) quedan como chip no clicable.
export function MissingAlert({ fields }) {
  const onGoToField = useContext(GoToFieldContext);
  const chips = (fields || []).map((label) => ({ label, group: LABEL_GROUP[label] ?? null }));
  return <MissingFieldsChips fields={chips} onGoToField={onGoToField} />;
}

// `detail` es la línea pequeña bajo la etiqueta: de dónde sale el número o
// contra qué estándar se compara. Ya se le pasaba desde la tarjeta de
// perímetros (el %CMB y su estándar) y se descartaba en silencio, así que ese
// dato existía pero no se veía en ninguna parte.
export function ResultRow({ label, value, unit, diag, diagColor, missing, detail }) {
  return (
    <div className="-mx-1 flex items-center justify-between gap-3 rounded-xl border-b border-slate-100/90 px-2 py-3 transition last:border-0 hover:bg-[#f7f8fc]/80">
      <div className="min-w-0">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        {detail ? <p className="mt-0.5 text-[10px] leading-tight text-slate-400">{detail}</p> : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {missing ? (
          <MissingAlert fields={missing} />
        ) : (
          <>
            <span className="min-w-[56px] text-right text-base font-extrabold tabular-nums text-slate-900">
              {value !== null && value !== undefined ? value : "—"}
              {value !== null && value !== undefined && unit ? (
                <span className="ml-1 text-xs font-semibold text-slate-400">{unit}</span>
              ) : null}
            </span>
            {diag && (
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${diagColor || "bg-slate-100 text-slate-600"}`}>
                {diag}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Estilo por sección: icono + chip de color coherente. El primario (#3b5feb) se
// reserva para "Estado general y peso ideal"; el resto usa tonos suaves que no
// compiten con los chips de severidad clínica.
const SECTION_STYLE = {
  teal:   { chip: "bg-brand-50 text-brand-500", Icon: Scale },      // IMC / peso ideal
  red:    { chip: "bg-rose-50 text-coral-700",   Icon: HeartPulse }, // riesgos cardiometabólicos
  blue:   { chip: "bg-sky-50 text-sky-600",      Icon: Layers },     // pliegues
  orange: { chip: "bg-amber-50 text-amber-600",  Icon: PieChart },   // composición corporal
  rose:   { chip: "bg-[#fce7f3] text-[#ec4899]", Icon: Baby },       // gestación
};

export function SectionCard({ title, color = "teal", children }) {
  const style = SECTION_STYLE[color] || SECTION_STYLE.teal;
  const Icon = style.Icon;
  return (
    <div className="rounded-[1.5rem] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="mb-4 flex items-center gap-2.5 border-b border-slate-100 pb-3">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${style.chip}`}>
          <Icon className="h-4 w-4" />
        </span>
        <h4 className="text-sm font-bold text-slate-900">{title}</h4>
      </div>
      {children}
    </div>
  );
}
