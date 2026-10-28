export default function Logo({ showName = true }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-fg">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2.5 12.5h4l2-5 4.5 10 2.5-5h6" />
        </svg>
      </span>
      {showName && <span className="truncate text-[15px] font-semibold tracking-tight text-fg">PulseMonitor</span>}
    </span>
  );
}
