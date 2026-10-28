import { Lock } from 'lucide-react';
import { DetailList, ResourceError } from '../../components/admin/AdminUI';
import PageHeader from '../../components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { useAdminResource } from '../../hooks/useAdminResource';
import { adminApi } from '../../lib/api';
import { formatDuration, formatMs } from '../../lib/format';

const code = (text) => <code className="rounded bg-hover px-1.5 py-0.5 font-mono text-xs text-fg">{text}</code>;

export default function AdminSettings() {
  const settings = useAdminResource(adminApi.settings, 'settings');
  const s = settings.data;

  return (
    <>
      <PageHeader description="Effective server configuration. These values come from environment variables and are read-only here." />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Configuration" description="Restart the backend after changing backend/.env." action={<Lock className="h-4 w-4 text-faint" aria-label="Read-only" />} />
          <CardBody className="pt-1">
            {settings.status === 'error' ? (
              <ResourceError resource={settings} title="Couldn’t load settings" />
            ) : !s ? (
              <div className="h-64 skeleton rounded bg-hover/60" aria-busy="true" />
            ) : (
              <DetailList
                items={[
                  ['Environment', s.environment],
                  ['Session lifetime', <>{formatDuration(s.sessionTtlSeconds * 1000)} {code('JWT_TTL_SECONDS')}</>],
                  ['Cookie SameSite', <>{s.cookieSameSite} {code('COOKIE_SAME_SITE')}</>],
                  ['Secure cookies', <>{s.cookieSecure ? 'Yes' : 'No (HTTP allowed)'} {code('COOKIE_SECURE')}</>],
                  ['Check result retention', <>{s.checkRetentionDays} days {code('CHECK_RETENTION_DAYS')}</>],
                  ['Check timeout', <>{formatMs(s.monitorTimeoutMs)} {code('MONITOR_TIMEOUT_MS')}</>],
                  ['Max concurrent checks', <>{s.maxConcurrentChecks} {code('MONITOR_MAX_CONCURRENCY')}</>],
                  ['Scheduler tick', `${s.schedulerTickSeconds} s`],
                  ['Minimum monitor interval', `${s.minMonitorIntervalSeconds} s`],
                  ['SSRF protection', s.ssrfProtection ? 'On (private and internal addresses are blocked)' : 'Off'],
                  ['JWT secret', 'Set (never shown)'],
                ]}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Managing admins" description="How the admin role is granted" />
          <CardBody className="space-y-3 pt-1 text-sm text-muted">
            <p>
              Admins can promote or demote other accounts from <span className="text-fg">Users</span>. You can’t change your own role, so
              there is always at least one admin.
            </p>
            <p>The first admin is created on the server, not in the app. Sign up normally, then run this in the backend folder:</p>
            <pre className="overflow-x-auto rounded-md border border-line bg-hover/50 px-3 py-2 font-mono text-xs text-fg">
              npm run set-role -- --email you@example.com --role admin
            </pre>
            <p>Sign-up never accepts a role, and there is no API route for granting admin to yourself.</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
