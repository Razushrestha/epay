# Milestone 3 — End of month 3

**Proposal deliverable:** Auctions + proxy + live updates; Best Offer; orders & shipping; **ledger, escrow, payouts**; messaging, notifications, feedback.

## Auctions (§4.4, §11)

- [ ] `auctions`, `bids`, increment_rules
- [ ] Proxy bidding + soft close (concurrency tests)
- [ ] Realtime gateway: price, countdown, bid count
- [ ] Winner → order pending payment (48h default)
- [ ] Unpaid strikes, second-chance offer
- [ ] Bid alerts (worker)

## Best Offer (§4.5)

- [ ] offers, counters, offer_rules, expiry

## Orders & shipping (§4.9)

- [ ] Order FSM + status history + address snapshots
- [ ] Shipments, tracking_events, policies
- [ ] Cancellations, auto-complete timer

## Money (§4.8, §8.3)

- [ ] Double-entry ledger + escrow_holds
- [ ] Fee engine + order_fees
- [ ] seller_wallets, payout_accounts (encrypted), payouts approval
- [ ] Refunds, invoices; nightly ledger check job

## Comms & reputation (§4.11–12)

- [ ] conversations, messages, spam filter
- [ ] notification_templates, preferences, email/SMS workers
- [ ] feedback + detailed seller ratings

## Demo acceptance

- [ ] Live auction with 2 bidders; winner pays; escrow funded; seller ships; delivery triggers release path

**Cost packages:** E auctions, F orders (partial), G ledger, H messaging.
