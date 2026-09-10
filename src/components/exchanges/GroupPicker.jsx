import React, { useState } from "react";
import { EXCHANGE_GROUPS, getPatientGroupLabel } from "./exchangeData";

// Dropdown para agregar un grupo de intercambios que aún no está en la tabla activa.
export default function GroupPicker({ activeKeys, onAdd, onClose }) {
  const [search, setSearch] = useState("");
  const available = EXCHANGE_GROUPS.filter(g =>
    !activeKeys.includes(g.key) &&
    getPatientGroupLabel(g).toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 w-64 overflow-hidden">
      <div className="p-2 border-b border-slate-100">
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar grupo..."
          className="w-full rounded-lg border border-[#dde3f0]/80 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>
      <div className="max-h-60 overflow-y-auto">
        {available.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No hay más grupos</p>
        ) : available.map(g => (
          <button
            key={g.key}
            onClick={() => { onAdd(g.key); onClose(); }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-brand-50 hover:text-brand-500"
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${g.color.replace(/bg-(\w+-\d+).*/, 'bg-$1')}`} />
            <div>
              <p className="font-medium text-slate-700">{getPatientGroupLabel(g)}</p>
              <p className="text-xs text-slate-400">{g.kcal} kcal · P:{g.protein}g C:{g.carbs}g G:{g.fat}g</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
