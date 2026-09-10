import { useState } from 'react';
import { getCountryOption, getCountryAlpha3, getCountryFlagUrl } from '@/lib/countries';

type CountryFlagProps = {
  code?: string | null;
  // Mostrar el código de 3 letras junto a la bandera (PER, MEX…). Default: true.
  showCode?: boolean;
  className?: string;
};

// Bandera de país como IMAGEN real (no emoji): los emojis de bandera no se
// renderizan en Windows, donde se ven como "PE". Usa flagcdn y, si la imagen
// falla o el país no tiene bandera (INT), cae al código en texto / 🌐.
export default function CountryFlag({ code, showCode = true, className = '' }: CountryFlagProps) {
  const [imgError, setImgError] = useState(false);
  const option = getCountryOption(code);
  const alpha3 = getCountryAlpha3(code);
  const flagUrl = getCountryFlagUrl(code, '20x15');

  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={option.name}>
      {flagUrl && !imgError ? (
        <img
          src={flagUrl}
          srcSet={`${getCountryFlagUrl(code, '40x30')} 2x`}
          width={16}
          height={12}
          alt={option.name}
          loading="lazy"
          onError={() => setImgError(true)}
          className="rounded-[2px] object-cover shadow-[0_0_0_0.5px_rgba(0,0,0,0.1)]"
        />
      ) : (
        <span aria-hidden className="text-[10px] leading-none">🌐</span>
      )}
      {showCode && <span className="font-semibold tracking-wide">{alpha3}</span>}
    </span>
  );
}
