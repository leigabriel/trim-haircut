import { Calendar2, Clock, HomeSmile2, People, Scissors } from 'reicon-react';

import type { DashboardNavItem } from '../shell/types';

export type BarberView =
  | 'today'
  | 'appointments'
  | 'availability'
  | 'clients'
  | 'services'
  | 'account';

/**
 * Barber rail. The order follows the working day: what is happening now, what
 * is booked next, when the chair is open, who sits in it, what is on the menu.
 */
export const BARBER_NAV: DashboardNavItem[] = [
  { id: 'today', label: 'Today', icon: HomeSmile2 },
  { id: 'appointments', label: 'Appointments', icon: Calendar2 },
  { id: 'availability', label: 'Availability', icon: Clock },
  { id: 'clients', label: 'Clients', icon: People },
  { id: 'services', label: 'Services', icon: Scissors },
];
