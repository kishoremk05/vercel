/**
 * Firestore Client Helper Functions
 * 
 * This file contains all client-side Firestore operations
 * organized by collection/functionality
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  addDoc,
  increment,
  writeBatch,
  QueryConstraint,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebaseClient';
import type {
  ClientDocument,
  ClientProfileDocument,
  ClientDashboardDocument,
  MessageDocument,
  FeedbackDocument,
  MessengerDocument,
  ClientWithId,
  MessageWithId,
  FeedbackWithId,
  DashboardStats,
} from '../types/firebaseTypes';

// ==================== CLIENT OPERATIONS ====================

/**
 * Get client document by ID
 */
export async function getClient(clientId: string): Promise<ClientWithId | null> {
  const db = getFirebaseDb();
  const clientRef = doc(db, 'clients', clientId);
  const clientSnap = await getDoc(clientRef);
  
  if (!clientSnap.exists()) return null;
  
  return {
    id: clientSnap.id,
    ...clientSnap.data() as ClientDocument,
  };
}

/**
 * Get client by auth UID
 */
export async function getClientByAuthUid(authUid: string): Promise<ClientWithId | null> {
  const db = getFirebaseDb();
  const clientsRef = collection(db, 'clients');
  const q = query(clientsRef, where('auth_uid', '==', authUid), limit(1));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return null;
  
  const clientDoc = snapshot.docs[0];
  return {
    id: clientDoc.id,
    ...clientDoc.data() as ClientDocument,
  };
}

/**
 * Create a new client with auth_uid as document ID for data isolation
 */
export async function createClient(data: Omit<ClientDocument, 'created_at'>): Promise<string> {
  const db = getFirebaseDb();
  const clientsRef = collection(db, 'clients');
  
  // Use auth_uid as the document ID to ensure each user has isolated data
  const clientDocRef = doc(clientsRef, data.auth_uid);
  
  console.log('[Firestore] Creating client document:', {
    path: `clients/${data.auth_uid}`,
    data: { ...data, created_at: 'Timestamp.now()' }
  });
  
  try {
    await setDoc(clientDocRef, {
      ...data,
      created_at: Timestamp.now(),
    });
    console.log(`[Firestore] ✅ Client document created: ${data.auth_uid}`);
  } catch (error: any) {
    console.error(`[Firestore] ❌ Failed to create client document:`, error);
    throw error;
  }
  
  // Initialize dashboard document
  try {
    await initializeClientDashboard(data.auth_uid);
    console.log(`[Firestore] ✅ Dashboard initialized for: ${data.auth_uid}`);
  } catch (error: any) {
    console.error(`[Firestore] ⚠️ Dashboard init failed (non-fatal):`, error.message);
    // Don't throw - dashboard can be initialized later
  }
  
  console.log(`✅ Created client with ID: ${data.auth_uid}`);
  
  return data.auth_uid;
}

/**
 * Update client document
 */
export async function updateClient(clientId: string, data: Partial<ClientDocument>): Promise<void> {
  const db = getFirebaseDb();
  const clientRef = doc(db, 'clients', clientId);
  await updateDoc(clientRef, data as any);
}

// ==================== PROFILE OPERATIONS ====================

/**
 * Get client profile
 */
export async function getClientProfile(clientId: string): Promise<ClientProfileDocument | null> {
  const db = getFirebaseDb();
  const profileRef = doc(db, 'clients', clientId, 'profile', 'main');
  const profileSnap = await getDoc(profileRef);
  
  if (!profileSnap.exists()) return null;
  
  return profileSnap.data() as ClientProfileDocument;
}

/**
 * Update client profile
 */
export async function updateClientProfile(
  clientId: string,
  data: Partial<ClientProfileDocument>
): Promise<void> {
  const db = getFirebaseDb();
  const profileRef = doc(db, 'clients', clientId, 'profile', 'main');
  
  console.log('[Firestore] Updating client profile:', {
    path: `clients/${clientId}/profile/main`,
    data
  });
  
  try {
    await setDoc(profileRef, data, { merge: true });
    console.log(`[Firestore] ✅ Profile updated for: ${clientId}`);
  } catch (error: any) {
    console.error(`[Firestore] ❌ Failed to update profile:`, error);
    console.error(`[Firestore] Error details:`, {
      code: error.code,
      message: error.message,
      clientId,
      path: `clients/${clientId}/profile/main`
    });
    throw error;
  }
}

/**
 * Update last login timestamp
 */
export async function updateLastLogin(clientId: string): Promise<void> {
  await updateClientProfile(clientId, {
    last_login: Timestamp.now(),
  });
}

// ==================== DASHBOARD OPERATIONS ====================

/**
 * Initialize client dashboard with default values
 */
async function initializeClientDashboard(clientId: string): Promise<void> {
  const db = getFirebaseDb();
  const dashboardRef = doc(db, 'clients', clientId, 'dashboard', 'current');
  await setDoc(dashboardRef, {
    message_count: 0,
    feedback_count: 0,
    negative_feedback_count: 0,
    graph_data: {
      labels: [],
      values: [],
    },
    last_updated: Timestamp.now(),
  });
}

/**
 * Get client dashboard stats
 */
export async function getClientDashboard(clientId: string): Promise<DashboardStats | null> {
  const db = getFirebaseDb();
  const dashboardRef = doc(db, 'clients', clientId, 'dashboard', 'current');
  const dashboardSnap = await getDoc(dashboardRef);
  
  if (!dashboardSnap.exists()) return null;
  
  const data = dashboardSnap.data() as ClientDashboardDocument;
  return {
    messageCount: data.message_count,
    feedbackCount: data.feedback_count,
    negativeFeedbackCount: data.negative_feedback_count,
    graphData: data.graph_data,
  };
}

/**
 * Update dashboard counters
 */
export async function updateDashboardCounters(
  clientId: string,
  updates: {
    messageCount?: number;
    feedbackCount?: number;
    negativeFeedbackCount?: number;
  }
): Promise<void> {
  const db = getFirebaseDb();
  const dashboardRef = doc(db, 'clients', clientId, 'dashboard', 'current');
  
  const updateData: any = {
    last_updated: Timestamp.now(),
  };
  
  if (updates.messageCount !== undefined) {
    updateData.message_count = increment(updates.messageCount);
  }
  if (updates.feedbackCount !== undefined) {
    updateData.feedback_count = increment(updates.feedbackCount);
  }
  if (updates.negativeFeedbackCount !== undefined) {
    updateData.negative_feedback_count = increment(updates.negativeFeedbackCount);
  }
  
  await updateDoc(dashboardRef, updateData);
}

/**
 * Update dashboard graph data
 */
export async function updateDashboardGraph(
  clientId: string,
  graphData: { labels: string[]; values: number[] }
): Promise<void> {
  const db = getFirebaseDb();
  const dashboardRef = doc(db, 'clients', clientId, 'dashboard', 'current');
  await updateDoc(dashboardRef, {
    graph_data: graphData,
    last_updated: Timestamp.now(),
  });
}

// ==================== MESSAGE OPERATIONS ====================

/**
 * Create a new message
 */
export async function createMessage(
  clientId: string,
  data: Omit<MessageDocument, 'sent_at'>
): Promise<string> {
  const db = getFirebaseDb();
  const messagesRef = collection(db, 'clients', clientId, 'messages');
  const messageRef = await addDoc(messagesRef, {
    ...data,
    sent_at: Timestamp.now(),
  });
  
  // Update dashboard counter
  await updateDashboardCounters(clientId, { messageCount: 1 });
  
  return messageRef.id;
}

/**
 * Get messages for a client
 */
export async function getMessages(
  clientId: string,
  limitCount: number = 50,
  orderByField: 'sent_at' = 'sent_at'
): Promise<MessageWithId[]> {
  const db = getFirebaseDb();
  const messagesRef = collection(db, 'clients', clientId, 'messages');
  const q = query(messagesRef, orderBy(orderByField, 'desc'), limit(limitCount));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data() as MessageDocument,
  }));
}

/**
 * Update message status
 */
export async function updateMessageStatus(
  clientId: string,
  messageId: string,
  status: 'sent' | 'delivered' | 'failed'
): Promise<void> {
  const db = getFirebaseDb();
  const messageRef = doc(db, 'clients', clientId, 'messages', messageId);
  await updateDoc(messageRef, { status });
}

/**
 * Get message by SMS ID
 */
export async function getMessageBySmsId(
  clientId: string,
  smsId: string
): Promise<MessageWithId | null> {
  const db = getFirebaseDb();
  const messagesRef = collection(db, 'clients', clientId, 'messages');
  const q = query(messagesRef, where('sms_id', '==', smsId), limit(1));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return null;
  
  const messageDoc = snapshot.docs[0];
  return {
    id: messageDoc.id,
    ...messageDoc.data() as MessageDocument,
  };
}

// ==================== FEEDBACK OPERATIONS ====================

/**
 * Create feedback entry
 */
export async function createFeedback(
  clientId: string,
  data: Omit<FeedbackDocument, 'created_at'>
): Promise<string> {
  const db = getFirebaseDb();
  const feedbackRef = collection(db, 'clients', clientId, 'feedback');
  const newFeedbackRef = await addDoc(feedbackRef, {
    ...data,
    created_at: Timestamp.now(),
  });
  
  // Update dashboard counters
  const updates: any = { feedbackCount: 1 };
  if (data.sentiment === 'negative') {
    updates.negativeFeedbackCount = 1;
  }
  await updateDashboardCounters(clientId, updates);
  
  return newFeedbackRef.id;
}

/**
 * Get all feedback for a client
 */
export async function getFeedback(
  clientId: string,
  limitCount: number = 100,
  sentimentFilter?: 'positive' | 'negative' | 'neutral'
): Promise<FeedbackWithId[]> {
  const db = getFirebaseDb();
  const feedbackRef = collection(db, 'clients', clientId, 'feedback');
  
  const constraints: QueryConstraint[] = [];
  if (sentimentFilter) {
    constraints.push(where('sentiment', '==', sentimentFilter));
  }
  constraints.push(orderBy('created_at', 'desc'));
  constraints.push(limit(limitCount));
  
  const q = query(feedbackRef, ...constraints);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data() as FeedbackDocument,
  }));
}

/**
 * Get feedback by SMS ID
 */
export async function getFeedbackBySmsId(
  clientId: string,
  smsId: string
): Promise<FeedbackWithId[]> {
  const db = getFirebaseDb();
  const feedbackRef = collection(db, 'clients', clientId, 'feedback');
  const q = query(
    feedbackRef,
    where('sms_id', '==', smsId),
    orderBy('created_at', 'desc')
  );
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data() as FeedbackDocument,
  }));
}

/**
 * Update feedback entry
 */
export async function updateFeedback(
  clientId: string,
  feedbackId: string,
  data: Partial<FeedbackDocument>
): Promise<void> {
  const db = getFirebaseDb();
  const feedbackRef = doc(db, 'clients', clientId, 'feedback', feedbackId);
  await updateDoc(feedbackRef, data as any);
}

/**
 * Delete feedback entry
 */
export async function deleteFeedback(clientId: string, feedbackId: string): Promise<void> {
  const db = getFirebaseDb();
  const feedbackRef = doc(db, 'clients', clientId, 'feedback', feedbackId);
  
  // Get feedback data to update counters
  const feedbackSnap = await getDoc(feedbackRef);
  if (feedbackSnap.exists()) {
    const feedbackData = feedbackSnap.data() as FeedbackDocument;
    
    // Delete the feedback
    await deleteDoc(feedbackRef);
    
    // Update counters
    const updates: any = { feedbackCount: -1 };
    if (feedbackData.sentiment === 'negative') {
      updates.negativeFeedbackCount = -1;
    }
    await updateDashboardCounters(clientId, updates);
  }
}

// ==================== MESSENGER OPERATIONS ====================

/**
 * Create messenger entry
 */
export async function createMessenger(
  clientId: string,
  data: Omit<MessengerDocument, 'created_at'>
): Promise<string> {
  const db = getFirebaseDb();
  const messengerRef = collection(db, 'clients', clientId, 'messenger');
  const newMessengerRef = await addDoc(messengerRef, {
    ...data,
    created_at: Timestamp.now(),
  });
  
  return newMessengerRef.id;
}

/**
 * Get all messenger entries for a client
 */
export async function getMessengerEntries(clientId: string): Promise<MessengerDocument[]> {
  const db = getFirebaseDb();
  const messengerRef = collection(db, 'clients', clientId, 'messenger');
  const q = query(messengerRef, orderBy('created_at', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => doc.data() as MessengerDocument);
}

/**
 * Update messenger entry
 */
export async function updateMessenger(
  clientId: string,
  messengerId: string,
  data: Partial<MessengerDocument>
): Promise<void> {
  const db = getFirebaseDb();
  const messengerRef = doc(db, 'clients', clientId, 'messenger', messengerId);
  await updateDoc(messengerRef, data as any);
}

// ==================== BATCH OPERATIONS ====================

/**
 * Batch create messages (useful for bulk SMS)
 */
export async function batchCreateMessages(
  clientId: string,
  messages: Omit<MessageDocument, 'sent_at'>[]
): Promise<void> {
  const db = getFirebaseDb();
  const batch = writeBatch(db);
  
  messages.forEach(messageData => {
    const messageRef = doc(collection(db, 'clients', clientId, 'messages'));
    batch.set(messageRef, {
      ...messageData,
      sent_at: Timestamp.now(),
    });
  });
  
  await batch.commit();
  
  // Update counter
  await updateDashboardCounters(clientId, { messageCount: messages.length });
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Analyze sentiment from rating
 */
export function analyzeSentiment(rating: number): 'positive' | 'negative' | 'neutral' {
  if (rating >= 4) return 'positive';
  if (rating <= 2) return 'negative';
  return 'neutral';
}

/**
 * Convert Firestore Timestamp to Date
 */
export function timestampToDate(timestamp: Timestamp): Date {
  return timestamp.toDate();
}
