import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, KeyRound, LogOut, Monitor, Moon, Palette, Sun, User } from 'lucide-react';
import { Avatar } from '../components/layout/UserMenu';
import Button from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Field from '../components/ui/Field';
import Switch from '../components/ui/Switch';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { cn } from '../lib/cn';

const SECTIONS = [
  { value: 'profile', label: 'Profile', icon: User },
  { value: 'appearance', label: 'Appearance', icon: Palette },
  { value: 'notifications', label: 'Notifications', icon: Bell },
  { value: 'account', label: 'Account', icon: KeyRound },
];

const BROWSER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const TIMEZONES = [
  ...new Set([BROWSER_TZ, 'UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney'].filter(Boolean)),
];
const ROLES = ['Engineering Lead', 'Software Engineer', 'SRE / DevOps', 'Engineering Manager', 'Other'];

function Section({ title, description, children, footer }) {
  return (
    <Card>
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-sm font-medium text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      <div className="px-5 py-5">{children}</div>
      {footer && <div className="flex items-center justify-end gap-3 border-t border-line px-5 py-3">{footer}</div>}
    </Card>
  );
}

function ProfileSettings() {
  const { profile, setProfile, notify } = useApp();
  const [form, setForm] = useState(profile);
  const [errors, setErrors] = useState({});
  const dirty = JSON.stringify(form) !== JSON.stringify(profile);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const save = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setProfile({ ...form, name: form.name.trim(), email: form.email.trim() });
    notify('Profile updated for this session. The API has no profile endpoint yet.', 'info');
  };

  return (
    <form onSubmit={save} noValidate>
      <Section
        title="Profile"
        description="How you appear in this app. Changes last for this session only — the API has no profile endpoint yet."
        footer={
          <>
            {dirty && (
              <Button variant="ghost" onClick={() => { setForm(profile); setErrors({}); }}>
                Discard
              </Button>
            )}
            <Button variant="primary" type="submit" disabled={!dirty}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="mb-5 flex items-center gap-4">
          <Avatar name={form.name || profile.name} size="lg" />
          <div>
            <p className="text-sm font-medium text-fg">{form.name || '—'}</p>
            <p className="text-xs text-muted">Avatar is generated from your initials.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="profile-name" error={errors.name}>
            <input id="profile-name" className={cn('input', errors.name && 'input-error')} value={form.name} onChange={set('name')} />
          </Field>
          <Field label="Email" htmlFor="profile-email" error={errors.email}>
            <input id="profile-email" type="email" className={cn('input', errors.email && 'input-error')} value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Role" htmlFor="profile-role">
            <select id="profile-role" className="input" value={form.role} onChange={set('role')}>
              <option value="">Not set</option>
              {ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Timezone" htmlFor="profile-tz" hint="Used for incident timestamps and reports.">
            <select id="profile-tz" className="input" value={form.timezone} onChange={set('timezone')}>
              {TIMEZONES.map((tz) => (
                <option key={tz}>{tz}</option>
              ))}
            </select>
          </Field>
        </div>
      </Section>
    </form>
  );
}

function AppearanceSettings() {
  const { theme, setTheme, sidebarCollapsed, setSidebarCollapsed, reduceMotion, setReduceMotion } = usePreferences();
  const themes = [
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <Section title="Appearance" description="Preferences are saved in this browser and apply immediately.">
      <p className="label">Theme</p>
      <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Theme">
        {themes.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            onClick={() => setTheme(value)}
            className={cn(
              'focus-ring flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-sm transition-colors',
              theme === value ? 'border-accent bg-accent/10 text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <div className="mt-5 divide-y divide-line border-t border-line">
        <Switch
          id="pref-sidebar"
          label="Collapse sidebar"
          description="Show navigation as icons only on larger screens."
          checked={sidebarCollapsed}
          onChange={setSidebarCollapsed}
        />
        <Switch
          id="pref-motion"
          label="Reduce motion"
          description="Turn off transitions and chart animations."
          checked={reduceMotion}
          onChange={setReduceMotion}
        />
      </div>
    </Section>
  );
}

const ALERT_EVENTS = [
  { key: 'down', label: 'Monitor goes down', description: 'When a check fails the configured number of times.' },
  { key: 'recovered', label: 'Monitor recovers', description: 'When a failing monitor passes again.' },
  { key: 'degraded', label: 'Response time degraded', description: 'When p95 latency exceeds 800 ms.' },
  { key: 'weekly', label: 'Weekly summary', description: 'Uptime and incident report every Monday.' },
];

function NotificationSettings() {
  const { notify } = useApp();
  const [prefs, setPrefs] = useState({
    email: true,
    slack: false,
    webhook: false,
    webhookUrl: '',
    threshold: '2',
    events: { down: true, recovered: true, degraded: false, weekly: true },
  });
  const [error, setError] = useState('');
  const toggle = (key) => (value) => setPrefs((p) => ({ ...p, [key]: value }));

  const save = (e) => {
    e.preventDefault();
    if (prefs.webhook && !/^https:\/\/\S+\.\S+/.test(prefs.webhookUrl.trim())) {
      setError('Enter an HTTPS webhook URL.');
      return;
    }
    setError('');
    notify('Notification preferences saved for this session.');
  };

  return (
    <form onSubmit={save} noValidate>
      <Section
        title="Notifications"
        description="Choose where alerts are delivered. Delivery isn't connected in this prototype."
        footer={
          <Button variant="primary" type="submit">
            Save preferences
          </Button>
        }
      >
        <p className="label">Channels</p>
        <div className="divide-y divide-line">
          <Switch id="ch-email" label="Email" description="Sent to your profile email address." checked={prefs.email} onChange={toggle('email')} />
          <Switch id="ch-slack" label="Slack" description="Post to a channel once the Slack app is installed." checked={prefs.slack} onChange={toggle('slack')} />
          <Switch id="ch-webhook" label="Webhook" description="POST a JSON payload to your endpoint." checked={prefs.webhook} onChange={toggle('webhook')} />
        </div>
        {prefs.webhook && (
          <Field className="mt-1" label="Webhook URL" htmlFor="webhook-url" error={error}>
            <input
              id="webhook-url"
              className={cn('input font-mono text-[13px]', error && 'input-error')}
              placeholder="https://hooks.example.com/pulse"
              value={prefs.webhookUrl}
              onChange={(e) => setPrefs((p) => ({ ...p, webhookUrl: e.target.value }))}
            />
          </Field>
        )}

        <p className="label mt-6">Alert me when</p>
        <div className="divide-y divide-line">
          {ALERT_EVENTS.map((ev) => (
            <Switch
              key={ev.key}
              id={`ev-${ev.key}`}
              label={ev.label}
              description={ev.description}
              checked={prefs.events[ev.key]}
              onChange={(v) => setPrefs((p) => ({ ...p, events: { ...p.events, [ev.key]: v } }))}
            />
          ))}
        </div>

        <Field className="mt-4 max-w-xs" label="Consecutive failures before alerting" htmlFor="threshold">
          <select id="threshold" className="input" value={prefs.threshold} onChange={(e) => setPrefs((p) => ({ ...p, threshold: e.target.value }))}>
            {['1', '2', '3', '5'].map((n) => (
              <option key={n} value={n}>
                {n} {n === '1' ? 'failure' : 'failures'}
              </option>
            ))}
          </select>
        </Field>
      </Section>
    </form>
  );
}

function AccountSettings() {
  const { user, logout } = useAuth();

  const signOut = async () => {
    // Signs out locally, then redirects to the landing page (see AuthContext.logout).
    await logout();
  };

  return (
    <div className="space-y-4">
      <Section title="Account" description="The account you’re signed in with.">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Email</dt>
            <dd className="mt-0.5 truncate text-sm text-fg">{user?.email || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">User ID</dt>
            <dd className="mt-0.5 truncate font-mono text-xs text-fg">{user?.id || '—'}</dd>
          </div>
        </dl>
        <div className="mt-5 border-t border-line pt-4">
          <Button icon={LogOut} onClick={signOut}>
            Sign out
          </Button>
        </div>
      </Section>

      <Section title="API keys" description="Programmatic access to your monitors.">
        <EmptyState icon={KeyRound} title="API keys aren’t available yet" description="The backend doesn’t issue API keys yet." />
      </Section>

      <Card className="border-danger/30">
        <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-medium text-fg">Delete account</h2>
            <p className="mt-0.5 text-xs text-muted">Not supported by the backend yet.</p>
          </div>
          <Button variant="danger" disabled>
            Delete account
          </Button>
        </div>
      </Card>
    </div>
  );
}

const PANELS = {
  profile: ProfileSettings,
  appearance: AppearanceSettings,
  notifications: NotificationSettings,
  account: AccountSettings,
};

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const tab = PANELS[params.get('tab')] ? params.get('tab') : 'profile';
  const Panel = PANELS[tab];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,720px)]">
      <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:px-0" aria-label="Settings sections">
        {SECTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setParams({ tab: value }, { replace: true })}
            aria-current={tab === value ? 'page' : undefined}
            className={cn(
              'focus-ring flex h-8 shrink-0 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors',
              tab === value ? 'bg-hover font-medium text-fg' : 'text-muted hover:bg-hover/60 hover:text-fg',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </nav>
      <Panel key={tab} />
    </div>
  );
}
