/**
 * Firestore Database Setup Script
 * This script creates the complete database structure with sample data
 * Run: node server/scripts/setupFirestore.js
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, "../../firebase-service-account2.json"), "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "feedback-saas-55009",
});

const db = admin.firestore();

console.log("🚀 Starting Firestore Database Setup...\n");

/**
 * Step 1: Create Root Collections and Sample Client
 */
async function createClientsCollection() {
  console.log("📦 Step 1: Creating clients collection...");

  const clientRef = db.collection("clients").doc("client_001");

  await clientRef.set({
    name: "Test Company",
    email: "test@company.com",
    auth_uid: "sample_firebase_uid_123",
    activity_status: "active",
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log("   ✅ Created client: client_001 (Test Company)");
  return clientRef;
}

/**
 * Step 2: Create Profile Subcollection
 */
async function createProfileSubcollection(clientRef) {
  console.log("\n📦 Step 2: Creating profile subcollection...");

  await clientRef.collection("profile").doc("main").set({
    name: "Test Company",
    email: "test@company.com",
    phone: "+1234567890",
    company_name: "Test Company Inc.",
    industry: "Technology",
    company_size: "10-50",
    website: "https://testcompany.com",
    address: "123 Main St, City, State 12345",
    timezone: "America/New_York",
    last_login: admin.firestore.FieldValue.serverTimestamp(),
    google_auth: false,
  });

  console.log("   ✅ Created profile document");
}

/**
 * Step 3: Create Dashboard Subcollection
 */
async function createDashboardSubcollection(clientRef) {
  console.log("\n📦 Step 3: Creating dashboard subcollection...");

  await clientRef
    .collection("dashboard")
    .doc("current")
    .set({
      message_count: 0,
      feedback_count: 0,
      negative_feedback_count: 0,
      positive_feedback_count: 0,
      neutral_feedback_count: 0,
      graph_data: {
        labels: [],
        negative: [],
        positive: [],
        neutral: [],
      },
      last_updated: admin.firestore.FieldValue.serverTimestamp(),
    });

  console.log("   ✅ Created dashboard/current document");
}

/**
 * Step 4: Create Sample Messages
 */
async function createMessagesSubcollection(clientRef) {
  console.log("\n📦 Step 4: Creating messages subcollection...");

  const messages = [
    {
      sms_id: "SM1234567890abcdef",
      phone_number: "+1234567890",
      message_body:
        "Thank you for your recent purchase! How was your experience?",
      status: "delivered",
      sent_at: admin.firestore.FieldValue.serverTimestamp(),
      twilio_status: "delivered",
      error_code: null,
      error_message: null,
    },
    {
      sms_id: "SM0987654321fedcba",
      phone_number: "+0987654321",
      message_body: "We value your feedback. Please rate your experience.",
      status: "sent",
      sent_at: admin.firestore.FieldValue.serverTimestamp(),
      twilio_status: "sent",
      error_code: null,
      error_message: null,
    },
  ];

  for (const message of messages) {
    await clientRef.collection("messages").add(message);
  }

  console.log(`   ✅ Created ${messages.length} sample messages`);
}

/**
 * Step 5: Create Sample Feedback
 */
async function createFeedbackSubcollection(clientRef) {
  console.log("\n📦 Step 5: Creating feedback subcollection...");

  const feedbacks = [
    {
      sms_id: "SM1234567890abcdef",
      phone_number: "+1234567890",
      message_body: "Great service! Very satisfied.",
      sentiment: "positive",
      sentiment_score: 0.85,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      admin_reply: null,
      admin_replied_at: null,
      status: "new",
    },
    {
      sms_id: "SM0987654321fedcba",
      phone_number: "+0987654321",
      message_body: "The service was terrible. Very disappointed.",
      sentiment: "negative",
      sentiment_score: -0.75,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      admin_reply: null,
      admin_replied_at: null,
      status: "new",
    },
    {
      sms_id: "SM1122334455667788",
      phone_number: "+1122334455",
      message_body: "It was okay, nothing special.",
      sentiment: "neutral",
      sentiment_score: 0.1,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      admin_reply: null,
      admin_replied_at: null,
      status: "new",
    },
  ];

  for (const feedback of feedbacks) {
    await clientRef.collection("feedback").add(feedback);
  }

  console.log(`   ✅ Created ${feedbacks.length} sample feedback items`);
}

/**
 * Step 6: Create Messenger Subcollection
 */
async function createMessengerSubcollection(clientRef) {
  console.log("\n📦 Step 6: Creating messenger subcollection...");

  const conversations = [
    {
      phone_number: "+1234567890",
      customer_name: "John Doe",
      last_message: "Great service! Very satisfied.",
      last_message_time: admin.firestore.FieldValue.serverTimestamp(),
      unread_count: 1,
      conversation_status: "active",
    },
    {
      phone_number: "+0987654321",
      customer_name: "Jane Smith",
      last_message: "The service was terrible.",
      last_message_time: admin.firestore.FieldValue.serverTimestamp(),
      unread_count: 2,
      conversation_status: "active",
    },
  ];

  for (const conversation of conversations) {
    const convRef = await clientRef.collection("messenger").add(conversation);

    // Add message history
    await convRef.collection("messages").add({
      message_body: conversation.last_message,
      direction: "inbound",
      sent_at: admin.firestore.FieldValue.serverTimestamp(),
      read: false,
    });
  }

  console.log(`   ✅ Created ${conversations.length} messenger conversations`);
}

/**
 * Step 7: Create Admins Collection
 */
async function createAdminsCollection() {
  console.log("\n📦 Step 7: Creating admins collection...");

  const adminRef = db.collection("admins").doc("admin_001");

  await adminRef.set({
    name: "System Admin",
    email: "admin@feedbacksaas.com",
    auth_uid: "admin_firebase_uid_456",
    role: "super_admin",
    permissions: [
      "manage_clients",
      "view_analytics",
      "manage_admins",
      "system_settings",
    ],
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    last_login: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log("   ✅ Created admin: admin_001 (System Admin)");

  // Add settings subcollection
  await adminRef.collection("settings").doc("credentials").set({
    twilio_account_sid: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    twilio_auth_token: "your_auth_token_here",
    twilio_phone_number: "+1234567890",
    smtp_host: "smtp.gmail.com",
    smtp_port: 587,
    smtp_user: "your-email@gmail.com",
    smtp_password: "your-app-password",
    openai_api_key: "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log("   ✅ Created admin settings/credentials");
}

/**
 * Step 8: Create Admin Dashboard Collection
 */
async function createAdminDashboardCollection() {
  console.log("\n📦 Step 8: Creating admin_dashboard collection...");

  await db.collection("admin_dashboard").doc("aggregates").set({
    total_clients: 1,
    active_clients: 1,
    total_messages_sent: 2,
    total_feedback_received: 3,
    positive_feedback_count: 1,
    negative_feedback_count: 1,
    neutral_feedback_count: 1,
    average_sentiment_score: 0.07,
    last_updated: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log("   ✅ Created admin_dashboard/aggregates");
}

/**
 * Step 9: Create Admin Logs Collection
 */
async function createAdminLogsCollection() {
  console.log("\n📦 Step 9: Creating admin_logs collection...");

  const logs = [
    {
      admin_id: "admin_001",
      admin_email: "admin@feedbacksaas.com",
      action: "client_created",
      description: "Created new client: Test Company",
      affected_client_id: "client_001",
      ip_address: "192.168.1.1",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      admin_id: "admin_001",
      admin_email: "admin@feedbacksaas.com",
      action: "settings_updated",
      description: "Updated Twilio credentials",
      affected_client_id: null,
      ip_address: "192.168.1.1",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
  ];

  for (const log of logs) {
    await db.collection("admin_logs").add(log);
  }

  console.log(`   ✅ Created ${logs.length} admin log entries`);
}

/**
 * Step 10: Update Client Dashboard Counters
 */
async function updateDashboardCounters() {
  console.log("\n📦 Step 10: Updating dashboard counters...");

  const clientRef = db.collection("clients").doc("client_001");
  const dashboardRef = clientRef.collection("dashboard").doc("current");

  await dashboardRef.update({
    message_count: 2,
    feedback_count: 3,
    positive_feedback_count: 1,
    negative_feedback_count: 1,
    neutral_feedback_count: 1,
    last_updated: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log("   ✅ Updated dashboard counters");
}

/**
 * Main Setup Function
 */
async function setupDatabase() {
  try {
    // Step 1: Create client
    const clientRef = await createClientsCollection();

    // Step 2-6: Create client subcollections
    await createProfileSubcollection(clientRef);
    await createDashboardSubcollection(clientRef);
    await createMessagesSubcollection(clientRef);
    await createFeedbackSubcollection(clientRef);
    await createMessengerSubcollection(clientRef);

    // Step 7-9: Create admin collections
    await createAdminsCollection();
    await createAdminDashboardCollection();
    await createAdminLogsCollection();

    // Step 10: Update counters
    await updateDashboardCounters();

    console.log("\n✅ Database setup completed successfully!");
    console.log("\n📊 Summary:");
    console.log("   • 1 Client created (Test Company)");
    console.log("   • 5 Subcollections per client");
    console.log("   • 2 Sample messages");
    console.log("   • 3 Sample feedback items");
    console.log("   • 2 Messenger conversations");
    console.log("   • 1 Admin user created");
    console.log("   • Admin settings configured");
    console.log("   • Dashboard aggregates initialized");
    console.log("   • 2 Admin logs created");

    console.log("\n🔍 Next Steps:");
    console.log("   1. Go to Firebase Console → Firestore Database");
    console.log("   2. Verify all collections are created");
    console.log("   3. Set up composite indexes (see FIRESTORE_INDEXES.md)");
    console.log(
      "   4. Deploy security rules: firebase deploy --only firestore:rules"
    );
    console.log(
      "   5. Update admin credentials in settings/credentials document"
    );

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error setting up database:", error);
    console.error("\nStack trace:", error.stack);
    process.exit(1);
  }
}

// Run the setup
setupDatabase();
