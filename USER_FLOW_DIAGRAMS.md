# User Flow Diagrams - Payment & Verification

## 📋 Complete User Flows

### Flow 1: New User Signup (No Existing Plan)

```
┌─────────────┐
│   Signup    │ User creates account
│   Page      │ (Email or Google)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Verify     │ 🔄 Loading: "Verifying your account..."
│Subscription │ 🔍 Check Firestore: clients/{uid}/profile/main
│   Page      │ ❌ No planId found
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Payment    │ User selects plan
│    Page     │ Clicks "Pay $XX"
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Dodo     │ External payment gateway
│  Gateway    │ User completes payment
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Payment    │ ✅ Success animation
│  Success    │ 📝 Save to Firestore
│   Page      │ ⏱️  5-second countdown
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Dashboard   │ 🎉 Ready to use!
│    Page     │ Shows active plan
└─────────────┘
```

### Flow 2: Existing User (Has Active Plan)

```
┌─────────────┐
│   Signup    │ User creates/logs in
│  or Login   │ (Email or Google)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Verify     │ 🔄 Loading: "Verifying your account..."
│Subscription │ 🔍 Check Firestore: clients/{uid}/profile/main
│   Page      │ ✅ planId FOUND! (or SMS credits > 0)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Dashboard  │ 🎉 Skip payment - already has plan!
│    Page     │ Shows existing subscription
└─────────────┘
```

### Flow 3: Payment Cancellation/Failure

```
┌─────────────┐
│  Payment    │ User on payment page
│    Page     │ Clicks "Pay"
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Dodo     │ User cancels or
│  Gateway    │ payment fails
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Payment    │ ⚠️  "Payment Cancelled"
│   Cancel    │ 💡 "Try Payment Again" button
│   Page      │ 🏠 "Go to Home Page" button
└──────┬──────┘
       │ (Click "Try Again")
       ▼
┌─────────────┐
│  Payment    │ ↺ Retry payment
│    Page     │ User can select plan again
└─────────────┘
```

## 🔑 Key Decision Points

### VerifySubscriptionPage Logic

```typescript
// Check if user has active plan
const hasPlan = !!(
  data?.planId ||        // Has plan ID
  data?.planName ||      // Has plan name
  data?.status === "active"  // Status is active
);

const hasCredits = Number(data?.remainingCredits || data?.smsCredits || 0) > 0;

if (hasPlan || hasCredits) {
  → Redirect to: /dashboard (Skip payment!)
} else {
  → Redirect to: /payment
}
```

### Payment Return URL (from Dodo)

```
Success URL:
https://reputationflow360.com/payment-success?client_id=ABC123&plan_id=growth_3m

Cancel URL (not explicitly set, but handled if user cancels):
https://reputationflow360.com/payment-cancel
```

## 🎨 UI States

### VerifySubscriptionPage States

**State 1: Checking (Blue)**

```
┌──────────────────────┐
│   ⟳ Verifying...    │ Blue spinner
│                      │
│  "Verifying your     │
│   account..."        │
│                      │
│  □ Authenticating... │ Progress dots
│  □ Checking plan...  │
│  □ Preparing...      │
└──────────────────────┘
```

**State 2: Has Plan (Green)**

```
┌──────────────────────┐
│      ✓ Success!      │ Green checkmark
│                      │
│  "Active             │
│  subscription        │
│  found!"             │
│                      │
│  → Dashboard...      │ Auto-redirect
└──────────────────────┘
```

**State 3: No Plan (Yellow)**

```
┌──────────────────────┐
│      ⚠ Setup         │ Yellow warning
│                      │
│  "No subscription    │
│   found"             │
│                      │
│  → Payment page...   │ Auto-redirect
└──────────────────────┘
```

**State 4: Error (Red)**

```
┌──────────────────────┐
│      ✗ Error         │ Red X
│                      │
│  "Verification       │
│   failed"            │
│                      │
│  → Payment page...   │ Fallback
└──────────────────────┘
```

## 📊 Firestore Data Structure

### Profile Document Path

```
clients/{userId}/profile/main
```

### Required Fields for "Has Plan" Detection

```json
{
  "planId": "growth_3m", // ✓ Detected
  "planName": "Growth", // ✓ Detected
  "status": "active", // ✓ Detected
  "smsCredits": 600,
  "remainingCredits": 450, // ✓ Detected if > 0
  "activatedAt": "2025-11-01...",
  "expiryAt": "2026-02-01..."
}
```

## 🔄 Redirect Timing

| Page                          | Wait Time | Action                                 |
| ----------------------------- | --------- | -------------------------------------- |
| VerifySubscription (checking) | 0-10s     | Wait for auth + Firestore check        |
| VerifySubscription (has plan) | 1.5s      | Show success → redirect to dashboard   |
| VerifySubscription (no plan)  | 1.5s      | Show message → redirect to payment     |
| VerifySubscription (error)    | 2s        | Show error → redirect to payment       |
| PaymentSuccess                | 5s        | Countdown → auto-redirect to dashboard |

## 🚀 Quick Test Commands

### Test New User Flow

1. Open incognito: `https://reputationflow360.com`
2. Click "Sign Up"
3. Create account with new email
4. → Should see verification loading
5. → Should redirect to payment page

### Test Existing User Flow

1. Open incognito: `https://reputationflow360.com`
2. Click "Sign Up"
3. Use email with existing plan
4. → Should see "Active subscription found!"
5. → Should redirect to dashboard

### Test Payment Cancel

1. Reach payment page
2. Click "Pay"
3. Cancel on Dodo gateway
4. → Should see payment cancel page
5. → Click "Try Payment Again"
6. → Should return to payment page

### Test Payment Success

1. Complete payment on Dodo
2. → Should see payment success page
3. → Wait 5 seconds OR click button
4. → Should redirect to dashboard

## 📝 Implementation Checklist

- [x] Create VerifySubscriptionPage component
- [x] Update SignupPage redirect target
- [x] Add route to types.ts
- [x] Add route mapping in App.tsx
- [x] Add component rendering in App.tsx
- [x] Verify PaymentCancelPage has retry button
- [x] Verify PaymentSuccessPage has countdown
- [x] Test Firestore subscription check logic
- [x] Document all flows
- [x] Create deployment guide

## 🎯 Success Criteria

✅ New users see verification loading after signup
✅ Users with plans skip payment and go to dashboard
✅ Users without plans are directed to payment page
✅ Payment cancellation allows retry
✅ Payment success redirects to dashboard
✅ All redirects happen smoothly with visual feedback
✅ Error states provide clear guidance
✅ Firestore checks are accurate and fast

---

**All flows implemented and ready for production!** 🎉
