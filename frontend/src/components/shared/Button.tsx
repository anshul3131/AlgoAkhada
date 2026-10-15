import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  children: ReactNode;
}

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  const variantClassNames = {
    primary: 'border border-accent-primary text-accent-strong dark:text-accent-primary bg-bg-panel dark:bg-black shadow-glow hover:shadow-glow-strong hover:bg-accent-tint/30 dark:hover:bg-accent-primary/10 active:scale-[0.99] font-bold',
    ghost: 'border border-border-hairline text-text-secondary bg-bg-panel hover:border-accent-primary hover:text-accent-primary hover:bg-bg-hover active:scale-[0.99]',
    danger: 'border border-accent-danger text-accent-danger bg-bg-panel hover:bg-accent-danger/10 active:scale-[0.99]',
  };

  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg px-4 py-3 font-mono uppercase tracking-[0.2em] transition-all duration-300 ease-expo-out ${variantClassNames[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
