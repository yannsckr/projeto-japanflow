import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePersonalNotes, PersonalNote } from '@/hooks/usePersonalNotes';
import { useApp } from '@/contexts/AppContext';
import { StickyNote, Plus, Trash2, ChevronLeft, Edit2, Share2, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import RichTextEditor from '@/components/RichTextEditor';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Props {
  userId: string | null;
  trigger?: React.ReactNode;
}

export default function PersonalNotesDialog({ userId, trigger }: Props) {
  const { notes, addNote, updateNote, deleteNote, shareNote } = usePersonalNotes(userId);
  const { users } = useApp();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [selectedNote, setSelectedNote] = useState<PersonalNote | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleNew = () => {
    setSelectedNote(null);
    setTitle('');
    setContent('<p></p>');
    setView('edit');
  };

  const handleEdit = (note: PersonalNote) => {
    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.content || '<p></p>');
    setView('edit');
  };

  const handleSave = async () => {
    if (!title.trim() && !content.trim()) return;
    if (selectedNote) {
      await updateNote(selectedNote.id, { title, content });
    } else {
      await addNote(title, content);
    }
    setView('list');
  };

  const handleDelete = async (id: string) => {
    await deleteNote(id);
    if (selectedNote?.id === id) setView('list');
  };

  const handleShare = async (note: PersonalNote, targetUserId: string) => {
    await shareNote(note.id, targetUserId);
    const targetUser = users.find((u) => u.id === targetUserId);
    toast.success(`Anotação compartilhada com ${targetUser?.name || 'usuário'}`);
  };

  const otherUsers = users.filter((u) => u.id !== userId);

  const getSharedByName = (note: PersonalNote) => {
    if (!note.sharedByUserId) return '';
    return users.find((u) => u.id === note.sharedByUserId)?.name || '';
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setView('list');
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all">
            <StickyNote className="w-4 h-4" />
            Anotações
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="w-5 h-5" />
            Minhas Anotações
          </DialogTitle>
        </DialogHeader>

        {view === 'list' ? (
          <div className="flex flex-col gap-2 overflow-y-auto flex-1">
            <Button size="sm" onClick={handleNew} className="self-start mb-2">
              <Plus className="w-4 h-4 mr-1" /> Nova Anotação
            </Button>
            {notes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma anotação ainda.
              </p>
            )}
            {notes.map((note) => (
              <div
                key={note.id}
                className="border rounded-lg p-3 flex flex-col gap-1 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => handleEdit(note)} className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{note.title || 'Sem título'}</p>
                      {note.isShared && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                          <Users className="w-3 h-3 mr-1" />
                          {getSharedByName(note)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {note.content
                        ?.replace(/<[^>]*>/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim() || 'Sem conteúdo'}
                    </p>
                  </button>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleEdit(note)}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>

                    {/* Share button - only for own notes */}
                    {!note.isShared && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Share2 className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {otherUsers.map((u) => (
                            <DropdownMenuItem key={u.id} onClick={() => handleShare(note, u.id)}>
                              <Users className="w-3.5 h-3.5 mr-2" />
                              {u.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                    {/* Delete only own notes */}
                    {!note.isShared && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(note.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(note.updatedAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setView('list')}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              {selectedNote && !selectedNote.isShared && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Share2 className="w-3.5 h-3.5 mr-1" /> Compartilhar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {otherUsers.map((u) => (
                      <DropdownMenuItem
                        key={u.id}
                        onClick={() => selectedNote && handleShare(selectedNote, u.id)}
                      >
                        <Users className="w-3.5 h-3.5 mr-2" />
                        {u.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {selectedNote?.isShared && (
                <Badge variant="secondary" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  Compartilhada por {getSharedByName(selectedNote)}
                </Badge>
              )}
            </div>
            <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
            <RichTextEditor content={content} onChange={setContent} />
            <Button onClick={handleSave}>{selectedNote ? 'Salvar' : 'Criar'}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
