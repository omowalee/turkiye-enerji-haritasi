import { memo, useEffect, useRef } from "react";

interface AnimatedValueProps {
  value: number;
  format: (val: number) => string;
  durationMs?: number;
  className?: string;
}

/**
 * Sayıları React yeniden render'ı tetiklemeden doğrudan DOM üzerinden
 * 60 fps akıcılıkla yuvarlayarak (cubic-out) güncelleyen bileşen.
 */
export const AnimatedValue = memo(function AnimatedValue({
  value,
  format,
  durationMs = 380,
  className,
}: AnimatedValueProps) {
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const currentValRef = useRef<number>(value);
  const formatRef = useRef(format);
  formatRef.current = format;

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    const startVal = currentValRef.current;
    const endVal = value;

    if (
      Math.abs(endVal - startVal) < 0.005 ||
      durationMs <= 0 ||
      typeof window === "undefined"
    ) {
      currentValRef.current = endVal;
      el.textContent = formatRef.current(endVal);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Cubic ease-out: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextVal = startVal + (endVal - startVal) * eased;
      currentValRef.current = nextVal;

      if (spanRef.current) {
        spanRef.current.textContent = formatRef.current(nextVal);
      }

      if (progress < 1) {
        rafId = window.requestAnimationFrame(step);
      } else {
        currentValRef.current = endVal;
        if (spanRef.current) {
          spanRef.current.textContent = formatRef.current(endVal);
        }
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [value, durationMs]);

  return (
    <span ref={spanRef} className={className}>
      {format(value)}
    </span>
  );
});
