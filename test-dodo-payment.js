// Test script for Dodo Payment Integration
// Run with: node test-dodo-payment.js

import "dotenv/config";
import axios from "axios";

const DODO_API_KEY = process.env.DODO_API_KEY || "";
const DODO_API_BASE =
  process.env.DODO_API_BASE || "https://test.dodopayments.com";

const PRODUCT_IDS = {
  monthly: process.env.DODO_PRODUCT_STARTER_1M || "pdt_0SaMzoGEsjSCi8t0xd5vN",
  quarterly: process.env.DODO_PRODUCT_GROWTH_3M || "pdt_OsKdNhpmFjOxSkqpwBtXR",
  halfyearly: process.env.DODO_PRODUCT_PRO_6M || "pdt_Blsof767CZTPWreD75zFF",
};

console.log("🧪 Dodo Payment Integration Test\n");
console.log("=".repeat(50));

// Check API key
if (!DODO_API_KEY) {
  console.error("❌ ERROR: DODO_API_KEY not found in .env file!");
  console.log("\n📝 Please add your Dodo API key to .env:");
  console.log("   DODO_API_KEY=your_actual_api_key_here\n");
  process.exit(1);
}

console.log("✅ API Key loaded:", DODO_API_KEY.slice(0, 10) + "...");
console.log("✅ API Base:", DODO_API_BASE);
console.log("\n📦 Product IDs:");
console.log("   Monthly:", PRODUCT_IDS.monthly);
console.log("   Quarterly:", PRODUCT_IDS.quarterly);
console.log("   Half-yearly:", PRODUCT_IDS.halfyearly);

console.log("\n" + "=".repeat(50));
console.log("🚀 Creating test payment session...\n");

const testPlan = "monthly";
const testPrice = 15;

const payload = {
  payment_link: true,
  product_id: PRODUCT_IDS[testPlan],
  quantity: 1,
  customer: {
    email: "test@example.com",
    name: "Test User",
  },
  billing: {
    city: "New York",
    country: "US",
    state: "NY",
    street: "123 Main St",
    zipcode: "10001",
  },
  return_url: "http://localhost:3000/success.html",
  metadata: {
    test: true,
    plan: testPlan,
    price: testPrice,
  },
};

console.log("📤 Request payload:");
console.log(JSON.stringify(payload, null, 2));
console.log("\n⏳ Sending request to Dodo API...\n");

try {
  const response = await axios.post(`${DODO_API_BASE}/subscriptions`, payload, {
    headers: {
      Authorization: `Bearer ${DODO_API_KEY}`,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });

  console.log("✅ SUCCESS! Payment session created.\n");
  console.log("📥 Response:");
  console.log(JSON.stringify(response.data, null, 2));

  const paymentUrl =
    response.data.payment_link ||
    response.data.checkout_url ||
    response.data.url;

  if (paymentUrl) {
    console.log("\n🔗 Payment Link:");
    console.log("   " + paymentUrl);
    console.log(
      "\n💡 You can open this URL in your browser to test the payment flow."
    );
  } else {
    console.log("\n⚠️  Warning: No payment link found in response");
  }

  console.log("\n" + "=".repeat(50));
  console.log("✅ Test completed successfully!");
  console.log("\n🎉 Your Dodo payment integration is working correctly!");
} catch (error) {
  console.log("❌ ERROR: Failed to create payment session\n");

  if (error.response) {
    console.log("📥 Response Status:", error.response.status);
    console.log("📥 Response Data:");
    console.log(JSON.stringify(error.response.data, null, 2));
  } else if (error.request) {
    console.log("📤 Request was sent but no response received");
    console.log("   Error:", error.message);
  } else {
    console.log("   Error:", error.message);
  }

  console.log("\n" + "=".repeat(50));
  console.log("❌ Test failed!");
  console.log("\n🔍 Troubleshooting tips:");
  console.log("   1. Verify your DODO_API_KEY is correct");
  console.log("   2. Check if the product IDs exist in your Dodo dashboard");
  console.log("   3. Ensure your Dodo account is active");
  console.log("   4. Try using the test API: https://test.dodopayments.com");

  process.exit(1);
}
