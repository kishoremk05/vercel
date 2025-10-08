/**
 * React Hook for Dashboard Data from Firebase
 * Provides real-time dashboard stats and negative feedback with proper Firebase integration
 */

import { useState, useEffect, useCallback } from 'react';
import {
  fetchDashboardStatsFromFirebase,
  fetchNegativeFeedback,
  fetchAllFeedback,
  fetchClientProfile,
  DashboardStats,
  NegativeFeedbackItem,
} from '../lib/dashboardFirebase';

interface UseDashboardDataOptions {
  clientId: string | null;
  refreshInterval?: number; // milliseconds, default 30000 (30 seconds)
}

interface UseDashboardDataReturn {
  stats: DashboardStats | null;
  negativeFeedback: NegativeFeedbackItem[];
  profile: {
    businessName?: string;
    feedbackPageLink?: string;
    googleReviewLink?: string;
  } | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch and manage dashboard data from Firebase
 * Automatically refreshes data at specified interval
 * Uses clientId from localStorage if not provided
 */
export function useDashboardData(
  options?: Partial<UseDashboardDataOptions>
): UseDashboardDataReturn {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [negativeFeedback, setNegativeFeedback] = useState<NegativeFeedbackItem[]>([]);
  const [profile, setProfile] = useState<{
    businessName?: string;
    feedbackPageLink?: string;
    googleReviewLink?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get clientId from options or localStorage
  const clientId = options?.clientId || localStorage.getItem('companyId') || localStorage.getItem('auth_uid');
  const refreshInterval = options?.refreshInterval || 30000; // Default 30 seconds

  const fetchData = useCallback(async () => {
    if (!clientId) {
      setError('No client ID found. Please log in again.');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      
      console.log('[useDashboardData] Fetching data for client:', clientId);

      // Fetch all data in parallel
      const [statsData, negativeFeedbackData, profileData] = await Promise.all([
        fetchDashboardStatsFromFirebase(clientId),
        fetchNegativeFeedback(clientId, 50),
        fetchClientProfile(clientId),
      ]);

      console.log('[useDashboardData] Stats:', statsData);
      console.log('[useDashboardData] Negative feedback count:', negativeFeedbackData.length);
      console.log('[useDashboardData] Profile:', profileData);

      setStats(statsData);
      setNegativeFeedback(negativeFeedbackData);
      setProfile(profileData);
    } catch (err: any) {
      console.error('[useDashboardData] Error fetching dashboard data:', err);
      setError(err?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh at interval
  useEffect(() => {
    if (!clientId || refreshInterval <= 0) return;

    const intervalId = setInterval(() => {
      console.log('[useDashboardData] Auto-refreshing dashboard data...');
      fetchData();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [clientId, refreshInterval, fetchData]);

  return {
    stats,
    negativeFeedback,
    profile,
    loading,
    error,
    refetch: fetchData,
  };
}
