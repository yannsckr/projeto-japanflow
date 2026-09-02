import { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, PRIORITY_LABELS, STATUS_LABELS, Sector } from '@/types';
import { useApp } from '@/contexts/AppContext';
import {
  Calendar,
  MessageSquare,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Camera,
} from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { uploadImage } from '@/lib/uploadImage';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const ALL_COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'paused', 'done'];
const MOTOBOY_COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'done'];

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  showIdleAlert?: boolean;
}

const formatDuration = (ms: number) => {
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
};

const TaskCard = ({ task, onClick, showIdleAlert }: TaskCardProps) => {
  const { users, getTaskMessages, currentUser, updateTaskStatus } = useApp();
  const assignee = users.find((u) => u.id === task.assigneeId);
  const creator = users.find((u) => u.id === task.createdBy);
  const hasEnderecoDiferente =
    (task.title || '').includes('ENDEREÇO DIFERENTE') ||
    (task.description || '').includes('ENDERECO_DIFERENTE') ||
    (task.description || '').includes('ENDEREÇO DE ENVIO DIFERENTE');
  const isMotoboySector = task.sector === 'motoboys';
  const userIsMotoboy =
    currentUser?.sectors?.includes('motoboys' as Sector) && currentUser?.role !== 'admin';
  const COLUMNS = isMotoboySector && userIsMotoboy ? MOTOBOY_COLUMNS : ALL_COLUMNS;
  const colIndex = COLUMNS.indexOf(task.status);
  const canGoLeft = colIndex > 0;
  const canGoRight = colIndex < COLUMNS.length - 1;

  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMotoboyComplete = async (file: File, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setUploading(true);
    try {
      const { publicUrl } = await uploadImage(file, {
        pathPrefix: 'receipts',
        sourceTable: 'receipts',
        sourceField: 'photo_url',
        uploadedBy: task.assigneeId,
      });
      // Update the task with the receipt image and mark as done
      await supabase
        .from('tasks')
        .update({
          image_url: publicUrl,
          status: 'done',
          updated_at: new Date().toISOString(),
          status_history: [
            ...(task.statusHistory || []),
            { status: 'done', enteredAt: new Date().toISOString() },
          ] as any,
        })
        .eq('id', task.id);
      // Also complete matching motoboy_assignment via task_id link
      const { data: directMatch } = await supabase
        .from('motoboy_assignments')
        .select('id')
        .eq('task_id', task.id)
        .neq('status', 'completed')
        .limit(1);
      if (directMatch && directMatch.length > 0) {
        await supabase
          .from('motoboy_assignments')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', directMatch[0].id);
      } else {
        // Fallback for legacy assignments
        const { data: assignments } = await supabase
          .from('motoboy_assignments')
          .select('*')
          .eq('assigned_to', task.assigneeId)
          .eq('status', 'accepted')
          .order('created_at', { ascending: false });
        if (assignments && assignments.length > 0) {
          const match = assignments.find(
            (a) => task.title.includes(a.client_name || '') || task.title.includes(a.description)
          );
          if (match) {
            await supabase
              .from('motoboy_assignments')
              .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', match.id);
          }
        }
      }
      toast.success('Corrida concluída com foto do cupom!');
      setShowCameraDialog(false);
    } catch (err) {
      toast.error('Erro ao enviar foto');
    } finally {
      setUploading(false);
    }
  };

  const moveTask = (dir: -1 | 1, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = COLUMNS[colIndex + dir];
    if (!newStatus) return;
    // If motoboy task moving to 'done', require camera photo
    if (isMotoboySector && userIsMotoboy && newStatus === 'done') {
      setShowCameraDialog(true);
      return;
    }
    updateTaskStatus(task.id, newStatus);
  };
  const commentCount = getTaskMessages(task.id).length;
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'done';

  const currentEntry = task.statusHistory?.[task.statusHistory.length - 1];
  const currentStageMs = currentEntry ? Date.now() - new Date(currentEntry.enteredAt).getTime() : 0;

  const isIdle = task.status !== 'done' && currentStageMs > 20 * 60000;
  const isAdmin = currentUser?.role === 'admin';

  const isDone = task.status === 'done';

  if (isDone) {
    return (
      <>
        <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          onClick={onClick}
          className={cn(
            'rounded-md px-3 py-1.5 border-2 cursor-pointer transition-all hover:bg-accent/50 opacity-70',
            task.priority === 'high' && 'border-red-500',
            task.priority === 'medium' && 'border-yellow-500',
            task.priority === 'low' && 'border-green-500',
            isDragging && 'opacity-30'
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-success">✓</span>
              <h4 className="text-xs text-muted-foreground truncate">{task.title}</h4>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-muted-foreground">
                {new Date(task.deadline).toLocaleDateString('pt-BR')}
              </span>
              {assignee && (
                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                  {assignee.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={onClick}
        className={cn(
          'rounded-lg p-3.5 shadow-sm border-2 cursor-grab active:cursor-grabbing transition-all hover:shadow-md',
          task.priority === 'high' && 'border-red-500',
          task.priority === 'medium' && 'border-yellow-500',
          task.priority === 'low' && 'border-green-500',
          `priority-bg-${task.priority}`,
          isDragging && 'opacity-50 shadow-lg rotate-2',
          isIdle && isAdmin && 'ring-2 ring-destructive/50',
          hasEnderecoDiferente &&
            'border-red-600 ring-4 ring-red-500/60 bg-red-500/10 animate-pulse'
        )}
      >
        {hasEnderecoDiferente && (
          <div className="mb-2 -mx-1 rounded bg-red-600 text-white text-[10px] font-extrabold uppercase tracking-wide px-2 py-1 text-center shadow">
            🚨 Endereço de envio diferente do cadastro 🚨
          </div>
        )}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-sm font-semibold text-card-foreground leading-tight">{task.title}</h4>
          <span
            className={cn(
              'shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
              `priority-badge-${task.priority}`
            )}
          >
            {PRIORITY_LABELS[task.priority]}
          </span>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2 mb-1">{task.description}</p>

        {creator && (
          <p className="text-[10px] text-muted-foreground/70 mb-2 italic">
            Criada por {creator.name}
          </p>
        )}

        {task.response && (
          <div className="mb-2 px-2 py-1 rounded bg-accent/50 border border-border/50">
            <p className="text-[10px] font-medium text-muted-foreground">Resposta:</p>
            <p className="text-xs text-foreground line-clamp-2">{task.response}</p>
          </div>
        )}

        {/* Task image thumbnails */}
        {(() => {
          const allImages =
            task.imageUrls && task.imageUrls.length > 0
              ? task.imageUrls
              : task.imageUrl
                ? [task.imageUrl]
                : [];
          return (
            allImages.length > 0 && (
              <div className="mb-3 flex gap-1 overflow-x-auto">
                {allImages.slice(0, 3).map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`Imagem ${idx + 1}`}
                    className="h-16 w-16 object-cover rounded-md border border-border shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                ))}
                {allImages.length > 3 && (
                  <div className="h-16 w-16 rounded-md border border-border bg-muted flex items-center justify-center text-xs text-muted-foreground shrink-0">
                    +{allImages.length - 3}
                  </div>
                )}
              </div>
            )
          );
        })()}

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span className={isOverdue ? 'text-destructive font-semibold' : ''}>
                {new Date(task.deadline).toLocaleDateString('pt-BR')}
              </span>
            </div>
            {task.status !== 'done' && (
              <div
                className={cn(
                  'flex items-center gap-1',
                  isIdle && isAdmin && 'text-destructive font-semibold'
                )}
              >
                <Clock className="w-3 h-3" />
                <span>{formatDuration(currentStageMs)}</span>
                {isIdle && isAdmin && <AlertTriangle className="w-3 h-3 animate-pulse" />}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {((task.imageUrls && task.imageUrls.length > 0) || task.imageUrl) && (
              <div className="flex items-center gap-1">
                <ImageIcon className="w-3 h-3 text-primary" />
                {(task.imageUrls?.length || 1) > 1 && (
                  <span className="text-[10px]">{task.imageUrls?.length}</span>
                )}
              </div>
            )}
            {commentCount > 0 && (
              <div className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                <span>{commentCount}</span>
              </div>
            )}
            {assignee && (
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                {assignee.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>
            )}
          </div>
        </div>

        {/* Mobile navigation arrows */}
        <div className="flex md:hidden items-center justify-between mt-3 pt-2 border-t border-border/50">
          <button
            onClick={(e) => moveTask(-1, e)}
            disabled={!canGoLeft}
            className={cn(
              'flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md transition-colors',
              canGoLeft
                ? 'text-primary bg-primary/10 active:bg-primary/20'
                : 'text-muted-foreground/30 cursor-not-allowed'
            )}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {canGoLeft && STATUS_LABELS[COLUMNS[colIndex - 1]]}
          </button>
          <span className="text-[10px] font-semibold text-muted-foreground">
            {STATUS_LABELS[task.status]}
          </span>
          <button
            onClick={(e) => moveTask(1, e)}
            disabled={!canGoRight}
            className={cn(
              'flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md transition-colors',
              canGoRight
                ? 'text-primary bg-primary/10 active:bg-primary/20'
                : 'text-muted-foreground/30 cursor-not-allowed'
            )}
          >
            {canGoRight && STATUS_LABELS[COLUMNS[colIndex + 1]]}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Camera dialog for motoboy completion */}
      <Dialog open={showCameraDialog} onOpenChange={setShowCameraDialog}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" /> Foto do Cupom Assinado
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tire uma foto ou envie a imagem do cupom assinado para concluir a corrida.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleMotoboyComplete(file);
            }}
          />
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full"
            >
              <Camera className="w-4 h-4 mr-2" />
              {uploading ? 'Enviando...' : 'Abrir Câmera / Selecionar Foto'}
            </Button>
            <Button variant="ghost" onClick={() => setShowCameraDialog(false)} disabled={uploading}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TaskCard;
