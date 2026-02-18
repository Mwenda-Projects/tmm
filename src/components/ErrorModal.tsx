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
import { AlertTriangle, XCircle, Info } from 'lucide-react';

type ModalVariant = 'error' | 'warning' | 'info';

interface ErrorModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  variant?: ModalVariant;
  /** Label for the primary action button — defaults to "OK" */
  actionLabel?: string;
  /** Optional secondary action (e.g. "Try Again") */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

const variantConfig: Record<ModalVariant, { icon: typeof XCircle; iconClass: string }> = {
  error: { icon: XCircle, iconClass: 'text-destructive' },
  warning: { icon: AlertTriangle, iconClass: 'text-amber-500' },
  info: { icon: Info, iconClass: 'text-primary' },
};

export function ErrorModal({
  open,
  onClose,
  title,
  description,
  variant = 'error',
  actionLabel = 'OK',
  secondaryAction,
}: ErrorModalProps) {
  const { icon: Icon, iconClass } = variantConfig[variant];

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon className={`h-5 w-5 ${iconClass}`} />
            </div>
            <AlertDialogTitle className="text-base">{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2 text-sm">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {secondaryAction && (
            <AlertDialogCancel onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </AlertDialogCancel>
          )}
          <AlertDialogAction onClick={onClose}>{actionLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
