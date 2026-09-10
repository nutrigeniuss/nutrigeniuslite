import type { ReactNode, ButtonHTMLAttributes } from 'react';

type BackLinkProps = {
  onClick?: () => void;
  label?: string;
  variant?: 'subtle' | 'icon' | string;
  className?: string;
};

/** Stub ligero: en calc no hay historial de mediciones que volver. */
export default function BackLink({ onClick, label = 'Volver', className = '' }: BackLinkProps) {
  if (!onClick) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-sm font-semibold text-slate-400 hover:text-brand-500 ${className}`}
    >
      {label}
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
