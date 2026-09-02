// src/hooks/useSignedUrl.ts
import { useEffect, useState } from 'react';
import { getSignedUrl } from '@/lib/signedUrl';

export function useSignedUrl(publicUrl: string | null | undefined, bucket = 'attachments') {
  const [url, setUrl] = useState<string>(publicUrl || '');
  useEffect(() => {
    if (!publicUrl) {
      setUrl('');
      return;
    }
    let cancelled = false;
    getSignedUrl(publicUrl, bucket).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [publicUrl, bucket]);
  return url;
}
