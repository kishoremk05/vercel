# 🎯 30-Second Quick Test

## Step-by-Step Visual Guide

### ✅ Step 1: Check Servers (5 seconds)

Look at your terminals:

**Terminal 1 (Backend):**

```
✅ SMS API listening on http://localhost:3002
✅ [firebaseAdmin] Loaded service account for project: business-saas-70900
✅ [db] Firestore data layer enabled
```

**Terminal 2 (Frontend):**

```
✅ VITE v6.3.6 ready
✅ Local: http://localhost:5173/
```

**Both showing these messages?** → Continue ✅
**Any errors?** → Restart servers ⚠️

---

### ✅ Step 2: Open Browser (5 seconds)

1. Open Chrome/Firefox/Edge
2. Go to: `http://localhost:5173`
3. Press **F12** (open Developer Tools)
4. Go to **Console** tab

**Page loads?** → Continue ✅
**Blank page or error?** → Check console for red errors ⚠️

---

### ✅ Step 3: Login (10 seconds)

1. Click **"Login"** or **"Sign Up"** button
2. Click **"Sign up with Google"** (white button with logo)
3. Google popup appears
4. Choose your account
5. Wait for redirect

**Expected:**

```
Current URL changes to: http://localhost:5173/dashboard
```

**Console shows:**

```
(No red errors)
```

**Redirected to dashboard?** → Continue ✅
**Still on login page?** → Check troubleshooting ⚠️

---

### ✅ Step 4: Verify Dashboard (10 seconds)

**Look for 4 cards at top:**

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Messages    │ │ Feedback    │ │ Average     │ │ Response    │
│ Sent: 0     │ │ Received: 0 │ │ Rating: 0.0 │ │ Rate: 0.0%  │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

**✅ Cards visible with numbers**
**✅ No red error boxes**
**✅ Sentiment chart shows "No feedback data available yet"**

---

### ✅ Step 5: Check Console (5 seconds)

In Console tab (F12):

**Look for:**

- ❌ **No red error messages**
- ✅ **Green/blue info logs are OK**

**Type this command:**

```javascript
localStorage.getItem("companyId");
```

**Should return:** A string like `"comp_abc123..."` ✅

---

## 🎉 SUCCESS!

**If all 5 steps passed:** Everything works perfectly! ✅

---

## 🔴 FAILED? Quick Fixes

### Problem: Login doesn't redirect to dashboard

**Fix:**

```javascript
// In Console (F12):
localStorage.clear();
// Refresh page (F5)
// Login again
```

### Problem: Cards show "No company ID found"

**Fix:**

```javascript
// In Console:
localStorage.clear();
// Refresh and login again
```

### Problem: Backend not running

**Fix in PowerShell:**

```powershell
# Stop the running server (Ctrl+C)
# Restart:
node sms-server.js
```

### Problem: Frontend not loading

**Fix in PowerShell:**

```powershell
# Stop (Ctrl+C)
# Restart:
npm run dev
```

---

## 📊 See Dashboard with Real Data

Want to see numbers instead of zeros? Add sample data:

### Quick Firebase Test:

1. **Go to:** https://console.firebase.google.com/project/business-saas-70900/firestore

2. **Click:** `feedback` collection → **Add document**

3. **Copy your companyId:**

   - In browser console: `localStorage.getItem('companyId')`
   - Copy the result (without quotes)

4. **Add this document:**

   ```
   feedbackId: "test-1"
   companyId: "PASTE_YOUR_COMPANY_ID_HERE"
   customerName: "John Test"
   customerPhone: "+15551234567"
   rating: 5
   comment: "Excellent service!"
   sentiment: "POSITIVE"
   source: "SMS"
   isAnonymous: false
   createdAt: (select timestamp → pick current date/time)
   ```

5. **Click Save**

6. **Add to messages collection:**

   ```
   messageId: "msg-1"
   companyId: "PASTE_YOUR_COMPANY_ID_HERE"
   messageType: "SMS"
   content: "Please rate us"
   status: "sent"
   sentAt: (timestamp → current date/time)
   ```

7. **Refresh Dashboard (F5)**

**Now you'll see:**

- Messages Sent: **1** ✅
- Feedback Received: **1** ✅
- Average Rating: **5.0** ✅
- Response Rate: **100%** ✅
- Sentiment Chart: **Green slice (100% Positive)** ✅

---

## 🎬 Video-Style Testing (Follow Along)

### Minute 0:00 - Start

- [ ] Open `http://localhost:5173`

### Minute 0:05 - Login

- [ ] Click "Sign up with Google"
- [ ] Choose account
- [ ] Wait for redirect

### Minute 0:15 - Dashboard Loaded

- [ ] See 4 cards with numbers
- [ ] No errors visible
- [ ] Charts displayed

### Minute 0:20 - Check Console

- [ ] Press F12
- [ ] Go to Console tab
- [ ] No red errors

### Minute 0:25 - Check LocalStorage

- [ ] Type: `localStorage.getItem('companyId')`
- [ ] See company ID returned

### Minute 0:30 - DONE! ✅

**Total time: 30 seconds**

---

## 📸 Screenshots Expected

### Login Page:

```
┌─────────────────────────────────┐
│  Create your account            │
│                                 │
│  [Sign up with Google]  ← Click │
│  ─── or ───                     │
│  [Email input]                  │
│  [Password input]               │
└─────────────────────────────────┘
```

### Dashboard After Login:

```
┌──────────────────────────────────────────────────┐
│ Reputation overview                              │
└──────────────────────────────────────────────────┘

┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
│ 📧 0  │ │ ✅ 0  │ │ ⭐ 0  │ │ 📈 0% │
└───────┘ └───────┘ └───────┘ └───────┘

┌──────────────┐  ┌──────────────┐
│ Analytics    │  │ Sentiment    │
│ (Charts)     │  │ No data yet  │
└──────────────┘  └──────────────┘
```

### Console (F12):

```
Console ▼
  (no errors)

> localStorage.getItem('companyId')
< "comp_abc123xyz789..."
```

---

## ✅ Final Verification Checklist

Copy and paste into a text file, check each box:

```
Phase 2 Testing Checklist:

□ Backend server running on port 3002
□ Frontend server running on port 5173
□ Can access http://localhost:5173
□ Login page displays correctly
□ Google login button works
□ Google popup appears
□ Can select Google account
□ Redirects to /dashboard after login
□ Dashboard shows 4 metric cards
□ Cards display numbers (not errors)
□ Sentiment chart visible
□ No red error boxes
□ Console (F12) has no red errors
□ Network tab shows successful API call
□ localStorage has companyId
□ localStorage has user object
□ localStorage has token
□ Firebase users collection has my user
□ Firebase companies collection has my company
□ User and company are linked via companyId
```

**All checked?** Phase 2 works perfectly! 🎉

---

## 🆘 Still Having Issues?

**Check these files for detailed help:**

1. `.azure/TESTING_CHECKLIST.md` (full guide)
2. `.azure/QUICK_TEST_GUIDE.md` (quick reference)
3. `.azure/DASHBOARD_UPDATE_COMPLETE.md` (technical details)

**Common solutions:**

- Restart both servers
- Clear browser cache and localStorage
- Check Firebase Console for data
- Verify .env file exists with correct paths

**Everything working?** Ready for Phase 3! 🚀
