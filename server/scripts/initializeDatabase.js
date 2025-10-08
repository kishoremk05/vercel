/**
 * Database Initialization Script
 *
 * Run this script to initialize your Firestore database with sample data
 * Usage: node server/scripts/initializeDatabase.js
 */

const admin = require("firebase-admin");
const serviceAccount = require("../../firebase-service-account.json");

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function initializeDatabase() {
  console.log("🚀 Starting database initialization...\n");

  try {
    // ==================== CREATE SAMPLE CLIENT ====================
    console.log("📝 Creating sample client...");

    const clientRef = await db.collection("clients").add({
      name: "Test Company Inc.",
      email: "test@company.com",
      auth_uid: "sample_auth_uid_123",
      activity_status: "active",
      created_at: admin.firestore.Timestamp.now(),
    });

    const clientId = clientRef.id;
    console.log(`✅ Client created with ID: ${clientId}\n`);

    // ==================== INITIALIZE CLIENT PROFILE ====================
    console.log("👤 Creating client profile...");

    await db
      .collection("clients")
      .doc(clientId)
      .collection("profile")
      .doc("main")
      .set({
        name: "Test Company Inc.",
        email: "test@company.com",
        last_login: admin.firestore.Timestamp.now(),
        google_auth: false,
      });

    console.log("✅ Profile created\n");

    // ==================== INITIALIZE CLIENT DASHBOARD ====================
    console.log("📊 Creating client dashboard...");

    await db
      .collection("clients")
      .doc(clientId)
      .collection("dashboard")
      .doc("current")
      .set({
        message_count: 0,
        feedback_count: 0,
        negative_feedback_count: 0,
        graph_data: {
          labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          values: [0, 0, 0, 0, 0, 0, 0],
        },
        last_updated: admin.firestore.Timestamp.now(),
      });

    console.log("✅ Dashboard created\n");

    // ==================== CREATE SAMPLE MESSAGES ====================
    console.log("💬 Creating sample messages...");

    const sampleMessages = [
      {
        sms_id: "SM_SAMPLE_001",
        phone_number: "+1234567890",
        message_body:
          "Thank you for your purchase! Rate us: https://example.com/feedback/001",
        status: "delivered",
        sent_at: admin.firestore.Timestamp.now(),
      },
      {
        sms_id: "SM_SAMPLE_002",
        phone_number: "+1234567891",
        message_body:
          "We value your feedback! Click here: https://example.com/feedback/002",
        status: "sent",
        sent_at: admin.firestore.Timestamp.now(),
      },
    ];

    for (const message of sampleMessages) {
      await db
        .collection("clients")
        .doc(clientId)
        .collection("messages")
        .add(message);
    }

    console.log(`✅ Created ${sampleMessages.length} sample messages\n`);

    // ==================== CREATE SAMPLE FEEDBACK ====================
    console.log("💭 Creating sample feedback...");

    const sampleFeedback = [
      {
        sms_id: "SM_SAMPLE_001",
        rating: 5,
        comment: "Excellent service! Very satisfied with my purchase.",
        sentiment: "positive",
        phone_number: "+1234567890",
        created_at: admin.firestore.Timestamp.now(),
      },
      {
        sms_id: "SM_SAMPLE_001",
        rating: 2,
        comment: "Delivery was late and the product had minor issues.",
        sentiment: "negative",
        phone_number: "+1234567892",
        created_at: admin.firestore.Timestamp.now(),
      },
      {
        sms_id: "SM_SAMPLE_002",
        rating: 4,
        comment: "Good overall experience, would recommend.",
        sentiment: "positive",
        phone_number: "+1234567891",
        created_at: admin.firestore.Timestamp.now(),
      },
    ];

    for (const feedback of sampleFeedback) {
      await db
        .collection("clients")
        .doc(clientId)
        .collection("feedback")
        .add(feedback);
    }

    console.log(
      `✅ Created ${sampleFeedback.length} sample feedback entries\n`
    );

    // Update dashboard counters
    await db
      .collection("clients")
      .doc(clientId)
      .collection("dashboard")
      .doc("current")
      .update({
        message_count: sampleMessages.length,
        feedback_count: sampleFeedback.length,
        negative_feedback_count: sampleFeedback.filter(
          (f) => f.sentiment === "negative"
        ).length,
        last_updated: admin.firestore.Timestamp.now(),
      });

    // ==================== CREATE ADMIN USER ====================
    console.log("👑 Creating admin user...");

    const adminRef = await db.collection("admins").add({
      name: "Super Admin",
      email: "admin@saasplatform.com",
      auth_uid: "admin_auth_uid_123",
      role: "super-admin",
      created_at: admin.firestore.Timestamp.now(),
    });

    const adminId = adminRef.id;
    console.log(`✅ Admin created with ID: ${adminId}\n`);

    // ==================== CREATE ADMIN CREDENTIALS ====================
    console.log("🔐 Creating admin credentials...");

    await db
      .collection("admins")
      .doc(adminId)
      .collection("settings")
      .doc("credentials")
      .set({
        twilio_account_sid: "YOUR_TWILIO_ACCOUNT_SID",
        twilio_auth_token: "YOUR_TWILIO_AUTH_TOKEN",
        twilio_phone_number: "+1234567890",
        updated_at: admin.firestore.Timestamp.now(),
      });

    console.log("✅ Credentials created\n");

    // ==================== INITIALIZE ADMIN DASHBOARD ====================
    console.log("📈 Creating admin dashboard...");

    await db
      .collection("admin_dashboard")
      .doc("aggregates")
      .set({
        total_message_count: sampleMessages.length,
        total_feedback_count: sampleFeedback.length,
        total_negative_feedback_count: sampleFeedback.filter(
          (f) => f.sentiment === "negative"
        ).length,
        active_clients_count: 1,
        last_updated: admin.firestore.Timestamp.now(),
      });

    console.log("✅ Admin dashboard created\n");

    // ==================== CREATE SAMPLE LOG ====================
    console.log("📝 Creating sample admin log...");

    await db.collection("admin_logs").add({
      action: "initialize_database",
      performed_by: adminId,
      target_client: clientId,
      details: {
        message: "Database initialized with sample data",
        timestamp: new Date().toISOString(),
      },
      created_at: admin.firestore.Timestamp.now(),
    });

    console.log("✅ Log created\n");

    // ==================== SUMMARY ====================
    console.log("🎉 Database initialization completed successfully!\n");
    console.log("📋 Summary:");
    console.log(`   - Client ID: ${clientId}`);
    console.log(`   - Admin ID: ${adminId}`);
    console.log(`   - Messages created: ${sampleMessages.length}`);
    console.log(`   - Feedback entries: ${sampleFeedback.length}`);
    console.log("\n✨ Your Firestore database is ready to use!\n");
  } catch (error) {
    console.error("❌ Error initializing database:", error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the initialization
initializeDatabase();
