import { forwardRef } from 'react';
import { cn } from '../../lib/cn';

const VARIANTS = {
  primary: 'bg-accent text-accent-fg hover:bg-accent/90 border border-transparent shadow-sm',
  secondary: 'bg-surface text-fg border border-line hover:bg-hover hover:border-line-strong shadow-sm',
  ghost: 'text-muted hover:text-fg hover:bg-hover border border-transparent',
  danger: 'bg-danger text-white hover:bg-danger/90 border border-transparent shadow-sm',
};

const SIZES = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  icon: 'h-8 w-8 justify-center',
};

const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'focus-ring inline-flex shrink-0 items-center rounded-md font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out-soft active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {Icon && <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2} aria-hidden />}
      {children}
    </button>
  );
});

export default Button;
