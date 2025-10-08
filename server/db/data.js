import { firestore } from "./firebaseAdmin.js";

const ROOT = {
  tenants: "tenants",
  admin: "admin",
  clientAuth: "clientAuth", // server-only
};

function assertDb() {
  if (!firestore) throw new Error("Firestore not initialized");
}

async function ensureTenant(tenantId, tenantData) {
  assertDb();
  const tRef = firestore.collection(ROOT.tenants).doc(tenantId);
  const snap = await tRef.get();
  if (!snap.exists) {
    const now = new Date().toISOString();
    const data = {
      name: tenantData?.name || tenantId,
      subscription_status: "trial",
      created_at: now,
    };
    // Only add email if it's defined
    if (tenantData?.email) {
      data.email = tenantData.email;
    }
    await tRef.set(data, { merge: true });
  }
  return tRef;
}

export async function upsertClient(c) {
  // c: { name, email, tenantKey, activityStatus?, googleId? }
  assertDb();
  const now = new Date().toISOString();
  const tenantId = c.tenantKey;
  const tRef = await ensureTenant(tenantId, { email: c.email, name: tenantId });
  // create/update profile under /tenants/{tenantId}/profiles
  const profiles = tRef.collection("profiles");
  // Use deterministic ID by email to avoid dupes
  const profileId = Buffer.from(String(c.email).toLowerCase())
    .toString("base64")
    .replace(/=+$/, "");
  const pRef = profiles.doc(profileId);
  const payload = {
    id: profileId,
    full_name: c.name,
    email: c.email,
    role: "owner",
    auth_uid: profileId,
    activity_status: c.activityStatus || "active",
    created_at: now,
    updated_at: now,
  };
  await pRef.set(payload, { merge: true });
  return { id: profileId, tenantId, ...payload };
}

export async function getClientByEmail(email) {
  assertDb();
  // Query across tenants for profiles by email
  const snap = await firestore
    .collectionGroup("profiles")
    .where("email", "==", email)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const segments = doc.ref.path.split("/");
  const tenantIdx = segments.indexOf(ROOT.tenants) + 1;
  const tenantId = segments[tenantIdx];
  const profile = doc.data();
  return { tenantId, ...profile };
}

export async function insertFeedback(f) {
  // f: { tenantKey, sentiment, rating?, phone?, messageUrl?, text?, customerId?, date? }
  assertDb();
  const now = new Date().toISOString();
  const tenantId = f.tenantKey;
  const tRef = await ensureTenant(tenantId);
  const fbCol = tRef.collection("feedback");
  const docRef = f.id ? fbCol.doc(f.id) : fbCol.doc();
  const id = docRef.id;
  const payload = {
    id,
    customer_number: f.phone || "",
    sentiment: f.sentiment,
    created_at: f.date || now,
  };

  // Only add optional fields if they have values (Firebase doesn't allow undefined)
  if (f.text !== undefined) {
    payload.comment = f.text;
  }
  if (f.rating !== undefined) {
    payload.rating = f.rating;
  }
  if (f.messageUrl !== undefined) {
    payload.message_url = f.messageUrl;
  }
  if (f.customerId !== undefined) {
    payload.customerId = f.customerId;
  }

  await docRef.set(payload);
  return { id, tenantId, ...payload };
}

export async function listFeedback(tenantKey, filters) {
  assertDb();
  const tenantId = tenantKey;
  const tRef = firestore.collection(ROOT.tenants).doc(tenantId);
  let q = tRef.collection("feedback");
  if (filters?.sentiment) q = q.where("sentiment", "==", filters.sentiment);
  if (filters?.since) q = q.where("created_at", ">=", filters.since);
  const snap = await q.orderBy("created_at", "desc").get();
  return snap.docs.map((d) => ({ tenantId, ...d.data() }));
}

export async function deleteFeedbackForTenant(tenantKey, sentiment) {
  assertDb();
  const tenantId = tenantKey;
  const col = firestore
    .collection(ROOT.tenants)
    .doc(tenantId)
    .collection("feedback");
  let q = col;
  if (sentiment) q = q.where("sentiment", "==", sentiment);
  const snap = await q.get();
  const batch = firestore.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

export async function upsertCredential(c) {
  // c: { tenantKey, twilio?, whatsapp? }
  assertDb();
  const now = new Date().toISOString();
  const tenantId = c.tenantKey;
  const tRef = await ensureTenant(tenantId);
  const id = c.id || "default";
  const ref = tRef.collection("credentials").doc(id);
  const payload = { id, ...c, created_at: now, updated_at: now };
  await ref.set(payload, { merge: true });
  return { tenantId, ...payload };
}

export async function getGlobalStats() {
  assertDb();
  const fbSnap = await firestore.collectionGroup("feedback").get();
  const total = fbSnap.size;
  let positive = 0,
    negative = 0;
  fbSnap.forEach((d) => {
    const s = d.data().sentiment;
    if (s === "positive") positive++;
    else if (s === "negative") negative++;
  });
  return { total, positive, negative };
}

export async function getTenantStats(tenantKey) {
  assertDb();
  const col = firestore
    .collection(ROOT.tenants)
    .doc(tenantKey)
    .collection("feedback");
  const snap = await col.get();
  let total = 0,
    positive = 0,
    negative = 0,
    sumRating = 0,
    ratingCount = 0;
  snap.forEach((d) => {
    const e = d.data();
    total++;
    if (e.sentiment === "positive") positive++;
    else if (e.sentiment === "negative") negative++;
    if (typeof e.rating === "number") {
      sumRating += e.rating;
      ratingCount++;
    }
  });
  const avgRating = ratingCount ? sumRating / ratingCount : null;
  return { total, positive, negative, avgRating, ratingCount };
}

export async function setClientPasswordHash(clientId, email, passwordHash) {
  assertDb();
  const id = clientId;
  await firestore
    .collection(ROOT.clientAuth)
    .doc(id)
    .set({ id, clientId, email, passwordHash }, { merge: true });
  return true;
}

export async function getClientAuthByEmail(email) {
  assertDb();
  const snap = await firestore
    .collectionGroup("profiles")
    .where("email", "==", email)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const segments = doc.ref.path.split("/");
  const tenantIdx = segments.indexOf("tenants") + 1;
  const tenantId = segments[tenantIdx];
  const profile = doc.data();
  const authDoc = await firestore
    .collection(ROOT.clientAuth)
    .doc(profile.auth_uid)
    .get();
  const auth = authDoc.exists ? authDoc.data() : null;
  return { client: { tenantId, ...profile }, auth };
}
