export interface Notification {
  id: string;
  title: string;
  body: string;
  when: string;
  /** Drives the blue dot in the rail of the notification panel. */
  isUnread: boolean;
}

export const NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    title: 'Your cut is confirmed',
    body: 'Kuya Ren confirmed Friday at 11:30. The reference image is attached to the booking.',
    when: '2h',
    isUnread: true,
  },
  {
    id: 'n2',
    title: 'Match score improved',
    body: 'Your Oval reading went from 71% to 92% confidence after the latest photo.',
    when: '1d',
    isUnread: true,
  },
  {
    id: 'n3',
    title: 'Marco Dela Cruz replied',
    body: 'Still checking the schedule for Tuesday at 16:00. We will let you know.',
    when: '2d',
    isUnread: false,
  },
  {
    id: 'n4',
    title: 'Three styles saved',
    body: 'Side part, quiff and low taper were added to your board on Tuesday.',
    when: '4d',
    isUnread: false,
  },
  {
    id: 'n5',
    title: 'Length check due',
    body: 'Your last three cuts ran six weeks apart. A refresh is due in about two weeks.',
    when: '6d',
    isUnread: false,
  },
];

export const UNREAD_COUNT = NOTIFICATIONS.filter((item) => item.isUnread).length;