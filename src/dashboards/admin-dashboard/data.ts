import { Calendar2, Chart2, GalleryStar, Profile2user, Scissors } from 'reicon-react';

import type { DashboardNavItem } from '../shell/types';

export type AdminView = 'overview' | 'users' | 'barbers' | 'bookings' | 'catalog' | 'account';

/**
 * Admin rail. Account, like on every dashboard, opens from the identity block
 * rather than taking a sixth slot.
 */
export const ADMIN_NAV: DashboardNavItem[] = [
  { id: 'overview', label: 'Overview', icon: Chart2 },
  { id: 'users', label: 'User Manager', icon: Profile2user },
  { id: 'barbers', label: 'Barber Manager', icon: Scissors },
  { id: 'bookings', label: 'Bookings', icon: Calendar2 },
  { id: 'catalog', label: 'Style Library', icon: GalleryStar },
];
