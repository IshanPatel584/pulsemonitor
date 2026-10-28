import { useEffect } from 'react';
import { useRevealOnScroll } from '../hooks/useMotion';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CircleCheck,
  CircleX,
  Gauge,
  History,
  Info,
  Lock,
  PlusCircle,
  Radar,
  ShieldCheck,
  Timer,
  TriangleAlert,
  X,
} from 'lucide-react';
import Logo from '../components/layout/Logo';
import DashboardPreview from '../components/marketing/DashboardPreview';
import HeroGrid from '../components/marketing/HeroGrid';
import { DASHBOARD_HOME } from '../config/navigation';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';

// ---- Small building blocks --------------------------------------------------

const button =
  'focus-ring inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px';
const buttonVariants = {
  primary: 'bg-accent text-accent-fg shadow-[0_8px_24px_-8px_rgb(var(--accent)/0.7)] hover:bg-accent/90',
  secondary: 'border border-line-strong bg-surface/80 text-fg hover:bg-hover',
  ghost: 'text-muted hover:bg-hover hover:text-fg',
};
const buttonSizes = { sm: 'h-9 px-3.5 text-sm', lg: 'h-12 px-6 text-[15px]' };

function ButtonLink({ to, href, variant = 'primary', size = 'sm', className, children }) {
  const classes = cn(button, buttonVariants[variant], buttonSizes[size], className);
  return href ? (
    <a href={href} className={classes}>
      {children}
    </a>
  ) : (
    <Link to={to} className={classes}>
      {children}
    </Link>
  );
}

function SectionHeading({ id, eyebrow, title, description, center = false }) {
  return (
    <div className={cn('max-w-2xl', center && 'mx-auto text-center')}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-balance text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
        {title}
      </h2>
      {description && <p className="mt-3 text-pretty text-[15px] leading-relaxed text-muted">{description}</p>}
    </div>
  );
}

// ---- Header & notices -------------------------------------------------------

function Header() {
  const { status } = useAuth();
  const signedIn = status === 'authenticated';

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <Link to="/" className="focus-ring rounded-md" aria-label="PulseMonitor home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted md:flex" aria-label="Page sections">
          <a href="#features" className="focus-ring rounded transition-colors hover:text-fg">
            Features
          </a>
          <a href="#how-it-works" className="focus-ring rounded transition-colors hover:text-fg">
            How it works
          </a>
          <a href="#security" className="focus-ring rounded transition-colors hover:text-fg">
            Security
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {signedIn ? (
            <ButtonLink to={DASHBOARD_HOME}>
              Open dashboard <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost">
                Log in
              </ButtonLink>
              <ButtonLink to="/signup" className="hidden min-[400px]:inline-flex">
                Start Monitoring
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** Feedback after signing out (the app redirects here from logout). */
function SignOutNotice() {
  const { notice, dismissNotice } = useAuth();
  const show = notice === 'signed_out' || notice === 'logout_failed';

  useEffect(() => {
    if (notice !== 'signed_out') return undefined;
    const id = setTimeout(dismissNotice, 6000);
    return () => clearTimeout(id);
  }, [notice, dismissNotice]);

  if (!show) return null;
  const failed = notice === 'logout_failed';
  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
      <div
        role="status"
        className={cn(
          'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm animate-fade-in',
          failed ? 'border-warning/30 bg-warning/10' : 'border-line bg-surface',
        )}
      >
        <Info className={cn('mt-0.5 h-4 w-4 shrink-0', failed ? 'text-warning' : 'text-success')} aria-hidden />
        <p className="flex-1 text-fg">
          {failed
            ? 'You’re signed out on this device, but the server couldn’t be reached to end your session. Sign in and sign out again once it’s back to fully end it.'
            : 'You’ve been signed out.'}
        </p>
        <button type="button" onClick={dismissNotice} className="focus-ring -m-1 rounded p-1 text-faint hover:text-fg" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ---- Hero ---------------------------------------------------------------------

function PrimaryCtas({ size = 'lg', center = true }) {
  const { status } = useAuth();
  if (status === 'authenticated') {
    return (
      <div className={cn('flex flex-wrap gap-3', center && 'justify-center')}>
        <ButtonLink to={DASHBOARD_HOME} size={size}>
          Open dashboard <ArrowRight className="h-4 w-4" aria-hidden />
        </ButtonLink>
        <ButtonLink href="#features" variant="secondary" size={size}>
          Explore Features
        </ButtonLink>
      </div>
    );
  }
  return (
    <div className={cn('flex flex-wrap gap-3', center && 'justify-center')}>
      <ButtonLink to="/signup" size={size}>
        Start Monitoring <ArrowRight className="h-4 w-4" aria-hidden />
      </ButtonLink>
      <ButtonLink href="#features" variant="secondary" size={size}>
        Explore Features
      </ButtonLink>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-heading">
      {/* Backdrop: faint 3D grid (follows the mouse on desktop) + accent glow (decorative) */}
      <HeroGrid />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(ellipse_60%_55%_at_50%_0%,rgb(var(--accent)/0.22),transparent_70%)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-medium text-muted backdrop-blur">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Uptime, latency, and incidents in one place
          </p>
          <h1
            id="hero-heading"
            className="mt-6 animate-fade-up text-balance text-4xl font-semibold tracking-tight text-fg [animation-delay:60ms] sm:text-5xl lg:text-6xl"
          >
            Reliable API monitoring,{' '}
            <span className="bg-gradient-to-r from-accent to-info bg-clip-text text-transparent">without the noise</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl animate-fade-up text-pretty text-base leading-relaxed text-muted [animation-delay:120ms] sm:text-lg">
            PulseMonitor checks your endpoints on a schedule, compares every response with the status code you expect, tracks response
            times, and opens an incident the moment something breaks.
          </p>
          <div className="mt-9 animate-fade-up [animation-delay:180ms]">
            <PrimaryCtas />
          </div>
        </div>

        <div className="relative mt-14 animate-fade-up [animation-delay:260ms] sm:mt-16">
          <div
            className="pointer-events-none absolute -inset-x-6 -bottom-10 top-10 rounded-[2rem] bg-accent/20 blur-3xl"
            aria-hidden
          />
          <DashboardPreview className="relative" />
          <p className="mt-3 text-center text-xs text-faint">Illustrative preview with demo data, not live monitoring results.</p>
        </div>
      </div>
    </section>
  );
}

// ---- Capabilities strip -----------------------------------------------------

const CAPABILITIES = [
  { icon: Activity, title: 'GET, POST, PUT, PATCH, DELETE', body: 'Check with the method your API expects' },
  { icon: Timer, title: '1 to 30 minute intervals', body: 'Per-monitor check schedule' },
  { icon: History, title: '30 days of history', body: 'Every check result is kept' },
  { icon: ShieldCheck, title: 'Private-network safe', body: 'Local and metadata targets blocked' },
];

function Capabilities() {
  return (
    <section className="border-y border-line bg-surface/40" aria-label="Capabilities">
      <ul className="mx-auto grid max-w-6xl grid-cols-1 gap-px px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {CAPABILITIES.map(({ icon: Icon, title, body }, i) => (
          <li key={title} data-reveal style={{ '--reveal-delay': `${i * 60}ms` }} className="flex items-start gap-3 py-6 lg:px-4 lg:first:pl-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-bg text-accent">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium text-fg">{title}</p>
              <p className="mt-0.5 text-xs text-muted">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---- Feature bento (decorative mini visuals) ------------------------------------

function UptimeStrip() {
  const down = new Set([17, 18, 41]);
  const warn = new Set([30]);
  return (
    <div className="flex h-10 items-end gap-[3px]" aria-hidden>
      {Array.from({ length: 48 }, (_, i) => (
        <span
          key={i}
          className={cn('flex-1 rounded-sm', down.has(i) ? 'h-full bg-danger/80' : warn.has(i) ? 'h-full bg-warning/80' : 'h-full bg-success/70')}
        />
      ))}
    </div>
  );
}

function Sparkline() {
  const points = [32, 30, 34, 31, 29, 36, 38, 33, 30, 27, 35, 44, 52, 60, 48, 40, 35, 31, 29, 33];
  const max = 64;
  const d = points.map((p, i) => `${(i / (points.length - 1)) * 100},${40 - (p / max) * 36}`).join(' ');
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-14 w-full" aria-hidden>
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,40 ${d} 100,40`} fill="url(#spark-fill)" />
      <polyline points={d} fill="none" stroke="rgb(var(--accent))" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function IncidentFlow() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-2xs font-medium" aria-hidden>
      <span className="inline-flex items-center gap-1.5 rounded-md border border-danger/30 bg-danger/10 px-2 py-1 text-danger">
        <TriangleAlert className="h-3 w-3" /> Check failed
      </span>
      <ArrowRight className="h-3 w-3 text-faint" />
      <span className="inline-flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-warning">Incident open</span>
      <ArrowRight className="h-3 w-3 text-faint" />
      <span className="inline-flex items-center gap-1.5 rounded-md border border-success/30 bg-success/10 px-2 py-1 text-success">
        <CircleCheck className="h-3 w-3" /> Resolved
      </span>
    </div>
  );
}

function CheckRows() {
  const rows = [
    { ok: true, code: 200, label: 'Matched expected status' },
    { ok: false, code: 503, label: 'Expected 200' },
    { ok: true, code: 200, label: 'Matched expected status' },
  ];
  return (
    <ul className="space-y-1.5" aria-hidden>
      {rows.map((r, i) => (
        <li key={i} className="flex items-center gap-2 rounded-md border border-line bg-bg px-2.5 py-1.5 text-2xs">
          {r.ok ? <CircleCheck className="h-3.5 w-3.5 text-success" /> : <CircleX className="h-3.5 w-3.5 text-danger" />}
          <span className="font-mono text-fg">{r.code}</span>
          <span className="truncate text-muted">{r.label}</span>
        </li>
      ))}
    </ul>
  );
}

function RangeBars() {
  const bars = [62, 70, 66, 74, 80, 68, 90, 76, 72, 84, 78, 88];
  return (
    <div aria-hidden>
      <div className="mb-3 inline-flex rounded-md border border-line bg-bg p-0.5 text-2xs font-medium">
        {['24h', '7d', '30d', '90d'].map((r) => (
          <span key={r} className={cn('rounded px-2 py-0.5', r === '7d' ? 'bg-hover text-fg' : 'text-faint')}>
            {r}
          </span>
        ))}
      </div>
      <div className="flex h-12 items-end gap-1">
        {bars.map((h, i) => (
          <span key={i} className="flex-1 rounded-t-sm bg-accent/60" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: Radar,
    title: 'Uptime monitoring',
    body: 'Each endpoint is checked on its own interval with the HTTP method you choose. A response that matches the expected status code is up; anything else, including timeouts and DNS failures, is down.',
    visual: <UptimeStrip />,
    className: 'lg:col-span-2',
  },
  {
    icon: Gauge,
    title: 'Response-time tracking',
    body: 'Every check records how long the endpoint took to respond, so slowdowns are visible before they turn into outages.',
    visual: <Sparkline />,
  },
  {
    icon: TriangleAlert,
    title: 'Incident detection',
    body: 'A failed check opens an incident, one per outage, and the next passing check resolves it automatically.',
    visual: <IncidentFlow />,
  },
  {
    icon: History,
    title: 'Check history',
    body: 'Status code, response time, and errors for every check, kept for 30 days per monitor.',
    visual: <CheckRows />,
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    body: 'Uptime and response-time trends with average and p95 for the last 24 hours, 7 days, or 30 days.',
    visual: <RangeBars />,
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28" aria-labelledby="features-heading">
      <SectionHeading id="features-heading"
          eyebrow="Features"
          title="Everything you need to know your APIs are healthy"
          description="Focused on the signals that matter: is it up, how fast is it, and what broke."
        />
      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body, visual, className }, i) => (
          <article
            key={title}
            data-reveal
            style={{ '--reveal-delay': `${(i % 3) * 70}ms` }}
            className={cn(
              'group flex flex-col rounded-xl border border-line bg-surface p-6 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-popover',
              className,
            )}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-inset ring-accent/20">
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
            <div className="mt-auto pt-6">{visual}</div>
          </article>
        ))}
      </div>
      <p className="mt-4 text-xs text-faint">Illustrations are decorative and use demo data.</p>
    </section>
  );
}

// ---- How it works ----------------------------------------------------------------

const STEPS = [
  { icon: PlusCircle, title: 'Add an endpoint', body: 'Enter a URL, choose the HTTP method and check interval, and set the status code you expect.' },
  { icon: Activity, title: 'Checks run on schedule', body: 'PulseMonitor requests the endpoint on every interval and records the status code, response time, and result.' },
  { icon: TriangleAlert, title: 'Know when it breaks', body: 'A failed check opens an incident on your dashboard and in notifications, and closes it when the endpoint recovers.' },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 border-y border-line bg-surface/40" aria-labelledby="how-heading">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeading id="how-heading" eyebrow="How it works" title="From URL to alerts in three steps" center />
        <ol className="relative mt-14 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-6">
          <span className="absolute left-[16%] right-[16%] top-6 hidden h-px bg-gradient-to-r from-transparent via-line-strong to-transparent md:block" aria-hidden />
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} data-reveal style={{ '--reveal-delay': `${i * 90}ms` }} className="relative flex flex-col items-center text-center">
              <span className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-bg text-accent shadow-sm">
                <Icon className="h-5 w-5" aria-hidden />
                <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent font-mono text-2xs font-semibold text-accent-fg">
                  {i + 1}
                </span>
              </span>
              <h3 className="mt-5 text-[15px] font-semibold text-fg">{title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---- Security --------------------------------------------------------------------

function Security() {
  const items = [
    { icon: Lock, title: 'Private to your account', body: 'Monitors, incidents, and check history are only visible to the account that created them.' },
    { icon: ShieldCheck, title: 'Safe outbound checks', body: 'Requests to localhost, private networks, and cloud metadata addresses are refused before they are sent.' },
    { icon: Timer, title: 'Bounded requests', body: 'Every check has a timeout, redirects are not followed, and response bodies are never downloaded.' },
  ];
  return (
    <section id="security" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-24" aria-labelledby="security-heading">
      <SectionHeading id="security-heading" eyebrow="Security" title="Built to be safe by default" />
      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        {items.map(({ icon: Icon, title, body }, i) => (
          <div key={title} data-reveal style={{ '--reveal-delay': `${i * 70}ms` }} className="rounded-xl border border-line p-5">
            <Icon className="h-5 w-5 text-accent" aria-hidden />
            <h3 className="mt-4 text-sm font-semibold text-fg">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- Closing CTA & footer ------------------------------------------------------------

function ClosingCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28">
      <div data-reveal className="relative overflow-hidden rounded-2xl border border-line bg-surface px-6 py-14 text-center sm:px-12">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_120%,rgb(var(--accent)/0.25),transparent_70%)]"
          aria-hidden
        />
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl text-balance text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            Start monitoring your first endpoint today
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
            Create an account, add a URL, and your first check runs within seconds.
          </p>
          <div className="mt-8">
            <PrimaryCtas />
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="col-span-2">
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            Uptime, response-time, and incident monitoring for HTTP APIs.
          </p>
        </div>
        <nav aria-label="Product">
          <p className="text-xs font-semibold uppercase tracking-wider text-faint">Product</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a href="#features" className="focus-ring rounded text-muted hover:text-fg">
                Features
              </a>
            </li>
            <li>
              <a href="#how-it-works" className="focus-ring rounded text-muted hover:text-fg">
                How it works
              </a>
            </li>
            <li>
              <a href="#security" className="focus-ring rounded text-muted hover:text-fg">
                Security
              </a>
            </li>
          </ul>
        </nav>
        <nav aria-label="Account">
          <p className="text-xs font-semibold uppercase tracking-wider text-faint">Account</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/login" className="focus-ring rounded text-muted hover:text-fg">
                Log in
              </Link>
            </li>
            <li>
              <Link to="/signup" className="focus-ring rounded text-muted hover:text-fg">
                Create account
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-faint sm:px-6">© {new Date().getFullYear()} PulseMonitor</p>
      </div>
    </footer>
  );
}

/**
 * Public marketing page at `/`. Fully static: it never waits for the API and
 * shows no account data. The dashboard preview uses labelled demo data.
 */
export default function Landing() {
  // Below-the-fold sections fade up once as they scroll into view.
  useRevealOnScroll();

  return (
    <div className="min-h-dvh overflow-x-clip bg-bg">
      <Header />
      <SignOutNotice />
      <main>
        <Hero />
        <Capabilities />
        <Features />
        <HowItWorks />
        <Security />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  );
}
