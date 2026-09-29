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
          'inline-flex items-center justify-center font-label-md rounded-btn ui-button',
          {
            'bg-primary text-on-primary shadow-sm ui-button-primary': variant === 'primary',
            'bg-white border border-brand-border text-brand-slate': variant === 'secondary',
            'border border-outline-variant bg-surface-container-lowest text-on-surface': variant === 'outline',
            'text-on-surface-variant': variant === 'ghost',
            'h-8 px-3 text-xs': size === 'sm',
            'h-10 px-5 py-2.5': size === 'md',
            'h-12 px-8 py-3': size === 'lg',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
