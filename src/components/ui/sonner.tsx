import { Toaster as Sonner, toast } from 'sonner';

import { useThemeToggle } from '@/hooks/useThemeToggle';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useThemeToggle();

  return (
    <Sonner
      theme={theme === 'light' ? 'light' : 'dark'}
      position="top-right"
      richColors={false}
      closeButton
      gap={8}
      visibleToasts={3}
      className="toaster group"
      toastOptions={{
        duration: 2600,
        classNames: {
          toast:
            'group toast !rounded-2xl !border-border/80 !bg-popover !text-popover-foreground !shadow-floating !transition-[transform,opacity,height] !duration-300 !ease-out',
          title: 'group-[.toast]:font-semibold',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:!rounded-xl group-[.toast]:!bg-primary group-[.toast]:!text-primary-foreground',
          cancelButton:
            'group-[.toast]:!rounded-xl group-[.toast]:!bg-muted group-[.toast]:!text-muted-foreground',
          closeButton:
            'group-[.toast]:!border-border group-[.toast]:!bg-card group-[.toast]:!text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
