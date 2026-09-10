import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, onOpenChange: _ignoredOnOpenChange, ...props }) {
        const isDestructive = variant === "destructive";
        const Icon = isDestructive ? AlertTriangle : CheckCircle2;
        // Franja de acento a la izquierda + chip del ícono, con el color de la variante.
        const accent = isDestructive ? "bg-coral-500" : "bg-emerald-500";
        const iconChip = isDestructive ? "bg-red-50 text-coral-700" : "bg-emerald-50 text-emerald-500";
        return (
          <Toast key={id} variant={variant} {...props}>
            <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${accent}`} />
            <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${iconChip}`}>
              <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
            </span>
            <div className="grid min-w-0 flex-1 gap-0">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
} 