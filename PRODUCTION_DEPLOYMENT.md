# 🚀 Production Deployment Guide

## ⚠️ CRITICAL: Fix Firebase Permission Error First

### Issue

You're seeing: `FirebaseError: Missing or insufficient permissions.`

### Solution

Deploy the updated Firestore rules that allow authenticated users to read the global config.

### Steps to Deploy Rules

#### Option 1: Using Firebase CLI (Recommended)

```bash
# Make sure you're logged in
firebase login

# Deploy the rules
firebase deploy --only firestore:rules
```

#### Option 2: Using Firebase Console

1. Go to https://console.firebase.google.com
2. Select project: **feedback-saas-55009**
3. Click **Firestore Database** → **Rules** tab
4. Copy the contents of `firestore.rules` file
5. Paste into the editor
6. Click **Publish**

### What Changed in Rules

```javascript
// Before (too strict):
match /admin_settings/{settingId} {
  allow read, write: if isAdmin();  // ❌ Only admins
}

// After (production-ready):
match /admin_settings/global {
  allow read: if isAuthenticated();  // ✅ Any logged-in user
  allow write: if isAdmin();         // ✅ Only admins can write
}
```

This allows any authenticated user to read the global config (API URLs, etc.) but only admins can modify it.

---

## 📋 Production Deployment Checklist

### 1. ✅ **Deploy Firestore Rules** (MUST DO FIRST)

```bash
firebase deploy --only firestore:rules
```

- Allows authenticated users to read `admin_settings/global`
- Test: Reload your app, the permission error should be gone

### 2. 🔐 **Secure Your Secrets**

#### Backend Secrets (Environment Variables)

Create a `.env` file for your backend (sms-server.js):

```env
# Twilio Credentials (NEVER expose in frontend)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Firebase Admin SDK
FIREBASE_PROJECT_ID=feedback-saas-55009
FIREBASE_CLIENT_EMAIL=your-service-account@feedback-saas-55009.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Server Config
PORT=3002
NODE_ENV=production
```

#### Remove Secrets from Firestore

⚠️ **IMPORTANT**: Remove Twilio credentials from `admin_settings/global` in Firebase Console:

```javascript
// In Firebase Console: admin_settings/global
{
  serverConfig: {
    smsServerPort: "https://your-api.com"  // ✅ Keep this
  },
  feedbackUrls: {
    feedbackPageUrl: "https://your-app.com/feedback"  // ✅ Keep this
  },
  // ❌ REMOVE THIS SECTION (move to backend env vars):
  twilio: {
    accountSid: "...",
    authToken: "...",
    phoneNumber: "..."
  }
}
```

### 3. 🏗️ **Build Frontend for Production**

```bash
# Install dependencies
npm install

# Build production bundle
npm run build

# Output will be in dist/ folder
```

### 4. 🌐 **Deploy Backend**

#### Option A: Railway (Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

#### Option B: Heroku

```bash
# Install Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# Login
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set TWILIO_ACCOUNT_SID=your_sid
heroku config:set TWILIO_AUTH_TOKEN=your_token
# ... set all env vars

# Deploy
git push heroku main
```

#### Option C: Render

1. Go to https://render.com
2. Connect your GitHub repo
3. Create new Web Service
4. Add environment variables in dashboard
5. Deploy

### 5. 🌍 **Deploy Frontend**

#### Option A: Vercel (Recommended for React)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd dist
vercel --prod
```

#### Option B: Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

#### Option C: Firebase Hosting

```bash
# Deploy to Firebase
firebase deploy --only hosting
```

### 6. 🔧 **Update Firebase Configuration**

After deploying, update `admin_settings/global` in Firebase Console:

```javascript
{
  serverConfig: {
    smsServerPort: "https://your-backend-api.railway.app"  // Your backend URL
  },
  feedbackUrls: {
    feedbackPageUrl: "https://your-frontend.vercel.app/feedback"  // Your frontend URL
  }
  // NO twilio section - those are in backend env vars now
}
```

### 7. ✅ **Test Production Deployment**

1. **Test Config Loading**

   - Open your production app
   - Check browser console for: `✅ Global config loaded from Firebase:`
   - Should show no permission errors

2. **Test Authentication**

   - Sign in with a test account
   - Go to Settings page
   - Verify SMS Server URL is displayed correctly

3. **Test API Calls**

   - Submit feedback
   - Check Dashboard loads data
   - Try deleting a negative comment
   - All should work without errors

4. **Test Fallback**
   - If Firebase fails, app should fall back to environment variables
   - Check console for fallback warnings

### 8. 📊 **Monitor Your App**

#### Set up monitoring (optional but recommended):

- **Sentry** for error tracking
- **LogRocket** for session replay
- **Google Analytics** for usage
- **Firebase Analytics** for app insights

---

## 🔒 Security Best Practices

### ✅ DO:

- Store secrets in backend environment variables
- Use HTTPS for all API endpoints
- Enable CORS only for your frontend domain
- Use Firebase Authentication for all users
- Set up proper Firestore security rules
- Use environment-specific configs (dev, staging, prod)

### ❌ DON'T:

- Store API keys or tokens in frontend code
- Expose Twilio credentials in Firestore
- Use `allow read: if true` for sensitive data
- Hardcode URLs in code
- Commit `.env` files to Git
- Use the same credentials for dev and prod

---

## 🚨 Troubleshooting

### "Permission denied" error persists

1. Deploy Firestore rules: `firebase deploy --only firestore:rules`
2. Clear browser cache and reload
3. Sign out and sign back in
4. Check Firebase Console → Authentication to verify user exists

### "Config not loading" in production

1. Verify Firestore rules are deployed
2. Check user is authenticated (localStorage has `companyId`)
3. Verify `admin_settings/global` document exists in Firebase
4. Check browser console for detailed error messages

### API calls failing with CORS errors

1. Update backend CORS settings to allow your frontend domain:

```javascript
// In sms-server.js
const cors = require("cors");
app.use(
  cors({
    origin: ["https://your-frontend.vercel.app"],
    credentials: true,
  })
);
```

### Build fails

1. Check TypeScript errors: `npm run build`
2. Fix any type errors
3. Check for missing dependencies: `npm install`
4. Clear cache: `rm -rf node_modules dist && npm install`

---

## 📝 Post-Deployment Checklist

After deployment, verify:

- [ ] Firestore rules deployed successfully
- [ ] No permission errors in browser console
- [ ] User can sign in successfully
- [ ] Settings page shows correct SMS server URL
- [ ] Dashboard loads without errors
- [ ] Can submit feedback (positive and negative)
- [ ] Can delete negative comments
- [ ] Backend API is accessible from frontend
- [ ] All API calls use production URLs from Firebase
- [ ] No hardcoded localhost URLs in production
- [ ] Twilio credentials NOT exposed in frontend
- [ ] Environment variables set correctly on backend
- [ ] HTTPS enabled on all endpoints
- [ ] Custom domain configured (if applicable)
- [ ] Monitoring/analytics set up

---

## 🎉 Success!

Once all checks pass, your app is production-ready! 🚀

### Next Steps:

1. Set up staging environment for testing
2. Configure CI/CD pipeline (GitHub Actions, etc.)
3. Set up backup strategy for Firebase data
4. Create monitoring dashboard
5. Document API endpoints for your team

---

## 📞 Support

If you encounter issues:

1. Check browser console for errors
2. Check Firebase Console → Firestore → Rules
3. Verify environment variables are set
4. Test API endpoints directly with curl/Postman
5. Review documentation files in project root

**Your app is now production-ready! Good luck! 🎊**
