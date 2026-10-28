export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex animate-rise flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-hover text-muted">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      )}
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
