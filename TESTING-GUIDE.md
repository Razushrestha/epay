# Testing Guide - Phase 1 & Phase 2 Features

**Last Updated:** October 8, 2026  
**Dev Server:** http://localhost:3000 (frontend) | http://localhost:4000 (API)

---

## 🧪 **Testing Checklist**

### **Phase 1: User & Account Management** ✅

#### **1. Registration & Login**
- [ ] Go to http://localhost:3000/register
- [ ] Register with email: `test@example.com` / password: `Test123!`
- [ ] Verify OTP code sent (check console logs if using dev email)
- [ ] Go to `/verify` and enter OTP code
- [ ] Account should be created successfully
- [ ] Login at `/login` with credentials
- [ ] Should see "Account" link in header (not "Sign in")

#### **2. Two-Factor Authentication (2FA)**
- [ ] Go to `/account` (after login)
- [ ] Click "Security" tab
- [ ] Enable 2FA (TOTP)
- [ ] Scan QR code with authenticator app (Google Authenticator, Authy)
- [ ] Enter 6-digit code to confirm
- [ ] Logout and login again
- [ ] Should now prompt for 2FA code after password

#### **3. Address Book**
- [ ] Go to `/account` → "Addresses" tab
- [ ] Click "Add Address"
- [ ] Fill in:
  - Name: John Doe
  - Phone: 9812345678
  - Address: Thamel, Kathmandu
  - City: Kathmandu
  - State: Bagmati
  - Postal Code: 44600
  - Set as default
- [ ] Save address
- [ ] Should appear in address list
- [ ] Edit and delete should work

#### **4. Seller KYC Verification**
- [ ] Go to `/account` → "Selling" tab
- [ ] Enable "Sell on Nexlo"
- [ ] Upload ID document (any image file)
- [ ] Upload address proof (any image file)
- [ ] Submit for review
- [ ] Status should show "Pending Verification"

#### **5. Admin KYC Review (Staff Only)**
- [ ] First, claim staff access:
  - POST to `http://localhost:4000/api/v1/admin/claim`
  - With body: `{"secret": "NEXLO_ADMIN_2026"}`
  - This makes your account a staff member
- [ ] Go to `/admin`
- [ ] Should see "Staff Dashboard"
- [ ] Click "KYC Reviews" tab
- [ ] Find your pending KYC submission
- [ ] Approve or reject with reason
- [ ] Go back to `/account` → "Selling"
- [ ] Status should update to "Approved" or "Rejected"

---

### **Phase 1: Category Catalog** ✅

#### **6. Browse Categories (Public)**
- [ ] API Test: `GET http://localhost:4000/api/v1/catalog/categories?level=1`
- [ ] Should return 10 root categories:
  - Electronics ⚡
  - Fashion 👔
  - Home & Garden 🏠
  - Sports & Outdoors ⚽
  - Automotive 🚗
  - Books & Media 📚
  - Toys & Hobbies 🎮
  - Health & Beauty 💄
  - Jewelry & Watches 💎
  - Art & Collectibles 🎨

#### **7. Browse Conditions**
- [ ] API Test: `GET http://localhost:4000/api/v1/catalog/conditions`
- [ ] Should return 8 conditions:
  - New, Like New, Excellent, Very Good, Good, Acceptable, For Parts, Refurbished

#### **8. Browse Brands**
- [ ] API Test: `GET http://localhost:4000/api/v1/catalog/brands?limit=20`
- [ ] Should return brands list (currently empty - add via admin)

#### **9. Admin Catalog Management**
- [ ] Go to `/admin/catalog` (requires staff login)
- [ ] Switch to "Categories" tab
- [ ] Click "Add Category"
- [ ] Create subcategory:
  - Name: Smartphones
  - Parent: Electronics
  - Icon: 📱
  - Slug: smartphones (auto-generated)
- [ ] Category should appear in list
- [ ] Toggle active/inactive
- [ ] Delete category (only if no subcategories or listings)

- [ ] Switch to "Brands" tab
- [ ] Click "Add Brand"
- [ ] Create brand:
  - Name: Apple
  - Slug: apple
  - Website: https://apple.com
  - Verified: Yes
- [ ] Brand should appear in list

---

### **Phase 2: Listings** ✅

#### **10. Create a Listing (Seller)**
- [ ] First ensure you're approved as seller (step 4-5)
- [ ] Go to `/sell/create`
- [ ] **Step 1: Basic Info**
  - Category: Electronics
  - Title: "iPhone 14 Pro Max 256GB - Space Black"
  - Subtitle: "Brand new, sealed box"
  - Description: "Brand new iPhone 14 Pro Max..."
  - Condition: New
  - Brand: Apple (if added in step 9)
- [ ] Click "Next"
- [ ] **Step 2: Pricing**
  - Format: Fixed Price
  - Price: 150000
  - Quantity: 5
- [ ] Click "Next"
- [ ] **Step 3: Shipping**
  - Shipping Cost: 500 (or check Free Shipping)
  - Item Location: Kathmandu, Nepal
  - Check "Publish Immediately"
- [ ] Click "Publish Listing"
- [ ] Should redirect to listing detail page

#### **11. View Listing**
- [ ] Go to `/listing/1` (or the ID from previous step)
- [ ] Should see:
  - Title, price, description
  - Seller info
  - Add to Cart button
  - Buy It Now button
  - Q&A section
  - Watch button

#### **12. Seller Dashboard**
- [ ] Go to `/sell/listings`
- [ ] Should see your listing in "Active" tab
- [ ] Stats should show:
  - 1 Active listing
  - 0 Views (until someone views it)
  - 0 Watches
- [ ] Click "Edit" → redirects to edit page (not implemented yet)
- [ ] Click "End" → listing status changes to "ended"
- [ ] Click "Relist" → listing becomes active again

---

### **Phase 2: Search & Discovery** ✅

#### **13. Search Listings**
- [ ] Go to `/search`
- [ ] Should see your published listing(s)
- [ ] Try search box: "iPhone"
- [ ] Should filter results
- [ ] Use filters:
  - Category: Electronics
  - Price range: 100000 - 200000
  - Sort by: Price Low to High
- [ ] Results should update

#### **14. Watchlist**
- [ ] Go to listing detail `/listing/1`
- [ ] Click "Watch" button
- [ ] Go to `/account` → should add watchlist section (not implemented yet)
- [ ] API Test: `GET http://localhost:4000/api/v1/listings/watchlist`
  - With Authorization header
  - Should return watched items

---

### **Phase 2: Cart & Checkout** ✅

#### **15. Add to Cart**
- [ ] Go to listing detail `/listing/1`
- [ ] Click "Add to Cart"
- [ ] Should show confirmation
- [ ] Cart icon in header should show count (if implemented)

#### **16. View Cart**
- [ ] Go to `/cart`
- [ ] Should see:
  - Your added item
  - Seller name
  - Quantity controls (+ / -)
  - Remove button
  - Price per item
  - Subtotal
- [ ] Try changing quantity:
  - Click "+" → quantity increases
  - Click "-" → quantity decreases
  - Try exceeding stock → should show error
- [ ] Order Summary should show:
  - Subtotal
  - Shipping cost
  - Tax: "Calculated at checkout"

#### **17. Checkout Flow**
- [ ] In cart, click "Proceed to Checkout"
- [ ] If not logged in → redirects to `/login?redirect=/checkout`
- [ ] After login, goes to `/checkout`
- [ ] **Select Address:**
  - Should show addresses from step 3
  - Select default address
- [ ] **Apply Coupon (Optional):**
  - Enter: `TEST10` (if you created a coupon)
  - Click "Apply"
  - Should show discount in summary
- [ ] **Order Summary:**
  - Subtotal: NPR 150,000
  - Shipping: NPR 500
  - Tax (13%): NPR 19,500
  - Total: NPR 170,000
- [ ] Click "Place Order"
- [ ] Should create order and show:
  - Order number: ORD-2026-000001
  - Alert: "Payment gateway integration coming next!"
- [ ] Go to `/orders` (not implemented yet, will be in next phase)

#### **18. Verify Order Created**
- [ ] API Test: Check if order was created in database
- [ ] Go to seller dashboard `/sell/listings`
- [ ] Quantity should be reduced by purchased amount
- [ ] If bought 1, stock should be 4 (if started with 5)

---

## 🔧 **API Testing with cURL / Postman**

### **Get Cart**
```bash
GET http://localhost:4000/api/v1/cart
Authorization: Bearer <your_token>
```

### **Add to Cart**
```bash
POST http://localhost:4000/api/v1/cart
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "listing_id": 1,
  "quantity": 1
}
```

### **Create Order**
```bash
POST http://localhost:4000/api/v1/cart/checkout/create-order
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "shipping_address_id": 1,
  "billing_address_id": 1,
  "buyer_notes": "Please pack carefully",
  "coupon_code": "TEST10"
}
```

---

## 🐛 **Known Issues / Limitations**

### **Current Limitations:**
1. ❌ **Payment Gateway** - Not integrated yet
   - Orders created but stuck at "pending_payment"
   - Need eSewa + Khalti integration

2. ❌ **Email/SMS Notifications** - Not implemented
   - OTP codes shown in console instead of email
   - Order confirmations not sent

3. ❌ **Image Upload** - Not fully implemented
   - Listing photos stored as URLs only
   - Need actual file upload with EXIF stripping

4. ❌ **Bulk CSV Import** - Not implemented
   - Single listing creation only

5. ❌ **OpenSearch Integration** - Using PostgreSQL full-text
   - Search works but not as advanced as OpenSearch
   - No autocomplete, synonyms, or typo tolerance

6. ❌ **Auction Bidding** - Not implemented (Phase 3)
   - Can create auction listings but no bidding yet

7. ❌ **Best Offer** - Not implemented (Phase 3)
   - Flag exists but no offer submission

8. ❌ **Messaging** - Not implemented (Phase 3)
   - Q&A on listings works but no buyer-seller chat

9. ❌ **Order Management** - Partial
   - Orders created but no seller fulfillment workflow
   - No tracking number entry
   - No shipping status updates

### **Frontend Polish Needed:**
- [ ] Cart icon with item count in header
- [ ] Toast notifications for actions
- [ ] Loading spinners
- [ ] Better error handling
- [ ] Mobile responsive improvements
- [ ] Image lazy loading
- [ ] Skeleton screens while loading

---

## ✅ **Success Criteria**

If you can complete steps 1-18 without errors:
- ✅ Phase 1 is **100% functional**
- ✅ Phase 2 is **80% functional** (only payment gateway missing)

---

## 🚀 **Performance Notes**

- Dev server uses embedded **PGLite** (in-memory PostgreSQL)
- Data persists in `.data/pglite/` folder
- To reset database: Delete `.data/pglite/` and run `npm run db:migrate`

---

## 📝 **Testing Credentials**

**Test User:**
- Email: test@example.com
- Password: Test123!

**Staff Access Secret:**
- Secret: `NEXLO_ADMIN_2026`

**Default Tax Rate:**
- Nepal VAT: 13%

**Test Coupon Codes (create these in admin):**
- `WELCOME10` - 10% off
- `FREESHIP` - Free shipping
- `SAVE500` - NPR 500 off

---

**Ready to test?** Start from Step 1 and work your way through! Report any issues you find. 🧪
