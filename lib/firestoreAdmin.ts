/**
 * Firestore Admin Helper Functions
 * 
 * This file contains all server-side Firestore operations for admin users
 * These functions should ONLY be used on the server side
 */

import { firestore, admin } from '../server/db/firebaseAdmin';
import type {
  AdminDocument,
  AdminCredentialsDocument,
  AdminDashboardAggregates,
  AdminLogDocument,
  ClientWithId,
} from '../types/firebaseTypes';

// Check if Firestore is initialized
function ensureFirestore() {
  if (!firestore) {
    throw new Error('Firestore is not initialized. Please set FIREBASE_SERVICE_ACCOUNT environment variable.');
  }
  return firestore;
}

// ==================== ADMIN OPERATIONS ====================

/**
 * Get admin by auth UID
 */
export async function getAdminByAuthUid(authUid: string): Promise<any | null> {
  const db = ensureFirestore();
  const adminsSnapshot = await db
    .collection('admins')
    .where('auth_uid', '==', authUid)
    .limit(1)
    .get();
  
  if (adminsSnapshot.empty) return null;
  
  const adminDoc = adminsSnapshot.docs[0];
  return {
    id: adminDoc.id,
    ...adminDoc.data(),
  };
}

/**
 * Create a new admin
 */
export async function createAdmin(data: Omit<AdminDocument, 'created_at'>): Promise<string> {
  const db = ensureFirestore();
  const adminRef = await db.collection('admins').add({
    ...data,
    created_at: admin.firestore.Timestamp.now(),
  });
  
  return adminRef.id;
}

/**
 * Get admin credentials
 */
export async function getAdminCredentials(adminId: string): Promise<AdminCredentialsDocument | null> {
  const db = ensureFirestore();
  const credentialsDoc = await db
    .collection('admins')
    .doc(adminId)
    .collection('settings')
    .doc('credentials')
    .get();
  
  if (!credentialsDoc.exists) return null;
  
  return credentialsDoc.data() as AdminCredentialsDocument;
}

/**
 * Update admin credentials
 */
export async function updateAdminCredentials(
  adminId: string,
  data: Partial<Omit<AdminCredentialsDocument, 'updated_at'>>
): Promise<void> {
  const db = ensureFirestore();
  await db
    .collection('admins')
    .doc(adminId)
    .collection('settings')
    .doc('credentials')
    .set(
      {
        ...data,
        updated_at: admin.firestore.Timestamp.now(),
      },
      { merge: true }
    );
}

// ==================== ADMIN DASHBOARD OPERATIONS ====================

/**
 * Get admin dashboard aggregates
 */
export async function getAdminDashboardAggregates(): Promise<AdminDashboardAggregates | null> {
  const db = ensureFirestore();
  const aggregatesDoc = await db
    .collection('admin_dashboard')
    .doc('aggregates')
    .get();
  
  if (!aggregatesDoc.exists) {
    // Initialize if doesn't exist
    await initializeAdminDashboard();
    return {
      total_message_count: 0,
      total_feedback_count: 0,
      total_negative_feedback_count: 0,
      active_clients_count: 0,
      last_updated: admin.firestore.Timestamp.now() as any,
    };
  }
  
  return aggregatesDoc.data() as AdminDashboardAggregates;
}

/**
 * Initialize admin dashboard with default values
 */
async function initializeAdminDashboard(): Promise<void> {
  const db = ensureFirestore();
  await db
    .collection('admin_dashboard')
    .doc('aggregates')
    .set({
      total_message_count: 0,
      total_feedback_count: 0,
      total_negative_feedback_count: 0,
      active_clients_count: 0,
      last_updated: admin.firestore.Timestamp.now(),
    });
}

/**
 * Update admin dashboard aggregates
 */
export async function updateAdminDashboardAggregates(
  updates: Partial<Omit<AdminDashboardAggregates, 'last_updated'>>
): Promise<void> {
  const db = ensureFirestore();
  const updateData: any = {
    last_updated: admin.firestore.Timestamp.now(),
  };
  
  Object.entries(updates).forEach(([key, value]) => {
    if (typeof value === 'number') {
      updateData[key] = admin.firestore.FieldValue.increment(value);
    } else {
      updateData[key] = value;
    }
  });
  
  await db
    .collection('admin_dashboard')
    .doc('aggregates')
    .update(updateData);
}

/**
 * Recalculate admin dashboard from all clients
 */
export async function recalculateAdminDashboard(): Promise<void> {
  const db = ensureFirestore();
  
  // Get all clients
  const clientsSnapshot = await db.collection('clients').get();
  
  let totalMessages = 0;
  let totalFeedback = 0;
  let totalNegativeFeedback = 0;
  let activeClients = 0;
  
  // Aggregate data from all clients
  for (const clientDoc of clientsSnapshot.docs) {
    const clientData = clientDoc.data();
    if (clientData.activity_status === 'active') {
      activeClients++;
    }
    
    // Get dashboard data
    const dashboardDoc = await db
      .collection('clients')
      .doc(clientDoc.id)
      .collection('dashboard')
      .doc('current')
      .get();
    
    if (dashboardDoc.exists) {
      const dashboardData = dashboardDoc.data();
      totalMessages += dashboardData?.message_count || 0;
      totalFeedback += dashboardData?.feedback_count || 0;
      totalNegativeFeedback += dashboardData?.negative_feedback_count || 0;
    }
  }
  
  // Update admin dashboard
  await db
    .collection('admin_dashboard')
    .doc('aggregates')
    .set({
      total_message_count: totalMessages,
      total_feedback_count: totalFeedback,
      total_negative_feedback_count: totalNegativeFeedback,
      active_clients_count: activeClients,
      last_updated: admin.firestore.Timestamp.now(),
    });
}

// ==================== CLIENT MANAGEMENT (ADMIN) ====================

/**
 * Get all clients (admin view)
 */
export async function getAllClients(): Promise<ClientWithId[]> {
  const db = ensureFirestore();
  const clientsSnapshot = await db
    .collection('clients')
    .orderBy('created_at', 'desc')
    .get();
  
  return clientsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as ClientWithId));
}

/**
 * Get client by ID (admin view)
 */
export async function getClientById(clientId: string): Promise<ClientWithId | null> {
  const db = ensureFirestore();
  const clientDoc = await db.collection('clients').doc(clientId).get();
  
  if (!clientDoc.exists) return null;
  
  return {
    id: clientDoc.id,
    ...clientDoc.data(),
  } as ClientWithId;
}

/**
 * Update client status (admin only)
 */
export async function updateClientStatus(
  clientId: string,
  status: 'active' | 'inactive',
  adminId: string
): Promise<void> {
  const db = ensureFirestore();
  await db.collection('clients').doc(clientId).update({
    activity_status: status,
  });
  
  // Log the action
  await createAdminLog({
    action: 'update_client_status',
    performed_by: adminId,
    target_client: clientId,
    details: { new_status: status },
  });
  
  // Update active clients count if needed
  const change = status === 'active' ? 1 : -1;
  await updateAdminDashboardAggregates({
    active_clients_count: change,
  });
}

/**
 * Delete client (admin only)
 */
export async function deleteClient(clientId: string, adminId: string): Promise<void> {
  const db = ensureFirestore();
  
  // Get client data before deletion
  const clientDoc = await db.collection('clients').doc(clientId).get();
  if (!clientDoc.exists) {
    throw new Error('Client not found');
  }
  
  const clientData = clientDoc.data();
  
  // Delete all subcollections (messages, feedback, etc.)
  const subcollections = ['profile', 'dashboard', 'messages', 'feedback', 'messenger'];
  for (const subcoll of subcollections) {
    const snapshot = await db
      .collection('clients')
      .doc(clientId)
      .collection(subcoll)
      .get();
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
  
  // Delete the client document
  await db.collection('clients').doc(clientId).delete();
  
  // Log the action
  await createAdminLog({
    action: 'delete_client',
    performed_by: adminId,
    target_client: clientId,
    details: { client_name: clientData?.name, client_email: clientData?.email },
  });
  
  // Update admin dashboard
  if (clientData?.activity_status === 'active') {
    await updateAdminDashboardAggregates({
      active_clients_count: -1,
    });
  }
}

// ==================== ADMIN LOGS ====================

/**
 * Create admin log entry
 */
export async function createAdminLog(
  data: Omit<AdminLogDocument, 'created_at'>
): Promise<string> {
  const db = ensureFirestore();
  const logRef = await db.collection('admin_logs').add({
    ...data,
    created_at: admin.firestore.Timestamp.now(),
  });
  
  return logRef.id;
}

/**
 * Get admin logs
 */
export async function getAdminLogs(
  limitCount: number = 50,
  adminId?: string,
  action?: string
): Promise<any[]> {
  const db = ensureFirestore();
  let query = db.collection('admin_logs').orderBy('created_at', 'desc');
  
  if (adminId) {
    query = query.where('performed_by', '==', adminId) as any;
  }
  
  if (action) {
    query = query.where('action', '==', action) as any;
  }
  
  const snapshot = await query.limit(limitCount).get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
}

// ==================== STATISTICS ====================

/**
 * Get client statistics
 */
export async function getClientStatistics(clientId: string): Promise<any> {
  const db = ensureFirestore();
  
  // Get dashboard data
  const dashboardDoc = await db
    .collection('clients')
    .doc(clientId)
    .collection('dashboard')
    .doc('current')
    .get();
  
  const dashboardData = dashboardDoc.data() || {};
  
  // Get recent messages count
  const messagesSnapshot = await db
    .collection('clients')
    .doc(clientId)
    .collection('messages')
    .orderBy('sent_at', 'desc')
    .limit(100)
    .get();
  
  // Get recent feedback count
  const feedbackSnapshot = await db
    .collection('clients')
    .doc(clientId)
    .collection('feedback')
    .orderBy('created_at', 'desc')
    .limit(100)
    .get();
  
  return {
    messageCount: dashboardData.message_count || 0,
    feedbackCount: dashboardData.feedback_count || 0,
    negativeFeedbackCount: dashboardData.negative_feedback_count || 0,
    recentMessages: messagesSnapshot.size,
    recentFeedback: feedbackSnapshot.size,
    graphData: dashboardData.graph_data || { labels: [], values: [] },
  };
}

/**
 * Get global statistics (for admin dashboard)
 */
export async function getGlobalStatistics(): Promise<any> {
  const aggregates = await getAdminDashboardAggregates();
  
  if (!aggregates) {
    return {
      totalMessages: 0,
      totalFeedback: 0,
      totalNegativeFeedback: 0,
      activeClients: 0,
    };
  }
  
  return {
    totalMessages: aggregates.total_message_count,
    totalFeedback: aggregates.total_feedback_count,
    totalNegativeFeedback: aggregates.total_negative_feedback_count,
    activeClients: aggregates.active_clients_count,
  };
}
