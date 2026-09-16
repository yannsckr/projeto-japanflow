import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Paperclip, Image, FileText, Pencil, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useGroupChat, GroupMessage } from '@/hooks/useGroupChat';
import { useGroupTyping } from '@/hooks/useTypingPresence';
import { uploadImage } from '@/lib/uploadImage';
import { SafeChatImage, TypingBubble } from '@/components/ChatMedia';

interface GroupChatPanelProps {
  groupId: string;
  groupName: string;
}

const GroupChatPanel = ({ groupId, groupName }: GroupChatPanelProps) => {
  const { currentUser, users } = useApp();
  const { messages, sendMessage, editMessage } = useGroupChat(groupId);

  const [text, setText] = useState('');
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const { typingUserIds, pingTyping, stopTyping } = useGroupTyping(currentUser?.id, groupId);

  const typingNames = typingUserIds
    .map((id) => users.find((user) => user.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typingUserIds.length]);

  if (!currentUser) return null;

  const handleSend = () => {
    if (!text.trim()) return;

    void sendMessage(currentUser.username, { content: text.trim() });
    setText('');
    stopTyping();
  };

  const sendImage = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx 10MB)');
      return;
    }

    setUploadingImage(true);

    try {
      const { publicUrl } = await uploadImage(file, {
        pathPrefix: `chat/groups/${groupId}`,
        sourceTable: 'group_messages',
        sourceField: 'attachment_url',
        uploadedBy: currentUser.id,
      });

      await sendMessage(currentUser.username, {
        content: '📷 Imagem',
        attachmentUrl: publicUrl,
        attachmentType: 'image',
        attachmentName: file.name || 'imagem',
      });
    } catch (error) {
      console.error('Erro ao enviar imagem no grupo:', error);
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

    if (file.size > 700 * 1024) {
      toast.error('Arquivo muito grande para o chat (máx. 700 KB por enquanto)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      void sendMessage(currentUser.username, {
        content: `📎 ${file.name}`,
        attachmentUrl: reader.result as string,
        attachmentType: 'file',
        attachmentName: file.name,
      });
    };
    reader.readAsDataURL(file);
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

  const renderMessage = (msg: GroupMessage) => {
    const isMe = msg.sender_username === currentUser.username;
    const senderUser = users.find((u) => u.username === msg.sender_username);

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
              {senderUser?.name || msg.sender_username}
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
              {msg.attachment_url && !msg.deleted && (
                <div className="mb-2">
                  {msg.attachment_type === 'image' && (
                    <SafeChatImage
                      src={msg.attachment_url}
                      alt="Imagem enviada no grupo"
                      className="max-h-56 max-w-full rounded-xl object-cover"
                    />
                  )}

                  {msg.attachment_type === 'file' && (
                    <a
                      href={msg.attachment_url}
                      download={msg.attachment_name || undefined}
                      className="flex items-center gap-2 break-all text-xs underline"
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      {msg.attachment_name}
                    </a>
                  )}
                </div>
              )}

              <p className={cn('whitespace-pre-wrap break-words', msg.deleted && 'italic')}>
                {msg.content}
              </p>

              <div className="mt-1 flex items-center gap-1">
                <span className={cn('text-[10px]', isMe ? 'opacity-60' : 'text-muted-foreground')}>
                  {msg.created_at
                    ? new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'agora'}
                </span>

                {msg.edited && !msg.deleted && (
                  <span className="text-[9px] opacity-50">(editada)</span>
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
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
          {groupName[0]?.toUpperCase() || 'G'}
        </div>
        <div>
          <p className="text-sm font-semibold">{groupName}</p>
          <p className="text-[11px] text-muted-foreground">
            {typingNames.length > 0
              ? `${typingNames.slice(0, 2).join(', ')} digitando…`
              : 'Chat de grupo'}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Comece a conversa!
          </p>
        )}

        {messages.map(renderMessage)}

        {typingNames.length > 0 && (
          <TypingBubble
            label={
              typingNames.length === 1 ? typingNames[0] : `${typingNames.slice(0, 2).join(', ')}`
            }
          />
        )}

        <div ref={bottomRef} />
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border/70 bg-card p-3 md:p-4">
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

        <Input
          placeholder={uploadingImage ? 'Enviando imagem…' : 'Digite uma mensagem...'}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim()) pingTyping();
            else stopTyping();
          }}
          onBlur={stopTyping}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSend();
            }
          }}
          onPaste={handlePaste}
          className="min-w-0 text-sm"
        />

        <Button onClick={handleSend} disabled={!text.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default GroupChatPanel;
