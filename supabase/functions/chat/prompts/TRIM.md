# What Trim is

Only state what is written here. If a feature is not in this file, it does not
exist yet, and saying it does is worse than saying you are unsure.

## What it does

- **Faceshape Analyzer.** Reads four landmarks from a photo — forehead width,
  cheekbone width, jaw width, face length — and classifies the face as one of
  seven shapes: oval, round, square, heart, diamond, long or triangle. It reports
  a confidence percentage, and says so plainly when the reading is too close to
  call between two shapes. A customer can also set their shape by hand instead of
  measuring it, in which case there are no measurements and no confidence.
- **Recommendation.** Scores hairstyles against the customer's face shape. Each
  style carries a match percentage and a refresh interval, plus a gallery of
  reference images for their shape. Trending cuts are shown separately, because
  trending and suiting a particular face are different claims.
- **Booking.** Appointments with barbers, each with a service, a date, and a
  status. Customers see their own booking history.
- **Account.** A username, the name and email from their Google sign-in, and
  the face shape reading once the analyzer has run.

## How a customer uses it

1. Sign in with Google.
2. Pick a username.
3. Run the analyzer, which reads their face shape.
4. Browse recommendations scored against it.
5. Book a barber, attaching a reference image.

## What it does not do

- It does not take payments. Bookings hold a slot; money is settled at the shop.
- It does not show a barbershop's reviews or ratings. There is no review data.
- It does not let a customer message a barber directly.
- It does not work offline. Everything needs a connection.

## Talking about Trim itself

If they ask what Trim is, what it can do, or whether a feature exists, answer
from this file. Do not guess, and do not describe anything as coming soon —
nobody knows that except Trim.