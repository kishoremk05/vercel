# 🚨 CORS & 502 Error - Complete Troubleshooting Guide

## 🔍 Error Summary

### Errors You're Seeing:
```
1. Access to fetch at 'https://server-cibp.onrender.com/...' has been blocked by CORS policy: 
   No 'Access-Control-Allow-Origin' header is present

2. GET https://server-cibp.onrender.com/... net::ERR_FAILED 502 (Bad Gateway)
```

### Root Cause:
The **502 Bad Gateway** is the primary issue. The CORS error is a symptom because:
- Your Render server is not responding (crashed, suspended, or timeout)
- When server doesn't respond, no CORS headers are sent
- Browser blocks the request due to missing headers

---

## 🛠️ Immediate Solutions

### Solution 1: Check & Restart Render Server

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Find your service**: `server-cibp`
3. **Check the status**:

#### If Status is "Deploy Failed" or "Build Failed":
```
1. Click "Manual Deploy" → "Deploy latest commit"
2. Wait for build to complete (5-10 minutes)
3. Check logs for errors
```

#### If Status is "Suspended":
```
1. Click "Resume Service"
2. Wait for it to start (2-3 minutes)
3. Test your API endpoints
```

#### If Status is "Live" but still getting 502:
```
1. Click "Manual Deploy" → "Clear build cache & deploy"
2. Or click "Suspend" then "Resume"
3. Check Recent Logs for errors
```

---

### Solution 2: Verify Render Environment Variables

**Go to**: Render Dashboard → Your Service → Environment

**Required Variables:**
```env
# CORS Origins (CRITICAL)
CORS_ORIGINS=https://vercel-swart-chi-29.vercel.app,http://localhost:5173

# Port (usually auto-set by Render)
PORT=10000

# Firebase Admin (if using Firestore)
FIREBASE_ADMIN_JSON={"type":"service_account",...}

# Twilio (if using SMS)
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890

# Dodo Payments (if using payments)
DODO_API_KEY=your_dodo_key
```

**After adding/updating:**
1. Click "Save Changes"
2. Service will auto-redeploy
3. Wait 5-10 minutes for deployment

---

### Solution 3: Check Render Logs

**Go to**: Render Dashboard → Your Service → Logs

**Look for these common errors:**

#### Error: "Port already in use"
```
Solution: Render will auto-restart. Wait 2-3 minutes.
```

#### Error: "Out of memory" or "Killed"
```
Solution: Upgrade to a higher Render plan (Starter or higher)
Or optimize your code to use less memory
```

#### Error: "Module not found" or "Cannot find module"
```
Solution: Check package.json dependencies
Run: npm install
Commit and push changes
Redeploy on Render
```

#### Error: "Firebase admin SDK" or "Firestore" errors
```
Solution: 
1. Verify FIREBASE_ADMIN_JSON is set correctly
2. Check Firebase project permissions
3. Ensure service account has proper roles
```

#### Error: "ECONNREFUSED" or "ETIMEDOUT"
```
Solution: Network/external service issue
Wait a few minutes and try again
Check if Firebase/Twilio services are online
```

---

### Solution 4: Test Render Server Directly

**Open a new browser tab and try:**
```
https://server-cibp.onrender.com/health
```

**Expected Results:**

✅ **If you see a response (any JSON/text)**:
- Server is running!
- CORS might be the only issue
- Continue to Solution 5

❌ **If you get "This site can't be reached" or 502**:
- Server is definitely down
- Go back to Solution 1 (restart server)
- Check logs for errors

---

### Solution 5: Update CORS Origins (Code Fix)

The code has been updated to allow your Vercel domain. Now deploy the changes:

```powershell
# Commit the changes
git add sms-server.js
git commit -m "Fix CORS: Allow Vercel domain"
git push origin main
```

**Then on Render:**
1. Go to your service dashboard
2. It should auto-deploy from GitHub
3. Wait for deployment to complete
4. Test your app again

---

## 🧪 Testing After Fix

### Test 1: Server Health Check
```
Open: https://server-cibp.onrender.com/health
Expected: {"status":"ok"} or similar response
```

### Test 2: CORS Check (Browser Console)
```javascript
fetch('https://server-cibp.onrender.com/api/subscription?companyId=test')
  .then(res => res.json())
  .then(data => console.log('✅ CORS working:', data))
  .catch(err => console.error('❌ Still blocked:', err));
```

### Test 3: Profile Page Load
```
1. Login to your app
2. Go to Profile page
3. Open browser console (F12)
4. Check for errors
5. Verify payment details load
```

---

## 🔧 Advanced Troubleshooting

### Issue: Render Free Tier Sleeping

**Problem**: Render free tier services sleep after 15 minutes of inactivity

**Solutions:**
1. **Upgrade to Starter plan** ($7/month) - No sleeping
2. **Use a ping service** to keep it awake:
   - UptimeRobot (free): https://uptimerobot.com
   - Set up HTTP monitor to ping your server every 5 minutes

### Issue: Build Timeout on Render

**Problem**: Build takes too long and times out

**Solutions:**
```
1. Go to Render Dashboard → Settings
2. Increase "Build Timeout" to 20 minutes
3. Or optimize your build:
   - Remove unused dependencies
   - Use --production flag
   - Reduce bundle size
```

### Issue: Memory Exceeded

**Problem**: Server crashes with "Out of Memory"

**Solutions:**
```
1. Upgrade Render plan (more RAM)
2. Or optimize code:
   - Avoid loading large files into memory
   - Use streaming for large responses
   - Clean up unused variables
   - Use pagination for large queries
```

---

## 📋 Quick Checklist

Before asking for help, verify:

- [ ] Render service is "Live" (not suspended/failed)
- [ ] Render logs show no recent errors
- [ ] CORS_ORIGINS includes your Vercel domain
- [ ] Environment variables are set correctly
- [ ] Can access `https://server-cibp.onrender.com/health` in browser
- [ ] Latest code is pushed to GitHub
- [ ] Render has auto-deployed latest commit
- [ ] Firebase/Twilio credentials are valid
- [ ] No "Out of Memory" errors in logs

---

## 🚀 Prevention Tips

### 1. Add Health Check Endpoint
Already in your code (check logs to confirm):
```javascript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});
```

### 2. Set Up Monitoring
- Use UptimeRobot to monitor server uptime
- Get alerts when server goes down
- Prevents "sleeping" on free tier

### 3. Better Error Logging
Already implemented in your server:
- Console logs show CORS checks
- Error handlers return detailed messages
- Helps debug issues faster

### 4. Use Environment Variables
Always use environment variables for:
- API keys (Twilio, Dodo, Firebase)
- CORS origins
- Database credentials
Never hardcode in source files

---

## 📞 Still Having Issues?

### Check These Resources:
1. **Render Status**: https://status.render.com
2. **Render Docs**: https://render.com/docs
3. **Your Logs**: Render Dashboard → Logs
4. **Firebase Status**: https://status.firebase.google.com

### Common Quick Fixes:
```bash
# 1. Restart Render service (from dashboard)
# 2. Clear build cache and redeploy
# 3. Check environment variables
# 4. Verify Firebase credentials
# 5. Test server health endpoint
```

---

**Last Updated**: October 19, 2025  
**Status**: Troubleshooting Guide Complete  
**Next**: Follow Solution 1-5 in order
