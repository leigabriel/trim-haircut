# Barber dashboard

`/barber`. Same shell as the customer surface (`../shell`), with a rail that
follows the working day.

## Sections

- **Today** — the day's appointments, with booking counts left blank until they exist
- **Appointments** — every booking for this chair, past and upcoming
- **Availability** — working hours, days off, cut-off
- **Clients** — derived from completed appointments
- **Services** — the per-shop menu and prices
- **Account** — read-only identity, opened from the rail foot

## Data

There is no bookings, availability, client or services table yet, so those four
pages render an explicit empty state. Today's member-since figure is real; the
appointment counts are em dashes rather than zero, because "nothing booked" and
"nothing stored" are different statements.

The only live data on this dashboard is the account itself, through
`useAuth()`. Role access comes from `profiles.role` (migration 0008).
