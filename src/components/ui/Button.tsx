import { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-label-md transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95 duration-300 relative overflow-hidden group',
          {
            'ui-button-primary text-on-primary shadow-sm rounded-btn': variant === 'primary',
            'bg-white/80 backdrop-blur-md border border-brand-border/60 text-brand-slate hover:bg-surface-container hover:shadow-sm rounded-btn': variant === 'secondary',
            'border border-outline-variant/40 bg-surface-container-lowest/50 backdrop-blur-sm text-on-surface hover:bg-surface-container-low hover:border-outline-variant rounded-btn': variant === 'outline',
            'hover:bg-surface-container-high/50 text-on-surface-variant rounded-btn hover:text-primary transition-colors': variant === 'ghost',
            'h-8 px-4 text-xs font-semibold': size === 'sm',
            'h-10 px-6 py-2.5': size === 'md',
            'h-12 px-8 py-3 text-base': size === 'lg',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
