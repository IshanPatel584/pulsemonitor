import { cn } from '../../lib/cn';

/** Label + control + hint/error wrapper for form inputs. */
export default function Field({ label, htmlFor, error, hint, className, children }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1.5 animate-fade-in text-xs text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${htmlFor}-hint`} className={cn('mt-1.5 text-xs text-muted')}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}
