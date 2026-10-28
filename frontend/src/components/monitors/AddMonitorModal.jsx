import { useEffect, useState } from 'react';
import { CircleAlert, KeyRound, Loader2, Plus, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CHECK_INTERVALS, HTTP_METHODS, MAX_HEADERS, validateHeaders, validateMonitor } from '../../lib/monitors';
import { cn } from '../../lib/cn';
import Button from '../ui/Button';
import Field from '../ui/Field';
import { Modal } from '../ui/Modal';

const EMPTY = { name: '', url: 'https://', method: 'GET', interval: 60, expectedStatus: '200', headers: [] };
const HEADER_SUGGESTIONS = ['Authorization', 'X-API-Key', 'Api-Key', 'Accept', 'User-Agent'];

let rowId = 0;
const headerRow = (name = '', saved = false) => ({ key: `h${(rowId += 1)}`, name, value: '', saved });

const originOf = (url) => {
  try {
    return new URL(url.trim()).origin;
  } catch {
    return url.trim();
  }
};
const COMMON_CODES = ['200', '201', '204', '301'];

// Backend field names -> form field names.
const SERVER_FIELDS = { expectedStatusCode: 'expectedStatus' };

const valuesFromMonitor = (m) => ({
  name: m.name,
  url: m.url,
  method: m.method,
  interval: m.interval,
  expectedStatus: String(m.expectedStatus),
  // Saved values are never sent to the browser; only the names are known.
  headers: (m.headerNames ?? []).map((name) => headerRow(name, true)),
});

/**
 * Optional request headers (API keys, bearer tokens). Values are write-only:
 * saved ones show as "Saved" and are kept unless a new value is typed.
 */
function HeadersField({ rows, onChange, error, disabled }) {
  const update = (key, patch) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="label mb-0">
          Request headers <span className="font-normal text-muted">(optional)</span>
        </span>
        <Button
          size="sm"
          variant="ghost"
          icon={Plus}
          disabled={disabled || rows.length >= MAX_HEADERS}
          onClick={() => onChange([...rows, headerRow()])}
        >
          Add header
        </Button>
      </div>
      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={row.key} className="flex items-start gap-2">
              <input
                aria-label={`Header ${i + 1} name`}
                className={cn('input w-[40%] font-mono text-[13px]', error && 'input-error')}
                list="monitor-header-suggestions"
                placeholder="Authorization"
                value={row.name}
                disabled={disabled}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => update(row.key, { name: e.target.value, saved: false, value: row.saved ? '' : row.value })}
              />
              <input
                aria-label={`Header ${i + 1} value`}
                type="password"
                className={cn('input min-w-0 flex-1 font-mono text-[13px]', error && 'input-error')}
                placeholder={row.saved ? 'Saved · leave blank to keep' : 'Value, e.g. Bearer …'}
                value={row.value}
                disabled={disabled}
                autoComplete="new-password"
                spellCheck={false}
                onChange={(e) => update(row.key, { value: e.target.value })}
              />
              <button
                type="button"
                onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
                disabled={disabled}
                className="focus-ring mt-0.5 rounded-md p-2 text-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-50"
                aria-label={`Remove header ${row.name || i + 1}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <datalist id="monitor-header-suggestions">
            {HEADER_SUGGESTIONS.map((h) => (
              <option key={h} value={h} />
            ))}
          </datalist>
        </div>
      )}
      {error ? (
        <p id="monitor-headers-error" className="mt-1.5 animate-fade-in text-xs text-danger" role="alert">
          {error}
        </p>
      ) : (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted">
          <KeyRound className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          For APIs that need an API key or token. Values are encrypted on the server, sent only to this URL, and never shown again.
        </p>
      )}
    </div>
  );
}

/** Create / edit monitor form. Mode comes from `monitorModal` in AppContext. */
export default function AddMonitorModal() {
  const { monitorModal, closeMonitorModal, createMonitor, updateMonitor, monitors, notify } = useApp();
  const editing = monitorModal?.mode === 'edit' ? monitorModal.monitor : null;

  const [values, setValues] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!monitorModal) return;
    setValues(editing ? valuesFromMonitor(editing) : EMPTY);
    setTouched({});
    setSubmitted(false);
    setSubmitting(false);
    setServerErrors({});
    setFormError('');
  }, [monitorModal, editing]);

  const errors = { ...validateMonitor(values, monitors, editing?.id) };
  const headersError = validateHeaders(values.headers, { originChanged: Boolean(editing) && originOf(values.url) !== originOf(editing.url) });
  if (headersError) errors.headers = headersError;
  const errorFor = (field) => (submitted || touched[field] ? errors[field] : undefined) ?? serverErrors[field];

  const set = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setServerErrors((s) => ({ ...s, [field]: undefined }));
  };
  const blur = (field) => () => setTouched((t) => ({ ...t, [field]: true }));

  const inputProps = (field) => ({
    id: `monitor-${field}`,
    value: values[field],
    onChange: set(field),
    onBlur: blur(field),
    disabled: submitting,
    'aria-invalid': Boolean(errorFor(field)),
    'aria-describedby': errorFor(field) ? `monitor-${field}-error` : undefined,
    className: cn('input', errorFor(field) && 'input-error'),
  });

  const close = () => {
    if (!submitting) closeMonitorModal();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    setFormError('');
    if (Object.keys(errors).length) {
      document.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    setSubmitting(true);
    try {
      if (editing) await updateMonitor(editing.id, values);
      else await createMonitor(values);
      closeMonitorModal();
      notify(editing ? `Saved changes to “${values.name.trim()}”.` : `Monitor “${values.name.trim()}” created.`);
    } catch (err) {
      const mapped = Object.fromEntries(Object.entries(err.fieldErrors ?? {}).map(([k, v]) => [SERVER_FIELDS[k] ?? k, v]));
      setServerErrors(mapped);
      if (!Object.keys(mapped).length) setFormError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={Boolean(monitorModal)}
      onClose={close}
      title={editing ? 'Edit monitor' : 'Add monitor'}
      description={editing ? editing.url : 'Track uptime and response time for an HTTP endpoint.'}
    >
      <form onSubmit={onSubmit} noValidate aria-busy={submitting}>
        <div className="space-y-4 px-5 py-5">
          {formError && (
            <div role="alert" className="flex gap-2.5 rounded-md border border-danger/30 bg-danger/10 px-3 py-2.5 text-xs text-danger">
              <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
              <p>{formError}</p>
            </div>
          )}

          <Field label="Monitor name" htmlFor="monitor-name" error={errorFor('name')}>
            <input {...inputProps('name')} placeholder="e.g. Checkout API" autoFocus autoComplete="off" />
          </Field>

          <Field
            label="Endpoint URL"
            htmlFor="monitor-url"
            error={errorFor('url')}
            hint="The full URL we'll request, including path."
          >
            <input {...inputProps('url')} placeholder="https://api.example.com/health" className={cn(inputProps('url').className, 'font-mono text-[13px]')} autoComplete="off" spellCheck={false} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="HTTP method" htmlFor="monitor-method" error={errorFor('method')}>
              <select {...inputProps('method')}>
                {HTTP_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Check interval" htmlFor="monitor-interval" error={errorFor('interval')}>
              <select {...inputProps('interval')}>
                {CHECK_INTERVALS.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Expected status code" htmlFor="monitor-expectedStatus" error={errorFor('expectedStatus')}>
            <div className="flex flex-wrap items-center gap-2">
              <input {...inputProps('expectedStatus')} inputMode="numeric" maxLength={3} className={cn(inputProps('expectedStatus').className, 'w-24 font-mono')} />
              {COMMON_CODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  disabled={submitting}
                  onClick={() => setValues((v) => ({ ...v, expectedStatus: code }))}
                  className={cn(
                    'focus-ring h-7 rounded-md border px-2 font-mono text-xs transition-colors disabled:opacity-50',
                    values.expectedStatus === code ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line text-muted hover:bg-hover hover:text-fg',
                  )}
                >
                  {code}
                </button>
              ))}
            </div>
          </Field>

          <HeadersField
            rows={values.headers}
            disabled={submitting}
            error={errorFor('headers')}
            onChange={(headers) => {
              setValues((v) => ({ ...v, headers }));
              setTouched((t) => ({ ...t, headers: false }));
              setServerErrors((s) => ({ ...s, headers: undefined }));
            }}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="secondary" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={submitting} icon={submitting ? Loader2 : undefined} className={submitting ? '[&>svg]:animate-spin' : undefined}>
            {submitting ? (editing ? 'Saving…' : 'Creating…') : editing ? 'Save changes' : 'Create monitor'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
