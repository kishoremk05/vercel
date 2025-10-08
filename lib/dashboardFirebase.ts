/**
 * Dashboard Firebase Integration
 * Handles proper fetching of dashboard stats and negative feedback from Firebase
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebaseClient';
import type { FeedbackDocument } from '../types/firebaseTypes';

export interface DashboardStats {
  messageCount: number;
  feedbackCount: number;
  negativeFeedbackCount: number;
  positiveFeedbackCount: number;
  neutralFeedbackCount: number;
  graphData: {
    labels: string[];
    values: number[];
    positive?: number[];
    negative?: number[];
    neutral?: number[];
  };
}

export interface NegativeFeedbackItem {
  id: string;
  text: string;
  phone_number: string;
  sentiment_score: number;
  created_at: Date;
  rating?: number;
  sms_id?: string;
  status: 'new' | 'addressed' | 'resolved';
}

/**
 * Fetch complete dashboard stats from Firebase for authenticated client
 * Uses clientId (auth_uid) to fetch from clients/{clientId}/dashboard/current
 */
export async function fetchDashboardStatsFromFirebase(
  clientId: string
): Promise<DashboardStats | null> {
  try {
    const db = getFirebaseDb();
    const dashboardRef = doc(db, 'clients', clientId, 'dashboard', 'current');
    const dashboardSnap = await getDoc(dashboardRef);

    if (!dashboardSnap.exists()) {
      console.warn(`[Dashboard] No dashboard document found for client ${clientId}`);
      return null;
    }

    const data = dashboardSnap.data();
    
    // Parse graph_data (stored as stringified JSON in Firestore)
    let graphData = {
      labels: [],
      values: [],
      positive: [],
      negative: [],
      neutral: [],
    };
    
    if (data.graph_data) {
      try {
        if (typeof data.graph_data === 'string') {
          graphData = JSON.parse(data.graph_data);
        } else {
          graphData = data.graph_data;
        }
      } catch (e) {
        console.error('[Dashboard] Failed to parse graph_data:', e);
      }
    }

    return {
      messageCount: data.message_count || 0,
      feedbackCount: data.feedback_count || 0,
      negativeFeedbackCount: data.negative_feedback_count || 0,
      positiveFeedbackCount: data.positive_feedback_count || 0,
      neutralFeedbackCount: data.neutral_feedback_count || 0,
      graphData,
    };
  } catch (error) {
    console.error('[Dashboard] Error fetching stats from Firebase:', error);
    return null;
  }
}

/**
 * Fetch negative feedback entries for a client with phone number attribution
 * NEW: Reads from clients/{clientId}/dashboard/current document's negative_comments array
 * This matches where the SMS server stores negative feedback from the feedback form
 */
export async function fetchNegativeFeedback(
  clientId: string,
  limitCount: number = 50
): Promise<any[]> {
  try {
    const db = getFirebaseDb();
    
    // CORRECTED: Read from dashboard/current document where negative_comments are stored
    const dashboardRef = doc(db, 'clients', clientId, 'dashboard', 'current');
    const dashboardSnap = await getDoc(dashboardRef);
    
    if (!dashboardSnap.exists()) {
      console.warn(`[Dashboard] No dashboard document found for client ${clientId}`);
      return [];
    }
    
    const data = dashboardSnap.data();
    const negativeComments = data.negative_comments || [];
    
    console.log(`[Dashboard] Fetching for clientId: ${clientId}`);
    console.log(`[Dashboard] Raw negative_comments:`, negativeComments);
    console.log(`[Dashboard] Found ${negativeComments.length} negative comments for client ${clientId}`);
    
    // CRITICAL: Filter to only show comments that belong to THIS client
    // This prevents Client A from seeing Client B's comments
    const clientComments = negativeComments.filter((comment: any) => {
      const belongsToThisClient = comment.companyId === clientId;
      if (!belongsToThisClient) {
        console.warn(`[Dashboard] ⚠️ Filtering out comment for different client: ${comment.companyId} (current: ${clientId})`);
      }
      return belongsToThisClient && comment.status === 'active';
    });
    
    console.log(`[Dashboard] After filtering by companyId: ${clientComments.length} comments belong to ${clientId}`);
    
    // Return the comments in the EXACT format they're stored
    // The dashboard expects: commentText, customerPhone, createdAt, rating, status, id
    return clientComments
      .slice(0, limitCount)
      .sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA; // Sort by newest first
      });
  } catch (error) {
    console.error('[Dashboard] Error fetching negative feedback:', error);
    return [];
  }
}

/**
 * Fetch all feedback (positive, negative, neutral) for charts/analytics
 */
export async function fetchAllFeedback(
  clientId: string,
  limitCount: number = 100
): Promise<Array<{
  id: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  phone_number: string;
  created_at: Date;
  sentiment_score: number;
}>> {
  try {
    const db = getFirebaseDb();
    const feedbackRef = collection(db, 'clients', clientId, 'feedback');
    
    const q = query(
      feedbackRef,
      orderBy('created_at', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data() as FeedbackDocument;
      return {
        id: doc.id,
        sentiment: data.sentiment || 'neutral',
        phone_number: data.phone_number || 'Unknown',
        created_at: data.created_at?.toDate?.() || new Date(),
        sentiment_score: typeof data.sentiment_score === 'string'
          ? parseFloat(data.sentiment_score)
          : (data.sentiment_score || 0),
      };
    });
  } catch (error) {
    console.error('[Dashboard] Error fetching all feedback:', error);
    return [];
  }
}

/**
 * Get client profile data (business name, links) from Firebase
 */
export async function fetchClientProfile(clientId: string): Promise<{
  businessName?: string;
  feedbackPageLink?: string;
  googleReviewLink?: string;
} | null> {
  try {
    const db = getFirebaseDb();
    
    // Try clients collection first (has business_name, feedback_page_link)
    const clientRef = doc(db, 'clients', clientId);
    const clientSnap = await getDoc(clientRef);
    
    if (clientSnap.exists()) {
      const data = clientSnap.data();
      return {
        businessName: data.business_name,
        feedbackPageLink: data.feedback_page_link,
        googleReviewLink: data.google_review_link,
      };
    }
    
    // Fallback: try profile subcollection
    const profileRef = doc(db, 'clients', clientId, 'profile', 'main');
    const profileSnap = await getDoc(profileRef);
    
    if (profileSnap.exists()) {
      const data = profileSnap.data();
      return {
        businessName: data.name,
        feedbackPageLink: undefined,
        googleReviewLink: undefined,
      };
    }
    
    return null;
  } catch (error) {
    console.error('[Dashboard] Error fetching client profile:', error);
    return null;
  }
}
