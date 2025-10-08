# Twilio Credentials Management - Complete Implementation

## Overview

Twilio/WhatsApp credentials are now permanently stored in Firebase Firestore and managed exclusively through the **Admin Page**. This ensures proper security and centralized credential management.

## Implementation Details

### 1. Storage Location

- **Where**: Firebase Firestore `companies` collection
- **Fields Stored**:
  - `twilioAccountSid` - Twilio Account SID
  - `twilioAuthToken` - Twilio Auth Token
  - `twilioPhoneNumber` - Twilio Phone Number
  - `whatsappAccountSid` - WhatsApp Account SID (optional)
  - `whatsappAuthToken` - WhatsApp Auth Token (optional)
  - `whatsappPhoneNumber` - WhatsApp Phone Number (optional)
  - `feedbackUrl` - Feedback page URL (optional)
  - `googleRedirectUrl` - Google OAuth redirect URL (optional)

### 2. Admin Page Integration

#### Location

`pages/AdminPage.tsx` - The Twilio SMS Credentials section

#### Features

- **Auto-load credentials**: On page mount, credentials are fetched from Firestore
- **Input fields**:
  - Account SID (text input)
  - Auth Token (password input for security)
  - Phone Number (tel input)
- **Save to Database**: Clicking "Save Credentials" sends credentials to Firestore
- **Loading States**: Button shows "Saving..." with spinner during save
- **Success Message**: "✓ Credentials saved successfully!" after successful save
- **Error Handling**: Displays error message if save fails

#### Code Flow

```typescript
// On mount - Load credentials from database
useEffect(() => {
  const loadCredentials = async () => {
    const companyId = localStorage.getItem("companyId");
    const token = localStorage.getItem("token");

    const response = await fetch(
      `/api/company/credentials?companyId=${companyId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (response.ok) {
      const data = await response.json();
      // Set local state with loaded credentials
    }
  };
  loadCredentials();
}, []);

// On save - Save credentials to database
const handleSaveCredentials = async () => {
  const response = await fetch("/api/company/credentials", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      companyId,
      twilioAccountSid,
      twilioAuthToken,
      twilioPhoneNumber,
    }),
  });

  if (response.ok) {
    // Show success message
  }
};
```

### 3. Backend API Endpoints

#### GET `/api/company/credentials?companyId=XXX`

**Purpose**: Retrieve stored credentials for a company

**Authentication**: Requires JWT token in `Authorization: Bearer TOKEN` header

**Response**:

```json
{
  "twilioAccountSid": "ACxxx...",
  "twilioAuthToken": "xxx...",
  "twilioPhoneNumber": "+15551234567",
  "whatsappAccountSid": "ACxxx...",
  "whatsappAuthToken": "xxx...",
  "whatsappPhoneNumber": "+15559876543",
  "feedbackUrl": "https://...",
  "googleRedirectUrl": "https://..."
}
```

#### POST `/api/company/credentials`

**Purpose**: Save/update credentials for a company

**Authentication**: Requires JWT token in `Authorization: Bearer TOKEN` header

**Request Body**:

```json
{
  "companyId": "company_id_here",
  "twilioAccountSid": "ACxxx...",
  "twilioAuthToken": "xxx...",
  "twilioPhoneNumber": "+15551234567",
  "whatsappAccountSid": "ACxxx...", // optional
  "whatsappAuthToken": "xxx...", // optional
  "whatsappPhoneNumber": "+15559876543", // optional
  "feedbackUrl": "https://...", // optional
  "googleRedirectUrl": "https://..." // optional
}
```

**Response**:

```json
{
  "message": "Credentials updated successfully"
}
```

### 4. Database Schema

#### Collection: `companies`

```javascript
{
  id: "company_id",
  name: "Company Name",
  createdAt: Timestamp,

  // Twilio Credentials
  twilioAccountSid: "ACxxx...",
  twilioAuthToken: "xxx...",
  twilioPhoneNumber: "+15551234567",

  // WhatsApp Credentials (optional)
  whatsappAccountSid: "ACxxx...",
  whatsappAuthToken: "xxx...",
  whatsappPhoneNumber: "+15559876543",

  // URLs (optional)
  feedbackUrl: "https://...",
  googleRedirectUrl: "https://..."
}
```

### 5. Security Features

1. **Password Input**: Auth tokens are hidden using `type="password"`
2. **JWT Authentication**: All API calls require valid JWT token
3. **Company Isolation**: Each company can only access their own credentials
4. **Server-side Validation**: Backend validates companyId before saving/loading
5. **Firestore Security**: Only authenticated users can read/write their company's data

### 6. User Flow

#### As Admin - First Time Setup

1. Login with Google
2. Navigate to Admin Page (if role is "admin")
3. Scroll to "Twilio SMS Credentials" section
4. Enter:
   - Account SID
   - Auth Token
   - Phone Number
5. Click "Save Credentials"
6. See success message
7. Credentials are now stored permanently in Firestore

#### As Admin - Updating Credentials

1. Navigate to Admin Page
2. Credentials automatically load (fields are pre-filled)
3. Edit any credential field
4. Click "Save Credentials"
5. See success message
6. Updated credentials override previous ones

#### As System - Using Credentials for SMS

1. User triggers SMS send from Dashboard
2. Backend fetches credentials from Firestore:
   ```javascript
   const company = await dbV2.getCompanyById(companyId);
   const { twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = company;
   ```
3. Use fetched credentials to send SMS via Twilio API
4. No hardcoded credentials anywhere in code

### 7. Removed Components

The following were removed as credentials are now managed in AdminPage:

- ❌ `pages/CredentialsPage.tsx` - Separate credentials page (not needed)
- ❌ "Configure Credentials" button in Dashboard (removed)
- ❌ `Page.Credentials` routing in App.tsx (cleaned up but can stay for future use)

### 8. Next Steps (To Complete SMS Integration)

To fully integrate the stored credentials with SMS sending:

#### Update SMS Sending Endpoint

File: `sms-server.js`

```javascript
// OLD - Hardcoded credentials
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// NEW - Fetch from database
app.post("/api/send-sms", authenticateToken, async (req, res) => {
  const { customerId, companyId, message } = req.body;

  // Fetch company credentials from Firestore
  const company = await dbV2.getCompanyById(companyId);

  if (
    !company.twilioAccountSid ||
    !company.twilioAuthToken ||
    !company.twilioPhoneNumber
  ) {
    return res.status(400).json({
      error:
        "Twilio credentials not configured. Please configure in Admin Page.",
    });
  }

  // Create Twilio client with company's credentials
  const twilioClient = twilio(
    company.twilioAccountSid,
    company.twilioAuthToken
  );

  // Send SMS
  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: company.twilioPhoneNumber,
      to: customerPhone,
    });

    res.json({ success: true, messageSid: result.sid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### Update Dashboard Twilio Check

File: `App.tsx`

Instead of checking local state, query database:

```typescript
// OLD
twilioConfigured={Boolean(
  twilioAccountSid && twilioAuthToken && twilioPhoneNumber
)}

// NEW - Fetch from database on mount
const [twilioConfigured, setTwilioConfigured] = useState(false);

useEffect(() => {
  const checkTwilioConfig = async () => {
    const companyId = localStorage.getItem("companyId");
    const token = localStorage.getItem("token");

    const response = await fetch(`/api/company/credentials?companyId=${companyId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      const isConfigured = Boolean(
        data.twilioAccountSid &&
        data.twilioAuthToken &&
        data.twilioPhoneNumber
      );
      setTwilioConfigured(isConfigured);
    }
  };

  checkTwilioConfig();
}, []);
```

### 9. Testing Checklist

#### Admin Page - Save Credentials

- [ ] Navigate to Admin Page
- [ ] See "Twilio SMS Credentials" section
- [ ] Input fields are empty (first time) or pre-filled (subsequent visits)
- [ ] Enter/update credentials:
  - Account SID: `ACxxx...`
  - Auth Token: `xxx...`
  - Phone: `+15551234567`
- [ ] Click "Save Credentials"
- [ ] Button shows "Saving..." with spinner
- [ ] Success message appears: "✓ Credentials saved successfully!"
- [ ] Success message disappears after 3 seconds

#### Admin Page - Load Credentials

- [ ] Navigate away from Admin Page
- [ ] Return to Admin Page
- [ ] Credentials are auto-loaded and fields are pre-filled
- [ ] Auth Token field shows dots (password masked)

#### Database Verification

- [ ] Open Firebase Console → Firestore
- [ ] Navigate to `companies` collection
- [ ] Find your company document
- [ ] Verify fields exist:
  - `twilioAccountSid`
  - `twilioAuthToken`
  - `twilioPhoneNumber`

#### Error Handling

- [ ] Stop backend server
- [ ] Try to save credentials
- [ ] Error message appears
- [ ] Restart backend
- [ ] Try again - should work

### 10. Benefits

✅ **Persistent Storage**: Credentials survive browser refresh, logout, and server restart

✅ **Multi-tenant Safe**: Each company has their own credentials

✅ **Centralized Management**: Only admins can configure credentials

✅ **Secure**: Password inputs, JWT authentication, company isolation

✅ **Override Anytime**: Can edit and re-save credentials at any time

✅ **Production Ready**: No hardcoded credentials in code

✅ **Future Proof**: Easy to add more credential types (WhatsApp, etc.)

## Summary

The credentials management system is now fully integrated into the Admin Page with:

- ✅ Firestore storage
- ✅ API endpoints (GET/POST)
- ✅ Auto-load on mount
- ✅ Save to database
- ✅ Success/error messages
- ✅ Loading states
- ✅ Security (JWT, password masking)
- ✅ Multi-tenant support

Next step: Update SMS sending logic to fetch credentials from database instead of environment variables.
