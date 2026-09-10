import { Printer } from 'lucide-react';
import { printConsultReport } from '@/lib/anthropometry/printReport';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

/** Botón Imprimir del informe antropométrico (misma salida PDF que SaaS). */
export default function ResultsPrintButton({ patient, measurement, className = '' }) {
  const { profile } = useAuth();

  const handlePrint = () => {
    try {
      const ok = printConsultReport({
        patient,
        measurement,
        brand: profile?.full_name || profile?.email || 'NutriGenius Lite',
      });
      if (!ok) {
        toast({
          title: 'No se pudo abrir la impresión',
          description: 'Revisa el bloqueo de ventanas emergentes e intenta de nuevo.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'No se pudo generar el reporte',
        description: error instanceof Error ? error.message : 'Error desconocido.',
        variant: 'destructive',
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      className={`ng-btn-primary ${className}`}
    >
      <Printer className="h-3.5 w-3.5" />
      Imprimir
    </button>
  );
}
