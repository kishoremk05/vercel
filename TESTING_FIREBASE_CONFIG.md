# Testing the Firebase Configuration Integration

## 🧪 Test Plan

### Test 1: Verify Config Loading on Startup

**Expected Result:** Config loads from Firebase on app initialization

1. Open browser console (F12)
2. Start the app: `npm run dev`
3. Look for console log: `✅ Global config loaded from Firebase:`
4. Should show the config object with `smsServerPort`, `feedbackPageUrl`, etc.

**Pass Criteria:**

- ✅ Config loads without errors
- ✅ Console shows Firebase config data
- ✅ No "Failed to fetch" errors

---

### Test 2: Verify Settings Page Display

**Expected Result:** Settings page shows SMS server URL from Firebase

1. Navigate to Settings page
2. Look for: **SMS Server: http://localhost:3002**
3. This value should match what's in Firebase `admin_settings/global`

**Pass Criteria:**

- ✅ SMS Server URL is displayed
- ✅ Shows "Loading..." initially then the actual URL
- ✅ URL matches Firebase config

---

### Test 3: Test Negative Comments API

**Expected Result:** Dashboard uses Firebase config to fetch negative comments

1. Go to Dashboard page
2. Open Network tab in browser DevTools
3. Look for requests to `/api/negative-comments`
4. Verify the request URL starts with `http://localhost:3002`

**Pass Criteria:**

- ✅ API requests use correct base URL
- ✅ No 404 or CORS errors
- ✅ Negative comments load successfully

---

### Test 4: Test Delete Comment

**Expected Result:** Delete uses Firebase config URL

1. Add a negative comment (go to Feedback page and submit)
2. Go back to Dashboard
3. Click delete on a negative comment
4. Watch Network tab for DELETE request
5. Verify URL: `http://localhost:3002/api/negative-comments?id=...`

**Pass Criteria:**

- ✅ DELETE request goes to correct URL
- ✅ Comment is deleted successfully
- ✅ UI updates to remove comment

---

### Test 5: Test Feedback Submission

**Expected Result:** Feedback page uses Firebase config

1. Go to Feedback page: `http://localhost:5173/feedback?clientId=test123`
2. Submit a 1-star rating with comment
3. Check Network tab for POST request
4. Verify URL: `http://localhost:3002/feedback`

**Pass Criteria:**

- ✅ POST request uses correct base URL
- ✅ Feedback submits successfully
- ✅ Returns success response

---

### Test 6: Test Clear All Comments

**Expected Result:** Clear all uses Firebase config for each delete

1. Go to Dashboard with multiple negative comments
2. Click "Clear All" button
3. Confirm the action
4. Watch Network tab for multiple DELETE requests
5. All should go to `http://localhost:3002/api/negative-comments`

**Pass Criteria:**

- ✅ Each DELETE uses correct URL
- ✅ All comments are deleted
- ✅ UI shows empty state

---

### Test 7: Test Config Cache

**Expected Result:** Config is cached and reused

1. Open browser console
2. Type:

```javascript
import { getCachedConfig } from "./lib/firebaseConfig.ts";
getCachedConfig();
```

3. Should return cached config object without making new Firestore call

**Pass Criteria:**

- ✅ Returns config immediately
- ✅ No new Firestore read in Network tab
- ✅ Config matches what was loaded on startup

---

### Test 8: Test Config Refresh

**Expected Result:** Can force refresh of config

1. Update Firebase `admin_settings/global` (change URL to test value)
2. In browser console:

```javascript
import {
  clearConfigCache,
  initializeGlobalConfig,
} from "./lib/firebaseConfig.ts";
clearConfigCache();
await initializeGlobalConfig();
```

3. Check if new config is loaded

**Pass Criteria:**

- ✅ Cache is cleared
- ✅ New Firestore read occurs
- ✅ New config value is returned

---

### Test 9: Test Fallback Chain

**Expected Result:** Falls back gracefully if Firebase config is empty

1. Delete `serverConfig.smsServerPort` from Firebase temporarily
2. Reload app
3. Should fall back to `VITE_API_BASE` or `localStorage.smsServerUrl` or `http://localhost:3002`

**Pass Criteria:**

- ✅ App doesn't crash
- ✅ Uses fallback URL
- ✅ Console shows warning about missing config

---

### Test 10: Production Config Test

**Expected Result:** Works with production URLs

1. Update Firebase `admin_settings/global`:

```javascript
{
  serverConfig: {
    smsServerPort: "https://your-test-api.com";
  }
}
```

2. Clear cache and reload app
3. Check Network tab - all API calls should go to `https://your-test-api.com`

**Pass Criteria:**

- ✅ Config loads from Firebase
- ✅ All API calls use production URL
- ✅ Settings page shows production URL

---

## 🚨 Common Issues & Fixes

### Issue 1: Config Not Loading

**Symptom:** Console shows errors, config is null

**Fix:**

1. Check Firebase connection in `lib/firebaseClient.ts`
2. Verify Firestore rules allow read access
3. Check browser console for detailed error

### Issue 2: Still Using localhost:3002

**Symptom:** Production URL in Firebase but app uses localhost

**Fix:**

```javascript
// Clear cache
import { clearConfigCache } from "./lib/firebaseConfig";
clearConfigCache();
location.reload();
```

### Issue 3: CORS Errors

**Symptom:** API calls fail with CORS error

**Fix:**

1. Check backend CORS configuration
2. Verify backend is running
3. Check URL in Firebase has no trailing slash

### Issue 4: Settings Page Shows "Not configured"

**Symptom:** SMS Server shows "Not configured" instead of URL

**Fix:**

1. Verify `admin_settings/global` exists in Firebase
2. Check field name is `serverConfig.smsServerPort`
3. Reload page

---

## ✅ Complete Test Checklist

Before deploying to production, verify:

- [ ] Config loads on app startup
- [ ] Settings page displays SMS server URL
- [ ] Dashboard fetches negative comments
- [ ] Delete comment works
- [ ] Clear all comments works
- [ ] Feedback submission works (positive)
- [ ] Feedback submission works (negative)
- [ ] Config is cached properly
- [ ] Config can be refreshed
- [ ] Fallback works if Firebase empty
- [ ] Production URL test (update Firebase & verify)
- [ ] No console errors
- [ ] All API calls use correct base URL

---

## 🔍 Debug Commands

### Check Cached Config

```javascript
import { getCachedConfig } from "./lib/firebaseConfig";
console.log("Cached config:", getCachedConfig());
```

### Force Refresh Config

```javascript
import { clearConfigCache, initializeGlobalConfig } from "./lib/firebaseConfig";
clearConfigCache();
await initializeGlobalConfig();
```

### Check SMS Server URL

```javascript
import { getSmsServerUrl } from "./lib/firebaseConfig";
const url = await getSmsServerUrl();
console.log("SMS Server URL:", url);
```

### Test API Call Manually

```javascript
const base = await getSmsServerUrl();
fetch(`${base}/api/negative-comments?companyId=test123`)
  .then((r) => r.json())
  .then(console.log);
```

---

## 📊 Success Metrics

After implementation, you should see:

1. **Faster Config Updates**

   - Before: 5-10 min (code change + build + deploy)
   - After: 0 seconds (just update Firebase)

2. **Fewer Deployments**

   - Config changes no longer require redeployment
   - Only deploy for code changes

3. **Better Debugging**

   - Clear console logs show config loading
   - Easy to verify which URL is being used

4. **Production Ready**
   - Easy to switch between dev/staging/prod
   - Single source of truth in Firebase

---

**Happy Testing! 🎉**

If all tests pass, your Firebase configuration integration is working perfectly! 🚀
