# 🧪 Complete Test Plan - All Features

## 📋 Pre-Testing Checklist

Before testing, ensure:

✅ **Backend Deployed to Render.com**

- Go to: https://dashboard.render.com
- Check that your service is deployed with latest code
- Status should show "Live"

✅ **Frontend Deployed to Vercel**

- Go to: https://vercel.com/dashboard
- Check latest deployment is live
- Status should show "Ready"

✅ **Firebase Credentials Configured**

- Twilio Account SID: `AC***` (configured in Credentials page)
- Twilio Auth Token: `***` (configured in Credentials page)
- Twilio Phone Number: `+1978***` (configured in Credentials page)

---

## 🎯 Test Suite 1: Feedback Submission

### Test 1.1: Submit Negative Feedback ⭐⭐⭐ PRIORITY

**URL:**

```
https://vercel-swart-chi-29.vercel.app/feedback?clientId=AiG0FdxfeIWByiHR2YETuPxLQWT2&tenantKey=business-saas
```

**Steps:**

1. Open URL in browser
2. Rate 1-4 stars (negative)
3. Enter comment: "Test negative feedback - [current time]"
4. Click Submit

**Expected Results:**

- ✅ Success message shows
- ✅ No console errors
- ✅ Server logs show:
  ```
  [feedback:manual-parse] Read XXX bytes from stream
  [feedback:manual-parse] ✅ Successfully parsed manual body
  [feedback:received] tenantKey: business-saas
  [feedback:received] companyId: AiG0FdxfeIWByiHR2YETuPxLQWT2
  [feedback:negative] ✅ Added negative comment to dashboard
  ```

**Check Dashboard:**

- Go to: https://vercel-swart-chi-29.vercel.app/dashboard
- Login with your credentials
- Verify feedback count increased
- Check "Negative Comments" section shows new entry

---

### Test 1.2: Submit Positive Feedback

**URL:** (Same as Test 1.1)

**Steps:**

1. Open URL
2. Rate 5 stars (positive)
3. Click Submit

**Expected Results:**

- ✅ Redirects to Google Review link
- ✅ No console errors
- ✅ Server logs show positive feedback received
- ✅ Dashboard feedback count increases

---

## 📱 Test Suite 2: SMS Sending

### Test 2.1: Single SMS Send

**Prerequisites:**

- Login to dashboard
- Ensure Twilio credentials are configured (check Credentials page)

**Steps:**

1. Go to Dashboard
2. Click "Add Customer" and add a test customer with phone: `+1234567890` (use your real number for testing)
3. Select the customer checkbox
4. Click "Send SMS" button
5. Confirm in the dialog

**Expected Results:**

- ✅ Success alert shows: "SMS sent successfully to 1 customer(s)"
- ✅ No console errors
- ✅ Server logs show:
  ```
  [sms:send] Resolved credentials: accountSid=ACbcb..., from=+19784867267
  [sms:success] Message sent: SM...
  [dashboard:message:record] ✅ Recorded message for client
  ```
- ✅ You receive the SMS on your phone

---

### Test 2.2: Bulk SMS Send (Multiple Customers)

**Prerequisites:**

- At least 2 customers in dashboard

**Steps:**

1. Select multiple customers (check boxes)
2. Click "Send SMS"
3. Confirm

**Expected Results:**

- ✅ Success alert shows count of messages sent
- ✅ Each customer receives SMS
- ✅ Server logs show multiple successful sends
- ✅ Dashboard message count increases by number of customers

---

## 🔐 Test Suite 3: Authentication & Authorization

### Test 3.1: User Signup

**Steps:**

1. Go to: https://vercel-swart-chi-29.vercel.app/signup
2. Fill in:
   - Name: "Test User"
   - Email: "test@example.com"
   - Password: "TestPass123"
   - Tenant Key: "business-saas"
3. Click "Sign Up with Email"

**Expected Results:**

- ✅ Account created successfully
- ✅ Redirects to dashboard or login
- ✅ No console errors

---

### Test 3.2: User Login

**Steps:**

1. Go to: https://vercel-swart-chi-29.vercel.app/
2. Click "Continue with Email"
3. Enter email: `test@example.com`
4. Click "Send Magic Link"

**Expected Results:**

- ✅ Success message: "Magic link sent to your email"
- ✅ Check email for login link
- ✅ Click link and verify login works

---

## ⚙️ Test Suite 4: Settings & Configuration

### Test 4.1: Update Business Name

**Steps:**

1. Login to dashboard
2. Click profile icon → Settings
3. Change "Business Name"
4. Click "Save Changes"

**Expected Results:**

- ✅ Success message: "Profile updated successfully"
- ✅ Name updates in sidebar
- ✅ No console errors
- ✅ Server logs show successful update

---

### Test 4.2: Update Credentials

**Steps:**

1. Go to Credentials page
2. Update any credential (e.g., Twilio Phone Number)
3. Click "Save Credentials"

**Expected Results:**

- ✅ Success message
- ✅ Credentials saved to Firestore
- ✅ Subsequent SMS sends use new credentials

---

### Test 4.3: Update SMS Template

**Steps:**

1. Go to Settings page
2. Update "SMS Template" field
3. Include `{link}` placeholder
4. Click "Save Changes"

**Expected Results:**

- ✅ Template saved
- ✅ Next SMS uses new template
- ✅ `{link}` is replaced with actual feedback URL

---

## 📊 Test Suite 5: Dashboard Features

### Test 5.1: View Dashboard Stats

**Steps:**

1. Login to dashboard
2. View the dashboard home page

**Expected Results:**

- ✅ Stats cards show correct counts:
  - Messages sent
  - Feedback received
  - Negative feedback
  - Average rating
- ✅ Chart shows message activity
- ✅ No loading errors

---

### Test 5.2: View Negative Comments

**Steps:**

1. Go to dashboard
2. Scroll to "Negative Comments" section

**Expected Results:**

- ✅ All negative feedback entries displayed
- ✅ Shows customer phone, comment, rating
- ✅ Can reply to comments
- ✅ Can delete comments

---

### Test 5.3: Add Customer

**Steps:**

1. Click "Add Customer" button
2. Fill in:
   - Name: "Jane Doe"
   - Phone: "+1234567890"
3. Click "Add"

**Expected Results:**

- ✅ Customer appears in customer list
- ✅ No errors
- ✅ Can select for SMS send

---

## 🔍 Test Suite 6: Error Handling

### Test 6.1: Invalid Phone Number

**Steps:**

1. Try to add customer with invalid phone: "123"
2. Or try to send SMS to invalid number

**Expected Results:**

- ✅ Error message shows: "Invalid phone number"
- ✅ No server crash
- ✅ User can correct and retry

---

### Test 6.2: Missing Twilio Credentials

**Steps:**

1. Remove Twilio credentials from Credentials page
2. Try to send SMS

**Expected Results:**

- ✅ Error message: "Twilio not configured"
- ✅ Suggests adding credentials
- ✅ No crash

---

### Test 6.3: Network Failure

**Steps:**

1. Open DevTools → Network tab
2. Set throttling to "Offline"
3. Try to submit feedback

**Expected Results:**

- ✅ Error message: "Network error"
- ✅ Suggests checking connection
- ✅ Can retry when back online

---

## 🎨 Test Suite 7: UI/UX

### Test 7.1: Mobile Responsiveness

**Steps:**

1. Open any page on mobile device or DevTools mobile view
2. Test all features

**Expected Results:**

- ✅ All pages are responsive
- ✅ Buttons are clickable
- ✅ Text is readable
- ✅ Forms work correctly

---

### Test 7.2: Loading States

**Steps:**

1. Watch for loading indicators when:
   - Submitting forms
   - Loading dashboard
   - Sending SMS

**Expected Results:**

- ✅ Loading spinners show during async operations
- ✅ Buttons are disabled while loading
- ✅ No flickering or UI jumps

---

## 🚨 Critical Path Test (Full E2E)

### Complete User Journey

**Scenario:** New business owner signs up and sends first feedback request

**Steps:**

1. **Signup**

   - Go to signup page
   - Create account
   - Verify email link works

2. **Configure**

   - Login to dashboard
   - Go to Credentials page
   - Add Twilio credentials
   - Go to Settings page
   - Set SMS template with feedback link

3. **Add Customer**

   - Click "Add Customer"
   - Add customer with real phone number

4. **Send SMS**

   - Select customer
   - Click "Send SMS"
   - Confirm send

5. **Customer Submits Feedback**

   - Customer receives SMS with link
   - Customer clicks link
   - Customer submits negative feedback (1-4 stars with comment)

6. **View Dashboard**

   - Return to dashboard
   - Verify stats updated:
     - Messages sent: +1
     - Feedback received: +1
     - Negative feedback: +1
   - Check "Negative Comments" section shows entry

7. **Reply to Feedback**
   - Click "Reply" on negative comment
   - Send followup SMS

**Expected Results:**

- ✅ All steps complete without errors
- ✅ Data persists correctly
- ✅ Real-time updates work
- ✅ Customer receives all messages

---

## 📝 Test Results Template

For each test, record:

| Test ID | Test Name         | Status  | Notes | Logs                |
| ------- | ----------------- | ------- | ----- | ------------------- |
| 1.1     | Negative Feedback | ✅ PASS |       | [paste server logs] |
| 1.2     | Positive Feedback | ✅ PASS |       | [paste server logs] |
| 2.1     | Single SMS        | ✅ PASS |       | [paste server logs] |
| ...     | ...               | ...     | ...   | ...                 |

---

## 🐛 Bug Report Template

If you find issues, report using this template:

```
**Bug Title:** [Short description]

**Test ID:** [e.g., Test 1.1]

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. ...

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happened]

**Browser Console Logs:**
```

[Paste here]

```

**Server Logs (Render):**
```

[Paste here]

```

**Screenshots:**
[Attach if relevant]

**Environment:**
- Browser: [Chrome/Firefox/Safari]
- OS: [Windows/Mac/Linux]
- Device: [Desktop/Mobile]
```

---

## ✅ Success Criteria

Your project is **production-ready** when:

- ✅ All Test Suite 1 tests pass (Feedback)
- ✅ All Test Suite 2 tests pass (SMS)
- ✅ All Test Suite 3 tests pass (Auth)
- ✅ Critical Path Test passes completely
- ✅ No console errors during normal operation
- ✅ All server endpoints return 200 OK for valid requests
- ✅ Dashboard stats update in real-time
- ✅ Mobile UI works smoothly

---

## 🔧 Troubleshooting Quick Reference

### Issue: Feedback submission fails with 400

**Check:**

1. Server logs for `[feedback:manual-parse]` messages
2. Browser console for payload being sent
3. Content-Type header is `application/json`

**Fix:**

- Code is already updated to handle this
- Redeploy if you haven't already

---

### Issue: SMS not sending

**Check:**

1. Twilio credentials are correct in Credentials page
2. Server logs for `[sms:send]` messages
3. Twilio Account SID starts with `AC`
4. Phone number is in E.164 format (+1234567890)

**Fix:**

- Update credentials in Credentials page
- Verify Twilio account is active and funded

---

### Issue: Dashboard not loading

**Check:**

1. Browser console for errors
2. Server logs for `/api/dashboard/stats` endpoint
3. Firebase connection is working

**Fix:**

- Check firestore.rules allow reads
- Verify Firebase service account is configured

---

## 📞 Support

If you encounter issues not covered here:

1. **Check this document's Troubleshooting section**
2. **Review server logs** (Render.com dashboard → Logs)
3. **Check browser console** (F12 → Console tab)
4. **Review Network tab** (F12 → Network → Failed requests)

Then provide:

- Test ID that failed
- Server logs (last 50 lines after the test)
- Browser console logs (all errors)
- Network tab screenshot (if API call fails)

---

**Last Updated:** October 8, 2025  
**Version:** 1.0  
**Status:** ✅ Ready for Testing
