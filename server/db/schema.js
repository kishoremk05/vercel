// Firestore Schema for Business SaaS
// Collections structure based on requirements

/**
 * COLLECTIONS STRUCTURE:
 *
 * 1. /users/{uid}
 *    - uid (string) - Firebase Auth UID
 *    - email (string)
 *    - name (string)
 *    - role (string) - "admin" | "client"
 *    - companyId (string) - reference to company
 *    - createdAt (timestamp)
 *    - lastLogin (timestamp)
 *
 * 2. /companies/{companyId}
 *    - companyId (string)
 *    - companyName (string)
 *    - adminId (string) - UID of company admin
 *    - status (string) - "active" | "suspended"
 *    - createdAt (timestamp)
 *    - twilioAccountSid (string) - stored credentials
 *    - twilioAuthToken (string)
 *    - twilioPhoneNumber (string)
 *    - whatsappAccessToken (string)
 *    - whatsappPhoneNumberId (string)
 *    - feedbackUrl (string)
 *    - googleRedirectUrl (string)
 *
 * 3. /feedback/{feedbackId}
 *    - feedbackId (string)
 *    - companyId (string)
 *    - userId (string) - client user who owns this
 *    - customerName (string)
 *    - customerPhone (string) - SMS number (not message ID)
 *    - rating (number) - 1-5
 *    - comment (string)
 *    - sentiment (string) - "positive" | "neutral" | "negative"
 *    - source (string) - "sms" | "whatsapp" | "web"
 *    - createdAt (timestamp)
 *    - isAnonymous (boolean) - for negative feedback privacy
 *
 * 4. /messages/{messageId}
 *    - messageId (string)
 *    - companyId (string)
 *    - userId (string)
 *    - to (string) - recipient phone
 *    - from (string) - sender phone
 *    - body (string)
 *    - status (string)
 *    - sentAt (timestamp)
 *    - type (string) - "sms" | "whatsapp"
 *
 * 5. /admin_users/{uid}
 *    - uid (string) - Firebase Auth UID
 *    - email (string)
 *    - name (string)
 *    - role (string) - "superadmin"
 *    - createdAt (timestamp)
 *
 * 6. /admin_settings/global
 *    - supportEmail (string)
 *    - allowedDomains (array)
 */

export const COLLECTIONS = {
  USERS: "users",
  COMPANIES: "companies",
  FEEDBACK: "feedback",
  MESSAGES: "messages",
  ADMIN_USERS: "admin_users",
  ADMIN_SETTINGS: "admin_settings",
};

export const USER_ROLES = {
  ADMIN: "admin",
  CLIENT: "client",
  SUPERADMIN: "superadmin",
};

export const COMPANY_STATUS = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
};

export const SENTIMENT = {
  POSITIVE: "positive",
  NEUTRAL: "neutral",
  NEGATIVE: "negative",
};
