# 11. Methods and algorithms

## 11.1 Proxy bidding

Each bidder sets a **maximum** (`max_minor`). The system bids on their behalf only as high as needed.

| Situation | Result |
|-----------|--------|
| First bid on auction | Price = **starting price**; bidder becomes leader |
| Leader raises own max | **Price unchanged**; max updated |
| New max **&gt;** leader max | Price = leader max + **one increment** (capped at new max); new bidder leads |
| Equal maxima | **Earlier** bidder keeps lead at that price |
| New max **&lt;** leader max | Leader stays; price = new max + one increment (not above leader max) |
| Bid in soft-close window | Extend `end_at` (up to configured cap) |

**Increment**: from `increment_rules` by current price band.

Pseudocode (simplified):

```
function applyBid(auction, bidderId, maxMinor):
  if not validBidder(auction, bidderId): reject
  inc = lookupIncrement(auction.currentPrice)
  if no leader:
    amount = auction.startPrice
  else if bidderId == leader:
    update leaderMax only; return
  else if maxMinor > leaderMax:
    amount = min(maxMinor, leaderMax + inc)
  else:
    amount = min(leaderMax, maxMinor + inc)
    leader unchanged
  persist bid(amount, maxMinor); update auction; emit events
```

## 11.2 Other core methods

| Method | Approach |
|--------|----------|
| **Stock reservation** | Atomic `UPDATE … WHERE quantity_available >= n`; reservation row expires in **15 min** |
| **Fee calculation** | FVF = category rate × (price + shipping) + fixed; adjust by seller level; apply cap; store `rule_id` on order |
| **Order state machine** | Allowed: `pending_payment` → `paid` → `processing` → `shipped` → `delivered` → `completed`; branches for cancel, return, refund, dispute |
| **Escrow release** | On delivery confirm or after protection window if **no open case** |
| **Search ranking** | Text relevance + seller quality, velocity, price, free shipping, freshness, policy penalties |
| **Fraud checks** | Rules: age vs order value, bid/order velocity, blacklists, device reuse, shill patterns → approve / review / block |
| **Idempotency** | Required on payments, bids, orders, offers; replay returns stored response |

## 11.3 Background jobs

| Job | Schedule |
|-----|----------|
| Auction sweeper (+ delayed end job) | Every **30 s** |
| Scheduled listing start; release expired stock reservations | Every **1 min** |
| Unpaid orders; ending-soon / price-drop alerts | Every **5 min** |
| Escrow release | Every **15 min** |
| Order auto-complete; saved-search alerts | Hourly |
| Payout run | **Daily** |
| Ledger integrity; search repair; reports | **Nightly** |
| Seller level evaluation | **Monthly** |

Implementation note: schedulers run in the **worker** process; critical paths (auction end) also use **delayed queue messages** at exact `end_at`.
