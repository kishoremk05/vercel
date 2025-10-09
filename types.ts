export enum CustomerStatus {
  Pending = 'Pending',
  Sent = 'Sent',
  Clicked = 'Clicked',
  Reviewed = 'Reviewed',
  Failed = 'Failed'
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  status: CustomerStatus;
  addedAt: Date;
  rating?: number;
  feedback?: FeedbackEntry[];
  agentCode?: string; // Optional marketing/referral agent code
}

export interface ActivityLog {
  id: string;
  customerName: string;
  action: string;
  timestamp: Date;
}

export interface FeedbackEntry {
  id: string;
  text: string;
  sentiment: "positive" | "negative";
  date: Date;
  phone?: string;
  // Optional 1-5 star rating (we only visualize 1-3 per current requirements)
  rating?: number;
}

export enum Page {
  Home = 'home',
  Dashboard = 'dashboard',
  Settings = 'settings',
  Feedback = 'feedback',
  QuickFeedback = 'quick-feedback',
  Profile = 'profile',
  Admin = 'admin',
  AdminLogin = 'admin-login',
  Auth = 'auth',
  Signup = 'signup',
  Credentials = 'credentials',
  Payment = 'payment',
  PaymentSuccess = 'payment-success',
  PaymentCancel = 'payment-cancel',
}