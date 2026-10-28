import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldOff, Users } from 'lucide-react';
import {
  AdminPagination,
  DetailList,
  FilterSelect,
  ResourceError,
  RoleBadge,
  SearchInput,
  ShortId,
  TableSkeleton,
  tdClass,
  thClass,
  useQueryState,
} from '../../components/admin/AdminUI';
import IncidentStatusBadge from '../../components/incidents/IncidentStatusBadge';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { ConfirmDialog, Drawer } from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useAdminResource } from '../../hooks/useAdminResource';
import { adminApi } from '../../lib/api';
import { displayUrl, formatDateTime, formatNumber } from '../../lib/format';

const PAGE_SIZE = 20;
const SORTS = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
  { value: 'username', label: 'Username A–Z' },
  { value: 'email', label: 'Email A–Z' },
];
const ROLE_FILTERS = [
  { value: '', label: 'All roles' },
  { value: 'admin', label: 'Admins' },
  { value: 'client', label: 'Users' },
];

const toPage = (value) => (/^\d+$/.test(value) && Number(value) >= 1 ? Number(value) : 1);
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

function UserDetail({ userId, onRoleChanged }) {
  const { user: me } = useAuth();
  const { notify } = useApp();
  const [reloadKey, setReloadKey] = useState(0);
  const detail = useAdminResource(() => adminApi.user(userId), `${userId}:${reloadKey}`);
  const [confirming, setConfirming] = useState(false);

  if (detail.status !== 'ready') {
    return detail.status === 'error' ? (
      <ResourceError resource={detail} title="Couldn’t load this user" />
    ) : (
      <div className="space-y-3 p-5" aria-busy="true">
        <div className="h-4 w-40 skeleton rounded bg-hover" />
        <div className="h-24 skeleton rounded bg-hover" />
      </div>
    );
  }

  const { user, monitorCount, incidents, monitors, recentIncidents } = detail.data;
  const isSelf = me?.id === user.id;
  const nextRole = user.role === 'admin' ? 'client' : 'admin';

  const changeRole = async () => {
    const updated = await adminApi.setUserRole(user.id, nextRole);
    notify(`${updated.username} is now ${updated.role === 'admin' ? 'an admin' : 'a regular user'}.`);
    setReloadKey((k) => k + 1);
    onRoleChanged();
  };

  return (
    <div className="space-y-6 p-5">
      <DetailList
        items={[
          ['User ID', <span className="font-mono text-xs">{user.id}</span>],
          ['Username', user.username],
          ['Email', user.email],
          ['Role', <RoleBadge role={user.role} />],
          ['Registered', formatDateTime(Date.parse(user.createdAt))],
          ['Monitors', formatNumber(monitorCount)],
          ['Incidents', `${incidents.open} open · ${incidents.resolved} resolved`],
        ]}
      />

      <section className="rounded-lg border border-line p-4">
        <h3 className="text-sm font-medium text-fg">Role</h3>
        {isSelf ? (
          <p className="mt-1 text-xs text-muted">You can’t change your own role. Another admin has to do it, so the portal always keeps at least one admin.</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-muted">
              {user.role === 'admin'
                ? 'Admins can see every account, monitor and incident, and change roles.'
                : 'Regular users only see their own monitors and incidents.'}
            </p>
            <Button
              size="sm"
              variant={user.role === 'admin' ? 'danger' : 'primary'}
              icon={user.role === 'admin' ? ShieldOff : ShieldCheck}
              className="mt-3"
              onClick={() => setConfirming(true)}
            >
              {user.role === 'admin' ? 'Remove admin role' : 'Make admin'}
            </Button>
          </>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-fg">Monitors {monitorCount > monitors.length && <span className="text-xs font-normal text-muted">(latest {monitors.length})</span>}</h3>
        {monitors.length === 0 ? (
          <p className="text-xs text-muted">No monitors.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {monitors.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-fg">{m.name}</p>
                  <p className="truncate font-mono text-2xs text-muted">{displayUrl(m.url)}</p>
                </div>
                <StatusBadge status={m.status} />
              </li>
            ))}
          </ul>
        )}
        {monitorCount > 0 && (
          <Link to={`/admin/monitors?userId=${user.id}`} className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
            View all in Monitors
          </Link>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-fg">Recent incidents</h3>
        {recentIncidents.length === 0 ? (
          <p className="text-xs text-muted">No incidents.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {recentIncidents.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-fg">{i.monitor?.name ?? 'Deleted monitor'}</p>
                  <p className="truncate text-xs text-muted">{i.reason}</p>
                </div>
                <IncidentStatusBadge status={i.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={changeRole}
        tone={nextRole === 'admin' ? 'accent' : 'danger'}
        title={nextRole === 'admin' ? `Make ${user.username} an admin?` : `Remove admin role from ${user.username}?`}
        description={
          nextRole === 'admin'
            ? `${user.email} will be able to see every account, monitor and incident, and change other users’ roles.`
            : `${user.email} will lose access to the Admin Portal immediately and keep only their own monitors.`
        }
        confirmLabel={nextRole === 'admin' ? 'Make admin' : 'Remove admin role'}
        busyLabel="Saving…"
      />
    </div>
  );
}

export default function AdminUsers() {
  const [query, setQuery] = useQueryState({ page: '1', search: '', role: '', sort: '-createdAt' });
  const page = toPage(query.page);
  const [selected, setSelected] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const params = { page, limit: PAGE_SIZE, search: query.search, role: query.role, sort: query.sort };
  const users = useAdminResource(() => adminApi.users(params), `${JSON.stringify(params)}:${reloadKey}`);
  const data = users.data;
  const filtered = Boolean(query.search || query.role);

  return (
    <>
      <PageHeader description="Every registered account. Passwords and sessions are never sent to the browser." />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
          <SearchInput value={query.search} onChange={(search) => setQuery({ search })} placeholder="Search username or email" />
          <FilterSelect label="Role" value={query.role} onChange={(role) => setQuery({ role })} options={ROLE_FILTERS} />
          <FilterSelect label="Sort" value={query.sort} onChange={(sort) => setQuery({ sort })} options={SORTS} className="sm:ml-auto" />
        </div>

        {users.status === 'error' ? (
          <ResourceError resource={users} title="Couldn’t load users" />
        ) : !data ? (
          <TableSkeleton columns={5} />
        ) : data.users.length === 0 && page > 1 ? (
          <EmptyState
            icon={Users}
            title="This page is empty"
            description={`There are ${data.total} matching users, on ${data.totalPages} page${data.totalPages === 1 ? '' : 's'}.`}
            action={<Button size="sm" onClick={() => setQuery({ page: 1 })}>Go to page 1</Button>}
          />
        ) : data.users.length === 0 ? (
          <EmptyState
            icon={Users}
            title={filtered ? 'No users match these filters' : 'No users yet'}
            description={filtered ? 'Try a different search or role.' : 'Accounts appear here as people sign up.'}
            action={filtered && <Button size="sm" onClick={() => setQuery({ search: '', role: '' })}>Clear filters</Button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-line bg-hover/30">
                  <tr>
                    <th className={thClass}>User</th>
                    <th className={thClass}>ID</th>
                    <th className={thClass}>Role</th>
                    <th className={`${thClass} text-right`}>Monitors</th>
                    <th className={thClass}>Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.users.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => setSelected(u)}
                      className="cursor-pointer transition-colors hover:bg-hover/50"
                    >
                      <td className={tdClass}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(u);
                          }}
                          className="focus-ring block max-w-[280px] rounded text-left"
                        >
                          <span className="block truncate font-medium text-fg">{u.username}</span>
                          <span className="block truncate text-xs text-muted">{u.email}</span>
                        </button>
                      </td>
                      <td className={tdClass}>
                        <ShortId id={u.id} />
                      </td>
                      <td className={tdClass}>
                        <RoleBadge role={u.role} />
                      </td>
                      <td className={`${tdClass} text-right tabular-nums text-muted`}>{u.monitorCount}</td>
                      <td className={`${tdClass} whitespace-nowrap text-muted`}>{formatDate(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPagination {...data} busy={users.refreshing} onPageChange={(p) => setQuery({ page: p })} />
          </>
        )}
      </Card>

      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.username ?? 'User'} description={selected?.email}>
        {selected && <UserDetail userId={selected.id} onRoleChanged={() => setReloadKey((k) => k + 1)} />}
      </Drawer>
    </>
  );
}
