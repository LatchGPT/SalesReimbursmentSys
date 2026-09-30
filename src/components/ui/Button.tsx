import { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={isLoading || disabled}
        className={cn(
          'inline-flex items-center justify-center font-label-md rounded-btn ui-button relative',
          {
            'bg-primary text-on-primary shadow-sm ui-button-primary': variant === 'primary',
            'bg-white border border-brand-border text-brand-slate': variant === 'secondary',
            'border border-outline-variant bg-surface-container-lowest text-on-surface': variant === 'outline',
            'text-on-surface-variant': variant === 'ghost',
            'h-8 px-3 text-xs': size === 'sm',
            'h-10 px-5 py-2.5': size === 'md',
            'h-12 px-8 py-3': size === 'lg',
            'opacity-70 cursor-not-allowed': isLoading || disabled,
          },
          className
        )}
        {...props}
      >
        <span className={cn('inline-flex items-center justify-center gap-2', { 'opacity-0': isLoading })}>
          {children}
        </span>
        {isLoading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </span>
        )}
      </button>
    );
  }
);
Button.displayName = 'Button';
