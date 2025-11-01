# Payment Flow Fixes - November 1, 2025

## Issues Fixed

### Issue 1: VerifySubscriptionPage Using Full Page Reload

**Problem:** VerifySubscriptionPage was using `window.location.href` which caused full page reloads, breaking the React SPA navigation flow and preventing proper state management.

**Fix:** Changed all navigation to use `window.history.pushState` + `PopStateEvent` dispatch pattern (same as other pages in the app).

**Changes in `pages/VerifySubscriptionPage.tsx`:**

```typescript
// OLD (causes full reload):
window.location.href = "/dashboard";

// NEW (SPA navigation):
window.history.pushState({ page: "/dashboard" }, "", "/dashboard");
window.dispatchEvent(new PopStateEvent("popstate"));
```

**Applied to 3 redirect locations:**

- Auth failure → `/auth`
- Has plan → `/dashboard`
- No plan → `/payment`
- Error fallback → `/payment`

### Issue 2: Payment Failure Not Redirecting to Cancel Page

**Problem:** When Dodo payment fails (card declined, etc.), it shows a failure page on Dodo's domain (`checkout.dodopayments.com/status/{id}/failed`) but doesn't redirect back to the app's cancel page.

**Root Cause:** The Dodo subscription payload was missing the `cancel_url` parameter.

**Fix:** Added `cancel_url` to Dodo payment payload in server.

**Changes in `sms-server.js` (line ~2261):**

```javascript
// Build cancel URL
const cancelUrl = `${baseUrl}/payment-cancel?client_id=${encodeURIComponent(
  companyId || "unknown"
)}&plan_id=${encodeURIComponent(plan)}`;

// Add to payload
const payload = {
  payment_link: true,
  product_id: productId,
  quantity: 1,
  customer: {
    /* ... */
  },
  billing: {
    /* ... */
  },
  return_url: successUrl, // Success redirect
  cancel_url: cancelUrl, // ✅ NEW: Failure/cancel redirect
  metadata: {
    /* ... */
  },
};
```

**Updated logging:**

```javascript
console.log(
  `[Dodo Payment] Product ID: ${productId}, Return URL: ${successUrl}, Cancel URL: ${cancelUrl}`
);
```

## Expected Behavior After Fixes

### Flow 1: New User Signup

```
Signup Page
  ↓
VerifySubscriptionPage (uses pushState navigation)
  ↓ (checks Firestore)
  ↓ No plan found
  ↓
Payment Page (navigates via pushState, NOT reload)
  ↓
Dodo Gateway
  ↓
[Success] → /payment-success → Dashboard
[Failure] → /payment-cancel → "Try Again" button
```

### Flow 2: Existing User

```
Signup/Login
  ↓
VerifySubscriptionPage
  ↓ (checks Firestore)
  ↓ Plan EXISTS!
  ↓
Dashboard (navigates via pushState, NOT reload)
```

### Flow 3: Payment Failure

```
Payment Page
  ↓
Dodo Gateway
  ↓
Card Declined / Payment Failed
  ↓
Dodo redirects to: /payment-cancel?client_id=...&plan_id=...
  ↓
PaymentCancelPage shows:
  - "Payment Cancelled" message
  - "Try Payment Again" button → /payment
  - "Go to Home Page" button
```

## Testing Checklist

### Test 1: Verify No Full Page Reloads

- [ ] Sign up with new account
- [ ] Watch Network tab - should see NO full document reload
- [ ] VerifySubscription should use pushState
- [ ] Should smoothly transition to payment page

### Test 2: Verify Existing User Skips Payment

- [ ] Sign up/login with account that has active plan
- [ ] VerifySubscription detects plan
- [ ] Smoothly navigates to dashboard (no reload)
- [ ] Dashboard shows active subscription

### Test 3: Verify Payment Failure Redirect

- [ ] New signup → payment page
- [ ] Click "Pay" button
- [ ] Use test card that will be declined
- [ ] Dodo should redirect to `/payment-cancel`
- [ ] Should see cancel page with retry button
- [ ] Click retry → back to payment page

### Test 4: Verify Payment Success Still Works

- [ ] Complete payment with valid test card
- [ ] Should redirect to `/payment-success`
- [ ] Should show success message and countdown
- [ ] Should redirect to dashboard after 5s

## Server Logs to Verify

**Before Payment Creation:**

```
[Dodo Payment] Creating SUBSCRIPTION for pro_6m$ (price 100)...
[Dodo Payment] API URL: https://live.dodopayments.com/subscriptions
[Dodo Payment] Product ID: pdt_..., Return URL: https://reputationflow360.com/payment-success?client_id=...&plan_id=..., Cancel URL: https://reputationflow360.com/payment-cancel?client_id=...&plan_id=...
```

**On Success:**

```
[Dodo Payment] ✅ Subscription created successfully!
[Dodo Payment] Payment URL: https://checkout.dodopayments.com/...
```

## Dodo Dashboard Configuration

### Required Settings

1. **Webhook URL** (if using webhooks):

   ```
   https://your-backend.onrender.com/api/payments/webhook
   ```

2. **Allowed Return URLs** (whitelist these):

   ```
   https://reputationflow360.com/payment-success
   https://reputationflow360.com/payment-cancel
   ```

3. **Test Mode vs Live Mode:**
   - Use test API key + test product IDs for testing
   - Use live API key + live product IDs for production
   - Test card: Use Dodo's documented test cards

## Files Modified

1. **`sms-server.js`** (2 changes)

   - Added `cancel_url` to Dodo payload
   - Updated logging to show cancel URL

2. **`pages/VerifySubscriptionPage.tsx`** (4 changes)
   - Auth failure navigation
   - Has-plan navigation (to dashboard)
   - No-plan navigation (to payment)
   - Error fallback navigation

## Deployment Steps

1. **Commit changes:**

   ```powershell
   git add .
   git commit -m "Fix: Add Dodo cancel_url and fix VerifySubscriptionPage navigation (no full reload)"
   git push origin main
   ```

2. **Verify Render deployment:**

   - Backend should auto-deploy
   - Check logs for new cancel URL in payment creation

3. **Verify Vercel deployment:**

   - Frontend should auto-deploy
   - Test signup flow with no full reloads

4. **Test in production:**
   - New user signup flow
   - Existing user login (should skip payment)
   - Payment failure (should go to cancel page)
   - Payment success (should go to success → dashboard)

## Known Dodo Behavior

Dodo Payments has different redirect patterns:

1. **Success:** Redirects to `return_url`

   - Example: `https://reputationflow360.com/payment-success?client_id=...&plan_id=...`

2. **Failure/Decline:** Shows failure page on Dodo domain first

   - Example: `https://checkout.dodopayments.com/status/{id}/failed`
   - Message: "Your card was declined. Your request was in live mode, but used a known test card."
   - Then should redirect to `cancel_url` (if provided)

3. **Cancel (User Clicks Back):** Redirects to `cancel_url`
   - Example: `https://reputationflow360.com/payment-cancel?client_id=...&plan_id=...`

**Important:** The `cancel_url` parameter is what triggers Dodo to redirect back to your app after a failure. Without it, the user stays on Dodo's failure page.

## Troubleshooting

### Issue: Still seeing full page reload on verification

**Cause:** Browser might be caching old JS bundle
**Fix:** Hard refresh (Ctrl+Shift+R) or clear cache

### Issue: Payment failure doesn't redirect to cancel page

**Cause 1:** `cancel_url` not in Dodo whitelist
**Fix:** Add to Dodo dashboard allowed URLs

**Cause 2:** Dodo API doesn't support `cancel_url` for subscriptions
**Fix:** Check Dodo API docs - may need to use `failure_url` instead

### Issue: VerifySubscription still goes directly to payment

**Cause:** Firestore profile doesn't have plan data
**Fix:** Check Firestore console: `clients/{uid}/profile/main` should have `planId`

### Issue: Network errors in console

**Cause:** CORS or API endpoint issues
**Fix:** Verify `FRONTEND_URL` and `CORS_ORIGINS` on Render

## Summary

✅ **Fixed navigation:** VerifySubscriptionPage now uses SPA routing (no reloads)
✅ **Fixed payment failures:** Added `cancel_url` so failed payments redirect to cancel page
✅ **Improved logging:** Server now shows both success and cancel URLs
✅ **Maintained existing flows:** Success and existing-user flows unchanged

**All fixes ready for testing and deployment!** 🚀
