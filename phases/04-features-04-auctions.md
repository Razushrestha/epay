# §4.4 Auction and bidding engine

| Feature | Details | Release |
|---------|---------|---------|
| Proxy bidding | Auto-bid up to buyer max in fixed increments | **Included** |
| Starting price, reserve, increments | Increment table by price range | **Included** |
| Duration and soft close | Length; extend if bid in last minutes | **Included** |
| Live updates | Real-time price, bid count, countdown (WebSocket) | **Included** |
| Bid rules | Retraction limits, blocked bidders, min feedback/payment | **Included** |
| Winner and payment deadline | Winner, order pending payment, deadline, unpaid strikes | **Included** |
| Second-chance offer | Offer to next bidder if winner unpaid | **Included** |
| Alerts | Outbid, ending soon, won/lost, reserve met | **Included** |

**M3 tasks:** auction row + bids, proxy algorithm (§11.1), Redis lock, realtime gateway, sweeper jobs.
