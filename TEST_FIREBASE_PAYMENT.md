# Testing Firebase Payment Integration

## 🧪 Quick Test Guide

Follow these steps to verify that the payment data is correctly saved and displayed from Firebase.

---

## Step 1: Complete a Test Payment

1. **Login to your app** with a test account (e.g., `kishore.m12th@gmail.com`)
2. **Navigate to Payment page** and select a plan (e.g., Growth Plan - $75)
3. **Complete the payment** (use Dodo test mode)
4. **Wait for redirect** to Payment Success page
5. **Check browser console** for success logs:
   ```
   ✅✅✅ Subscription saved to Firebase profile/main successfully!
   ✅ localStorage snapshot saved
   ```

---

## Step 2: Verify Firebase Storage

1. **Open Firebase Console**: https://console.firebase.google.com
2. **Navigate to**: Firestore Database
3. **Go to path**: `clients/{your-clientId}/profile/main`
4. **Verify these fields exist:**
   - ✅ `planId` (e.g., "growth_3m")
   - ✅ `planName` (e.g., "Growth Plan")
   - ✅ `smsCredits` (e.g., 900)
   - ✅ `price` (e.g., 75)
   - ✅ `status` (e.g., "active")
   - ✅ `activatedAt` (Timestamp)
   - ✅ `expiryAt` (Timestamp)
   - ✅ `userId` (Firebase UID)
   - ✅ `userEmail` (User email)

---

## Step 3: Check Profile Page Display

1. **Navigate to Profile page** (`/profile`)
2. **Verify Payment Details section shows:**
   - ✅ Current Plan name (e.g., "Growth Plan")
   - ✅ Price (e.g., "$75")
   - ✅ Status badge (e.g., "Active" in green)
   - ✅ Start Date (formatted date)
   - ✅ Expiry Date (formatted date)
   - ✅ SMS Credits usage bar (e.g., "7 / 900")

---

## Step 4: Cross-Browser Test

1. **Open the app in Chrome**

   - Login with same account
   - Go to Profile page
   - ✅ Verify payment details are visible

2. **Open the app in Edge/Firefox**

   - Login with same account
   - Go to Profile page
   - ✅ Verify payment details are visible

3. **Clear localStorage** (F12 > Application > Local Storage > Clear)
   - Refresh the page
   - ✅ Payment details should still appear (loaded from Firebase)

---

## Step 5: Console Logs to Look For

### ✅ Success Logs (Payment Success Page)

```javascript
[PaymentSuccess] Attempting to save to Firebase...
[PaymentSuccess] Saving to path: clients/{clientId}/profile/main
[PaymentSuccess] Data to save: {...}
✅✅✅ Subscription saved to Firebase profile/main successfully!
✅ localStorage snapshot saved
```

### ✅ Success Logs (Profile Page)

```javascript
✅ Loaded business profile from Firebase: {...}
Got message count from Firebase: 7
```

### ❌ Error Logs to Watch For

```javascript
❌❌❌ CRITICAL: Failed to save subscription to Firebase: ...
❌ Firebase fetch error: ...
```

---

## Expected Results

| Test Case                    | Expected Result                                  |
| ---------------------------- | ------------------------------------------------ |
| Payment completed            | ✅ Success page shows, data saved to Firebase    |
| Profile page in Chrome       | ✅ Payment details visible                       |
| Profile page in Edge         | ✅ Payment details visible                       |
| Clear localStorage + refresh | ✅ Payment details still visible (from Firebase) |
| Login from mobile            | ✅ Payment details visible                       |
| Firestore document           | ✅ Contains all payment fields                   |

---

## Troubleshooting

### Issue: "No subscription data available"

**Check:**

1. Browser console for Firebase errors
2. Firebase Console > Firestore > `clients/{clientId}/profile/main`
3. Network tab for failed API requests
4. localStorage for `companyId` value

**Common Solutions:**

- Hard refresh (Ctrl+Shift+R)
- Clear cache and reload
- Check Firestore security rules
- Verify user is authenticated

---

### Issue: Data shows in Chrome but not Edge

**Cause:**

- This should NOT happen anymore (data is in Firebase, not localStorage)

**If it happens:**

1. Check if user is logged in with same account in Edge
2. Verify `companyId` matches in both browsers
3. Check browser console for errors
4. Clear Edge cache and cookies

---

## Developer Debug Commands

Open browser console and run these commands to debug:

```javascript
// Check if payment was saved to Firebase
const db = firebase.firestore();
const clientId = localStorage.getItem("companyId");
db.collection("clients")
  .doc(clientId)
  .collection("profile")
  .doc("main")
  .get()
  .then((doc) => console.log("Firebase Profile Data:", doc.data()));

// Check localStorage snapshot (fallback)
console.log(
  "LocalStorage Snapshot:",
  JSON.parse(localStorage.getItem("subscriptionSnapshot") || "{}")
);

// Check if user is authenticated
console.log("User authenticated:", !!firebase.auth().currentUser);
console.log("User UID:", firebase.auth().currentUser?.uid);
```

---

## Success Criteria ✅

All tests pass when:

- ✅ Payment completes successfully
- ✅ Data saved to `clients/{clientId}/profile/main` in Firestore
- ✅ Profile page displays all payment details
- ✅ Works in multiple browsers (Chrome, Edge, Firefox)
- ✅ Works after clearing localStorage
- ✅ Works on different devices with same account

---

**Date:** October 19, 2025  
**Status:** Ready for Testing  
**Next:** Run through all test steps and verify ✅
