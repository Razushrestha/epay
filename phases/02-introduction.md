# §2 Introduction

## 2.1 Background

Auction marketplaces need: correct bidding under concurrency, safe payments, dispute tooling. Client wants eBay-level capability; proposal delivers a **focused 4-month release**; remainder is **Phase 2**.

## 2.2 Objectives

1. Registered users sell/buy via auction, fixed price, Best Offer.
2. Fair real-time bidding with **proxy (automatic) bidding**.
3. Buyer/seller protection: escrow, returns, disputes, reputation.
4. Admin control: users, catalog, money, moderation.
5. Clean architecture that scales without rewrite.

## 2.3 In scope (this release)

All features marked **Included** in §4; responsive web + admin; up to **2 payment gateways**, **1 SMS**, **1 email**; manual courier tracking entry.

## 2.4 Out of scope (Phase 2)

Features marked **Phase 2** in §4; native iOS/Android; ML ranking/fraud; image search; multi-region hosting; work not in this document.

## 2.5 Assumptions

- One client decision-maker; milestone approval within **5 working days**.
- Client infra ready per §17 dates.
- Nepal / **NPR**; UI **English** (Nepali = Phase 2).
- Business rules (fees, policies, categories) from client in **month 1**.
