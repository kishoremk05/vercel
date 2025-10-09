# ✅ Dodo Payment Integration - Complete Setup Checklist

## 🎯 Overview

This document provides a complete checklist to ensure your Dodo payment integration is working perfectly.

## 📋 Pre-Setup Checklist

- [ ] **Dodo Account Created**

  - Go to https://test.dodopayments.com
  - Sign up for a test account
  - Verify your email

- [ ] **API Key Obtained**

  - Log in to Dodo Dashboard
  - Navigate to Settings → API Keys
  - Copy your Test API Key

- [ ] **Products Created in Dodo**
  - Create 3 subscription products:
    - Starter (1 month) - $15
    - Growth (3 months) - $40
    - Professional (6 months) - $80
  - Copy the Product IDs for each

## 🔧 Installation Checklist

### 1. Code Updates

- [x] ✅ Server code updated (`sms-server.js`)

  - Product ID mapping enhanced
  - Error handling improved
  - Axios integration added
  - Better logging implemented

- [x] ✅ Package.json updated

  - Axios dependency added

- [ ] **Install Dependencies**
  ```bash
  npm install
  ```

### 2. Environment Configuration

- [ ] **Create .env file**

  ```bash
  copy .env.example .env
  ```

- [ ] **Add Dodo API Key**

  ```env
  DODO_API_KEY=your_actual_api_key_here
  ```

- [ ] **Verify Product IDs**

  ```env
  DODO_PRODUCT_STARTER_1M=pdt_0SaMzoGEsjSCi8t0xd5vN
  DODO_PRODUCT_GROWTH_3M=pdt_OsKdNhpmFjOxSkqpwBtXR
  DODO_PRODUCT_PRO_6M=pdt_Blsof767CZTPWreD75zFF
  ```

- [ ] **Set Frontend URL**
  ```env
  FRONTEND_URL=https://vercel-swart-chi-29.vercel.app
  ```

### 3. Test the Integration

- [ ] **Run Test Script**

  ```bash
  node test-dodo-payment.js
  ```

  - Should show "✅ Test completed successfully!"
  - Should display a payment link

- [ ] **Start Development Server**
  ```bash
  npm run dev
  ```
  - Server should start without errors
  - Check for "[Dodo] ✅" messages in logs

## 🧪 Testing Checklist

### Local Testing

- [ ] **Payment Page Loads**

  - Navigate to `http://localhost:5173/payment`
  - All 3 plans should be visible
  - Plan details should be correct

- [ ] **Plan Selection Works**

  - Click different plan cards
  - Selected plan should be highlighted
  - Price should update in summary

- [ ] **Payment Creation Works**

  - Click "Pay $[amount]" button
  - Button should show "Processing..."
  - Should redirect to Dodo payment page

- [ ] **Check Server Logs**
  - Look for these messages:
    ```
    [Dodo Payment] Creating SUBSCRIPTION for [plan] plan ($[price])...
    [Dodo Payment] ✅ Subscription created successfully!
    [Dodo Payment] Payment URL: https://test.dodopayments.com/checkout/...
    ```

### Payment Flow Testing

- [ ] **Test Payment on Dodo**

  - Use test card: `4242 4242 4242 4242`
  - Expiry: Any future date
  - CVV: Any 3 digits
  - Complete the payment

- [ ] **Success Redirect Works**

  - After payment, should redirect to `/payment-success`
  - Success page should display correctly
  - Countdown should work
  - "Go to Dashboard" button should work

- [ ] **Cancel Flow Works**
  - Start payment process
  - Click "Cancel" on Dodo page
  - Should redirect to `/payment-cancel`
  - Cancel page should display correctly
  - "Try Payment Again" button should work

## 🔍 Verification Checklist

### Server-Side Verification

- [ ] **Check Environment Variables**

  ```bash
  # On Windows PowerShell
  $env:DODO_API_KEY
  $env:DODO_API_BASE
  ```

  - Should display your actual values

- [ ] **Verify Axios Installation**

  ```bash
  npm list axios
  ```

  - Should show `axios@1.7.2` or higher

- [ ] **Check Server Logs**
  - No error messages about missing DODO_API_KEY
  - No "MODULE_NOT_FOUND" errors
  - Successful API calls logged

### Frontend Verification

- [ ] **Payment Page UI**

  - Plans display correctly
  - Prices are accurate
  - Features are listed
  - Payment method selector works
  - Form validation works

- [ ] **API Communication**

  - Open Browser DevTools → Network tab
  - Click Pay button
  - Look for POST to `/api/payments/create-session`
  - Response should be `{ success: true, url: "..." }`

- [ ] **Error Handling**
  - Try payment without login (if required)
  - Should show appropriate error
  - Try with invalid data
  - Should show validation errors

## 🚨 Common Issues & Solutions

### ❌ "DODO_API_KEY not configured"

**Solution**:

1. Check `.env` file exists
2. Verify `DODO_API_KEY` is set
3. Restart server after editing `.env`

### ❌ "Invalid plan selected"

**Solution**:

- Frontend sends: `starter_1m`, `growth_3m`, or `pro_6m`
- Server accepts both old and new naming
- Check `PaymentPage.tsx` plan IDs match

### ❌ "Payment gateway did not return checkout URL"

**Solution**:

1. Verify product IDs in `.env` match Dodo Dashboard
2. Check product is "Published" in Dodo
3. Verify billing currency is set to USD

### ❌ "axios is not defined"

**Solution**:

```bash
npm install axios
```

### ❌ Redirect fails after payment

**Solution**:

1. Check `FRONTEND_URL` in `.env`
2. Verify URL doesn't have trailing slash
3. Test both success and cancel URLs

## 📊 Success Criteria

Your integration is working correctly if:

- ✅ Test script runs without errors
- ✅ Server starts and loads Dodo config
- ✅ Payment page displays all plans
- ✅ Clicking Pay redirects to Dodo
- ✅ Test payment completes successfully
- ✅ Success page displays after payment
- ✅ Server logs show successful API calls
- ✅ No console errors in browser

## 🎉 Next Steps

Once everything is working:

1. **Configure Webhooks** (Optional)

   - In Dodo Dashboard → Webhooks
   - Add endpoint: `https://your-server.com/api/payments/webhook`
   - Select events: `subscription.created`, `payment.succeeded`

2. **Update Firebase** (If using)

   - Webhook handler updates subscription in Firestore
   - Verify subscription data structure

3. **Production Deployment**

   - Switch to production API keys
   - Update `DODO_API_BASE` to production URL
   - Test with real payment methods

4. **Security Hardening**
   - Enable webhook signature verification
   - Add rate limiting to payment endpoint
   - Implement idempotency keys

## 📝 Documentation

Refer to these files for more information:

- `DODO_PAYMENT_SETUP.md` - Detailed setup guide
- `.env.example` - Environment variable template
- `test-dodo-payment.js` - Integration test script
- `sms-server.js` - Server implementation

## 📞 Need Help?

- Dodo Documentation: https://docs.dodopayments.com
- Dodo Support: support@dodopayments.com
- Test Dashboard: https://test.dodopayments.com/dashboard

---

**Last Updated**: January 2025
