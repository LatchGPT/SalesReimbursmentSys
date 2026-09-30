import { InputHTMLAttributes, forwardRef, SelectHTMLAttributes, LabelHTMLAttributes } from 'react';
import { cn } from './Button';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={cn(
            "w-full bg-white border border-brand-field-border rounded-input px-4 py-2.5 text-body-base transition-[background-color,border-color] duration-150 disabled:bg-surface-container-low disabled:text-outline",
            error && "border-error focus-visible:outline-error",
            className
          )}
          {...props}
        />
        {error && <p className="text-error text-label-sm mt-1">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  containerClassName?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, containerClassName, children, error, ...props }, ref) => {
    return (
      <div className={cn("relative w-full", containerClassName)}>
        <select
          ref={ref}
          className={cn(
            "w-full appearance-none bg-white border border-brand-field-border rounded-input pl-4 pr-10 py-2.5 text-body-base transition-[background-color,border-color] duration-150 disabled:bg-surface-container-low disabled:text-outline",
            error && "border-error focus-visible:outline-error",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <span
          aria-hidden="true"
          className="material-symbols-outlined pointer-events-none absolute right-3 top-[18px] -translate-y-1/2 text-[20px] text-on-surface-variant"
        >
          expand_more
        </span>
        {error && <p className="text-error text-label-sm mt-1">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

export const Label = ({ children, className, optional, ...props }: LabelHTMLAttributes<HTMLLabelElement> & { optional?: boolean }) => (
  <label className={cn("block font-label-md text-label-md text-on-surface-variant mb-2", className)} {...props}>
    {children}
    {optional && (
      <span className="text-outline text-label-sm ml-1 font-normal">(optional)</span>
    )}
  </label>
);
