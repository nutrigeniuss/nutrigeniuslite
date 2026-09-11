import { ArrowLeft } from 'lucide-react';
import type { ReactNode, ButtonHTMLAttributes } from 'react';

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
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ng-back ${compact ? '!px-3 !py-2' : ''} ${className}`.trim()}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2.4} />
      <span>{label}</span>
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
