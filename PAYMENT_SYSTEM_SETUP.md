# 💳 WEBMINE Payment System - Complete Setup Guide

## ✅ Completed Implementation

### Backend Routes (`routes/payment.js`)
1. **POST /api/payment/validate-coupon** - Validate coupon codes
   - Parameters: `code`, `totalAmount`
   - Returns: Discount info, final amount
   
2. **POST /api/payment/generate-qr** - Generate QR codes & create orders
   - Parameters: `userId`, `amount`, `items`, `paymentMethod`, `paymentAccount`
   - Supports: PromptPay + TrueMoney Wallet
   - Returns: Order ID, QR code image (Data URL)

3. **GET /api/payment/check-status/:orderId** - Poll payment status
   - Returns: `completed` or `pending` status
   - On completion, returns new wallet balance

4. **GET /api/payment/wallet/history** - Get user payment history
   - Auth required (session-based)
   - Returns: Last 50 orders

### Frontend UI Flow
**3-Step Payment Flow:**
1. **Checkout Modal** (2-column layout)
   - Left: Product list with prices
   - Right: Coupon input, payment method selector, summary
   
2. **Confirmation Modal** (Legal terms)
   - Display player name
   - 6 warning points about digital goods
   - Proceed/Back buttons

3. **Payment Page** (3-section layout)
   - Left: QR Code + Download button + Timer + Amount
   - Right: Order details + items list + status polling
   - 15-minute countdown timer with auto-redirect

### Database Updates Required

Run the SQL migration file before testing:

```sql
-- Execute: migrations/add_coupons_table.sql

-- This will:
-- 1. Add `wallet_balance` column to `users` table
-- 2. Create `coupons` table with discount management
-- 3. Add columns to `orders` table: payment_account, coupon_code, discount_amount, final_amount
-- 4. Insert sample coupons: WELCOME10, SAVE50, SUMMER20
```

**Command to run (via MySQL client):**
```bash
mysql -u root -p maple_db < migrations/add_coupons_table.sql
```

Or manually run each SQL statement in phpMyAdmin.

---

## 🔧 Setup Checklist

### 1. Database Migration
- [ ] Execute `migrations/add_coupons_table.sql`
- [ ] Verify new columns added to `users` table
- [ ] Verify `coupons` table created
- [ ] Verify new columns in `orders` table
- [ ] Verify sample coupons inserted

### 2. Backend Files (Already Updated)
- [ ] `routes/payment.js` - 4 routes with full logic
- [ ] `controllers/authController.js` - Login returns wallet_balance
- [ ] `config/database.js` - Check connection settings

### 3. Frontend Files (Already Updated)
- [ ] `views/home.ejs` - New modals added (checkout, confirmation, payment page, success)
- [ ] `public/js/home.js` - Payment flow functions added + event listeners
- [ ] `public/css/home.css` - New styling for modals and layouts

### 4. Dependencies (Already Installed)
- `promptpay-qr` - QR code generation for PromptPay
- `qrcode` - QR code rendering as Data URL
- `bcryptjs` - Password hashing
- `express-session` - Session management

---

## 🧪 Testing Checklist

### Test 1: Login & Wallet Display
```
1. Register new user or login with existing
2. Check navbar shows: 👤 username | 💎 points | 💰 X THB
3. Verify wallet_balance loaded from database
```

### Test 2: Checkout Flow
```
1. Add items to cart (2-3 items)
2. Click checkout button
3. Verify checkout modal shows:
   - Product list (left side)
   - Coupon input field (right side)
   - Payment method selector
   - Summary with total
```

### Test 3: Coupon Validation
```
1. Try invalid coupon → Should show error message
2. Try "WELCOME10" (10% discount) → Should show discount
3. Verify final amount updated correctly
4. Try "SAVE50" with amount < 100 → Should show "min amount required"
5. Try "SUMMER20" (20% discount on amounts > 200)
```

### Test 4: Payment Method Selection
```
1. Select PromptPay → No phone field shown
2. Select TrueMoney → Phone number input appears
3. Try to proceed without phone number → Should show error
4. Enter phone number → Proceed allowed
```

### Test 5: Confirmation Modal
```
1. Click proceed → Confirmation modal opens
2. Verify player name displayed (from currentUser.username)
3. Verify 6 warning points visible
4. Click back → Returns to checkout modal
5. Click proceed → Moves to payment page
```

### Test 6: Payment Page
```
1. Verify QR code displayed
2. Verify countdown timer shows 15:00 and counts down
3. Verify order details visible:
   - Order ID
   - Player name
   - Payment method
   - Order items list
4. Click "Download QR" → Should download as PNG
5. Verify "Back to Home" button works
```

### Test 7: Payment Status Polling
```
1. Simulate payment completion in database (Manual SQL):
   UPDATE orders SET status='completed' WHERE id='WM-xxx';
   
2. System should:
   - Detect status change within 3 seconds
   - Show success modal
   - Auto-redirect to home after 5 seconds
   - Clear cart
```

### Test 8: Timer Timeout
```
1. Wait 15 minutes (or manually set countdown to 0)
2. System should:
   - Show alert "หมดเวลาชำระเงิน"
   - Redirect to home page
   - Clear payment page
```

### Test 9: Wallet History
```
1. Login as user
2. Click "📊 ประวัติการเติม" tab
3. Verify completed orders displayed with:
   - Order ID
   - Amount
   - Payment method
   - Status
   - Date/time
```

---

## 🎯 Key Features Implemented

### ✅ Coupon System
- Percentage discounts (e.g., 10%)
- Fixed amount discounts (e.g., 50 THB)
- Min amount requirements
- Usage limits per coupon
- Expiry date validation
- Real-time validation

### ✅ Multi-Payment Methods
- **PromptPay**: QR code + 0819122155
- **TrueMoney Wallet**: QR code + phone number input
- Dynamic UI based on selection

### ✅ Order Management
- Order ID auto-generation (WM-timestamp)
- Order details storage (items, amount, payment method)
- Payment status tracking
- Wallet history retrieval (last 50 orders)

### ✅ User Experience
- 3-step payment flow (Checkout → Confirmation → Payment)
- Legal disclaimer (6 warning points)
- 15-minute countdown timer
- Payment status polling (3-second intervals)
- Auto-redirect on completion/timeout
- QR code download functionality
- Success modal with 5-second delay

### ✅ Security
- Session-based authentication for wallet history
- Password hashing with bcryptjs
- Database validation for coupon usage
- Error handling for invalid inputs

---

## 📊 Database Schema Changes

### users table
```sql
ALTER TABLE users ADD COLUMN wallet_balance DECIMAL(10,2) DEFAULT 0.00;
```

### coupons table (NEW)
```sql
CREATE TABLE coupons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type ENUM('percentage','fixed'),
  discount_value DECIMAL(10,2),
  max_uses INT,
  current_uses INT DEFAULT 0,
  min_amount DECIMAL(10,2) DEFAULT 0,
  valid_from DATETIME DEFAULT NOW(),
  valid_until DATETIME,
  is_active BOOLEAN DEFAULT 1
);
```

### orders table modifications
```sql
ALTER TABLE orders 
  MODIFY payment_method ENUM('PromptPay','TrueMoney'),
  ADD COLUMN payment_account VARCHAR(50),
  ADD COLUMN coupon_code VARCHAR(50),
  ADD COLUMN discount_amount DECIMAL(10,2),
  ADD COLUMN final_amount DECIMAL(10,2);
```

---

## 🚀 Deployment Checklist

- [ ] Database migration executed
- [ ] Environment variables set (if needed)
- [ ] Node packages installed (`npm install`)
- [ ] Server started (`npm start` or `node server.js`)
- [ ] All 9 tests passed
- [ ] Sample coupons created in database
- [ ] PromptPay number verified (0819122155)
- [ ] Frontend loads without errors (check console)

---

## 📝 Notes for Future Enhancement

1. **Payment Status Auto-Update**: Currently manual SQL update. Integrate with real payment gateway (e.g., PromptPay API, TrueMoney API)
2. **Wallet Credits**: Update user's wallet_balance automatically when payment completes
3. **Order Delivery**: Auto-deliver in-game items when payment status = completed
4. **Admin Dashboard**: View coupon usage stats, create new coupons, manage orders
5. **Email Notifications**: Send order confirmation and success emails
6. **QR Expiry**: QR code should become invalid after timer expires
7. **Retry Logic**: Allow user to generate new QR if first one fails
8. **Analytics**: Track payment method preference, coupon usage rates

---

## 🐛 Troubleshooting

### Issue: Checkout modal not opening
- Check: Browser console for errors
- Check: `showCheckoutModal()` function in home.js
- Check: Checkout modal HTML element exists in home.ejs

### Issue: QR code not generating
- Check: `qrcode` npm package installed
- Check: Payload is valid (PromptPay or TrueMoney format)
- Check: Network request to `/api/payment/generate-qr` succeeds

### Issue: Coupon validation failing
- Check: Coupon code exists in database
- Check: Coupon is active (`is_active = 1`)
- Check: Coupon not expired (`valid_until > NOW()`)
- Check: User amount meets minimum (`amount >= min_amount`)
- Check: Coupon usage not exceeded (`current_uses < max_uses`)

### Issue: Payment status not updating
- Check: Order ID correct
- Check: Order exists in database with matching ID
- Check: Polling interval still running (no errors in console)
- Check: Manual SQL update test works

### Issue: TrueMoney phone number not saving
- Check: Phone number format (should be stored as string)
- Check: `paymentAccount` parameter passed to `/api/payment/generate-qr`
- Check: `payment_account` column exists in orders table

---

## 📞 Support Commands

```bash
# Check database connection
mysql -u root -p -e "USE maple_db; SELECT * FROM users LIMIT 1;"

# View recent orders
mysql -u root -p -e "USE maple_db; SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;"

# View coupons
mysql -u root -p -e "USE maple_db; SELECT * FROM coupons;"

# Reset order status for testing
mysql -u root -p -e "USE maple_db; UPDATE orders SET status='pending' WHERE status='completed' LIMIT 1;"
```

---

**Generated**: $(date)
**Payment System Version**: 2.0 (Complete Redesign)
