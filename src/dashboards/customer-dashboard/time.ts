/**
 * Relative labels for activity rows and notifications. Shared so a booking and
 * a chat that happened at the same time do not describe it differently.
 */
export const relativeTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Unknown';

  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 0) {
    const ahead = Math.abs(minutes);
    if (ahead < 60) return `in ${ahead} min`;
    if (ahead < 60 * 24) return `in ${Math.round(ahead / 60)} hr`;
    return `in ${Math.round(ahead / (60 * 24))} days`;
  }
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} hr ago`;
  if (minutes < 60 * 24 * 7) return `${Math.round(minutes / (60 * 24))} days ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};
