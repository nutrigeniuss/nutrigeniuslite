import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

type BackNavProps = {
  to?: string;
  onClick?: () => void;
  label?: string;
  className?: string;
};

/** Botón de retorno evidente (pill con fondo), para login, admin y catálogos. */
export default function BackNav({
  to,
  onClick,
  label = 'Volver',
  className = '',
}: BackNavProps) {
  const classes = `ng-back ${className}`.trim();

  if (to) {
    return (
      <Link to={to} className={classes}>
        <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2.4} />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2.4} />
      <span>{label}</span>
    </button>
  );
}
