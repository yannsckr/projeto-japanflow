import { useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Theme, useThemeToggle } from '@/hooks/useThemeToggle';

const visibleThemes = ['dark', 'light'] as const;

const themeMeta = {
  dark: {
    label: 'Escuro',
    description: 'Mais foco e contraste',
    icon: Moon,
  },
  light: {
    label: 'Claro',
    description: 'Leitura leve e direta',
    icon: Sun,
  },
} as const;

export default function ThemeSwitcher() {
  const { theme, setTheme } = useThemeToggle();

  useEffect(() => {
    if (theme === 'hybrid') {
      setTheme('dark');
    }
  }, [theme, setTheme]);

  const activeTheme = theme === 'light' ? 'light' : 'dark';
  const CurrentIcon = themeMeta[activeTheme].icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          aria-label="Alterar tema"
          title={`Tema: ${themeMeta[activeTheme].label}`}
        >
          <CurrentIcon className="h-[18px] w-[18px]" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="jf-glass w-64 rounded-2xl border-border/70 p-2">
        <DropdownMenuLabel className="px-3 pb-2 pt-2">
          <span className="block text-sm font-semibold">Aparência</span>
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
            Escolha como o JapanFlow deve aparecer.
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="my-1 bg-border/70" />

        <DropdownMenuRadioGroup
          value={activeTheme}
          onValueChange={(value) => setTheme(value as Theme)}
          className="space-y-1"
        >
          {visibleThemes.map((itemTheme) => {
            const item = themeMeta[itemTheme];
            const Icon = item.icon;

            return (
              <DropdownMenuRadioItem
                key={itemTheme}
                value={itemTheme}
                className="rounded-xl py-2.5 pl-9 pr-3 focus:bg-muted/80"
              >
                <Icon className="mr-2 h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
