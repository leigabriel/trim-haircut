import {
  BookmarkSquare2,
  FaceScanCircle,
  Handshake,
  HomeSmile2,
  StarFall4,
} from 'reicon-react';

import type { DashboardNavItem } from '../shell/types';

export type DashboardView =
  | 'overview'
  | 'recommendation'
  | 'face-shape'
  | 'booking'
  | 'ai'
  | 'account';

/**
 * Rail order. Account is absent on purpose: it opens from the identity block at
 * the foot of the rail, and listing it twice gave two ways into one page.
 *
 * No blurbs: each restated the section's own standfirst, and two lines per item
 * made five links feel crowded.
 *
 * Icons are Reicon components rather than inline path data, so they are typed,
 * share one weight, and inherit currentColor without each one restating it.
 */
export const DASHBOARD_NAV: DashboardNavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: HomeSmile2,
  },
  {
    id: 'recommendation',
    label: 'Recommendation',
    icon: StarFall4,
  },
  {
    id: 'face-shape',
    label: 'Faceshape Analyzer',
    icon: FaceScanCircle,
  },
  {
    id: 'booking',
    label: 'Booking',
    icon: BookmarkSquare2,
  },
  {
    id: 'ai',
    label: 'Trimo',
    icon: Handshake,
  },
];

export interface Metric {
  label: string;
  value: string;
  delta: string;
  /** True when the delta is an improvement. */
  isGood: boolean;
}

export interface BookingRow {
  id: string;
  barber: string;
  shop: string;
  service: string;
  when: string;
  status: 'Confirmed' | 'Requested' | 'Completed';
  price: string;
}

export const BOOKING_METRICS: Metric[] = [
  { label: 'Upcoming', value: '2', delta: '1 awaiting reply', isGood: false },
  { label: 'Completed', value: '7', delta: 'since August', isGood: true },
  { label: 'Spend', value: 'P 3,240', delta: 'across 4 visits', isGood: true },
  { label: 'Usual barber', value: 'Kuya Ren', delta: '5 of 7 cuts', isGood: true },
];

export const AI_PROMPTS = [
  'What should I ask for if I want to keep it low maintenance?',
  'How do I describe this reference to a barber?',
  'How long will this cut last before I need a refresh?',
  'What does a 1.5 grade taper actually mean?',
  'Will this suit a square jaw if I grow it out?',
  'How short can the sides go and still look intentional?',
];

/** Answers shown under the prompts. */
export const AI_ANSWERS = [
  {
    q: 'What does a 1.5 grade taper actually mean?',
    a: 'A 1.5 is where the clipper guard stops and you switch to a scissor-over-comb. The blend is soft, so it grows out over two to three weeks without a hard shelf.',
  },
  {
    q: 'How long before I need a refresh?',
    a: 'Your last three cuts ran six weeks apart at about 1.4cm a month. Book a week before the shape starts to break, so around week five.',
  },
  {
    q: 'Can I keep it low maintenance?',
    a: 'Keep length through the top so the part line loses itself, and keep the fade grade at or below 1.5 so there is no hard shadow to correct.',
  },
];

export const BOOKINGS: BookingRow[] = [
  {
    id: 'b1',
    barber: 'Kuya Ren',
    shop: 'Trim Â· Quezon City',
    service: 'Textured crop, 1.5 taper',
    when: 'Fri 14 Nov, 11:30',
    status: 'Confirmed',
    price: 'P 480',
  },
  {
    id: 'b2',
    barber: 'Marco Dela Cruz',
    shop: 'Trim Â· Makati',
    service: 'Beard line-up',
    when: 'Tue 19 Nov, 16:00',
    status: 'Requested',
    price: 'P 220',
  },
  {
    id: 'b3',
    barber: 'Kuya Ren',
    shop: 'Trim Â· Quezon City',
    service: 'Low taper refresh',
    when: 'Sat 26 Oct, 11:30',
    status: 'Completed',
    price: 'P 420',
  },
  {
    id: 'b4',
    barber: 'Jonas Lim',
    shop: 'Trim Â· BGC',
    service: 'Full cut and wash',
    when: 'Sat 12 Oct, 14:00',
    status: 'Completed',
    price: 'P 560',
  },
];
