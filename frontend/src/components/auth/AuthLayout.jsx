import { Link } from 'react-router-dom';
import { ArrowLeft, CircleCheck } from 'lucide-react';
import Logo from '../layout/Logo';
import DashboardPreview from '../marketing/DashboardPreview';

const POINTS = [
  'Checks on your schedule, compared with the status code you expect',
  'Response times recorded for every check',
  'Incidents that open on failure and resolve on recovery',
];

/**
 * Split layout shared by the login and signup pages: the form on the left, a
 * product panel (with a demo-data dashboard preview) on large screens.
 */
export default function AuthLayout({ title, description, children, footer }) {
  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="relative flex flex-col px-5 py-6 sm:px-10">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" className="focus-ring rounded-md" aria-label="PulseMonitor home">
            <Logo />
          </Link>
          <Link to="/" className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-muted transition-colors hover:text-fg">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to home
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[400px] animate-fade-up">
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">{title}</h1>
            {description && <p className="mt-2 text-[15px] leading-relaxed text-muted">{description}</p>}
            <div className="mt-8">{children}</div>
            {footer && <p className="mt-8 text-center text-sm text-muted">{footer}</p>}
          </div>
        </main>

        <footer className="text-xs text-faint">© {new Date().getFullYear()} PulseMonitor</footer>
      </div>

      <aside className="relative hidden overflow-hidden border-l border-line bg-surface/40 lg:flex lg:flex-col lg:justify-center lg:px-12 xl:px-16" aria-label="About PulseMonitor">
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_60%_20%,rgb(var(--accent)/0.22),transparent_70%)]"
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">API monitoring</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-fg">Know the moment an endpoint stops responding</h2>
          <ul className="mt-6 space-y-3">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-3 text-[15px] text-muted">
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
          <DashboardPreview variant="compact" className="mt-10 animate-fade-up [animation-delay:150ms]" />
        </div>
      </aside>
    </div>
  );
}
