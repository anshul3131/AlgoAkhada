import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle light/dark theme"
      onClick={toggle}
      className="relative flex items-center h-7 w-12 shrink-0 rounded-full border border-border-strong bg-bg-panel-raised
                 transition-colors duration-300 hover:shadow-glow focus-visible:outline-none focus-visible:shadow-glow"
    >
      <Sun className={`absolute left-1.5 h-3.5 w-3.5 transition-all duration-300 ${isDark ? 'text-text-muted' : 'text-warning'}`} />
      <Moon className={`absolute right-1.5 h-3.5 w-3.5 transition-all duration-300 ${isDark ? 'text-accent-primary' : 'text-text-muted'}`} />
      <span
        className={`absolute left-0.5 h-5 w-5 rounded-full bg-bg-panel shadow-panel border border-border-subtle
                    transition-transform duration-300 ease-out ${isDark ? 'translate-x-[18px]' : 'translate-x-0'}`}
      />
    </button>
  );
}
