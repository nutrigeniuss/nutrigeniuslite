import React from "react";

// Celda con controles +/- para cargar intercambios (medio punto) en la tabla.
export default function StepperCell({ value, onChange, compact = false }) {
  const isActive = value > 0;
  return (
    <div className={`group mx-auto flex items-center justify-center ${compact ? "h-8 gap-0.5" : "h-9 gap-1"}`}>
      <button
        onClick={() => onChange(Math.max(0, Math.round((value - 0.5) * 2) / 2))}
        className={`flex items-center justify-center rounded-lg border text-xs font-bold leading-none shadow-sm transition-all ${compact ? "h-5 w-5" : "h-6 w-6"} ${isActive ? "border-[#ffc65d] bg-[#fff9e6] text-[#c97317] hover:bg-[#fff0cc]" : "border-[#e3e8fb] bg-white text-slate-300 hover:border-[#e8a8a8] hover:bg-[#fef5f5] hover:text-[#d97c7c]"}`}
      >−</button>
      <div className={`flex items-center justify-center rounded-lg border font-bold transition-all ${compact ? "h-5 w-11 px-1 text-[10px]" : "h-6 w-14 px-2 text-[12px]"} ${isActive ? "border-[#ffc65d] bg-gradient-to-b from-[#fffef0] to-[#fff9e6] text-[#c97317] shadow-[0_4px_12px_-4px_rgba(201,115,23,0.25)]" : "border-[#dce2f0] bg-white text-slate-600"}`}>
        {value > 0 ? value.toFixed(value % 1 === 0 ? 0 : 1) : "0"}
      </div>
      <button
        onClick={() => onChange(Math.round((value + 0.5) * 2) / 2)}
        className={`flex items-center justify-center rounded-lg border text-xs font-bold leading-none shadow-sm transition-all ${compact ? "h-5 w-5" : "h-6 w-6"} border-[#c8d5ff] bg-[#f0f5ff] text-[#4566e8] hover:border-[#a8bfff] hover:bg-[#e8ecff]`}
      >+</button>
    </div>
  );
}
