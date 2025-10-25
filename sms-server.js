// SMS + WhatsApp Cloud API Server
// Usage: node sms-server.js
// NOTE: Move TWILIO_* secrets into environment variables in production.

import "dotenv/config";
import fetch from "node-fetch";
import express from "express";
import cors from "cors";
import twilio from "twilio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- EXPRESS APP SETUP ---
let app = global.__APP_INSTANCE__ || express();
global.__APP_INSTANCE__ = app; // safeguard against double import in dev with ESM
app.use(express.json()); // <-- Ensure JSON body parsing for all routes

// ------------------------------------------------------------
// Twilio Global Client (optional env-based)
// ------------------------------------------------------------
// Some routes referenced an undeclared variable `twilioClient`, causing a
// ReferenceError. We define it here and lazily initialize from env if possible.
// Per-request overrides (accountSid/authToken/company credentials) will still
// create their own client instances when needed.
let twilioClient = null;
try {
  const envSid = process.env.TWILIO_ACCOUNT_SID;
  const envToken = process.env.TWILIO_AUTH_TOKEN;
  if (envSid && envToken) {
    twilioClient = twilio(envSid, envToken);
    console.log(
      "[twilio:init] ✅ Global Twilio client initialized from environment variables"
    );
  } else {
    console.log(
      "[twilio:init] ℹ️ No env credentials found (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN); will rely on per-request credentials"
    );
  }
} catch (e) {
  console.warn(
    "[twilio:init] ⚠️ Failed to initialize global client:",
    e.message || e
  );
}

// ------------------------------------------------------------
// Helper: Direct Twilio REST API send (HTTP basic auth) when SDK fails
// ------------------------------------------------------------
async function sendSmsViaTwilioHttp({
  accountSid,
  authToken,
  from,
  to,
  body,
  statusCallback,
}) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
    String(accountSid)
  )}/Messages.json`;
  const params = new URLSearchParams();
  if (from) params.set("From", String(from));
  params.set("To", String(to));
  params.set("Body", String(body));
  if (statusCallback) params.set("StatusCallback", String(statusCallback));
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const message = data?.message || JSON.stringify(data);
    const code = data?.code;
    throw Object.assign(new Error(message || "Twilio HTTP error"), { code });
  }
  return data; // includes sid, status, etc.
}

// ------------------------------------------------------------
// Firebase Admin SDK & Database Initialization
// ------------------------------------------------------------
let firebaseAdmin = null;
let db = null;
let dbV2 = null;
let firestoreEnabled = false;
let firebaseProjectId = null;

try {
  const adminModule = await import("firebase-admin");
  firebaseAdmin = adminModule.default;

  const candidateFiles = [
    "firebase-service-account.json",
    "firebase-service-account1.json",
    "firebase-service-account2.json",
  ].map((f) => path.join(__dirname, f));

  // Allow providing Firebase service account JSON via env var for platforms
  // that do not support files in the repo (e.g., Render). If FIREBASE_ADMIN_JSON
  // is set, parse it and initialize admin SDK from it.
  const envCreds = process.env.FIREBASE_ADMIN_JSON || null;
  let serviceAccountPath = null;
  try {
    if (envCreds) {
      const parsed = JSON.parse(envCreds);
      if (!firebaseAdmin.apps.length) {
        firebaseAdmin.initializeApp({
          credential: firebaseAdmin.credential.cert(parsed),
        });
      }
      firestoreEnabled = true;
      firebaseProjectId = parsed.project_id;
      console.log(
        `[firebase] Initialized admin SDK from FIREBASE_ADMIN_JSON env for project: ${firebaseProjectId}`
      );
      // try to load DB helpers
      try {
        db = await import("./server/db/data.js");
      } catch {}
      try {
        const mod = await import("./server/db/dataV2.js");
        dbV2 = mod.default || mod;
      } catch (e) {
        console.warn("[firebase] dbV2 load failed", e.message);
      }
    } else {
      serviceAccountPath = candidateFiles.find((p) => fs.existsSync(p));
      console.log(
        "[firebase:init] Candidate service account files:",
        candidateFiles
      );
      console.log(
        "[firebase:init] Existence map:",
        candidateFiles.map((p) => ({ path: p, exists: fs.existsSync(p) }))
      );
      if (serviceAccountPath) {
        try {
          const serviceAccount = JSON.parse(
            fs.readFileSync(serviceAccountPath, "utf8")
          );
          if (!firebaseAdmin.apps.length) {
            firebaseAdmin.initializeApp({
              credential: firebaseAdmin.credential.cert(serviceAccount),
            });
          }
          firestoreEnabled = true;
          firebaseProjectId = serviceAccount.project_id;
          console.log(
            `[firebase] Initialized with project: ${firebaseProjectId}`
          );
          // Lazy import DB helpers
          try {
            db = await import("./server/db/data.js");
          } catch {}
          try {
            const mod = await import("./server/db/dataV2.js");
            dbV2 = mod.default || mod;
          } catch (e) {
            console.warn("[firebase] dbV2 load failed", e.message);
          }
        } catch (e) {
          console.error(
            "[firebase] Failed to initialize admin SDK from file",
            e.message || e
          );
        }
      } else {
        console.warn(
          "[firebase] Service account file not found and FIREBASE_ADMIN_JSON not set; running with firestore disabled"
        );
      }
    }
  } catch (e) {
    console.error("[firebase] Initialization error:", e.message || e);
  }

  // Create Express app (lost during merge corruption)
  app = global.__APP_INSTANCE__ || express();
  global.__APP_INSTANCE__ = app; // safeguard against double import in dev with ESM

  // CORS configuration: allow a comma-separated list via CORS_ORIGINS env var
  // Example: CORS_ORIGINS=https://app.vercel.app,https://admin.example.com
  const corsOrigins = (
    process.env.CORS_ORIGINS ||
    "http://localhost:5173,https://vercel-swart-chi-29.vercel.app,https://*.vercel.app"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (corsOrigins.length > 0) {
    console.log("[cors] Restricting origins to:", corsOrigins);
    const patterns = corsOrigins.map((o) => o.trim()).filter(Boolean);
    const hasStar = patterns.includes("*");
    function matches(origin) {
      if (hasStar) return true;
      if (patterns.includes(origin)) return true; // exact
      for (const p of patterns) {
        if (p.startsWith("*.")) {
          const suffix = p.slice(1); // includes leading '.'
          if (origin.endsWith(suffix)) return true;
        }
      }
      return false;
    }
    app.use(
      cors({
        origin: (origin, cb) => {
          try {
            if (!origin) {
              console.log("[cors] No origin header (server/CURL) - allowing");
              return cb(null, true);
            }
            const allowed = matches(origin);
            console.log("[cors] Origin check:", { origin, allowed, patterns });
            if (allowed) return cb(null, true);
            return cb(new Error("CORS policy: origin not allowed"), false);
          } catch (err) {
            console.warn("[cors] Origin check failed", err?.message || err);
            return cb(new Error("CORS policy: origin check error"), false);
          }
        },
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: [
          "Authorization",
          "Content-Type",
          "Accept",
          "X-Requested-With",
          // admin-specific header used by admin routes
          "x-admin-uid",
          "x-company-id",
          "x-client-id",
          "x-user-email",
          "x-plan-id",
          "x-plan",
          "x-price",
          "x-amount",
          "x-session-id",
          "x-subscription-id",
        ],
        credentials: false,
        optionsSuccessStatus: 200,
        maxAge: 86400,
      })
    );
    app.options("/*", cors());
  } else {
    console.log(
      "[cors] No CORS_ORIGINS configured - allowing all origins (dev mode)"
    );
    app.use(cors());
    app.options("/*", cors());
  }

  // Defensive CORS header middleware: ensure Access-Control-Allow-Origin is present
  // for allowed origins (some platforms/proxies may strip CORS headers unexpectedly).
  try {
    const patterns = (process.env.CORS_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const hasStar = patterns.includes("*");
    const matchesOrigin = (origin) => {
      if (!origin) return false;
      if (hasStar) return true;
      if (patterns.includes(origin)) return true;
      for (const p of patterns) {
        if (p.startsWith("*.")) {
          const suffix = p.slice(1);
          if (origin.endsWith(suffix)) return true;
        }
      }
      return false;
    };
    app.use((req, res, next) => {
      try {
        const origin = req.headers.origin;
        if (origin && matchesOrigin(origin)) {
          res.setHeader("Access-Control-Allow-Origin", origin);
          res.setHeader("Vary", "Origin");
        }
      } catch (e) {
        // ignore
      }
      next();
    });
  } catch (e) {
    console.warn("[cors] defensive middleware setup failed", e?.message || e);
  }

  // Universal preflight responder (fallback):
  // Some frontends (e.g., static hosts) require permissive CORS even when upstream proxies intervene.
  // This middleware mirrors Origin and responds to OPTIONS early to avoid CORS errors.
  app.use((req, res, next) => {
    try {
      const origin = req.headers.origin;
      if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
      }
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS"
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type, Accept, X-Requested-With, x-admin-uid, x-company-id, x-client-id, x-user-email, x-plan-id, x-plan, x-price, x-amount, x-session-id, x-subscription-id"
      );
      res.setHeader("Access-Control-Max-Age", "86400");
      if (req.method === "OPTIONS") {
        return res.status(204).end();
      }
    } catch {}
    next();
  });

  // CRITICAL: Use express.json with verify to capture raw body
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, res, buf, encoding) => {
        req.rawBody = buf.toString(encoding || "utf8");
      },
    })
  );
  // Also accept urlencoded/form submissions (some clients may send form data)
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // Lightweight health/readiness endpoints for hosting platforms
  app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));
  app.get("/ready", (req, res) =>
    res
      .status(200)
      .json({ ready: firestoreEnabled ? "firestore" : "no-firestore" })
  );

  // --- Account Deletion Endpoint ---
  // Securely deletes all Firestore data for a user/company (clients/{uid}, subcollections, and optionally users/companies)
  app.delete("/api/account/delete", async (req, res) => {
    try {
      if (!firestoreEnabled) {
        return res
          .status(503)
          .json({ success: false, error: "firestore-disabled" });
      }
      const { companyId, auth_uid, userEmail } = req.body || {};
      // Accept companyId/auth_uid from headers as fallback
      const cid =
        companyId ||
        req.headers["x-company-id"] ||
        req.headers["x-client-id"] ||
        null;
      const uid = auth_uid || req.headers["x-auth-uid"] || null;
      // Optionally verify Firebase ID token for security
      let verifiedUid = null;
      try {
        const authz =
          req.headers.authorization || req.headers.Authorization || "";
        if (authz && String(authz).startsWith("Bearer ") && firebaseAdmin) {
          const idToken = String(authz).slice(7).trim();
          if (idToken) {
            const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
            verifiedUid = decoded?.uid || decoded?.sub || null;
          }
        }
      } catch (e) {
        // Ignore token errors, but prefer verifiedUid if available
      }
      // Use verifiedUid if present
      const targetUid = verifiedUid || uid;
      const firestore = firebaseAdmin.firestore();
      // Helper to recursively delete all subcollections
      async function deleteCollectionRecursive(ref) {
        const collections = await ref.listCollections();
        for (const col of collections) {
          const snap = await col.get();
          for (const doc of snap.docs) {
            await deleteCollectionRecursive(doc.ref);
            await doc.ref.delete();
          }
        }
      }
      // Delete /clients/{companyId or uid}
      let deleted = false;
      let clientId = cid || targetUid;
      if (!clientId && userEmail) {
        // Try to find client by email
        try {
          const clientsRef = firestore.collection("clients");
          const q = await clientsRef
            .where("email", "==", String(userEmail))
            .limit(1)
            .get();
          if (!q.empty) clientId = q.docs[0].id;
        } catch {}
      }
      if (clientId) {
        const clientRef = firestore.collection("clients").doc(String(clientId));
        await deleteCollectionRecursive(clientRef);
        await clientRef.delete();
        deleted = true;
      }
      // Optionally: delete from /users/{uid} and /companies/{companyId}
      if (targetUid) {
        try {
          const userRef = firestore.collection("users").doc(String(targetUid));
          await deleteCollectionRecursive(userRef);
          await userRef.delete();
        } catch {}
      }
      if (clientId) {
        try {
          const companyRef = firestore
            .collection("companies")
            .doc(String(clientId));
          await deleteCollectionRecursive(companyRef);
          await companyRef.delete();
        } catch {}
      }
      // Optionally: delete all feedback/messages for this companyId
      // (Uncomment if you want to fully wipe all related data)
      // try {
      //   const feedbackSnap = await firestore.collection("feedback").where("companyId", "==", String(clientId)).get();
      //   for (const doc of feedbackSnap.docs) await doc.ref.delete();
      //   const msgSnap = await firestore.collection("messages").where("companyId", "==", String(clientId)).get();
      //   for (const doc of msgSnap.docs) await doc.ref.delete();
      // } catch {}
      if (deleted) {
        return res.json({ success: true });
      } else {
        return res
          .status(404)
          .json({ success: false, error: "No client/user found to delete" });
      }
    } catch (e) {
      console.error("[api/account/delete] error", e);
      return res
        .status(500)
        .json({ success: false, error: e.message || "delete-failed" });
    }
  });
} catch (e) {
  console.error("[firebase] Root init failed:", e.message || e);
  // Fallback minimal express app so server can still start
  if (!app) {
    app = express();
    app.use(cors());
    app.use(express.json({ limit: "1mb" }));
  }
}

function toWhatsAppAddress(raw) {
  if (!raw) throw new Error("Missing number");
  const s = String(raw).trim();
  if (s.toLowerCase().startsWith("whatsapp:")) return s;
  const norm = normalizePhone(s);
  if (!norm.ok) throw new Error(norm.reason || "Invalid phone");
  return "whatsapp:" + norm.value;
}

// ---------------- SMS (Twilio) ENDPOINTS (restored) ----------------
async function handleSendSms(req, res) {
  // CRITICAL FIX: Manually collect body chunks if Express didn't parse it
  // This handles Render.com proxy issues where body arrives but isn't parsed
  let bodyData = req.body;

  // If body is empty but we have a content-type header, manually read the stream
  if (
    (!bodyData || Object.keys(bodyData).length === 0) &&
    req.headers["content-type"]?.includes("application/json")
  ) {
    console.log(
      "[sms:manual-parse] Body is empty, attempting manual stream read..."
    );
    try {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const rawBody = Buffer.concat(chunks).toString("utf8");
      console.log(
        `[sms:manual-parse] Read ${rawBody.length} bytes from stream`
      );
      console.log(`[sms:manual-parse] Raw: ${rawBody.substring(0, 200)}`);
      if (rawBody.trim()) {
        bodyData = JSON.parse(rawBody);
        console.log("[sms:manual-parse] ✅ Successfully parsed manual body");
      }
    } catch (parseErr) {
      console.error("[sms:manual-parse] ❌ Failed:", parseErr.message);
    }
  }

  const {
    from: fromBody,
    to,
    body,
    statusCallback,
    accountSid: accountSidBody,
    authToken: authTokenBody,
    companyId: companyIdBody,
    messagingServiceSid: mssFromBody,
  } = bodyData || {};

  try {
    // Lightweight ingress log without exposing secrets
    try {
      console.log("[sms:headers] origin=", req.headers.origin || null);
    } catch {}
    try {
      // Log the parsed body keys to help debug missing payloads
      console.log("[sms:content-type]", req.headers["content-type"] || null);
      console.log(
        "[sms:query]",
        req.query && Object.keys(req.query).length ? req.query : null
      );
      console.log(
        "[sms:body] keys=",
        bodyData && typeof bodyData === "object"
          ? Object.keys(bodyData)
          : typeof bodyData,
        "raw=",
        typeof bodyData === "string" ? bodyData.slice(0, 200) : undefined
      );
    } catch (e) {}
    console.log("[sms:recv]", {
      to,
      hasFrom: !!fromBody,
      hasSid: !!accountSidBody,
      hasToken: !!authTokenBody,
      hasCompanyId: !!companyIdBody,
    });
  } catch {}

  // Fallback parsing: if to/body missing try query params or raw string body
  let finalTo = to;
  let finalBody = body;
  if (!finalTo) finalTo = req.query.to;
  if (!finalBody) finalBody = req.query.body;
  if ((!finalTo || !finalBody) && bodyData && typeof bodyData === "string") {
    try {
      const parsed = JSON.parse(bodyData);
      finalTo = finalTo || parsed.to;
      finalBody = finalBody || parsed.body;
    } catch {}
  }
  // Provide extremely detailed 400 response if still missing
  if (!finalTo || !finalBody) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields (to, body)",
      receivedKeys:
        bodyData && typeof bodyData === "object"
          ? Object.keys(bodyData)
          : typeof bodyData,
      query: req.query,
      hint: "Ensure fetch includes JSON body: { to: '+15551234567', body: 'Message' } with Content-Type: application/json",
    });
  }

  // Resolve credentials priority: env -> explicit body -> companyId lookup -> admin global
  let resolvedFrom = fromBody;
  const explicitSid = accountSidBody || null;
  const explicitToken = authTokenBody || null;
  const explicitMss = mssFromBody || null;

  // Env credentials
  const envSid = process.env.TWILIO_ACCOUNT_SID || null;
  const envToken = process.env.TWILIO_AUTH_TOKEN || null;
  const envMss = process.env.TWILIO_MESSAGING_SERVICE_SID || null;

  // ============== SMS LIMIT CHECK ==============
  // Check subscription SMS credits before sending
  if (companyIdBody && firestoreEnabled) {
    try {
      const firestore = firebaseAdmin.firestore();
      const subRef = firestore
        .collection("clients")
        .doc(String(companyIdBody))
        .collection("billing")
        .doc("subscription");

      const subSnap = await subRef.get();

      if (subSnap.exists) {
        const subData = subSnap.data();
        const remaining = subData.remainingCredits ?? subData.smsCredits ?? 0;
        const status = subData.status;

        console.log(
          `[sms:limit-check] company=${companyIdBody} remaining=${remaining} status=${status}`
        );

        // Check if subscription is active and has credits
        if (status !== "active") {
          return res.status(403).json({
            success: false,
            error: "Subscription is not active. Please activate your plan.",
            remainingCredits: 0,
          });
        }

        if (remaining <= 0) {
          return res.status(403).json({
            success: false,
            error:
              "SMS limit reached. Please upgrade your plan or wait for renewal.",
            remainingCredits: 0,
          });
        }

        console.log(`[sms:limit-check] ✅ Credits available: ${remaining}`);
      } else {
        console.warn(
          `[sms:limit-check] ⚠️ No subscription found for company=${companyIdBody}, allowing SMS for now`
        );
      }
    } catch (e) {
      console.error(
        `[sms:limit-check] ❌ Error checking subscription:`,
        e.message
      );
      // Don't block SMS on check errors - allow it to proceed
    }
  }
  // ============================================

  // Load company and admin-global (if Firestore is enabled)
  let companyCreds = {};
  let adminCreds = {};
  if (firestoreEnabled) {
    try {
      if (companyIdBody) {
        const company = await dbV2.getCompanyById(String(companyIdBody));
        if (company) {
          companyCreds = {
            accountSid: company.twilioAccountSid || null,
            authToken: company.twilioAuthToken || null,
            phoneNumber: company.twilioPhoneNumber || null,
            messagingServiceSid: company.twilioMessagingServiceSid || null,
          };
        }
      }
    } catch (e) {
      console.warn("[sms:send] company lookup failed", e);
    }

    try {
      const settings = await dbV2.getGlobalAdminSettings();
      const tw = settings?.twilio || {};
      adminCreds = {
        accountSid: tw.accountSid || null,
        authToken: tw.authToken || null,
        phoneNumber: tw.phoneNumber || null,
        messagingServiceSid: tw.messagingServiceSid || null,
      };
    } catch (e) {
      console.warn("[sms:send] global admin settings lookup failed", e);
    }
  }

  // Determine final credentials with the following precedence:
  // 1) explicit body (accountSid/authToken/messagingService)
  // 2) environment variables
  // 3) admin-global credentials (override company)
  // 4) company credentials
  const finalSid =
    explicitSid ||
    envSid ||
    adminCreds.accountSid ||
    companyCreds.accountSid ||
    null;
  const finalToken =
    explicitToken ||
    envToken ||
    adminCreds.authToken ||
    companyCreds.authToken ||
    null;
  const finalMss =
    explicitMss ||
    envMss ||
    adminCreds.messagingServiceSid ||
    companyCreds.messagingServiceSid ||
    null;
  // For 'from' prefer explicit body, then admin-global phone, then company phone
  resolvedFrom =
    fromBody || adminCreds.phoneNumber || companyCreds.phoneNumber || null;

  // Debug: log resolved credentials so we can see what will be used
  try {
    console.log("[sms:creds] resolvedFrom=", resolvedFrom);
    console.log(
      "[sms:creds] finalSid=",
      finalSid ? String(finalSid).slice(0, 8) + "..." : null
    );
    console.log("[sms:creds] finalMss=", finalMss || null);
    console.log("[sms:creds] adminCreds=", {
      accountSid: adminCreds.accountSid
        ? String(adminCreds.accountSid).slice(0, 8) + "..."
        : null,
      phoneNumber: adminCreds.phoneNumber || null,
      messagingServiceSid: adminCreds.messagingServiceSid || null,
    });
    console.log("[sms:creds] companyCreds=", {
      accountSid: companyCreds.accountSid
        ? String(companyCreds.accountSid).slice(0, 8) + "..."
        : null,
      phoneNumber: companyCreds.phoneNumber || null,
      messagingServiceSid: companyCreds.messagingServiceSid || null,
    });
  } catch (e) {}

  let resolvedSid = finalSid;
  let resolvedToken = finalToken;
  let resolvedMessagingServiceSid = finalMss;

  // Create client if no global twilioClient (env) is present
  // Attach a lightweight per-request id for tracing duplicated increments
  const reqId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let client = twilioClient;
  if (!client) {
    if (!resolvedSid || !resolvedToken) {
      return res.status(500).json({
        success: false,
        error:
          "Twilio not configured. Provide accountSid/authToken or a valid companyId with saved credentials.",
      });
    }
    try {
      client = twilio(resolvedSid, resolvedToken);
    } catch (e) {
      return res.status(500).json({
        success: false,
        error:
          "Failed to initialize Twilio client: " + (e.message || String(e)),
      });
    }
  }

  if (!resolvedFrom && !resolvedMessagingServiceSid) {
    return res.status(400).json({
      success: false,
      error:
        "Missing sender. Provide 'from' (Twilio number) or 'messagingServiceSid', or save them in company credentials.",
    });
  }

  // Optional: force using direct HTTP API (avoid SDK issues/logs)
  const FORCE_HTTP = String(process.env.TWILIO_FORCE_HTTP || "0") === "1";

  // Subscription checks removed — billing handled separately by admin scripts
  let subscriptionDecrementNeeded = false;
  let subscriptionDocRef = null;

  // Update Firebase dashboard stats when SMS is sent successfully
  async function recordMessage({ status, sid }) {
    // Only increment count if companyId is provided and Firestore is enabled
    if (!companyIdBody || !firestoreEnabled) {
      return;
    }

    try {
      const firestore = firebaseAdmin.firestore();
      const dashboardRef = firestore
        .collection("clients")
        .doc(companyIdBody)
        .collection("dashboard")
        .doc("current");

      const dashboardDoc = await dashboardRef.get();
      const beforeCount = dashboardDoc.exists
        ? Number(dashboardDoc.data()?.message_count || 0)
        : 0;
      if (!dashboardDoc.exists) {
        // Initialize dashboard if it doesn't exist
        await dashboardRef.set({
          feedback_count: 0,
          message_count: 1, // First message
          negative_feedback_count: 0,
          negative_comments: [],
          graph_data: { labels: [], values: [] },
          last_updated: firebaseAdmin.firestore.Timestamp.now(),
        });
        console.log(
          `[sms:sent][recordMessage] ✅ init req=${reqId} company=${companyIdBody} sid=${sid} status=${status} before=${beforeCount} after=1`
        );
      } else {
        // Increment message count
        await dashboardRef.update({
          message_count: firebaseAdmin.firestore.FieldValue.increment(1),
          last_updated: firebaseAdmin.firestore.Timestamp.now(),
        });
        // Read back the updated count for precise debugging (minor extra read; acceptable for diagnostics)
        try {
          const updated = await dashboardRef.get();
          const afterCount = Number(
            updated.data()?.message_count || beforeCount + 1
          );
          console.log(
            `[sms:sent][recordMessage] ✅ incr req=${reqId} company=${companyIdBody} sid=${sid} status=${status} before=${beforeCount} after=${afterCount}`
          );
        } catch (readBackErr) {
          console.log(
            `[sms:sent][recordMessage] ⚠️ incr req=${reqId} company=${companyIdBody} sid=${sid} (post-read failed: ${readBackErr.message})`
          );
        }
      }

      // ANALYTICS FIX: Only store ACTUAL SMS, not feedback request messages
      // Feedback requests are just prompts, not real communication data
      // We only want to track actual feedback responses in Firebase
      const isFeedbackRequest =
        (body || "").includes("localhost:5173/feedback") ||
        (body || "").includes("/feedback?");

      if (!isFeedbackRequest) {
        try {
          await firestore.collection("messages").add({
            companyId: companyIdBody,
            sms_id: sid || `msg_${Date.now()}`,
            phone_number: to || "",
            message_body: body || "",
            status: status || "sent",
            twilio_status: status || "sent",
            sent_at: firebaseAdmin.firestore.Timestamp.now(),
            timestamp: firebaseAdmin.firestore.Timestamp.now(),
            messageType: "sms",
            customerPhone: to || "",
            customerName: "",
            error_code: null,
            error_message: null,
          });
          // Subscription decrement removed — billing managed externally
          console.log(
            `[sms:sent][recordMessage] 📊 Stored non-feedback message in analytics collection for company=${companyIdBody}`
          );
        } catch (msgErr) {
          console.error(
            `[sms:sent:error] Failed to store message in analytics:`,
            msgErr.message
          );
        }
      } else {
        console.log(
          `[sms:sent][recordMessage] ⏭️ Skipped storing feedback request SMS (only store actual feedback responses)`
        );
      }

      // ============== DECREMENT SMS CREDITS ==============
      // Decrement subscription credits after successful SMS send
      try {
        const subRef = firestore
          .collection("clients")
          .doc(companyIdBody)
          .collection("billing")
          .doc("subscription");

        const subSnap = await subRef.get();

        if (subSnap.exists) {
          const subData = subSnap.data();
          const remaining = subData.remainingCredits ?? subData.smsCredits ?? 0;

          if (remaining > 0) {
            await subRef.update({
              remainingCredits:
                firebaseAdmin.firestore.FieldValue.increment(-1),
              last_updated: firebaseAdmin.firestore.Timestamp.now(),
            });

            console.log(
              `[sms:sent][credits] ✅ Decremented credits for company=${companyIdBody} (${remaining} → ${
                remaining - 1
              })`
            );

            // Dispatch event to update frontend
            // Note: Frontend will need to poll /api/subscription to refresh
          } else {
            console.warn(
              `[sms:sent][credits] ⚠️ No credits to decrement for company=${companyIdBody}`
            );
          }
        } else {
          console.warn(
            `[sms:sent][credits] ⚠️ No subscription found for company=${companyIdBody}`
          );
        }
      } catch (creditsErr) {
        console.error(
          `[sms:sent][credits] ❌ Failed to decrement credits for company=${companyIdBody}:`,
          creditsErr.message
        );
      }
      // ===============================================
    } catch (e) {
      console.error(
        `[sms:sent:error] Failed to update dashboard stats for ${companyIdBody}:`,
        e.message
      );
    }
  }
  if (FORCE_HTTP) {
    try {
      const sidToUse = resolvedSid || process.env.TWILIO_ACCOUNT_SID;
      const tokenToUse = resolvedToken || process.env.TWILIO_AUTH_TOKEN;
      if (!sidToUse || !tokenToUse) {
        throw new Error(
          "Twilio credentials missing for HTTP send (accountSid/authToken)."
        );
      }
      // Send via Messaging Service SID if provided; else use From number
      if (resolvedMessagingServiceSid) {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
          String(sidToUse)
        )}/Messages.json`;
        const params = new URLSearchParams();
        params.set("MessagingServiceSid", String(resolvedMessagingServiceSid));
        params.set("To", String(to));
        params.set("Body", String(body));
        if (statusCallback)
          params.set("StatusCallback", String(statusCallback));
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(`${sidToUse}:${tokenToUse}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });
        const httpData = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          const message = httpData?.message || JSON.stringify(httpData);
          const code = httpData?.code;
          throw Object.assign(new Error(message || "Twilio HTTP error (MSS)"), {
            code,
          });
        }
        console.log("[sms:send:success:http]", {
          sid: httpData?.sid,
          status: httpData?.status,
        });
        await recordMessage({
          status: httpData?.status || httpData?.message_status || "queued",
          sid: httpData?.sid,
        });
        return res.json({
          success: true,
          sid: httpData?.sid,
          status: httpData?.status || httpData?.message_status || "queued",
        });
      } else {
        const data = await sendSmsViaTwilioHttp({
          accountSid: sidToUse,
          authToken: tokenToUse,
          from: resolvedFrom,
          to,
          body,
          statusCallback,
        });
        console.log("[sms:send:success:http]", {
          sid: data?.sid,
          status: data?.status || data?.message_status,
        });
        await recordMessage({
          status: data?.status || data?.message_status || "queued",
          sid: data?.sid,
        });
        return res.json({
          success: true,
          sid: data?.sid,
          status: data?.status || data?.message_status || "queued",
        });
      }
    } catch (httpErr) {
      const fMsg = httpErr?.message || String(httpErr);
      const fCode = httpErr?.code;
      console.error("[sms:send:http:error]", { code: fCode, errMsg: fMsg });
      return res.status(500).json({ success: false, error: fMsg, code: fCode });
    }
  }

  try {
    console.log("[sms:send:attempt]", {
      from: resolvedFrom,
      to: finalTo,
      len: finalBody?.length,
      mss: resolvedMessagingServiceSid ? "yes" : "no",
    });
    const createArgs = {
      to: finalTo,
      body: String(finalBody),
      ...(statusCallback ? { statusCallback } : {}),
    };
    if (resolvedMessagingServiceSid) {
      createArgs["messagingServiceSid"] = resolvedMessagingServiceSid;
    } else {
      createArgs["from"] = resolvedFrom;
    }
    const msg = await client.messages.create(createArgs);
    await recordMessage({ status: msg.status || "queued", sid: msg.sid });
    return res.json({ success: true, sid: msg.sid, status: msg.status });
  } catch (e) {
    const errMsg = e?.message || String(e);
    const code = e?.code;
    // Only fallback for recognizable module/SDK internal errors, not for normal Twilio API errors
    const looksLikeSdkModuleBug =
      e?.code === "MODULE_NOT_FOUND" ||
      /assignedaddon/i.test(errMsg) ||
      /Cannot find module/i.test(errMsg) ||
      /import\s+.*twilio/i.test(errMsg);
    if (looksLikeSdkModuleBug) {
      try {
        const sidToUse = resolvedSid || process.env.TWILIO_ACCOUNT_SID;
        const tokenToUse = resolvedToken || process.env.TWILIO_AUTH_TOKEN;
        if (!sidToUse || !tokenToUse) {
          throw new Error(
            "Twilio credentials missing for HTTP fallback (accountSid/authToken)."
          );
        }
        if (!resolvedFrom && !resolvedMessagingServiceSid) {
          throw new Error(
            "Missing sender for HTTP fallback. Provide 'from' or 'messagingServiceSid'."
          );
        }
        console.warn(
          "[sms:send:fallback:http] Twilio SDK failed, attempting direct REST API"
        );
        const data = await sendSmsViaTwilioHttp({
          accountSid: sidToUse,
          authToken: tokenToUse,
          from: resolvedFrom,
          to,
          body,
          statusCallback,
          // Note: sendSmsViaTwilioHttp will read 'from'; for Messaging Service SID we pass via params below
        });
        // If using Messaging Service SID, we need to call HTTP with MessagingServiceSid param instead of From
        if (resolvedMessagingServiceSid && (!data || !data.sid)) {
          const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
            String(sidToUse)
          )}/Messages.json`;
          const params = new URLSearchParams();
          params.set(
            "MessagingServiceSid",
            String(resolvedMessagingServiceSid)
          );
          params.set("To", String(to));
          params.set("Body", String(body));
          if (statusCallback)
            params.set("StatusCallback", String(statusCallback));
          const resp = await fetch(url, {
            method: "POST",
            headers: {
              Authorization:
                "Basic " +
                Buffer.from(`${sidToUse}:${tokenToUse}`).toString("base64"),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
          });
          const httpData = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            const message = httpData?.message || JSON.stringify(httpData);
            const code = httpData?.code;
            throw Object.assign(
              new Error(message || "Twilio HTTP error (MSS)"),
              { code }
            );
          }
          console.log("[sms:send:success:http]", {
            sid: httpData?.sid,
            status: httpData?.status,
          });
          await recordMessage({
            status: httpData?.status || httpData?.message_status || "queued",
            sid: httpData?.sid,
          });
          return res.json({
            success: true,
            sid: httpData?.sid,
            status: httpData?.status || httpData?.message_status || "queued",
          });
        }
        console.log("[sms:send:success:http]", {
          sid: data?.sid,
          status: data?.status || data?.message_status,
        });
        await recordMessage({
          status: data?.status || data?.message_status || "queued",
          sid: data?.sid,
        });
        return res.json({
          success: true,
          sid: data?.sid,
          status: data?.status || data?.message_status || "queued",
        });
      } catch (fallbackErr) {
        const fMsg = fallbackErr?.message || String(fallbackErr);
        const fCode = fallbackErr?.code;
        console.error("[sms:send:fallback:http:error]", {
          code: fCode,
          errMsg: fMsg,
        });
        return res
          .status(500)
          .json({ success: false, error: fMsg, code: fCode });
      }
    }
    // Provide helpful hints for common Twilio errors
    let hint;
    if (code === 21608)
      hint =
        "Trial account cannot send SMS to unverified numbers. Verify the number in Twilio or upgrade the account.";
    if (code === 21211)
      hint =
        "The 'To' number is not a valid phone number. Use E.164 format like +14155550123.";
    console.error("[sms:send:error]", { code, errMsg });
    return res
      .status(500)
      .json({ success: false, error: errMsg, code, ...(hint ? { hint } : {}) });
  }
}

// Original route
app.post("/send-sms", handleSendSms);
// Alias route (some clients may prefix with /api)
app.post("/api/send-sms", handleSendSms);

// --- Billing / Subscription endpoints (unified) ---
// Fetch current subscription (always 200, normalize empty)
app.get("/api/subscription", async (req, res) => {
  try {
    if (!firestoreEnabled) {
      return res.json({
        success: false,
        subscription: null,
        reason: "firestore-disabled",
      });
    }
    const companyId = req.query.companyId || req.query.company_id;
    if (!companyId) {
      return res.json({
        success: false,
        subscription: null,
        reason: "missing-companyId",
      });
    }

    // Ownership check: if a caller provides a Firebase ID token, verify it
    // and ensure the caller maps to the same companyId. If the caller is
    // authenticated but belongs to a different company, treat the
    // subscription as non-existent for that caller so they can sign up
    // again without being blocked by another client's subscription.
    try {
      const authz =
        req.headers.authorization || req.headers.Authorization || "";
      if (authz && String(authz).startsWith("Bearer ") && firebaseAdmin) {
        try {
          const idToken = String(authz).slice(7).trim();
          const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);

          // Allow admins to view subscriptions as before
          if (
            !(decoded && (decoded.admin === true || decoded.admin === "true"))
          ) {
            const callerUid = decoded?.uid || decoded?.sub || null;
            if (callerUid) {
              // Try dbV2 mapping first
              let callerCompanyId = null;
              try {
                if (dbV2 && typeof dbV2.getUserById === "function") {
                  const userRec = await dbV2
                    .getUserById(callerUid)
                    .catch(() => null);
                  if (userRec && userRec.companyId)
                    callerCompanyId = String(userRec.companyId);
                }
              } catch (e) {
                console.warn(
                  "[api:subscription] dbV2.getUserById failed:",
                  e?.message || e
                );
              }

              // Fallback: check legacy clients collection by auth_uid
              if (!callerCompanyId) {
                try {
                  const clientsRef = firebaseAdmin
                    .firestore()
                    .collection("clients");
                  const q = clientsRef
                    .where("auth_uid", "==", String(callerUid))
                    .limit(1);
                  const searchSnap = await q.get();
                  if (!searchSnap.empty)
                    callerCompanyId = searchSnap.docs[0].id;
                } catch (e) {
                  console.warn(
                    "[api:subscription] owner derive from auth uid failed:",
                    e?.message || e
                  );
                }
              }

              if (
                callerCompanyId &&
                String(callerCompanyId) !== String(companyId)
              ) {
                console.log(
                  `[api:subscription] ownership mismatch: callerCompany=${callerCompanyId} requested=${companyId} -> hiding subscription`
                );
                return res.json({
                  success: true,
                  subscription: null,
                  ownerMismatch: true,
                });
              }
            }
          }
        } catch (tokErr) {
          // Token verification failed - ignore ownership check and continue
          console.warn(
            "[api:subscription] ID token verify failed (ignoring):",
            tokErr?.message || tokErr
          );
        }
      }
    } catch (e) {
      console.warn(
        "[api:subscription] Ownership verification failed (ignoring):",
        e?.message || e
      );
    }
    const firestore = firebaseAdmin.firestore();
    // Prefer billing path, fallback to profile path if legacy
    const billingRef = firestore
      .collection("clients")
      .doc(String(companyId))
      .collection("billing")
      .doc("subscription");
    let snap = await billingRef.get();

    // If there is no billing doc, prefer the profile/main document which
    // we now populate on successful subscription saves. Fall back to the
    // legacy profile/subscription document afterward for older records.
    if (!snap.exists) {
      const profileMainRef = firestore
        .collection("clients")
        .doc(String(companyId))
        .collection("profile")
        .doc("main");
      snap = await profileMainRef.get();
      if (!snap.exists) {
        const legacyRef = firestore
          .collection("clients")
          .doc(String(companyId))
          .collection("profile")
          .doc("subscription");
        snap = await legacyRef.get();
        if (!snap.exists) {
          return res.json({ success: true, subscription: null, empty: true });
        }
      }
    }
    try {
      const raw = snap.data() || {};

      // Ensure we always return a subscription object with smsCredits
      // and remainingCredits populated (useful for debug/verify UI).
      const priceToPlan = { 30: "starter_1m", 75: "growth_3m", 100: "pro_6m" };
      const PLAN_CREDITS = { starter_1m: 250, growth_3m: 600, pro_6m: 900 };

      const normalized = { ...raw };

      const planIdGuess =
        (raw.planId || raw.plan || "") && String(raw.planId || raw.plan || "");

      const deriveCredits = (src) => {
        // Prefer explicit planId mapping
        const pid =
          (src.planId || src.plan || null) &&
          String(src.planId || src.plan || "");
        if (pid && PLAN_CREDITS[pid]) return PLAN_CREDITS[pid];
        // Try price-based inference
        const priceRaw = src.price || src.amount || src.price_raw || null;
        const pnum = typeof priceRaw === "number" ? priceRaw : Number(priceRaw);
        if (
          !Number.isNaN(pnum) &&
          priceToPlan[pnum] &&
          PLAN_CREDITS[priceToPlan[pnum]]
        )
          return PLAN_CREDITS[priceToPlan[pnum]];
        // Try name-based inference
        const name = src.planName || src.name || "";
        if (name && typeof name === "string") {
          const n = name.toLowerCase();
          if (n.includes("growth") || n.includes("quarter")) return 600;
          if (
            n.includes("pro") ||
            n.includes("professional") ||
            n.includes("half")
          )
            return 900;
          if (n.includes("starter") || n.includes("monthly")) return 250;
        }
        // Default fallback for unknown/custom plans
        return 250;
      };

      const hasSms =
        Number.isFinite(Number(raw.smsCredits)) && Number(raw.smsCredits) > 0;
      const hasRemaining =
        Number.isFinite(Number(raw.remainingCredits)) &&
        Number(raw.remainingCredits) > 0;

      // If missing, compute defaults for response
      if (!hasSms) {
        normalized.smsCredits = deriveCredits(raw);
      }
      if (!hasRemaining) {
        // If remaining not present, default to smsCredits (fresh purchase)
        normalized.remainingCredits = Number(normalized.smsCredits || 0);
      }

      // Support an explicit repair flag so manual verification can persist
      // derived credits into Firestore. This prevents accidental writes from
      // normal read-only requests.
      const wantRepair =
        req.query &&
        (String(req.query.repair) === "1" ||
          String(req.query.repair) === "true");
      if (wantRepair) {
        try {
          const billingRef = firestore
            .collection("clients")
            .doc(String(companyId))
            .collection("billing")
            .doc("subscription");
          const profileRef = firestore
            .collection("clients")
            .doc(String(companyId))
            .collection("profile")
            .doc("main");

          const updatePayload = {
            smsCredits: Number(normalized.smsCredits || 0),
            remainingCredits: Number(normalized.remainingCredits || 0),
            planId:
              normalized.planId ||
              normalized.plan ||
              normalized.planName ||
              null,
            planName: normalized.planName || normalized.name || null,
            status: normalized.status || "active",
            updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
          };

          // Merge into billing and profile docs to keep both in sync.
          await billingRef.set(updatePayload, { merge: true });
          await profileRef.set(updatePayload, { merge: true });
          console.log(
            `[api:subscription:get] Auto-repaired missing credits for company=${companyId} -> smsCredits=${updatePayload.smsCredits}`
          );
          normalized._autoRepaired = true;
        } catch (e) {
          console.warn(
            "[api:subscription:get] Auto-repair failed:",
            e?.message || e
          );
          normalized._autoRepaired = false;
        }
      }

      return res.json({ success: true, subscription: normalized });
    } catch (e) {
      console.error("[api:subscription:get] normalize error", e);
      return res.json({ success: true, subscription: snap.data() });
    }
  } catch (e) {
    console.error("[api:subscription:get] error", e);
    return res.json({
      success: false,
      subscription: null,
      error: e.message || "fetch-failed",
    });
  }
});

// Create/update subscription manually (admin/test) – expects { companyId, planId, smsCredits, durationMonths, status }

app.post("/api/subscription", async (req, res) => {
  try {
    if (!firestoreEnabled) {
      return res.status(503).json({ error: "Database not configured" });
    }
    let {
      companyId,
      planId,
      smsCredits,
      durationMonths,
      status,
      userEmail,
      sessionId,
    } = req.body || {};
    // Accept companyId from various places (body, headers, query)
    companyId =
      companyId ||
      req.headers["x-company-id"] ||
      req.headers["x-client-id"] ||
      req.query.companyId ||
      null;

    // --- DEBUG LOGGING ---
    console.log("[api:subscription] Incoming POST /api/subscription");
    console.log("Body:", req.body);
    console.log("Headers:", req.headers);
    console.log("Derived companyId (pre-token):", companyId);
    console.log("Derived planId (pre-logic):", planId);

    // If caller provided an Authorization: Bearer <Firebase ID token>, verify and always use UID as companyId
    try {
      const authz =
        req.headers.authorization || req.headers.Authorization || "";
      if (authz && String(authz).startsWith("Bearer ") && firebaseAdmin) {
        const idToken = String(authz).slice(7).trim();
        if (idToken) {
          try {
            const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
            const uid = decoded?.uid || decoded?.sub;
            if (uid) {
              companyId = uid;
              console.log(
                `[api:subscription] Using UID from ID token as companyId: ${companyId}`
              );
            }
          } catch (tokErr) {
            console.warn(
              "[api:subscription] ID token verify failed:",
              tokErr?.message || tokErr
            );
          }
        }
      }
    } catch (e) {
      console.warn(
        "[api:subscription] Error while attempting to derive companyId from Authorization header:",
        e?.message || e
      );
    }

    // If companyId is missing but client provided an email, try to find the
    // corresponding client document by email (admin-side lookup). This helps
    // the flow when the browser lost localStorage/companyId across a redirect.
    if (!companyId && userEmail) {
      try {
        const clientsRef = firestore.collection("clients");
        const q = clientsRef.where("email", "==", String(userEmail)).limit(1);
        const searchSnap = await q.get();
        if (!searchSnap.empty) {
          companyId = searchSnap.docs[0].id;
          console.log(
            `[api:subscription] Derived companyId ${companyId} from userEmail ${userEmail}`
          );
        }
      } catch (e) {
        console.warn(
          "[api:subscription] Failed to derive companyId from userEmail:",
          e
        );
      }
    }

    // Attempt to derive planId from other fields (planName, price, headers)
    try {
      const priceToPlan = { 30: "starter_1m", 75: "growth_3m", 100: "pro_6m" };
      if (!planId) {
        planId =
          req.body.plan ||
          req.body.planId ||
          req.headers["x-plan-id"] ||
          req.headers["x-plan"] ||
          req.query.plan ||
          null;
      }
      if (!planId && req.body.planName) {
        const pn = String(req.body.planName).toLowerCase();
        if (pn.includes("growth")) planId = "growth_3m";
        else if (pn.includes("pro") || pn.includes("professional"))
          planId = "pro_6m";
        else if (pn.includes("starter") || pn.includes("monthly"))
          planId = "starter_1m";
      }
      if (!planId && (req.body.price || req.headers["x-price"])) {
        const priceRaw = req.body.price || req.headers["x-price"];
        const pnum = typeof priceRaw === "number" ? priceRaw : Number(priceRaw);
        if (!Number.isNaN(pnum) && priceToPlan[pnum])
          planId = priceToPlan[pnum];
      }
    } catch (e) {
      console.warn(
        "[api:subscription] planId derivation failed:",
        e?.message || e
      );
    }

    // Final debug log before error
    if (!companyId || !planId) {
      console.error("[api:subscription] ERROR: Missing companyId or planId");
      console.error("companyId:", companyId, "planId:", planId);
      return res.status(400).json({
        error: "companyId & planId required",
        debug: {
          companyId,
          planId,
          body: req.body,
          headers: req.headers,
        },
      });
    }
    const firestore = firebaseAdmin.firestore();
    const ref = firestore
      .collection("clients")
      .doc(String(companyId))
      .collection("billing")
      .doc("subscription");
    const months = Number(durationMonths) || 1;
    const totalMs = months * 30 * 24 * 60 * 60 * 1000;
    // Map common plans to SMS credits. Unknown plans default to a safe
    // starter amount so client-side writes don't accidentally persist
    // zero credits when the payload omits or sets smsCredits=0.
    const PLAN_CREDITS = { starter_1m: 250, growth_3m: 600, pro_6m: 900 };
    let smsCreditsNum = Number(smsCredits);
    if (!Number.isFinite(smsCreditsNum) || smsCreditsNum <= 0) {
      if (planId && PLAN_CREDITS[planId]) {
        smsCreditsNum = PLAN_CREDITS[planId];
      } else {
        // default fallback for unknown/custom plans
        smsCreditsNum = 250;
      }
    }

    const payload = {
      planId,
      planName: planId,
      smsCredits: smsCreditsNum,
      remainingCredits: smsCreditsNum,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + totalMs).toISOString(),
      status: status || "active",
      paymentSessionId: sessionId || null,
      updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    };
    await ref.set(payload, { merge: true });

    // Also persist subscription into the client's profile/main document so
    // the frontend (ProfilePage) can read subscription data from a single
    // canonical location. Use admin SDK timestamps to match client expectations.
    try {
      const profileRef = firestore
        .collection("clients")
        .doc(String(companyId))
        .collection("profile")
        .doc("main");

      const activatedAtTs = firebaseAdmin.firestore.Timestamp.now();
      const expiryAtTs = firebaseAdmin.firestore.Timestamp.fromMillis(
        Date.now() + totalMs
      );

      const profilePayload = {
        planId: payload.planId,
        planName: payload.planName || payload.planId,
        smsCredits: payload.smsCredits,
        remainingCredits: payload.remainingCredits,
        status: payload.status || "active",
        activatedAt: activatedAtTs,
        expiryAt: expiryAtTs,
        paymentSessionId: sessionId || null,
        updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      };

      await profileRef.set(profilePayload, { merge: true });
      console.log(
        `[api:subscription] ✅ Saved subscription to clients/${companyId}/profile/main`
      );
    } catch (profileErr) {
      console.error(
        "[api:subscription] Failed to save subscription to profile/main:",
        profileErr
      );
      // Continue - primary billing doc is already saved
    }

    return res.json({ success: true, subscription: payload });
  } catch (e) {
    return res
      .status(500)
      .json({ error: e.message || "Failed to save subscription" });
  }
});

// Claim a previously-created payment session and attach it to a client.
// Useful when the hosted checkout redirect loses metadata or the client
// needs to reconcile a sessionId after the webhook has run.
app.post("/api/subscription/claim", async (req, res) => {
  try {
    if (!firestoreEnabled) {
      return res
        .status(503)
        .json({ success: false, error: "firestore-disabled" });
    }
    // Robustly derive sessionId and userEmail from multiple sources so
    // the claim endpoint can be used even when upstream proxies or
    // hosting platforms fail to parse JSON bodies reliably.
    let sessionId = null;
    let userEmail = null;

    try {
      // Primary: prefer parsed JSON body fields
      if (
        req.body &&
        typeof req.body === "object" &&
        Object.keys(req.body).length
      ) {
        sessionId = req.body.sessionId || req.body.session_id || null;
        userEmail = req.body.userEmail || req.body.user_email || null;
      }

      // Secondary: headers (x-session-id / x-user-email) are a reliable
      // fallback when JSON bodies are dropped by some platforms.
      if (!sessionId && req.headers["x-session-id"]) {
        sessionId = String(req.headers["x-session-id"] || null);
      }
      if (!userEmail && req.headers["x-user-email"]) {
        userEmail = String(req.headers["x-user-email"] || null);
      }

      // Tertiary: query params
      if (
        !sessionId &&
        req.query &&
        (req.query.sessionId || req.query.session_id)
      ) {
        sessionId = req.query.sessionId || req.query.session_id || null;
      }
      if (
        !userEmail &&
        req.query &&
        (req.query.userEmail || req.query.user_email)
      ) {
        userEmail = req.query.userEmail || req.query.user_email || null;
      }

      // Final attempt: parse rawBody captured by express.json verify hook
      // (some hosts keep raw body but don't populate req.body)
      if (
        (!sessionId || !userEmail) &&
        req.rawBody &&
        typeof req.rawBody === "string"
      ) {
        try {
          const parsed = JSON.parse(req.rawBody || "{}");
          if (!sessionId)
            sessionId = parsed.sessionId || parsed.session_id || null;
          if (!userEmail)
            userEmail = parsed.userEmail || parsed.user_email || null;
          console.log(
            "[api:subscription:claim] Parsed rawBody for claim fallback"
          );
        } catch (e) {
          // ignore parse errors
        }
      }
    } catch (e) {
      console.warn(
        "[api:subscription:claim] Error deriving session/user from request:",
        e?.message || e
      );
    }

    // Allow claim via Authorization (ID token) or x-company-id header as
    // an alternative to sessionId/userEmail so clients that only send a
    // bearer token can still reconcile subscriptions.
    let companyId = null;
    try {
      companyId =
        req.headers["x-company-id"] ||
        req.headers["x-client-id"] ||
        req.query.companyId ||
        req.query.company_id ||
        null;
    } catch (e) {
      companyId = null;
    }

    // If companyId not provided, try to derive it from an Authorization
    // bearer token similar to /api/subscription route.
    if (!companyId) {
      try {
        const authz =
          req.headers.authorization || req.headers.Authorization || "";
        if (authz && String(authz).startsWith("Bearer ") && firebaseAdmin) {
          const idToken = String(authz).slice(7).trim();
          if (idToken) {
            try {
              const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
              const uid = decoded?.uid || decoded?.sub || null;
              if (uid) {
                // Prefer dbV2 mapping when available
                try {
                  if (dbV2 && typeof dbV2.getUserById === "function") {
                    const userRec = await dbV2.getUserById(uid);
                    if (userRec && userRec.companyId) {
                      companyId = userRec.companyId;
                      console.log(
                        `[api:subscription:claim] Derived companyId ${companyId} from idToken (uid=${uid})`
                      );
                    }
                  }
                } catch (e) {
                  console.warn(
                    "[api:subscription:claim] dbV2.getUserById failed:",
                    e?.message || e
                  );
                }
                if (!companyId) {
                  try {
                    const clientsRef = firebaseAdmin
                      .firestore()
                      .collection("clients");
                    const q = clientsRef
                      .where("auth_uid", "==", String(uid))
                      .limit(1);
                    const searchSnap = await q.get();
                    if (!searchSnap.empty) {
                      companyId = searchSnap.docs[0].id;
                      console.log(
                        `[api:subscription:claim] Derived companyId ${companyId} from auth uid ${uid}`
                      );
                    }
                  } catch (e) {
                    console.warn(
                      "[api:subscription:claim] Failed to derive companyId from auth uid:",
                      e?.message || e
                    );
                  }
                }
              }
            } catch (tokErr) {
              console.warn(
                "[api:subscription:claim] ID token verify failed:",
                tokErr?.message || tokErr
              );
            }
          }
        }
      } catch (e) {
        console.warn(
          "[api:subscription:claim] Error deriving companyId from Authorization header:",
          e?.message || e
        );
      }
    }

    if (!sessionId && !userEmail && !companyId) {
      return res.status(400).json({
        success: false,
        error:
          "sessionId or userEmail required (or provide x-company-id / Authorization token)",
      });
    }

    const firestore = firebaseAdmin.firestore();

    // If we have a sessionId, try to locate a profile document that already
    // contains that sessionId (collectionGroup search across all clients).
    if (sessionId) {
      try {
        const cg = await firestore
          .collectionGroup("profile")
          .where("paymentSessionId", "==", String(sessionId))
          .limit(1)
          .get();
        if (!cg.empty) {
          const profileSnap = cg.docs[0];
          const profileData = profileSnap.data();
          // Derive companyId from the document path: clients/{companyId}/profile/main
          const pathParts = profileSnap.ref.path.split("/");
          const foundCompanyId = pathParts[1] || null;

          // Attempt to derive planId from common fields
          let planId =
            profileData.planId ||
            profileData.plan ||
            profileData.planName ||
            null;
          const priceToPlan = {
            30: "starter_1m",
            75: "growth_3m",
            100: "pro_6m",
          };
          if (!planId && profileData.price) {
            const p =
              typeof profileData.price === "number"
                ? profileData.price
                : Number(profileData.price);
            if (!Number.isNaN(p) && priceToPlan[p]) planId = priceToPlan[p];
          }

          if (!foundCompanyId) {
            return res.status(404).json({
              success: false,
              error: "Could not derive companyId from session",
            });
          }

          if (!planId) {
            return res.status(400).json({
              success: false,
              error: "Could not derive planId from session/profile data",
            });
          }

          // Normalize and persist billing + profile as /api/subscription does
          const months =
            planId === "growth_3m" ? 3 : planId === "pro_6m" ? 6 : 1;
          const smsCredits =
            planId === "growth_3m" ? 600 : planId === "pro_6m" ? 900 : 250;
          const totalMs = months * 30 * 24 * 60 * 60 * 1000;

          const billingRef = firestore
            .collection("clients")
            .doc(String(foundCompanyId))
            .collection("billing")
            .doc("subscription");
          const billingPayload = {
            planId,
            planName: profileData.planName || planId,
            smsCredits,
            remainingCredits: smsCredits,
            startDate: firebaseAdmin.firestore.Timestamp.now(),
            endDate: firebaseAdmin.firestore.Timestamp.fromMillis(
              Date.now() + totalMs
            ),
            status: "active",
            updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
          };
          await billingRef.set(billingPayload, { merge: true });

          const profileRef = firestore
            .collection("clients")
            .doc(String(foundCompanyId))
            .collection("profile")
            .doc("main");
          const profilePayload = {
            planId: billingPayload.planId,
            planName: billingPayload.planName,
            smsCredits: billingPayload.smsCredits,
            remainingCredits: billingPayload.remainingCredits,
            status: "active",
            activatedAt: firebaseAdmin.firestore.Timestamp.now(),
            expiryAt: firebaseAdmin.firestore.Timestamp.fromMillis(
              Date.now() + totalMs
            ),
            paymentSessionId: String(sessionId),
            updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
          };
          await profileRef.set(profilePayload, { merge: true });

          // Return the found company id in the response so callers can
          // persist it locally for subsequent requests.
          return res.json({
            success: true,
            subscription: profilePayload,
            companyId: foundCompanyId,
          });
        }
      } catch (e) {
        console.warn("[api:subscription:claim] sessionId search failed:", e);
      }
    }

    // Fallback: if user provided an email, try to derive companyId from clients
    if (userEmail) {
      try {
        const clientsRef = firestore.collection("clients");
        const q = await clientsRef
          .where("email", "==", String(userEmail))
          .limit(1)
          .get();
        if (!q.empty) {
          const cid = q.docs[0].id;
          const profileRef = firestore
            .collection("clients")
            .doc(cid)
            .collection("profile")
            .doc("main");
          const snap = await profileRef.get();
          if (snap.exists) {
            return res.json({
              success: true,
              companyId: cid,
              subscription: snap.data(),
            });
          }
          return res.status(404).json({
            success: false,
            error:
              "No session found for this email; please re-submit with companyId & planId",
            companyId: cid,
          });
        }
      } catch (e) {
        console.warn("[api:subscription:claim] email lookup failed:", e);
      }
    }

    return res
      .status(404)
      .json({ success: false, error: "No matching session or company found" });
  } catch (e) {
    console.error("[api:subscription:claim] error", e);
    return res
      .status(500)
      .json({ success: false, error: e.message || "claim-failed" });
  }
});

// ============== DODO PAYMENT INTEGRATION ==============
// Dodo Payment Gateway Configuration
const DODO_API_KEY = process.env.DODO_API_KEY || "";
const DODO_API_BASE =
  process.env.DODO_API_BASE || "https://test.dodopayments.com";

// Product ID mapping (configure these in your Dodo dashboard)
// These match your other working project's product IDs
const DODO_PRODUCTS = {
  starter_1m:
    process.env.DODO_PRODUCT_STARTER_1M || "pdt_0SaMzoGEsjSCi8t0xd5vN",
  growth_3m: process.env.DODO_PRODUCT_GROWTH_3M || "pdt_OsKdNhpmFjOxSkqpwBtXR",
  pro_6m: process.env.DODO_PRODUCT_PRO_6M || "pdt_Blsof767CZTPWreD75zFF",
  // Add aliases for consistency with frontend
  monthly: process.env.DODO_PRODUCT_STARTER_1M || "pdt_0SaMzoGEsjSCi8t0xd5vN",
  quarterly: process.env.DODO_PRODUCT_GROWTH_3M || "pdt_OsKdNhpmFjOxSkqpwBtXR",
  halfyearly: process.env.DODO_PRODUCT_PRO_6M || "pdt_Blsof767CZTPWreD75zFF",
};

// Import axios dynamically (already imported at top of file, but ensure it's available)
let axiosModule;
try {
  axiosModule = await import("axios");
} catch {
  console.warn("[Dodo] axios not available, will use fetch fallback");
}

// Create payment session (Dodo gateway integration)
app.post("/api/payments/create-session", async (req, res) => {
  if (!DODO_API_KEY) {
    console.error("[Dodo Payment] ❌ DODO_API_KEY not found in .env file!");
    return res.status(500).json({
      success: false,
      error: "Server configuration error: API key missing",
    });
  }

  try {
    // ULTRA-ROBUST body parsing for Render proxy issues
    let body = req.body && typeof req.body === "object" ? req.body : {};

    // Log what we received for debugging
    console.log("[Dodo Payment] RAW REQUEST DEBUG:", {
      hasBody: !!req.body,
      bodyType: typeof req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      hasRawBody: !!req.rawBody,
      rawBodyLength: req.rawBody ? req.rawBody.length : 0,
      contentType: req.headers["content-type"],
      hasHeaders: {
        xCompanyId: !!req.headers["x-company-id"],
        xUserEmail: !!req.headers["x-user-email"],
        xPlanId: !!req.headers["x-plan-id"],
        xPrice: !!req.headers["x-price"],
      },
    });

    // Try to parse rawBody if body is empty
    if (!body || Object.keys(body).length === 0) {
      try {
        const raw = req.rawBody || "";
        if (raw && raw.trim().startsWith("{")) {
          body = JSON.parse(raw);
          console.log("[Dodo Payment] ✅ Parsed body from rawBody");
        }
      } catch (e) {
        console.warn("[Dodo Payment] rawBody parse failed:", e.message);
      }
    }

    // Accept multiple field names from different sources (body, headers, query)
    const plan =
      body.plan ||
      body.planId ||
      body.id ||
      body.selectedPlanId ||
      body.selectedPlan?.id ||
      req.headers["x-plan-id"] ||
      req.headers["x-plan"] ||
      req.query.plan ||
      req.query.planId;

    const priceRaw =
      body.price ??
      body.amount ??
      body.total ??
      body.selectedPlan?.price ??
      req.headers["x-price"] ??
      req.headers["x-amount"] ??
      req.query.price ??
      req.query.amount;

    const price =
      priceRaw !== undefined && priceRaw !== null && priceRaw !== ""
        ? typeof priceRaw === "string"
          ? Number(priceRaw)
          : Number(priceRaw)
        : NaN;

    const companyId =
      body.companyId ||
      body.company_id ||
      req.headers["x-company-id"] ||
      req.headers["x-client-id"] ||
      req.query.companyId ||
      req.query.company_id;

    const userEmail =
      body.userEmail ||
      body.user_email ||
      req.headers["x-user-email"] ||
      req.query.userEmail ||
      req.query.user_email;

    // Final debug log
    console.log("[Dodo Payment] PARSED VALUES:", {
      plan,
      price,
      companyId,
      userEmail,
      hasApiKey: !!DODO_API_KEY,
      origin: req.headers.origin || null,
    });

    // Ownership check: if caller presented a Firebase ID token, verify the
    // token and ensure the caller is allowed to create a session for the
    // requested companyId. If the caller belongs to a different company,
    // deny the request to prevent creating sessions for another client.
    try {
      const authz =
        req.headers.authorization || req.headers.Authorization || "";
      if (authz && String(authz).startsWith("Bearer ") && firebaseAdmin) {
        try {
          const idToken = String(authz).slice(7).trim();
          const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
          // Allow admin tokens through
          if (
            !(decoded && (decoded.admin === true || decoded.admin === "true"))
          ) {
            const callerUid = decoded?.uid || decoded?.sub || null;
            if (callerUid) {
              let callerCompanyId = null;
              try {
                if (dbV2 && typeof dbV2.getUserById === "function") {
                  const userRec = await dbV2
                    .getUserById(callerUid)
                    .catch(() => null);
                  if (userRec && userRec.companyId)
                    callerCompanyId = String(userRec.companyId);
                }
              } catch (e) {
                console.warn(
                  "[Dodo Payment] dbV2.getUserById failed:",
                  e?.message || e
                );
              }

              // Fallback to legacy clients collection by auth_uid
              if (!callerCompanyId) {
                try {
                  const clientsRef = firebaseAdmin
                    .firestore()
                    .collection("clients");
                  const q = clientsRef
                    .where("auth_uid", "==", String(callerUid))
                    .limit(1);
                  const searchSnap = await q.get();
                  if (!searchSnap.empty)
                    callerCompanyId = searchSnap.docs[0].id;
                } catch (e) {
                  console.warn(
                    "[Dodo Payment] derive owner from auth uid failed:",
                    e?.message || e
                  );
                }
              }

              if (
                callerCompanyId &&
                companyId &&
                String(callerCompanyId) !== String(companyId)
              ) {
                console.log(
                  `[Dodo Payment] ownership mismatch: callerCompany=${callerCompanyId} requested=${companyId}`
                );
                return res.status(403).json({
                  success: false,
                  error:
                    "Ownership mismatch: cannot create session for another company",
                });
              }

              // If companyId was not provided, derive it from token mapping so
              // clients can rely solely on their ID token to request sessions.
              if (!companyId && callerCompanyId) {
                companyId = callerCompanyId;
                console.log(
                  `[Dodo Payment] derived companyId=${companyId} from idToken uid=${callerUid}`
                );
              }
            }
          }
        } catch (tokErr) {
          // Ignore token verification failures here; fall back to other
          // heuristics (headers/query/body). We don't want to block
          // requests solely because token verification failed.
          console.warn(
            "[Dodo Payment] ID token verify failed (ignoring):",
            tokErr?.message || tokErr
          );
        }
      }
    } catch (e) {
      console.warn(
        "[Dodo Payment] Ownership verification failed (ignoring):",
        e?.message || e
      );
    }

    // Validate inputs: only plan is strictly required to map to a Dodo product
    if (!plan) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: plan",
      });
    }

    // Map plan to product ID (support both naming conventions)
    const productId = DODO_PRODUCTS[plan];
    if (!productId) {
      console.error(`[Dodo Payment] Invalid plan: ${plan}`);
      return res.status(400).json({
        success: false,
        error: `Invalid plan selected: ${plan}`,
        availablePlans: Object.keys(DODO_PRODUCTS),
      });
    }

    // Determine return URLs with fallbacks
    const baseUrl =
      process.env.FRONTEND_URL ||
      process.env.VITE_API_BASE ||
      "https://vercel-swart-chi-29.vercel.app";
    const successUrl = `${baseUrl.replace(
      /\/$/,
      ""
    )}/payment-success?client_id=${encodeURIComponent(
      companyId || "unknown"
    )}&plan_id=${encodeURIComponent(plan)}`;

    // Subscription payload matching your working server.js
    const payload = {
      payment_link: true,
      product_id: productId,
      quantity: 1,
      customer: {
        email: userEmail || "customer@example.com",
        name: "ReputationFlow User",
      },
      billing: {
        city: "New York",
        country: "US", // Use US to keep USD pricing
        state: "NY",
        street: "123 Main St",
        zipcode: "10001",
      },
      return_url: successUrl,
      metadata: {
        companyId: companyId || "unknown",
        plan: plan,
        // Dodo expects metadata values as strings, not numbers
        ...(Number.isFinite(price) ? { price: String(price) } : {}),
        timestamp: new Date().toISOString(),
      },
    };

    console.log(
      `[Dodo Payment] Creating SUBSCRIPTION for ${plan}$${
        Number.isFinite(price) ? ` (price ${price})` : ""
      }...`
    );
    console.log(`[Dodo Payment] API URL: ${DODO_API_BASE}/subscriptions`);
    console.log(
      `[Dodo Payment] Product ID: ${productId}, Return URL: ${successUrl}`
    );

    // Create Dodo subscription using axios
    let dodoData;
    try {
      const axios = axiosModule?.default || (await import("axios")).default;
      const dodoResponse = await axios.post(
        `${DODO_API_BASE}/subscriptions`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${DODO_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 30000, // 30 second timeout
        }
      );
      dodoData = dodoResponse.data;
    } catch (axiosError) {
      console.error("[Dodo Payment] ❌ Error creating subscription:");
      console.error("Status:", axiosError.response?.status);
      console.error(
        "Data:",
        JSON.stringify(axiosError.response?.data, null, 2)
      );
      console.error("Message:", axiosError.message);

      return res.status(500).json({
        success: false,
        error: "Failed to create subscription payment",
        details: axiosError.response?.data || axiosError.message,
      });
    }

    // Extract payment link from response
    const paymentUrl =
      dodoData.payment_link || dodoData.checkout_url || dodoData.url;

    if (!paymentUrl) {
      console.error("[Dodo Payment] ❌ No payment link in response:", dodoData);
      return res.status(500).json({
        success: false,
        error: "Payment gateway did not return checkout URL",
        details: dodoData,
      });
    }

    console.log("[Dodo Payment] ✅ Subscription created successfully!");
    console.log("[Dodo Payment] Payment URL:", paymentUrl);

    return res.json({
      success: true,
      url: paymentUrl,
      sessionId: dodoData.subscription_id || dodoData.id,
    });
  } catch (error) {
    console.error("[Dodo Payment] ❌ Exception:", error);
    console.error("[Dodo Payment] Stack:", error.stack);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error creating payment session",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// Webhook receiver (Dodo) - verify payment completion
app.post("/api/payments/webhook", async (req, res) => {
  try {
    // Dodo sends webhook with payment status
    const signature = req.headers["x-dodo-signature"];
    const event = req.body;

    console.log(
      "[Dodo Webhook] Received event:",
      event.type || event.event_type
    );

    // Verify signature (IMPORTANT for production!)
    // const isValid = verifyDodoSignature(req.body, signature, process.env.DODO_WEBHOOK_SECRET);
    // if (!isValid) {
    //   console.error("[Dodo Webhook] Invalid signature");
    //   return res.status(401).json({ error: "Invalid signature" });
    // }

    // Handle different event types
    const eventType = event.type || event.event_type;

    if (
      eventType === "subscription.created" ||
      eventType === "checkout.session.completed" ||
      eventType === "payment.succeeded"
    ) {
      const session = event.data || event;
      const metadata = session.metadata || {};

      console.log("[Dodo Webhook] Payment completed:", {
        sessionId: session.id || session.subscription_id,
        companyId: metadata.companyId,
        plan: metadata.plan,
        amount: session.amount_total || session.amount,
      });

      // Update subscription in Firestore. Prefer clients/{companyId} v2
      // schema (billing + profile/main) so the frontend can read a
      // canonical document regardless of whether the event came from
      // the API POST path or webhook path.
      if (
        firestoreEnabled &&
        metadata.companyId &&
        metadata.companyId !== "unknown"
      ) {
        try {
          const firestore = firebaseAdmin.firestore();
          const companyId = String(metadata.companyId);

          // Calculate expiry date & sms credits based on plan
          const now = new Date();
          let expiryDate = new Date(now);
          let smsCredits = 250; // Default for starter
          let planId = metadata.plan || metadata.planId || null;
          let planName = planId || null;

          if (planId === "starter_1m") {
            expiryDate.setMonth(expiryDate.getMonth() + 1);
            smsCredits = 250;
            planName = "Starter";
          } else if (planId === "growth_3m") {
            expiryDate.setMonth(expiryDate.getMonth() + 3);
            smsCredits = 600;
            planName = "Growth";
          } else if (planId === "pro_6m") {
            expiryDate.setMonth(expiryDate.getMonth() + 6);
            smsCredits = 900;
            planName = "Professional";
          } else if (metadata.planName) {
            planName = metadata.planName;
          }

          // Billing payload (keeps legacy billing doc in sync)
          try {
            const billingRef = firestore
              .collection("clients")
              .doc(companyId)
              .collection("billing")
              .doc("subscription");
            const months = Number(metadata.durationMonths) || 1;
            const totalMs = months * 30 * 24 * 60 * 60 * 1000;
            const billingPayload = {
              planId: planId || planName,
              planName: planName || planId || metadata.plan || null,
              smsCredits: smsCredits,
              remainingCredits: smsCredits,
              startDate: firebaseAdmin.firestore.Timestamp.fromDate(now),
              endDate: firebaseAdmin.firestore.Timestamp.fromMillis(
                Date.now() + totalMs
              ),
              status: "active",
              updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
            };
            await billingRef.set(billingPayload, { merge: true });
          } catch (billingErr) {
            console.warn(
              "[Dodo Webhook] Failed to write billing doc:",
              billingErr?.message || billingErr
            );
          }

          // Profile (canonical) payload
          try {
            const profileRef = firestore
              .collection("clients")
              .doc(companyId)
              .collection("profile")
              .doc("main");

            const activatedAtTs = firebaseAdmin.firestore.Timestamp.now();
            const expiryAtTs = firebaseAdmin.firestore.Timestamp.fromMillis(
              expiryDate.getTime()
            );

            const profilePayload = {
              planId: planId || planName || metadata.plan || null,
              planName: planName || planId || metadata.plan || null,
              smsCredits: smsCredits,
              remainingCredits: smsCredits,
              status: "active",
              activatedAt: activatedAtTs,
              expiryAt: expiryAtTs,
              paymentSessionId: session.id || session.subscription_id,
              updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
            };

            await profileRef.set(profilePayload, { merge: true });
            console.log(
              `[Dodo Webhook] ✅ Saved subscription to clients/${companyId}/profile/main`
            );
          } catch (profileErr) {
            console.error(
              "[Dodo Webhook] Failed to save subscription to profile/main:",
              profileErr?.message || profileErr
            );
          }

          console.log(
            "[Dodo Webhook] ✅ Subscription activated for company:",
            metadata.companyId
          );
        } catch (dbError) {
          console.error(
            "[Dodo Webhook] ❌ Failed to update subscription:",
            dbError
          );
        }
      } else {
        console.log(
          "[Dodo Webhook] ⚠️ Skipping database update - Firestore disabled or no/unknown companyId"
        );
      }
    }

    // Always respond 200 to acknowledge receipt
    res.json({ received: true });
  } catch (error) {
    console.error("[Dodo Webhook] ❌ Exception:", error);
    res.status(500).json({ error: error.message });
  }
});

// Twilio status webhook (optional)
app.post(
  "/twilio-status",
  express.urlencoded({ extended: false }),
  (req, res) => {
    try {
      console.log("[twilio:status]", req.body); // body contains MessageStatus, MessageSid, etc.
    } catch {}
    res.sendStatus(200);
  }
);

// Fetch a message by SID
app.get("/twilio-message/:sid", async (req, res) => {
  if (!twilioClient)
    return res
      .status(500)
      .json({ success: false, error: "Twilio not configured" });
  try {
    const msg = await twilioClient.messages(req.params.sid).fetch();
    return res.json({ success: true, message: msg });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, error: e.message || String(e) });
  }
});

// Phone normalization logic (E.164). Previous version auto-assumed +91 which caused
// false negatives for non-Indian numbers. New behavior:
//  - Accept full international numbers starting with '+'
//  - Optionally allow local numbers if DEFAULT_COUNTRY_CODE env is set (e.g. '+91')
//  - Otherwise require user to supply '+' format
function normalizePhone(raw) {
  if (!raw) return { ok: false, reason: "Empty phone" };
  const cleaned = String(raw)
    .replace(/[^0-9+]/g, "")
    .trim();
  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1);
    if (/^[0-9]{6,15}$/.test(digits)) return { ok: true, value: cleaned };
    return {
      ok: false,
      reason: "Invalid E.164 format (expect +<country><number>)",
    };
  }
  const digitsOnly = cleaned.replace(/^0+/, "");
  const defaultCCRaw = process.env.DEFAULT_COUNTRY_CODE || "";
  const defaultCC = defaultCCRaw
    ? defaultCCRaw.startsWith("+")
      ? defaultCCRaw
      : "+" + defaultCCRaw.replace(/[^0-9]/g, "")
    : null;
  if (defaultCC && /^[0-9]{4,15}$/.test(digitsOnly)) {
    return { ok: true, value: defaultCC + digitsOnly };
  }
  return {
    ok: false,
    reason:
      "Provide full international number starting with + (e.g. +14155550123). Set DEFAULT_COUNTRY_CODE to allow local numbers.",
  };
}

// WhatsApp Cloud API (Meta) simple text message endpoint
// POST /send-whatsapp { accessToken, phoneNumberId, to, body }
// (Legacy endpoint kept; internally updated for soft contact validation)
app.post("/send-whatsapp", async (req, res) => {
  const { to, body } = req.body || {};
  const accessToken =
    req.body?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId =
    req.body?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const debug = req.query.debug === "1" || req.body?.debug === true;
  const validate = req.query.validate === "1" || req.body?.validate === true;
  const rawSkip =
    req.query.skipInvalid === "1" || req.body?.skipInvalid === true;
  // Auto-skip invalid contacts unless explicitly disabled via env or skipInvalid=0
  const defaultAutoSkip = (process.env.WA_DEFAULT_SKIP_INVALID || "1") !== "0";
  const skipInvalid = rawSkip || (validate && defaultAutoSkip);
  console.log(
    `[wa:send-text:incoming] to=${to} validate=${validate} skipInvalid=${skipInvalid} debug=${debug}`
  );
  if (!accessToken || !phoneNumberId || !to || !body) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields.",
      fields: {
        accessToken: !!accessToken,
        phoneNumberId: !!phoneNumberId,
        to: !!to,
        body: !!body,
      },
    });
  }
  const norm = normalizePhone(to);
  if (!norm.ok) {
    return res.status(400).json({
      success: false,
      error: `Invalid 'to' number: ${norm.reason}`,
      original: to,
    });
  }
  const waTo = norm.value.replace(/^\+/, "");
  let contactCheck = null;
  let contactStatus = "unknown";
  let validationWarning = null;
  if (validate) {
    try {
      console.log(`[wa:contact-check] to=${waTo}`);
      const contactResp = await fetch(
        `https://graph.facebook.com/v22.0/${encodeURIComponent(
          String(phoneNumberId)
        )}/contacts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            blocking: "wait",
            contacts: [waTo],
            force_check: true,
          }),
        }
      );
      contactCheck = await contactResp.json().catch(() => ({}));
      contactStatus = contactCheck?.contacts?.[0]?.status || "unknown"; // valid | invalid | unknown
      addWaHistory({
        type: "contact-check",
        direction: "out",
        to: waTo,
        payload: contactCheck,
        status: contactStatus,
      });
      console.log(
        `[wa:contact-check:result] to=${waTo} status=${contactStatus}`
      );
      if (contactStatus !== "valid") {
        if (!skipInvalid) {
          validationWarning =
            "Contact reported as invalid. Blocked because skipInvalid not enabled.";
          return res.status(400).json({
            success: false,
            error: "Recipient appears not to be a WhatsApp user",
            contact_status: contactStatus,
            contact: contactCheck,
          });
        } else {
          validationWarning =
            "Contact reported as invalid by /contacts; proceeding anyway (auto-skip).";
          console.warn(
            `[wa:contact-check:warning] proceeding despite status=${contactStatus} (skipInvalid)`
          );
        }
      }
    } catch (e) {
      validationWarning = `Contact validation failed: ${e.message || e}`;
      console.warn("[wa:contact-check:error] soft-fail", e.message || e);
    }
  }
  try {
    const url = `https://graph.facebook.com/v22.0/${encodeURIComponent(
      String(phoneNumberId)
    )}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      to: waTo,
      type: "text",
      text: { body: String(body) },
    };
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    console.log(
      `[wa:send-text:response] httpStatus=${
        resp.status
      } hasError=${!resp.ok} messageId=${data?.messages?.[0]?.id || "n/a"}`
    );
    if (!resp.ok) {
      const err = data?.error || {};
      let hint;
      if (err.code === 190) {
        const sc = err.error_subcode;
        if (sc === 463) hint = "Access token expired";
        else if (sc === 467) hint = "Invalid access token";
      } else if (resp.status === 404) {
        hint = "Phone Number ID not found or token lacks permission";
      }
      addWaHistory({
        type: "text",
        direction: "out",
        to: waTo,
        status: "error",
        errors: err,
        hint,
        payload: debug ? { request: payload, response: data } : undefined,
      });
      return res.status(resp.status).json({
        success: false,
        error: err.message || "WhatsApp API error",
        code: err.code,
        subcode: err.error_subcode,
        hint,
        contact_status: contactStatus,
        ...(debug ? { raw: data, contact: contactCheck } : {}),
      });
    }
    const messageId = data?.messages?.[0]?.id;
    addWaHistory({
      id: messageId,
      type: "text",
      direction: "out",
      to: waTo,
      status: "accepted",
      payload: debug ? data : undefined,
      hint: skipInvalid ? "skipInvalid" : validate ? "validated" : undefined,
    });
    return res.json({
      success: true,
      id: messageId,
      to: waTo,
      status: "accepted",
      contact_status: contactStatus,
      ...(validationWarning ? { validationWarning } : {}),
      ...(debug
        ? { raw: data, contact: contactCheck, normalized: norm.value }
        : {}),
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, error: e.message || String(e) });
  }
});

// ---------------- WHATSAPP REFACTORED SENDING (NEW ENDPOINTS) ----------------
// New simplified endpoints: /wa/send-text and /wa/send-template (non-breaking original kept above)
const WA_GRAPH_VERSION = "v22.0";

function buildWaHint(err, httpStatus) {
  if (!err) return undefined;
  if (err.code === 190) {
    if (err.error_subcode === 463) return "Access token expired";
    if (err.error_subcode === 467) return "Invalid access token";
    return "Authentication error";
  }
  if (httpStatus === 404) return "Phone Number ID not found or no permission";
  if (err?.error_data?.details?.match?.(/24.?hour/i))
    return "Outside 24h window – use a template to initiate";
  return undefined;
}

async function waContactCheck({ phoneNumberId, accessToken, waTo }) {
  try {
    const resp = await fetch(
      `https://graph.facebook.com/${WA_GRAPH_VERSION}/${encodeURIComponent(
        String(phoneNumberId)
      )}/contacts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          blocking: "wait",
          contacts: [waTo],
          force_check: true,
        }),
      }
    );
    const data = await resp.json().catch(() => ({}));
    addWaHistory({
      type: "contact-check",
      direction: "out",
      to: waTo,
      payload: data,
      status:
        data?.contacts?.[0]?.status || (data?.error ? "error" : "unknown"),
    });
    return data;
  } catch (e) {
    addWaHistory({
      type: "contact-check",
      direction: "out",
      to: waTo,
      status: "exception",
      errors: { message: e.message || String(e) },
    });
    return null;
  }
}

async function waSend({ phoneNumberId, accessToken, payload }) {
  const url = `https://graph.facebook.com/${WA_GRAPH_VERSION}/${encodeURIComponent(
    String(phoneNumberId)
  )}/messages`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(() => ({}));
  return { resp, data };
}

// Twilio WhatsApp: send a text message via Twilio (from/to must be WhatsApp-enabled)
// POST /wa/send-text { from, to, body, accountSid?, authToken?, statusCallback? }
app.post("/wa/send-text", async (req, res) => {
  const b = req.body || {};
  const q = req.query || {};
  const from = b.from || q.from;
  const to = b.to || q.to;
  const body = b.body || q.body;
  const statusCallback = b.statusCallback || q.statusCallback;
  if (!from || !to || !body) {
    const missing = [
      !from ? "from" : null,
      !to ? "to" : null,
      !body ? "body" : null,
    ].filter(Boolean);
    return res.status(400).json({
      success: false,
      error: `Missing required fields: ${missing.join(", ")}`,
      hint: missing.includes("from")
        ? "Provide a WhatsApp-enabled Twilio number as 'from' (e.g., +14155238886 for sandbox)."
        : undefined,
    });
  }
  const client = getTwilioClientFromReq(req);
  if (!client) {
    return res.status(500).json({
      success: false,
      error:
        "Twilio not configured. Provide accountSid/authToken in body or set TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN envs.",
    });
  }
  try {
    console.log("[wa:twilio:send]", {
      from: String(from || "").slice(0, 6) + "…",
      to: String(to || "").slice(0, 6) + "…",
      len: (body ? String(body) : "").length,
    });
    const fromAddr = toWhatsAppAddress(from);
    const toAddr = toWhatsAppAddress(to);
    const msg = await client.messages.create({
      from: fromAddr,
      to: toAddr,
      body: String(body),
      ...(statusCallback ? { statusCallback } : {}),
    });
    addWaHistory({
      id: msg.sid,
      type: "text",
      direction: "out",
      to: toAddr.replace(/^whatsapp:/i, ""),
      status: msg.status || "queued",
    });
    return res.json({
      success: true,
      id: msg.sid,
      to: toAddr.replace(/^whatsapp:/i, ""),
      status: msg.status || "queued",
    });
  } catch (e) {
    const errMsg = e?.message || String(e);
    const code = e?.code;
    let hint;
    if (code === 63018)
      hint = "The 'from' number is not WhatsApp-enabled in Twilio.";
    if (code === 63015)
      hint =
        "The 'to' number may not be a valid WhatsApp user or is not opted-in.";
    return res
      .status(500)
      .json({ success: false, error: errMsg, code, ...(hint ? { hint } : {}) });
  }
});

// Deprecated: Meta WhatsApp Cloud API template sending
app.post("/wa/send-template", async (_req, res) => {
  return res.status(410).json({
    success: false,
    error:
      "WhatsApp Cloud API disabled. Use Twilio WhatsApp via /wa/send-text with a pre-approved template body if required.",
  });
});

// Convenience endpoint to send the standard hello_world template, matching your curl example
// POST /wa/send-hello-world { accessToken?, phoneNumberId?, to }
app.post("/wa/send-hello-world", async (_req, res) => {
  return res.status(410).json({
    success: false,
    error:
      "WhatsApp Cloud API disabled. Use Twilio WhatsApp via /wa/send-text.",
  });
});

app.post("/send-whatsapp-template", async (req, res) => {
  return res.status(410).json({
    success: false,
    error:
      "WhatsApp Cloud API disabled. Use Twilio WhatsApp via /wa/send-text.",
  });
});
/*
  const accessToken =
    req.body?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId =
    req.body?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const { to, template } = req.body || {};
  const debug = req.query.debug === "1" || req.body?.debug === true;
  const doContact =
    req.query.contact === "1" ||
    req.query.validate === "1" ||
    req.body?.validate === true;
  console.log(
    `[wa:send-template:new] to=${to} template=${template?.name} contactCheck=${doContact} debug=${debug}`
  );
  if (
    !accessToken ||
    !phoneNumberId ||
    !to ||
    !template?.name ||
    !template?.languageCode
  ) {
    return res
      .status(400)
      .json({ success: false, error: "Missing required fields" });
  }
  const norm = normalizePhone(to);
  if (!norm.ok)
    return res.status(400).json({ success: false, error: norm.reason });
  const waTo = norm.value.replace(/^\+/, "");
  let contactData = null;
  if (doContact)
    contactData = await whatsappContactCheck({
      phoneNumberId,
      accessToken,
      waTo,
    });

  const tplPayload = {
    messaging_product: "whatsapp",
    to: waTo,
    type: "template",
    template: {
      name: template.name,
      language: { code: template.languageCode },
      ...(template.components ? { components: template.components } : {}),
    },
  };
  try {
    const resp = await fetch(
      `https://graph.facebook.com/${WA_GRAPH_VERSION}/${encodeURIComponent(
        String(phoneNumberId)
      )}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(tplPayload),
      }
    );
    const data = await resp.json().catch(() => ({}));
    console.log(
      `[wa:send-template:resp] http=${resp.status} ok=${resp.ok} id=${
        data?.messages?.[0]?.id || "n/a"
      }`
    );
    if (!resp.ok) {
      const err = data?.error || {};
      const hint = buildWaHint(err, resp.status);
      addWaHistory({
        type: "template",
        direction: "out",
        to: waTo,
        status: "error",
        errors: err,
        payload: debug ? { request: tplPayload, response: data } : undefined,
        hint,
      });
      return res.status(resp.status).json({
        success: false,
        error: err.message || "WhatsApp API error",
        code: err.code,
        subcode: err.error_subcode,
        hint,
        ...(debug ? { raw: data, contact: contactData } : {}),
      });
    }
    const messageId = data?.messages?.[0]?.id;
    addWaHistory({
      id: messageId,
      type: "template",
      direction: "out",
      to: waTo,
      status: "accepted",
      payload: debug ? data : undefined,
      hint: doContact ? "contact-checked" : undefined,
    });
    return res.json({
      success: true,
      id: messageId,
      to: waTo,
      status: "accepted",
      ...(debug ? { raw: data, contact: contactData } : {}),
    });
  } catch (e) {
    addWaHistory({
      type: "template",
      direction: "out",
      to: waTo,
      status: "exception",
      errors: { message: e.message || String(e) },
    });
    return res
      .status(500)
      .json({ success: false, error: e.message || String(e) });
  }
*/

// Verify WhatsApp phone number id
app.get("/wa-verify", async (_req, res) => {
  return res.status(410).json({
    success: false,
    error: "WhatsApp Cloud API disabled. Not applicable under Twilio.",
  });
});

// Check if a phone number is a valid WhatsApp user
app.post("/wa-check-contact", async (_req, res) => {
  return res.status(410).json({
    success: false,
    error:
      "WhatsApp Cloud API contact-check disabled. Under Twilio, consider using opt-in lists or attempt send and observe status callbacks.",
  });
});

// Token quick check
app.get("/wa-token-check", async (_req, res) => {
  return res.status(410).json({
    success: false,
    error: "WhatsApp Cloud API token checks disabled under Twilio.",
  });
});

// Webhook endpoints for delivery & inbound
// Meta webhooks disabled; use /twilio-status for Twilio callbacks
app.get("/wa-webhook", (_req, res) => res.status(410).send("Gone"));
app.post("/wa-webhook", (_req, res) => res.status(410).send("Gone"));

// WhatsApp history endpoint
app.get("/wa-history", (req, res) => {
  try {
    let history = [...waHistory].reverse(); // newest first
    const { to, limit } = req.query;
    if (to) {
      const norm = normalizePhone(String(to));
      const raw = norm.ok
        ? norm.value.replace(/^\+/, "")
        : String(to).replace(/[^0-9]/g, "");
      history = history.filter((h) => h.to === raw);
    }
    const lim = Number(limit) || 0;
    if (lim > 0) history = history.slice(0, lim);
    res.json({ success: true, count: history.length, history });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

// Health endpoints
const healthHandler = (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    sms: "enabled",
    whatsapp: twilioClient ? "twilio" : "twilio:configured:false",
  });
};
app.get("/health", healthHandler);

// -------------------- AUTH + CLIENT/ADMIN --------------------
// Minimal email/password auth stored in Firestore clients collection.
// For production, prefer Firebase Auth or a managed auth provider.
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-do-not-use";

// Helper: verify Firebase ID token and ensure the user is an admin/superadmin
async function verifyFirebaseAdmin(req) {
  try {
    if (!firebaseAdmin)
      return { ok: false, error: "Firebase Admin SDK not available" };
    const authz = req.headers.authorization || req.headers.Authorization || "";
    if (!authz.startsWith("Bearer "))
      return { ok: false, error: "Missing Bearer token" };
    const idToken = authz.slice(7).trim();
    if (!idToken) return { ok: false, error: "Empty Bearer token" };

    // Development helper: accept demo token on localhost or when NODE_ENV !== 'production'
    // CHECK THIS FIRST before attempting Firebase verification
    if (idToken === "DEMO_ADMIN_TOKEN_LOCALHOST") {
      const isDev = (process.env.NODE_ENV || "development") !== "production";
      const host = req.headers.host || req.hostname || "";
      const isLocalRequest =
        host.includes("localhost") || host.includes("127.0.0.1");

      if (isDev && isLocalRequest) {
        // Create a synthetic admin user object (uid 'demo_admin')
        const uid = "demo_admin";
        const user = { id: uid, email: "admin@demo.com", role: "admin" };
        console.log("[demo-admin] Demo token accepted for localhost");
        return { ok: true, uid, decoded: { uid, demo: true }, user };
      }
    }

    const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
    const uid = decoded.uid || decoded.sub;
    if (!uid) return { ok: false, error: "Invalid token (no uid)" };
    // If token contains a custom admin claim set via auth.setCustomUserClaims,
    // accept it immediately (Admin SDK has verified the token signature).
    // This allows fast provisioning via admin.createUser + setCustomUserClaims.
    if (decoded && (decoded.admin === true || decoded.admin === "true")) {
      const user = { id: uid, email: decoded.email || null, role: "admin" };
      return { ok: true, uid, decoded, user };
    }
    if (!firestoreEnabled)
      return { ok: false, error: "Firestore not configured" };
    // First try uid-based lookup in new users table
    let user = null;
    try {
      user = await dbV2.getUserById(uid);
    } catch (e) {
      console.warn(
        "[verifyFirebaseAdmin] dbV2.getUserById failed",
        e?.message || e
      );
    }
    let role = String(user?.role || "").toLowerCase();
    if (role === "admin" || role === "superadmin") {
      return { ok: true, uid, decoded, user };
    }

    // FALLBACK: if uid lookup failed to find an admin and the token contains
    // an email, try to locate the user record by email. This helps in cases
    // where tokens are issued by a different Firebase project or uid mapping
    // differs after migration but email remains constant. We only perform
    // this lookup when Firestore is enabled.
    try {
      const email = decoded?.email || null;
      if (email) {
        console.log(
          "[verifyFirebaseAdmin] uid lookup did not return admin; trying email fallback for",
          email
        );
        // Prefer dbV2 helper if available
        if (dbV2 && typeof dbV2.getUserByEmail === "function") {
          try {
            const byEmail = await dbV2.getUserByEmail(String(email));
            if (byEmail) {
              const r = String(byEmail.role || "").toLowerCase();
              if (r === "admin" || r === "superadmin") {
                return { ok: true, uid, decoded, user: byEmail };
              }
            }
          } catch (e) {
            console.warn(
              "[verifyFirebaseAdmin] dbV2.getUserByEmail failed",
              e?.message || e
            );
          }
        }

        // As a final fallback, query Firestore directly for legacy users collection
        try {
          const firestore = firebaseAdmin.firestore();
          const q = await firestore
            .collection("users")
            .where("email", "==", String(email))
            .limit(1)
            .get();
          if (!q.empty) {
            const doc = q.docs[0].data();
            const r = String(doc?.role || "").toLowerCase();
            if (r === "admin" || r === "superadmin") {
              return { ok: true, uid, decoded, user: doc };
            }
          }
        } catch (e) {
          console.warn(
            "[verifyFirebaseAdmin] direct Firestore email lookup failed",
            e?.message || e
          );
        }
      }
    } catch (e) {
      console.warn(
        "[verifyFirebaseAdmin] email fallback failed",
        e?.message || e
      );
    }

    return { ok: false, error: "Insufficient privileges (need admin role)" };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

app.post("/auth/signup", async (req, res) => {
  try {
    if (!firestoreEnabled)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });
    const { name, email, password, tenantKey } = req.body || {};
    if (!name || !email || !password || !tenantKey) {
      return res.status(400).json({
        success: false,
        error: "Missing name, email, password, or tenantKey",
      });
    }
    const existing = await db.getClientByEmail(email);
    if (existing)
      return res
        .status(409)
        .json({ success: false, error: "Email already registered" });
    const hashed = await bcrypt.hash(String(password), 10);
    const client = await db.upsertClient({
      name,
      email,
      tenantKey,
      activityStatus: "active",
    });
    await db.setClientPasswordHash(client.id, email, hashed);
    // issue token
    const token = jwt.sign(
      { sub: client.id, role: "client", tenantKey },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ success: true, token, client });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    if (!firestoreEnabled)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });
    // Google sign-in path: Authorization: Bearer <Firebase ID token>
    const authz = req.headers.authorization || "";
    if (authz.startsWith("Bearer ") && firebaseAdmin) {
      try {
        const idToken = authz.slice(7);
        console.log(
          "[auth:google] Verifying token for project:",
          firebaseProjectId || "loading..."
        );
        const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
        console.log(
          "[auth:google] Token verified successfully for user:",
          decoded.email
        );
        const email = decoded.email;
        if (!email)
          return res
            .status(400)
            .json({ success: false, error: "Google token missing email" });

        // Check if user exists in new schema
        let user = await dbV2.getUserById(decoded.uid);
        let companyId;

        if (!user) {
          // First-time login: create company and user
          console.log("[auth:google] First login - creating company and user");
          const company = await dbV2.createCompany({
            companyName: decoded.name || email.split("@")[0],
            adminId: decoded.uid,
            email: email,
          });
          companyId = company.companyId;

          user = await dbV2.upsertUser({
            uid: decoded.uid,
            email: email,
            name: decoded.name || email.split("@")[0],
            role: "ADMIN", // First user in company is admin
            companyId: companyId,
          });
        } else {
          // Existing user: update lastLogin
          companyId = user.companyId;
          await dbV2.upsertUser({
            uid: decoded.uid,
            email: email,
            name: user.name,
            role: user.role,
            companyId: companyId,
          });
        }

        const token = jwt.sign(
          { sub: decoded.uid, role: user.role, companyId },
          JWT_SECRET,
          { expiresIn: "7d" }
        );
        return res.json({ success: true, token, user, companyId });
      } catch (e) {
        console.error("[auth:google:error]", e.code, e.message || e);
        return res.status(401).json({
          success: false,
          error: "Invalid Google token",
          details: e.message,
        });
      }
    }
    const { email, password } = req.body || {};
    if (!email || !password)
      return res
        .status(400)
        .json({ success: false, error: "Missing email or password" });
    const found = await db.getClientAuthByEmail(email);
    if (!found?.client || !found?.auth)
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" });
    const ok = await bcrypt.compare(
      String(password),
      String(found.auth.passwordHash || "")
    );
    if (!ok)
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" });
    const token = jwt.sign(
      {
        sub: found.client.id,
        role: "client",
        tenantKey: found.client.tenantKey,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ success: true, token, client: found.client });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

// Return current user/company info using Firebase ID token or app token
app.get("/auth/me", async (req, res) => {
  try {
    if (!firestoreEnabled)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });
    const authz = req.headers.authorization || "";
    // Prefer Firebase ID token
    if (authz.startsWith("Bearer ") && firebaseAdmin) {
      try {
        const idToken = authz.slice(7);
        const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
        const user = await dbV2.getUserById(decoded.uid);
        if (!user)
          return res
            .status(404)
            .json({ success: false, error: "User not found" });
        return res.json({
          success: true,
          user,
          companyId: user.companyId || null,
        });
      } catch (e) {
        return res.status(401).json({ success: false, error: "Invalid token" });
      }
    }
    // Fallback to app JWT
    if (authz.startsWith("App ")) {
      try {
        const token = authz.slice(4);
        const decoded = jwt.verify(token, JWT_SECRET);
        // On legacy path we don't have uid, just return minimal info
        return res.json({
          success: true,
          user: { role: decoded.role },
          companyId: decoded.companyId || decoded.tenantKey || null,
        });
      } catch (e) {
        return res
          .status(401)
          .json({ success: false, error: "Invalid app token" });
      }
    }
    return res
      .status(401)
      .json({ success: false, error: "Missing Authorization" });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

// Admin global stats
app.get("/admin/global-stats", async (req, res) => {
  try {
    const v = await verifyFirebaseAdmin(req);
    if (!v.ok) return res.status(401).json({ success: false, error: v.error });
    if (!firestoreEnabled)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });
    const stats = await dbV2.getGlobalStats();
    res.json({ success: true, stats });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

// Admin: read global Twilio credentials
app.get("/admin/credentials", async (req, res) => {
  try {
    const v = await verifyFirebaseAdmin(req);
    if (!v.ok) return res.status(401).json({ success: false, error: v.error });
    if (!firestoreEnabled)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });
    const settings = await dbV2.getGlobalAdminSettings();
    // Return both Twilio credentials and feedback URLs
    res.json({
      success: true,
      credentials: {
        ...(settings?.twilio || {}),
        ...(settings?.feedbackUrls || {}),
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

// Public: get admin global credentials (for clients to use as fallback)
// No authentication required - this allows all clients to auto-use admin Twilio credentials
app.get("/api/admin/global-credentials", async (req, res) => {
  try {
    console.log("[api:admin:global-credentials] 🔍 Request received");

    if (!firestoreEnabled) {
      console.log("[api:admin:global-credentials] ❌ Firestore not enabled");
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });
    }

    console.log(
      "[api:admin:global-credentials] ✅ Firestore enabled, fetching settings..."
    );
    const settings = await dbV2.getGlobalAdminSettings();

    console.log(
      "[api:admin:global-credentials] 📦 Raw settings from DB:",
      JSON.stringify(settings, null, 2)
    );
    console.log(
      "[api:admin:global-credentials] 🔐 Twilio object:",
      settings?.twilio
    );
    console.log(
      "[api:admin:global-credentials] 📞 AccountSid:",
      settings?.twilio?.accountSid
    );
    console.log(
      "[api:admin:global-credentials] 🔑 AuthToken:",
      settings?.twilio?.authToken ? "EXISTS" : "MISSING"
    );
    console.log(
      "[api:admin:global-credentials] 📱 PhoneNumber:",
      settings?.twilio?.phoneNumber
    );

    // Return only Twilio credentials (not feedback URLs for security)
    const response = {
      success: true,
      credentials: {
        accountSid: settings?.twilio?.accountSid || "",
        authToken: settings?.twilio?.authToken || "",
        phoneNumber: settings?.twilio?.phoneNumber || "",
        messagingServiceSid: settings?.twilio?.messagingServiceSid || "",
      },
    };

    console.log(
      "[api:admin:global-credentials] 📤 Sending response:",
      JSON.stringify(response, null, 2)
    );
    res.json(response);
  } catch (e) {
    console.error("[api:admin:global-credentials] ❌ Error:", e);
    console.error("[api:admin:global-credentials] ❌ Error stack:", e.stack);
    res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

// Admin: save global Twilio credentials
app.post("/admin/credentials", async (req, res) => {
  try {
    const v = await verifyFirebaseAdmin(req);
    if (!v.ok) return res.status(401).json({ success: false, error: v.error });
    if (!firestoreEnabled)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });
    const { accountSid, authToken, phoneNumber, messagingServiceSid } =
      req.body || {};
    const settings = await dbV2.updateGlobalAdminSettings({
      twilio: { accountSid, authToken, phoneNumber, messagingServiceSid },
    });
    res.json({ success: true, settings });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

// Admin: save global feedback URL and SMS server port (Requirement 2)
app.post("/admin/feedback-urls", async (req, res) => {
  try {
    const v = await verifyFirebaseAdmin(req);
    if (!v.ok) return res.status(401).json({ success: false, error: v.error });
    if (!firestoreEnabled)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });
    const { feedbackPageUrl, smsServerPort } = req.body || {};
    const settings = await dbV2.updateGlobalAdminSettings({
      feedbackUrls: { feedbackPageUrl },
      serverConfig: { smsServerPort: smsServerPort || "3002" },
    });
    res.json({ success: true, settings });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

// Admin: get server configuration (Requirement 2)
app.get("/admin/server-config", async (req, res) => {
  try {
    // Allow read without strict admin auth for settings page display
    if (!firestoreEnabled)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });
    const settings = await dbV2.getGlobalAdminSettings();
    const config = settings?.serverConfig || { smsServerPort: "3002" };
    res.json({ success: true, config });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

// DEBUG: Inspect token claims and Firestore user record for the provided Bearer token.
// Helpful when custom claims were recently changed and you need to confirm propagation.
app.get("/admin/check-token", async (req, res) => {
  try {
    const authz = req.headers.authorization || req.headers.Authorization || "";
    if (!authz.startsWith("Bearer "))
      return res
        .status(400)
        .json({ success: false, error: "Missing Bearer token" });

    const idToken = String(authz).slice(7).trim();
    if (!firebaseAdmin) {
      return res
        .status(503)
        .json({ success: false, error: "Firebase Admin SDK not configured" });
    }

    try {
      // Verify the token signature and decode claims
      const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);

      // Optionally fetch Firestore users doc for this uid (if DB enabled)
      let userDoc = null;
      if (
        firestoreEnabled &&
        decoded?.uid &&
        typeof dbV2?.getUserById === "function"
      ) {
        try {
          userDoc = await dbV2.getUserById(decoded.uid);
        } catch (e) {
          userDoc = { error: String(e?.message || e) };
        }
      }

      return res.json({ success: true, decoded, userDoc });
    } catch (e) {
      return res
        .status(400)
        .json({ success: false, error: e?.message || String(e) });
    }
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, error: e?.message || String(e) });
  }
});

// Admin: expose non-sensitive server info to help debug Firebase/service-account
app.get("/admin/server-info", async (req, res) => {
  try {
    const candidateFiles = [
      "firebase-service-account.json",
      "firebase-service-account1.json",
      "firebase-service-account2.json",
    ].map((f) => ({ file: f, exists: fs.existsSync(path.join(__dirname, f)) }));

    const envHas = !!process.env.FIREBASE_ADMIN_JSON;
    const info = {
      firestoreEnabled: !!firestoreEnabled,
      firebaseProjectId: firebaseProjectId || null,
      serviceAccountCandidates: candidateFiles,
      envFirebaseAdminJson: envHas,
      nodeEnv: process.env.NODE_ENV || null,
    };
    return res.json({ success: true, info });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, error: e?.message || String(e) });
  }
});

// Admin: list all users with their companies (original client logins)
app.get("/admin/users", async (req, res) => {
  try {
    const v = await verifyFirebaseAdmin(req);
    if (!v.ok) return res.status(401).json({ success: false, error: v.error });
    if (!firestoreEnabled)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });
    const users = await dbV2.getAllUsersWithCompanies();

    // If Firebase Admin SDK is available, enrich users with canonical Firebase email/login
    if (firebaseAdmin && Array.isArray(users) && users.length > 0) {
      try {
        // Collect UIDs
        const uids = users.map((u) => u.uid).filter(Boolean);
        if (uids.length > 0) {
          const fetched = await Promise.all(
            uids.map(async (uid) => {
              try {
                const userRecord = await firebaseAdmin.auth().getUser(uid);
                return {
                  uid,
                  email: userRecord.email,
                  phone: userRecord.phoneNumber,
                };
              } catch (e) {
                return { uid, email: null, phone: null };
              }
            })
          );
          const byUid = {};
          for (const f of fetched) byUid[f.uid] = f;
          // Merge
          const merged = users.map((u) => ({
            ...u,
            loginEmail: u.email || (u.uid && byUid[u.uid]?.email) || null,
            firebasePhone: u.phone || (u.uid && byUid[u.uid]?.phone) || null,
          }));
          return res.json({ success: true, users: merged });
        }
      } catch (e) {
        console.warn(
          "[admin:users] firebase enrichment failed",
          e.message || e
        );
      }
    }

    res.json({ success: true, users });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

// NEW: Get ALL Firebase Authentication users (actual login accounts)
app.get("/admin/firebase-users", async (req, res) => {
  try {
    const v = await verifyFirebaseAdmin(req);
    if (!v.ok) return res.status(401).json({ success: false, error: v.error });

    if (!firebaseAdmin) {
      return res.status(503).json({
        success: false,
        error: "Firebase Admin SDK not configured",
      });
    }

    // List all Firebase Auth users
    const allUsers = [];
    let pageToken;

    try {
      do {
        const listUsersResult = await firebaseAdmin
          .auth()
          .listUsers(1000, pageToken);
        listUsersResult.users.forEach((userRecord) => {
          allUsers.push({
            uid: userRecord.uid,
            email: userRecord.email || null,
            phoneNumber: userRecord.phoneNumber || null,
            displayName: userRecord.displayName || null,
            photoURL: userRecord.photoURL || null,
            disabled: userRecord.disabled || false,
            emailVerified: userRecord.emailVerified || false,
            createdAt: userRecord.metadata.creationTime,
            lastSignInAt: userRecord.metadata.lastSignInTime,
            providerData: userRecord.providerData || [],
          });
        });
        pageToken = listUsersResult.pageToken;
      } while (pageToken);

      // Try to enrich with Firestore company data if available
      if (firestoreEnabled && dbV2) {
        try {
          const firestoreUsers = await dbV2.getAllUsersWithCompanies();
          const firestoreByUid = {};
          for (const fsu of firestoreUsers) {
            if (fsu.uid) firestoreByUid[fsu.uid] = fsu;
          }

          // Merge with profile data included
          const enriched = allUsers.map((u) => ({
            ...u,
            company: firestoreByUid[u.uid]?.company || null,
            firestoreEmail: firestoreByUid[u.uid]?.email || null,
            role: firestoreByUid[u.uid]?.role || "user",
            profile: firestoreByUid[u.uid]?.profile || null,
          }));

          return res.json({ success: true, users: enriched });
        } catch (enrichErr) {
          console.warn(
            "[admin:firebase-users] Firestore enrichment failed:",
            enrichErr.message
          );
        }
      }

      res.json({ success: true, users: allUsers });
    } catch (authError) {
      console.error("[admin:firebase-users] Auth listing failed:", authError);
      res.status(500).json({
        success: false,
        error: `Failed to list users: ${authError.message}`,
      });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

// Dashboard stats for client (using old clients collection structure)
app.get("/api/dashboard/stats", async (req, res) => {
  try {
    if (!firestoreEnabled) {
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });
    }

    const companyId = String(req.query.companyId || "").trim();
    if (!companyId) {
      return res
        .status(400)
        .json({ success: false, error: "Missing companyId" });
    }

    const firestore = firebaseAdmin.firestore();

    // Load or create company (legacy helper)
    let company = await dbV2.getCompanyById(companyId);
    if (!company) {
      console.log(
        `[dashboard/stats] Company ${companyId} not found, creating...`
      );
      try {
        const newCompany = await dbV2.createCompany({
          companyName: "New Company",
          adminId: "",
          email: "",
        });
        company = newCompany || { companyId, companyName: "New Company" };
      } catch (createErr) {
        console.error("[dashboard/stats] Failed to create company:", createErr);
        company = { companyId, companyName: "New Company", email: "" };
      }
    }

    // PREFERRED: Read counts from consolidated dashboard/current document
    const dashboardRef = firestore
      .collection("clients")
      .doc(companyId)
      .collection("dashboard")
      .doc("current");
    const dashboardSnap = await dashboardRef.get();
    let messageCount = 0;
    let feedbackCount = 0;
    let negative_feedback_count = 0; // Count of negative comments from Firebase
    let avgRating = 0;
    let sentimentCounts = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };

    if (dashboardSnap.exists) {
      const data = dashboardSnap.data() || {};
      messageCount = Number(data.message_count || 0);
      feedbackCount = Number(data.feedback_count || 0);
      negative_feedback_count = Number(data.negative_feedback_count || 0); // Read negative count from Firebase
      // If we ever stored per-sentiment counts, compute derived sentiment counts from negative_comments or graph_data later.
    } else {
      // Fallback legacy computation (only runs once until dashboard is created by recordMessage / feedback submission)
      console.log(
        "[dashboard/stats] Dashboard doc missing; computing fallback counts."
      );
      // Count messages from messages collection (legacy) so existing data not lost.
      const messagesSnap = await firestore
        .collection("messages")
        .where("companyId", "==", companyId)
        .get();
      messageCount = messagesSnap.size;

      const feedbackSnap = await firestore
        .collection("feedback")
        .where("companyId", "==", companyId)
        .get();
      let totalRating = 0;
      feedbackSnap.forEach((doc) => {
        const fb = doc.data();
        feedbackCount++;
        if (typeof fb.rating === "number") totalRating += fb.rating;
        const sentiment = (
          fb.sentiment ||
          fb.sentimentLabel ||
          ""
        ).toUpperCase();
        if (sentiment === "POSITIVE") sentimentCounts.POSITIVE++;
        else if (sentiment === "NEGATIVE") sentimentCounts.NEGATIVE++;
        else sentimentCounts.NEUTRAL++;
      });
      avgRating = feedbackCount > 0 ? totalRating / feedbackCount : 0;
    }

    // Derive sentiment counts if dashboard has negative_comments array (treat others as neutral for now)
    if (dashboardSnap.exists) {
      const d = dashboardSnap.data() || {};
      const negs = Array.isArray(d.negative_comments)
        ? d.negative_comments
        : [];
      // We only explicitly track negative comments; other sentiments require querying feedback collection (optional optimization)
      if (negs.length > 0) sentimentCounts.NEGATIVE = negs.length;
      // Optionally attempt to reconstruct positive/neutral from graph_data if present
      if (
        d.graph_data &&
        Array.isArray(d.graph_data.labels) &&
        Array.isArray(d.graph_data.values)
      ) {
        try {
          const labels = d.graph_data.labels;
          const values = d.graph_data.values;
          labels.forEach((lbl, idx) => {
            const v = Number(values[idx] || 0);
            if (String(lbl).toUpperCase() === "POSITIVE")
              sentimentCounts.POSITIVE = v;
            else if (String(lbl).toUpperCase() === "NEUTRAL")
              sentimentCounts.NEUTRAL = v;
            else if (String(lbl).toUpperCase() === "NEGATIVE")
              sentimentCounts.NEGATIVE = v; // override if present
          });
        } catch {}
      }
    }

    // Feedback URL from admin settings
    let feedbackPageUrl = "";
    try {
      const adminSettings = await dbV2.getGlobalAdminSettings();
      feedbackPageUrl = adminSettings?.feedbackUrls?.feedbackPageUrl || "";
    } catch (adminErr) {
      console.warn(
        "[dashboard/stats] Failed to load admin feedback URL:",
        adminErr
      );
    }

    // Business name via profile override
    let businessName = company.companyName || "";
    try {
      const profileDoc = await firestore
        .collection("clients")
        .doc(companyId)
        .collection("profile")
        .doc("main")
        .get();
      if (profileDoc.exists) {
        const pd = profileDoc.data();
        if (pd && pd.name) {
          businessName = pd.name;
          console.log(
            `[dashboard/stats] ✅ Found client name from profile: ${businessName}`
          );
        }
      }
    } catch (profileErr) {
      console.warn(
        "[dashboard/stats] Could not fetch client profile, using company name:",
        profileErr.message
      );
    }

    console.log(
      `[dashboard/stats] Stats for ${companyId}: messages=${messageCount}, feedback=${feedbackCount}`
    );

    res.json({
      success: true,
      stats: {
        messageCount,
        feedbackCount,
        negative_feedback_count, // Include negative comment count in API response
        avgRating: Math.round(avgRating * 10) / 10,
        sentimentCounts,
      },
      profile: {
        businessName,
        feedbackPageLink: feedbackPageUrl,
        googleReviewLink: company.googleReviewLink || "",
        email: company.email || "",
      },
    });
  } catch (e) {
    console.error("[dashboard/stats] Error:", e);
    res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

// Get messages for Message Activity chart - NEW ENDPOINT
app.get("/api/dashboard/messages", async (req, res) => {
  try {
    if (!firestoreEnabled) {
      return res.status(503).json({
        success: false,
        error: "Database not configured",
        messages: [],
      });
    }

    const companyId = String(req.query.companyId || "").trim();
    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "Missing companyId",
        messages: [],
      });
    }

    console.log(
      `[dashboard/messages] Fetching messages for company: ${companyId}`
    );

    // Initialize Firestore
    const firestore = firebaseAdmin.firestore();

    // Fetch all messages for this company from Firebase (without orderBy to avoid index requirement)
    const messagesSnap = await firestore
      .collection("messages")
      .where("companyId", "==", companyId)
      .get();

    const messages = [];
    messagesSnap.forEach((doc) => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        timestamp: data.timestamp?.toDate?.() || new Date(data.timestamp),
        messageType: data.messageType || "sms",
        customerPhone: data.customerPhone || "",
        customerName: data.customerName || "",
        status: data.status || "sent",
      });
    });

    console.log(`[dashboard/messages] Found ${messages.length} messages`);

    res.json({
      success: true,
      messages: messages,
      count: messages.length,
    });
  } catch (e) {
    console.error("[dashboard/messages] Error:", e);
    res.status(500).json({
      success: false,
      error: e.message || String(e),
      messages: [],
    });
  }
});

// Get company credentials
app.get("/api/company/credentials", async (req, res) => {
  try {
    if (!firestoreEnabled)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });

    const companyId = String(req.query.companyId || "").trim();
    if (!companyId)
      return res
        .status(400)
        .json({ success: false, error: "Missing companyId" });

    const company = await dbV2.getCompanyById(companyId);
    if (!company)
      return res
        .status(404)
        .json({ success: false, error: "Company not found" });

    // Return credentials (be careful with this in production - add auth!)
    res.json({
      success: true,
      credentials: {
        twilioAccountSid: company.twilioAccountSid || "",
        twilioAuthToken: company.twilioAuthToken || "",
        twilioPhoneNumber: company.twilioPhoneNumber || "",
        twilioMessagingServiceSid: company.twilioMessagingServiceSid || "",
        whatsappAccountSid: company.whatsappAccountSid || "",
        whatsappAuthToken: company.whatsappAuthToken || "",
        whatsappPhoneNumber: company.whatsappPhoneNumber || "",
        feedbackUrl: company.feedbackUrl || "",
        googleRedirectUrl: company.googleRedirectUrl || "",
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

// Update business name
app.post("/api/company/update-name", express.json(), async (req, res) => {
  try {
    console.log("[api:update-name] Headers:", req.headers);
    console.log("[api:update-name] Raw body:", req.body);

    if (!firestoreEnabled) {
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });
    }

    const companyId = String(req.body?.companyId || "").trim();
    const businessName = String(req.body?.businessName || "").trim();

    console.log("[api:update-name] Parsed:", {
      companyId: companyId || "MISSING",
      businessName: businessName || "MISSING",
    });

    if (!companyId) {
      return res
        .status(400)
        .json({ success: false, error: "Missing companyId" });
    }
    if (!businessName) {
      return res
        .status(400)
        .json({ success: false, error: "Missing businessName" });
    }

    const firestore = firebaseAdmin.firestore();

    // Update client profile (merge, no read first)
    await firestore
      .collection("clients")
      .doc(companyId)
      .collection("profile")
      .doc("main")
      .set(
        {
          name: businessName,
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      );

    // Also update companies collection
    try {
      await firestore.collection("companies").doc(companyId).set(
        {
          companyName: businessName,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (companiesErr) {
      console.warn(
        "[api:update-name] companies update skipped:",
        companiesErr.message
      );
    }

    console.log(`[api:update-name] ✅ Updated ${companyId} -> ${businessName}`);
    return res.json({ success: true, businessName });
  } catch (e) {
    console.error("[api:update-name] Error:", e);
    return res
      .status(500)
      .json({ success: false, error: e.message || String(e) });
  }
});

// Save feedback and Google review links
app.post("/api/company/links", async (req, res) => {
  try {
    if (!firestoreEnabled)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });

    // Defensive body parsing: some hosting platforms or proxies may
    // deliver requests in a manner that results in express.json() not
    // populating req.body. In those cases we attempt to recover from
    // req.rawBody (set by the verify hook) or by parsing the request
    // stream manually. Also accept a company id from common headers.
    let parsedBody =
      req.body && Object.keys(req.body || {}).length > 0 ? req.body : null;
    if (!parsedBody) {
      try {
        if (req.rawBody) {
          parsedBody = JSON.parse(String(req.rawBody || "{}"));
          console.log("[api:links] Parsed body from req.rawBody");
        } else {
          // Manual stream read fallback
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const raw = Buffer.concat(chunks).toString("utf8");
          if (raw && raw.trim()) {
            parsedBody = JSON.parse(raw);
            console.log("[api:links] Parsed body from manual stream read");
          }
        }
      } catch (parseErr) {
        console.warn(
          "[api:links] Failed to parse request body:",
          parseErr && (parseErr.message || parseErr)
        );
        parsedBody = parsedBody || {}; // keep working with an empty object
      }
    }

    const headerCompanyId = String(
      req.headers["x-company-id"] ||
        req.headers["x-client-id"] ||
        req.headers["x-companyid"] ||
        req.headers["x-clientid"] ||
        req.headers["companyid"] ||
        ""
    ).trim();

    const companyId = String(
      (parsedBody &&
        (parsedBody.companyId ||
          parsedBody.clientId ||
          parsedBody.company ||
          parsedBody.client)) ||
        headerCompanyId ||
        req.query.companyId ||
        ""
    ).trim();

    const googleReviewLink = String(
      (parsedBody &&
        (parsedBody.googleReviewLink ||
          parsedBody.google_review_link ||
          parsedBody.googleRedirectUrl ||
          parsedBody.feedbackUrl)) ||
        ""
    ).trim();

    console.log("[api:links] incoming save request:", {
      companyId: companyId || "(none)",
      headerCompanyId,
      bodyPresent: !!parsedBody,
    });

    if (!companyId)
      return res
        .status(400)
        .json({ success: false, error: "Missing companyId" });

    // Note: feedbackPageLink removed - managed in admin global settings
    // Only save Google Review URL per client

    // Get Firestore instance
    const firestore = firebaseAdmin.firestore();

    // Save to OLD structure (clients collection) for backward compatibility
    await firestore.collection("clients").doc(companyId).set(
      {
        google_review_link: googleReviewLink,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );

    // Save to NEW V2 structure (companies collection)
    await firestore.collection("companies").doc(companyId).set(
      {
        googleReviewLink: googleReviewLink,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    console.log(`[api:links] Saved Google Review link for ${companyId}`);

    res.json({
      success: true,
      message: "Google Review link saved successfully",
      googleReviewLink,
    });
  } catch (e) {
    console.error("[api:links] Error:", e);
    res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

// REMOVED: WhatsApp tracking endpoint
// We no longer track SMS/WhatsApp sends in messages collection.
// Only negative feedback from customers is stored in messages collection.
// This keeps the messages collection clean and focused on negative feedback only.

// Save company credentials
app.post("/api/company/credentials", async (req, res) => {
  try {
    if (!firestoreEnabled)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });

    const companyId = String(req.body.companyId || "").trim();
    if (!companyId)
      return res
        .status(400)
        .json({ success: false, error: "Missing companyId" });

    const credentials = {
      twilioAccountSid: req.body.twilioAccountSid || "",
      twilioAuthToken: req.body.twilioAuthToken || "",
      twilioPhoneNumber: req.body.twilioPhoneNumber || "",
      twilioMessagingServiceSid: req.body.twilioMessagingServiceSid || "",
      whatsappAccountSid: req.body.whatsappAccountSid || "",
      whatsappAuthToken: req.body.whatsappAuthToken || "",
      whatsappPhoneNumber: req.body.whatsappPhoneNumber || "",
      feedbackUrl: req.body.feedbackUrl || "",
      googleRedirectUrl: req.body.googleRedirectUrl || "",
    };

    await dbV2.updateCompanyCredentials(companyId, credentials);
    console.log(
      `[api:credentials] Updated credentials for company: ${companyId}`
    );

    // Return updated credentials to the client for UI refresh
    const updated = await dbV2.getCompanyById(companyId);
    res.json({
      success: true,
      message: "Credentials saved successfully",
      credentials: {
        twilioAccountSid: updated.twilioAccountSid || "",
        twilioAuthToken: updated.twilioAuthToken || "",
        twilioPhoneNumber: updated.twilioPhoneNumber || "",
        twilioMessagingServiceSid: updated.twilioMessagingServiceSid || "",
        whatsappAccountSid: updated.whatsappAccountSid || "",
        whatsappAuthToken: updated.whatsappAuthToken || "",
        whatsappPhoneNumber: updated.whatsappPhoneNumber || "",
        feedbackUrl: updated.feedbackUrl || "",
        googleRedirectUrl: updated.googleRedirectUrl || "",
      },
    });
  } catch (e) {
    console.error("[api:credentials:error]", e);
    res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

// Update company profile (business name)
app.post("/api/company/profile", async (req, res) => {
  try {
    if (!firestoreEnabled)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });

    const companyId = String(req.body.companyId || "").trim();
    if (!companyId)
      return res
        .status(400)
        .json({ success: false, error: "Missing companyId" });

    const { companyName, photoURL } = req.body;

    // Build update object with only provided fields
    const updateData = {};
    if (companyName) updateData.companyName = companyName;
    if (photoURL) updateData.photoURL = photoURL;

    if (Object.keys(updateData).length === 0)
      return res
        .status(400)
        .json({ success: false, error: "No fields to update" });

    await dbV2.updateCompanyCredentials(companyId, updateData);
    console.log(
      `[api:profile] Updated company profile for: ${companyId}`,
      Object.keys(updateData)
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (e) {
    console.error("[api:profile:error]", e);
    res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

// GET profile endpoint to retrieve photoURL and other profile data
app.get("/api/company/profile", async (req, res) => {
  try {
    if (!firestoreEnabled)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });

    const companyId = String(req.query.companyId || "").trim();
    if (!companyId)
      return res
        .status(400)
        .json({ success: false, error: "Missing companyId" });

    const profile = await dbV2.getCompanyCredentials(companyId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: "Profile not found",
      });
    }

    res.json({
      success: true,
      profile: {
        companyName: profile.companyName || "",
        photoURL: profile.photoURL || "",
        // Include other profile fields as needed
      },
    });
  } catch (e) {
    console.error("[api:profile:get:error]", e);
    res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

// DELETE account endpoint - permanently deletes user account and all data
app.delete("/api/account/delete", async (req, res) => {
  try {
    if (!firestoreEnabled)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });

    // Be resilient: some clients/hosts may not populate req.body for DELETE.
    // Try a few fallbacks: req.body, req.rawBody (captured by express.json verify),
    // query params, and common headers (x-company-id).
    let bodyData = req.body && Object.keys(req.body).length ? req.body : null;

    if (!bodyData && req.rawBody) {
      try {
        bodyData = JSON.parse(req.rawBody);
        console.log("[api:account:delete] Parsed body from rawBody");
      } catch (e) {
        console.warn(
          "[api:account:delete] Failed to parse req.rawBody, raw length=",
          String(req.rawBody || "").length
        );
      }
    }

    // Manual stream read fallback (some hosting proxies require it)
    if (
      !bodyData &&
      req.headers["content-type"] &&
      String(req.headers["content-type"]).includes("application/json")
    ) {
      try {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks).toString("utf8");
        if (raw && raw.trim()) {
          bodyData = JSON.parse(raw);
          console.log(
            "[api:account:delete] Parsed body from manual stream read"
          );
        }
      } catch (e) {
        console.warn(
          "[api:account:delete] Manual stream read failed:",
          e?.message || e
        );
      }
    }

    // Finally, fall back to query params or headers
    const companyId =
      (bodyData && (bodyData.companyId || bodyData.company_id)) ||
      req.query.companyId ||
      req.query.company_id ||
      req.headers["x-company-id"] ||
      req.headers["x-companyid"];
    const auth_uid =
      (bodyData && (bodyData.auth_uid || bodyData.authUid || bodyData.auth)) ||
      req.query.auth_uid ||
      req.query.authUid ||
      req.headers["x-auth-uid"] ||
      req.headers["x-authuid"];

    if (!companyId || !auth_uid) {
      console.error("[api:account:delete] Missing companyId/auth_uid", {
        bodyData,
        query: req.query,
        headers: req.headers && {
          "x-company-id": req.headers["x-company-id"],
          "x-auth-uid": req.headers["x-auth-uid"],
        },
      });
      return res.status(400).json({
        success: false,
        error:
          "Missing companyId or auth_uid. Provide JSON body, query params or x-company-id/x-auth-uid headers.",
      });
    }

    console.log(
      `[api:account:delete] Attempting to delete account: ${companyId}`
    );

    const firestore = firebaseAdmin.firestore();

    // ---------------------------
    // Authorization & ownership
    // ---------------------------
    const authHeader =
      req.headers.authorization || req.headers.Authorization || "";
    let callerUid = null;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      const idToken = String(authHeader).slice(7).trim();
      try {
        const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
        callerUid = decoded?.uid || decoded?.sub || null;
      } catch (tokErr) {
        console.warn(
          "[api:account:delete] ID token verify failed:",
          tokErr?.message || tokErr
        );
      }
    }

    if (!callerUid) {
      console.error(
        "[api:account:delete] Missing/invalid Authorization token for delete request"
      );
      return res.status(401).json({
        success: false,
        error: "Missing or invalid Authorization token for account deletion",
      });
    }

    // Attempt to derive the caller's company id (owner) so we can confirm ownership
    let callerCompanyId = null;
    try {
      if (dbV2 && typeof dbV2.getUserById === "function") {
        const u = await dbV2.getUserById(callerUid).catch(() => null);
        if (u && u.companyId) callerCompanyId = String(u.companyId);
      }
    } catch (e) {
      console.warn(
        "[api:account:delete] dbV2.getUserById failed:",
        e?.message || e
      );
    }
    if (!callerCompanyId) {
      try {
        const q = firestore
          .collection("clients")
          .where("auth_uid", "==", String(callerUid))
          .limit(1);
        const snap = await q.get();
        if (!snap.empty) callerCompanyId = snap.docs[0].id;
      } catch (e) {
        console.warn(
          "[api:account:delete] owner company lookup failed:",
          e?.message || e
        );
      }
    }

    // Caller must either be the auth_uid being deleted or map to the same companyId
    const ownedByCaller =
      String(callerUid) === String(auth_uid) ||
      (callerCompanyId && String(callerCompanyId) === String(companyId));
    if (!ownedByCaller) {
      console.error("[api:account:delete] Unauthorized delete attempt", {
        callerUid,
        callerCompanyId,
        targetCompanyId: companyId,
        targetAuthUid: auth_uid,
      });
      return res.status(403).json({
        success: false,
        error: "Unauthorized: caller does not own this account",
      });
    }

    // ---------------------------
    // Helper: recursive delete
    // ---------------------------
    async function deleteDocRecursively(docRef) {
      try {
        // Prefer server-side recursiveDelete when available (fast, atomic)
        const maybeRecursive =
          firestore.recursiveDelete || firestore.recursiveDelete;
        if (typeof maybeRecursive === "function") {
          try {
            await firestore.recursiveDelete(docRef);
            console.log(
              "[api:account:delete] recursiveDelete used for",
              docRef.path
            );
            return;
          } catch (e) {
            console.warn(
              "[api:account:delete] recursiveDelete failed, falling back:",
              e?.message || e
            );
          }
        }

        // Fallback: iterate subcollections and delete documents recursively
        const subcols = await docRef.listCollections();
        for (const col of subcols) {
          let last = null;
          // Page through documents in the collection to avoid memory spikes
          while (true) {
            let q = col.orderBy("__name__").limit(500);
            if (last) q = q.startAfter(last);
            const snap = await q.get();
            if (snap.empty) break;
            // Delete each document recursively
            for (const d of snap.docs) {
              await deleteDocRecursively(d.ref);
            }
            if (snap.size < 500) break;
            last = snap.docs[snap.docs.length - 1];
          }
        }

        // Finally delete the doc itself (if it exists)
        try {
          await docRef.delete();
          console.log("[api:account:delete] Deleted doc:", docRef.path);
        } catch (e) {
          // If delete fails because doc missing, ignore
          console.warn(
            "[api:account:delete] docRef.delete() error:",
            docRef.path,
            e?.message || e
          );
        }
      } catch (e) {
        console.error(
          "[api:account:delete] recursive delete error for",
          docRef.path,
          e?.message || e
        );
        // Best-effort: attempt a single delete as last resort
        try {
          await docRef.delete();
        } catch (ignored) {}
      }
    }

    // ---------------------------
    // Perform deletions
    // ---------------------------
    // Derive target email BEFORE deleting auth user so we can remove any
    // client documents that reference the same email (prevents easy
    // resurrection of data when user signs up again with same email).
    let targetEmail = null;
    try {
      const userRec = await firebaseAdmin
        .auth()
        .getUser(String(auth_uid))
        .catch(() => null);
      if (userRec && userRec.email) {
        targetEmail = String(userRec.email).toLowerCase();
      }
    } catch (e) {
      console.warn(
        "[api:account:delete] getUser(auth_uid) failed:",
        e?.message || e
      );
    }

    // Delete Firebase Auth user (best-effort)
    try {
      await firebaseAdmin.auth().deleteUser(String(auth_uid));
      console.log(
        `[api:account:delete] ✅ Deleted Firebase Auth user: ${auth_uid}`
      );
    } catch (authError) {
      console.warn(
        `[api:account:delete] ⚠️ Failed to delete Auth user (may not exist):`,
        authError?.message || authError
      );
    }

    // Delete main client document(s) recursively
    try {
      const clientCompanyRef = firestore
        .collection("clients")
        .doc(String(companyId));
      await deleteDocRecursively(clientCompanyRef).catch((e) =>
        console.warn(
          "[api:account:delete] failed to delete clients/{companyId} recursively:",
          e?.message || e
        )
      );

      // Also attempt to delete the auth_uid keyed client doc (if different)
      if (String(auth_uid) !== String(companyId)) {
        const clientAuthRef = firestore
          .collection("clients")
          .doc(String(auth_uid));
        await deleteDocRecursively(clientAuthRef).catch((e) =>
          console.warn(
            "[api:account:delete] failed to delete clients/{auth_uid} recursively:",
            e?.message || e
          )
        );
      }
    } catch (e) {
      console.warn(
        "[api:account:delete] client recursive delete error:",
        e?.message || e
      );
    }

    // If we derived a target email, delete any other clients keyed by that
    // email (handles legacy flows where client docs were created under
    // arbitrary IDs but retained the email field). Also try to remove
    // any companies documents that reference the same email.
    let deletedByEmailCount = 0;
    if (targetEmail) {
      try {
        const q = firestore
          .collection("clients")
          .where("email", "==", targetEmail);
        const snap = await q.get();
        for (const d of snap.docs) {
          // Skip the ones we've already deleted above
          if ([String(companyId), String(auth_uid)].includes(d.id)) continue;
          try {
            await deleteDocRecursively(d.ref);
            deletedByEmailCount += 1;
            console.log(
              "[api:account:delete] Removed client doc by email:",
              d.ref.path
            );
          } catch (e) {
            console.warn(
              "[api:account:delete] Failed to delete client by email:",
              d.ref.path,
              e?.message || e
            );
          }
        }
      } catch (e) {
        console.warn(
          "[api:account:delete] clients by-email deletion failed:",
          e?.message || e
        );
      }

      // Also try companies collection by owner/contact email fields commonly used
      try {
        const companyQ = firestore
          .collection("companies")
          .where("email", "==", targetEmail);
        const companySnap = await companyQ.get();
        for (const c of companySnap.docs) {
          try {
            await deleteDocRecursively(c.ref);
            console.log(
              "[api:account:delete] Removed company doc by email:",
              c.ref.path
            );
          } catch (e) {
            console.warn(
              "[api:account:delete] Failed to delete company by email:",
              c.ref.path,
              e?.message || e
            );
          }
        }
      } catch (e) {
        console.warn(
          "[api:account:delete] companies by-email deletion failed:",
          e?.message || e
        );
      }

      // LEGACY: Delete tenant entries (tenants/{tenantId}) that reference this email
      if (targetEmail) {
        try {
          const profilesSnap = await firestore
            .collectionGroup("profiles")
            .where("email", "==", String(targetEmail))
            .get();
          for (const p of profilesSnap.docs) {
            try {
              const parts = p.ref.path.split("/");
              const tIndex = parts.indexOf("tenants");
              if (tIndex >= 0 && parts[tIndex + 1]) {
                const tenantId = parts[tIndex + 1];
                const tenantRef = firestore.collection("tenants").doc(tenantId);
                await deleteDocRecursively(tenantRef).catch((err) =>
                  console.warn(
                    "[api:account:delete] Failed to delete tenant:",
                    tenantId,
                    err?.message || err
                  )
                );
                console.log(
                  `[api:account:delete] Removed legacy tenant ${tenantId} for email ${targetEmail}`
                );
              }
            } catch (e) {
              console.warn(
                "[api:account:delete] Failed processing profile->tenant cleanup:",
                e?.message || e
              );
            }
          }
        } catch (e) {
          console.warn(
            "[api:account:delete] Tenant cleanup by email failed:",
            e?.message || e
          );
        }
      }
    }

    // Delete company document (companies/{companyId})
    try {
      const companyRef = firestore
        .collection("companies")
        .doc(String(companyId));
      await deleteDocRecursively(companyRef).catch((e) =>
        console.warn(
          "[api:account:delete] failed to delete companies/{companyId}:",
          e?.message || e
        )
      );
    } catch (e) {
      console.warn(
        "[api:account:delete] company doc delete error:",
        e?.message || e
      );
    }

    // Delete subscriptions root doc
    try {
      await firestore
        .collection("subscriptions")
        .doc(String(companyId))
        .delete()
        .catch(() => null);
    } catch (e) {
      console.warn(
        "[api:account:delete] subscriptions doc delete failed:",
        e?.message || e
      );
    }

    // Helper to delete large result sets in batches
    async function deleteCollectionWhere(collectionName, field, value) {
      try {
        const colRef = firestore.collection(collectionName);
        let q = colRef.where(field, "==", value).orderBy("__name__").limit(500);
        let totalDeleted = 0;
        while (true) {
          const snap = await q.get();
          if (snap.empty) break;
          const batch = firestore.batch();
          snap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          totalDeleted += snap.size;
          if (snap.size < 500) break;
          const last = snap.docs[snap.docs.length - 1];
          q = colRef
            .where(field, "==", value)
            .orderBy("__name__")
            .startAfter(last)
            .limit(500);
        }
        return totalDeleted;
      } catch (e) {
        console.warn(
          `[api:account:delete] deleteCollectionWhere ${collectionName} failed:`,
          e?.message || e
        );
        return 0;
      }
    }

    const feedbackDeleted = await deleteCollectionWhere(
      "feedback",
      "companyId",
      String(companyId)
    );
    const customersDeleted = await deleteCollectionWhere(
      "customers",
      "companyId",
      String(companyId)
    );

    // Delete top-level messages (legacy storage) to ensure no message
    // history can resurrect the client when they re-register.
    let messagesDeleted = 0;
    try {
      messagesDeleted = await deleteCollectionWhere(
        "messages",
        "companyId",
        String(companyId)
      );
      console.log(
        `[api:account:delete] Deleted top-level messages for ${companyId}: ${messagesDeleted}`
      );
    } catch (e) {
      console.warn(
        "[api:account:delete] Failed to delete top-level messages:",
        e?.message || e
      );
    }

    // Remove any v2 'users' records that reference this company (so dbV2 mappings
    // don't point to a deleted company). This prevents automatic re-linking.
    let usersByCompanyDeleted = 0;
    try {
      usersByCompanyDeleted = await deleteCollectionWhere(
        "users",
        "companyId",
        String(companyId)
      );
      console.log(
        `[api:account:delete] Deleted v2 users mapped to company ${companyId}: ${usersByCompanyDeleted}`
      );
    } catch (e) {
      console.warn(
        "[api:account:delete] Failed to remove v2 users for company:",
        e?.message || e
      );
    }

    // Delete the canonical users record for the auth UID (if present)
    try {
      await firestore
        .collection("users")
        .doc(String(auth_uid))
        .delete()
        .catch(() => null);
      console.log(
        `[api:account:delete] Removed users/${String(auth_uid)} (if existed)`
      );
    } catch (e) {
      console.warn(
        "[api:account:delete] Failed to delete users/{auth_uid} doc:",
        e?.message || e
      );
    }

    // If we derived a target email, delete any users docs that match that email
    // (prevents resurrection via email-based lookups)
    if (targetEmail) {
      try {
        const byEmailSnap = await firestore
          .collection("users")
          .where("email", "==", String(targetEmail))
          .get();
        for (const u of byEmailSnap.docs) {
          try {
            await u.ref.delete();
            console.log(
              "[api:account:delete] Deleted user by email:",
              u.ref.path
            );
          } catch (ue) {
            console.warn(
              "[api:account:delete] Failed to delete user doc:",
              ue?.message || ue
            );
          }
        }
      } catch (e) {
        console.warn(
          "[api:account:delete] Failed to query users by email:",
          e?.message || e
        );
      }
    }

    // Delete any clientAuth credentials stored in legacy clientAuth collection
    try {
      await firestore
        .collection("clientAuth")
        .doc(String(auth_uid))
        .delete()
        .catch(() => null);
      // Also remove any clientAuth records keyed by email to be safe
      if (targetEmail) {
        const authByEmail = await firestore
          .collection("clientAuth")
          .where("email", "==", String(targetEmail))
          .get();
        for (const doc of authByEmail.docs) {
          try {
            await doc.ref.delete();
            console.log(
              "[api:account:delete] Deleted legacy clientAuth:",
              doc.ref.path
            );
          } catch (err) {
            console.warn(
              "[api:account:delete] Failed to delete clientAuth doc:",
              err?.message || err
            );
          }
        }
      }
    } catch (e) {
      console.warn(
        "[api:account:delete] Failed to clean clientAuth records:",
        e?.message || e
      );
    }

    // Try removing any legacy activity log entries keyed by companyId
    try {
      const activityDeletedA = await deleteCollectionWhere(
        "activity_logs",
        "companyId",
        String(companyId)
      );
      const activityDeletedB = await deleteCollectionWhere(
        "activityLogs",
        "companyId",
        String(companyId)
      );
      if (activityDeletedA || activityDeletedB) {
        console.log(
          `[api:account:delete] Purged activity logs for ${companyId}: ${
            activityDeletedA + activityDeletedB
          }`
        );
      }
    } catch (e) {
      console.warn(
        "[api:account:delete] Failed to delete activity logs:",
        e?.message || e
      );
    }

    console.log(
      `[api:account:delete] ✅ Successfully deleted account: ${companyId}`
    );
    console.log(
      `[api:account:delete] Deleted feedback entries: ${feedbackDeleted}, customers: ${customersDeleted}`
    );

    res.json({ success: true, message: "Account deleted successfully" });
  } catch (e) {
    console.error("[api:account:delete:error]", e);
    res.status(500).json({
      success: false,
      error: e.message || "Failed to delete account",
    });
  }
});

app.get("/tenant/stats", async (req, res) => {
  try {
    if (!firestoreEnabled)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });
    const tenantKey = String(req.query.tenantKey || "").trim();
    if (!tenantKey)
      return res
        .status(400)
        .json({ success: false, error: "Missing tenantKey" });
    const stats = await db.getTenantStats(tenantKey);
    res.json({ success: true, stats });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

// ------------------------------------------------------------------
// Simple Feedback Store (JSON file). Suitable for demos/small projects.
// For production, replace with a proper database.
// ------------------------------------------------------------------
const FEEDBACK_STORE = path.resolve(process.cwd(), "feedback-store.json");
function readFeedbackStore() {
  try {
    if (!fs.existsSync(FEEDBACK_STORE)) return [];
    const raw = fs.readFileSync(FEEDBACK_STORE, "utf8");
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
    return [];
  } catch (e) {
    console.warn("[feedback:store:read:error]", e.message || e);
    return [];
  }
}
function writeFeedbackStore(list) {
  try {
    fs.writeFileSync(FEEDBACK_STORE, JSON.stringify(list, null, 2), "utf8");
    return true;
  } catch (e) {
    console.warn("[feedback:store:write:error]", e.message || e);
    return false;
  }
}

// POST /feedback → persist a feedback entry
// body: { tenantKey: string, sentiment: 'positive'|'negative', text: string, phone?: string, rating?: number, customerId?: string, id?: string }
// New DB-backed feedback endpoint (keeps same path for drop-in move). Falls back to file store when DB not enabled.
app.post("/feedback", async (req, res) => {
  // CRITICAL FIX: Manually collect body chunks if Express didn't parse it
  // This handles Render.com proxy issues where body arrives but isn't parsed
  let bodyData = req.body;

  // If body is empty but we have a content-type header, manually read the stream
  if (
    (!bodyData || Object.keys(bodyData).length === 0) &&
    req.headers["content-type"]?.includes("application/json")
  ) {
    console.log(
      "[feedback:manual-parse] Body is empty, attempting manual stream read..."
    );
    try {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const rawBody = Buffer.concat(chunks).toString("utf8");
      console.log(
        `[feedback:manual-parse] Read ${rawBody.length} bytes from stream`
      );
      console.log(`[feedback:manual-parse] Raw: ${rawBody.substring(0, 200)}`);
      if (rawBody.trim()) {
        bodyData = JSON.parse(rawBody);
        console.log(
          "[feedback:manual-parse] ✅ Successfully parsed manual body"
        );
      }
    } catch (parseErr) {
      console.error("[feedback:manual-parse] ❌ Failed:", parseErr.message);
    }
  }

  // Log everything about the request
  console.log(`[feedback:request] ==================`);
  console.log(`[feedback:request] Method: ${req.method}`);
  console.log(
    `[feedback:request] Content-Type: ${req.headers["content-type"]}`
  );
  console.log(`[feedback:request] Origin: ${req.headers.origin}`);
  console.log(`[feedback:request] Body type: ${typeof bodyData}`);
  console.log(
    `[feedback:request] Body keys: ${
      bodyData ? Object.keys(bodyData).join(", ") : "null"
    }`
  );
  console.log(
    `[feedback:request] Transfer-Encoding: ${
      req.headers["transfer-encoding"] || "none"
    }`
  );
  console.log(
    `[feedback:request] Content-Length: ${
      req.headers["content-length"] || "none"
    }`
  );

  // Try to parse body if it's a string
  let parsedBody = bodyData;
  if (typeof bodyData === "string" && bodyData.trim()) {
    try {
      parsedBody = JSON.parse(bodyData);
      console.log("[feedback:parse] Successfully parsed string body");
    } catch (e) {
      console.warn("[feedback:parse] Failed to parse body as JSON:", e.message);
    }
  }

  // Log parsed body for debugging
  try {
    console.log(
      "[feedback:parsedBody]",
      parsedBody ? JSON.stringify(parsedBody).substring(0, 200) : "none"
    );
  } catch (e) {}

  const b = parsedBody || {};
  const tenantKey = String(b.tenantKey || "").trim();
  const sentiment =
    b.sentiment === "positive"
      ? "positive"
      : b.sentiment === "negative"
      ? "negative"
      : null;
  // Accept both 'text' and 'comment' from clients
  const text = (b.text ?? b.comment ?? "").toString();
  const phone = b.phone ? String(b.phone) : undefined;
  const rating = typeof b.rating === "number" ? b.rating : undefined;
  const customerId = b.customerId ? String(b.customerId) : undefined;
  // New: allow passing companyId so we can persist into the new dashboard-friendly schema
  const companyId = b.companyId ? String(b.companyId) : undefined;

  // DEBUG: Log all received data
  console.log(`[feedback:received] ==================`);
  console.log(`[feedback:received] tenantKey: ${tenantKey}`);
  console.log(`[feedback:received] sentiment: ${sentiment}`);
  console.log(`[feedback:received] companyId: ${companyId}`);
  console.log(`[feedback:received] text: ${text?.substring(0, 50)}...`);
  console.log(`[feedback:received] phone: ${phone}`);
  console.log(`[feedback:received] rating: ${rating}`);
  console.log(`[feedback:received] ==================`);
  // Accept either tenantKey (legacy) OR companyId (v2). For positive feedback we require text;
  // for negative feedback we allow empty text (privacy-first) as long as tenantKey/companyId present.
  if (!tenantKey && !companyId) {
    console.warn("[feedback:validation] Missing tenantKey AND companyId", {
      body: b,
    });
    return res.status(400).json({
      success: false,
      error: "Missing tenantKey or companyId",
      received: b,
    });
  }
  if (!sentiment) {
    console.warn("[feedback:validation] Missing sentiment", { body: b });
    return res.status(400).json({
      success: false,
      error: "Missing or invalid sentiment (must be 'positive' or 'negative')",
      received: b,
    });
  }
  if (sentiment === "positive" && !text) {
    console.warn("[feedback:validation] Missing text for positive feedback", {
      body: b,
    });
    return res.status(400).json({
      success: false,
      error: "Missing text/comment for positive feedback",
      received: b,
    });
  }
  // Privacy: if negative, avoid storing raw text; store phone only or a reference
  const payload = {
    tenantKey,
    sentiment,
    phone,
    rating,
    customerId,
  };
  // Only add text for positive feedback (privacy for negative)
  if (sentiment === "positive" && text) {
    payload.text = String(text).slice(0, 5000);
  }
  if (firestoreEnabled) {
    try {
      // Always write legacy (tenantKey-based) record for backward compatibility
      console.log("[feedback:db] 📝 Inserting legacy feedback entry...");
      const legacyEntry = await db.insertFeedback(payload);
      console.log("[feedback:db] ✅ Legacy entry inserted:", legacyEntry?.id);

      // Also write into V2 schema if companyId is provided so dashboard stats include it
      let v2Entry = null;
      if (companyId) {
        try {
          console.log("[feedback:db] 📝 Inserting V2 feedback entry...");
          v2Entry = await dbV2.insertFeedback({
            companyId,
            userId: null,
            customerName: undefined,
            customerPhone: phone || "",
            rating: rating || undefined,
            // Only store comment for positive to respect privacy
            comment: sentiment === "positive" ? text : "",
            sentiment,
            source: "web",
            isAnonymous: sentiment === "negative",
          });
        } catch (e) {
          console.warn("[feedback:v2:insert:error]", e.message || e);
        }
      }

      // NEW REQUIREMENT: Store ONLY negative feedback in clients/{clientId}/dashboard/current
      // This is what will show in the client's "Negative Comments" section
      if (sentiment === "negative" && companyId) {
        console.log(
          `[feedback:negative] 🔵 Starting negative comment storage for client ${companyId}`
        );
        try {
          const firestore = firebaseAdmin.firestore();

          // Create negative comment object with ID
          const commentId = `comment_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          const negativeCommentData = {
            id: commentId,
            companyId: companyId, // Client ID from feedback URL
            customerPhone: phone || "Unknown",
            customerName: "Customer", // We don't have name from feedback form
            commentText: text, // The negative comment text
            rating: rating || null,
            sentiment: "negative",
            source: "feedback_link", // Came from feedback link
            status: "active",
            createdAt: firebaseAdmin.firestore.Timestamp.now(),
          };

          console.log(
            `[feedback:negative] 📝 Saving to clients/${companyId}/dashboard/current...`
          );

          // Update client dashboard in Firebase
          const dashboardRef = firestore
            .collection("clients")
            .doc(companyId)
            .collection("dashboard")
            .doc("current");

          const dashboardDoc = await dashboardRef.get();
          if (!dashboardDoc.exists) {
            // Initialize dashboard if it doesn't exist
            await dashboardRef.set({
              feedback_count: 1,
              message_count: 0,
              negative_feedback_count: 1,
              negative_comments: [negativeCommentData], // Array of negative comments
              graph_data: { labels: [], values: [] },
              last_updated: firebaseAdmin.firestore.Timestamp.now(),
            });
            console.log(
              `[feedback:negative] ✅ Created dashboard and stored negative comment for client ${companyId}`
            );
          } else {
            // Add comment to array and increment counters
            await dashboardRef.update({
              negative_feedback_count:
                firebaseAdmin.firestore.FieldValue.increment(1),
              feedback_count: firebaseAdmin.firestore.FieldValue.increment(1),
              negative_comments:
                firebaseAdmin.firestore.FieldValue.arrayUnion(
                  negativeCommentData
                ),
              last_updated: firebaseAdmin.firestore.Timestamp.now(),
            });
            console.log(
              `[feedback:negative] ✅ Added negative comment to dashboard for client ${companyId}`
            );
          }
          console.log(
            `[dashboard:stats] ✅ Updated stats for client ${companyId}: "${text.substring(
              0,
              50
            )}..."`
          );

          // -----------------------------------------------------------------
          // NEW STORE: Per-phone negative comments collection
          // Path: clients/{companyId}/negative_comments/{phoneId}
          // phoneId is the numeric-only phone (fallback 'unknown'). We append timestamped
          // entries to a comments array so future UI can show history grouped by phone.
          // This does NOT replace the existing dashboard aggregate array; it complements it.
          // -----------------------------------------------------------------
          try {
            const rawPhone = (phone || "unknown").toString();
            const phoneId = rawPhone.replace(/[^+0-9]/g, "") || "unknown";
            const phoneDocRef = firestore
              .collection("clients")
              .doc(companyId)
              .collection("negative_comments")
              .doc(phoneId);

            await phoneDocRef.set(
              {
                phone: rawPhone,
                updated_at: firebaseAdmin.firestore.Timestamp.now(),
                count: firebaseAdmin.firestore.FieldValue.increment(1),
                comments: firebaseAdmin.firestore.FieldValue.arrayUnion({
                  id: negativeCommentData.id,
                  text: negativeCommentData.commentText,
                  rating: negativeCommentData.rating,
                  createdAt: negativeCommentData.createdAt,
                  source: negativeCommentData.source,
                  status: negativeCommentData.status,
                }),
              },
              { merge: true }
            );
            console.log(
              `[feedback:negative] 📦 Stored per-phone doc clients/${companyId}/negative_comments/${phoneId}`
            );
          } catch (perPhoneErr) {
            console.warn(
              "[feedback:negative:per-phone:error]",
              perPhoneErr.message || perPhoneErr
            );
          }
        } catch (e) {
          console.error("[feedback:negative:store:error] ❌ FULL ERROR:", e);
          console.error(
            "[feedback:negative:store:error] Error message:",
            e.message
          );
          console.error(
            "[feedback:negative:store:error] Error stack:",
            e.stack
          );
        }
      } else if (sentiment === "negative" && !companyId) {
        console.warn(
          `[feedback:negative] ⚠️ Negative feedback received but NO companyId provided!`
        );
        console.warn(
          `[feedback:negative] ⚠️ tenantKey: ${tenantKey}, phone: ${phone}`
        );
        console.warn(
          `[feedback:negative] ⚠️ This negative comment will NOT be stored in negative_comments collection`
        );
      } else if (sentiment === "positive" && companyId) {
        // For positive feedback, only update feedback_count (not negative_feedback_count)
        try {
          const firestore = firebaseAdmin.firestore();
          const dashboardRef = firestore
            .collection("clients")
            .doc(companyId)
            .collection("dashboard")
            .doc("current");

          const dashboardDoc = await dashboardRef.get();
          if (!dashboardDoc.exists()) {
            await dashboardRef.set({
              feedback_count: 1,
              message_count: 0,
              negative_feedback_count: 0,
              negative_comments: [], // Initialize empty array for negative comments
              graph_data: { labels: [], values: [] },
              last_updated: firebaseAdmin.firestore.Timestamp.now(),
            });
          } else {
            await dashboardRef.update({
              feedback_count: firebaseAdmin.firestore.FieldValue.increment(1),
              last_updated: firebaseAdmin.firestore.Timestamp.now(),
            });
          }
          console.log(
            `[dashboard:stats] ✅ Updated feedback count for client ${companyId}`
          );
        } catch (e) {
          console.warn("[feedback:positive:dashboard:error]", e.message || e);
        }
      }
      return res.json({ success: true, entry: legacyEntry, v2Entry });
    } catch (e) {
      console.error("[feedback:endpoint:error] ❌ CRITICAL ERROR:");
      console.error("[feedback:endpoint:error] Message:", e.message);
      console.error("[feedback:endpoint:error] Stack:", e.stack);
      console.error("[feedback:endpoint:error] Full error:", e);
      return res
        .status(500)
        .json({ success: false, error: e.message || String(e) });
    }
  } else {
    const store = readFeedbackStore();
    const entry = {
      id: b.id || `fb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      ...payload,
      date: new Date().toISOString(),
    };
    store.push(entry);
    const ok = writeFeedbackStore(store);
    if (!ok)
      return res
        .status(500)
        .json({ success: false, error: "Failed to persist feedback" });
    return res.json({ success: true, entry });
  }
});

// GET /feedback?tenantKey=...&sentiment=negative|positive&since=isoString
app.get("/feedback", async (req, res) => {
  // Support both tenantKey (legacy) and companyId (v2)
  const tenantKey = String(req.query.tenantKey || "").trim();
  const companyId = String(req.query.companyId || "").trim();

  if (!tenantKey && !companyId)
    return res
      .status(400)
      .json({ success: false, error: "Missing tenantKey or companyId" });

  const sentiment =
    req.query.sentiment === "positive" || req.query.sentiment === "negative"
      ? req.query.sentiment
      : undefined;
  const since = req.query.since ? new Date(String(req.query.since)) : null;

  if (firestoreEnabled) {
    try {
      // Use v2 API if companyId provided, otherwise legacy
      if (companyId) {
        const entries = await dbV2.getFeedbackByCompany(companyId, {
          sentiment: sentiment,
          since:
            since && !isNaN(since.getTime()) ? since.toISOString() : undefined,
        });
        return res.json({ success: true, count: entries.length, entries });
      } else {
        const entries = await db.listFeedback(tenantKey, {
          sentiment: sentiment,
          since:
            since && !isNaN(since.getTime()) ? since.toISOString() : undefined,
        });
        return res.json({ success: true, count: entries.length, entries });
      }
    } catch (e) {
      console.error("[feedback:get:error]", e);
      return res
        .status(500)
        .json({ success: false, error: e.message || String(e) });
    }
  } else {
    const list = readFeedbackStore().filter((e) => e.tenantKey === tenantKey);
    const filtered = list.filter((e) => {
      if (sentiment && e.sentiment !== sentiment) return false;
      if (since && !isNaN(since.getTime())) {
        const d = new Date(e.date);
        if (d < since) return false;
      }
      return true;
    });
    // newest first
    filtered.sort((a, b) => +new Date(b.date) - +new Date(a.date));
    res.json({ success: true, count: filtered.length, entries: filtered });
  }
});

// DELETE /feedback?tenantKey=...&sentiment=negative|positive
// Purge feedback entries for a tenant (optionally filter by sentiment)
app.delete("/feedback", async (req, res) => {
  const tenantKey = String(req.query.tenantKey || "").trim();
  if (!tenantKey)
    return res.status(400).json({ success: false, error: "Missing tenantKey" });
  const sentiment =
    req.query.sentiment === "positive" || req.query.sentiment === "negative"
      ? req.query.sentiment
      : undefined;
  if (firestoreEnabled) {
    try {
      const removed = await db.deleteFeedbackForTenant(tenantKey, sentiment);
      return res.json({ success: true, removed });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, error: e.message || String(e) });
    }
  } else {
    const store = readFeedbackStore();
    const before = store.length;
    const kept = store.filter(
      (e) =>
        !(
          e.tenantKey === tenantKey &&
          (!sentiment || e.sentiment === sentiment)
        )
    );
    const removed = before - kept.length;
    const ok = writeFeedbackStore(kept);
    if (!ok)
      return res
        .status(500)
        .json({ success: false, error: "Failed to update feedback store" });
    return res.json({ success: true, removed });
  }
});

// GET /admin/negative-comments - Get ALL negative comments from ALL clients
app.get("/admin/negative-comments", async (req, res) => {
  try {
    if (!firestoreEnabled) {
      return res.status(503).json({
        success: false,
        error: "Firestore not enabled",
      });
    }

    console.log(
      "[admin:negative-comments] 🔍 Fetching all negative comments from all clients..."
    );

    const firestore = firebaseAdmin.firestore();
    const clientsSnapshot = await firestore.collection("clients").get();

    const allNegativeComments = [];
    let clientsWithComments = 0;
    let totalComments = 0;

    for (const clientDoc of clientsSnapshot.docs) {
      const clientId = clientDoc.id;

      try {
        // Get dashboard for this client
        const dashboardDoc = await firestore
          .collection("clients")
          .doc(clientId)
          .collection("dashboard")
          .doc("current")
          .get();

        if (dashboardDoc.exists) {
          const data = dashboardDoc.data();
          const comments = data.negative_comments || [];

          if (comments.length > 0) {
            clientsWithComments++;
            totalComments += comments.length;

            // Get client profile for business name
            let businessName = "Unknown";
            try {
              const profileDoc = await firestore
                .collection("clients")
                .doc(clientId)
                .collection("profile")
                .doc("main")
                .get();

              if (profileDoc.exists) {
                const profileData = profileDoc.data();
                businessName =
                  profileData.name || profileData.businessName || clientId;
              }
            } catch (profileErr) {
              console.warn(
                `[admin:negative-comments] Could not fetch profile for ${clientId}`
              );
            }

            // Add each comment with client context
            comments.forEach((comment) => {
              allNegativeComments.push({
                ...comment,
                clientId,
                businessName,
                negativeFeedbackCount: data.negative_feedback_count || 0,
                totalFeedbackCount: data.feedback_count || 0,
              });
            });
          }
        }
      } catch (clientErr) {
        console.warn(
          `[admin:negative-comments] Error processing client ${clientId}:`,
          clientErr.message
        );
      }
    }

    // Sort by createdAt (newest first)
    allNegativeComments.sort((a, b) => {
      const dateA = a.createdAt?._seconds
        ? new Date(a.createdAt._seconds * 1000)
        : new Date(a.createdAt || 0);
      const dateB = b.createdAt?._seconds
        ? new Date(b.createdAt._seconds * 1000)
        : new Date(b.createdAt || 0);
      return dateB - dateA;
    });

    console.log(
      `[admin:negative-comments] ✅ Found ${totalComments} negative comments from ${clientsWithComments} clients`
    );

    return res.json({
      success: true,
      totalClients: clientsSnapshot.size,
      clientsWithNegativeComments: clientsWithComments,
      totalNegativeComments: totalComments,
      comments: allNegativeComments,
    });
  } catch (e) {
    console.error("[admin:negative-comments:error]", e);
    return res.status(500).json({
      success: false,
      error: e.message || String(e),
    });
  }
});

// DEBUG: list registered routes (temporary)
app.get("/__routes", (req, res) => {
  try {
    const routes = [];
    const stack = app._router && app._router.stack ? app._router.stack : [];
    for (const layer of stack) {
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods || {})
          .filter((m) => layer.route.methods[m])
          .map((m) => m.toUpperCase());
        routes.push({ path: layer.route.path, methods });
      } else if (
        layer.name === "router" &&
        layer.handle &&
        layer.handle.stack
      ) {
        for (const s of layer.handle.stack) {
          if (s.route && s.route.path) {
            const methods = Object.keys(s.route.methods || {})
              .filter((m) => s.route.methods[m])
              .map((m) => m.toUpperCase());
            routes.push({ path: s.route.path, methods });
          }
        }
      }
    }
    res.json({ ok: true, count: routes.length, routes });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

// Consolidated diagnostics: quick verify + token basic + env presence (no network duplication if not provided)
app.get("/wa-diagnostics", async (req, res) => {
  const accessToken =
    req.query.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId =
    req.query.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const out = {
    env: {
      hasTokenEnv: !!process.env.WHATSAPP_ACCESS_TOKEN,
      hasPhoneIdEnv: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    },
    provided: {
      hasTokenParam: !!req.query.accessToken,
      hasPhoneIdParam: !!req.query.phoneNumberId,
    },
  };
  if (!accessToken || !phoneNumberId) {
    return res.status(400).json({
      success: false,
      error: "Missing accessToken or phoneNumberId",
      ...out,
    });
  }
  try {
    const verifyUrl = `https://graph.facebook.com/v22.0/${encodeURIComponent(
      String(phoneNumberId)
    )}?fields=id,display_phone_number,verified_name`;
    const verifyResp = await fetch(verifyUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const verifyData = await verifyResp.json().catch(() => ({}));
    out["verify"] = {
      ok: verifyResp.ok,
      status: verifyResp.status,
      data: verifyData,
    };
    if (!verifyResp.ok)
      return res.status(verifyResp.status).json({
        success: false,
        error: verifyData?.error?.message || "Verify failed",
        details: out,
      });
    return res.json({ success: true, diagnostics: out });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, error: e.message || String(e), details: out });
  }
});

// ========== NEGATIVE COMMENTS API ENDPOINTS ==========

/**
 * GET /api/debug/negative-feedback-test?companyId=xxx
 * Debug endpoint to verify negative feedback storage is working
 */
app.get("/api/debug/negative-feedback-test", async (req, res) => {
  const companyId = String(req.query.companyId || "").trim();

  if (!companyId) {
    return res.status(400).json({
      success: false,
      error: "Missing companyId parameter",
    });
  }

  if (!firestoreEnabled || !firebaseAdmin?.apps?.length) {
    return res.status(503).json({
      success: false,
      error: "Firestore not enabled",
    });
  }

  try {
    const firestore = firebaseAdmin.firestore();
    const dashboardRef = firestore
      .collection("clients")
      .doc(companyId)
      .collection("dashboard")
      .doc("current");

    const dashboardDoc = await dashboardRef.get();

    if (!dashboardDoc.exists) {
      return res.json({
        success: true,
        message: "Dashboard document does not exist yet",
        exists: false,
        companyId,
      });
    }

    const data = dashboardDoc.data();
    return res.json({
      success: true,
      exists: true,
      companyId,
      dashboard: {
        message_count: data?.message_count || 0,
        feedback_count: data?.feedback_count || 0,
        negative_feedback_count: data?.negative_feedback_count || 0,
        negative_comments_count: Array.isArray(data?.negative_comments)
          ? data.negative_comments.length
          : 0,
        negative_comments_sample: Array.isArray(data?.negative_comments)
          ? data.negative_comments.slice(0, 2).map((c) => ({
              id: c.id,
              text: c.commentText?.substring(0, 50) + "...",
              phone: c.customerPhone,
              createdAt: c.createdAt,
            }))
          : [],
        last_updated: data?.last_updated,
      },
    });
  } catch (e) {
    console.error("[debug:negative-feedback-test:error]", e);
    return res.status(500).json({
      success: false,
      error: e.message || String(e),
    });
  }
});

/**
 * GET /api/negative-comments?companyId=xxx
 * Fetch negative comments for a specific client from Firebase
 * Returns both dashboard comments and per-phone grouped comments
 */
app.get("/api/negative-comments", async (req, res) => {
  const companyId = String(req.query.companyId || "").trim();

  if (!companyId) {
    return res.status(400).json({
      success: false,
      error: "Missing companyId parameter",
    });
  }

  if (!firestoreEnabled || !firebaseAdmin?.apps?.length) {
    return res.status(503).json({
      success: false,
      error: "Firestore not enabled",
      comments: [],
      count: 0,
    });
  }

  try {
    const firestore = firebaseAdmin.firestore();
    const dashboardRef = firestore
      .collection("clients")
      .doc(companyId)
      .collection("dashboard")
      .doc("current");

    const dashboardDoc = await dashboardRef.get();

    if (!dashboardDoc.exists) {
      console.log(
        `[negative-comments:fetch] ℹ️ No dashboard found for client ${companyId}`
      );
      return res.json({
        success: true,
        count: 0,
        comments: [],
        perPhone: [],
      });
    }

    const dashboardData = dashboardDoc.data();
    const comments = dashboardData.negative_comments || [];

    console.log(
      `[negative-comments:fetch] 📊 Found ${comments.length} total comments in dashboard for client ${companyId}`
    );

    // CRITICAL SECURITY: Filter to ONLY show comments that belong to THIS client
    // This prevents Client A from seeing Client B's comments
    const activeComments = comments
      .filter((c) => {
        const belongsToThisClient = c.companyId === companyId;
        const isActive = c.status === "active";

        if (!belongsToThisClient) {
          console.warn(
            `[negative-comments:fetch] ⚠️ SECURITY: Filtering out comment ${c.id} - belongs to ${c.companyId}, requested by ${companyId}`
          );
        }

        return belongsToThisClient && isActive;
      })
      .sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA; // Descending order (newest first)
      });

    console.log(
      `[negative-comments:fetch] ✅ Fetched ${activeComments.length} active comments belonging to client ${companyId}`
    );

    // Also fetch per-phone negative comments collection
    const perPhoneComments = [];
    try {
      const negativeCommentsSnap = await firestore
        .collection("clients")
        .doc(companyId)
        .collection("negative_comments")
        .get();

      negativeCommentsSnap.forEach((doc) => {
        const data = doc.data();
        perPhoneComments.push({
          phoneId: doc.id,
          phone: data.phone || "",
          count: data.count || 0,
          updated_at: data.updated_at,
          comments: data.comments || [],
        });
      });

      console.log(
        `[negative-comments:fetch] ✅ Fetched ${activeComments.length} dashboard comments and ${perPhoneComments.length} per-phone groups for client ${companyId}`
      );
    } catch (perPhoneErr) {
      console.warn(
        `[negative-comments:fetch] ⚠️ Failed to fetch per-phone comments:`,
        perPhoneErr.message
      );
    }

    return res.json({
      success: true,
      count: activeComments.length,
      comments: activeComments,
      perPhone: perPhoneComments,
    });
  } catch (e) {
    console.error("[negative-comments:get:error]", e);
    return res.status(500).json({
      success: false,
      error: e.message || String(e),
    });
  }
});

/**
 * DELETE /api/negative-comments?id=xxx&companyId=xxx
 * Delete a negative comment from Firebase (with ownership verification)
 */
app.delete("/api/negative-comments", async (req, res) => {
  const commentId = String(req.query.id || "").trim();
  const companyId = String(req.query.companyId || "").trim();

  if (!commentId || !companyId) {
    return res.status(400).json({
      success: false,
      error: "Missing id or companyId parameter",
    });
  }

  if (!firestoreEnabled || !firebaseAdmin?.apps?.length) {
    return res.status(503).json({
      success: false,
      error: "Firestore not enabled",
    });
  }

  try {
    const firestore = firebaseAdmin.firestore();
    const dashboardRef = firestore
      .collection("clients")
      .doc(companyId)
      .collection("dashboard")
      .doc("current");

    // Get current dashboard data
    const dashboardDoc = await dashboardRef.get();
    if (!dashboardDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Dashboard not found",
      });
    }

    const dashboardData = dashboardDoc.data();
    const comments = dashboardData.negative_comments || [];

    // Find the comment to delete
    const commentToDelete = comments.find((c) => c.id === commentId);
    if (!commentToDelete) {
      return res.status(404).json({
        success: false,
        error: "Comment not found",
      });
    }

    // Verify ownership
    if (commentToDelete.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized: This comment belongs to another client",
      });
    }

    // Remove the comment from array
    await dashboardRef.update({
      negative_comments:
        firebaseAdmin.firestore.FieldValue.arrayRemove(commentToDelete),
      negative_feedback_count: firebaseAdmin.firestore.FieldValue.increment(-1),
      last_updated: firebaseAdmin.firestore.Timestamp.now(),
    });

    console.log(
      `[negative-comments:delete] ✅ Deleted comment ${commentId} for client ${companyId}`
    );
    console.log(
      `[dashboard:stats] ✅ Decremented negative_feedback_count for client ${companyId}`
    );

    return res.json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (e) {
    console.error("[negative-comments:delete:error]", e);
    return res.status(500).json({
      success: false,
      error: e.message || String(e),
    });
  }
});

/**
 * GET /api/dashboard/stats?companyId=xxx
 * Fetch dashboard statistics from Firebase
 */
app.get("/api/dashboard/stats", async (req, res) => {
  const companyId = String(req.query.companyId || "").trim();

  if (!companyId) {
    return res.status(400).json({
      success: false,
      error: "Missing companyId parameter",
    });
  }

  try {
    const firestore = firebaseAdmin.firestore();
    const dashboardRef = firestore
      .collection("clients")
      .doc(companyId)
      .collection("dashboard")
      .doc("current");

    const dashboardDoc = await dashboardRef.get();

    if (!dashboardDoc.exists()) {
      // Initialize dashboard if it doesn't exist
      await dashboardRef.set({
        feedback_count: 0,
        message_count: 0,
        negative_feedback_count: 0,
        graph_data: { labels: [], values: [] },
        last_updated: new Date(),
      });

      console.log(
        `[dashboard:stats] ⚠️ Initialized empty dashboard for client ${companyId}`
      );

      return res.json({
        success: true,
        stats: {
          feedbackCount: 0,
          messageCount: 0,
          negativeFeedbackCount: 0,
          avgRating: 0,
          sentimentCounts: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
        },
      });
    }

    const data = dashboardDoc.data();

    // Calculate avg rating and sentiment counts from feedback collection
    const feedbackSnapshot = await firestore
      .collection("feedback")
      .where("companyId", "==", companyId)
      .get();

    let totalRating = 0;
    let ratingCount = 0;
    const sentimentCounts = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };

    feedbackSnapshot.docs.forEach((doc) => {
      const fb = doc.data();
      if (typeof fb.rating === "number") {
        totalRating += fb.rating;
        ratingCount++;
      }
      if (fb.sentiment === "positive") sentimentCounts.POSITIVE++;
      else if (fb.sentiment === "negative") sentimentCounts.NEGATIVE++;
      else if (fb.sentiment === "neutral") sentimentCounts.NEUTRAL++;
    });

    const avgRating = ratingCount > 0 ? totalRating / ratingCount : 0;

    console.log(
      `[dashboard:stats] ✅ Fetched stats for client ${companyId}: feedback=${data.feedback_count}, negative=${data.negative_feedback_count}`
    );

    return res.json({
      success: true,
      stats: {
        feedbackCount: data.feedback_count || 0,
        messageCount: data.message_count || 0,
        negativeFeedbackCount: data.negative_feedback_count || 0,
        avgRating: avgRating,
        sentimentCounts: sentimentCounts,
      },
    });
  } catch (e) {
    console.error("[dashboard:stats:error]", e);
    return res.status(500).json({
      success: false,
      error: e.message || String(e),
    });
  }
});

// ========== END NEGATIVE COMMENTS API ==========

// ==========================================
// ADMIN AUTH MIDDLEWARE + ADMIN ROUTES
// Adds a verifyAdminToken middleware and a couple of safe admin routes.
// Relies on existing `firebaseAdmin` initialization above. If the Admin
// SDK is not initialized this will return 503 so the rest of the server
// remains functional.
// ==========================================

async function verifyAdminToken(req, res, next) {
  try {
    if (!firebaseAdmin) {
      return res
        .status(503)
        .json({ success: false, error: "firebase-admin-not-initialized" });
    }

    const authHeader =
      req.headers.authorization || req.headers.Authorization || "";
    if (!authHeader || !String(authHeader).startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ success: false, error: "No authorization token provided" });
    }

    const idToken = String(authHeader).slice(7).trim();
    if (!idToken) {
      return res.status(401).json({ success: false, error: "Empty token" });
    }

    const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
    // Support boolean or string 'true'
    const isAdmin =
      decoded && (decoded.admin === true || decoded.admin === "true");
    if (!isAdmin) {
      return res.status(401).json({
        success: false,
        error: "Insufficient privileges (need admin role)",
      });
    }

    req.user = decoded;
    return next();
  } catch (err) {
    console.error(
      "[admin:verify] token verification error:",
      err?.message || err
    );
    return res
      .status(401)
      .json({ success: false, error: "Invalid or expired token" });
  }
}

// Helper: set admin custom claim on a user (safe when firebaseAdmin available)
async function setAdminClaim(userEmail) {
  try {
    if (!firebaseAdmin) throw new Error("firebase-admin-not-initialized");
    const user = await firebaseAdmin.auth().getUserByEmail(String(userEmail));
    await firebaseAdmin.auth().setCustomUserClaims(user.uid, { admin: true });
    console.log(
      `[admin:setClaim] ✅ Admin claim set for ${userEmail} (${user.uid})`
    );
    return { success: true };
  } catch (e) {
    console.error("[admin:setClaim] error", e?.message || e);
    return { success: false, error: e?.message || String(e) };
  }
}

async function checkUserClaims(userEmail) {
  try {
    if (!firebaseAdmin) throw new Error("firebase-admin-not-initialized");
    const user = await firebaseAdmin.auth().getUserByEmail(String(userEmail));
    console.log(
      "[admin:checkClaims] customClaims for",
      userEmail,
      user.customClaims
    );
    return user.customClaims || null;
  } catch (e) {
    console.error("[admin:checkClaims] error", e?.message || e);
    return null;
  }
}

// Protect all /admin routes and their subpaths with the middleware by default
// Use '/admin' (prefix) instead of '/admin/*' because path-to-regexp used by
// recent Express versions rejects the explicit '*' token (causes a PathError).
app.use("/admin", verifyAdminToken);

// Example admin endpoints
app.get("/admin/credentials", verifyAdminToken, async (req, res) => {
  try {
    // Prefer dbV2 helper if available
    let settings = null;
    if (dbV2 && typeof dbV2.getGlobalAdminSettings === "function") {
      settings = await dbV2.getGlobalAdminSettings().catch(() => null);
    }
    if (!settings && firestoreEnabled) {
      try {
        const snap = await firebaseAdmin
          .firestore()
          .collection("settings")
          .doc("global")
          .get();
        settings = snap.exists ? snap.data() : null;
      } catch (e) {
        // ignore
      }
    }
    // Only return non-sensitive fields
    const safe = {
      twilio: {
        phoneNumber: settings?.twilio?.phoneNumber || null,
        messagingServiceSid: settings?.twilio?.messagingServiceSid || null,
      },
      dodo: {
        apiBase: settings?.dodo?.apiBase || null,
      },
    };
    return res.json({ success: true, credentials: safe });
  } catch (e) {
    console.error("[admin/credentials] error", e?.message || e);
    return res
      .status(500)
      .json({ success: false, error: e?.message || String(e) });
  }
});

app.get("/admin/global-stats", verifyAdminToken, async (req, res) => {
  try {
    if (!firestoreEnabled)
      return res
        .status(503)
        .json({ success: false, error: "firestore-disabled" });
    const firestore = firebaseAdmin.firestore();
    // Count clients (note: may be expensive for very large projects)
    const clientsSnap = await firestore.collection("clients").get();
    let usersCount = 0;
    try {
      const list = await firebaseAdmin.auth().listUsers(1000);
      usersCount = Array.isArray(list.users) ? list.users.length : 0;
    } catch (e) {
      // ignore auth listing failures (requires proper permissions)
    }
    return res.json({
      success: true,
      stats: { clients: clientsSnap.size, firebaseUsers: usersCount },
    });
  } catch (e) {
    console.error("[admin/global-stats] error", e?.message || e);
    return res
      .status(500)
      .json({ success: false, error: e?.message || String(e) });
  }
});

app.get("/admin/firebase-users", verifyAdminToken, async (req, res) => {
  try {
    if (!firebaseAdmin)
      return res
        .status(503)
        .json({ success: false, error: "firebase-admin-not-initialized" });
    const listUsersResult = await firebaseAdmin.auth().listUsers(1000);
    const users = (listUsersResult.users || []).map((user) => ({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      disabled: user.disabled,
      emailVerified: user.emailVerified,
      createdAt: user.metadata?.creationTime,
      lastSignInAt: user.metadata?.lastSignInTime,
      role: user.customClaims?.admin ? "admin" : "user",
    }));
    return res.json({ success: true, users });
  } catch (e) {
    console.error("[admin/firebase-users] error", e?.message || e);
    return res
      .status(500)
      .json({ success: false, error: e?.message || String(e) });
  }
});

// Temporary setup endpoint - REMOVED AFTER INITIAL SETUP
// app.post("/setup-admin", async (req, res) => {
//   try {
//     const { email, secretKey } = req.body || {};
//     if (!process.env.ADMIN_SETUP_SECRET) {
//       return res
//         .status(500)
//         .json({ success: false, error: "ADMIN_SETUP_SECRET not configured" });
//     }
//     if (secretKey !== process.env.ADMIN_SETUP_SECRET) {
//       return res
//         .status(403)
//         .json({ success: false, error: "Invalid secret key" });
//     }
//     if (!email)
//       return res.status(400).json({ success: false, error: "email required" });
//     const result = await setAdminClaim(email);
//     return res.json(result);
//   } catch (e) {
//     console.error("[setup-admin] error", e?.message || e);
//     return res
//       .status(500)
//       .json({ success: false, error: e?.message || String(e) });
//   }
// });

// Static file serving for SPA (must be AFTER all API routes)
app.use(express.static(path.join(__dirname, "dist")));

// Start server (previously removed accidentally)
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`SMS API listening on http://localhost:${PORT}`);
  // Log route count after a tick so routes are registered
  setTimeout(() => {
    try {
      const stack = app._router?.stack || [];
      const routeCount = stack.filter((l) => l.route && l.route.path).length;
      console.log(`[startup] registeredRoutes=${routeCount}`);
    } catch {}
  }, 50);
});
