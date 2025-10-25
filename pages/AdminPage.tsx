import React, { useState, useEffect } from "react";
import { getSmsServerUrl } from "../lib/firebaseConfig"; // dynamic API base
import {
  fetchWithTokenRefresh,
  setupAutoTokenRefresh,
} from "../lib/tokenRefresh";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
} from "recharts";

interface AdminPageProps {
  twilioAccountSid: string;
  setTwilioAccountSid: (sid: string) => void;
  twilioAuthToken: string;
  setTwilioAuthToken: (token: string) => void;
  twilioPhoneNumber: string;
  setTwilioPhoneNumber: (phone: string) => void;
  onLogout: () => void;
}

const AdminPage: React.FC<AdminPageProps> = ({
  twilioAccountSid,
  setTwilioAccountSid,
  twilioAuthToken,
  setTwilioAuthToken,
  twilioPhoneNumber,
  setTwilioPhoneNumber,
  onLogout,
}) => {
  const [users, setUsers] = useState<
    Array<{
      uid: string;
      email: string | null;
      firestoreEmail?: string | null;
      phoneNumber: string | null;
      displayName: string | null;
      disabled: boolean;
      emailVerified: boolean;
      createdAt: string;
      lastSignInAt: string | null;
      role?: string; // will be normalized to lowercase on mapping
      company?: { companyName?: string };
      profile?: { businessName?: string; photoURL?: string };
      photoURL?: string;
    }>
  >([]);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState<{
    totalCompanies: number;
    totalUsers: number;
    totalMessages: number;
    totalFeedback: number;
  } | null>(null);

  const [localTwilioSid, setLocalTwilioSid] = useState(twilioAccountSid);
  const [localTwilioToken, setLocalTwilioToken] = useState(twilioAuthToken);
  const [localTwilioPhone, setLocalTwilioPhone] = useState(twilioPhoneNumber);
  const [localMessagingServiceSid, setLocalMessagingServiceSid] = useState("");
  const [feedbackPageUrl, setFeedbackPageUrl] = useState("");
  const [smsServerPort, setSmsServerPort] = useState("3002");
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingUrls, setIsSavingUrls] = useState(false);

  // NEW: Loading and error states
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [hasAuthError, setHasAuthError] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

  // Setup automatic token refresh on component mount
  useEffect(() => {
    const cleanup = setupAutoTokenRefresh();
    return cleanup; // Cleanup on unmount
  }, []);

  // Load global admin credentials on mount
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const base = await getSmsServerUrl();
        const url = `${base}/admin/credentials`;
        // Use fetchWithTokenRefresh for automatic token refresh
        const response = await fetchWithTokenRefresh(url);

        if (response.ok) {
          const data = await response.json();
          const creds = data?.credentials || {};
          if (creds.accountSid) setLocalTwilioSid(creds.accountSid);
          if (creds.authToken) setLocalTwilioToken(creds.authToken);
          if (creds.phoneNumber) setLocalTwilioPhone(creds.phoneNumber);
          if (creds.messagingServiceSid)
            setLocalMessagingServiceSid(creds.messagingServiceSid);
          if (creds.feedbackPageUrl) setFeedbackPageUrl(creds.feedbackPageUrl);
          if (creds.smsServerPort) setSmsServerPort(creds.smsServerPort);
          // propagate up for current session use
          if (creds.accountSid) setTwilioAccountSid(creds.accountSid);
          if (creds.authToken) setTwilioAuthToken(creds.authToken);
          if (creds.phoneNumber) setTwilioPhoneNumber(creds.phoneNumber);
        } else if (response.status === 401) {
          console.warn("401 loading credentials - user may lack admin role");
          // Don't set auth error here, credentials are optional
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error("Failed to load credentials:", response.status, errorData);
        }
      } catch (error) {
        console.error("Error loading credentials:", error);
      }
    };

    loadCredentials();
  }, [setTwilioAccountSid, setTwilioAuthToken, setTwilioPhoneNumber]);

  // Load global stats and users list with comprehensive error handling
  useEffect(() => {
    const loadAdminData = async () => {
      setIsLoadingData(true);
      setHasAuthError(false);

      try {
        const base = await getSmsServerUrl();
        const statsUrl = `${base}/admin/global-stats`;
        const usersUrl = `${base}/admin/firebase-users`;

        // Use fetchWithTokenRefresh for both requests
        const [statsRes, usersRes] = await Promise.all([
          fetchWithTokenRefresh(statsUrl),
          fetchWithTokenRefresh(usersUrl),
        ]);

        // Handle 401 errors - user lacks admin privileges
        if (statsRes.status === 401 || usersRes.status === 401) {
          setHasAuthError(true);
          setAuthErrorMessage("401 Unauthorized: Insufficient privileges (need admin role)");
          setIsLoadingData(false);
          return;
        }

        // Process stats response
        if (statsRes.ok) {
          try {
            const data = await statsRes.json();
            setStats(data?.stats || null);
          } catch (parseErr) {
            console.error("Failed to parse /admin/global-stats JSON", parseErr);
            setStats(null);
          }
        } else {
          console.error("Failed to fetch /admin/global-stats", statsRes.status);
          setStats(null);
        }

        // Process users response
        if (usersRes.ok) {
          try {
            const data = await usersRes.json();
            if (data?.success && Array.isArray(data.users)) {
              setUsers(data.users);
            } else {
              setUsers([]);
            }
          } catch (parseErr) {
            console.error("Failed to parse /admin/firebase-users JSON", parseErr);
            setUsers([]);
          }
        } else {
          console.error("Failed to fetch /admin/firebase-users", usersRes.status);
          setUsers([]);
        }
      } catch (error: any) {
        console.error("Failed to load admin data", error);
        setErrorMessage("Failed to load admin data. Please refresh the page.");
        setShowError(true);
        setTimeout(() => setShowError(false), 6000);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadAdminData();
  }, []);

  const handleSuspend = (uid: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.uid === uid ? { ...u, disabled: !u.disabled } : u))
    );
  };

  const handleSaveCredentials = async () => {
    setIsSaving(true);
    setShowError(false);
    setShowSuccess(false);

    try {
      const base = await getSmsServerUrl();
      // Use fetchWithTokenRefresh with POST method
      const response = await fetchWithTokenRefresh(
        `${base}/admin/credentials`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountSid: localTwilioSid,
            authToken: localTwilioToken,
            phoneNumber: localTwilioPhone,
            messagingServiceSid: localMessagingServiceSid,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save credentials");
      }

      // Update local state
      setTwilioAccountSid(localTwilioSid);
      setTwilioAuthToken(localTwilioToken);
      setTwilioPhoneNumber(localTwilioPhone);

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error: any) {
      console.error("Error saving credentials:", error);
      setErrorMessage(error.message || "Failed to save credentials");
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFeedbackUrls = async () => {
    setIsSavingUrls(true);
    setShowError(false);
    setShowSuccess(false);

    try {
      const base = await getSmsServerUrl();
      // Use fetchWithTokenRefresh with POST method
      const response = await fetchWithTokenRefresh(
        `${base}/admin/feedback-urls`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            feedbackPageUrl,
            smsServerPort,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save feedback URLs");
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error: any) {
      console.error("Error saving feedback URLs:", error);
      setErrorMessage(error.message || "Failed to save feedback URLs");
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
    } finally {
      setIsSavingUrls(false);
    }
  };

  // Show loading state
  if (isLoadingData) {
    return (
      <div className="min-h-screen grid-pattern relative overflow-hidden flex items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 mx-auto text-indigo-600 mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="text-lg font-semibold text-gray-700">Loading Admin Dashboard...</p>
          <p className="text-sm text-gray-500 mt-2">Please wait while we fetch your data</p>
        </div>
      </div>
    );
  }

  // Show 401 unauthorized error
  if (hasAuthError) {
    return (
      <div className="min-h-screen grid-pattern relative overflow-hidden flex items-center justify-center">
        <div className="max-w-md mx-auto text-center bg-white rounded-2xl shadow-xl p-8 border border-red-200">
          <div className="mb-6">
            <svg
              className="h-16 w-16 mx-auto text-red-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-red-600 font-semibold mb-4">{authErrorMessage}</p>
          <p className="text-gray-600 mb-6">
            You don't have admin privileges to access this page. Please contact your system administrator.
          </p>
          <button
            onClick={() => {
              try {
                localStorage.removeItem("adminSession");
                localStorage.removeItem("adminEmail");
              } catch {}
              onLogout();
            }}
            className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-lg shadow-md transition-all duration-150"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-pattern relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-10">
        {/* Header Section */}
        <div className="mb-6 sm:mb-8 lg:mb-10">
          <div className="gradient-border premium-card bg-white shadow-lg p-4 sm:p-5 lg:p-6 transition-all duration-300 rounded-2xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
              <div className="space-y-1 flex-1">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 flex items-center gap-2">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 shadow-lg ring-2 ring-indigo-400/50 text-white pulse-scale"
                    style={{
                      boxShadow:
                        "0 0 20px rgba(99, 102, 241, 0.4), 0 4px 6px -1px rgba(99, 102, 241, 0.3)",
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-4 w-4"
                    >
                      <path d="M11.7 2.805a.75.75 0 01.6 0A60.65 60.65 0 0122.83 8.72a.75.75 0 01-.231 1.337 49.949 49.949 0 00-9.902 3.912l-.003.002-.34.18a.75.75 0 01-.707 0A50.009 50.009 0 007.5 12.174v-.224c0-.131.067-.248.172-.311a54.614 54.614 0 014.653-2.52.75.75 0 00-.65-1.352 56.129 56.129 0 00-4.78 2.589 1.858 1.858 0 00-.859 1.228 49.803 49.803 0 00-4.634-1.527.75.75 0 01-.231-1.337A60.653 60.653 0 0111.7 2.805z" />
                      <path d="M13.06 15.473a48.45 48.45 0 017.666-3.282c.134 1.414.22 2.843.255 4.285a.75.75 0 01-.46.71 47.878 47.878 0 00-8.105 4.342.75.75 0 01-.832 0 47.877 47.877 0 00-8.104-4.342.75.75 0 01-.461-.71c.035-1.442.121-2.87.255-4.286A48.4 48.4 0 016 13.18v1.27a1.5 1.5 0 00-.14 2.508c-.09.38-.222.753-.397 1.11.452.213.901.434 1.346.661a6.729 6.729 0 00.551-1.608 1.5 1.5 0 00.14-2.67v-.645a48.549 48.549 0 013.44 1.668 2.25 2.25 0 002.12 0z" />
                      <path d="M4.462 19.462c.42-.419.753-.89 1-1.394.453.213.902.434 1.347.661a6.743 6.743 0 01-1.286 1.794.75.75 0 11-1.06-1.06z" />
                    </svg>
                  </span>
                  Admin Dashboard
                </h2>
                <p className="text-xs sm:text-sm text-gray-600">
                  Manage clients, monitor system activity, and configure Twilio
                  credentials.
                </p>
                <p className="text-[11px] sm:text-xs text-gray-500">
                  Signed in as {localStorage.getItem("adminEmail") || "admin"}
                </p>
              </div>
              <div className="flex gap-1.5 sm:gap-2 items-center flex-wrap">
                <span className="inline-block bg-green-100 text-green-700 font-semibold px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs border border-green-200">
                  <span className="hidden sm:inline">System </span>Healthy
                </span>
                <span className="inline-block bg-blue-100 text-blue-700 font-semibold px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs border border-blue-200">
                  <span className="hidden sm:inline">Last sync: </span>2 min
                  <span className="hidden sm:inline"> ago</span>
                </span>
                <button
                  onClick={() => {
                    try {
                      localStorage.removeItem("adminSession");
                      localStorage.removeItem("adminEmail");
                    } catch {}
                    onLogout();
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg shadow-md flex items-center gap-1.5 sm:gap-2 transition-all duration-150 text-sm"
                  title="Logout"
                >
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1"
                    />
                  </svg>
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Logged-in User Details */}
        <div className="mb-6 sm:mb-8 lg:mb-10">
          <div className="premium-card bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">
                  Logged-in User
                </h3>
                <p className="text-sm text-gray-600 mt-0.5">
                  This is the account currently authenticated as admin.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-4 h-4 text-gray-500"
                  >
                    <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-9.52 5.71a3 3 0 01-3.08 0L1.5 8.67z" />
                    <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.52 5.713a3 3 0 003.08 0L22.5 6.908z" />
                  </svg>
                  {localStorage.getItem("adminEmail") || "admin"}
                </span>
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold bg-purple-100 text-purple-700">
                  👑 Admin
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-6 sm:mb-8 lg:mb-10 mx-auto max-w-4xl">
          <div className="flex justify-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 max-w-2xl w-full">
              <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 lg:p-8 hover:shadow-lg hover:border-gray-300 transition-all duration-200">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-blue-100 p-3 rounded-xl mb-4">
                    <svg
                      className="w-8 h-8 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m13-7V7a4 4 0 00-3-3.87M4 7V7a4 4 0 013-3.87m0 0A4 4 0 0112 3a4 4 0 015 3.13"
                      />
                    </svg>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-blue-700 mb-2">
                    Total Clients
                  </h2>
                  <p className="text-4xl sm:text-5xl font-extrabold text-blue-600 mb-2">
                    {users.length}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-400">
                    Registered Users
                  </p>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 lg:p-8 hover:shadow-lg hover:border-gray-300 transition-all duration-200">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-purple-100 p-3 rounded-xl mb-4">
                    <svg
                      className="w-8 h-8 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17 8h2a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2h2"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 3h-6a2 2 0 00-2 2v3a2 2 0 002 2h6a2 2 0 002-2V5a2 2 0 00-2-2z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-purple-700 mb-2">
                    Messages Sent
                  </h2>
                  <p className="text-4xl sm:text-5xl font-extrabold text-purple-600 mb-2">
                    {stats?.totalMessages ?? "-"}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-400">
                    Across all clients
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Twilio Credentials Configuration */}
        <div className="mb-6 sm:mb-8 lg:mb-10">
          <div className="gradient-border glow-on-hover premium-card bg-white shadow-lg p-4 sm:p-5 lg:p-6 transition-all duration-300 hover:shadow-xl rounded-2xl">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <div className="bg-indigo-100 p-1.5 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5 text-indigo-600"
                >
                  <path
                    fillRule="evenodd"
                    d="M15.75 1.5a6.75 6.75 0 00-6.651 7.906c.067.39-.032.717-.221.906l-6.5 6.499a3 3 0 00-.878 2.121v2.818c0 .414.336.75.75.75H6a.75.75 0 00.75-.75v-1.5h1.5A.75.75 0 009 19.5V18h1.5a.75.75 0 00.53-.22l2.658-2.658c.19-.189.517-.288.906-.22A6.75 6.75 0 1015.75 1.5zm0 3a.75.75 0 000 1.5A2.25 2.25 0 0118 8.25a.75.75 0 001.5 0 3.75 3.75 0 00-3.75-3.75z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              Twilio SMS Credentials
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">
              Configure your Twilio credentials for SMS messaging. These
              settings are used system-wide for all clients.
            </p>
            <div className="space-y-4 sm:space-y-6">
              <div>
                <label
                  htmlFor="admin-twilio-sid"
                  className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2"
                >
                  Account SID
                </label>
                <input
                  id="admin-twilio-sid"
                  type="text"
                  value={localTwilioSid}
                  onChange={(e) => setLocalTwilioSid(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 bg-white text-gray-900 shadow-sm"
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
              <div>
                <label
                  htmlFor="admin-twilio-token"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Auth Token
                </label>
                <input
                  id="admin-twilio-token"
                  type="password"
                  value={localTwilioToken}
                  onChange={(e) => setLocalTwilioToken(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 bg-white text-gray-900 shadow-sm"
                  placeholder="••••••••••••••••••••••••••••"
                />
              </div>
              <div>
                <label
                  htmlFor="admin-twilio-phone"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Twilio Phone Number
                </label>
                <input
                  id="admin-twilio-phone"
                  type="tel"
                  value={localTwilioPhone}
                  onChange={(e) => setLocalTwilioPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 bg-white text-gray-900 shadow-sm"
                  placeholder="+15551234567"
                />
              </div>
              <div>
                <label
                  htmlFor="admin-twilio-mss"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Messaging Service SID (optional, recommended for
                  international)
                </label>
                <input
                  id="admin-twilio-mss"
                  type="text"
                  value={localMessagingServiceSid}
                  onChange={(e) => setLocalMessagingServiceSid(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 bg-white text-gray-900 shadow-sm"
                  placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
                <p className="mt-1 text-xs text-gray-500">
                  If set, we'll send using Messaging Service instead of a
                  specific phone number.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end items-center gap-4">
              {showSuccess && (
                <p className="text-sm text-green-600 transition-opacity duration-300 font-semibold flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5"
                  >
                    <path
                      fillRule="evenodd"
                      d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Credentials saved successfully!
                </p>
              )}
              {showError && (
                <p className="text-sm text-red-600 transition-opacity duration-300 font-semibold flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {errorMessage}
                </p>
              )}
              <button
                onClick={handleSaveCredentials}
                disabled={isSaving}
                className={`px-6 py-3 rounded-xl font-semibold shadow-md transition-colors inline-flex items-center gap-2 ${
                  isSaving
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-gray-900 hover:bg-gray-800 text-white"
                }`}
              >
                {isSaving ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Save Credentials
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Customer Feedback URL Section */}
        <div className="gradient-border glow-on-hover premium-card bg-white shadow-lg p-4 sm:p-5 lg:p-6 xl:p-8 transition-all duration-300 hover:shadow-xl rounded-2xl mb-6 sm:mb-8 lg:mb-10">
          <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 mb-4 sm:mb-5 lg:mb-6 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600"
            >
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
            </svg>
            Global Feedback URL
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">
            This URL will be shared with all clients when collecting feedback.
          </p>
          <div className="grid gap-4 sm:gap-5">
            <div>
              <label
                htmlFor="admin-feedback-url"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Feedback Page URL
              </label>
              <input
                id="admin-feedback-url"
                type="url"
                value={feedbackPageUrl}
                onChange={(e) => setFeedbackPageUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 bg-white text-gray-900 shadow-sm"
                placeholder="https://your-business.com/feedback"
              />
              <p className="mt-1 text-xs text-gray-500">
                Link to your custom feedback collection page (same for all
                clients)
              </p>
            </div>
            <div>
              <label
                htmlFor="admin-sms-server-port"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                SMS Server Port
              </label>
              <input
                id="admin-sms-server-port"
                type="text"
                value={smsServerPort}
                onChange={(e) => setSmsServerPort(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 bg-white text-gray-900 shadow-sm font-mono"
                placeholder="3002"
              />
              <p className="mt-1 text-xs text-gray-500">
                Port where your SMS server is running (e.g., 3002, 8080)
              </p>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveFeedbackUrls}
              disabled={isSavingUrls}
              className={`px-6 py-3 rounded-xl font-semibold shadow-md transition-colors inline-flex items-center gap-2 ${
                isSavingUrls
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              {isSavingUrls ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5"
                  >
                    <path
                      fillRule="evenodd"
                      d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Save Feedback URL
                </>
              )}
            </button>
          </div>
        </div>

        {/* Registered Clients */}
        <div className="gradient-border glow-on-hover premium-card bg-white shadow-lg p-4 sm:p-5 lg:p-6 xl:p-8 transition-all duration-300 hover:shadow-xl rounded-2xl mb-6 sm:mb-8 lg:mb-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 sm:mb-6 gap-3 sm:gap-4">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                <div className="bg-blue-100 p-1.5 rounded-full">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5 text-blue-600"
                  >
                    <path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.5 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122zM17.25 19.128l-.001.144a2.25 2.25 0 01-.233.96 10.088 10.088 0 005.06-1.01.75.75 0 00.42-.643 4.875 4.875 0 00-6.957-4.611 8.586 8.586 0 011.71 5.157v.003z" />
                  </svg>
                </div>
                Registered Clients
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                All users who have logged in via Firebase Authentication
              </p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <input
                type="text"
                className="border border-gray-300 rounded-lg px-3 sm:px-4 py-2 focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all w-full md:w-64 text-sm"
                placeholder="Search clients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="border border-gray-300 rounded-lg px-2 sm:px-3 py-2 focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all text-gray-700 text-sm"
                onChange={(e) =>
                  setSearch(
                    e.target.value === "All"
                      ? ""
                      : e.target.value === "Active"
                      ? "Active"
                      : "Suspended"
                  )
                }
                value={
                  search === ""
                    ? "All"
                    : search === "Active"
                    ? "Active"
                    : search === "Suspended"
                    ? "Suspended"
                    : "All"
                }
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Last Sign In
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {users
                  .filter((u) => {
                    const searchLower = search.toLowerCase();
                    if (search === "Active") return !u.disabled;
                    if (search === "Suspended") return u.disabled;
                    return (
                      u.email?.toLowerCase().includes(searchLower) ||
                      u.firestoreEmail?.toLowerCase()?.includes(searchLower) ||
                      u.displayName?.toLowerCase()?.includes(searchLower) ||
                      u.phoneNumber?.toLowerCase()?.includes(searchLower) ||
                      u.role?.toLowerCase().includes(searchLower) ||
                      u.company?.companyName?.toLowerCase()?.includes(searchLower) ||
                      u.profile?.businessName?.toLowerCase()?.includes(searchLower)
                    );
                  })
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map((user) => {
                    const email = user.firestoreEmail || user.email;
                    const initials = email ? email.substring(0, 2).toUpperCase() : "?";
                    const businessName =
                      user.profile?.businessName ||
                      user.company?.companyName ||
                      email ||
                      "Unknown";

                    return (
                      <tr key={user.uid} className="hover:bg-blue-50 transition-all">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {user.profile?.photoURL || user.photoURL ? (
                              <img
                                src={user.profile?.photoURL || user.photoURL}
                                alt={businessName}
                                className="flex-shrink-0 h-10 w-10 rounded-full ring-2 ring-blue-200 object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                  const nextEl = target.nextElementSibling as HTMLElement;
                                  if (nextEl) nextEl.style.display = "flex";
                                }}
                              />
                            ) : null}
                            <div
                              className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm"
                              style={{
                                display: user.profile?.photoURL || user.photoURL ? "none" : "flex",
                              }}
                            >
                              {initials}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                {businessName}
                                {user.emailVerified && (
                                  <span className="text-green-600 text-xs">✓</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                {email || (
                                  <span className="text-gray-400 italic">No email</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-bold ${
                              user.role === "admin" || user.role === "superadmin"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {user.role === "admin" || user.role === "superadmin"
                              ? "Admin"
                              : "User"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {user.lastSignInAt ? (
                            <span>{new Date(user.lastSignInAt).toLocaleDateString()}</span>
                          ) : (
                            <span className="text-gray-400 italic">Never</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                              !user.disabled
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {!user.disabled ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            className={`inline-flex items-center gap-1 px-4 py-1.5 rounded-lg font-semibold text-xs shadow transition-all duration-150 ${
                              !user.disabled
                                ? "bg-red-500 text-white hover:bg-red-600"
                                : "bg-green-500 text-white hover:bg-green-600"
                            }`}
                            onClick={() => handleSuspend(user.uid)}
                            title={!user.disabled ? "Disable user" : "Enable user"}
                          >
                            {!user.disabled ? "Disable" : "Enable"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">
                      No Firebase users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {users
            .filter((u) => {
              const searchLower = search.toLowerCase();
              if (search === "Active") return !u.disabled;
              if (search === "Suspended") return u.disabled;
              return (
                u.email?.toLowerCase().includes(searchLower) ||
                u.firestoreEmail?.toLowerCase()?.includes(searchLower) ||
                u.displayName?.toLowerCase()?.includes(searchLower) ||
                u.phoneNumber?.toLowerCase()?.includes(searchLower) ||
                u.role?.toLowerCase().includes(searchLower) ||
                u.company?.companyName?.toLowerCase()?.includes(searchLower) ||
                u.profile?.businessName?.toLowerCase()?.includes(searchLower)
              );
            }).length > 0 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentPage === 1
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                Prev
              </button>
              {Array.from(
                {
                  length: Math.ceil(
                    users.filter((u) => {
                      const searchLower = search.toLowerCase();
                      if (search === "Active") return !u.disabled;
                      if (search === "Suspended") return u.disabled;
                      return (
                        u.email?.toLowerCase().includes(searchLower) ||
                        u.firestoreEmail?.toLowerCase()?.includes(searchLower) ||
                        u.displayName?.toLowerCase()?.includes(searchLower) ||
                        u.phoneNumber?.toLowerCase()?.includes(searchLower) ||
                        u.role?.toLowerCase().includes(searchLower) ||
                        u.company?.companyName?.toLowerCase()?.includes(searchLower) ||
                        u.profile?.businessName?.toLowerCase()?.includes(searchLower)
                      );
                    }).length / itemsPerPage
                  ),
                },
                (_, i) => i + 1
              ).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                    currentPage === pageNum
                      ? "bg-gray-900 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {pageNum}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={
                  currentPage ===
                  Math.ceil(
                    users.filter((u) => {
                      const searchLower = search.toLowerCase();
                      if (search === "Active") return !u.disabled;
                      if (search === "Suspended") return u.disabled;
                      return (
                        u.email?.toLowerCase().includes(searchLower) ||
                        u.firestoreEmail?.toLowerCase()?.includes(searchLower) ||
                        u.displayName?.toLowerCase()?.includes(searchLower) ||
                        u.phoneNumber?.toLowerCase()?.includes(searchLower) ||
                        u.role?.toLowerCase().includes(searchLower) ||
                        u.company?.companyName?.toLowerCase()?.includes(searchLower) ||
                        u.profile?.businessName?.toLowerCase()?.includes(searchLower)
                      );
                    }).length / itemsPerPage
                  )
                }
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentPage ===
                  Math.ceil(
                    users.filter((u) => {
                      const searchLower = search.toLowerCase();
                      if (search === "Active") return !u.disabled;
                      if (search === "Suspended") return u.disabled;
                      return (
                        u.email?.toLowerCase().includes(searchLower) ||
                        u.firestoreEmail?.toLowerCase()?.includes(searchLower) ||
                        u.displayName?.toLowerCase()?.includes(searchLower) ||
                        u.phoneNumber?.toLowerCase()?.includes(searchLower) ||
                        u.role?.toLowerCase().includes(searchLower) ||
                        u.company?.companyName?.toLowerCase()?.includes(searchLower) ||
                        u.profile?.businessName?.toLowerCase()?.includes(searchLower)
                      );
                    }).length / itemsPerPage
                  )
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Analytics Section */}
        <div className="gradient-border glow-on-hover premium-card bg-white shadow-lg p-4 sm:p-5 lg:p-6 xl:p-8 transition-all duration-300 hover:shadow-xl rounded-2xl">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
            <div className="bg-emerald-100 p-1.5 rounded-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5 text-emerald-600"
              >
                <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75zM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 01-1.875-1.875V8.625zM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 013 19.875v-6.75z" />
              </svg>
            </div>
            Analytics Overview
          </h3>

          {/* Customer Growth Chart */}
          <div className="mb-6 sm:mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h4 className="text-lg font-bold text-gray-900 mb-1">Customer Growth</h4>
                  <p className="text-sm text-gray-600">New SaaS client signups</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-700 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm">
                    Total: {stats?.totalUsers || 0} users
                  </span>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-blue-200">
                    <span className="text-xs font-medium text-gray-600">Last 30 Days</span>
                  </div>
                </div>
              </div>

              {/* Real Data Chart using Recharts */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                {(() => {
                  // Generate actual user growth data from real signup dates
                  const today = new Date();
                  const monthLabels: string[] = [];
                  const monthData: { [key: string]: number } = {};

                  // Generate last 6 months labels
                  for (let i = 5; i >= 0; i--) {
                    const d = new Date(today);
                    d.setMonth(today.getMonth() - i);
                    const monthKey = d.toLocaleDateString("en-US", { month: "short" });
                    const yearKey = d.getFullYear();
                    const label = `${monthKey}`;
                    monthLabels.push(label);
                    monthData[label] = 0;
                  }

                  // Count users by signup month
                  users.forEach((user) => {
                    if (user.createdAt) {
                      try {
                        const signupDate = new Date(user.createdAt);
                        const monthLabel = signupDate.toLocaleDateString("en-US", {
                          month: "short",
                        });
                        // Only count if within last 6 months
                        if (monthData.hasOwnProperty(monthLabel)) {
                          monthData[monthLabel]++;
                        }
                      } catch (e) {
                        console.error("Error parsing user createdAt", e);
                      }
                    }
                  });

                  // Convert to cumulative data for chart
                  const days: any[] = [];
                  let cumulative = 0;
                  for (const month of monthLabels) {
                    cumulative += monthData[month] || 0;
                    days.push({
                      month: month,
                      users: cumulative,
                      newUsers: monthData[month] || 0,
                    });
                  }

                  return (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart
                        data={days}
                        margin={{ left: 0, right: 20, top: 10, bottom: 10 }}
                      >
                        <defs>
                          <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 12, fill: "#6b7280" }}
                          axisLine={{ stroke: "#e5e7eb" }}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "#6b7280" }}
                          allowDecimals={false}
                          axisLine={{ stroke: "#e5e7eb" }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            padding: "8px 12px",
                          }}
                          formatter={(value: any, name: string) => {
                            if (name === "users") return [value, "Total Users"];
                            if (name === "newUsers") return [value, "New Signups"];
                            return [value, name];
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="users"
                          stroke="#3b82f6"
                          fillOpacity={1}
                          fill="url(#colorUsers)"
                        />
                        <Line
                          type="monotone"
                          dataKey="users"
                          stroke="#3b82f6"
                          strokeWidth={3}
                          dot={{ fill: "#3b82f6", r: 5 }}
                          
                          
                          activeDot={{ r: 7 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
