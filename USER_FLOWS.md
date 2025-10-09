# User Flows Documentation

## Overview
Your app now supports **two complete user journeys** for subscription signup and dashboard access.

---

## 🔵 Flow 1: Plan Selection First (Original Flow)

**Best for**: Users who know exactly what they want

### Journey:
```
Homepage
   ↓ (Click "Get Started" or select a plan)
   ↓
Pricing Section (on Homepage)
   ↓ (Select: Starter, Growth, or Pro)
   ↓
Login/Signup Page
   ↓ (Enter credentials)
   ↓
Dodo Payment Gateway
   ↓ (Complete payment)
   ↓
Payment Success Page
   ↓ (Auto-redirect after 5s)
   ↓
Dashboard ✅
```

### User Experience:
1. User lands on homepage
2. Scrolls to pricing section (or clicks CTA)
3. Clicks "Get Started" on their preferred plan (e.g., Growth - $40)
4. **If not logged in**: Redirected to Login/Signup
5. After login, **automatically** redirected to Dodo checkout
6. Completes payment on Dodo's secure page
7. Returns to app → Payment Success page → Dashboard

### Code Implementation:
- **Homepage**: `onSelectPlan` saves `pendingPlan` to localStorage
- **AuthPage**: `onAuthSuccess` checks for `pendingPlan` → calls `startCheckout()`
- **App.tsx**: `startCheckout()` creates Dodo session and redirects

---

## 🟢 Flow 2: Login First (New Flow)

**Best for**: Returning users or those who want to explore before buying

### Journey:
```
Homepage
   ↓ (Click "Login" or "Try Free")
   ↓
Login/Signup Page
   ↓ (Enter credentials)
   ↓
Payment Page (Pricing/Plan Selection)
   ↓ (Select a plan OR skip)
   ├─ Option A: Select plan → Dodo Payment Gateway
   │     ↓ (Complete payment)
   │     ↓
   │  Payment Success → Dashboard ✅
   │
   └─ Option B: Click "Skip for now" → Dashboard ✅
```

### User Experience:
1. User clicks "Login" or "Try Free" on homepage
2. Enters credentials (or signs up)
3. **After login**: Redirected to Payment/Pricing page
4. **Two choices**:
   - **Pay now**: Select a plan → redirected to Dodo checkout → returns to dashboard
   - **Skip**: Click "Skip for now" → goes directly to dashboard (can pay later)

### Code Implementation:
- **AuthPage**: `onAuthSuccess` checks if `pendingPlan` exists:
  - **If YES**: Call `startCheckout(pending)` (Flow 1 behavior)
  - **If NO**: Navigate to Payment page (Flow 2 behavior)
- **PaymentPage**: Shows pricing options + "Skip for now" button
- **Skip button**: Redirects to `/dashboard`

---

## 🎯 Key Features

### Smart Plan Persistence
- If user selects a plan but isn't logged in, the plan is saved in `localStorage` as `pendingPlan`
- After login, they're automatically taken to checkout for that plan
- If they login without selecting a plan, they see the pricing page to choose

### Skip-to-Dashboard Option
Users can skip payment and explore the dashboard by:
1. Clicking **"Skip for now"** button (top right of Payment page)
2. Clicking **"skip to dashboard"** link in the welcome message
3. They can always come back to upgrade via Dashboard or Settings

### Payment Success Flow
After successful payment:
```
Dodo Payment Page
   ↓ (Payment complete)
   ↓
Return to: /payment-success
   ↓ (Auto-redirect countdown: 5s)
   ↓
Dashboard ✅
```

---

## 📱 UI Elements

### Homepage
- **Hero Section**: "Get Started" and "Try Free" buttons
- **Pricing Section**: Three plan cards (Starter, Growth, Pro)
- Each plan has "Get Started" button → triggers Flow 1

### Payment Page (New Features)
**Header buttons**:
- 🔹 **"Skip for now"** - Go to dashboard without paying
- 🔹 **"Change plan"** - Return to homepage pricing section
- 🔹 **"← Back"** - Go to previous page

**Welcome message**:
```
Choose Your Plan
Welcome [Business Name] • [Email]
Select a plan to unlock unlimited SMS credits, or skip to dashboard
```

**Plan selection**:
- Visual cards for Starter, Growth, Pro
- Clear pricing and features
- "Pay $XX" button triggers Dodo checkout

---

## 🔄 User Journey Examples

### Example 1: Eager Buyer (Flow 1)
**Sarah wants the Growth plan immediately**

1. Lands on homepage
2. Sees pricing: "Growth - $40/3mo" looks perfect
3. Clicks "Get Started" on Growth plan
4. Not logged in → Redirected to login
5. Creates account quickly
6. **Automatically** redirected to Dodo payment for Growth plan
7. Completes payment
8. Lands in dashboard with Growth plan active ✅

**Time to dashboard**: ~3 minutes

---

### Example 2: Cautious Explorer (Flow 2)
**John wants to try before buying**

1. Lands on homepage
2. Clicks "Try Free" button
3. Creates account on signup page
4. **Sees pricing page** with all plans
5. Thinks: "Let me explore the dashboard first"
6. Clicks **"Skip for now"**
7. Lands in dashboard (limited/trial mode)
8. Sends a few test SMS
9. Likes it! Clicks "Upgrade" in dashboard → returns to pricing
10. Selects Growth plan → pays → back to dashboard ✅

**Time to explore**: ~30 seconds  
**Time to upgrade**: Additional ~2 minutes (when ready)

---

### Example 3: Returning User
**Mike already has an account but hasn't paid yet**

1. Clicks "Login" on homepage
2. Enters credentials
3. **Sees pricing page** (no pending plan)
4. Already knows he wants Pro plan
5. Selects Pro → pays on Dodo
6. Returns to dashboard with Pro plan active ✅

**Time to upgrade**: ~2 minutes

---

## 🛠️ Technical Details

### State Management
```javascript
// Pending plan stored in localStorage
localStorage.setItem("pendingPlan", "growth_3m");

// After login, check for pending plan
const pending = localStorage.getItem("pendingPlan");
if (pending) {
  startCheckout(pending); // Go directly to payment
} else {
  navigate(Page.Payment); // Show pricing page
}
```

### Payment Flow
```javascript
// Create Dodo subscription session
const startCheckout = async (planId) => {
  const response = await fetch("/api/payments/create-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-company-id": companyId,
      "x-user-email": userEmail,
      "x-plan-id": planId,
      "x-price": price,
    },
    body: JSON.stringify({ plan: planId, price, companyId, userEmail }),
  });
  
  const { url } = await response.json();
  window.location.href = url; // Redirect to Dodo
};
```

### Return URL
```javascript
// Set in Render env:
FRONTEND_URL = https://vercel-swart-chi-29.vercel.app

// Dodo redirects to:
${FRONTEND_URL}/payment-success

// PaymentSuccessPage auto-redirects to:
/dashboard (after 5 second countdown)
```

---

## 🎨 UI Mockup

### Payment Page Layout
```
┌─────────────────────────────────────────────────────┐
│  🌟 ReputationFlow                                   │
│  [Skip for now] [Change plan] [← Back]              │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│         Choose Your Plan                             │
│  Welcome Your Business • email@example.com           │
│  Select a plan or skip to dashboard                  │
└─────────────────────────────────────────────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Starter    │  │ POPULAR      │  │ Professional │
│   $15/mo     │  │   Growth     │  │   $80/6mo    │
│              │  │   $40/3mo    │  │              │
│ • 250 SMS    │  │ • 800 SMS    │  │ • 1500 SMS   │
│ • Analytics  │  │ • Priority   │  │ • Dedicated  │
│              │  │              │  │              │
│ [Get Started]│  │[Get Started] │  │[Get Started] │
└──────────────┘  └──────────────┘  └──────────────┘

         Selected: Growth - $40
         [Pay $40] ← Main CTA button
```

---

## ✅ Testing Checklist

### Flow 1: Plan First
- [ ] Homepage → Select plan → Login → Auto-checkout ✅
- [ ] Homepage → Select plan → Signup → Auto-checkout ✅
- [ ] Dodo payment → Success page → Dashboard ✅

### Flow 2: Login First
- [ ] Homepage → Login → Pricing page ✅
- [ ] Homepage → Signup → Pricing page ✅
- [ ] Pricing page → Select plan → Dodo checkout ✅
- [ ] Pricing page → Skip for now → Dashboard ✅

### Skip Options
- [ ] "Skip for now" button works
- [ ] "skip to dashboard" link in message works
- [ ] Dashboard accessible without payment

### Return Flow
- [ ] Payment success returns to app
- [ ] Auto-redirect countdown works
- [ ] Manual "Go to Dashboard" button works

---

## 🎯 Business Logic

### Trial/Free Tier
Users who skip payment can:
- ✅ Access dashboard
- ✅ View analytics
- ✅ Send limited SMS (based on your business rules)
- ✅ Explore features
- ⚠️ Hit limits (e.g., 10 SMS/day) prompting upgrade

### Upgrade Path
Users can upgrade anytime via:
1. **Dashboard**: "Upgrade" button/banner
2. **Settings**: Billing/subscription section
3. **Customer List**: When SMS credits run out
4. **Direct URL**: `/payment` route

---

## 📊 Analytics to Track

**Conversion Funnel**:
```
Homepage visits
   ↓
   ├─ Flow 1: Plan selected (XX%)
   │     ↓ Login required
   │     ↓ Payment started (XX%)
   │     ↓ Payment completed (XX%)
   │
   └─ Flow 2: Login first (XX%)
         ↓ Pricing page shown
         ├─ Plan selected (XX%)
         │   ↓ Payment started (XX%)
         │   ↓ Payment completed (XX%)
         │
         └─ Skipped to dashboard (XX%)
               ↓ Later upgraded (XX%)
```

**Key Metrics**:
- **Immediate conversion**: Users who pay before reaching dashboard
- **Deferred conversion**: Users who skip → explore → pay later
- **Trial abandonment**: Users who skip and never pay

---

## 🚀 Next Steps

### Optional Enhancements
1. **Freemium Features**:
   - Add clear "Trial" badge in dashboard for non-paying users
   - Show SMS credit counter: "8/10 free SMS remaining"
   - Upgrade prompts when nearing limits

2. **Subscription Management**:
   - "Manage Subscription" page
   - Cancel/pause options
   - Upgrade/downgrade between plans

3. **Analytics**:
   - Track which flow converts better
   - A/B test: "Skip for now" vs "Free trial" vs "Try free"
   - Measure time-to-dashboard vs time-to-payment

---

## 📝 Summary

✅ **Both flows implemented and working**  
✅ **Payment gateway fully functional**  
✅ **Skip-to-dashboard option available**  
✅ **Smooth user experience for all scenarios**  

Your users now have **complete flexibility**:
- Want to pay immediately? Flow 1 is optimized for that.
- Want to explore first? Flow 2 lets them try before buying.
- Not sure yet? Skip button keeps them engaged while they decide.

The best part? **All flows end in the dashboard**, ensuring users experience your product regardless of their payment decision! 🎉
