import * as React from 'react';

import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-gradient-to-r from-muted/65 via-muted to-muted/65',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
