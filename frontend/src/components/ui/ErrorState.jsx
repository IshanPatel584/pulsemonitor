import { CircleAlert, RefreshCw } from 'lucide-react';
import Button from './Button';

/** Inline failure message with an optional retry, for data that failed to load. */
export default function ErrorState({ title = 'Something went wrong', message, onRetry, retrying = false }) {
  return (
    <div role="alert" className="flex animate-rise flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-danger/30 bg-danger/10 text-danger">
        <CircleAlert className="h-5 w-5" aria-hidden />
      </div>
      <p className="text-sm font-medium text-fg">{title}</p>
      {message && <p className="mt-1 max-w-md text-xs text-muted">{message}</p>}
      {onRetry && (
        <Button size="sm" icon={RefreshCw} onClick={onRetry} disabled={retrying} className={retrying ? 'mt-4 [&>svg]:animate-spin' : 'mt-4'}>
          {retrying ? 'Retrying…' : 'Try again'}
        </Button>
      )}
    </div>
  );
}
