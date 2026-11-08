import { Calendar2, HomeSmile2 } from 'reicon-react';

import type { DashboardNavItem } from '../shell/types';

export type BarberView = 'overview' | 'appointments' | 'account';

/**
 * Barber rail. Overview carries the day and the analytics; Appointments is the
 * full chair history. Account remains reachable from the identity block at the
 * foot of the rail.
 */
export const BARBER_NAV: DashboardNavItem[] = [
  { id: 'overview', label: 'Overview', icon: HomeSmile2 },
  { id: 'appointments', label: 'Appointments', icon: Calendar2 },
];
