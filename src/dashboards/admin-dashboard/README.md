# Admin dashboard

`/admin`. Rail plus section, the same shell as `../customer-dashboard`; the
shared pieces live in `../shell` and the stylesheet is `../shell/dashboard.css`.

## Sections

- **Overview** — account counts, newest accounts
- **User Manager** — every account, with the role select as the only write
- **Barber Manager** — the barber subset, plus the shop gap
- **Bookings** — empty state until a bookings table exists
- **Style Library** — the catalogue from `../customer-dashboard/face/catalog`
- **Account** — read-only identity, opened from the rail foot

## Data

`useAccounts` reads `admin_list_accounts()` and writes through
`admin_set_role()`, both created by
`supabase/migrations/0008_staff_roles.sql`. Neither exists until that migration
is applied; the pages name the missing migration instead of showing zeros.

Role is enforced twice: `RequireAuth` sends the wrong role to its own
dashboard, and the two RPCs re-check the caller in the database.

## Not built yet

Shop records, booking oversight and catalogue editing all need tables that do
not exist. The pages say so rather than rendering sample rows.
