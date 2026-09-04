import { useState } from 'react';
import { Task, Priority } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  doc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

interface Props {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReactivated?: () => void;
}

const ReactivateTaskDialog = ({ task, open, onOpenChange, onReactivated }: Props) => {
  const { users, currentUser } = useApp();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [deadline, setDeadline] = useState(task.deadline);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || currentUser?.id || '');
  const [saving, setSaving] = useState(false);

  const handleReactivate = async () => {
    if (!assigneeId) {
      toast.error('Selecione um responsável');
      return;
    }

    setSaving(true);

    try {
      const nowIso = new Date().toISOString();
      const history = Array.isArray(task.statusHistory) ? [...task.statusHistory] : [];

      if (history.length > 0 && !history[history.length - 1].exitedAt) {
        history[history.length - 1] = {
          ...history[history.length - 1],
          exitedAt: nowIso,
        };
      }

      history.push({
        status: 'todo',
        enteredAt: nowIso,
      });

      await updateDoc(doc(db, 'tasks', task.id), {
        title,
        description,
        priority,
        deadline,
        assignee_id: assigneeId,
        status: 'todo',
        status_history: history,
        updated_at: Timestamp.now(),
      });

      const target = users.find((u) => u.id === assigneeId);

      toast.success(`Tarefa reativada${target ? ` para ${target.name}` : ''}`);

      if (assigneeId !== currentUser?.id) {
        await addDoc(collection(db, 'notifications'), {
          user_id: assigneeId,
          message: `Tarefa reativada: ${title}`,
          type: 'task_created',
          read: false,
          created_at: Timestamp.now(),
        });
      }

      onReactivated?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao reativar tarefa:', error);
      toast.error('Erro ao reativar tarefa');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5" /> Reativar Tarefa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block">Título</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block">Descrição</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium mb-1 block">Prioridade</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">🔴 Alta</SelectItem>
                  <SelectItem value="medium">🟡 Média</SelectItem>
                  <SelectItem value="low">🟢 Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">Prazo</label>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block">Encaminhar para</label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um usuário" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>

            <Button onClick={handleReactivate} disabled={saving} className="gap-1.5">
              <RotateCcw className="w-4 h-4" />
              {saving ? 'Reativando...' : 'Reativar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReactivateTaskDialog;
