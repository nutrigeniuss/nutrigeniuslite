import { ArrowLeft } from 'lucide-react';
import type { ReactNode, ButtonHTMLAttributes, MouseEvent } from 'react';

type BackLinkProps = {
  onClick?: () => void;
  label?: string;
  variant?: 'subtle' | 'icon' | string;
  className?: string;
  compact?: boolean;
};

/** Retorno evidente (pill) — bioquímica, dieta, etc. */
export default function BackLink({
  onClick,
  label = 'Volver',
  className = '',
  compact = false,
}: BackLinkProps) {
  if (!onClick) return null;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`ng-back touch-manipulation ${compact ? '!min-h-11 !px-3 !py-2.5' : ''} ${className}`.trim()}
    >
      <ArrowLeft className="pointer-events-none h-4 w-4 shrink-0" strokeWidth={2.4} />
      <span className="pointer-events-none">{label}</span>
    </button>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode };
export function Button({ children, className = '', ...rest }: BtnProps) {
  return (
    <button type="button" className={className} {...rest}>
      {children}
    </button>
  );
}
