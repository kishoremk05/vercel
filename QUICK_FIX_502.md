# 🚨 QUICK FIX - 502 Error Action Plan

## ⚡ Do This NOW (5 Minutes)

### Step 1: Check Render Server (IMMEDIATE)

```
1. Open: https://dashboard.render.com
2. Find service: "server-cibp" (or your server name)
3. Look at Status Badge:
```

**If Status = "Deploy Failed" or "Build Failed":**

```
→ Click "Manual Deploy" → "Deploy latest commit"
→ Wait 5-10 minutes
→ Skip to Step 4
```

**If Status = "Suspended":**

```
→ Click "Resume Service"
→ Wait 2-3 minutes
→ Skip to Step 4
```

**If Status = "Live":**

```
→ Continue to Step 2
```

---

### Step 2: Check Render Logs

```
1. Click "Logs" tab on your Render service
2. Look for recent errors (last 5 minutes)
```

**Common errors & fixes:**

| Error                 | Fix                                                              |
| --------------------- | ---------------------------------------------------------------- |
| "Port already in use" | Wait 2 mins, auto-restarts                                       |
| "Out of memory"       | Upgrade Render plan OR restart service                           |
| "Module not found"    | Click "Manual Deploy" → "Clear build cache & deploy"             |
| "Firebase" errors     | Check FIREBASE_ADMIN_JSON environment variable                   |
| No recent logs        | Service might be sleeping (free tier) - click a route to wake it |

---

### Step 3: Wake Up the Server (If Free Tier)

```
Open in new tab: https://server-cibp.onrender.com/health
```

**Expected:**

- ✅ Shows JSON response = Server is awake
- ❌ Shows "This site can't be reached" = Server is down (go back to Step 1)
- ⏳ Takes 30+ seconds to respond = Server was sleeping (wait for it)

---

### Step 4: Set Environment Variable

```
1. On Render Dashboard → Your Service → "Environment" tab
2. Add or update this variable:

   Key: CORS_ORIGINS
   Value: https://vercel-swart-chi-29.vercel.app,http://localhost:5173

3. Click "Save Changes"
4. Service will auto-redeploy (wait 5-10 mins)
```

---

### Step 5: Test Your App

```
1. Go to: https://vercel-swart-chi-29.vercel.app/profile
2. Open Browser Console (F12)
3. Refresh page
4. Check for CORS errors
```

**If still getting errors:**

- Wait another 2-3 minutes (Render might still be deploying)
- Check Render dashboard shows "Live" status
- Try clearing browser cache (Ctrl+Shift+R)

---

## 🔥 Emergency Quick Restart

If nothing above works:

```
1. Render Dashboard → Your Service → "Manual Deploy"
2. Click "Clear build cache & deploy"
3. Wait 10 minutes
4. Test again
```

---

## ✅ Success Indicators

You'll know it's fixed when:

- ✅ `https://server-cibp.onrender.com/health` returns JSON
- ✅ No CORS errors in browser console
- ✅ Profile page loads without errors
- ✅ Payment data displays correctly

---

## 📞 If Still Broken After 30 Minutes

**Most likely causes:**

1. **Render Free Tier Limitations**

   - Solution: Upgrade to Starter ($7/month) - No sleeping, better reliability

2. **Firebase Credentials Missing**

   - Solution: Add `FIREBASE_ADMIN_JSON` environment variable
   - Get it from: Firebase Console → Project Settings → Service Accounts

3. **Render Build Failed**

   - Solution: Check logs for specific error
   - Usually missing dependencies or syntax errors

4. **Code Not Deployed**
   - Solution: Trigger manual deploy on Render
   - Or check GitHub webhook connection

---

## 🎯 What Changed

### Files Updated:

- `sms-server.js` - Added `https://*.vercel.app` to CORS whitelist
- `CORS_502_TROUBLESHOOTING.md` - Full troubleshooting guide (for reference)

### What This Fixes:

- ✅ CORS errors for all Vercel subdomains
- ✅ Better wildcard matching
- ✅ More reliable cross-origin requests

### What You Still Need To Do:

1. ✅ Ensure Render server is running
2. ✅ Set CORS_ORIGINS environment variable
3. ✅ Wait for Render auto-deploy to complete

---

**Time to Fix**: 5-15 minutes  
**Status**: Action Required  
**Priority**: HIGH - Do this now! 🔥

---

## 🔗 Quick Links

- Render Dashboard: https://dashboard.render.com
- Your Vercel App: https://vercel-swart-chi-29.vercel.app
- Server Health: https://server-cibp.onrender.com/health
- Full Guide: See `CORS_502_TROUBLESHOOTING.md`
