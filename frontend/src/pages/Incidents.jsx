import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleCheck, X } from 'lucide-react';
import IncidentDetail from '../components/incidents/IncidentDetail';
import IncidentList, { incidentMonitorName } from '../components/incidents/IncidentList';
import PageHeader from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { Drawer } from '../components/ui/Modal';
import Tabs from '../components/ui/Tabs';
import { useApp } from '../context/AppContext';
import { useMediaQuery } from '../hooks/useMediaQuery';

function ListSkeleton() {
  return (
    <ul className="divide-y divide-line" aria-busy="true" aria-label="Loading incidents">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="flex gap-3 px-4 py-3 sm:px-5">
          <span className="mt-1 h-8 w-0.5 rounded-full bg-hover" />
          <span className="flex-1 space-y-1.5">
            <span className="block h-3.5 w-40 skeleton rounded bg-hover" />
            <span className="block h-3 w-64 max-w-full skeleton rounded bg-hover" />
            <span className="block h-3 w-24 skeleton rounded bg-hover" />
          </span>
          <span className="h-5 w-16 skeleton rounded bg-hover" />
        </li>
      ))}
    </ul>
  );
}

export default function Incidents() {
  const { incidents, incidentsStatus, incidentsError, refreshIncidents, monitors } = useApp();
  const [params, setParams] = useSearchParams();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const loading = incidentsStatus === 'loading' || incidentsStatus === 'idle';

  const linkedId = params.get('id');
  const monitorFilter = params.get('monitor');
  const linked = incidents.find((i) => i.id === linkedId);

  const [tab, setTab] = useState('open');
  const [selectedId, setSelectedId] = useState(linkedId);
  const [drawerOpen, setDrawerOpen] = useState(Boolean(linkedId));

  // Follow deep links from notifications (?id=<incident id>) once incidents have loaded.
  useEffect(() => {
    if (!linked) return;
    setTab(linked.status);
    setSelectedId(linked.id);
    setDrawerOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedId, Boolean(linked)]);

  const scoped = useMemo(() => incidents.filter((i) => !monitorFilter || i.monitorId === monitorFilter), [incidents, monitorFilter]);

  const list = scoped.filter((i) => i.status === tab);
  const selected = scoped.find((i) => i.id === selectedId && i.status === tab) ?? (isDesktop ? list[0] : null);

  const openCount = scoped.filter((i) => i.status === 'open').length;
  const resolvedCount = scoped.length - openCount;
  const monitorName =
    monitorFilter && (monitors.find((m) => m.id === monitorFilter)?.name ?? incidents.find((i) => i.monitorId === monitorFilter)?.monitorName);

  const clearMonitorFilter = () => {
    const next = new URLSearchParams(params);
    next.delete('monitor');
    setParams(next, { replace: true });
  };

  const detail = selected && <IncidentDetail incident={selected} hideTitle={!isDesktop} />;

  let body;
  if (incidentsStatus === 'error') {
    body = <ErrorState title="Couldn’t load incidents" message={incidentsError} onRetry={() => refreshIncidents().catch(() => {})} />;
  } else if (loading) {
    body = <ListSkeleton />;
  } else if (list.length) {
    body = (
      <IncidentList
        incidents={list}
        selectedId={selected?.id}
        onSelect={(inc) => {
          setSelectedId(inc.id);
          setDrawerOpen(true);
        }}
      />
    );
  } else {
    body = (
      <EmptyState
        icon={CircleCheck}
        title={tab === 'open' ? 'No open incidents' : 'No resolved incidents'}
        description={
          tab === 'open'
            ? 'An incident opens automatically when a monitor’s check fails.'
            : 'Incidents move here when their monitor passes a check again.'
        }
      />
    );
  }

  return (
    <>
      <PageHeader description="Outages detected across your monitors. Incidents open when a check fails and resolve when it passes again." />

      {monitorFilter && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1 text-xs text-muted">
          Monitor: <span className="font-medium text-fg">{monitorName ?? 'Deleted monitor'}</span>
          <button
            type="button"
            onClick={clearMonitorFilter}
            className="focus-ring -mr-1.5 flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-hover hover:text-fg"
            aria-label="Clear monitor filter"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <Card className="min-w-0">
          <Tabs
            className="px-4 pt-2 sm:px-5"
            value={tab}
            onChange={(v) => {
              setTab(v);
              setSelectedId(null);
            }}
            tabs={[
              { value: 'open', label: 'Open', count: loading ? undefined : openCount },
              { value: 'resolved', label: 'Resolved', count: loading ? undefined : resolvedCount },
            ]}
          />
          {body}
        </Card>

        {isDesktop && (
          <Card className="sticky top-20 max-h-[calc(100dvh-6.5rem)] self-start overflow-y-auto">
            {selected ? (
              <>
                <div className="border-b border-line px-5 py-3 text-xs font-medium text-muted">Incident details</div>
                {detail}
              </>
            ) : (
              <EmptyState
                title="No incident selected"
                description={loading ? 'Loading incidents…' : 'Select an incident to see its details and timeline.'}
              />
            )}
          </Card>
        )}
      </div>

      {!isDesktop && (
        <Drawer open={drawerOpen && Boolean(selected)} onClose={() => setDrawerOpen(false)} title={selected ? incidentMonitorName(selected) : ''}>
          {detail}
        </Drawer>
      )}
    </>
  );
}
