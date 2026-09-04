import { useState, useRef, useCallback, useEffect } from 'react';
import { Task, PRIORITY_LABELS, STATUS_LABELS, Priority, TaskStatus } from '@/types';
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
import {
  Calendar,
  Clock,
  User,
  Send,
  Trash2,
  Pencil,
  Save,
  X,
  ImagePlus,
  ZoomIn,
  Reply,
  Paperclip,
  Forward,
  Printer,
  ArrowRightLeft,
  FileText,
  ThumbsUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { uploadImage } from '@/lib/uploadImage';
import { sendPushToUser } from '@/hooks/usePushNotifications';
import { useFeaturePermissions } from '@/hooks/useFeaturePermissions';

interface TaskDetailDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatDuration = (ms: number) => {
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h ${mins % 60}m`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
};

const TaskDetailDialog = ({ task, open, onOpenChange }: TaskDetailDialogProps) => {
  const { currentUser, users, updateTask, deleteTask, updateTaskStatus, updateTaskPriority } =
    useApp();
  const { hasFeature } = useFeaturePermissions();
  const [newComment, setNewComment] = useState('');
  const [responseText, setResponseText] = useState(task.response || '');
  const [showResponseInput, setShowResponseInput] = useState(false);
  const [localResponse, setLocalResponse] = useState(task.response || '');
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDesc, setEditDesc] = useState(task.description);
  const [editPriority, setEditPriority] = useState<Priority>(task.priority);
  const [editDeadline, setEditDeadline] = useState(task.deadline);
  const [editStatus, setEditStatus] = useState<TaskStatus>(task.status);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [nfUploading, setNfUploading] = useState(false);
  const nfFileRef = useRef<HTMLInputElement>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTarget, setTransferTarget] = useState<string>('');

  const [dbComments, setDbComments] = useState<
    { id: string; user_id: string; content: string; created_at: string }[]
  >([]);
  const [responsePastedImages, setResponsePastedImages] = useState<File[]>([]);
  const [responseAttachedFiles, setResponseAttachedFiles] = useState<File[]>([]);
  const [commentPastedImages, setCommentPastedImages] = useState<File[]>([]);
  const responseFileRef = useRef<HTMLInputElement>(null);

  // Response attachments + likes state (loaded from DB)
  const [responseAttachments, setResponseAttachments] = useState<string[]>([]);
  const [responseLikes, setResponseLikes] = useState<string[]>([]);

  const handleResponsePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) setResponsePastedImages((prev) => [...prev, file]);
        break;
      }
    }
  }, []);

  const handleCommentPaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) setCommentPastedImages((prev) => [...prev, file]);
        break;
      }
    }
  }, []);

  const assignee = users.find((u) => u.id === task.assigneeId);
  const creator = users.find((u) => u.id === task.createdBy);

  // Comentários e extras da tarefa em tempo real via Firestore
  useEffect(() => {
    if (!open) return;

    const commentsQuery = query(
      collection(db, 'task_comments'),
      where('task_id', '==', task.id)
    );

    const unsubscribeComments = onSnapshot(
      commentsQuery,
      (snapshot) => {
        const comments = snapshot.docs
          .map((commentDoc) => {
            const data = commentDoc.data();
            const createdAt =
              data.created_at?.toDate?.().toISOString?.() ||
              (typeof data.created_at === 'string' ? data.created_at : '');

            return {
              id: commentDoc.id,
              user_id: data.user_id || '',
              content: data.content || '',
              created_at: createdAt,
            };
          })
          .sort(
            (a, b) =>
              new Date(a.created_at || 0).getTime() -
              new Date(b.created_at || 0).getTime()
          );

        setDbComments(comments);
      },
      (error) => {
        console.error('Erro ao acompanhar comentários da tarefa:', error);
      }
    );

    const taskRef = doc(db, 'tasks', task.id);

    const unsubscribeTask = onSnapshot(
      taskRef,
      (snapshot) => {
        if (!snapshot.exists()) return;

        const data = snapshot.data();

        setResponseAttachments(
          Array.isArray(data.response_attachments) ? data.response_attachments : []
        );
        setResponseLikes(Array.isArray(data.response_likes) ? data.response_likes : []);

        if (typeof data.response === 'string' || data.response === null) {
          setLocalResponse(data.response || '');
        }
      },
      (error) => {
        console.error('Erro ao acompanhar extras da tarefa:', error);
      }
    );

    return () => {
      unsubscribeComments();
      unsubscribeTask();
    };
  }, [open, task.id]);
  const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'done';
  const isAdmin = currentUser?.role === 'admin';
  const isAssignee = currentUser?.id === task.assigneeId;
  const isCreator = currentUser?.id === task.createdBy;
  const canRespond = isAssignee || isAdmin;
  const canDelete = isAdmin || isCreator;
  const canTransfer = isAdmin || hasFeature(currentUser?.id, 'transfer_tasks');

  // Financial sector task from separação detection
  const isFinancialSeparacao =
    task.sector === 'financeiro' &&
    (task.title.includes('NF') ||
      task.title.includes('Boleto') ||
      task.description?.includes('Separação'));
  const isFinancialUser = currentUser?.sectors?.includes('financeiro' as any) || isAdmin;
  const isPatricia = currentUser?.id === 'emp-1';

  const isPdfUrl = (url: string) => url.toLowerCase().endsWith('.pdf') || url.includes('.pdf');

  // Image editing state
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Máximo 5MB');
      return;
    }
    setEditImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setEditImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleEditPaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) handleImageSelect(file);
        break;
      }
    }
  }, []);

  const handleSendComment = async () => {
    if ((!newComment.trim() && commentPastedImages.length === 0) || !currentUser) return;
    let content = newComment.trim();

    // Upload pasted images and add URLs to comment
    if (commentPastedImages.length > 0) {
      const urls: string[] = [];
      for (const file of commentPastedImages) {
        try {
          const { publicUrl } = await uploadImage(file, {
            pathPrefix: `tasks/${task.id}/comments`,
            sourceTable: 'task_comments',
            sourceId: task.id,
            uploadedBy: currentUser?.id,
          });
          urls.push(publicUrl);
        } catch {}
      }
      if (urls.length > 0) {
        const imgTags = urls.map((u) => `[imagem](${u})`).join(' ');
        content = content ? `${content}\n${imgTags}` : imgTags;
      }
      setCommentPastedImages([]);
    }

    setNewComment('');
    await addDoc(collection(db, 'task_comments'), {
      task_id: task.id,
      user_id: currentUser.id,
      content,
      created_at: Timestamp.now(),
    });
  };

  const handleSaveEdit = async () => {
    let imageUrl = task.imageUrl;

    if (editImageFile) {
      try {
        const { publicUrl } = await uploadImage(editImageFile, {
          pathPrefix: 'tasks',
          sourceTable: 'tasks',
          sourceId: task.id,
          sourceField: 'image_url',
          uploadedBy: currentUser?.id,
        });
        imageUrl = publicUrl;
      } catch {}
    }

    // Atualiza a imagem diretamente no Firestore
    if (imageUrl !== task.imageUrl) {
      await updateDoc(doc(db, 'tasks', task.id), {
        image_url: imageUrl || null,
        updated_at: Timestamp.now(),
      });
    }

    updateTask(task.id, {
      title: editTitle,
      description: editDesc,
      priority: editPriority,
      deadline: editDeadline,
    });
    if (editStatus !== task.status) updateTaskStatus(task.id, editStatus);
    if (editPriority !== task.priority) updateTaskPriority(task.id, editPriority);
    setEditing(false);
    setEditImageFile(null);
    setEditImagePreview(null);
    toast.success('Tarefa atualizada');
  };

  const handleDelete = () => {
    deleteTask(task.id);
    onOpenChange(false);
    toast.success('Tarefa excluída');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div
                className={cn('w-1 h-8 rounded-full shrink-0', {
                  'bg-priority-high': task.priority === 'high',
                  'bg-priority-medium': task.priority === 'medium',
                  'bg-priority-low': task.priority === 'low',
                })}
              />
              <div className="flex-1">
                <DialogTitle className="text-lg">{task.title}</DialogTitle>
                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className={cn(
                      'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
                      `priority-badge-${task.priority}`
                    )}
                  >
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                  <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-secondary">
                    {STATUS_LABELS[task.status]}
                  </span>
                </div>
              </div>
              {(isAdmin || isCreator) && (
                <div className="flex gap-1">
                  {(isAdmin || isCreator) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditing(!editing);
                        setEditTitle(task.title);
                        setEditDesc(task.description);
                        setEditPriority(task.priority);
                        setEditDeadline(task.deadline);
                        setEditStatus(task.status);
                        setEditImageFile(null);
                        setEditImagePreview(null);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={handleDelete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </DialogHeader>

          {editing && (isAdmin || isCreator) ? (
            <div className="space-y-3 mt-2" onPaste={handleEditPaste}>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Título"
              />
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Descrição"
                rows={3}
              />
              <div className="grid grid-cols-2 gap-3">
                <Select value={editPriority} onValueChange={(v) => setEditPriority(v as Priority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">🔴 Alta</SelectItem>
                    <SelectItem value="medium">🟡 Média</SelectItem>
                    <SelectItem value="low">🟢 Baixa</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as TaskStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                type="date"
                value={editDeadline}
                onChange={(e) => setEditDeadline(e.target.value)}
              />

              {/* Image edit */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Imagem</label>
                {editImagePreview || task.imageUrl ? (
                  <div className="relative inline-block">
                    <img
                      src={editImagePreview || task.imageUrl}
                      alt="Preview"
                      className="max-h-32 rounded-lg border border-border"
                    />
                    <button
                      onClick={() => {
                        setEditImageFile(null);
                        setEditImagePreview(null);
                      }}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => editFileRef.current?.click()}
                    >
                      <ImagePlus className="w-4 h-4" /> Adicionar Imagem
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">Ou cole (Ctrl+V)</p>
                    <input
                      ref={editFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleImageSelect(e.target.files[0]);
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit}>
                  <Save className="w-3 h-3 mr-1" />
                  Salvar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  <X className="w-3 h-3 mr-1" />
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                {task.description}
              </p>

              {/* Creator info */}
              {creator && (
                <div className="mt-2 text-xs text-muted-foreground italic">
                  Criada por <span className="font-medium text-foreground">{creator.name}</span>
                </div>
              )}

              {/* Response section */}
              {(localResponse || responseAttachments.length > 0) && !showResponseInput && (
                <div className="mt-3 p-3 rounded-lg bg-accent/50 border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <Reply className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-semibold text-primary">Resposta</span>
                    </div>
                    {canRespond && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs gap-1"
                        onClick={() => {
                          setResponseText(localResponse);
                          setShowResponseInput(true);
                        }}
                      >
                        <Pencil className="w-3 h-3" /> Editar
                      </Button>
                    )}
                  </div>
                  {localResponse && (
                    <p className="text-sm text-foreground whitespace-pre-wrap">{localResponse}</p>
                  )}

                  {/* Response attachments (images + PDFs) */}
                  {responseAttachments.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {responseAttachments.map((url, idx) =>
                        isPdfUrl(url) ? (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 rounded-lg border border-border bg-background/60 hover:bg-background transition-colors"
                          >
                            <FileText className="w-7 h-7 text-red-500 shrink-0" />
                            <span className="text-xs font-medium truncate">PDF {idx + 1}</span>
                          </a>
                        ) : (
                          <div
                            key={idx}
                            className="relative group cursor-pointer"
                            onClick={() => setZoomedImage(url)}
                          >
                            <img
                              src={url}
                              alt={`Anexo ${idx + 1}`}
                              className="w-full h-28 object-cover rounded-lg border border-border"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
                              <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* Like reaction */}
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        currentUser && responseLikes.includes(currentUser.id)
                          ? 'default'
                          : 'outline'
                      }
                      className="h-7 px-2 gap-1.5 text-xs"
                      onClick={async () => {
                        if (!currentUser) return;
                        const already = responseLikes.includes(currentUser.id);
                        const next = already
                          ? responseLikes.filter((id) => id !== currentUser.id)
                          : [...responseLikes, currentUser.id];
                        setResponseLikes(next);
                        await updateDoc(doc(db, 'tasks', task.id), {
                          response_likes: next,
                          updated_at: Timestamp.now(),
                        });
                        if (!already && task.assigneeId && task.assigneeId !== currentUser.id) {
                          await addDoc(collection(db, 'notifications'), {
                            user_id: task.assigneeId,
                            message: `${currentUser.name} curtiu sua resposta na tarefa "${task.title}"`,
                            type: 'task_created',
                            read: false,
                            created_at: Timestamp.now(),
                          });
                        }
                      }}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" /> Like{' '}
                      {responseLikes.length > 0 && `(${responseLikes.length})`}
                    </Button>
                    {responseLikes.length > 0 && (
                      <span className="text-[11px] text-muted-foreground truncate">
                        {responseLikes
                          .map((id) => users.find((u) => u.id === id)?.name)
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {canRespond && !showResponseInput && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-1.5"
                  onClick={() => {
                    setResponseText('');
                    setShowResponseInput(true);
                  }}
                >
                  <Reply className="w-3.5 h-3.5" />{' '}
                  {localResponse || responseAttachments.length > 0
                    ? 'Responder Novamente'
                    : 'Responder Tarefa'}
                </Button>
              )}

              {showResponseInput && (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    onPaste={handleResponsePaste}
                    placeholder="Escreva sua resposta... (Cole imagens com Ctrl+V ou anexe PDF/Imagem)"
                    rows={3}
                    className="text-sm"
                  />

                  {/* Pasted/attached files preview */}
                  {(responsePastedImages.length > 0 || responseAttachedFiles.length > 0) && (
                    <div className="flex gap-2 flex-wrap">
                      {responsePastedImages.map((img, idx) => (
                        <div key={`p-${idx}`} className="relative group">
                          <img
                            src={URL.createObjectURL(img)}
                            alt={`Colada ${idx + 1}`}
                            className="w-16 h-16 object-cover rounded-lg border border-border"
                          />
                          <button
                            onClick={() =>
                              setResponsePastedImages((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {responseAttachedFiles.map((f, idx) => (
                        <div key={`f-${idx}`} className="relative group">
                          {f.type.startsWith('image/') ? (
                            <img
                              src={URL.createObjectURL(f)}
                              alt={f.name}
                              className="w-16 h-16 object-cover rounded-lg border border-border"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg border border-border bg-accent/40 flex flex-col items-center justify-center p-1">
                              <FileText className="w-6 h-6 text-red-500" />
                              <span className="text-[9px] truncate w-full text-center">
                                {f.name}
                              </span>
                            </div>
                          )}
                          <button
                            onClick={() =>
                              setResponseAttachedFiles((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <input
                    ref={responseFileRef}
                    type="file"
                    accept="image/*,application/pdf,.pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (!files) return;
                      const arr = Array.from(files).filter((f) => {
                        if (f.size > 10 * 1024 * 1024) {
                          toast.error(`${f.name}: máximo 10MB`);
                          return false;
                        }
                        return true;
                      });
                      setResponseAttachedFiles((prev) => [...prev, ...arr]);
                      e.target.value = '';
                    }}
                  />

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => responseFileRef.current?.click()}
                    >
                      <Paperclip className="w-3.5 h-3.5" /> Anexar PDF/Imagem
                    </Button>
                    <Button
                      size="sm"
                      disabled={
                        !responseText.trim() &&
                        responsePastedImages.length === 0 &&
                        responseAttachedFiles.length === 0
                      }
                      onClick={async () => {
                        const trimmed = responseText.trim();
                        const newAttachments = [...responseAttachments];

                        // Upload pasted images
                        for (const file of responsePastedImages) {
                          try {
                            const { publicUrl } = await uploadImage(file, {
                              pathPrefix: `tasks/${task.id}/response`,
                              sourceTable: 'tasks',
                              sourceId: task.id,
                              sourceField: 'response_attachments',
                              uploadedBy: currentUser?.id,
                            });
                            newAttachments.push(publicUrl);
                          } catch {}
                        }
                        // Upload attached files (PDF/images)
                        for (const file of responseAttachedFiles) {
                          try {
                            const { publicUrl } = await uploadImage(file, {
                              pathPrefix: `tasks/${task.id}/response`,
                              sourceTable: 'tasks',
                              sourceId: task.id,
                              sourceField: 'response_attachments',
                              uploadedBy: currentUser?.id,
                            });
                            newAttachments.push(publicUrl);
                          } catch {}
                        }

                        // Append new text to existing response with author/timestamp separator
                        let finalResponse = localResponse || '';
                        if (trimmed) {
                          const stamp = new Date().toLocaleString('pt-BR');
                          const header = `[${currentUser?.name || 'Usuário'} • ${stamp}]`;
                          finalResponse = finalResponse
                            ? `${finalResponse}\n\n---\n${header}\n${trimmed}`
                            : `${header}\n${trimmed}`;
                        }

                        // Ping-pong: return task to whoever previously interacted with it
                        // (or to the creator on the first response). Track current assignee
                        // as the new "previous" so the next response bounces back here.
                        const currentSnapshot = await getDoc(doc(db, 'tasks', task.id));
                        const currentRow = currentSnapshot.exists() ? currentSnapshot.data() : null;

                        const prevAssignee =
                          currentRow?.previous_assignee_id ||
                          currentRow?.created_by ||
                          task.createdBy;
                        const currentAssignee =
                          currentRow?.assignee_id || task.assigneeId;
                        const targetUser = prevAssignee;
                        const shouldTransfer =
                          !!targetUser && currentUser?.id !== targetUser;
                        const updatePayload: any = {
                          response_attachments: newAttachments,
                          response: finalResponse || null,
                          updated_at: Timestamp.now(),
                        };
                        if (shouldTransfer) {
                          updatePayload.assignee_id = targetUser;
                          updatePayload.previous_assignee_id = currentAssignee;
                          updatePayload.status = 'todo';
                        }

                        await updateDoc(doc(db, 'tasks', task.id), updatePayload);
                        setResponseAttachments(newAttachments);
                        setLocalResponse(finalResponse);
                        setResponsePastedImages([]);
                        setResponseAttachedFiles([]);
                        setShowResponseInput(false);
                        toast.success(
                          shouldTransfer
                            ? 'Resposta enviada e tarefa devolvida ao usuário anterior'
                            : 'Resposta enviada'
                        );

                        if (shouldTransfer && targetUser && currentUser) {
                          await addDoc(collection(db, 'notifications'), {
                            user_id: targetUser,
                            message: `${currentUser.name} respondeu à tarefa "${task.title}" — verifique a resposta`,
                            type: 'task_created',
                            read: false,
                            created_at: Timestamp.now(),
                          });
                          await sendPushToUser(
                            targetUser,
                            'Tarefa respondida',
                            `${currentUser.name} respondeu à tarefa "${task.title}"`
                          );
                        }
                      }}
                    >
                      <Send className="w-3 h-3 mr-1" /> Enviar Resposta
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowResponseInput(false);
                        setResponsePastedImages([]);
                        setResponseAttachedFiles([]);
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {/* Task attachments (images + PDFs) with zoom */}
              {(() => {
                const allFiles =
                  task.imageUrls && task.imageUrls.length > 0
                    ? task.imageUrls
                    : task.imageUrl
                      ? [task.imageUrl]
                      : [];
                return (
                  allFiles.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {allFiles.map((url, idx) =>
                        isPdfUrl(url) ? (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-3 rounded-lg border border-border bg-accent/30 hover:bg-accent/50 transition-colors"
                          >
                            <FileText className="w-8 h-8 text-red-500 shrink-0" />
                            <span className="text-xs font-medium truncate">PDF {idx + 1}</span>
                          </a>
                        ) : (
                          <div
                            key={idx}
                            className="relative group cursor-pointer"
                            onClick={() => setZoomedImage(url)}
                          >
                            <img
                              src={url}
                              alt={`Imagem ${idx + 1}`}
                              className="w-full h-32 object-cover rounded-lg border border-border"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
                              <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )
                );
              })()}

              {/* Financial: Attach NF/Boleto + Forward to Patrícia */}
              {isFinancialSeparacao && isFinancialUser && !isPatricia && (
                <div className="mt-3 p-3 rounded-lg bg-accent/30 border border-border space-y-2">
                  <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5" /> Anexar NF / Boleto
                  </p>
                  <input
                    ref={nfFileRef}
                    type="file"
                    accept="image/*,application/pdf,.pdf"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (!files || files.length === 0) return;
                      setNfUploading(true);
                      try {
                        const currentUrls: string[] = Array.isArray(task.imageUrls)
                          ? [...task.imageUrls]
                          : task.imageUrl
                            ? [task.imageUrl]
                            : [];
                        for (const file of Array.from(files)) {
                          try {
                            const { publicUrl } = await uploadImage(file, {
                              pathPrefix: 'tasks',
                              sourceTable: 'tasks',
                              sourceId: task.id,
                              sourceField: 'image_urls',
                              uploadedBy: currentUser?.id,
                            });
                            currentUrls.push(publicUrl);
                          } catch {
                            toast.error(`Erro ao enviar ${file.name}`);
                          }
                        }
                        await updateDoc(doc(db, 'tasks', task.id), {
                          image_urls: currentUrls,
                          image_url: currentUrls[0] || null,
                          updated_at: Timestamp.now(),
                        });
                        toast.success('Arquivo(s) anexado(s) com sucesso!');
                      } catch (err) {
                        toast.error('Erro ao anexar arquivo');
                      } finally {
                        setNfUploading(false);
                      }
                    }}
                  />
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => nfFileRef.current?.click()}
                      disabled={nfUploading}
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      {nfUploading ? 'Enviando...' : 'Anexar Arquivo'}
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      className="gap-1.5"
                      onClick={async () => {
                        // Busca os anexos mais recentes diretamente no Firestore
                        const freshTaskSnapshot = await getDoc(doc(db, 'tasks', task.id));
                        const freshTask = freshTaskSnapshot.exists()
                          ? freshTaskSnapshot.data()
                          : null;
                        const freshImageUrls = freshTask
                          ? Array.isArray(freshTask.image_urls)
                            ? (freshTask.image_urls as string[])
                            : []
                          : [];
                        const freshImageUrl = freshTask?.image_url || null;
                        const allImages =
                          freshImageUrls.length > 0
                            ? freshImageUrls
                            : freshImageUrl
                              ? [freshImageUrl]
                              : [];
                        if (allImages.length === 0) {
                          toast.error(
                            'Nenhum arquivo anexado. Anexe os documentos antes de encaminhar.'
                          );
                          return;
                        }
                        await addDoc(collection(db, 'tasks'), {
                          title: `📄 ${task.title}`,
                          description: `Encaminhado do Financeiro.\n\n${task.description}`,
                          status: 'todo',
                          priority: task.priority,
                          assignee_id: 'emp-1',
                          created_by: currentUser?.id || '',
                          deadline: task.deadline,
                          sector: null,
                          image_url: allImages[0] || null,
                          image_urls: allImages,
                          status_history: [
                            { status: 'todo', enteredAt: new Date().toISOString() },
                          ],
                          created_at: Timestamp.now(),
                          updated_at: Timestamp.now(),
                        });
                        await addDoc(collection(db, 'notifications'), {
                          user_id: 'emp-1',
                          message: `Tarefa "${task.title}" encaminhada do Financeiro para impressão`,
                          type: 'task_created',
                          read: false,
                          created_at: Timestamp.now(),
                        });
                        await sendPushToUser(
                          'emp-1',
                          'Nova tarefa encaminhada',
                          `${task.title} - Para impressão`
                        );
                        toast.success('Tarefa encaminhada para Patrícia!');
                      }}
                    >
                      <Forward className="w-3.5 h-3.5" />
                      Encaminhar p/ Patrícia
                    </Button>
                  </div>
                </div>
              )}

              {/* Print button for Patrícia */}
              {isPatricia &&
                (() => {
                  const allFiles =
                    task.imageUrls && task.imageUrls.length > 0
                      ? task.imageUrls
                      : task.imageUrl
                        ? [task.imageUrl]
                        : [];
                  return (
                    allFiles.length > 0 && (
                      <div className="mt-3 flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => {
                            const images = allFiles.filter((u) => !isPdfUrl(u));
                            if (images.length === 0) {
                              toast.info(
                                'Nenhuma imagem para imprimir. PDFs serão abertos separadamente.'
                              );
                            }
                            if (images.length > 0) {
                              const printWindow = window.open('', '_blank');
                              if (!printWindow) {
                                toast.error('Popup bloqueado');
                                return;
                              }
                              const htmlContent = [
                                '<html><head><title>Imprimir - ' + task.title + '</title>',
                                '<style>body{margin:0;padding:20px;font-family:sans-serif}img{max-width:100%;page-break-inside:avoid;margin-bottom:20px}@media print{body{padding:0}}</style>',
                                '</head><body>',
                                '<h2>' + task.title + '</h2>',
                                '<p>' + (task.description?.replace(/\n/g, '<br>') || '') + '</p>',
                                ...images.map((url) => '<img src="' + url + '" />'),
                                '</body></html>',
                              ].join('');
                              printWindow.document.write(htmlContent);
                              printWindow.document.close();
                              printWindow.onload = () => {
                                printWindow.print();
                              };
                            }
                            // Open PDFs in new tabs
                            allFiles
                              .filter((u) => isPdfUrl(u))
                              .forEach((url) => window.open(url, '_blank'));
                          }}
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Imprimir Anexos
                        </Button>
                      </div>
                    )
                  );
                })()}

              {/* Transfer task to another user (admins + users with permission) */}
              {canTransfer && (
                <div className="mt-3">
                  {!showTransfer ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => setShowTransfer(true)}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      Transferir Tarefa
                    </Button>
                  ) : (
                    <div className="p-3 rounded-lg bg-accent/30 border border-border space-y-2">
                      <p className="text-xs font-semibold flex items-center gap-1.5">
                        <ArrowRightLeft className="w-3.5 h-3.5 text-primary" /> Transferir para:
                      </p>
                      <Select value={transferTarget} onValueChange={setTransferTarget}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Selecione o usuário" />
                        </SelectTrigger>
                        <SelectContent>
                          {users
                            .filter((u) => u.id !== task.assigneeId)
                            .map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={!transferTarget}
                          onClick={async () => {
                            await updateDoc(doc(db, 'tasks', task.id), {
                              assignee_id: transferTarget,
                              updated_at: Timestamp.now(),
                            });
                            const targetUser = users.find((u) => u.id === transferTarget);
                            await addDoc(collection(db, 'notifications'), {
                              user_id: transferTarget,
                              message: `Tarefa "${task.title}" foi transferida para você por ${currentUser?.name}`,
                              type: 'task_created',
                              read: false,
                              created_at: Timestamp.now(),
                            });
                            await sendPushToUser(
                              transferTarget,
                              'Tarefa transferida',
                              `"${task.title}" foi transferida para você`
                            );
                            toast.success(`Tarefa transferida para ${targetUser?.name}`);
                            setShowTransfer(false);
                            setTransferTarget('');
                          }}
                        >
                          <ArrowRightLeft className="w-3 h-3 mr-1" /> Transferir
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setShowTransfer(false);
                            setTransferTarget('');
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span>{assignee?.name || 'Não atribuído'}</span>
                </div>
                <div
                  className={cn(
                    'flex items-center gap-2',
                    isOverdue ? 'text-destructive' : 'text-muted-foreground'
                  )}
                >
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(task.deadline).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Criada {new Date(task.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>

              {/* Stage Timer History */}
              {task.statusHistory && task.statusHistory.length > 0 && (
                <div className="mt-4 border-t border-border pt-4">
                  <h4 className="text-sm font-semibold mb-2">Tempo por Etapa</h4>
                  <div className="space-y-1.5">
                    {task.statusHistory.map((entry, i) => {
                      const end = entry.exitedAt ? new Date(entry.exitedAt).getTime() : Date.now();
                      const duration = end - new Date(entry.enteredAt).getTime();
                      return (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {STATUS_LABELS[entry.status]}
                          </span>
                          <span className="font-medium tabular-nums">
                            {formatDuration(duration)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="mt-4 border-t border-border pt-4">
            <h4 className="text-sm font-semibold mb-3">Comentários ({dbComments.length})</h4>
            <div className="space-y-3 max-h-48 overflow-auto mb-3">
              {dbComments.map((c) => {
                const sender = users.find((u) => u.id === c.user_id);
                return (
                  <div key={c.id} className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0 mt-0.5">
                      {sender?.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('') || '?'}
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold">{sender?.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(c.created_at).toLocaleString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {(() => {
                        const imgRegex = /\[imagem\]\((https?:\/\/[^\s)]+)\)/g;
                        const textOnly = c.content.replace(imgRegex, '').trim();
                        const imgMatches = [...c.content.matchAll(imgRegex)];
                        return (
                          <>
                            {textOnly && (
                              <p className="text-sm text-muted-foreground">{textOnly}</p>
                            )}
                            {imgMatches.length > 0 && (
                              <div className="flex gap-1.5 flex-wrap mt-1">
                                {imgMatches.map((m, i) => (
                                  <img
                                    key={i}
                                    src={m[1]}
                                    alt="Anexo"
                                    className="w-20 h-20 object-cover rounded-lg border border-border cursor-pointer hover:opacity-80"
                                    onClick={() => setZoomedImage(m[1])}
                                  />
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
              {dbComments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum comentário ainda
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Comentário... (Cole imagens com Ctrl+V)"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                onPaste={handleCommentPaste}
                className="text-sm"
              />
              <Button
                size="sm"
                onClick={handleSendComment}
                disabled={!newComment.trim() && commentPastedImages.length === 0}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            {commentPastedImages.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-2">
                {commentPastedImages.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={URL.createObjectURL(img)}
                      alt={`Colada ${idx + 1}`}
                      className="w-16 h-16 object-cover rounded-lg border border-border"
                    />
                    <button
                      onClick={() =>
                        setCommentPastedImages((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Full-screen image zoom overlay */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center cursor-pointer p-4"
          onClick={() => setZoomedImage(null)}
        >
          <button className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70 transition-colors">
            <X className="w-6 h-6" />
          </button>
          <img
            src={zoomedImage}
            alt="Imagem ampliada"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default TaskDetailDialog;
