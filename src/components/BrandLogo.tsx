import { useId } from 'react';

export default function BrandLogo({ className = '', alt, compact = false }: { className?: string; alt?: string; compact?: boolean }) {
  // useId da ids únicos por instancia: BrandLogo puede renderizarse dos veces en
  // la misma página (sidebar + top bar móvil) y los ids de gradiente/filtro no
  // deben colisionar (si colisionan, el segundo logo pierde el degradado).
  const uid = useId().replace(/:/g, '');
  const bodyGrad = `bg-${uid}`;
  const heartGrad = `hg-${uid}`;
  const shadow = `sh-${uid}`;

  return (
    <div className={`flex items-center gap-2 select-none ${className}`} aria-label={alt ?? 'NutriGenius'}>
      <svg viewBox="0 0 48 48" className="h-9 w-auto flex-shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id={bodyGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff7a6d" />
            <stop offset="1" stopColor="#ef3f3a" />
          </linearGradient>
          <linearGradient id={heartGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#ffe9e7" />
          </linearGradient>
          <filter id={shadow} x="-40%" y="-30%" width="180%" height="180%">
            <feDropShadow dx="0" dy="2.4" stdDeviation="2.2" floodColor="#e23b34" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* Hoja (más grande y notoria) con nervadura */}
        <path d="M24.5 11 C25.2 4.2 31.5 0.2 39.5 1.8 C38.8 9 32 13.2 24.5 11Z" fill="#17c26a" />
        <path d="M26.6 9.5 C31 7.3 35.4 4.6 38.8 2.3" stroke="#0c8f52" strokeWidth="1.2" strokeLinecap="round" />

        {/* Manzana (badge) con profundidad */}
        <g filter={`url(#${shadow})`}>
          <rect x="5" y="7" width="38" height="38" rx="13" fill={`url(#${bodyGrad})`} />
          <rect x="5" y="7" width="38" height="19" rx="13" fill="#ffffff" opacity="0.10" />
        </g>

        {/* Corazón */}
        <path
          d="M24 36 C22.4 34.4 14 28.4 14 21.4 C14 17.8 16.7 15.4 19.9 15.4 C21.9 15.4 23.4 16.5 24 18.05 C24.6 16.5 26.1 15.4 28.1 15.4 C31.3 15.4 34 17.8 34 21.4 C34 28.4 25.6 34.4 24 36Z"
          fill={`url(#${heartGrad})`}
        />
      </svg>
      {compact ? null : (
        <div>
          <span className="font-black text-xl tracking-tight leading-none" style={{ color: '#ff5c57' }}>Nutri</span>
          <span className="font-semibold text-xl tracking-tight leading-none" style={{ color: '#3b5feb' }}>Genius</span>
        </div>
      )}
    </div>
  );
}
