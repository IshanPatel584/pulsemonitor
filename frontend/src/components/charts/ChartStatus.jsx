import ErrorState from '../ui/ErrorState';
import ChartEmptyState from './ChartEmptyState';

/**
 * Wraps a chart with the shared loading / error / empty handling for history data.
 * Renders `children` only when `status` is ready and `empty` is false.
 */
export default function ChartStatus({ status, error, onRetry, empty, emptyTitle, emptyDescription, emptyIcon, height = 240, children }) {
  if (status === 'loading' || status === 'idle') {
    return <div style={{ height }} className="skeleton rounded-md bg-hover/60" aria-busy="true" aria-label="Loading chart" />;
  }

  if (status === 'error') {
    return (
      <div style={{ minHeight: height }} className="flex items-center justify-center">
        <ErrorState title="Couldn’t load check history" message={error} onRetry={onRetry} />
      </div>
    );
  }

  if (empty) {
    return <ChartEmptyState height={height} title={emptyTitle} description={emptyDescription} icon={emptyIcon} />;
  }

  return children;
}
