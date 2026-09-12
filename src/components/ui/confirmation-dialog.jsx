import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  destructive = true,
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader className="text-left sm:text-left">
          <AlertDialogTitle className="ng-display text-lg font-semibold tracking-tight text-slate-900">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed text-slate-500">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel className="min-h-11 rounded-full border-slate-200">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={
              destructive
                ? 'min-h-11 rounded-full bg-rose-500 hover:bg-rose-600 focus:ring-rose-500'
                : 'min-h-11 rounded-full bg-brand-500 hover:bg-brand-600'
            }
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
