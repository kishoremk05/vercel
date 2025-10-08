import { Timestamp } from 'firebase/firestore';

// ==================== CLIENT TYPES ====================

export interface ClientDocument {
  name: string;
  email: string;
  auth_uid: string;
  activity_status: 'active' | 'inactive';
  created_at: Timestamp;
}

export interface ClientProfileDocument {
  name: string;
  email: string;
  last_login: Timestamp;
  google_auth: boolean;
}

export interface ClientDashboardDocument {
  message_count: number;
  feedback_count: number;
  negative_feedback_count: number;
  graph_data: {
    labels: string[];
    values: number[];
  };
  last_updated: Timestamp;
}

export interface MessageDocument {
  sms_id: string;
  phone_number: string;
  message_body: string;
  status: 'sent' | 'delivered' | 'failed';
  sent_at: Timestamp;
}

export interface FeedbackDocument {
  sms_id: string;
  phone_number: string;
  message_body: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentiment_score: number | string; // Can be string in Firestore
  status: 'new' | 'addressed' | 'resolved';
  created_at: Timestamp;
  admin_reply?: string;
  admin_replied_at?: Timestamp;
}

export interface MessengerDocument {
  feedback_url: string;
  redirect_url: string;
  created_at: Timestamp;
  is_active: boolean;
}

// ==================== ADMIN TYPES ====================

export interface AdminDocument {
  name: string;
  email: string;
  auth_uid: string;
  role: 'super-admin' | 'admin';
  created_at: Timestamp;
}

export interface AdminCredentialsDocument {
  twilio_account_sid: string;
  twilio_auth_token: string;
  twilio_phone_number: string;
  updated_at: Timestamp;
}

export interface AdminDashboardAggregates {
  total_message_count: number;
  total_feedback_count: number;
  total_negative_feedback_count: number;
  active_clients_count: number;
  last_updated: Timestamp;
}

export interface AdminLogDocument {
  action: string;
  performed_by: string; // adminId
  target_client?: string; // clientId (optional)
  details: Record<string, any>;
  created_at: Timestamp;
}

// ==================== HELPER TYPES ====================

export interface ClientWithId extends ClientDocument {
  id: string;
}

export interface MessageWithId extends MessageDocument {
  id: string;
}

export interface FeedbackWithId extends FeedbackDocument {
  id: string;
}

export interface AdminWithId extends AdminDocument {
  id: string;
}

// ==================== API RESPONSE TYPES ====================

export interface DashboardStats {
  messageCount: number;
  feedbackCount: number;
  negativeFeedbackCount: number;
  graphData: {
    labels: string[];
    values: number[];
  };
}

export interface ClientProfile {
  id: string;
  name: string;
  email: string;
  activityStatus: 'active' | 'inactive';
  createdAt: Date;
  lastLogin?: Date;
}
