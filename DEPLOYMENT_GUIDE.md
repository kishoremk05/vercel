# 🚀 Deployment Guide - Dodo Payment Integration

## Overview

This guide will help you deploy your updated Dodo payment integration to:

1. **GitHub** - Your code repository
2. **Vercel** - Your frontend hosting
3. **Render** - Your backend server (if applicable)

---

## 📦 What Was Changed

### Files Modified:

- ✅ `sms-server.js` - Enhanced Dodo payment integration
- ✅ `package.json` - Added axios dependency
- ✅ `.env.example` - Updated with Dodo configuration

### Files Added:

- ✅ `DODO_PAYMENT_SETUP.md` - Setup instructions
- ✅ `DODO_CHECKLIST.md` - Verification checklist
- ✅ `test-dodo-payment.js` - Integration test script
- ✅ `DEPLOYMENT_GUIDE.md` - This file

---

## 🔧 Pre-Deployment Checklist

Before deploying, ensure:

- [ ] Dodo API key is configured in `.env`
- [ ] All product IDs are correct
- [ ] Local testing completed successfully
- [ ] Dependencies installed (`npm install`)
- [ ] No errors in console

---

## 📤 Step 1: Push to GitHub

### Check Current Status

```bash
git status
```

### Stage All Changes

```bash
git add .
```

### Commit Changes

```bash
git commit -m "feat: Enhanced Dodo payment integration with improved error handling and axios support"
```

### Push to GitHub

```bash
git push origin main
```

**Alternative detailed commit message:**

```bash
git commit -m "feat: Dodo payment integration improvements

- Added axios dependency for reliable API calls
- Enhanced product ID mapping (supports both naming conventions)
- Improved error handling with detailed logging
- Added timeout configuration (30 seconds)
- Better return URL handling with fallbacks
- Added comprehensive setup documentation
- Included integration test script"
```

---

## 🌐 Step 2: Deploy to Vercel (Frontend)

### Option A: Automatic Deployment (Recommended)

Vercel automatically deploys when you push to GitHub:

1. Push your code to GitHub (Step 1 above)
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Find your project: `vercel-swart-chi-29`
4. Wait for automatic deployment to complete
5. Check deployment logs for any errors

### Option B: Manual Deployment via CLI

```bash
# Install Vercel CLI if not already installed
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### Configure Environment Variables in Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables

2. Add these variables:

```
VITE_API_BASE=https://server-cibp.onrender.com
```

**Important**: Vercel only uses `VITE_` prefixed variables for build-time environment variables.

3. Redeploy after adding variables:
   - Go to Deployments tab
   - Click "..." menu on latest deployment
   - Click "Redeploy"

---

## 🖥️ Step 3: Deploy Backend to Render

### If Backend is on Render:

1. **Push to GitHub first** (Step 1)

2. **Go to Render Dashboard**

   - Navigate to your service (e.g., `server-cibp`)

3. **Update Environment Variables**

   Add/Update these in Render Environment Variables:

   ```
   DODO_API_KEY=your_actual_dodo_api_key_here
   DODO_API_BASE=https://test.dodopayments.com
   DODO_PRODUCT_STARTER_1M=pdt_0SaMzoGEsjSCi8t0xd5vN
   DODO_PRODUCT_GROWTH_3M=pdt_OsKdNhpmFjOxSkqpwBtXR
   DODO_PRODUCT_PRO_6M=pdt_Blsof767CZTPWreD75zFF
   FRONTEND_URL=https://vercel-swart-chi-29.vercel.app
   NODE_ENV=production
   ```

4. **Trigger Manual Deploy**

   - Click "Manual Deploy" → "Deploy latest commit"
   - Or use "Clear build cache & deploy"

5. **Monitor Deployment Logs**
   - Look for successful startup messages
   - Check for "[Dodo] ✅" messages
   - Verify no errors

### If Backend is Elsewhere:

- Deploy to your hosting platform
- Ensure environment variables are set
- Install dependencies during deployment
- Restart the service

---

## ✅ Post-Deployment Verification

### 1. Check Frontend Deployment

- [ ] Visit `https://vercel-swart-chi-29.vercel.app`
- [ ] Navigate to `/payment` page
- [ ] Verify all plans are displayed
- [ ] Check browser console for errors

### 2. Check Backend Deployment

- [ ] Visit `https://server-cibp.onrender.com/health`
- [ ] Should return: `{"status":"ok"}`
- [ ] Check backend logs for Dodo configuration messages

### 3. Test Payment Flow

- [ ] Log in to your app
- [ ] Navigate to Payment page
- [ ] Select a plan
- [ ] Click "Pay" button
- [ ] Should redirect to Dodo payment page
- [ ] Complete test payment
- [ ] Should redirect back to success page

### 4. Check Server Logs

Look for these messages in production logs:

```
✅ API Key loaded successfully
[Dodo Payment] Creating SUBSCRIPTION for [plan] plan...
[Dodo Payment] ✅ Subscription created successfully!
[Dodo Payment] Payment URL: https://test.dodopayments.com/checkout/...
```

---

## 🚨 Troubleshooting

### Vercel Deployment Issues

**Issue**: Build fails
**Solution**:

```bash
# Check build logs in Vercel Dashboard
# Ensure all dependencies are in package.json
npm install
npm run build  # Test locally first
```

**Issue**: Environment variables not working
**Solution**:

- Ensure variables start with `VITE_` for frontend
- Redeploy after adding variables
- Check deployment logs

### Render Deployment Issues

**Issue**: Server won't start
**Solution**:

```bash
# Check logs in Render Dashboard
# Verify all environment variables are set
# Check for missing dependencies
```

**Issue**: Dodo API calls failing
**Solution**:

- Verify `DODO_API_KEY` is set in Render
- Check it's the correct key (not wrapped in quotes)
- Ensure axios is installed (`npm install`)

### Payment Integration Issues

**Issue**: "DODO_API_KEY not configured"
**Solution**:

- Add `DODO_API_KEY` to Render environment variables
- Restart the service
- Check logs for confirmation

**Issue**: "Invalid plan selected"
**Solution**:

- Verify frontend sends: `starter_1m`, `growth_3m`, or `pro_6m`
- Check product IDs in environment variables
- Ensure they match Dodo Dashboard

---

## 📋 Quick Command Reference

### GitHub Operations

```bash
# Check status
git status

# Add all changes
git add .

# Commit
git commit -m "Your commit message"

# Push to GitHub
git push origin main

# View remote
git remote -v

# Pull latest
git pull origin main
```

### Vercel Operations

```bash
# Deploy to production
vercel --prod

# Check deployment status
vercel ls

# View logs
vercel logs
```

### NPM Operations

```bash
# Install dependencies
npm install

# Install specific package
npm install axios

# Test build locally
npm run build

# Start development server
npm run dev
```

---

## 🔐 Security Checklist for Production

- [ ] Use production Dodo API keys (not test keys)
- [ ] Enable webhook signature verification
- [ ] Rotate API keys periodically
- [ ] Use HTTPS for all endpoints
- [ ] Set appropriate CORS origins
- [ ] Never commit `.env` to repository
- [ ] Use environment variable secrets in hosting platforms

---

## 📊 Monitoring After Deployment

### What to Monitor:

1. **Vercel Analytics**

   - Page load times
   - Error rates
   - Geographic distribution

2. **Render Logs**

   - API response times
   - Error messages
   - Dodo API call success rate

3. **Dodo Dashboard**
   - Successful payments
   - Failed transactions
   - Webhook deliveries

---

## 🎉 Success Criteria

Your deployment is successful when:

- ✅ Code pushed to GitHub without conflicts
- ✅ Vercel deployment completes successfully
- ✅ Render backend is running without errors
- ✅ Payment page loads on production URL
- ✅ Test payment completes successfully
- ✅ Success/cancel redirects work correctly
- ✅ No errors in production logs

---

## 📞 Need Help?

- **GitHub Issues**: Check repository issues
- **Vercel Support**: https://vercel.com/support
- **Render Support**: https://render.com/docs
- **Dodo Support**: support@dodopayments.com

---

**Last Updated**: January 2025
