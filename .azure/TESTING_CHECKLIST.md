# 🧪 Complete Testing Checklist - Dashboard Updates

## Quick Test (5 minutes) ⚡

### Step 1: Verify Servers Are Running ✅

**Check Frontend:**

```powershell
# Should see: "VITE ready" and "http://localhost:5173"
```

Look at the terminal running `npm run dev`

**Check Backend:**

```powershell
# Should see: "SMS API listening on http://localhost:3002"
```

Look at the terminal running `node sms-server.js`

---

### Step 2: Test Google Login 🔐

1. **Open browser** → `http://localhost:5173`

2. **Click "Login" or "Sign Up"**

3. **Click "Sign up with Google"** (the white button with Google logo)

4. **Choose your Google account** in the popup

5. **Check what happens:**
   - ✅ **SUCCESS**: Redirects to `/dashboard`
   - ❌ **FAIL**: Shows error or stays on login page

**If Success:** Continue to Step 3
**If Fail:** Check the troubleshooting section below

---

### Step 3: Verify Dashboard Data 📊

**What you should see:**

#### Top Section - 4 Metric Cards:

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ 📧          │ │ ✅          │ │ ⭐          │ │ 📈          │
│ Messages    │ │ Feedback    │ │ Average     │ │ Response    │
│ Sent        │ │ Received    │ │ Rating      │ │ Rate        │
│             │ │             │ │             │ │             │
│     0       │ │     0       │ │    0.0      │ │    0.0%     │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

✅ **Cards display with blue/green/yellow/purple colors**
✅ **Numbers show (likely all zeros for new account)**
✅ **No loading spinners** (they should disappear)
✅ **No red error boxes**

#### Charts Section:

```
┌──────────────────────┐  ┌──────────────────────┐
│ Analytics Charts     │  │ Sentiment Analysis   │
│ (Line/Bar graphs)    │  │                      │
│                      │  │ "No feedback data    │
│                      │  │  available yet"      │
└──────────────────────┘  └──────────────────────┘
```

✅ **Sentiment chart shows** "No feedback data available yet" message
✅ **Charts render without errors**

---

### Step 4: Check Browser Console (F12) 🔍

**Press F12** to open Developer Tools

**Go to Console tab**

**Look for:**

- ✅ **NO red error messages**
- ✅ **May see info logs** (green/blue) - this is fine
- ✅ **Token verified** messages - this is good

**Check Network tab:**

1. **Refresh the dashboard** (Ctrl+R)
2. **Filter by "stats"**
3. **Look for:** `stats?companyId=...`
4. **Status should be:** `200 OK` (green)
5. **Preview response:**

```json
{
  "success": true,
  "stats": {
    "messageCount": 0,
    "feedbackCount": 0,
    "avgRating": 0,
    "sentimentCounts": {
      "POSITIVE": 0,
      "NEUTRAL": 0,
      "NEGATIVE": 0
    }
  }
}
```

---

### Step 5: Verify LocalStorage Data 💾

**In Console tab, type:**

```javascript
localStorage.getItem("companyId");
```

**Should return:** A string like `"comp_xyz123..."` ✅

```javascript
localStorage.getItem("user");
```

**Should return:** JSON string with your user data ✅

```javascript
localStorage.getItem("token");
```

**Should return:** A long JWT token string ✅

```javascript
JSON.parse(localStorage.getItem("user"));
```

**Should show:**

```json
{
  "uid": "firebase-user-id",
  "email": "your-email@gmail.com",
  "name": "Your Name",
  "role": "ADMIN",
  "companyId": "comp_xyz123..."
}
```

---

### Step 6: Check Firebase Database 🔥

1. **Go to Firebase Console:**

   - URL: https://console.firebase.google.com/project/business-saas-70900/firestore

2. **Click "Firestore Database"** in left menu

3. **Check Collections:**

#### `users` collection:

- ✅ Should have **1 document** (your user)
- Click to expand, verify:
  - `uid`: Your Firebase user ID
  - `email`: Your Google email
  - `name`: Your display name
  - `role`: "ADMIN"
  - `companyId`: Company ID reference
  - `createdAt`: Timestamp
  - `lastLogin`: Recent timestamp

#### `companies` collection:

- ✅ Should have **1 document** (your company)
- Click to expand, verify:
  - `companyId`: Unique ID
  - `companyName`: Your name or email prefix
  - `adminId`: Matches your user's uid
  - `email`: Your email
  - `status`: "ACTIVE"
  - `createdAt`: Timestamp
  - Credential fields (empty for now) ✅

#### `feedback` collection:

- ✅ **Empty** (this is expected for new account)

#### `messages` collection:

- ✅ **Empty** (this is expected for new account)

---

## Advanced Testing 🔬

### Test 7: Manual API Test with cURL

**Get your companyId:**

```javascript
// In browser console:
const companyId = localStorage.getItem("companyId");
console.log(companyId);
```

**Test the API directly:**

```powershell
# Replace YOUR_COMPANY_ID with actual ID from above
curl "http://localhost:3002/api/dashboard/stats?companyId=YOUR_COMPANY_ID"
```

**Expected response:**

```json
{
  "success": true,
  "stats": {
    "messageCount": 0,
    "feedbackCount": 0,
    "avgRating": 0,
    "sentimentCounts": {
      "POSITIVE": 0,
      "NEUTRAL": 0,
      "NEGATIVE": 0
    }
  }
}
```

---

### Test 8: Add Sample Data to See Dashboard with Numbers

**Option 1: Via Firebase Console (Easy)**

1. Go to Firestore → `feedback` collection
2. Click **"Add document"**
3. Use these values:

**Document ID:** (auto-generate)

**Fields:**

```
feedbackId: "test-fb-1" (string)
companyId: "YOUR_COMPANY_ID_HERE" (string) - IMPORTANT!
userId: null
customerName: "John Test" (string)
customerPhone: "+15551234567" (string)
rating: 5 (number)
comment: "Great service, very professional!" (string)
sentiment: "POSITIVE" (string)
source: "SMS" (string)
isAnonymous: false (boolean)
createdAt: (Click "timestamp" → select current date/time)
```

4. Click **"Save"**

5. **Add another document for messages:**

Go to `messages` collection → Click **"Add document"**

**Fields:**

```
messageId: "test-msg-1" (string)
companyId: "YOUR_COMPANY_ID_HERE" (string) - MUST MATCH!
customerId: "cust-001" (string)
messageType: "SMS" (string)
content: "Thank you for your business! Please rate us." (string)
status: "sent" (string)
sentAt: (Click "timestamp" → select current date/time)
```

6. **Refresh Dashboard** (F5)

**Now you should see:**

- Messages Sent: **1** ✅
- Feedback Received: **1** ✅
- Average Rating: **5.0** ✅
- Response Rate: **100%** ✅
- Sentiment Chart: **Green slice showing 100% Positive** ✅

---

### Test 9: Add Negative Feedback to Test Sentiment Chart

**Add another feedback document:**

```
feedbackId: "test-fb-2" (string)
companyId: "YOUR_COMPANY_ID_HERE" (string)
customerName: "Jane Unhappy" (string)
customerPhone: "+15559876543" (string)
rating: 2 (number)
comment: "Service was slow and confusing." (string)
sentiment: "NEGATIVE" (string)
source: "SMS" (string)
isAnonymous: false (boolean)
createdAt: (current timestamp)
```

**Refresh Dashboard:**

**Now you should see:**

- Feedback Received: **2** ✅
- Average Rating: **3.5** ✅ (average of 5 and 2)
- Sentiment Chart: **2 slices** ✅
  - 50% Positive (green)
  - 50% Negative (red)

---

## Troubleshooting Guide 🔧

### Issue 1: "No company ID found" Error

**Symptoms:**

- Red error box on dashboard
- Says "No company ID found. Please log in again."

**Fix:**

```javascript
// In browser console:
localStorage.clear();
// Then refresh and login again
```

---

### Issue 2: Dashboard Shows Loading Forever

**Symptoms:**

- Skeleton loaders don't disappear
- Cards never show numbers

**Check:**

1. **Is backend running?**

   - Look for "SMS API listening on http://localhost:3002" in terminal

2. **Check Network tab (F12):**

   - Look for failed request to `/api/dashboard/stats`
   - If 404: Backend not running
   - If 500: Check backend logs

3. **Backend logs:**

```powershell
# Look at the terminal running node sms-server.js
# Should NOT see errors like:
# - "Database not configured"
# - "Firestore error"
```

---

### Issue 3: Login Fails / Redirects Back to Login

**Symptoms:**

- Click Google login
- Choose account
- Returns to login page (not dashboard)

**Debug:**

1. **Check browser console for errors**
2. **Check backend logs:**

```
Should see:
[auth:google] Verifying token for project: business-saas-70900
[auth:google] Token verified successfully for user: your@email.com
```

3. **If you see "Invalid Google token":**
   - Firestore might not be enabled
   - Check Firebase Console → Firestore Database

---

### Issue 4: Sentiment Chart Not Showing

**Symptoms:**

- Charts section is blank or shows error

**Check:**

1. **Browser console** (F12) for React errors
2. **Recharts library loaded:**

```javascript
// In console:
typeof window.recharts;
// Should NOT be undefined
```

3. **Component rendered:**
   - Inspect element (right-click chart area)
   - Should see `<div class="bg-white border...">` with chart inside

---

### Issue 5: Numbers Are Zero But Data Exists

**Symptoms:**

- Added data to Firestore
- Dashboard still shows 0

**Debug:**

1. **Check companyId matches:**

```javascript
// In console:
const myCompanyId = localStorage.getItem("companyId");
console.log("My company:", myCompanyId);
```

2. **In Firestore:**

   - Open your feedback/message document
   - Check `companyId` field matches exactly
   - No extra spaces or typos

3. **Refresh data:**

```javascript
// Hard refresh
location.reload(true);
```

---

### Issue 6: Backend Errors in Terminal

**Common errors:**

**"Cannot read property 'getFeedbackStats' of null"**

- dbV2 not initialized
- Restart backend: `node sms-server.js`

**"Firestore database not created"**

- Go to Firebase Console
- Create Firestore database
- Choose test mode
- Select region

**"Service account not found"**

- Check `.env` file exists
- Verify `FIREBASE_SERVICE_ACCOUNT` path is correct
- Use absolute path, not relative

---

## Expected Results Summary ✅

### ✅ Successful Test Results:

1. **Login Works:**

   - Google popup appears
   - Redirects to dashboard
   - No errors in console

2. **Dashboard Displays:**

   - 4 metric cards visible
   - Numbers show (zeros or actual data)
   - No red error boxes
   - Sentiment chart visible

3. **Browser Console:**

   - No red errors
   - Network request to `/api/dashboard/stats` succeeds (200)
   - LocalStorage has: token, user, companyId

4. **Backend Logs:**

   - "Token verified successfully"
   - No error messages
   - API requests logged

5. **Firebase Database:**
   - `users` collection: 1 document
   - `companies` collection: 1 document
   - User and company linked via `companyId`

---

## Performance Checklist ⚡

- [ ] Dashboard loads in < 2 seconds
- [ ] API responds in < 500ms
- [ ] No layout shift during load
- [ ] Smooth transitions between states
- [ ] Responsive on mobile (test by resizing browser)
- [ ] Charts render properly at all sizes

---

## Security Checklist 🔒

- [ ] JWT token stored in localStorage
- [ ] API requires companyId parameter
- [ ] Cannot access other company's data
- [ ] Firebase authentication working
- [ ] Token verification on backend

---

## Browser Compatibility ✅

Test in:

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Edge (latest)
- [ ] Safari (if on Mac)

---

## Mobile Testing 📱

**Desktop Browser:**

1. Press **F12**
2. Click **device toolbar** icon (phone/tablet icon)
3. Select **iPhone 12 Pro** or **Pixel 5**
4. Test:
   - [ ] Cards stack vertically
   - [ ] Text is readable
   - [ ] Buttons are tappable
   - [ ] Charts resize properly

---

## Final Checklist ✨

Before moving to Phase 3:

- [ ] Can login with Google successfully
- [ ] Dashboard shows 4 metric cards
- [ ] Cards display numbers (not errors)
- [ ] Sentiment chart renders
- [ ] No console errors
- [ ] API endpoint returns data
- [ ] User created in Firestore
- [ ] Company created in Firestore
- [ ] LocalStorage has required data
- [ ] Backend logs show success

**If ALL checked:** ✅ **Phase 2 is working perfectly!**

**If ANY unchecked:** See troubleshooting guide above

---

## Quick Smoke Test (30 seconds) 🚀

**Absolute minimum test:**

1. Open `http://localhost:5173`
2. Login with Google
3. See dashboard with 4 cards showing numbers
4. No red error boxes
5. Check console (F12) - no red errors

**If all 5 pass:** Everything works! 🎉

---

## Need Help? 🆘

**Check these files:**

- `.azure/QUICK_TEST_GUIDE.md` - Quick start
- `.azure/DASHBOARD_UPDATE_COMPLETE.md` - Full documentation
- `.azure/PHASE2_SUMMARY.md` - Technical details

**Common Solutions:**

- Restart backend server
- Clear localStorage and login again
- Hard refresh browser (Ctrl+Shift+R)
- Check Firebase Console for data
- Verify `.env` file exists

---

**Happy Testing! 🧪✨**
