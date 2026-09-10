import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

// Inputs reutilizables del editor de dieta. Los usan tanto el buscador de
// alimentos (FoodSearch) como las filas de comida (MealItemRow), por eso viven
// en su propio módulo compartido.

// Input numérico con "edición diferida": mantiene estado local mientras el
// usuario escribe y solo confirma el valor al perder foco o presionar Enter.
// Evita que cada tecla dispare el recálculo/redondeo y el valor salte.
// `displayPrecision` controla cuántos decimales se muestran cuando el input
// NO está enfocado (el valor real conservado puede tener más precisión).
export function DeferredNumberInput({ value, onCommit, min, step, className, title, displayPrecision }) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  // Sincronizar el borrador con el valor externo cuando no estamos editando.
  useEffect(() => {
    if (!editing) {
      setDraft(value == null ? "" : String(value));
    }
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const parsed = parseFloat(draft);
    if (!Number.isFinite(parsed)) {
      // Valor inválido → restaurar el actual.
      setDraft(value == null ? "" : String(value));
      return;
    }
    onCommit(parsed);
  };

  // Cuando no se está editando, mostramos el valor con precisión limitada
  // (ej. 0.831601 → "0.83") pero en memoria conservamos el valor exacto.
  const formatForDisplay = (v) => {
    if (v == null || v === "") return "";
    if (typeof displayPrecision !== "number") return v;
    const n = Number(v);
    if (!Number.isFinite(n)) return v;
    return Number(n.toFixed(displayPrecision));
  };

  return (
    <input
      type="number"
      min={min}
      step={step}
      value={editing ? draft : formatForDisplay(value)}
      onFocus={(e) => {
        setEditing(true);
        // También formateamos al enfocar para que el usuario no vea de golpe
        // todos los decimales internos cuando pasa con Tab.
        setDraft(String(formatForDisplay(value) ?? ""));
        e.target.select();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.currentTarget.blur(); }
        else if (e.key === "Escape") {
          setDraft(value == null ? "" : String(value));
          setEditing(false);
          e.currentTarget.blur();
        }
      }}
      className={className}
      title={title}
    />
  );
}

// Dropdown personalizado para elegir unidad (gramos, Unidad pequeña, etc.).
// Reemplaza al `<select>` nativo para tener una UI consistente y amigable
// con tarjetas, hover y check sobre la opción activa.
// Usa position: fixed para que el panel se superponga por encima de cualquier
// contenedor con overflow-hidden (la card del meal lo es).
export function UnitSelect({ options, value, onChange, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 180 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  // Calcula la posición del menú a partir del trigger en coords. de viewport.
  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 180),
    });
  }, []);

  // Recalcular posición al abrir y cerrar al hacer clic/scroll fuera.
  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handleClickOutside = (event) => {
      if (
        triggerRef.current && !triggerRef.current.contains(event.target) &&
        menuRef.current && !menuRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const handleReposition = () => setOpen(false); // evitar menú "flotante" al hacer scroll
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open, updatePosition]);

  const current = options[value] || options[0];

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition max-w-[180px] ${
          open
            ? "bg-sky-50 text-sky-700 ring-1 ring-sky-300"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        }`}
      >
        <span className="truncate">{current?.label || "gramos"}</span>
        <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <ul
          ref={menuRef}
          role="listbox"
          style={{
            position: "fixed",
            top: menuPos.top,
            left: menuPos.left,
            minWidth: menuPos.width,
          }}
          className="z-[60] max-w-[260px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/15"
        >
          {options.map((option, index) => {
            const isActive = index === value;
            return (
              <li key={`${option.label}-${index}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => { onChange(index); setOpen(false); }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition ${
                    isActive
                      ? "bg-sky-50 text-sky-700 font-semibold"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isActive ? <Check className="w-3.5 h-3.5 flex-shrink-0 text-sky-600" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
