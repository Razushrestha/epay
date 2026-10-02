# Milestone 2 — End of month 2

**Proposal deliverable:** Listings (fixed, photos, drafts, bulk); search & filters; cart & checkout; **payment gateway on staging**.

## Listings (§4.3)

- [ ] Create/edit listing (all core fields, JSONB attributes)
- [ ] Fixed price + format flags (auction/offer wired later)
- [ ] Multi-image upload (validate type/size, strip EXIF)
- [ ] Variations, policies, drafts, schedule, relist
- [ ] Bulk CSV import + error report
- [ ] Listing fees calculation (insertion)
- [ ] Moderation queue + report listing

## Search (§4.6)

- [ ] OpenSearch index from outbox/worker
- [ ] Full-text + autocomplete + synonyms
- [ ] Filters/sorts per proposal
- [ ] Watchlist, saved searches, recently viewed

## Cart & checkout (§4.7)

- [ ] Multi-seller cart
- [ ] 15-minute `stock_reservations`
- [ ] Coupons, tax_rules, shipping_rates
- [ ] Checkout creates order `pending_payment`

## Payments (§4.8 — integration only)

- [ ] Client sandbox keys (§17 week 4)
- [ ] Hosted payment page redirect
- [ ] Webhook handler + idempotency + signature verify
- [ ] Record payment row (ledger detail in M3)

## Demo acceptance

- [ ] Seller lists fixed-price item → appears in search → buyer checks out → sandbox payment succeeds on staging

**Cost packages:** C Search, D Cart/checkout/gateway, part of B listings.
