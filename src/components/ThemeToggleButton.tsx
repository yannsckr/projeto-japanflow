import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useThemeToggle } from '@/hooks/useThemeToggle';
import { cn } from '@/lib/utils';

interface ThemeToggleButtonProps {
  className?: string;
}

const ThemeToggleButton = ({ className }: ThemeToggleButtonProps) => {
  const { theme, toggleTheme } = useThemeToggle();
  const isLight = theme === 'light';

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={cn(
        'relative h-9 w-9 overflow-hidden rounded-xl text-muted-foreground hover:bg-muted/70 hover:text-foreground active:scale-[0.96]',
        className
      )}
      style={{
        transition:
          'background-color 220ms cubic-bezier(.22,.61,.36,1), color 220ms cubic-bezier(.22,.61,.36,1), transform 220ms cubic-bezier(.22,.61,.36,1)',
      }}
      aria-label={isLight ? 'Ativar modo escuro' : 'Ativar modo claro'}
      title={isLight ? 'Modo escuro' : 'Modo claro'}
    >
      <Sun
        className="absolute h-[18px] w-[18px]"
        style={{
          opacity: isLight ? 0 : 1,
          transform: isLight ? 'rotate(75deg) scale(.72)' : 'rotate(0deg) scale(1)',
          transition: 'opacity 260ms ease, transform 320ms cubic-bezier(.22,.61,.36,1)',
        }}
      />
      <Moon
        className="absolute h-[18px] w-[18px]"
        style={{
          opacity: isLight ? 1 : 0,
          transform: isLight ? 'rotate(0deg) scale(1)' : 'rotate(-75deg) scale(.72)',
          transition: 'opacity 260ms ease, transform 320ms cubic-bezier(.22,.61,.36,1)',
        }}
      />
    </Button>
  );
};

export default ThemeToggleButton;
