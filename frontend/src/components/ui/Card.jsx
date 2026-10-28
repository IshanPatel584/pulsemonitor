import { cn } from '../../lib/cn';

export function Card({ className, children, ...props }) {
  return (
    <section
      className={cn('animate-rise rounded-lg border border-line bg-surface transition-[border-color,box-shadow] duration-200 ease-out-soft hover:border-line-strong', className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function CardHeader({ title, description, action, className }) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-medium text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  );
}

export function CardBody({ className, children }) {
  return <div className={cn('px-4 pb-4 pt-3 sm:px-5', className)}>{children}</div>;
}
