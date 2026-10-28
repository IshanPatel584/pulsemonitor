import { useEffect, useRef, useState } from 'react';
import { motionReduced } from '../../hooks/useMotion';

const DURATION_MS = 450;
const NUMERIC = /^-?[\d,]*\.?\d+$/;

function parse(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { num: value, decimals: 0, grouped: false };
  }
  if (typeof value !== 'string' || !NUMERIC.test(value)) return null;
  const decimals = value.includes('.') ? value.split('.')[1].length : 0;
  return { num: Number(value.replace(/,/g, '')), decimals, grouped: value.includes(',') };
}

/**
 * Renders a stat value and, when it changes, tweens from the previous number
 * to the new one (ease-out, ~450 ms). The first render shows the value as-is,
 * so loading or polling never replays a count-up. Non-numeric values ("—")
 * render unchanged; decimals and thousands separators are kept.
 */
export default function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(parse(value)?.num ?? null);

  useEffect(() => {
    const target = parse(value);
    const from = previous.current;
    previous.current = target?.num ?? null;

    if (!target || from == null || from === target.num || motionReduced() || document.hidden) {
      setDisplay(value);
      return undefined;
    }

    const format = (n) =>
      n.toLocaleString(undefined, {
        minimumFractionDigits: target.decimals,
        maximumFractionDigits: target.decimals,
        useGrouping: target.grouped,
      });

    let frame;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - (1 - progress) ** 3;
      if (progress < 1) {
        setDisplay(format(from + (target.num - from) * eased));
        frame = requestAnimationFrame(step);
      } else {
        setDisplay(value); // land exactly on the real value
      }
    };
    frame = requestAnimationFrame(step);
    // Animation frames can be paused (background tabs); always land on the real value.
    const fallback = setTimeout(() => {
      cancelAnimationFrame(frame);
      setDisplay(value);
    }, DURATION_MS + 150);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(fallback);
    };
  }, [value]);

  return display;
}
