import { Calendar2, Chart2, DocumentText, Profile2user, Scissors } from 'reicon-react';

import type { DashboardNavItem } from '../shell/types';

export type AdminView =
  | 'overview'
  | 'users'
  | 'barbers'
  | 'bookings'
  | 'reports'
  | 'account';

/**
 * Admin rail. Account, like on every dashboard, opens from the identity block
 * rather than taking a nav slot.
 */
export const ADMIN_NAV: DashboardNavItem[] = [
  { id: 'overview', label: 'Overview', icon: Chart2 },
  { id: 'users', label: 'User Manager', icon: Profile2user },
  { id: 'barbers', label: 'Barber Manager', icon: Scissors },
  { id: 'bookings', label: 'Bookings', icon: Calendar2 },
  { id: 'reports', label: 'Reports', icon: DocumentText },
];
