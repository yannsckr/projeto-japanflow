import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Send,
  Paperclip,
  Mic,
  Image,
  FileText,
  Pencil,
  X,
  Check,
  MicOff,
  CheckCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useChat } from '@/hooks/useChat';
import { ChatMessage } from '@/types';

interface ChatPanelProps {
  otherUser: User;
}

const ChatPanel = ({ otherUser }: ChatPanelProps) => {
  const { currentUser, users } = useApp();
  const { messages, sendMessage, editMessage } = useChat(
    currentUser?.username || null,
    otherUser.username
  );

  const [text, setText] = useState('');
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [messages.length]);

  if (!currentUser) return null;

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage({ content: text.trim() });
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Shift+Enter will naturally create a new line in textarea
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx 10MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      sendMessage({
        content: type === 'image' ? '📷 Imagem' : `📎 ${file.name}`,
        attachmentUrl: reader.result as string,
        attachmentType: type,
        attachmentName: file.name,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const toggleRecording = async () => {
    if (recording && mediaRecorder) {
      mediaRecorder.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          sendMessage({
            content: '🎤 Áudio',
            attachmentUrl: reader.result as string,
            attachmentType: 'audio',
            attachmentName: 'audio.webm',
          });
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch {
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
          toast.error('Imagem muito grande (máx 10MB)');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          sendMessage({
            content: '📷 Imagem',
            attachmentUrl: reader.result as string,
            attachmentType: 'image',
            attachmentName: file.name || 'imagem.png',
          });
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  const handleEditSave = (msgId: string) => {
    if (!editText.trim()) return;
    editMessage(msgId, editText.trim());
    setEditingMsgId(null);
    setEditText('');
  };


  const isMessageRead = (msg: ChatMessage) => {
    if (msg.senderId !== currentUser.id) return false;

    return msg.read;
  };

  const renderMessage = (msg: ChatMessage) => {
  const isMe = msg.senderId === currentUser.id;

  const senderUser = users.find(
    (u) => u.id === msg.senderId
  );

  const read = isMe && isMessageRead(msg);

    return (
      <div key={msg.id} className={cn('flex group', isMe ? 'justify-end' : 'justify-start')}>
        <div
          className={cn(
            'max-w-[70%] px-3.5 py-2.5 rounded-2xl text-sm relative break-words',
            isMe
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-secondary text-secondary-foreground rounded-bl-md',
            msg.deleted && 'opacity-60'
          )}
        >
          {!isMe && (
            <p className="text-[10px] font-semibold mb-0.5 opacity-70">
              {senderUser?.name || 'Usuário'}
            </p>
          )}

          {editingMsgId === msg.id ? (
            <div className="flex gap-1 items-center">
              <Input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEditSave(msg.id)}
                className="h-7 text-xs bg-background text-foreground"
                autoFocus
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => handleEditSave(msg.id)}
              >
                <Check className="w-3 h-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setEditingMsgId(null)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <>
              {msg.attachment_url && !msg.deleted && (
                <div className="mb-2">
                  {msg.attachment_type === 'image' && (
                    <img
                      src={msg.attachment_url}
                      alt="attachment"
                      className="max-w-full rounded-lg max-h-48 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setEnlargedImage(msg.attachment_url)}
                    />
                  )}
                  {msg.attachment_type === 'audio' && (
                    <audio controls src={msg.attachment_url} className="max-w-full" />
                  )}
                  {msg.attachment_type === 'file' && (
                    <a
                      href={msg.attachment_url}
                      download={msg.attachment_name}
                      className="flex items-center gap-2 underline text-xs break-all"
                    >
                      <FileText className="w-4 h-4 shrink-0" />
                      <span className="min-w-0">{msg.attachment_name}</span>
                    </a>
                  )}
                </div>
              )}
              <p className={cn(msg.deleted ? 'italic' : '', 'break-words whitespace-pre-wrap')}>
                {msg.content}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <span className={cn('text-[10px]', isMe ? 'opacity-60' : 'text-muted-foreground')}>
                  {new Date(msg.timestamp).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                  })}{' '}
                  {new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {msg.edited && !msg.deleted && (
                  <span className="text-[9px] opacity-50">(editada)</span>
                )}
                {isMe && !msg.deleted && (
                  <CheckCheck
                    className={cn('w-3.5 h-3.5 ml-0.5', read ? 'text-blue-400' : 'opacity-40')}
                  />
                )}
              </div>
            </>
          )}

          {isMe && !msg.deleted && editingMsgId !== msg.id && (
            <div className="absolute -top-3 right-0 hidden group-hover:flex gap-0.5 bg-card border border-border rounded-md shadow-sm">
              <button
                onClick={() => {
                  setEditingMsgId(msg.id);
                  setEditText(msg.content);
                }}
                className="p-1 hover:bg-secondary rounded-md"
              >
                <Pencil className="w-3 h-3 text-muted-foreground" />
              </button>

            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full max-h-full min-h-0 overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-border shrink-0">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
          {otherUser.name
            .split(' ')
            .map((n) => n[0])
            .join('')}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{otherUser.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">@{otherUser.username}</p>
        </div>
      </div>

      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-3"
      >
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Nenhuma mensagem ainda. Comece a conversa!
          </p>
        )}
        {messages.map(renderMessage)}
      </div>

      <div className="p-3 md:p-4 border-t border-border flex gap-2 items-end shrink-0 bg-card">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e, 'image')}
        />
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleFileSelect(e, 'file')}
        />
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0 h-9 w-9"
          onClick={() => imageInputRef.current?.click()}
        >
          <Image className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0 h-9 w-9"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant={recording ? 'destructive' : 'ghost'}
          className="shrink-0 h-9 w-9"
          onClick={toggleRecording}
        >
          {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>
        <Textarea
          placeholder="Digite uma mensagem..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className="text-sm min-w-0 min-h-[36px] max-h-32 resize-none py-2"
          rows={1}
        />
        <Button onClick={handleSend} disabled={!text.trim()} size="icon" className="shrink-0">
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {/* Lightbox de imagem ampliada */}
      <Dialog open={!!enlargedImage} onOpenChange={() => setEnlargedImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2">
          {enlargedImage && (
            <img
              src={enlargedImage}
              alt="Imagem ampliada"
              className="w-full h-full max-h-[85vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatPanel;
