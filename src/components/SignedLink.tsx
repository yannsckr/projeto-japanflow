// src/components/SignedLink.tsx
// Link que resolve para uma signed URL ao clicar (lazy), evitando expor URL pública na renderização.
import { useState, ReactNode } from 'react';
import { getSignedUrl } from '@/lib/signedUrl';

interface Props {
  url: string;
  className?: string;
  children: ReactNode;
  bucket?: string;
}

const SignedLink = ({ url, className, children, bucket = 'attachments' }: Props) => {
  const [resolving, setResolving] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (resolving) return;
    setResolving(true);
    try {
      const signed = await getSignedUrl(url, bucket);
      window.open(signed, '_blank', 'noopener,noreferrer');
    } finally {
      setResolving(false);
    }
  };

  return (
    <a
      href={url}
      onClick={handleClick}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
};

export default SignedLink;
