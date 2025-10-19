# Test Payment Success Flow

## How to Test Firebase Subscription Save

### Step 1: Make sure you're logged in

- Go to your app and login with: kishore.m12th@gmail.com
- Verify you see your dashboard

### Step 2: Manually trigger payment success

Navigate to this URL in your browser:

```
http://localhost:5173/payment-success?plan=pro_6m
```

Or for your production URL:

```
https://your-app.com/payment-success?plan=pro_6m
```

### Step 3: Check browser console

Open DevTools (F12) and look for these log messages:

**✅ SUCCESS indicators:**

- `[PaymentSuccess] Auth state: { authenticated: true, uid: '...', email: '...' }`
- `[PaymentSuccess] Client document exists: {...}`
- `✅ Client auth_uid updated` (if needed)
- `[PaymentSuccess] Saving to path: clients/0Vpcxn8exw7SnGswaf4N/subscription/active`
- `✅✅✅ Subscription saved to Firebase successfully!`
- `✅ localStorage snapshot saved`

**❌ ERROR indicators:**

- `❌ User not authenticated` - You need to login first
- `❌ Missing plan or companyId` - Check localStorage has companyId
- `❌❌❌ CRITICAL: Failed to save subscription to Firebase:` - Check the error details below this

### Step 4: Verify in Firebase Console

1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project
3. Go to Firestore Database
4. Navigate to: `clients/{your-companyId}/subscription/active`
5. You should see a document with:
   - planId: "pro_6m"
   - planName: "Professional"
   - smsCredits: 900
   - remainingCredits: 900
   - status: "active"
   - userId: (your auth uid)
   - userEmail: kishore.m12th@gmail.com

### Step 5: Test Cross-Device Sync

1. Open Chrome browser
2. Login with the same account
3. Go to Profile page
4. You should now see the subscription data
5. Check console for: `✅ Subscription loaded from Firebase: {...}`

## Troubleshooting

### Error: "User not authenticated"

**Solution:** Make sure you're logged in before navigating to payment-success page

### Error: "Missing or insufficient permissions"

**Solution:** The client document needs auth_uid field. The new code automatically sets this.

### Error: "Missing plan or companyId"

**Solution:**

- Check localStorage: `localStorage.getItem("companyId")`
- If missing, login again
- Or set it manually: `localStorage.setItem("companyId", "0Vpcxn8exw7SnGswaf4N")`

### Subscription still not showing in Chrome

**Possible causes:**

1. Firebase save failed (check console logs)
2. Auth UID mismatch (check client document has auth_uid field)
3. Firestore rules blocking read (check rules for subscription subcollection)

**Debug steps:**

1. Open Chrome DevTools console
2. Run: `localStorage.getItem("companyId")` - note the ID
3. Run: `firebase.auth().currentUser.uid` - note the UID
4. Check Firebase console: clients/{companyId} document should have auth_uid matching the UID
