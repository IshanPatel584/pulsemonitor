import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';

const DropdownContext = createContext(() => {});

/** Close the enclosing dropdown from custom content. */
export const useDropdownClose = () => useContext(DropdownContext);

/**
 * Portal-based dropdown so menus aren't clipped by scrolling tables.
 * `trigger` is a render prop that receives the props to spread on a button.
 */
export function Dropdown({ trigger, children, align = 'end', width = 208, className, onOpenChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const setOpenState = useCallback(
    (next) => {
      setOpen(next);
      if (!next) setPos(null);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const close = useCallback(() => setOpenState(false), [setOpenState]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current.offsetHeight;
    const fitsBelow = window.innerHeight - rect.bottom > menuHeight + 8;
    const top = fitsBelow || rect.top < menuHeight + 8 ? rect.bottom + 6 : rect.top - menuHeight - 6;
    const menuWidth = Math.min(width, window.innerWidth - 16);
    const rawLeft = align === 'end' ? rect.right - menuWidth : rect.left;
    const left = Math.max(8, Math.min(rawLeft, window.innerWidth - menuWidth - 8));
    const below = top >= rect.bottom;
    setPos({ top, left, width: menuWidth, origin: `${below ? 'top' : 'bottom'} ${align === 'end' ? 'right' : 'left'}` });
  }, [open, align, width]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        close();
        triggerRef.current?.focus();
      }
    };
    const onScroll = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      close();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  const onMenuKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [...menuRef.current.querySelectorAll('[role="menuitem"]:not(:disabled)')];
    if (!items.length) return;
    e.preventDefault();
    const index = items.indexOf(document.activeElement);
    const next = e.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
    items[next].focus();
  };

  return (
    <>
      {trigger({
        ref: triggerRef,
        onClick: () => setOpenState(!open),
        'aria-expanded': open,
        'aria-haspopup': 'menu',
        open,
      })}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onKeyDown={onMenuKeyDown}
            style={{
              position: 'fixed',
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              width: pos?.width ?? width,
              visibility: pos ? 'visible' : 'hidden',
              transformOrigin: pos?.origin,
            }}
            className={cn('z-50 rounded-lg border border-line bg-elevated p-1 shadow-popover', pos && 'animate-menu-in', className)}
          >
            <DropdownContext.Provider value={close}>{children}</DropdownContext.Provider>
          </div>,
          document.body,
        )}
    </>
  );
}

export function DropdownItem({ icon: Icon, children, onSelect, tone, disabled, hint }) {
  const close = useDropdownClose();
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        onSelect?.();
        close();
      }}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-hover focus-visible:bg-hover disabled:opacity-50',
        tone === 'danger' ? 'text-danger' : 'text-fg',
      )}
    >
      {Icon && <Icon className={cn('h-4 w-4 shrink-0', tone === 'danger' ? 'text-danger' : 'text-muted')} aria-hidden />}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </button>
  );
}

export function DropdownLabel({ children }) {
  return <div className="px-2 pb-1 pt-1.5 text-xs font-medium text-faint">{children}</div>;
}

export function DropdownSeparator() {
  return <div className="-mx-1 my-1 h-px bg-line" role="separator" />;
}
