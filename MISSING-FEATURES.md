# Missing Features - Gap Analysis

Based on the detailed proposal documents in `phases/` directory, here are the **missing features** that need to be implemented:

---

## 🚨 **CRITICAL GAPS - Phase 1 (M1)**

### **1. User Consent Management**
- [ ] `user_consents` table for privacy policy/terms acceptance
- [ ] Privacy policy version tracking
- [ ] Consent records with timestamp and version

### **2. KYC Security Enhancements**
- [ ] Short-lived URL generation for viewing KYC documents (prevent direct access)
- [ ] `kyc_access_logs` table to track who accessed which documents when
- [ ] Encrypted document number storage (ID numbers, passport numbers)

### **3. Category Item Specifics Builder (Admin UI)**
- [ ] Admin interface to create/edit item specifics (attributes)
- [ ] Add options for select/multiselect specifics
- [ ] Assign specifics to categories with required/optional flags
- [ ] Drag-and-drop ordering for specifics

---

## 🔴 **HIGH PRIORITY - Phase 2 (M2)**

### **4. Multi-Image Upload Enhancements**
- [ ] EXIF data stripping (privacy - remove GPS, camera info)
- [ ] Image resize/thumbnail generation (save bandwidth)
- [ ] File type/size validation on server
- [ ] Image moderation status per photo

### **5. Listing Variations UI**
- [ ] Frontend for creating variations (Size, Color, etc.)
- [ ] Grid view for variation SKU combinations
- [ ] Individual pricing and stock per variation
- [ ] Variation-specific photos

### **6. Bulk CSV Import**
- [ ] CSV template download
- [ ] CSV parser with validation
- [ ] Batch job processing (background worker)
- [ ] Error report generation per row
- [ ] Progress tracking UI

### **7. Listing Fee Calculation**
- [ ] Insertion fee calculation on publish
- [ ] Final value fee calculation on sale
- [ ] Category-specific fee rules
- [ ] Seller level discounts

### **8. Listing Moderation Queue (Admin)**
- [ ] Admin queue view for pending listings
- [ ] Approve/reject with reason
- [ ] Image moderation (manual review)
- [ ] Auto-flagging rules (prohibited keywords)

### **9. OpenSearch Integration** ⚠️ **CRITICAL**
- [ ] OpenSearch cluster setup (client-provided infrastructure)
- [ ] Index schema for listings
- [ ] Outbox pattern for reliable indexing
- [ ] Background worker to sync DB → OpenSearch
- [ ] Autocomplete endpoint with suggestions
- [ ] Synonym management (e.g., "mobile" = "phone")
- [ ] Typo tolerance configuration

### **10. Advanced Search Features**
- [ ] Best Match ranking algorithm (relevance + seller quality + velocity)
- [ ] Location-based search (nearby items)
- [ ] Shipping options filter (free shipping, international)
- [ ] Seller rating filter
- [ ] Item specifics filters (dynamic based on category)

### **11. Multi-Seller Cart** ⚠️ **CRITICAL**
- [ ] `cart_items` table
- [ ] Add to cart API
- [ ] Cart summary with items grouped by seller
- [ ] Update quantity, remove items
- [ ] Cart expiration (7 days)
- [ ] Stock availability check before checkout

### **12. Stock Reservation System** ⚠️ **CRITICAL**
- [ ] `stock_reservations` table
- [ ] 15-minute hold during checkout
- [ ] Auto-release on timeout or cancel
- [ ] Background job to clean expired reservations
- [ ] Prevent double-sale race conditions

### **13. Coupons System**
- [ ] `coupons` table (code, type, value, min_purchase, usage_limit, expiry)
- [ ] Coupon types: percent off, fixed amount, free shipping
- [ ] Apply coupon at checkout
- [ ] Validation (min purchase, single use, expiry date)
- [ ] Usage tracking

### **14. Tax & Shipping Calculation**
- [ ] `tax_rules` table (VAT by category or flat 13%)
- [ ] `shipping_rates` table (by weight/zone or flat rate)
- [ ] Calculate tax at checkout
- [ ] Calculate shipping by seller location → buyer location
- [ ] Multi-seller shipping aggregation

### **15. Checkout Flow & Order Creation**
- [ ] Checkout page (address selection, payment method)
- [ ] Order creation with status `pending_payment`
- [ ] Reduce listing quantity on order create
- [ ] Release stock reservation after payment
- [ ] Order confirmation email

### **16. Payment Gateway Integration** ⚠️ **CRITICAL**
- [ ] eSewa hosted payment page integration
- [ ] Khalti hosted payment page integration
- [ ] Redirect to gateway → callback/return URL handling
- [ ] Webhook handler for payment status updates
- [ ] Signature verification for webhooks
- [ ] Idempotency (prevent duplicate processing)
- [ ] Payment record in `payments` table
- [ ] Update order status to `paid` on success

---

## 🟡 **MEDIUM PRIORITY - Phase 3 (M3)**

### **17. Auction Bidding Engine** ⚠️ **CORE FEATURE**
- [ ] `auctions` table (start_time, end_time, reserve_price)
- [ ] `bids` table (amount, max_amount for proxy bidding, timestamp)
- [ ] Proxy bidding algorithm (auto-bid up to user's max)
- [ ] Bid increment rules by price range (e.g., +NPR 100 for <10k, +NPR 500 for >10k)
- [ ] Soft close (extend 5 minutes if bid in last 2 minutes)
- [ ] Live price updates (WebSocket or Server-Sent Events)
- [ ] Redis lock for concurrent bid handling
- [ ] Winner determination on auction end
- [ ] Unpaid item handling (second-chance offer to next bidder)
- [ ] Bid retraction rules (only if seller error, within 1 hour)
- [ ] Email/SMS alerts (outbid, ending soon, won/lost)

### **18. Best Offer System**
- [ ] `offers` table (listing_id, buyer_id, amount, status, expires_at)
- [ ] Submit offer API
- [ ] Seller accept/decline/counter offer
- [ ] Auto-accept if >= `auto_accept_price`
- [ ] Auto-decline if < `auto_decline_price`
- [ ] Offer expiration (48 hours)
- [ ] Email notifications on offer events

### **19. Order Lifecycle & Shipping**
- [ ] Order state machine: `pending_payment` → `paid` → `shipped` → `delivered` → `completed`
- [ ] Seller marks order as shipped
- [ ] Tracking number entry
- [ ] Buyer marks as received (auto after 7 days)
- [ ] Cancellation flow (buyer/seller initiated)
- [ ] Auto-completion after 14 days of delivery

### **20. Double-Entry Ledger** ⚠️ **COMPLEX**
- [ ] `ledger_accounts` table (Platform, Buyer, Seller, Commission, VAT, Shipping)
- [ ] `ledger_transactions` table (insert-only, balanced entries)
- [ ] Journal entry creation on every payment, payout, refund
- [ ] Balance calculation queries
- [ ] Reconciliation reports (gateway vs ledger)
- [ ] Daily integrity check (sum of debits = sum of credits)

### **21. Escrow Hold & Release**
- [ ] Hold funds in escrow account when buyer pays
- [ ] Release to seller after delivery confirmation
- [ ] Buyer protection window (30 days)
- [ ] Auto-release if no dispute filed within window
- [ ] Manual release by admin for disputes

### **22. Fee Engine**
- [ ] Calculate platform commission on sale (% by category)
- [ ] Calculate final value fee (% of sale price)
- [ ] Seller level discounts (top_rated = -20% fees)
- [ ] Deduct fees from seller payout
- [ ] Fee breakdowns in invoices

### **23. Seller Wallet & Payouts**
- [ ] `seller_wallets` table (available_balance, pending_balance, lifetime_earnings)
- [ ] `payout_requests` table (amount, account_info, status)
- [ ] Payout request submission by seller
- [ ] Admin approval queue for payouts
- [ ] Mark as paid & record transaction ID
- [ ] Payout methods: Bank transfer, eSewa, Khalti
- [ ] Minimum payout threshold (e.g., NPR 1,000)

### **24. Refunds System**
- [ ] Full/partial refund API
- [ ] Linked to return/dispute
- [ ] Refund to original payment method
- [ ] Update ledger (reverse commission if full refund)
- [ ] Refund confirmation email

### **25. Invoice Generation**
- [ ] VAT invoice per order (PDF)
- [ ] Seller earnings statement (monthly PDF)
- [ ] Include itemized fees, commission, VAT, net earnings

### **26. Buyer–Seller Messaging**
- [ ] `conversations` table (buyer_id, seller_id, listing_id)
- [ ] `messages` table (text, attachments, read_at)
- [ ] Send message API
- [ ] Mark as read
- [ ] Spam filtering (rate limits, blacklisted keywords)
- [ ] Email notification on new message

### **27. Notifications System**
- [ ] `notifications` table (user_id, type, data, read_at)
- [ ] Email notifications (transactional via SendGrid/AWS SES)
- [ ] SMS notifications (via Twilio or local SMS gateway)
- [ ] In-app notifications (bell icon with count)
- [ ] Notification preferences per user (email/SMS/push)
- [ ] Templates for all events: order placed, shipped, message received, auction ending, outbid, etc.

### **28. Feedback & Reputation**
- [ ] `feedback` table already exists ✅ (from Phase 1)
- [ ] Leave feedback UI (after delivery confirmed)
- [ ] Buyer → Seller: Positive/Neutral/Negative + comment + DSR
- [ ] Seller → Buyer: Positive/Neutral/Negative + comment
- [ ] Detailed Seller Ratings (DSR): 1-5 stars for item description, communication, shipping time, shipping cost
- [ ] Seller performance metrics calculation:
  - [ ] Defect rate (% of orders with disputes)
  - [ ] Late shipment rate
  - [ ] Order cancellation rate
  - [ ] Response time to messages
- [ ] Seller level promotion/demotion based on metrics

---

## 🟢 **LOWER PRIORITY - Phase 4 (M4)**

### **29. Returns & Disputes**
- [ ] `return_requests` table (order_id, reason, status, evidence)
- [ ] Submit return request (within 30 days)
- [ ] Return reasons: Not as described, Damaged, Wrong item, Changed mind
- [ ] Upload evidence (photos)
- [ ] Seller approve/decline return
- [ ] If declined → escalate to admin dispute
- [ ] Case management dashboard
- [ ] Admin decision (refund buyer, no refund, partial)
- [ ] Return shipping label generation
- [ ] Track return shipment
- [ ] Process refund after item received

### **30. Dispute Resolution**
- [ ] `disputes` table (order_id, type, status, filed_by, assigned_to, resolution)
- [ ] Dispute types: Item not received, Not as described, Damaged
- [ ] Evidence submission (buyer + seller)
- [ ] Admin assignment queue
- [ ] Admin decision with notes
- [ ] Automatic actions (refund, account warning, seller suspension)

### **31. Seller Dashboard Enhancements**
- [ ] Sales chart (daily/weekly/monthly GMV)
- [ ] Traffic chart (views, watches, conversions)
- [ ] Pending orders table with actions
- [ ] Payout history
- [ ] Performance metrics display (defect rate, late shipment, etc.)
- [ ] Seller level badge display

### **32. Inventory Management**
- [ ] Bulk edit price/quantity (multi-select listings)
- [ ] Low stock alerts (email when qty < 5)
- [ ] Out of stock auto-unpublish
- [ ] Bulk import/export via CSV
- [ ] Inventory sync with external systems (API)

### **33. Seller Reports**
- [ ] Sales report (date range, CSV export)
- [ ] Fees report (breakdown by order)
- [ ] Payouts report (history with transaction IDs)
- [ ] Returns report (frequency, reasons)
- [ ] Tax report (for VAT filing)

### **34. Vacation Mode**
- [ ] Enable vacation mode (pause all listings)
- [ ] Auto-respond to messages with vacation notice
- [ ] Scheduled vacation (future date range)
- [ ] Auto-resume on return date

### **35. Saved Replies (Message Templates)**
- [ ] `saved_replies` table (seller_id, title, message_template)
- [ ] Create/edit/delete saved replies
- [ ] Insert saved reply in message composer
- [ ] Variables (e.g., {{buyer_name}}, {{item_title}})

### **36. Admin Back-Office Expansion**
- [ ] Role-based access control (RBAC)
  - [ ] `roles` table (admin, moderator, finance, support)
  - [ ] `role_permissions` table (read/write per module)
- [ ] User management console (search, view, ban, verify seller)
- [ ] Listing moderation queue (already started, needs UI polish)
- [ ] Order management console (view all orders, refund, cancel)
- [ ] Finance dashboard (daily/monthly revenue, fees collected, payouts processed)
- [ ] Dispute queue (assign to staff, resolve)
- [ ] Content Management System (CMS)
  - [ ] Homepage banners (upload, schedule, link)
  - [ ] Static pages (About, Privacy Policy, Terms, FAQ)
  - [ ] Help articles (categories, search)
- [ ] Site settings
  - [ ] Auction rules (soft close duration, increment table)
  - [ ] Fee rules (commission %, insertion fee by category)
  - [ ] VAT rate
  - [ ] Buyer protection window (days)
- [ ] Full audit log (all admin actions with timestamp, user, IP)
- [ ] Analytics & Reports
  - [ ] GMV (Gross Merchandise Value) chart
  - [ ] User growth chart
  - [ ] Listings created chart
  - [ ] Conversion funnel (views → cart → checkout → paid)
  - [ ] Revenue breakdown (sales, fees, commission)
  - [ ] Top sellers, top categories, top search terms

### **37. Support Tickets**
- [ ] `support_tickets` table (user_id, subject, status, assigned_to, priority)
- [ ] `ticket_messages` table (replies from user/staff)
- [ ] User submit ticket form
- [ ] Admin queue (open, assigned, resolved)
- [ ] Email notifications on ticket updates

### **38. Trust & Safety**
- [ ] Rule-based fraud detection
  - [ ] Velocity checks (too many listings in short time)
  - [ ] Duplicate accounts (same IP, email, phone)
  - [ ] Suspicious activity (high-value sale from new account)
- [ ] Strikes system
  - [ ] `user_strikes` table (reason, severity, timestamp)
  - [ ] Auto-restrict after 3 strikes (e.g., can't list for 7 days)
  - [ ] Auto-ban after 5 strikes
- [ ] Image moderation
  - [ ] Prohibited content detection (violence, adult, illegal)
  - [ ] Manual review queue for flagged images
- [ ] Email/phone verification enforcement
  - [ ] Require verified email to list
  - [ ] Require verified phone for payouts

### **39. Testing & Go-Live**
- [ ] Unit tests (Jest/Mocha for API endpoints)
- [ ] Integration tests (order flow, payment flow)
- [ ] Load testing (simulate 1000+ concurrent users with k6 or Artillery)
- [ ] Security audit
  - [ ] SQL injection tests
  - [ ] XSS tests
  - [ ] CSRF protection
  - [ ] Rate limiting on sensitive endpoints
  - [ ] OWASP Top 10 checklist
- [ ] Performance tuning
  - [ ] Database query optimization (explain analyze)
  - [ ] Add missing indexes
  - [ ] Redis caching (categories, brands, hot listings)
  - [ ] CDN for images (CloudFront, Cloudflare)
- [ ] User Acceptance Testing (UAT) with client team
- [ ] Production deployment checklist
- [ ] Training session (4 hours for client staff)
- [ ] Documentation handover
  - [ ] Architecture document
  - [ ] API documentation (Swagger/OpenAPI)
  - [ ] Admin user guide
  - [ ] Seller user guide
  - [ ] Buyer user guide
  - [ ] Server setup guide
  - [ ] Backup & recovery procedures

---

## 📊 **Summary by Priority**

| Priority | Count | % Complete |
|----------|-------|------------|
| **CRITICAL (Phase 1)** | 3 features | 0% |
| **HIGH (Phase 2)** | 13 features | ~30% (search & basic listing done) |
| **MEDIUM (Phase 3)** | 16 features | 0% |
| **LOWER (Phase 4)** | 11 features | 0% |
| **TOTAL** | **43 missing features** | **~15% overall** |

---

## 🎯 **Recommended Next Steps (Priority Order)**

1. **Multi-Seller Cart & Checkout** (2-3 days) - blocks payment testing
2. **Payment Gateway Integration** (2-3 days) - needed for M2 acceptance
3. **Stock Reservation System** (1 day) - critical for preventing double-sales
4. **OpenSearch Integration** (3-4 days) - major infrastructure setup
5. **Bulk CSV Import** (2 days) - sellers need this to migrate inventory
6. **Auction Bidding Engine** (5-7 days) - core differentiator, complex
7. **Order Lifecycle & Shipping** (3-4 days) - needed for fulfillment
8. **Double-Entry Ledger** (4-5 days) - complex accounting, needed for payouts
9. **Messaging & Notifications** (3-4 days) - critical for user communication
10. **Returns & Disputes** (4-5 days) - buyer protection requirement

---

**Estimated remaining work:** ~60-80 developer days across all phases.  
**Current progress:** Phase 1 complete (95%), Phase 2 in progress (30%).

Would you like me to start implementing any of these missing features?
