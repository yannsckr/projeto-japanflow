import { useEffect, useMemo, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { getSignedUrl } from '@/lib/signedUrl';
import { cn } from '@/lib/utils';

interface SafeChatImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  onClick?: () => void;
}

export const SafeChatImage = ({ src, alt, className, onClick }: SafeChatImageProps) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(src || null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setResolvedSrc(src || null);

    if (!src || !src.startsWith('http')) return;

    void getSignedUrl(src)
      .then((url) => {
        if (!cancelled) setResolvedSrc(url);
      })
      .catch(() => {
        if (!cancelled) setResolvedSrc(src);
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!resolvedSrc || failed) {
    return (
      <div
        className={cn(
          'flex min-h-24 min-w-32 items-center justify-center rounded-xl border border-border/60 bg-muted/25 text-muted-foreground',
          className
        )}
      >
        <div className="flex flex-col items-center gap-1.5 px-3 py-4 text-center">
          <ImageOff className="h-5 w-5 opacity-60" />
          <span className="text-[10px]">Imagem indisponível</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      onClick={onClick}
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
    />
  );
};

interface ChatAvatarProps {
  src?: string | null;
  name: string;
  className?: string;
}

export const ChatAvatar = ({ src, name, className }: ChatAvatarProps) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(src || null);
  const [failed, setFailed] = useState(false);

  const initials = useMemo(
    () =>
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || '?',
    [name]
  );

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setResolvedSrc(src || null);

    if (!src || !src.startsWith('http')) return;

    void getSignedUrl(src)
      .then((url) => {
        if (!cancelled) setResolvedSrc(url);
      })
      .catch(() => {
        if (!cancelled) setResolvedSrc(src);
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden bg-primary/10 text-xs font-semibold text-primary',
        className
      )}
      aria-label={name}
    >
      {resolvedSrc && !failed ? (
        <img
          src={resolvedSrc}
          alt={`Foto de perfil de ${name}`}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        initials
      )}
    </div>
  );
};

export const TypingBubble = ({ label }: { label?: string }) => (
  <div className="flex items-end gap-2">
    <div className="rounded-2xl rounded-bl-md bg-secondary px-3.5 py-2.5 text-secondary-foreground">
      {label && <p className="mb-1 text-[10px] font-medium opacity-65">{label}</p>}
      <div className="flex h-4 items-center gap-1" aria-label="Digitando">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-45 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-45 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-45" />
      </div>
    </div>
  </div>
);
