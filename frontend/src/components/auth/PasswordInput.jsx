import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/cn';

/** Password field with an accessible show/hide toggle. Forwards every input prop. */
const PasswordInput = forwardRef(function PasswordInput({ className, disabled, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input ref={ref} type={visible ? 'text' : 'password'} disabled={disabled} className={cn(className, 'pr-11')} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        aria-controls={props.id}
        className="focus-ring absolute inset-y-0 right-1 my-auto flex h-8 w-8 items-center justify-center rounded-md text-faint transition-colors hover:bg-hover hover:text-fg disabled:opacity-50"
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
});

export default PasswordInput;
