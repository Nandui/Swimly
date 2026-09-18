'use client';
import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu';
import { useThemeMode } from '@/components/theme-provider';
import { parseThemeMode } from '@/lib/theme-mode';
export function AppearanceMenu({ expanded = false }: { expanded?: boolean }) {
  const { mode, setMode } = useThemeMode();
  const Icon = mode === 'system' ? Monitor : mode === 'dark' ? Moon : Sun;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={expanded ? 'default' : 'icon'}
          className={expanded ? 'appearance-button' : undefined}
          aria-label={`Appearance: ${mode}`}
          title={`Appearance: ${mode}`}
        >
          <Icon size={18} />
          {expanded && (
            <>
              <span>Appearance</span>
              <small>{mode[0].toUpperCase() + mode.slice(1)}</small>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="turnfin-docs min-w-44">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(value) => setMode(parseThemeMode(value))}
        >
          <DropdownMenuRadioItem value="system">
            <Monitor size={16} />
            System
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <Sun size={16} />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon size={16} />
            Dark
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
