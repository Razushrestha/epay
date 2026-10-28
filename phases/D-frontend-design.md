# Frontend design phases (D1–D6)

Product M1–M4 is in. These phases restyle leftover storefront screens to match **login, home, and live listing**.

Build **one phase at a time**. Do not start D2 until D1 is verified in the browser.

## D1 — Find (done)

- `/search`
- `/search/advanced`
- leftover `/categories/[slug]` (unmapped hubs)
- `/deals`

Chip filters and listing cards like Electronics / Fashion. No giant hero on results.

## D2 — Buy (done)

- `/orders`
- `/orders/[id]`
- `/orders/[id]/invoice`
- `/payment/success`
- `/payment/failed`

## D3 — Sell (done)

- `/sell`
- `/sell/listings`
- `/sell/edit/[id]` (match create wizard)
- `/seller/[username]`

## D4 — Account (done)

- Messages
- Support / tickets
- Activity
- Payment information
- Donations
- Collections / followed sellers

## D5 — Trust (done)

- `/help`, `/help/[slug]`
- `/buyer-protection`
- `/terms`, `/privacy`
- `/resolution`

## D6 — Admin (done)

- `/admin/catalog` first (still gray Tailwind)
- Then users, products, orders, payouts, disputes, and remaining table tools

## Leftover sweep (after D6)

- `/watchlist`
- 404 / not-found

## Already branded — skip

Home, login/register/verify/forgot, shop, live listing, mapped category hubs, cart, checkout, sell/create, header, footer.
