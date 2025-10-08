// New Data Access Layer - matches your requirements
import { firestore } from "./firebaseAdmin.js";
import {
  COLLECTIONS,
  USER_ROLES,
  COMPANY_STATUS,
  SENTIMENT,
} from "./schema.js";

// ==================== USERS ====================

/**
 * Create or update a user record
 */
export async function upsertUser({
  uid,
  email,
  name,
  role = USER_ROLES.CLIENT,
  companyId,
}) {
  if (!firestore) throw new Error("Firestore not initialized");

  const userRef = firestore.collection(COLLECTIONS.USERS).doc(uid);
  const now = new Date();

  const userData = {
    uid,
    email,
    name,
    role,
    companyId,
    lastLogin: now,
  };

  const existingUser = await userRef.get();
  if (!existingUser.exists) {
    userData.createdAt = now;
  }

  await userRef.set(userData, { merge: true });

  return { id: uid, ...userData };
}

/**
 * Get user by UID
 */
export async function getUserById(uid) {
  if (!firestore) throw new Error("Firestore not initialized");

  const doc = await firestore.collection(COLLECTIONS.USERS).doc(uid).get();
  if (!doc.exists) return null;

  return { id: doc.id, ...doc.data() };
}

/**
 * Get user by email
 */
export async function getUserByEmail(email) {
  if (!firestore) throw new Error("Firestore not initialized");

  const snapshot = await firestore
    .collection(COLLECTIONS.USERS)
    .where("email", "==", email)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

// ==================== COMPANIES ====================

/**
 * Create a new company
 */
export async function createCompany({ companyName, adminId, email }) {
  if (!firestore) throw new Error("Firestore not initialized");

  const companyRef = firestore.collection(COLLECTIONS.COMPANIES).doc();
  const companyId = companyRef.id;

  const companyData = {
    companyId,
    companyName,
    adminId,
    status: COMPANY_STATUS.ACTIVE,
    createdAt: new Date(),
    // Credentials (initially empty, set later via profile/settings)
    twilioAccountSid: "",
    twilioAuthToken: "",
    twilioPhoneNumber: "",
    whatsappAccessToken: "",
    whatsappPhoneNumberId: "",
    feedbackUrl: "",
    googleRedirectUrl: "",
  };

  await companyRef.set(companyData);

  return { id: companyId, ...companyData };
}

/**
 * Get company by ID
 */
export async function getCompanyById(companyId) {
  if (!firestore) throw new Error("Firestore not initialized");

  const doc = await firestore
    .collection(COLLECTIONS.COMPANIES)
    .doc(companyId)
    .get();
  if (!doc.exists) return null;

  return { id: doc.id, ...doc.data() };
}

/**
 * Update company credentials (Twilio, WhatsApp, URLs)
 */
export async function updateCompanyCredentials(companyId, credentials) {
  if (!firestore) throw new Error("Firestore not initialized");

  const companyRef = firestore.collection(COLLECTIONS.COMPANIES).doc(companyId);
  // Use set with merge to create the doc if it doesn't exist and merge fields
  await companyRef.set(credentials, { merge: true });

  const updated = await companyRef.get();
  return { id: updated.id, ...updated.data() };
}

/**
 * Get all companies (for admin view)
 */
export async function getAllCompanies() {
  if (!firestore) throw new Error("Firestore not initialized");

  const snapshot = await firestore.collection(COLLECTIONS.COMPANIES).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// ==================== FEEDBACK ====================

/**
 * Store feedback with SMS number (not message ID)
 */
export async function insertFeedback({
  companyId,
  userId,
  customerName,
  customerPhone, // SMS number
  rating,
  comment,
  sentiment,
  source = "sms",
  isAnonymous = false,
}) {
  if (!firestore) throw new Error("Firestore not initialized");

  const feedbackRef = firestore.collection(COLLECTIONS.FEEDBACK).doc();

  const feedbackData = {
    feedbackId: feedbackRef.id,
    companyId,
    customerPhone: customerPhone || "", // Store SMS number for negative comments
    rating: rating || 0,
    comment: comment || "",
    sentiment,
    source,
    isAnonymous, // True for negative feedback (privacy)
    createdAt: new Date(),
  };

  // Only add optional fields if they're defined
  if (userId !== undefined && userId !== null) {
    feedbackData.userId = userId;
  }
  if (customerName !== undefined && customerName !== null) {
    feedbackData.customerName = customerName;
  }

  await feedbackRef.set(feedbackData);

  return { id: feedbackRef.id, ...feedbackData };
}

/**
 * Get feedback for a specific company
 */
export async function getFeedbackByCompany(companyId, options = {}) {
  if (!firestore) throw new Error("Firestore not initialized");

  let query = firestore
    .collection(COLLECTIONS.FEEDBACK)
    .where("companyId", "==", companyId);

  // Filter by sentiment if provided
  if (options.sentiment) {
    query = query.where("sentiment", "==", options.sentiment);
  }

  // Filter by date if provided
  if (options.since) {
    const sinceDate = new Date(options.since);
    if (!isNaN(sinceDate.getTime())) {
      query = query.where("createdAt", ">=", sinceDate);
    }
  }

  query = query.orderBy("createdAt", "desc");

  const limit = options.limit || 100;
  query = query.limit(limit);

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get feedback stats for dashboard (message count, ratings, feedback count)
 */
export async function getFeedbackStats(companyId) {
  if (!firestore) throw new Error("Firestore not initialized");

  const snapshot = await firestore
    .collection(COLLECTIONS.FEEDBACK)
    .where("companyId", "==", companyId)
    .get();

  const feedbacks = snapshot.docs.map((doc) => doc.data());

  const totalCount = feedbacks.length;
  const avgRating =
    feedbacks.length > 0
      ? feedbacks.reduce((sum, f) => sum + (f.rating || 0), 0) /
        feedbacks.length
      : 0;

  const sentimentCounts = {
    positive: feedbacks.filter((f) => f.sentiment === SENTIMENT.POSITIVE)
      .length,
    neutral: feedbacks.filter((f) => f.sentiment === SENTIMENT.NEUTRAL).length,
    negative: feedbacks.filter((f) => f.sentiment === SENTIMENT.NEGATIVE)
      .length,
  };

  return {
    totalCount,
    avgRating: Math.round(avgRating * 10) / 10,
    sentimentCounts,
  };
}

/**
 * Get all feedback (for admin view)
 */
export async function getAllFeedback(limit = 500) {
  if (!firestore) throw new Error("Firestore not initialized");

  const snapshot = await firestore
    .collection(COLLECTIONS.FEEDBACK)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// ==================== MESSAGES ====================

/**
 * Store sent message
 */
export async function insertMessage({
  companyId,
  userId,
  to,
  from,
  body,
  status,
  type = "sms",
}) {
  if (!firestore) throw new Error("Firestore not initialized");

  const messageRef = firestore.collection(COLLECTIONS.MESSAGES).doc();

  const messageData = {
    messageId: messageRef.id,
    companyId,
    userId,
    to,
    from,
    body,
    status,
    type,
    sentAt: new Date(),
  };

  await messageRef.set(messageData);

  return { id: messageRef.id, ...messageData };
}

/**
 * Get messages for a company
 */
export async function getMessagesByCompany(companyId, limit = 100) {
  if (!firestore) throw new Error("Firestore not initialized");

  const snapshot = await firestore
    .collection(COLLECTIONS.MESSAGES)
    .where("companyId", "==", companyId)
    .orderBy("sentAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get message count for a company
 */
export async function getMessageCount(companyId) {
  if (!firestore) throw new Error("Firestore not initialized");

  const snapshot = await firestore
    .collection(COLLECTIONS.MESSAGES)
    .where("companyId", "==", companyId)
    .get();

  return snapshot.size;
}

// ==================== ADMIN ====================

/**
 * Get global stats (for admin dashboard)
 */
export async function getGlobalStats() {
  if (!firestore) throw new Error("Firestore not initialized");

  const [companiesSnap, usersSnap, feedbackSnap, messagesSnap] =
    await Promise.all([
      firestore.collection(COLLECTIONS.COMPANIES).get(),
      firestore.collection(COLLECTIONS.USERS).get(),
      firestore.collection(COLLECTIONS.FEEDBACK).get(),
      firestore.collection(COLLECTIONS.MESSAGES).get(),
    ]);

  // Aggregate total message_count from all clients' dashboard/current documents
  let totalMessagesFromDashboards = 0;
  try {
    const clientsSnap = await firestore.collection("clients").get();
    const dashboardPromises = clientsSnap.docs.map(async (clientDoc) => {
      try {
        const dashboardDoc = await firestore
          .collection("clients")
          .doc(clientDoc.id)
          .collection("dashboard")
          .doc("current")
          .get();
        if (dashboardDoc.exists) {
          const data = dashboardDoc.data();
          return Number(data?.message_count || 0);
        }
        return 0;
      } catch (err) {
        console.warn(
          `Failed to read dashboard for client ${clientDoc.id}:`,
          err.message
        );
        return 0;
      }
    });
    const counts = await Promise.all(dashboardPromises);
    totalMessagesFromDashboards = counts.reduce((sum, count) => sum + count, 0);
    console.log(
      `[getGlobalStats] ✅ Aggregated ${totalMessagesFromDashboards} total messages from ${clientsSnap.size} clients' dashboards`
    );
  } catch (err) {
    console.error(
      "[getGlobalStats] Failed to aggregate dashboard message counts:",
      err.message
    );
    // Fallback to legacy messages collection count if dashboard aggregation fails
    totalMessagesFromDashboards = messagesSnap.size;
  }

  return {
    totalCompanies: companiesSnap.size,
    totalUsers: usersSnap.size,
    totalFeedback: feedbackSnap.size,
    totalMessages: totalMessagesFromDashboards, // Use aggregated dashboard counts
  };
}

/**
 * Get all users with their company info (for admin view)
 */
export async function getAllUsersWithCompanies() {
  if (!firestore) throw new Error("Firestore not initialized");

  const usersSnap = await firestore.collection(COLLECTIONS.USERS).get();
  const users = usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // Get company info and profile data for each user
  const usersWithCompanies = await Promise.all(
    users.map(async (user) => {
      let company = null;
      let profile = null;

      if (user.companyId) {
        // Get company data
        company = await getCompanyById(user.companyId);

        // Get profile data from clients/{companyId}/profile/main
        try {
          const profileDoc = await firestore
            .collection("clients")
            .doc(user.companyId)
            .collection("profile")
            .doc("main")
            .get();

          if (profileDoc.exists) {
            const profileData = profileDoc.data();
            // Map 'name' field to 'businessName' for consistency with frontend
            profile = {
              ...profileData,
              businessName: profileData.name || profileData.businessName || "",
            };
          }
        } catch (profileErr) {
          console.warn(
            `Could not fetch profile for company ${user.companyId}:`,
            profileErr.message
          );
        }

        return { ...user, company, profile };
      }
      return user;
    })
  );

  return usersWithCompanies;
}

// ==================== ADMIN SETTINGS (GLOBAL) ====================

/**
 * Get global admin settings, including shared credentials.
 */
export async function getGlobalAdminSettings() {
  if (!firestore) throw new Error("Firestore not initialized");

  // Try new structure first: admin_settings/global
  let doc = await firestore
    .collection(COLLECTIONS.ADMIN_SETTINGS)
    .doc("global")
    .get();

  if (doc.exists) {
    return { id: doc.id, ...doc.data() };
  }

  // Fallback: Try old structure: admins/admin_001/settings/credentials
  try {
    const adminDoc = await firestore
      .collection("admins")
      .doc("admin_001")
      .get();

    if (adminDoc.exists) {
      const settingsDoc = await firestore
        .collection("admins")
        .doc("admin_001")
        .collection("settings")
        .doc("credentials")
        .get();

      if (settingsDoc.exists) {
        const data = settingsDoc.data();
        // Map old structure to new structure
        return {
          id: "global",
          twilio: {
            accountSid: data.twilio_account_sid || "",
            authToken: data.twilio_auth_token || "",
            phoneNumber: data.twilio_phone_number || "",
            messagingServiceSid: data.twilio_messaging_service_sid || "",
          },
          feedbackUrls: {
            feedbackPageUrl: data.feedback_url || "",
            googleReviewUrl: data.google_review_url || "",
          },
        };
      }
    }
  } catch (err) {
    console.warn("[dataV2] Error reading old admin structure:", err);
  }

  return {};
}

/**
 * Update global admin settings (Twilio/WhatsApp credentials, URLs, etc.).
 */
export async function updateGlobalAdminSettings(patch) {
  if (!firestore) throw new Error("Firestore not initialized");

  // Save to new structure: admin_settings/global
  const ref = firestore.collection(COLLECTIONS.ADMIN_SETTINGS).doc("global");
  await ref.set({ ...patch, updatedAt: new Date() }, { merge: true });

  // Also save to old structure for backward compatibility
  try {
    const credentialsRef = firestore
      .collection("admins")
      .doc("admin_001")
      .collection("settings")
      .doc("credentials");

    const oldFormatData = {};

    // Map twilio settings
    if (patch.twilio) {
      if (patch.twilio.accountSid)
        oldFormatData.twilio_account_sid = patch.twilio.accountSid;
      if (patch.twilio.authToken)
        oldFormatData.twilio_auth_token = patch.twilio.authToken;
      if (patch.twilio.phoneNumber)
        oldFormatData.twilio_phone_number = patch.twilio.phoneNumber;
      if (patch.twilio.messagingServiceSid)
        oldFormatData.twilio_messaging_service_sid =
          patch.twilio.messagingServiceSid;
    }

    // Map feedback URLs
    if (patch.feedbackUrls) {
      if (patch.feedbackUrls.feedbackPageUrl)
        oldFormatData.feedback_url = patch.feedbackUrls.feedbackPageUrl;
      if (patch.feedbackUrls.googleReviewUrl)
        oldFormatData.google_review_url = patch.feedbackUrls.googleReviewUrl;
    }

    oldFormatData.updated_at = new Date();

    await credentialsRef.set(oldFormatData, { merge: true });
    console.log(
      "[dataV2] ✅ Saved to both admin_settings/global and admins/admin_001/settings/credentials"
    );
  } catch (err) {
    console.warn("[dataV2] ⚠️ Failed to save to old structure:", err);
  }

  const updated = await ref.get();
  return { id: updated.id, ...updated.data() };
}
