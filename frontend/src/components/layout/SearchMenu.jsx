import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { displayUrl } from '../../lib/format';
import { filterMonitors } from '../../lib/monitors';
import { Dropdown, useDropdownClose } from '../ui/Dropdown';
import { StatusDot } from '../ui/StatusBadge';

function SearchPanel() {
  const { monitors } = useApp();
  const navigate = useNavigate();
  const close = useDropdownClose();
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const results = query.trim() ? filterMonitors(monitors, { query }).slice(0, 6) : monitors.slice(0, 5);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const go = (q) => {
    navigate(q ? `/monitors?q=${encodeURIComponent(q)}` : '/monitors');
    close();
  };

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(query.trim());
        }}
        className="flex items-center gap-2 border-b border-line px-2 pb-1"
      >
        <Search className="h-4 w-4 shrink-0 text-faint" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search monitors by name or URL…"
          className="h-9 w-full bg-transparent text-sm text-fg placeholder:text-faint focus:outline-none"
          aria-label="Search monitors"
        />
      </form>
      <div className="max-h-72 overflow-y-auto py-1">
        <p className="px-2 pb-1 pt-1.5 text-xs font-medium text-faint">Monitors</p>
        {results.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted">No monitors match “{query}”.</p>
        ) : (
          results.map((m) => (
            <button
              key={m.id}
              type="button"
              role="menuitem"
              onClick={() => go(m.name)}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-none hover:bg-hover focus-visible:bg-hover"
            >
              <StatusDot status={m.status} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-fg">{m.name}</span>
                <span className="block truncate font-mono text-2xs text-muted">{displayUrl(m.url)}</span>
              </span>
            </button>
          ))
        )}
        {query.trim() && (
          <button
            type="button"
            role="menuitem"
            onClick={() => go(query.trim())}
            className="mt-1 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-muted outline-none hover:bg-hover hover:text-fg focus-visible:bg-hover"
          >
            View all results on Monitors <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function SearchMenu() {
  const triggerRef = useRef(null);

  // "/" opens search from anywhere outside a text field.
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
        e.preventDefault();
        triggerRef.current?.click();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Dropdown
      width={360}
      trigger={({ ref, open, ...props }) => (
        <button
          {...props}
          ref={(el) => {
            ref.current = el;
            triggerRef.current = el;
          }}
          type="button"
          aria-label="Search"
          title="Search ( / )"
          className="focus-ring flex h-8 items-center gap-2 rounded-md text-muted transition-colors hover:bg-hover hover:text-fg sm:w-56 sm:border sm:border-line sm:px-2.5 max-sm:w-8 max-sm:justify-center"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden flex-1 text-left text-xs text-faint sm:inline">Search monitors…</span>
          <kbd className="hidden rounded border border-line px-1.5 font-mono text-2xs text-faint sm:inline">/</kbd>
        </button>
      )}
    >
      <SearchPanel />
    </Dropdown>
  );
}
