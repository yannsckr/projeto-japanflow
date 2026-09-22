import { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export default function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  loading = false,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-2xl border-border/70 p-0 shadow-floating">
        <div className="border-b border-border/70 px-5 py-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span
                className={
                  destructive
                    ? 'flex h-8 w-8 items-center justify-center rounded-xl bg-destructive/10 text-destructive'
                    : 'flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary'
                }
              >
                <AlertTriangle className="h-4 w-4" />
              </span>
              {title}
            </DialogTitle>
            <DialogDescription className="pt-2 text-left text-sm leading-6">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>
        <DialogFooter className="gap-2 px-5 py-4 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => void onConfirm()}
            disabled={loading}
          >
            {loading ? 'Processando...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
