import { useEffect } from 'react';

/** Compact monitor picker for chart cards. Keeps `value` pointing at an existing monitor. */
export default function MonitorSelect({ monitors, value, onChange, id = 'chart-monitor' }) {
  useEffect(() => {
    if (!monitors.length) {
      if (value) onChange(null);
    } else if (!monitors.some((m) => m.id === value)) {
      onChange(monitors[0].id);
    }
  }, [monitors, value, onChange]);

  if (!monitors.length) return null;

  return (
    <>
      <label htmlFor={id} className="sr-only">
        Monitor
      </label>
      <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="input h-8 w-auto max-w-[220px] py-0 pr-8 text-xs">
        {monitors.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </>
  );
}
