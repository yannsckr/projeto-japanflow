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
  const microphoneStreamRef = useRef<MediaStream | null>(null);

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

  useEffect(() => {
    return () => {
      if (mediaRecorder?.state === 'recording') {
        try {
          mediaRecorder.stop();
        } catch {
          // Ignora falha de encerramento durante desmontagem.
        }
      }
      microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
      microphoneStreamRef.current = null;
    };
  }, [mediaRecorder]);

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

  const stopMicrophoneStream = () => {
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
    microphoneStreamRef.current = null;
  };

  const microphoneErrorMessage = (error: unknown) => {
    const name = error instanceof DOMException ? error.name : '';

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'O microfone está bloqueado. Clique no cadeado ao lado do endereço e permita o acesso ao microfone.';
    }

    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'Nenhum microfone foi encontrado neste computador.';
    }

    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return 'O microfone está sendo usado por outro aplicativo ou não pôde ser iniciado.';
    }

    if (name === 'SecurityError') {
      return 'O navegador bloqueou o microfone por segurança. Use HTTPS ou localhost.';
    }

    return 'Não foi possível acessar o microfone. Verifique a permissão do navegador e do Windows.';
  };

  const toggleRecording = async () => {
    if (recording && mediaRecorder) {
      if (mediaRecorder.state === 'recording') mediaRecorder.stop();
      setRecording(false);
      return;
    }

    if (!window.isSecureContext) {
      toast.error('O microfone só funciona em HTTPS ou localhost.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Este navegador não oferece acesso ao microfone.');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      toast.error('A gravação de áudio não é suportada neste navegador.');
      return;
    }

    try {
      if (navigator.permissions?.query) {
        try {
          const permission = await navigator.permissions.query({
            name: 'microphone' as PermissionName,
          });

          if (permission.state === 'denied') {
            toast.error(
              'O microfone está bloqueado. Clique no cadeado ao lado do endereço e altere Microfone para Permitir.'
            );
            return;
          }
        } catch {
          // Alguns navegadores não implementam Permissions API para microfone.
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      microphoneStreamRef.current = stream;

      const preferredMimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
      const mimeType = preferredMimeTypes.find((type) => MediaRecorder.isTypeSupported(type));

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onerror = () => {
        setRecording(false);
        stopMicrophoneStream();
        toast.error('A gravação do áudio foi interrompida pelo navegador.');
      };

      recorder.onstop = () => {
        const finalMimeType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: finalMimeType });

        setRecording(false);
        setMediaRecorder(null);
        stopMicrophoneStream();

        if (blob.size === 0) {
          toast.error('Nenhum áudio foi capturado. Tente novamente.');
          return;
        }

        if (blob.size > 700 * 1024) {
          toast.error('Áudio muito longo para o chat. Grave um áudio menor.');
          return;
        }

        const extension = finalMimeType.includes('ogg') ? 'ogg' : 'webm';
        const reader = new FileReader();
        reader.onload = () => {
          void sendMessage({
            receiverId: otherUser.id,
            content: '🎤 Áudio',
            attachmentUrl: reader.result as string,
            attachmentType: 'audio',
            attachmentName: `audio.${extension}`,
          });
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch (error) {
      console.error('Erro ao acessar microfone:', error);
      stopMicrophoneStream();
      setMediaRecorder(null);
      setRecording(false);
      toast.error(microphoneErrorMessage(error));
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
