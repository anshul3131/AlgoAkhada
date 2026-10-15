export type BadgeTone = 'primary' | 'danger' | 'warn' | 'electric' | 'easy' | 'medium' | 'hard';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  className?: string;
}

const tones: Record<string, string> = {
  // Emerald / Brand Green (Easy / Live / Success)
  primary: 'border-accent/40 bg-accent-tint/40 text-accent-strong dark:text-accent dark:border-accent/30 dark:bg-accent-tint/20',
  easy: 'border-easy/40 bg-easy-tint/40 text-easy dark:border-easy/30 dark:bg-easy-tint/20',

  // Amber / Golden Yellow (Medium / Warning)
  warn: 'border-medium/40 bg-medium-tint/40 text-medium dark:border-medium/30 dark:bg-medium-tint/20',
  medium: 'border-medium/40 bg-medium-tint/40 text-medium dark:border-medium/30 dark:bg-medium-tint/20',

  // Coral / Crimson Red (Hard / Error / Danger)
  danger: 'border-hard/40 bg-hard-tint/40 text-hard dark:border-hard/30 dark:bg-hard-tint/20',
  hard: 'border-hard/40 bg-hard-tint/40 text-hard dark:border-hard/30 dark:bg-hard-tint/20',

  // Electric Cyan (Languages, Stats, Mode Badges)
  electric: 'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400 dark:border-sky-500/30 dark:bg-sky-500/10',
};

export function getDifficultyTone(difficulty?: string): 'easy' | 'medium' | 'hard' {
  const norm = (difficulty || '').trim().toUpperCase();
  if (norm === 'EASY') return 'easy';
  if (norm === 'HARD') return 'hard';
  return 'medium';
}

export function Badge({ label, tone, className = '' }: BadgeProps) {
  let resolvedTone = tone;
  const upper = label.trim().toUpperCase();

  // If tone is not set, or is 'electric'/'primary', auto-resolve standard difficulties to their distinctive tones
  if (!resolvedTone || resolvedTone === 'electric' || resolvedTone === 'primary') {
    if (upper === 'EASY') resolvedTone = 'easy';
    else if (upper === 'MEDIUM' || upper === 'MED') resolvedTone = 'medium';
    else if (upper === 'HARD') resolvedTone = 'hard';
    else if (!resolvedTone) resolvedTone = 'primary';
  }

  const toneClass = tones[resolvedTone] || tones.primary;

  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-[0.16em] ${toneClass} ${className}`}
    >
      {label}
    </span>
  );
}
