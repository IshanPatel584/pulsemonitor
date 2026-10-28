import { useRef, useState } from 'react';
import { CircleAlert, Loader2 } from 'lucide-react';
import { friendlyAuthMessage } from '../../lib/authValidation';
import { cn } from '../../lib/cn';
import Field from '../ui/Field';
import PasswordInput from './PasswordInput';

/**
 * Shared login/signup form.
 *
 * - `fields`: [{ name, label, type, autoComplete, hint }]; type "password" gets a visibility toggle.
 * - `validate(values)` returns { field: message } and runs on blur and on submit.
 * - `onSubmit(values)` may throw an ApiError; its `fieldErrors` show inline and
 *   other errors (network, timeout) show in a banner above the form.
 * Only the fields the caller sends to the API are its business: `onSubmit` picks them.
 */
export default function AuthForm({ fields, submitLabel, busyLabel, onSubmit, validate }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.name, ''])));
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // A ref, not state: blocks a second submit even before React re-renders (double click / Enter).
  const inFlight = useRef(false);
  const formRef = useRef(null);

  const clientErrors = validate ? validate(values) : {};
  const errorFor = (name) => serverErrors[name] ?? ((submitted || touched[name]) && clientErrors[name]) ?? undefined;

  const submit = async (e) => {
    e.preventDefault();
    if (inFlight.current) return;
    setSubmitted(true);
    setFormError('');
    setServerErrors({});

    if (Object.keys(clientErrors).length) {
      formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      await onSubmit(values);
      // On success the page redirects; this component unmounts.
    } catch (err) {
      const fieldErrors = Object.fromEntries(Object.entries(err?.fieldErrors ?? {}).map(([k, v]) => [k, friendlyAuthMessage(v)]));
      const visible = Object.keys(fieldErrors).filter((k) => fields.some((f) => f.name === k));
      setServerErrors(fieldErrors);
      if (!visible.length) setFormError(friendlyAuthMessage(err?.message || 'Something went wrong. Please try again.'));
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate aria-busy={submitting} className="space-y-5">
      {formError && (
        <div role="alert" className="flex animate-fade-in gap-2.5 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-fg">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
          <p>{formError}</p>
        </div>
      )}

      {fields.map((field, i) => {
        const id = `auth-${field.name}`;
        const error = errorFor(field.name);
        const inputProps = {
          id,
          name: field.name,
          autoComplete: field.autoComplete,
          autoFocus: i === 0,
          disabled: submitting,
          value: values[field.name],
          onChange: (e) => {
            const value = e.target.value;
            setValues((v) => ({ ...v, [field.name]: value }));
            setServerErrors((errs) => (errs[field.name] ? { ...errs, [field.name]: undefined } : errs));
          },
          onBlur: () => setTouched((t) => ({ ...t, [field.name]: true })),
          'aria-invalid': Boolean(error),
          'aria-describedby': error ? `${id}-error` : field.hint ? `${id}-hint` : undefined,
          className: cn('input h-11 rounded-lg px-3.5 text-[15px]', error && 'input-error'),
        };
        return (
          <Field key={field.name} label={field.label} htmlFor={id} error={error} hint={field.hint}>
            {field.type === 'password' ? <PasswordInput {...inputProps} /> : <input type={field.type ?? 'text'} {...inputProps} />}
          </Field>
        );
      })}

      <button
        type="submit"
        disabled={submitting}
        className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[15px] font-medium text-accent-fg shadow-[0_8px_24px_-10px_rgb(var(--accent)/0.8)] transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {submitting ? busyLabel : submitLabel}
      </button>
    </form>
  );
}
