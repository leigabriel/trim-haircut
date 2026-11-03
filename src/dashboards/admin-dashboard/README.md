# Admin dashboard

`/admin`. Rail plus section, the same shell as `../customer-dashboard`; the
shared pieces live in `../shell` and the stylesheet is `../shell/dashboard.css`.
The admin-only additions are in `./admin.css`.

## Sections

- **Overview** — live account and booking metrics, six-month sign-up and
  booking charts, the status split, the busiest barbers and the newest
  appointments. The bars are CSS rather than a chart library, with hover
  detail on every month and ranked bar.
- **User Manager** — customer and administrator accounts with avatar, handle,
  email, join date and a read-only role badge. Barbers live on the next page,
  so no account row appears twice.
- **Barber Manager** — the barber subset in the same shared table. The role
  control lives here, so granting administrator access has one home. Add barber
  opens a form for name, username, email, password and password confirmation;
  the auth user and profile are created by
  `supabase/functions/create-barber`, then promoted to barber. A promoted barber
  moves to User Manager.
- **Bookings** — every appointment with the customer's avatar, plus a details
  dialog opened by clicking a row or its View button. The section widens past
  the reading measure so the table has room.
- **Reports** — a date-bounded report with quick ranges, summary metrics,
  status/services/barber breakdowns, new accounts and an appointment ledger.
  Export PDF builds a formatted document on demand with jsPDF; the library is
  loaded only when the button is pressed.
- **Account** — identity and avatar, opened from the rail foot. If the profile
  has no display name, the same page offers a one-time form to add one.

## Notifications

The header bell is backed by the same live data as the dashboard, not a
placeholder feed. `useAdminNotifications` derives rows from:

- new booking requests, cancellations and completed cuts;
- confirmed appointments inside the next 48 hours;
- accounts created in the last 14 days.

Read state is per admin and stored locally, sharing the same hook as the
customer feed. Selecting a notification opens the section that owns the record.

## Data

`useAccounts` reads `admin_list_accounts()` and writes through
`admin_set_role()`, created by `supabase/migrations/0008_staff_roles.sql`.
`0011_admin_account_avatar.sql` replaces the read function to include
`avatar_url` and asks PostgREST to reload its schema. Until it is applied the
tables fall back to the name initial and the manager pages name the missing
migration, so initials are not mistaken for accounts without photos.

Avatar URLs are resolved through `components/profile/useAvatarSrc.ts`, which
accepts a Trim path, a bare avatar id or a Google URL and falls back to the
initial if the image fails to load.

Role is enforced twice: `RequireAuth` sends the wrong role to its own
dashboard, and the two RPCs re-check the caller in the database.

Barber creation is the one write that needs the service role. The browser sends
the form to `supabase/functions/create-barber`, which verifies the caller's JWT
and reads their role from `profiles`, creates a confirmed auth user through the
Admin API, and sets the profile role to `barber`. If the role update fails, the
function deletes the new auth user so no half-provisioned customer is left
behind. Deploy it alongside the existing functions:

```sh
supabase functions deploy create-barber
```

The function uses the service-role secret Supabase provides to every Edge
Function; no additional secret is required. `verify_jwt` is off in
`supabase/config.toml` because the browser preflight carries no Authorization
header, so the handler performs the check itself.

## Not built yet

Shop records still need a table that does not exist. The manager pages say so
rather than rendering sample rows.
