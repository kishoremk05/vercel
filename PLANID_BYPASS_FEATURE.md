# Plan ID URL Parameter Feature

## Overview

Added support for `planId` URL parameter to bypass subscription verification and allow SMS sending without checking subscription status.

## Usage

### Dashboard URL Format

```
https://reputationflow360.com/dashboard?clientId=IGxXOEopOoRw0acjFcfWvEvNZHN2&planId=starter_1m
```

**Parameters:**

- `clientId` - Required: The client/company ID
- `planId` - Optional: When present, bypasses subscription check

### Supported Plan IDs

- `starter_1m` - Starter Monthly Plan (250 SMS)
- `growth_3m` - Growth Quarterly Plan (600 SMS)
- `pro_6m` - Pro Semi-Annual Plan (900 SMS)
- Any custom plan ID

## How It Works

### Client-Side (DashboardPage.tsx)

1. Extracts `planId` from URL using `URLSearchParams`
2. If `planId` is present:
   - ✅ Skips subscription verification
   - ✅ Allows SMS sending immediately
   - Logs: `[dashboard:send] ✅ Plan ID found in URL: {planId}, bypassing subscription check`
3. If `planId` is NOT present:
   - Performs normal subscription check (active status + credits)
   - Blocks SMS if no subscription or insufficient credits

### Server-Side (sms-server.js)

1. Extracts `planId` from request body
2. If `planId` is present:
   - ✅ Bypasses subscription check
   - ✅ Allows SMS sending
   - Logs: `[sms:limit-check] ✅ Plan ID provided in request: {planId}, bypassing subscription check`
3. If `planId` is NOT present:
   - Performs normal subscription verification
   - Checks: `clients/{companyId}/billing/subscription` → `profile/main` → `profile/subscription`
   - Blocks if no subscription, inactive status, or 0 credits

### SMS Request (App.tsx)

- Automatically includes `planId` from URL in SMS API request
- Request body includes: `{ planId: "starter_1m", companyId: "...", to: "...", body: "..." }`

## Use Cases

### 1. **Testing Without Subscription**

```
https://reputationflow360.com/dashboard?clientId=test123&planId=test_plan
```

Allows testing SMS functionality without creating a subscription.

### 2. **Demo/Trial Users**

```
https://reputationflow360.com/dashboard?clientId=demo_user&planId=trial_plan
```

Provides demo users with SMS access without payment.

### 3. **Admin Override**

```
https://reputationflow360.com/dashboard?clientId=xyz&planId=admin_override
```

Allows admins to send SMS on behalf of clients without subscription checks.

### 4. **Temporary Access**

```
https://reputationflow360.com/dashboard?clientId=abc&planId=temp_access_30d
```

Grants temporary SMS access for specific campaigns or time periods.

## Security Considerations

### ⚠️ Important Notes:

1. **Plan ID is NOT validated** - Any string value bypasses the check
2. **No credit tracking** - SMS sent with planId bypass doesn't decrement credits
3. **No rate limiting** - Unlimited SMS when using planId (server limits still apply)
4. **URL visible** - Plan ID is exposed in browser URL and history

### Recommended Security Measures:

1. **Server-side validation**: Add planId whitelist on server
2. **Rate limiting**: Implement per-client rate limits even with planId
3. **Audit logging**: Track all SMS sent with planId bypass
4. **Expiry mechanism**: Add timestamp validation for temporary access
5. **Token-based**: Consider replacing planId with signed JWT tokens

## Code Changes

### Files Modified:

1. ✅ **`pages/DashboardPage.tsx`** (line ~3095)

   - Added URL parameter extraction
   - Added conditional subscription check bypass

2. ✅ **`sms-server.js`** (line ~568, ~642)

   - Added `planId` to request body extraction
   - Added subscription check bypass logic

3. ✅ **`App.tsx`** (line ~1343)
   - Added planId extraction from URL
   - Included planId in SMS API request

## Testing

### Test Case 1: With planId (Bypass)

```bash
# URL
https://reputationflow360.com/dashboard?clientId=test&planId=starter_1m

# Expected Behavior
1. Upload customers
2. Click "Send Message"
3. ✅ SMS sent without subscription check
4. Console: "[dashboard:send] ✅ Plan ID found in URL: starter_1m"
5. Server: "[sms:limit-check] ✅ Plan ID provided: starter_1m, bypassing"
```

### Test Case 2: Without planId (Normal)

```bash
# URL
https://reputationflow360.com/dashboard?clientId=test

# Expected Behavior
1. Upload customers
2. Click "Send Message"
3. ❌ Subscription check performed
4. If no subscription: Alert + redirect to payment page
5. If subscription: SMS sent with credit decrement
```

### Test Case 3: Invalid Subscription + planId

```bash
# URL (with planId)
https://reputationflow360.com/dashboard?clientId=expired_user&planId=override

# Expected Behavior
1. Upload customers
2. Click "Send Message"
3. ✅ SMS sent (subscription ignored due to planId)
4. Credits NOT decremented
```

## Server Logs

### With planId:

```
[sms:limit-check] ✅ Plan ID provided in request: starter_1m, bypassing subscription check
[sms:send:attempt] { from: '+15551234567', to: '+919080222066', len: 185 }
[sms:sent][recordMessage] ✅ incr req=... company=XXX sid=SM... status=queued
```

### Without planId (Normal):

```
[sms:limit-check] ✅ Found subscription for company=XXX plan=starter_1m remaining=249 status=active
[sms:limit-check] ✅ Credits available: 249, allowing SMS
[sms:send:attempt] { from: '+15551234567', to: '+919080222066', len: 185 }
[sms:sent][credits] ✅ Decremented credits (249 → 248)
```

### Without planId (Blocked):

```
[sms:limit-check] ❌ BLOCKED: No subscription found for company=XXX
[Response] 403 { error: 'No active subscription found...' }
```

## Benefits

✅ **Flexible Testing**: Easy SMS testing without subscription setup
✅ **Demo Support**: Provide trial users with SMS access
✅ **Admin Tools**: Override subscription checks when needed
✅ **Quick Access**: Temporary SMS access via URL parameter
✅ **No Database Changes**: No Firestore writes needed for bypass

## Limitations

❌ **No Validation**: Any planId value bypasses the check
❌ **No Tracking**: Credits not decremented when using planId
❌ **No Expiry**: Plan ID valid indefinitely unless validated
❌ **Exposed URL**: Plan ID visible in browser history/logs
❌ **No Rate Limit**: Potential for abuse without additional controls

## Future Enhancements

1. **Server-side planId validation**

   ```javascript
   const VALID_PLAN_IDS = [
     "starter_1m",
     "growth_3m",
     "pro_6m",
     "admin_override",
   ];
   if (planIdBody && !VALID_PLAN_IDS.includes(planIdBody)) {
     return res.status(400).json({ error: "Invalid plan ID" });
   }
   ```

2. **Expiring planId tokens**

   ```javascript
   // Format: planId.timestamp.signature
   const planIdToken = "starter_1m.1730419200.abc123xyz";
   // Validate timestamp and signature on server
   ```

3. **Usage tracking with planId**

   ```javascript
   // Track SMS sent with planId bypass for analytics
   await firestore.collection("planid_usage").add({
     planId: planIdBody,
     companyId: companyIdBody,
     timestamp: now(),
     smsCount: 1,
   });
   ```

4. **Rate limiting per planId**
   ```javascript
   // Limit SMS per planId per hour
   const limit = await checkPlanIdRateLimit(planIdBody);
   if (limit.exceeded) {
     return res.status(429).json({ error: "Rate limit exceeded" });
   }
   ```

## Rollback Instructions

If issues occur, revert the planId bypass:

### DashboardPage.tsx

```typescript
// Remove lines ~3095-3103
// Change back to:
if (selectedIds.length > 1) {
  // Normal subscription check
}
```

### sms-server.js

```javascript
// Remove lines ~642-648
// Change back to:
if (companyIdBody && firestoreEnabled) {
  // Normal subscription check
}
```

### App.tsx

```typescript
// Remove lines ~1348-1351
// Remove from body: ...(planIdFromUrl ? { planId: planIdFromUrl } : {}),
```

---

## Summary

✅ **Feature Implemented**: Plan ID URL parameter bypass
✅ **Client-Side**: URL parameter detection and bypass logic
✅ **Server-Side**: Request body planId check and bypass
✅ **SMS API**: Automatic planId inclusion in requests
✅ **Committed**: Changes pushed to GitHub (commit: 48553f3)

**Usage**: Add `&planId=starter_1m` to dashboard URL to bypass subscription checks
