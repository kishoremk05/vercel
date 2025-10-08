import { firestore } from './firebaseAdmin';

// Collections
const COL = {
  clients: 'clients',
  admins: 'admins',
  feedback: 'feedback',
  credentials: 'credentials',
  stats: 'stats', // optional pre-aggregated stats by tenant
};

export type Role = 'client' | 'admin';

export interface Client {
  id: string; // uid or generated id
  name: string;
  email: string;
  tenantKey: string; // multi-tenant segregation key
  activityStatus?: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  googleId?: string;
}

export interface Admin {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Feedback {
  id: string;
  tenantKey: string;
  sentiment: 'positive' | 'negative';
  rating?: number;
  // privacy: only store phone number or a hashed reference for negative comments
  phone?: string;
  // optionally store messageUrl if there is external reference
  messageUrl?: string;
  // avoid storing full negative message body
  text?: string; // optional for positive; empty for negative
  date: string;
  customerId?: string;
}

export interface Credential {
  id: string; // doc id = tenantKey or clientId
  tenantKey: string;
  twilio?: {
    accountSid?: string;
    authTokenRef?: string; // store a reference or use env vault; never expose to client
    fromNumbers?: string[];
  };
  whatsapp?: {
    fromNumber?: string;
  };
  createdAt: string;
  updatedAt: string;
}

function assertDb() {
  if (!firestore) throw new Error('Firestore not initialized');
}

export async function upsertClient(c: Omit<Client, 'createdAt' | 'updatedAt' | 'id'> & { id?: string }) {
  assertDb();
  const now = new Date().toISOString();
  const id = c.id || (await firestore!.collection(COL.clients).doc().id);
  const docRef = firestore!.collection(COL.clients).doc(id);
  const payload: Client = {
    id,
    name: c.name,
    email: c.email,
    tenantKey: c.tenantKey,
    activityStatus: c.activityStatus || 'active',
    googleId: c.googleId,
    createdAt: now,
    updatedAt: now,
  };
  await docRef.set(payload, { merge: true });
  return payload;
}

export async function getClientByEmail(email: string) {
  assertDb();
  const snap = await firestore!.collection(COL.clients).where('email', '==', email).limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].data() as Client;
}

export async function insertFeedback(f: Omit<Feedback, 'id' | 'date'> & { id?: string; date?: string }) {
  assertDb();
  const now = new Date().toISOString();
  const id = f.id || firestore!.collection(COL.feedback).doc().id;
  const payload: Feedback = {
    id,
    tenantKey: f.tenantKey,
    sentiment: f.sentiment,
    rating: f.rating,
    phone: f.phone,
    messageUrl: f.messageUrl,
    text: f.text,
    customerId: f.customerId,
    date: f.date || now,
  };
  await firestore!.collection(COL.feedback).doc(id).set(payload);
  return payload;
}

export async function listFeedback(tenantKey: string, filters?: { sentiment?: 'positive' | 'negative'; since?: string }) {
  assertDb();
  let q: FirebaseFirestore.Query = firestore!.collection(COL.feedback).where('tenantKey', '==', tenantKey);
  if (filters?.sentiment) q = q.where('sentiment', '==', filters.sentiment);
  if (filters?.since) q = q.where('date', '>=', filters.since);
  const snap = await q.orderBy('date', 'desc').get();
  return snap.docs.map(d => d.data() as Feedback);
}

export async function deleteFeedbackForTenant(tenantKey: string, sentiment?: 'positive' | 'negative') {
  assertDb();
  let q: FirebaseFirestore.Query = firestore!.collection(COL.feedback).where('tenantKey', '==', tenantKey);
  if (sentiment) q = q.where('sentiment', '==', sentiment);
  const snap = await q.get();
  const batch = firestore!.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

export async function upsertCredential(c: Omit<Credential, 'createdAt' | 'updatedAt' | 'id'> & { id?: string }) {
  assertDb();
  const now = new Date().toISOString();
  const id = c.id || c.tenantKey;
  const ref = firestore!.collection(COL.credentials).doc(id);
  const payload: Credential = { id, ...c, createdAt: now, updatedAt: now } as Credential;
  await ref.set(payload, { merge: true });
  return payload;
}

export async function getGlobalStats() {
  assertDb();
  // Count messages/feedback across all clients (simple scan; replace with aggregates for scale)
  const feedbackSnap = await firestore!.collection(COL.feedback).get();
  const total = feedbackSnap.size;
  let positive = 0, negative = 0;
  feedbackSnap.forEach(d => {
    const s = (d.data() as Feedback).sentiment;
    if (s === 'positive') positive++; else if (s === 'negative') negative++;
  });
  return { total, positive, negative };
}
