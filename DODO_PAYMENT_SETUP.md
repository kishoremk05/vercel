# Dodo Payment Integration Setup Guide

## ✅ What Has Been Fixed

Your Dodo payment integration has been updated to match your working server code. Here's what was changed:

### 1. **Server-Side Updates** (`sms-server.js`)

- ✅ Added `axios` dependency for reliable API calls
- ✅ Updated product ID mapping to support both naming conventions (`starter_1m` and `monthly`)
- ✅ Enhanced error logging for debugging
- ✅ Added API key validation at the start
- ✅ Improved error handling with detailed responses
- ✅ Added timeout configuration (30 seconds)
- ✅ Better return URL handling with fallbacks

### 2. **Package Updates** (`package.json`)

- ✅ Added `axios@^1.7.2` to dependencies

## 🔧 Setup Instructions

### Step 1: Install Dependencies

Run this command to install axios:

```bash
npm install
```

### Step 2: Configure Environment Variables

1. Copy `.env.example` to `.env`:

   ```bash
   copy .env.example .env
   ```

2. Edit `.env` and add your Dodo API credentials:

```env
# ============== DODO PAYMENT CONFIGURATION ==============
DODO_API_KEY=your_actual_dodo_api_key_here
DODO_API_BASE=https://test.dodopayments.com

# Product IDs from your Dodo Dashboard
DODO_PRODUCT_STARTER_1M=pdt_0SaMzoGEsjSCi8t0xd5vN
DODO_PRODUCT_GROWTH_3M=pdt_OsKdNhpmFjOxSkqpwBtXR
DODO_PRODUCT_PRO_6M=pdt_Blsof767CZTPWreD75zFF

# Frontend URL (where users return after payment)
FRONTEND_URL=https://vercel-swart-chi-29.vercel.app
```

### Step 3: Get Your Dodo API Key

1. Go to [Dodo Payments Dashboard](https://test.dodopayments.com/dashboard)
2. Log in to your account
3. Navigate to **Settings** → **API Keys**
4. Copy your **Test API Key**
5. Replace `your_actual_dodo_api_key_here` in `.env` with your actual key

### Step 4: Verify Product IDs

The default product IDs in `.env.example` match your working project:

- **Starter (1 month)**: `pdt_0SaMzoGEsjSCi8t0xd5vN`
- **Growth (3 months)**: `pdt_OsKdNhpmFjOxSkqpwBtXR`
- **Professional (6 months)**: `pdt_Blsof767CZTPWreD75zFF`

If you're using different products in Dodo:

1. Go to **Products** section in Dodo Dashboard
2. Copy the product IDs for your subscription plans
3. Update the values in `.env`

### Step 5: Test the Integration

#### Test Locally

1. Start the server:

   ```bash
   npm run dev
   ```

2. Open your browser to `http://localhost:5173`

3. Navigate to the Payment page

4. Select a plan and click "Pay"

5. You should be redirected to Dodo's payment page

#### Check Server Logs

You should see logs like:

```
[Dodo Payment] Creating SUBSCRIPTION for growth_3m plan ($40)...
[Dodo Payment] API URL: https://test.dodopayments.com/subscriptions
[Dodo Payment] Product ID: pdt_OsKdNhpmFjOxSkqpwBtXR
[Dodo Payment] ✅ Subscription created successfully!
[Dodo Payment] Payment URL: https://test.dodopayments.com/checkout/...
```

## 🚨 Troubleshooting

### Error: "DODO_API_KEY not configured"

**Cause**: The `.env` file is missing or not loaded.

**Solution**:

1. Ensure `.env` file exists in the project root
2. Verify `DODO_API_KEY` is set correctly
3. Restart the server after editing `.env`

### Error: "Invalid plan selected"

**Cause**: Frontend is sending a plan name that doesn't match server product mapping.

**Solution**: The server now supports both naming conventions:

- `starter_1m` / `monthly`
- `growth_3m` / `quarterly`
- `pro_6m` / `halfyearly`

### Error: "Payment gateway did not return checkout URL"

**Cause**: Dodo API returned success but no payment link.

**Solution**:

1. Check if your Dodo products are configured correctly
2. Verify product IDs in Dodo Dashboard match `.env`
3. Check Dodo Dashboard for any account issues

### Error: "Failed to create subscription payment"

**Cause**: Dodo API rejected the request.

**Solution**:

1. Check server logs for detailed error message
2. Verify API key is valid and not expired
3. Ensure billing information is correct
4. Check Dodo Dashboard for API limits or restrictions

## 📝 Payment Flow

### How It Works

1. **User selects plan** → Frontend (`PaymentPage.tsx`)
2. **Frontend calls API** → `POST /api/payments/create-session`
3. **Server creates subscription** → Dodo API `/subscriptions`
4. **Dodo returns payment link** → Server sends to frontend
5. **User redirects to Dodo** → Completes payment
6. **User returns to app** → `/payment-success` or `/payment-cancel`
7. **Webhook notifies server** → `POST /api/payments/webhook` (optional)

### Plan Configuration

The plans are defined in `PaymentPage.tsx`:

| Plan ID      | Name         | Duration | Price | SMS Credits |
| ------------ | ------------ | -------- | ----- | ----------- |
| `starter_1m` | Starter      | 1 month  | $15   | 250         |
| `growth_3m`  | Growth       | 3 months | $40   | 800         |
| `pro_6m`     | Professional | 6 months | $80   | 1500        |

## 🔐 Security Notes

### For Production Deployment

1. **Use Production API Keys**:

   ```env
   DODO_API_BASE=https://api.dodopayments.com
   DODO_API_KEY=your_production_api_key
   ```

2. **Enable Webhook Signature Verification**:

   - Uncomment signature verification in webhook handler
   - Add `DODO_WEBHOOK_SECRET` to `.env`
   - Get webhook secret from Dodo Dashboard

3. **Secure Environment Variables**:
   - Never commit `.env` to version control
   - Use secure environment variable storage (Vercel Secrets, Render Environment)
   - Rotate API keys periodically

## 🚀 Deployment

### Vercel (Frontend)

1. Set environment variable in Vercel Dashboard:
   ```
   VITE_API_BASE=https://your-backend-server.onrender.com
   ```

### Render (Backend)

1. Set environment variables in Render Dashboard:

   ```
   DODO_API_KEY=your_dodo_api_key
   DODO_API_BASE=https://test.dodopayments.com
   DODO_PRODUCT_STARTER_1M=pdt_0SaMzoGEsjSCi8t0xd5vN
   DODO_PRODUCT_GROWTH_3M=pdt_OsKdNhpmFjOxSkqpwBtXR
   DODO_PRODUCT_PRO_6M=pdt_Blsof767CZTPWreD75zFF
   FRONTEND_URL=https://vercel-swart-chi-29.vercel.app
   ```

2. Deploy the updated code

## ✅ Testing Checklist

- [ ] Environment variables configured in `.env`
- [ ] Axios installed (`npm install`)
- [ ] Server starts without errors
- [ ] Payment page loads correctly
- [ ] Clicking "Pay" redirects to Dodo
- [ ] Server logs show successful subscription creation
- [ ] Payment completion redirects to success page
- [ ] Webhook receives payment events (optional)

## 📞 Support

If you encounter issues:

1. Check server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test with Dodo's test card: `4242 4242 4242 4242`
4. Contact Dodo support if API issues persist

---

**Last Updated**: $(Get-Date -Format "yyyy-MM-dd")
