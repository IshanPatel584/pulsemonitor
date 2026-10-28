/** Slim row under the top bar: context text on the left, page actions on the right. */
export default function PageHeader({ description, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted">{description}</p>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
