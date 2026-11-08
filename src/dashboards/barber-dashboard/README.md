# Barber dashboard

`/barber`. Same shell as the customer surface (`../shell`), with two working
nav sections.

## Sections

- **Overview** — today's chair, requests, upcoming and completed counts,
  revenue, clients, six-month booking activity, status split, upcoming
  appointments and recent activity.
- **Appointments** — every booking for this chair, past and upcoming, with the
  customer's profile picture, contact details, notes, a profile dialog and the
  status control.
- **Account** — read-only identity, opened from the rail foot.

## Availability

The Appointments page carries a profile card for the signed-in barber with an
available / not available toggle. The value lives on `profiles.is_available`
(migration 0012) and is returned by `list_barbers()`, so customers see the same
state when they choose a barber in the booking form.

## Data

Bookings are read through `useBookings()`. RLS narrows the rows to this barber's
chair, so Overview and Appointments share one query and one status change is
visible on both.

The customer picture is snapshotted onto the booking row
(`customer_avatar_url`), matching the other snapshot columns. Reading another
user's profile directly is still blocked by RLS.

Availability comes from the account itself through `useAuth()`. Role access
comes from `profiles.role` (migration 0008).
