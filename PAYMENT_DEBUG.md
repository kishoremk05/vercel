# Payment Gateway Debugging Guide

## Current Issue

Body parsing fails on Render, causing `plan: undefined, price: NaN` even though CORS passes.

## ✅ Fixes Applied (Just Deployed)

### Frontend Changes:

1. **PaymentPage.tsx**: Now sends ALL required headers explicitly:

   ```javascript
   headers: {
     "Content-Type": "application/json",
     "x-company-id": companyId || "",
     "x-user-email": userEmail || "",
     "x-plan-id": selectedPlan.id || "",
     "x-price": String(selectedPlan.price || ""),
   }
   ```

2. **App.tsx**: Same header fix for startCheckout()

3. **Added logging**: Frontend now logs what it's sending

### Backend Changes:

1. **Ultra-robust parsing**: Now reads from body → rawBody → headers → query
2. **Detailed debug logging**: Shows exactly what server receives
3. **CORS headers**: All custom headers allowed

---

## Testing Steps (After Render Redeploys)

### Step 1: Wait for Deployment

- **Render**: Check https://dashboard.render.com/
- Wait for "Live" status (usually 2-3 minutes)
- **Vercel**: Should auto-deploy from GitHub push

### Step 2: Test Payment Flow

1. Open: https://vercel-swart-chi-29.vercel.app
2. Log in (or signup)
3. Select a pricing plan
4. Click "Pay $XX"

### Step 3: Check Browser Console

Expected to see:

```
[Payment] Sending request: {
  url: "https://server-cibp.onrender.com/api/payments/create-session",
  plan: "pro_6m",
  price: 80,
  companyId: "AiG0F...",
  userEmail: "team66216@gmail.com"
}
```

### Step 4: Check Network Tab

1. Open DevTools → Network tab
2. Find POST to `/api/payments/create-session`
3. **Request Headers** should show:
   ```
   x-company-id: AiG0FdxfeIWByiHR2YETuPxLQWT2
   x-user-email: team66216@gmail.com
   x-plan-id: pro_6m
   x-price: 80
   ```
4. **Request Payload** should show JSON body (even if server ignores it)

### Step 5: Check Render Logs

Expected to see:

```
[Dodo Payment] RAW REQUEST DEBUG: {
  hasBody: false,
  bodyKeys: [],
  hasHeaders: {
    xCompanyId: true,
    xUserEmail: true,
    xPlanId: true,
    xPrice: true
  }
}

[Dodo Payment] PARSED VALUES: {
  plan: 'pro_6m',
  price: 80,
  companyId: 'AiG0FdxfeIWByiHR2YETuPxLQWT2',
  userEmail: 'team66216@gmail.com'
}
```

---

## Expected Results

✅ **Success**:

```
[Dodo Payment] ✅ Subscription created successfully!
[Dodo Payment] Payment URL: https://test.dodopayments.com/checkout/...
```

Then browser redirects to Dodo payment page.

❌ **Still Failing**:
If you still see `plan: undefined`, check:

1. **Headers Not Arriving?**

   - Render might be stripping custom headers
   - **Solution**: Add as query params instead

2. **Body Still Empty?**
   - Render proxy issue
   - **Solution**: Already handled with header fallback

---

## Fallback Plan: Query Parameters

If headers don't work either, we can use query params:

**Frontend change**:

```typescript
const url = `${apiBase}/api/payments/create-session?plan=${
  selectedPlan.id
}&price=${
  selectedPlan.price
}&companyId=${companyId}&userEmail=${encodeURIComponent(userEmail)}`;

const response = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
});
```

**Backend already supports this!** Check line with `req.query.plan`

---

## Quick Fixes Checklist

- [x] CORS headers allow custom headers
- [x] Frontend sends x-plan-id, x-price, x-company-id, x-user-email
- [x] Server reads from headers as fallback
- [x] Server reads from query params as last resort
- [x] Added comprehensive debug logging
- [ ] **TODO**: Rename FRONTEND_UR → FRONTEND_URL on Render
- [ ] Test after Render redeploys

---

## Environment Variables to Check

On Render dashboard:

```bash
DODO_API_KEY = sk_test_... (present ✅)
DODO_API_BASE = https://test.dodopayments.com (present ✅)
DODO_PRODUCT_PRO_6M = pdt_Blsof767CZTPWreD75zFF (present ✅)
DODO_PRODUCT_GROWTH_3M = pdt_OsKdNhpmFjOxSkqpwBtXR (present ✅)
DODO_PRODUCT_STARTER_1M = pdt_0SaMzoGEsjSCi8t0xd5vN (present ✅)
CORS_ORIGINS = https://vercel-swart-chi-29.vercel.app (present ✅)
FRONTEND_UR = ... (WRONG - needs rename to FRONTEND_URL ⚠️)
```

**Critical**: Rename `FRONTEND_UR` to `FRONTEND_URL` so Dodo return_url works!

---

## Final Verification

After Render redeploys (2-3 minutes), the new logs should show:

**Before (broken)**:

```
[Dodo Payment] Creating session: {
  plan: undefined,  ❌
  price: NaN,       ❌
  companyId: 'AiG0F...',
  userEmail: 'team66216@gmail.com'
}
```

**After (fixed)**:

```
[Dodo Payment] PARSED VALUES: {
  plan: 'pro_6m',   ✅
  price: 80,        ✅
  companyId: 'AiG0FdxfeIWByiHR2YETuPxLQWT2',
  userEmail: 'team66216@gmail.com'
}
```

---

## Next Steps

1. ⏳ **Wait 2-3 minutes** for Render to redeploy
2. 🧪 **Test payment** from Vercel app
3. 📋 **Send me the new Render logs** showing "RAW REQUEST DEBUG" and "PARSED VALUES"
4. ✅ **If plan/price are populated**, payment should work!
5. 🔧 **If still broken**, we'll switch to query param method

---

## Support

If payment still fails after this:

1. Copy the **entire** "[Dodo Payment] RAW REQUEST DEBUG" log block
2. Copy the **entire** "[Dodo Payment] PARSED VALUES" log block
3. Copy browser console logs
4. Share all three and I'll diagnose the exact issue

The new logging will tell us EXACTLY where the data is being lost! 🔍
