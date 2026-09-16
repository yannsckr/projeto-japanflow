import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { User, ChatMessage } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
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
import { usePrivateTyping, usePrivateTypingUsers } from '@/hooks/useTypingPresence';
import { uploadImage } from '@/lib/uploadImage';
import { ChatAvatar, SafeChatImage, TypingBubble } from '@/components/ChatMedia';

interface ChatPanelProps {
  otherUser: User;
}

const ChatPanel = ({ otherUser }: ChatPanelProps) => {
  const { currentUser, users } = useApp();
  const { messages, sendMessage, editMessage, getMessagesForChat } = useChat();

  const [text, setText] = useState('');
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const { isOtherTyping, pingTyping, stopTyping } = usePrivateTyping(currentUser?.id, otherUser.id);
  const privateTypingUserIds = usePrivateTypingUsers(currentUser?.id);
  const isTyping = isOtherTyping || privateTypingUserIds.includes(otherUser.id);

  useEffect(() => {
    if (!currentUser?.id || !otherUser.id) return;
    return getMessagesForChat(currentUser.id, otherUser.id);
  }, [currentUser?.id, otherUser.id, getMessagesForChat]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [messages.length, isTyping]);

  if (!currentUser) return null;

  const handleSend = () => {
    if (!text.trim()) return;

    void sendMessage({
      receiverId: otherUser.id,
      content: text.trim(),
    });

    setText('');
    stopTyping();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const sendImage = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx 10MB)');
      return;
    }

    setUploadingImage(true);

    try {
      const { publicUrl } = await uploadImage(file, {
        pathPrefix: 'chat/private',
        sourceTable: 'messages',
        sourceField: 'attachmentUrl',
        uploadedBy: currentUser.id,
      });

      await sendMessage({
        receiverId: otherUser.id,
        content: '📷 Imagem',
        attachmentUrl: publicUrl,
        attachmentType: 'image',
        attachmentName: file.name || 'imagem',
      });
    } catch (error) {
      console.error('Erro ao enviar imagem no chat:', error);
      toast.error('Não foi possível enviar a imagem');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (type === 'image') {
      void sendImage(file);
      return;
    }

    // Mantém compatibilidade com anexos antigos. Imagens novas já vão para o R2.
    if (file.size > 700 * 1024) {
      toast.error('Arquivo muito grande para o chat (máx. 700 KB por enquanto)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      void sendMessage({
        receiverId: otherUser.id,
        content: `📎 ${file.name}`,
        attachmentUrl: reader.result as string,
        attachmentType: 'file',
        attachmentName: file.name,
      });
    };
    reader.readAsDataURL(file);
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

        if (blob.size > 700 * 1024) {
          toast.error('Áudio muito longo para o chat. Grave um áudio menor.');
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          void sendMessage({
            receiverId: otherUser.id,
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
      if (!item.type.startsWith('image/')) continue;

      e.preventDefault();
      const file = item.getAsFile();
      if (file) void sendImage(file);
      return;
    }
  };

  const handleEditSave = (msgId: string) => {
    if (!editText.trim()) return;
    void editMessage(msgId, editText.trim());
    setEditingMsgId(null);
    setEditText('');
  };

  const renderMessage = (msg: ChatMessage) => {
    const isMe = msg.senderId === currentUser.id;
    const senderUser = users.find((u) => u.id === msg.senderId);
    const read = isMe && msg.read;

    return (
      <div key={msg.id} className={cn('group flex', isMe ? 'justify-end' : 'justify-start')}>
        <div
          className={cn(
            'relative max-w-[82%] break-words rounded-2xl px-3.5 py-2.5 text-sm sm:max-w-[70%]',
            isMe
              ? 'rounded-br-md bg-primary text-primary-foreground'
              : 'rounded-bl-md bg-secondary text-secondary-foreground',
            msg.deleted && 'opacity-60'
          )}
        >
          {!isMe && (
            <p className="mb-0.5 text-[10px] font-semibold opacity-70">
              {senderUser?.name || 'Usuário'}
            </p>
          )}

          {editingMsgId === msg.id ? (
            <div className="flex items-center gap-1">
              <Input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEditSave(msg.id)}
                className="h-8 bg-background text-xs text-foreground"
                autoFocus
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => handleEditSave(msg.id)}
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setEditingMsgId(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <>
              {msg.attachmentUrl && !msg.deleted && (
                <div className="mb-2">
                  {msg.attachmentType === 'image' && (
                    <SafeChatImage
                      src={msg.attachmentUrl}
                      alt="Imagem enviada no chat"
                      className="max-h-56 max-w-full cursor-pointer rounded-xl object-cover transition-opacity hover:opacity-90"
                      onClick={() => setEnlargedImage(msg.attachmentUrl || null)}
                    />
                  )}

                  {msg.attachmentType === 'audio' && (
                    <audio controls src={msg.attachmentUrl} className="max-w-full" />
                  )}

                  {msg.attachmentType === 'file' && (
                    <a
                      href={msg.attachmentUrl}
                      download={msg.attachmentName}
                      className="flex items-center gap-2 break-all text-xs underline"
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="min-w-0">{msg.attachmentName}</span>
                    </a>
                  )}
                </div>
              )}

              <p className={cn('whitespace-pre-wrap break-words', msg.deleted && 'italic')}>
                {msg.content}
              </p>

              <div className="mt-1 flex items-center gap-1">
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
                    className={cn('ml-0.5 h-3.5 w-3.5', read ? 'text-blue-400' : 'opacity-40')}
                  />
                )}
              </div>
            </>
          )}

          {isMe && !msg.deleted && editingMsgId !== msg.id && (
            <div className="absolute -top-3 right-0 hidden gap-0.5 rounded-md border border-border bg-card shadow-sm group-hover:flex">
              <button
                onClick={() => {
                  setEditingMsgId(msg.id);
                  setEditText(msg.content);
                }}
                className="rounded-md p-1 hover:bg-secondary"
                aria-label="Editar mensagem"
              >
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 max-h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 border-b border-border/70 bg-card p-4">
        <ChatAvatar src={otherUser.avatar} name={otherUser.name} className="h-10 w-10 rounded-xl" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{otherUser.name}</p>
          {isTyping ? (
            <p className="truncate text-[11px] font-bold italic text-primary animate-pulse [animation-duration:1.8s]">
              Digitando...
            </p>
          ) : (
            <p className="truncate text-[11px] text-muted-foreground">@{otherUser.username}</p>
          )}
        </div>
      </div>

      <div
        ref={messagesContainerRef}
        className="min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto p-4"
      >
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Comece a conversa!
          </p>
        )}

        {messages.map(renderMessage)}
        {isTyping && <TypingBubble label={otherUser.name} />}
      </div>

      <div className="flex shrink-0 items-end gap-2 border-t border-border/70 bg-card p-3 md:p-4">
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
          className="h-9 w-9 shrink-0"
          disabled={uploadingImage}
          onClick={() => imageInputRef.current?.click()}
        >
          <Image className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 shrink-0"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          variant={recording ? 'destructive' : 'ghost'}
          className="h-9 w-9 shrink-0"
          onClick={toggleRecording}
        >
          {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>

        <Textarea
          placeholder={uploadingImage ? 'Enviando imagem…' : 'Digite uma mensagem...'}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim()) pingTyping();
            else stopTyping();
          }}
          onBlur={stopTyping}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className="max-h-32 min-h-[40px] min-w-0 resize-none py-2 text-sm"
          rows={1}
        />

        <Button onClick={handleSend} disabled={!text.trim()} size="icon" className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={!!enlargedImage} onOpenChange={() => setEnlargedImage(null)}>
        <DialogContent className="max-h-[90vh] max-w-[90vw] p-2">
          <DialogTitle className="sr-only">Imagem ampliada do chat</DialogTitle>
          <DialogDescription className="sr-only">
            Visualização ampliada da imagem enviada na conversa.
          </DialogDescription>

          {enlargedImage && (
            <SafeChatImage
              src={enlargedImage}
              alt="Imagem ampliada"
              className="h-full max-h-[85vh] w-full rounded-xl object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatPanel;
