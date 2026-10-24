import { useLayoutEffect } from 'react';

/**
 * Applies the dashboard's desktop type step for as long as the route is
 * mounted.
 *
 * Every length in dashboard.css is rem, so the only lever that scales the type
 * (and the rail with it) is the root size. Marking the document here keeps the
 * step out of the marketing pages. Layout effect, not effect, so the larger
 * size is in place before the first paint. Media queries are untouched: rem
 * inside them is relative to the initial 16px, not to this rule.
 */
export const useDashboardScale = (): void => {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add('trim-dash-active');
    return () => root.classList.remove('trim-dash-active');
  }, []);
};
