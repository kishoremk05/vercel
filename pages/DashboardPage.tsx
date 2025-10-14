import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Customer, ActivityLog, CustomerStatus } from "../types";
// Firebase direct access removed - using API endpoints only
// import {
//   fetchDashboardStatsFromFirebase,
//   fetchNegativeFeedback,
//   fetchClientProfile,
// } from "../lib/dashboardFirebase";
import { getSmsServerUrl } from "../lib/firebaseConfig";
import {
  PlusIcon,
  MessageIcon,
  PaperAirplaneIcon,
  TrashIcon,
  UploadIcon,
  SearchIcon,
  CreditCardIcon,
  EllipsisVerticalIcon,
  ClickIcon,
  StarIcon,
  LinkIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "../components/icons";
import AddCustomerModal from "../components/AddCustomerModal";
import DebugBoundary from "../components/DebugBoundary";

interface DashboardStats {
  messageCount: number;
  feedbackCount: number;
  avgRating: number;
  sentimentCounts: {
    POSITIVE?: number;
    NEUTRAL?: number;
    NEGATIVE?: number;
    positive?: number;
    neutral?: number;
    negative?: number;
  };
}

// Inline lock component for customer list
// SubscriptionCustomerLock removed — payment concept disabled
const SubscriptionCustomerLock: React.FC = () => null;

// Custom hook to fetch dashboard stats from Firebase
const useDashboardStats = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      // Get client ID from localStorage
      let companyId: string | null =
        localStorage.getItem("companyId") || localStorage.getItem("auth_uid");

      const start = Date.now();
      const maxWaitMs = 10000;
      const pollInterval = 250;

      // Wait for client ID to be available
      while (!companyId && Date.now() - start < maxWaitMs) {
        await new Promise((r) => setTimeout(r, pollInterval));
        companyId =
          localStorage.getItem("companyId") || localStorage.getItem("auth_uid");
      }

      if (!companyId) {
        // Check if we're in demo mode
        const urlParams = new URLSearchParams(window.location.search);
        const tenantKey =
          urlParams.get("tenantKey") || localStorage.getItem("tenantKey");

        if (
          tenantKey === "demo" ||
          window.location.pathname.includes("dashboard")
        ) {
          // Demo mode - use demo data
          setStats({
            messageCount: 0,
            feedbackCount: 0,
            avgRating: 0,
            sentimentCounts: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
          });
          setLoading(false);
          return;
        }

        setError("No company ID found. Please log in again.");
        setLoading(false);
        return;
      }

      console.log(
        "[Dashboard] Fetching dashboard stats for client:",
        companyId
      );

      // Use API endpoint only - Firebase direct access removed for security
      const base = await getSmsServerUrl();
      const url = base
        ? `${base}/api/dashboard/stats?companyId=${companyId}`
        : `/api/dashboard/stats?companyId=${companyId}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch dashboard stats");
      }

      const data = await response.json();
      if (data.success && data.stats) {
        const sc = data.stats.sentimentCounts || {};
        const norm = {
          POSITIVE: sc.POSITIVE ?? sc.positive ?? 0,
          NEUTRAL: sc.NEUTRAL ?? sc.neutral ?? 0,
          NEGATIVE: sc.NEGATIVE ?? sc.negative ?? 0,
        };
        const feedbackCount =
          typeof data.stats.feedbackCount === "number"
            ? data.stats.feedbackCount
            : norm.POSITIVE + norm.NEUTRAL + norm.NEGATIVE;
        setStats({
          messageCount: Number(data.stats.messageCount || 0),
          feedbackCount,
          avgRating: Number(data.stats.avgRating || 0),
          sentimentCounts: norm,
        });
        setError(null);
        setLoading(false);
        return;
      } else {
        throw new Error(data.error || "Invalid response format");
      }
    } catch (e: any) {
      // If Firebase and API fail, fallback to localStorage
      console.error("[Firebase] Error fetching stats:", e);
      try {
        // Try to reconstruct stats from localStorage customers
        const customersRaw = localStorage.getItem("customers");
        let customers: any[] = [];
        if (customersRaw) {
          customers = JSON.parse(customersRaw);
        }
        // Count messages sent (status Sent/Clicked/Reviewed)
        const messageCount = customers.filter(
          (c) =>
            c.status === "Sent" ||
            c.status === "Clicked" ||
            c.status === "Reviewed"
        ).length;
        // Gather all feedback
        const allFeedback = customers.flatMap((c) => c.feedback || []);
        const sentimentCounts = {
          POSITIVE: allFeedback.filter((f) => f.sentiment === "positive")
            .length,
          NEUTRAL: allFeedback.filter((f) => f.sentiment === "neutral").length,
          NEGATIVE: allFeedback.filter((f) => f.sentiment === "negative")
            .length,
        };
        const feedbackCount =
          sentimentCounts.POSITIVE +
          sentimentCounts.NEUTRAL +
          sentimentCounts.NEGATIVE;
        const avgRating =
          allFeedback.length > 0
            ? allFeedback.reduce(
                (sum, f) => sum + (typeof f.rating === "number" ? f.rating : 0),
                0
              ) / allFeedback.length
            : 0;
        setStats({
          messageCount,
          feedbackCount,
          avgRating,
          sentimentCounts,
        });
        setError(
          `Showing offline data. Live stats unavailable: ${
            e.message || "API error"
          }`
        );
      } catch (err: any) {
        // Always show empty dummy data if everything fails
        setError(null);
        setStats({
          messageCount: 0,
          feedbackCount: 0,
          avgRating: 0,
          sentimentCounts: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ...existing code...

  useEffect(() => {
    // Initial load
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    // Refresh stats automatically after successful SMS sends
    const onSmsSuccess = () => {
      // Show loading shimmer briefly on refresh
      setLoading(true);
      fetchStats();
    };
    const onFeedbackChanged = () => {
      setLoading(true);
      fetchStats();
    };
    const onAuthReady = (e?: Event) => {
      // debug: helps confirm the event is being dispatched
      // eslint-disable-next-line no-console
      console.debug("DashboardPage: auth:ready received", e);
      setLoading(true);
      fetchStats();
    };
    window.addEventListener("dash:sms:success", onSmsSuccess as any);
    window.addEventListener("dash:feedback:changed", onFeedbackChanged as any);
    window.addEventListener("auth:ready", onAuthReady as any);
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === "companyId") {
        // eslint-disable-next-line no-console
        console.debug(
          "DashboardPage: storage event - companyId set",
          ev.newValue
        );
        setLoading(true);
        fetchStats();
      }
    };
    window.addEventListener("storage", onStorage as any);
    return () => {
      window.removeEventListener("dash:sms:success", onSmsSuccess as any);
      window.removeEventListener(
        "dash:feedback:changed",
        onFeedbackChanged as any
      );
      window.removeEventListener("auth:ready", onAuthReady as any);
      window.removeEventListener("storage", onStorage as any);
    };
  }, [fetchStats]);

  return { stats, loading, error };
};

const RealDashboardOverview: React.FC = () => {
  const { stats, loading, error } = useDashboardStats();

  const Card = ({
    value,
    label,
    colorClass = "text-gray-900",
    iconPath,
    iconBg = "bg-gray-100",
    iconColor = "text-gray-600",
  }: {
    value: string;
    label: string;
    colorClass?: string;
    iconPath: string;
    iconBg?: string;
    iconColor?: string;
  }) => {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 lg:p-6 hover:shadow-lg hover:border-gray-300 transition-all duration-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 sm:mb-3">
              {label}
            </div>
            <div className={`text-2xl sm:text-3xl font-bold ${colorClass}`}>
              {value}
            </div>
          </div>
          <div className={`${iconBg} p-2 sm:p-3 rounded-xl`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-5 w-5 ${iconColor}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d={iconPath}
              />
            </svg>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 lg:p-6 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-600">
        <p className="font-semibold">Error loading dashboard stats</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const totalFeedback = stats.feedbackCount;
  const conversionRate =
    stats.messageCount > 0
      ? ((totalFeedback / stats.messageCount) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 mb-6">
      <Card
        value={stats.messageCount.toString()}
        label="Messages Sent"
        colorClass="text-blue-600"
        iconBg="bg-blue-100"
        iconColor="text-blue-600"
        iconPath="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
      <Card
        value={totalFeedback.toString()}
        label="Feedback Received"
        colorClass="text-green-600"
        iconBg="bg-green-100"
        iconColor="text-green-600"
        iconPath="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </div>
  );
};

// Sentiment Analysis Chart Component
const SentimentChart: React.FC<{ stats: DashboardStats | null }> = ({
  stats,
}) => {
  if (!stats) return null;

  const data = [
    {
      name: "Positive",
      value: stats.sentimentCounts.POSITIVE,
      color: "#10b981",
    },
    { name: "Neutral", value: stats.sentimentCounts.NEUTRAL, color: "#6b7280" },
    {
      name: "Negative",
      value: stats.sentimentCounts.NEGATIVE,
      color: "#ef4444",
    },
  ];

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const SubscriptionCustomerLock: React.FC = () => {
    const [locked, setLocked] = React.useState(false);
    React.useEffect(() => {
      const evalLock = () => {
        try {
          const raw = localStorage.getItem("subscription");
          if (!raw) return setLocked(true);
          const sub = JSON.parse(raw);
          const active =
            sub.status === "active" &&
            sub.endDate &&
            new Date(sub.endDate).getTime() > Date.now();
          const creditsOk = (sub.remainingCredits ?? sub.smsCredits) > 0;
          setLocked(!(active && creditsOk));
        } catch {
          setLocked(true);
        }
      };
      evalLock();
      const id = setInterval(evalLock, 5000);
      window.addEventListener("storage", evalLock);
      return () => {
        clearInterval(id);
        window.removeEventListener("storage", evalLock);
      };
    }, []);
    if (!locked) return null;
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/85 backdrop-blur-sm border-2 border-dashed border-indigo-300">
        <div className="text-center px-6 py-8">
          <h4 className="text-xl font-bold text-gray-900 mb-2">
            Activate Your Plan
          </h4>
          <p className="text-gray-600 mb-4 max-w-xs">
            Subscribe to unlock customer import and bulk SMS sending.
          </p>
          <button
            onClick={() => {
              try {
                localStorage.setItem("pendingPlan", "growth_3m");
              } catch {}
              // Payments removed: inform the user how to proceed
              try {
                alert(
                  "Payments are currently disabled in this build. Contact the admin to enable subscription plans."
                );
              } catch {}
            }}
            className="px-5 py-3 rounded-lg bg-indigo-600 text-white font-semibold shadow hover:bg-indigo-500"
          >
            Choose a Plan
          </button>
        </div>
      </div>
    );
  };
  if (total === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Sentiment Analysis
        </h3>
        <div className="text-center text-gray-500 py-8">
          No feedback data available yet
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Sentiment Analysis
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) =>
              `${name}: ${(percent * 100).toFixed(0)}%`
            }
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// Wrapper component that fetches stats for sentiment chart
const SentimentChartWrapper: React.FC = () => {
  const { stats, loading, error } = useDashboardStats();

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-600">
        <p className="font-semibold">Error loading sentiment data</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return <SentimentChart stats={stats} />;
};

// Dashboard Overview cards (top summary) – counts sent based on logs first, fallback to status.
const DashboardOverview: React.FC<{
  customers: Customer[];
  activityLogs: ActivityLog[];
}> = ({ customers, activityLogs }) => {
  // Count sends from logs (preferred accurate source)
  const sentLogCount = activityLogs.filter((log) => {
    const a = log.action.toLowerCase();
    return (
      a.includes("sent sms") ||
      a.includes("resend sms") ||
      a.includes("sent review request")
    );
  }).length;
  // Fallback to status derived
  const statusDerivedSent = customers
    .filter((c) => c.id !== "public-feedback")
    .filter(
      (c) =>
        c.status === "Sent" || c.status === "Clicked" || c.status === "Reviewed"
    ).length;
  const messagesSent = sentLogCount > 0 ? sentLogCount : statusDerivedSent;

  const reviewRedirects = customers.filter(
    (c) => c.status === "Clicked" || c.status === "Reviewed"
  ).length;

  const conversionRate =
    messagesSent > 0 ? (reviewRedirects / messagesSent) * 100 : 0;

  const Card = ({
    value,
    label,
    colorClass = "text-gray-900",
  }: {
    value: string;
    label: string;
    colorClass?: string;
  }) => {
    let bgColor = "bg-gray-50";
    let iconColor = "text-gray-400";
    let iconBg = "bg-gray-100";
    let iconPath =
      "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4";

    if (colorClass.includes("green")) {
      bgColor = "bg-emerald-50";
      iconColor = "text-emerald-600";
      iconBg = "bg-emerald-100";
      iconPath = "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z";
    } else if (colorClass.includes("red")) {
      bgColor = "bg-red-50";
      iconColor = "text-red-600";
      iconBg = "bg-red-100";
      iconPath =
        "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z";
    }

    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 lg:p-6 hover:shadow-lg hover:border-gray-300 transition-all duration-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 sm:mb-3">
              {label}
            </div>
            <div className={`text-2xl sm:text-3xl font-bold ${colorClass}`}>
              {value}
            </div>
          </div>
          <div className={`${iconBg} p-2 sm:p-3 rounded-xl`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-5 w-5 ${iconColor}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d={iconPath}
              />
            </svg>
          </div>
        </div>
      </div>
    );
  };

  // Count positive/negative reviews from all feedback
  const allFeedback = customers.flatMap((c) => c.feedback || []);
  const positiveCount = allFeedback.filter(
    (f) => f.sentiment === "positive"
  ).length;
  const negativeCount = allFeedback.filter(
    (f) => f.sentiment === "negative"
  ).length;

  return (
    <div className="mb-0">
      <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 mb-3 sm:mb-4 lg:mb-6">
        Overview
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        <Card value={messagesSent.toLocaleString()} label="Messages Sent" />
        <Card
          value={positiveCount.toLocaleString()}
          label="Positive Reviews"
          colorClass="text-green-600"
        />
        <Card
          value={negativeCount.toLocaleString()}
          label="Negative Reviews"
          colorClass="text-red-600"
        />
      </div>
    </div>
  );
};
// (Small card component for negative comments removed per UI request)
// Props for NegativeFeedbackSection
// Section to show only negative feedback comments FROM FIREBASE
type NegativeFeedbackSectionProps = {
  comments: Array<{
    id: string;
    companyId: string;
    customerPhone: string;
    commentText: string;
    rating: number;
    createdAt: any;
  }>;
  loading: boolean;
  onDelete: (commentId: string) => void;
  onExport?: () => void;
  onClearAll?: () => void;
  businessName?: string;
  feedbackPageLink?: string;
  deletingIds?: string[];
};
const NegativeFeedbackSection: React.FC<NegativeFeedbackSectionProps> = ({
  comments,
  loading,
  onDelete,
  onExport,
  onClearAll,
  businessName,
  feedbackPageLink,
  deletingIds = [],
}) => {
  // Pagination and search state (table style like Customer List)
  const pageSize = 2;
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => setCurrentPage(1), [searchQuery, comments]);

  // Local helper for WhatsApp support-style message (kept inside component scope)
  function getSupportWaMessage(customerName: string) {
    const reviewLink = feedbackPageLink || window.location.href;
    const tmpl =
      "Hi [Customer Name], sorry for your bad experience. We'll sort the issue as soon as possible.";
    return tmpl
      .replace(/\[Customer Name\]/g, customerName || "Customer")
      .replace(/\[Review Link\]/g, reviewLink || "");
  }

  // Build a deduplicated list of comments (fingerprint: phone|text|createdAt)
  const uniqueComments = React.useMemo(() => {
    const map: Record<string, any> = {};
    (comments || []).forEach((c) => {
      if (!c) return;
      const phone = (c.customerPhone || "").replace(/\s+/g, "");
      const text = String(c.commentText || "").replace(/\r?\n/g, " ");

      // Safe date conversion with validation
      let createdAtIso: string;
      try {
        if (c.createdAt?.toDate) {
          const d = new Date(c.createdAt.toDate());
          createdAtIso = !isNaN(d.getTime())
            ? d.toISOString()
            : new Date().toISOString();
        } else if (c.createdAt) {
          const d = new Date(c.createdAt);
          createdAtIso = !isNaN(d.getTime())
            ? d.toISOString()
            : new Date().toISOString();
        } else {
          createdAtIso = new Date().toISOString();
        }
      } catch {
        createdAtIso = new Date().toISOString();
      }

      const key = `${phone}||${text}||${createdAtIso}`;
      const existing = map[key];
      if (!existing) map[key] = { ...c, createdAtIso };
      else {
        try {
          const cur = Date.parse(
            existing.createdAtIso || existing.createdAt || ""
          );
          const nowTs = Date.parse(createdAtIso || "");
          if (nowTs > cur) map[key] = { ...c, createdAtIso };
        } catch {
          // ignore
        }
      }
    });
    return Object.values(map).sort((a: any, b: any) => {
      const ta = Date.parse(a.createdAtIso || a.createdAt || "");
      const tb = Date.parse(b.createdAtIso || b.createdAt || "");
      return tb - ta;
    });
  }, [comments]);
  // Filter by search query (name or phone or text)
  const filtered = React.useMemo(() => {
    const q = String(searchQuery || "")
      .trim()
      .toLowerCase();
    if (!q) return uniqueComments;
    return uniqueComments.filter((c) => {
      const phone = String(c.customerPhone || "").toLowerCase();
      const text = String(c.commentText || "").toLowerCase();
      return phone.includes(q) || text.includes(q);
    });
  }, [uniqueComments, searchQuery]);
  if (loading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-200 mt-2">
        <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
          <div className="bg-red-100 p-1.5 rounded-full">
            <XCircleIcon className="h-5 w-5 text-red-600" />
          </div>
          Negative Comments
        </h3>
        <p className="text-gray-500 text-center py-4">Loading comments...</p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-200 mt-2">
        <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
          <div className="bg-red-100 p-1.5 rounded-full">
            <XCircleIcon className="h-5 w-5 text-red-600" />
          </div>
          Negative Comments
        </h3>
        <p className="text-gray-500 text-center py-8">
          No negative comments yet. Feedback will appear here automatically.
        </p>
      </div>
    );
  }
  // New: render table-style layout similar to Customer List
  return (
    <div className="gradient-border glow-on-hover premium-card bg-white shadow-lg transition-all duration-300 hover:shadow-xl rounded-2xl p-4 sm:p-5 lg:p-6">
      <div className="mb-4 sm:mb-6 flex items-center justify-between">
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-0 flex items-center gap-2">
          <div className="bg-red-100 p-1.5 rounded-full">
            <XCircleIcon className="h-5 w-5 text-red-600" />
          </div>
          Negative Comments
          <span className="text-xs leading-4 font-bold text-gray-600 bg-gray-100 border border-gray-200 px-3 py-1 rounded-full">
            {uniqueComments.length} total
          </span>
        </h3>
        <div className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by phone or text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-gray-900 shadow-sm text-sm sm:text-base"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => onExport && onExport()}
                className="px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 text-sm"
              >
                Export
              </button>
              <button
                type="button"
                onClick={() => onClearAll && onClearAll()}
                className="px-3 py-2 bg-red-50 border border-red-100 text-red-700 rounded-xl hover:bg-red-100 text-sm"
              >
                Clear data
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        {/* Desktop/table view (show on sm and larger) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-3 sm:px-6 py-3 font-medium">Phone</th>
                <th className="px-3 sm:px-6 py-3 font-medium">Comment</th>
                <th className="px-3 sm:px-6 py-3 font-medium">Date</th>
                <th className="px-3 sm:px-6 py-3 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const start = (currentPage - 1) * pageSize;
                const rows = filtered.slice(start, start + pageSize);
                return rows.map((c) => (
                  <tr key={c.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-3">{c.customerPhone}</td>
                    <td className="px-3 sm:px-6 py-3">{c.commentText}</td>
                    <td className="px-3 sm:px-6 py-3 text-xs text-gray-500">
                      {c.createdAt?.toDate
                        ? new Date(c.createdAt.toDate()).toLocaleString()
                        : new Date(c.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <a
                          onClick={(e) => {
                            e.preventDefault();
                            const phone = (c.customerPhone || "").replace(
                              /\D/g,
                              ""
                            );
                            if (!phone) return;
                            const msg = encodeURIComponent(
                              getSupportWaMessage(c.customerPhone || "Customer")
                            );
                            window.open(
                              `https://wa.me/${phone}?text=${msg}`,
                              "_blank",
                              "noopener,noreferrer"
                            );
                          }}
                          className="p-3 rounded-md hover:bg-green-50 text-green-700 inline-flex items-center justify-center"
                          href="#"
                          title="Reply via WhatsApp"
                        >
                          <svg
                            className="h-6 w-6"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden
                          >
                            <path d="M20.52 3.48A11.86 11.86 0 0012 0C5.37 0 .02 5.36 0 12c0 2.11.55 4.18 1.6 6.01L0 24l6.12-1.59A11.95 11.95 0 0012 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.2-3.48-8.52zM12 21.5c-1.8 0-3.55-.46-5.1-1.33l-.36-.19-3.64.94.98-3.55-.23-.37A9.5 9.5 0 012.5 12c0-5.24 4.26-9.5 9.5-9.5 2.54 0 4.92.99 6.72 2.79A9.45 9.45 0 0121.5 12c0 5.24-4.26 9.5-9.5 9.5z" />
                          </svg>
                        </a>
                        <button
                          onClick={() => onDelete(c.id)}
                          className="p-3 rounded-md hover:bg-red-50 text-red-600 inline-flex items-center justify-center"
                          disabled={(deletingIds || []).includes(c.id)}
                          title="Delete comment"
                        >
                          {(deletingIds || []).includes(c.id) ? (
                            <span className="text-xs text-gray-500">
                              Deleting...
                            </span>
                          ) : (
                            <TrashIcon className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>

        {/* Mobile stacked card view (show on xs only) */}
        <div className="block sm:hidden space-y-3">
          {(() => {
            const start = (currentPage - 1) * pageSize;
            const rows = filtered.slice(start, start + pageSize);
            return rows.map((c) => (
              <div
                key={c.id}
                className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {c.customerPhone || "—"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {c.createdAt?.toDate
                          ? new Date(c.createdAt.toDate()).toLocaleString()
                          : new Date(c.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-700 whitespace-pre-line break-words">
                      {c.commentText}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      const phone = (c.customerPhone || "").replace(/\D/g, "");
                      if (!phone) return;
                      const msg = encodeURIComponent(
                        getSupportWaMessage(c.customerPhone || "Customer")
                      );
                      window.open(
                        `https://wa.me/${phone}?text=${msg}`,
                        "_blank",
                        "noopener,noreferrer"
                      );
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-semibold hover:bg-green-100"
                    title="Reply via WhatsApp"
                  >
                    Reply
                  </button>
                  <button
                    onClick={() => onDelete(c.id)}
                    disabled={(deletingIds || []).includes(c.id)}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100"
                    title="Delete comment"
                  >
                    {(deletingIds || []).includes(c.id) ? (
                      <span className="text-xs text-gray-500">Deleting...</span>
                    ) : (
                      <TrashIcon className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Pagination */}
      {(() => {
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        return (
          <div className="flex justify-center items-center mt-4 gap-2">
            <button
              className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-900 font-medium hover:bg-gray-50 disabled:opacity-50"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`px-3 py-1 rounded-full font-medium ${
                  p === currentPage
                    ? "bg-gray-900 text-white"
                    : "bg-white border text-gray-700"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-900 font-medium hover:bg-gray-50 disabled:opacity-50"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        );
      })()}
    </div>
  );
};
// (imports moved to top)

declare var XLSX: any;

const FunnelAnalytics: React.FC<{ customers: Customer[] }> = ({
  customers,
}) => {
  // Match Analytics section: local demo toggle persisted to localStorage
  const [demoMode, setDemoMode] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem("dash:demoMode") === "1";
    } catch {
      return false;
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem("dash:demoMode", demoMode ? "1" : "0");
    } catch {}
  }, [demoMode]);
  const showDemo = demoMode;

  // Demo/sample data
  const demoStats = {
    total: 120,
    sent: { count: 110, rate: 110 / 120 },
    clicked: { count: 80, rate: 80 / 110 },
    reviewed: { count: 50, rate: 50 / 80 },
    positive: 40,
    negative: 10,
    ratingCounts: { 1: 2, 2: 5, 3: 8 },
  };

  const stats = React.useMemo(() => {
    if (showDemo) return demoStats;
    const total = customers.length;
    const sent = customers.filter(
      (c) =>
        c.status === "Sent" || c.status === "Clicked" || c.status === "Reviewed"
    ).length;
    const clicked = customers.filter(
      (c) => c.status === "Clicked" || c.status === "Reviewed"
    ).length;
    const reviewed = customers.filter((c) => c.status === "Reviewed").length;
    // Aggregate all feedback entries from all customers
    const allFeedback = customers.flatMap((c) => c.feedback || []);
    const positive = allFeedback.filter(
      (f) => f.sentiment === "positive"
    ).length;
    const negative = allFeedback.filter(
      (f) => f.sentiment === "negative"
    ).length;
    // Star ratings breakdown for Pie chart and sentiment graph
    const ratingCounts: Record<number, number> = {};
    allFeedback.forEach((f) => {
      if (typeof f.rating === "number") {
        ratingCounts[f.rating] = (ratingCounts[f.rating] || 0) + 1;
      }
    });
    return {
      total,
      sent: { count: sent, rate: total > 0 ? sent / total : 0 },
      clicked: { count: clicked, rate: sent > 0 ? clicked / sent : 0 },
      reviewed: { count: reviewed, rate: clicked > 0 ? reviewed / clicked : 0 },
      positive,
      negative,
      ratingCounts,
    };
  }, [customers, showDemo]);

  const FunnelStage: React.FC<{
    icon: React.ReactNode;
    title: string;
    count: number;
    total: number;
    color: string;
    isFirst?: boolean;
  }> = ({ icon, title, count, total, color, isFirst = false }) => {
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <div className="flex items-center">
        {!isFirst && (
          <div className="w-12 text-center text-sm text-gray-600 self-stretch flex items-center justify-center font-medium">
            <span className="bg-indigo-100 px-2 py-1 rounded-md">
              {Math.round(stats.clicked.rate * 100)}%
            </span>{" "}
            →
          </div>
        )}
        <div
          className={`flex-1 bg-white p-6 rounded-xl border-2 border-gray-200 flex items-center space-x-4 hover:shadow-lg hover:border-gray-300 transition-all duration-200 ${
            isFirst ? "w-full" : ""
          }`}
        >
          <div className={`p-3.5 rounded-xl shadow-sm ${color}`}>{icon}</div>
          <div>
            <p className="text-sm text-gray-500 font-semibold uppercase tracking-wide">
              {title}
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
          </div>
          {!isFirst && (
            <div className="ml-auto text-right bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
              <p className="text-sm font-semibold text-gray-700">
                {percentage}%
              </p>
              <p className="text-xs text-gray-500">of previous</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Deterministic pie chart data for star ratings (only 1,2,3 – hide 4 & 5 per requirement)
  const rawCounts = stats.ratingCounts;
  const ordered = [1, 2, 3].map((r) => ({
    rating: r,
    value: rawCounts[r] || 0,
  }));
  const hasAnyRating = ordered.some((o) => o.value > 0);
  const pieData = hasAnyRating
    ? ordered.map((o) => ({
        name: `${o.rating} Star${o.rating > 1 ? "s" : ""}`,
        value: o.value,
      }))
    : [{ name: "No Ratings", value: 1 }];
  // Color mapping: 1=red, 2=amber, 3=yellow (darker progression for severity)
  const pieColors = hasAnyRating
    ? ["#dc2626", "#f59e0b", "#fbbf24"]
    : ["#E5E7EB"]; // neutral gray when empty

  // Donut chart data for feedback (fallback if empty)
  const donutDataRaw = [
    { name: "Positive", value: stats.positive },
    { name: "Negative", value: stats.negative },
  ];
  const hasDonut = donutDataRaw.some((d) => d.value !== 0);
  const donutData = hasDonut
    ? donutDataRaw
    : [{ name: "No Feedback", value: 1 }];
  const donutColors = ["#4CAF50", "#F44336", "#E5E7EB"];

  return (
    <div className="gradient-border glow-on-hover premium-card bg-transparent shadow-lg p-4 sm:p-5 lg:p-6 transition-all duration-300 hover:shadow-xl rounded-2xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
          Smart Funnel Analytics
          {showDemo && (
            <span className="text-[10px] leading-4 font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200">
              Sample Data
            </span>
          )}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDemoMode((v) => !v)}
            aria-pressed={demoMode}
            title="Toggle demo charts"
            className={`text-[10px] leading-4 px-2 py-1 rounded-md border transition-colors ${
              demoMode
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            Demo
          </button>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
            Positive: {stats.positive}
          </span>
          <span className="text-[11px] font-semibold text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-md">
            Negative: {stats.negative}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        <div
          className="gradient-border glow-on-hover premium-card bg-gradient-to-br from-blue-100/50 via-indigo-50/30 to-white p-4 sm:p-5 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300"
          style={{ border: "1px solid rgba(59, 130, 246, 0.1)" }}
        >
          <h4 className="text-[10px] sm:text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 sm:mb-4">
            Customer Ratings
          </h4>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label
              >
                {pieData.map((entry, idx) => (
                  <Cell
                    key={`cell-${idx}`}
                    fill={pieColors[idx % pieColors.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                wrapperStyle={{
                  boxShadow: "0 3px 10px rgba(0,0,0,0.1)",
                  borderRadius: "8px",
                  padding: "10px",
                }}
              />
              <Legend iconSize={10} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
          {(!hasAnyRating ||
            (pieData.length === 1 && pieData[0].name === "No Ratings")) && (
            <div className="text-center text-gray-400 text-sm mt-3 italic bg-gray-50 py-2 rounded-lg">
              No 1–3 star ratings yet
            </div>
          )}
        </div>
        <div
          className="gradient-border glow-on-hover premium-card bg-gradient-to-br from-purple-100/50 via-pink-50/30 to-white p-4 sm:p-5 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300"
          style={{ border: "1px solid rgba(168, 85, 247, 0.1)" }}
        >
          <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-4">
            Feedback Summary
          </h4>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                label
              >
                {donutData.map((entry, idx) => (
                  <Cell
                    key={`cell-donut-${idx}`}
                    fill={donutColors[idx % donutColors.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                wrapperStyle={{
                  boxShadow: "0 3px 10px rgba(0,0,0,0.1)",
                  borderRadius: "8px",
                  padding: "10px",
                }}
              />
              <Legend iconSize={10} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
          {donutData.length === 1 && donutData[0].name === "No Feedback" && (
            <div className="text-center text-gray-400 text-sm mt-3 italic bg-gray-50 py-2 rounded-lg">
              No feedback yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// New Analytics section with tabbed nav bar (no slider/toggles)
const AnalyticsSection: React.FC<{
  customers: Customer[];
  activityLogs: ActivityLog[];
}> = ({ customers, activityLogs }) => {
  // Simplified: Show only Messages Sent vs Received (Requirement 2)
  // No tabs needed - direct display
  const activeTab = "messages"; // Fixed to messages view only

  // Fetch real message data from Firebase
  const [firebaseMessages, setFirebaseMessages] = useState<
    Array<{
      timestamp: Date;
      messageType: string;
    }>
  >([]);
  const [loadingMessages, setLoadingMessages] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const companyId = localStorage.getItem("companyId");
        if (!companyId) {
          console.log("[AnalyticsSection] No companyId found");
          setLoadingMessages(false);
          return;
        }

        console.log(
          "[AnalyticsSection] Fetching messages for company:",
          companyId
        );
        const base = await getSmsServerUrl();
        const url = base
          ? `${base}/api/dashboard/messages?companyId=${companyId}`
          : `/api/dashboard/messages?companyId=${companyId}`;
        const response = await fetch(url);
        if (!response.ok) {
          console.error(
            "[AnalyticsSection] Failed to fetch messages:",
            response.status
          );
          setLoadingMessages(false);
          return;
        }

        const data = await response.json();
        console.log(
          "[AnalyticsSection] Received messages:",
          data.messages?.length || 0
        );

        // Parse dates and set messages
        const messages = (data.messages || []).map((msg: any) => ({
          ...msg,
          timestamp: msg.timestamp?.toDate
            ? msg.timestamp.toDate()
            : new Date(msg.timestamp),
        }));

        setFirebaseMessages(messages);
        setLoadingMessages(false);
      } catch (error) {
        console.error("[AnalyticsSection] Error fetching messages:", error);
        setLoadingMessages(false);
      }
    };

    fetchMessages();

    // Refetch when SMS is sent
    const handleSmsSuccess = () => {
      console.log("[AnalyticsSection] SMS success event, refetching messages");
      fetchMessages();
    };
    window.addEventListener("dash:sms:success", handleSmsSuccess as any);

    return () => {
      window.removeEventListener("dash:sms:success", handleSmsSuccess as any);
    };
  }, []);

  // Demo mode toggle (very small button). Persist to localStorage
  const [demoMode, setDemoMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem("dash:demoMode") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("dash:demoMode", demoMode ? "1" : "0");
    } catch {}
  }, [demoMode]);

  // Helper: range of last N days [oldest..today]
  const daysBack = 30;
  const today = new Date();
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const dayKeys: string[] = [];
  const dayDates: Date[] = [];
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    d.setHours(0, 0, 0, 0);
    dayDates.push(d);
    dayKeys.push(fmt(d));
  }

  // Customer Growth (cumulative)
  const growthMap: Record<string, number> = Object.fromEntries(
    dayKeys.map((k) => [k, 0])
  );
  customers.forEach((c) => {
    const d = new Date(c.addedAt);
    d.setHours(0, 0, 0, 0);
    const key = fmt(d);
    if (key in growthMap) growthMap[key] += 1;
  });
  const realGrowthData = dayKeys.map((k, i) => ({
    day: k,
    customers:
      (growthMap[k] || 0) +
      (i > 0 ? (growthMap as any)[`__acc_${i - 1}`] || 0 : 0),
  }));
  // Accumulate
  let acc = 0;
  for (let i = 0; i < realGrowthData.length; i++) {
    acc += growthMap[dayKeys[i]] || 0;
    (growthMap as any)[`__acc_${i}`] = acc;
    realGrowthData[i].customers = acc;
  }

  // Message Activity (cumulative) - USE REAL FIREBASE MESSAGES DATA
  const messageActivityMap: Record<string, number> = Object.fromEntries(
    dayKeys.map((k) => [k, 0])
  );

  // Use Firebase messages if available, fallback to activityLogs
  if (firebaseMessages.length > 0) {
    console.log(
      "[AnalyticsSection] Using Firebase messages data (",
      firebaseMessages.length,
      "messages)"
    );
    firebaseMessages.forEach((msg) => {
      const d = new Date(msg.timestamp);
      d.setHours(0, 0, 0, 0);
      const key = fmt(d);
      if (key in messageActivityMap) messageActivityMap[key] += 1;
    });
  } else {
    console.log("[AnalyticsSection] Using activityLogs as fallback");
    activityLogs.forEach((log) => {
      const a = log.action.toLowerCase();
      if (
        a.includes("sent sms") ||
        a.includes("resend sms") ||
        a.includes("sent review request") ||
        a.includes("whatsapp")
      ) {
        const d = new Date(log.timestamp);
        d.setHours(0, 0, 0, 0);
        const key = fmt(d);
        if (key in messageActivityMap) messageActivityMap[key] += 1;
      }
    });
  }

  const realMessageActivityData = dayKeys.map((k, i) => ({
    day: k,
    messages:
      (messageActivityMap[k] || 0) +
      (i > 0 ? (messageActivityMap as any)[`__acc_${i - 1}`] || 0 : 0),
  }));
  // Accumulate messages
  let msgAcc = 0;
  for (let i = 0; i < realMessageActivityData.length; i++) {
    msgAcc += messageActivityMap[dayKeys[i]] || 0;
    (messageActivityMap as any)[`__acc_${i}`] = msgAcc;
    realMessageActivityData[i].messages = msgAcc;
  }

  // Messages Sent (from logs) vs Received (from feedback)
  const sentMap: Record<string, number> = Object.fromEntries(
    dayKeys.map((k) => [k, 0])
  );
  const receivedMap: Record<string, number> = Object.fromEntries(
    dayKeys.map((k) => [k, 0])
  );
  activityLogs.forEach((log) => {
    const a = log.action.toLowerCase();
    if (
      a.includes("sent sms") ||
      a.includes("resend sms") ||
      a.includes("sent review request")
    ) {
      const d = new Date(log.timestamp);
      d.setHours(0, 0, 0, 0);
      const key = fmt(d);
      if (key in sentMap) sentMap[key] += 1;
    }
  });
  customers.forEach((c) => {
    (c.feedback || []).forEach((fb) => {
      const d = new Date(fb.date);
      d.setHours(0, 0, 0, 0);
      const key = fmt(d);
      if (key in receivedMap) receivedMap[key] += 1;
    });
  });
  const realMsgData = dayKeys.map((k) => ({
    day: k,
    sent: sentMap[k] || 0,
    received: receivedMap[k] || 0,
  }));
  // Demo data shows only when toggled on
  const showDemo = demoMode;
  // Deterministic demo growth (upward trend) - for message activity
  const demoMessageActivityData = (() => {
    let base = 0;
    return dayKeys.map((day, i) => {
      const inc = 3 + ((i * 3) % 8); // 3..10 messages per day
      base += inc;
      return { day, messages: base };
    });
  })();
  // Deterministic demo messages (sent vs received)
  const demoMsgData = dayKeys.map((day, i) => {
    const sent = 5 + ((i * 5) % 12); // 5..16
    const received = Math.max(0, sent - (2 + (i % 4)));
    return { day, sent, received };
  });
  const messageActivityData = showDemo
    ? demoMessageActivityData
    : realMessageActivityData;
  const msgData = showDemo ? demoMsgData : realMsgData;

  // Tab navigation removed - showing only Messages view (Requirement 2)

  // Small totals for headers
  const totalMessages30 =
    messageActivityData.length > 0
      ? messageActivityData[messageActivityData.length - 1].messages
      : 0;
  const totalSent30 = msgData.reduce((sum, d) => sum + (d.sent || 0), 0);
  const totalReceived30 = msgData.reduce(
    (sum, d) => sum + (d.received || 0),
    0
  );

  return (
    <div className="mb-6 sm:mb-8 lg:mb-10">
      <div className="gradient-border glow-on-hover premium-card bg-transparent shadow-lg p-4 sm:p-5 lg:p-6 transition-all duration-300 hover:shadow-xl rounded-2xl particle-bg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 flex items-center gap-2">
            Analytics
            {showDemo && (
              <span className="text-[10px] leading-4 font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200">
                Sample Data
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDemoMode((v) => !v)}
              aria-pressed={demoMode}
              title="Toggle demo charts"
              className={`text-[10px] leading-4 px-2 py-1 rounded-md border transition-colors ${
                demoMode
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              Demo
            </button>
          </div>
        </div>

        {/* Requirement 2: Show only Messages Sent vs Received chart */}
        <div className="gradient-border glow-on-hover bg-white shadow-md p-6 lg:p-8 transition-all duration-300 hover:shadow-lg rounded-2xl">
          <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-5">
            Messages Sent vs. Received (last 30 days)
          </h4>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={msgData}
              margin={{ left: -10, right: 10, top: 5, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={3} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="sent" fill="#6366f1" name="Sent" />
              <Bar dataKey="received" fill="#10b981" name="Received" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{
  status: CustomerStatus;
  onClick?: () => void;
}> = ({ status, onClick }) => {
  const baseClasses =
    "px-2.5 py-0.5 text-xs font-semibold rounded-full inline-flex items-center";
  const clickableClasses = onClick
    ? "cursor-pointer hover:opacity-80 transition-opacity"
    : "";

  // FIX: Explicitly type statusConfig to allow for optional icon and tooltip properties.
  const statusConfig: Record<
    CustomerStatus,
    {
      text: string;
      classes: string;
      icon?: React.ReactNode;
      tooltip?: string;
    }
  > = {
    [CustomerStatus.Pending]: {
      text: "Pending",
      classes: "bg-gray-100 text-gray-800",
    },
    [CustomerStatus.Sent]: {
      text: "Sent",
      classes: "bg-blue-100 text-blue-800",
      icon: <LinkIcon className="w-3 h-3 ml-1.5" />,
      tooltip: "Simulate Customer Click",
    },
    [CustomerStatus.Clicked]: {
      text: "Clicked",
      classes: "bg-indigo-100 text-indigo-800",
      icon: <LinkIcon className="w-3 h-3 ml-1.5" />,
      tooltip: "View Funnel as Customer",
    },
    [CustomerStatus.Reviewed]: {
      text: "Reviewed",
      classes: "bg-green-100 text-green-800",
      icon: <CheckCircleIcon className="w-3 h-3 ml-1.5" />,
    },
    [CustomerStatus.Failed]: {
      text: "Failed",
      classes: "bg-red-100 text-red-800",
      icon: <XCircleIcon className="w-3 h-3 ml-1.5" />,
    },
  };

  const config = statusConfig[status];

  return (
    <span
      title={config.tooltip}
      className={`${baseClasses} ${config.classes} ${clickableClasses}`}
      onClick={onClick}
    >
      {config.text}
      {onClick && config.icon}
    </span>
  );
};

// Removed unused RecentActivity component (was corrupted and unused)

interface CustomerTableProps {
  customers: Customer[];
  onSendMessage: (customerId: string) => void;
  onDeleteCustomer: (customerId: string) => void;
  onOpenFunnel: (customerId: string) => void;
  onOpenFeedback: (
    customerId: string,
    feedbackType: "positive" | "negative"
  ) => void;
  onAddFeedback?: (customerId: string, text: string) => void;
  onClearCustomers: () => void;
  businessName: string;
  feedbackPageLink: string;
  onUploadCustomers: () => void;
  onOpenAddCustomer: () => void;
}

const CustomerTable: React.FC<CustomerTableProps> = ({
  customers,
  onSendMessage,
  onDeleteCustomer,
  // onSendEmail,
  onOpenFunnel,
  onOpenFeedback,
  onAddFeedback,
  onClearCustomers,
  businessName,
  feedbackPageLink,
  onUploadCustomers,
  onOpenAddCustomer,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 3;
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredCustomers = customers.filter((customer) => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    const cleanedQueryPhone = searchQuery.replace(/\D/g, "");

    const nameMatch = customer.name.toLowerCase().includes(lowerCaseQuery);
    const phoneMatch =
      cleanedQueryPhone.length > 0 &&
      customer.phone.replace(/\D/g, "").includes(cleanedQueryPhone);

    return nameMatch || phoneMatch;
  });

  // Pagination logic
  const totalPages = Math.max(
    1,
    Math.ceil(filteredCustomers.length / pageSize)
  );
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset to page 1 when search changes or customer list changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, customers]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleToggleMenu = (customerId: string) => {
    setOpenMenuId((prevId) => (prevId === customerId ? null : customerId));
  };

  // Helper to build WhatsApp manual link and message
  function appendIdToLink(link: string, customerId?: string) {
    if (!link) return link;
    try {
      const url = new URL(link, window.location.origin);
      if (customerId) url.searchParams.set("id", customerId);
      return url.toString();
    } catch {
      let base = link;
      let hash = "";
      const hashIdx = base.indexOf("#");
      if (hashIdx >= 0) {
        hash = base.slice(hashIdx);
        base = base.slice(0, hashIdx);
      }
      const [path, query = ""] = base.split("?");
      const params = query
        .split("&")
        .filter((kv) => kv && !/^id=/i.test(kv))
        .join("&");
      const sep = params ? "&" : "";
      const qs = customerId
        ? `${params}${sep}id=${encodeURIComponent(customerId)}`
        : params;
      return qs ? `${path}?${qs}${hash}` : `${path}${hash}`;
    }
  }
  function ensureTenantKey(link: string) {
    if (!link) return link;
    try {
      const url = new URL(link, window.location.origin);
      if (!url.searchParams.get("tenantKey")) {
        // Prefer URL param if present, else default from location (demo on localhost)
        const tkFromUrl = new URLSearchParams(window.location.search).get(
          "tenantKey"
        );
        const host = window.location.hostname;
        const fallback =
          tkFromUrl ||
          (host === "localhost" || host === "127.0.0.1"
            ? "demo"
            : "business-saas");
        url.searchParams.set("tenantKey", fallback);
      }
      return url.toString();
    } catch {
      // Basic fallback for non-URL strings
      const hasQ = link.includes("?");
      const hasTk = /(?:^|[?&])tenantKey=/.test(link);
      if (hasTk) return link;
      const host = window.location.hostname;
      const tk =
        host === "localhost" || host === "127.0.0.1" ? "demo" : "business-saas";
      return `${link}${hasQ ? "&" : "?"}tenantKey=${encodeURIComponent(tk)}`;
    }
  }
  function buildWaMessage(opts: {
    customerName: string;
    businessName: string;
    reviewLink: string;
  }) {
    const { customerName, businessName, reviewLink } = opts;
    const template =
      "Hi [Customer Name], we'd love your feedback for [Business Name]. Link: [Review Link]";
    return template
      .replace(/\[Customer Name\]/g, customerName || "Customer")
      .replace(/\[Business Name\]/g, businessName)
      .replace(/\[Review Link\]/g, reviewLink);
  }

  // --- Empty state helpers: sample template download ---
  const getSampleRows = () => [
    ["Customer Name", "Phone Number"],
    ["John Doe", "+15551234567"],
    ["Jane Smith", "+919876543210"],
  ];
  const downloadSampleXlsx = () => {
    try {
      if (typeof (window as any).XLSX === "undefined") {
        // Fallback to CSV if SheetJS is not available
        downloadSampleCsv();
        return;
      }
      const rows = getSampleRows();
      const ws = (window as any).XLSX.utils.aoa_to_sheet(rows);
      const wb = (window as any).XLSX.utils.book_new();
      (window as any).XLSX.utils.book_append_sheet(wb, ws, "Customers");
      const wbout = (window as any).XLSX.write(wb, {
        bookType: "xlsx",
        type: "array",
      });
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "customer-template.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to generate XLSX, falling back to CSV", e);
      downloadSampleCsv();
    }
  };
  const downloadSampleCsv = () => {
    const rows = getSampleRows();
    const esc = (v: any) => {
      const s = String(v ?? "");
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = rows.map((r) => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customer-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="gradient-border glow-on-hover premium-card bg-white shadow-lg transition-all duration-300 hover:shadow-xl rounded-2xl relative">
      <div className="p-4 sm:p-5 lg:p-6">
        <div className="mb-4 sm:mb-6">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3">
            Customer List
            <span className="text-xs leading-4 font-bold text-gray-600 bg-gray-100 border border-gray-200 px-3 py-1 rounded-full">
              {customers.length} total
            </span>
          </h3>
          {/* Inline subscription lock overlay (reads from localStorage) */}
          <SubscriptionCustomerLock />
          <div className="flex flex-col gap-3">
            <div className="relative w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <SearchIcon className="h-5 w-5 text-gray-400" />
              </span>
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 sm:w-72 pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-gray-900 shadow-sm text-sm sm:text-base"
              />
              <button
                className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm sm:text-base whitespace-nowrap"
                onClick={onClearCustomers}
              >
                Clear
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {customers.length === 0 ? (
                <button
                  type="button"
                  onClick={downloadSampleXlsx}
                  className="w-full sm:w-auto px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 font-medium shadow-sm text-sm sm:text-base"
                >
                  <span className="hidden sm:inline">
                    Download sample (.xlsx)
                  </span>
                  <span className="sm:hidden">Download Sample</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onUploadCustomers}
                  className="w-full sm:w-auto px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 font-medium inline-flex items-center justify-center shadow-sm text-sm sm:text-base"
                  title="Upload to append customers (.xlsx/.xls/.csv)"
                >
                  <UploadIcon className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Append customers</span>
                  <span className="sm:hidden">Upload</span>
                </button>
              )}
              <button
                className="w-full sm:w-auto px-3 py-2 bg-gray-900 text-white rounded-xl font-medium inline-flex items-center justify-center hover:bg-gray-800 shadow-sm text-sm sm:text-base"
                onClick={onOpenAddCustomer}
                title="Add a single customer"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Add Customer</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>
        </div>
        {filteredCustomers.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-gray-50 flex items-center justify-center mb-4">
              <UploadIcon className="h-7 w-7 text-gray-900" />
            </div>
            <h4 className="text-xl font-semibold text-gray-900">
              No customer data
            </h4>
            <p className="mt-2 text-sm text-gray-600">
              Import customers using our template, then send SMS in one click.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onUploadCustomers}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-800 inline-flex items-center"
                title="Upload customers (.xlsx/.xls/.csv)"
              >
                <UploadIcon className="h-4 w-4 mr-2" />
                Upload now
              </button>
            </div>

            {/* Template preview – table format unchanged */}
            <div className="mt-8 max-w-md mx-auto bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-700">
                    <th className="px-4 py-2 text-left">Customer Name</th>
                    <th className="px-4 py-2 text-left">Phone Number</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-2">John Doe</td>
                    <td className="px-4 py-2">+15551234567</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-2">Jane Smith</td>
                    <td className="px-4 py-2">+919876543210</td>
                  </tr>
                </tbody>
              </table>
              <div className="px-4 py-2 text-xs text-gray-600 text-left bg-gray-50 border-t">
                Tips: Include country code (e.g., +1, +91). We also accept
                headers like
                <span className="mx-1 inline-block rounded bg-white border border-gray-200 px-1">
                  Name
                </span>
                /
                <span className="mx-1 inline-block rounded bg-white border border-gray-200 px-1">
                  Contact
                </span>
                /
                <span className="mx-1 inline-block rounded bg-white border border-gray-200 px-1">
                  Mobile
                </span>
                .
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="px-3 sm:px-6 py-3 font-medium">
                      Name
                    </th>
                    <th scope="col" className="px-3 sm:px-6 py-3 font-medium">
                      Phone
                    </th>
                    {/* Feedback column removed */}
                    <th
                      scope="col"
                      className="px-3 sm:px-6 py-3 text-right font-medium"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="bg-white border-b hover:bg-gray-50"
                    >
                      <td className="px-3 sm:px-6 py-3 font-medium text-gray-900 whitespace-nowrap text-sm sm:text-base">
                        {customer.name}
                      </td>
                      <td className="px-3 sm:px-6 py-3">
                        <div className="font-normal text-gray-700">
                          {customer.phone}
                        </div>
                      </td>
                      {/* Feedback cell removed */}
                      <td className="px-6 py-3 text-right relative">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => handleToggleMenu(customer.id)}
                            className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
                            aria-haspopup="true"
                            aria-expanded={openMenuId === customer.id}
                          >
                            <EllipsisVerticalIcon className="h-5 w-5" />
                          </button>
                        </div>
                        {openMenuId === customer.id && (
                          <div
                            ref={menuRef}
                            className="origin-top-right absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-white border border-gray-200 focus:outline-none z-10 flex flex-col py-2"
                            role="menu"
                            aria-orientation="vertical"
                            aria-labelledby="menu-button"
                          >
                            <button
                              onClick={() => {
                                onSendMessage(customer.id);
                                setOpenMenuId(null);
                              }}
                              disabled={customer.status === "Reviewed"}
                              className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition"
                              role="menuitem"
                            >
                              <PaperAirplaneIcon className="h-4 w-4 mr-3" />
                              {customer.status === "Pending"
                                ? "Send SMS"
                                : "Resend SMS"}
                            </button>
                            <button
                              onClick={() => {
                                // Manual WhatsApp open for this single customer
                                const phoneDigits = (
                                  customer.phone || ""
                                ).replace(/^\+/, "");
                                if (!/^\d{8,15}$/.test(phoneDigits)) {
                                  alert(
                                    "Invalid phone for WhatsApp. Use international format like +15551234567."
                                  );
                                  return;
                                }

                                // Requirement 4: Add clientId to feedback link
                                const clientCompanyId =
                                  localStorage.getItem("companyId") || "";
                                let review = appendIdToLink(
                                  ensureTenantKey(feedbackPageLink),
                                  customer.phone
                                );
                                // Append clientId if available
                                if (clientCompanyId) {
                                  try {
                                    const url = new URL(
                                      review,
                                      window.location.origin
                                    );
                                    url.searchParams.set(
                                      "clientId",
                                      clientCompanyId
                                    );
                                    review = url.toString();
                                  } catch {
                                    review =
                                      review +
                                      (review.includes("?") ? "&" : "?") +
                                      `clientId=${encodeURIComponent(
                                        clientCompanyId
                                      )}`;
                                  }
                                }

                                const text = encodeURIComponent(
                                  buildWaMessage({
                                    customerName: customer.name,
                                    businessName,
                                    reviewLink: review,
                                  })
                                );
                                const url = `https://wa.me/${phoneDigits}?text=${text}`;
                                window.open(url, "_blank", "noopener");
                                setOpenMenuId(null);
                              }}
                              className="mt-1 w-full text-left flex items-center px-4 py-2 text-sm text-green-700 hover:bg-green-50 rounded-lg transition"
                              role="menuitem"
                            >
                              {/* Reuse MessageIcon to indicate chat */}
                              <MessageIcon className="h-4 w-4 mr-3" />
                              WhatsApp (manual)
                            </button>
                            <div className="border-t my-2 border-gray-100"></div>
                            <button
                              onClick={() => {
                                onDeleteCustomer(customer.id);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
                              role="menuitem"
                            >
                              <TrashIcon className="h-4 w-4 mr-3" />
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center mt-4 gap-2">
                <button
                  className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-900 font-medium hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      className={`px-3 py-1 rounded-full font-medium ${
                        page === currentPage
                          ? "bg-gray-900 text-white"
                          : "bg-white border border-gray-200 text-gray-900 hover:bg-gray-50"
                      }`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  )
                )}
                <button
                  className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-900 font-medium hover:bg-gray-50 disabled:opacity-50"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

interface DashboardPageProps {
  customers: Customer[];
  activityLogs: ActivityLog[];
  plan: { name: string; messageLimit: number; renewalDate: Date };
  messagesSentThisMonth: number;
  onAddCustomer: (name: string, phone: string) => string | void;
  onSendMessage: (customerId: string) => void;
  onDeleteCustomer: (customerId: string) => void;
  onBulkAddCustomers: (
    customersData: Omit<Customer, "id" | "status" | "addedAt" | "rating">[]
  ) => { added: number; duplicates: number; invalid: number };
  onOpenFunnel: (customerId: string) => void;
  onOpenFeedback: (
    customerId: string,
    feedbackType: "positive" | "negative"
  ) => void;
  onAddFeedback?: (customerId: string, text: string) => void;
  onClearCustomers: () => void;
  businessName: string;
  feedbackPageLink: string;
  // New: queue SMS for multiple customers directly from dashboard
  onQueueSmsCustomers: (ids: string[]) => void;
  // New: whether Twilio credentials are configured; used to enable/disable send
  twilioConfigured: boolean;
  // New: template preview (optional)
  messageTemplate?: string;
  // New: callback to update business name
  onBusinessNameChange?: (newName: string) => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({
  customers,
  activityLogs,
  plan,
  messagesSentThisMonth,
  onAddCustomer,
  onSendMessage,
  onDeleteCustomer,
  onBulkAddCustomers,
  // onSendEmail,
  onOpenFunnel,
  onOpenFeedback,
  onAddFeedback,
  onClearCustomers,
  businessName,
  feedbackPageLink,
  onQueueSmsCustomers,
  twilioConfigured,
  messageTemplate,
  onBusinessNameChange,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalOpenForWhatsapp, setModalOpenForWhatsapp] = useState(false);
  const [sendMessagesSelectedCount, setSendMessagesSelectedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sendBanner, setSendBanner] = useState<string | null>(null);
  // Signal the SendMessagesCard to select all after an upload completes
  const [selectAllSignal, setSelectAllSignal] = useState(0);
  // Realtime stats for unified top card
  const {
    stats: dashStats,
    loading: dashLoading,
    error: dashError,
  } = useDashboardStats();
  const messageCount = dashStats?.messageCount ?? 0;
  const feedbackCount = dashStats?.feedbackCount ?? 0;

  // Negative comments state (fetched from Firebase)
  const [negativeComments, setNegativeComments] = useState<
    Array<{
      id: string;
      companyId: string;
      customerPhone: string;
      commentText: string;
      rating: number;
      createdAt: any;
    }>
  >([]);
  const [loadingComments, setLoadingComments] = useState(false);

  // Helper to build a short WhatsApp message for replies (in component scope)
  function buildWaMessageLocal(customerName: string) {
    // Support-style reply template for customer outreach
    const reviewLink = feedbackPageLink || window.location.href;
    const tmpl =
      "Hi [Customer Name], sorry for your bad experience. We'll sort the issue as soon as possible. Could you share a few more details here: [Review Link]";
    return tmpl
      .replace(/\[Customer Name\]/g, customerName || "Customer")
      .replace(/\[Review Link\]/g, reviewLink || "");
  }

  // Fetch negative comments from Firebase
  const fetchNegativeComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const companyId =
        localStorage.getItem("companyId") || localStorage.getItem("auth_uid");
      if (!companyId) {
        console.warn("[Dashboard] No companyId found for negative feedback");
        return;
      }

      console.log(
        "[Dashboard] 🔍 Fetching negative feedback for CURRENT LOGGED-IN CLIENT:",
        companyId
      );
      console.log(
        "[Dashboard] 📋 This client should ONLY see their own negative comments"
      );

      // Use API endpoint only - Firebase direct access removed for security
      const base = await getSmsServerUrl();
      const response = await fetch(
        `${base}/api/negative-comments?companyId=${companyId}`
      );
      const data = await response.json();

      console.log("[API] Response data:", data);

      if (data.success && data.comments && data.comments.length > 0) {
        // Verify all comments belong to this client (extra security check)
        const verifiedComments = data.comments.filter(
          (comment: any) => comment.companyId === companyId
        );

        if (verifiedComments.length !== data.comments.length) {
          console.error(
            `[Dashboard] ⚠️ SECURITY WARNING: Filtered out ${
              data.comments.length - verifiedComments.length
            } comments that don't belong to this client!`
          );
        }

        setNegativeComments(verifiedComments);
        console.log(
          `[Dashboard] ✅ Displaying ${verifiedComments.length} negative comments for client ${companyId}`
        );
      } else {
        console.log("[Dashboard] No negative comments found");
        setNegativeComments([]);
      }
    } catch (e: any) {
      console.error("[Firebase] Error fetching negative comments:", e);
      setNegativeComments([]);
    } finally {
      setLoadingComments(false);
    }
  }, []);

  // Delete negative comment from Firebase
  const [deletingIds, setDeletingIds] = useState<string[]>([]);

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    try {
      const companyId = localStorage.getItem("companyId");
      if (!companyId) {
        alert("No company ID found. Please log in again.");
        return;
      }

      console.log(
        `[delete-comment] Deleting comment ${commentId} for company ${companyId}`
      );

      const base = await getSmsServerUrl();

      setDeletingIds((s) => [...s, commentId]);
      const response = await fetch(
        `${base}/api/negative-comments?id=${encodeURIComponent(
          commentId
        )}&companyId=${encodeURIComponent(companyId)}`,
        { method: "DELETE" }
      );

      const data = await response.json().catch(() => ({}));
      console.log(`[delete-comment] Response:`, data);

      if (data.success) {
        // Refresh comments list
        await fetchNegativeComments();
        // Refresh stats to update negative_feedback_count
        window.dispatchEvent(new CustomEvent("dash:feedback:changed"));
      } else {
        alert(`❌ Failed to delete: ${data.error || "unknown error"}`);
      }
      setDeletingIds((s) => s.filter((id) => id !== commentId));
    } catch (e: any) {
      console.error("[delete-comment:error]", e);
      alert("❌ Failed to delete comment. Please try again.");
    }
  };

  // Clear all negative comments for this company (calls DELETE for each comment)
  async function handleClearAllComments() {
    if (
      !confirm(
        "Are you sure you want to CLEAR ALL negative comments? This cannot be undone."
      )
    )
      return;
    try {
      const companyId = localStorage.getItem("companyId");
      if (!companyId) {
        alert("No company ID found. Please log in again.");
        return;
      }

      const base = await getSmsServerUrl();

      // Copy the list to avoid mutation while iterating
      const toDelete = [...(negativeComments || [])];
      if (toDelete.length === 0) {
        alert("No negative comments to clear.");
        return;
      }

      // Delete sequentially to avoid hitting rate limits
      for (const c of toDelete) {
        try {
          const resp = await fetch(
            `${base}/api/negative-comments?id=${encodeURIComponent(
              c.id
            )}&companyId=${encodeURIComponent(companyId)}`,
            { method: "DELETE" }
          );
          const data = await resp.json().catch(() => ({}));
          console.log("[clear-all] deleted", c.id, data);
        } catch (err) {
          console.warn("[clear-all] failed to delete", c.id, err);
        }
      }

      alert("✅ Cleared all negative comments (attempted). Refreshing list...");
      fetchNegativeComments();
      window.dispatchEvent(new CustomEvent("dash:feedback:changed"));
    } catch (e: any) {
      console.error("[clear-all:error]", e);
      alert("Failed to clear negative comments. See console for details.");
    }
  }

  // Export visible negative comments as CSV and trigger download
  function handleExportComments() {
    // Deduplicate by fingerprint (phone + text + createdAt) to avoid
    // duplicate storage rows appearing in export even if they have
    // different ids.
    const mapByFingerprint: Record<string, any> = {};
    (negativeComments || []).forEach((c) => {
      if (!c) return;
      const phone = (c.customerPhone || "").replace(/\s+/g, "");
      const text = String(c.commentText || "").replace(/\r?\n/g, " ");

      // Safe date conversion with validation
      let createdAtIso: string;
      try {
        if (c.createdAt?.toDate) {
          const d = new Date(c.createdAt.toDate());
          createdAtIso = !isNaN(d.getTime())
            ? d.toISOString()
            : new Date().toISOString();
        } else if (c.createdAt) {
          const d = new Date(c.createdAt);
          createdAtIso = !isNaN(d.getTime())
            ? d.toISOString()
            : new Date().toISOString();
        } else {
          createdAtIso = new Date().toISOString();
        }
      } catch {
        createdAtIso = new Date().toISOString();
      }

      const key = `${phone}||${text}||${createdAtIso}`;
      // Keep the latest occurrence if multiple entries have same fingerprint
      const existing = mapByFingerprint[key];
      if (!existing) {
        mapByFingerprint[key] = {
          id: c.id || "",
          phone,
          rating: typeof c.rating === "number" ? c.rating : "",
          text,
          createdAt: createdAtIso,
        };
      } else {
        // If the incoming item has a newer createdAt, replace
        try {
          const curTs = Date.parse(existing.createdAt || "");
          const newTs = Date.parse(createdAtIso || "");
          if (newTs > curTs) {
            mapByFingerprint[key] = {
              id: c.id || existing.id,
              phone,
              rating: typeof c.rating === "number" ? c.rating : existing.rating,
              text,
              createdAt: createdAtIso,
            };
          }
        } catch {
          // ignore parse errors
        }
      }
    });

    const rows = Object.values(mapByFingerprint);
    if (rows.length === 0) {
      alert("No negative comments to export.");
      return;
    }

    const header = ["id", "phone", "rating", "text", "createdAt"];
    const csv = [
      header.join(","),
      ...rows.map((r) => {
        // Basic CSV escaping
        const esc = (v: any) => {
          if (v === null || v === undefined) return "";
          const s = String(v).replace(/"/g, '""');
          return `"${s}"`;
        };
        return [r.id, r.phone, r.rating, r.text, r.createdAt]
          .map(esc)
          .join(",");
      }),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const companyId = localStorage.getItem("companyId") || "all";
    const now = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `negative-comments-${companyId}-${now}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Load negative comments on mount and when feedback changes
  useEffect(() => {
    fetchNegativeComments();
  }, [fetchNegativeComments]);

  useEffect(() => {
    const onFeedbackChanged = () => {
      fetchNegativeComments();
    };
    window.addEventListener("dash:feedback:changed", onFeedbackChanged as any);
    return () => {
      window.removeEventListener(
        "dash:feedback:changed",
        onFeedbackChanged as any
      );
    };
  }, [fetchNegativeComments]);

  // Business name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(businessName);

  const handleSaveName = async () => {
    const trimmed = editedName.trim();
    if (!trimmed) {
      alert("Business name cannot be empty");
      return;
    }

    try {
      const companyId = localStorage.getItem("companyId");
      if (!companyId) {
        alert("No company ID found. Please log in again.");
        return;
      }

      const base = await getSmsServerUrl();
      const url = base
        ? `${base}/api/company/update-name`
        : `/api/company/update-name`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, businessName: trimmed }),
      });

      if (!response.ok) {
        throw new Error("Failed to update business name");
      }

      if (onBusinessNameChange) {
        onBusinessNameChange(trimmed);
      }

      setIsEditingName(false);
    } catch (error: any) {
      console.error("Error updating business name:", error);
      alert("Failed to update business name. Please try again.");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Safety: verify SheetJS is available
    if (typeof (window as any).XLSX === "undefined") {
      alert(
        "Spreadsheet parser library not loaded. Please check index.html includes xlsx.full.min.js."
      );
      return;
    }

    const isCsv = /\.csv$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("File read returned empty result");
        // Read workbook from ArrayBuffer for Excel, or string for CSV
        const workbook = isCsv
          ? XLSX.read(String(data), { type: "string" })
          : XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("No worksheet found in the file");
        const worksheet = workbook.Sheets[sheetName];
        // Read raw rows to locate header row robustly
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          blankrows: false,
          defval: "",
          raw: true,
        });
        if (!rows || rows.length === 0) throw new Error("Worksheet is empty");

        const norm = (s: any) =>
          String(s ?? "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");
        const nameSynonyms = ["customer name", "name", "full name", "customer"];
        const phoneSynonyms = [
          "phone number",
          "phone",
          "phone no",
          "contact",
          "mobile",
          "mobile number",
          "whatsapp",
        ];

        // Find a header row within the first 10 rows
        let headerRowIdx = -1;
        let nameCol = -1;
        let phoneCol = -1;
        const scanLimit = Math.min(rows.length, 10);
        for (let r = 0; r < scanLimit; r++) {
          const row = rows[r] || [];
          // Candidate header must have at least 2 cells
          if (!row || row.length < 1) continue;
          const headers = row.map(norm);
          nameCol = headers.findIndex((h) => nameSynonyms.includes(h));
          phoneCol = headers.findIndex((h) => phoneSynonyms.includes(h));
          if (nameCol >= 0 && phoneCol >= 0) {
            headerRowIdx = r;
            break;
          }
        }

        if (headerRowIdx === -1) {
          // Try sheet_to_json with auto header and look for keys
          const autoObjects: any[] = XLSX.utils.sheet_to_json(worksheet, {
            defval: "",
          });
          const sample = autoObjects[0] || {};
          const keys = Object.keys(sample);
          const keysList = keys.slice(0, 8).join(", ");
          throw new Error(
            `Could not find required headers (Customer Name, Phone Number). Found headers: ${
              keysList || "<none>"
            }`
          );
        }

        // Parse data rows starting after the header row
        const dataRows = rows.slice(headerRowIdx + 1);

        // Local helper replicating backend normalization logic.
        const normalizePhone = (raw: any): { ok: boolean; value?: string } => {
          if (!raw) return { ok: false };
          const cleaned = String(raw)
            .replace(/[^0-9+]/g, "")
            .trim();
          if (cleaned.startsWith("+")) {
            const digits = cleaned.slice(1);
            if (/^[0-9]{10,15}$/.test(digits))
              return { ok: true, value: cleaned };
            return { ok: false };
          }
          const digitsOnly = cleaned.replace(/^0+/, "");
          if (/^[6-9][0-9]{9}$/.test(digitsOnly)) {
            return { ok: true, value: "+91" + digitsOnly };
          }
          if (/^[0-9]{10,15}$/.test(digitsOnly)) {
            // Ambiguous country code – treat as invalid to force user to correct.
            return { ok: false };
          }
          return { ok: false };
        };

        let normalizationInvalid = 0;
        const customersData = dataRows.flatMap((row, idx) => {
          const name = String(row[nameCol] ?? "").trim();
          const rawPhone = row[phoneCol];
          const phoneNorm = normalizePhone(rawPhone);
          if (!name || !phoneNorm.ok) {
            if (name && rawPhone) normalizationInvalid++;
            return [];
          }
          return [{ name, phone: phoneNorm.value! }];
        });

        if (customersData.length > 0) {
          const result = onBulkAddCustomers(customersData);
          const totalInvalid = result.invalid + normalizationInvalid;
          
          console.log('Excel Upload Complete:', {
            added: result.added,
            duplicates: result.duplicates,
            invalid: totalInvalid,
            totalCustomersAfter: customers.length
          });
          
          alert(
            `✅ Upload complete!\n\nAdded: ${
              result.added
            } new customers.\nDuplicates Skipped: ${
              result.duplicates
            }\nInvalid Entries Skipped: ${totalInvalid}${
              normalizationInvalid
                ? ` (Phone format issues: ${normalizationInvalid})`
                : ""
            }\n\n📱 All customers have been automatically selected in Send Messages. You can now send SMS to everyone immediately!`
          );
          
          // After successful upload, auto-select all recipients in the Send Messages card
          console.log('Incrementing selectAllSignal to trigger auto-selection...');
          setSelectAllSignal((x) => {
            console.log(`selectAllSignal: ${x} -> ${x + 1}`);
            return x + 1;
          });
        } else {
          const headerPreview = rows[headerRowIdx]
            ?.map((c) => String(c))
            .slice(0, 8)
            .join(", ");
          alert(
            `Could not find any valid rows after header.\nExpected columns: Customer Name, Phone Number.\nDetected header: ${
              headerPreview || "<none>"
            }`
          );
        }
      } catch (error: any) {
        console.error("Error parsing spreadsheet:", error);
        alert(
          `There was an error parsing the file. ${
            error?.message ? "\n\n" + error.message : ""
          }\n\nEnsure the file is a valid .xlsx/.xls/.csv and includes headers like 'Customer Name' and 'Phone Number'.`
        );
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => {
      alert("Error reading file.");
    };
    if (isCsv) reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // Success banner for SMS sends
  useEffect(() => {
    const handler = (e: any) => {
      const to = e?.detail?.to || "recipient";
      setSendBanner(`Message sent successfully to ${to}`);
      setTimeout(() => setSendBanner(null), 3000);
    };
    window.addEventListener("dash:sms:success", handler as any);
    return () => window.removeEventListener("dash:sms:success", handler as any);
  }, []);

  // Simplified send messages card shown on the dashboard (replaces Plan Status)
  const SendMessagesCard: React.FC<{
    customers: Customer[];
    onQueue: (ids: string[]) => void;
    selectAllSignal: number;
    twilioConfigured: boolean;
  }> = ({ customers, onQueue, selectAllSignal, twilioConfigured }) => {
    // Exclude synthetic/public bucket
    const eligible = useMemo(
      () =>
        customers.filter(
          (c) => c.id !== "public-feedback" && c.phone && c.name
        ),
      [customers]
    );
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [successBanner, setSuccessBanner] = useState<string | null>(null);
    const [showSuccessAlert, setShowSuccessAlert] = useState(false);
    const [successAlertMessage, setSuccessAlertMessage] = useState("");
    const [prevEligibleLength, setPrevEligibleLength] = useState(0);

    // Show a local success banner inside this card when messages are sent successfully
    useEffect(() => {
      const onSuccess = (e: any) => {
        const to = e?.detail?.to;
        setSuccessBanner(
          to
            ? `Message sent successfully to ${to}`
            : "Message sent successfully"
        );
        const t = setTimeout(() => setSuccessBanner(null), 3000);
        return () => clearTimeout(t);
      };
      window.addEventListener("dash:sms:success", onSuccess as any);
      return () =>
        window.removeEventListener("dash:sms:success", onSuccess as any);
    }, []);

    // Auto-select all when eligible customers list grows (new customers added via upload or Add Customer)
    useEffect(() => {
      // If eligible list grew (new customers were added), auto-select all
      if (eligible.length > prevEligibleLength && eligible.length > 0) {
        console.log(
          `Customer list grew from ${prevEligibleLength} to ${eligible.length} - auto-selecting all`
        );
        const allIds = eligible.map((c) => c.id);
        setSelectedIds(allIds);
        setStatus(
          `Selected all ${eligible.length} customers. Review and click Send SMS.`
        );
      }
      // Update the previous length for next comparison
      setPrevEligibleLength(eligible.length);
    }, [eligible.length]);

    // ALSO keep the signal-based selection for backwards compatibility
    useEffect(() => {
      if (selectAllSignal > 0 && eligible.length > 0) {
        console.log(
          `Signal triggered (${selectAllSignal}) - auto-selecting all ${eligible.length} customers`
        );
        const allIds = eligible.map((c) => c.id);
        setSelectedIds(allIds);
        setStatus(
          `Selected all ${eligible.length} customers. Review and click Send SMS.`
        );
      }
    }, [selectAllSignal]);

    const filtered = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return eligible;
      return eligible.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
      );
    }, [eligible, search]);

    const toggle = (id: string) => {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    };

    // Notify parent about selection changes so the Add Customer button can
    // open the modal in WhatsApp mode when a single customer is selected.
    React.useEffect(() => {
      try {
        const ev = new CustomEvent("sendmessages:selection", {
          detail: { count: selectedIds.length },
        });
        window.dispatchEvent(ev as any);
      } catch (e) {
        // ignore
      }
    }, [selectedIds]);
    const selectAll = () => setSelectedIds(eligible.map((c) => c.id));
    const clearSel = () => setSelectedIds([]);
    // Local helpers for WhatsApp message (same as CustomerTable)
    function appendIdToLink(link: string, customerId?: string) {
      if (!link) return link;
      try {
        const url = new URL(link, window.location.origin);
        if (customerId) url.searchParams.set("id", customerId);
        return url.toString();
      } catch {
        let base = link;
        let hash = "";
        const hashIdx = base.indexOf("#");
        if (hashIdx >= 0) {
          hash = base.slice(hashIdx);
          base = base.slice(0, hashIdx);
        }
        const [path, query = ""] = base.split("?");
        const params = query
          .split("&")
          .filter((kv) => kv && !/^id=/i.test(kv))
          .join("&");
        const sep = params ? "&" : "";
        const qs = customerId
          ? `${params}${sep}id=${encodeURIComponent(customerId)}`
          : params;
        return qs ? `${path}?${qs}${hash}` : `${path}${hash}`;
      }
    }
    function ensureTenantKey(link: string) {
      if (!link) return link;
      try {
        const url = new URL(link, window.location.origin);
        if (!url.searchParams.get("tenantKey")) {
          const tkFromUrl = new URLSearchParams(window.location.search).get(
            "tenantKey"
          );
          const host = window.location.hostname;
          const fallback =
            tkFromUrl ||
            (host === "localhost" || host === "127.0.0.1"
              ? "demo"
              : "business-saas");
          url.searchParams.set("tenantKey", fallback);
        }
        return url.toString();
      } catch {
        const hasQ = link.includes("?");
        const hasTk = /(?:^|[?&])tenantKey=/.test(link);
        if (hasTk) return link;
        const host = window.location.hostname;
        const tk =
          host === "localhost" || host === "127.0.0.1"
            ? "demo"
            : "business-saas";
        return `${link}${hasQ ? "&" : "?"}tenantKey=${encodeURIComponent(tk)}`;
      }
    }
    function buildWaMessage(opts: {
      customerName: string;
      businessName: string;
      reviewLink: string;
    }) {
      const { customerName, businessName, reviewLink } = opts;
      const template =
        "Hi [Customer Name], we'd love your feedback for [Business Name]. Link: [Review Link]";
      return template
        .replace(/\[Customer Name\]/g, customerName || "Customer")
        .replace(/\[Business Name\]/g, businessName)
        .replace(/\[Review Link\]/g, reviewLink);
    }

    const send = () => {
      if (selectedIds.length === 0) {
        setStatus("Select at least one recipient.");
        return;
      }

      // Always use WhatsApp for single customer selection
      if (selectedIds.length === 1) {
        const customer = eligible.find((c) => c.id === selectedIds[0]);
        if (!customer) return;
        const phoneDigits = (customer.phone || "").replace(/^\+/, "");
        if (!/^\d{8,15}$/.test(phoneDigits)) {
          setStatus(
            "Invalid phone for WhatsApp. Use international format like +15551234567."
          );
          return;
        }

        // Requirement 4: Add clientId to feedback link for proper client isolation
        const clientCompanyId = localStorage.getItem("companyId") || "";
        let review = appendIdToLink(
          ensureTenantKey(feedbackPageLink),
          customer.phone
        );
        // Append clientId if available
        if (clientCompanyId) {
          try {
            const url = new URL(review, window.location.origin);
            url.searchParams.set("clientId", clientCompanyId);
            review = url.toString();
          } catch {
            review =
              review +
              (review.includes("?") ? "&" : "?") +
              `clientId=${encodeURIComponent(clientCompanyId)}`;
          }
        }

        const text = encodeURIComponent(
          buildWaMessage({
            customerName: customer.name,
            businessName,
            reviewLink: review,
          })
        );
        const url = `https://wa.me/${phoneDigits}?text=${text}`;

        // Open WhatsApp (no tracking needed - only negative feedback is stored)
        window.open(url, "_blank", "noopener");

        // Show JavaScript alert after SMS send (Requirement 1)
        alert(
          `✅ WhatsApp message sent successfully to ${customer.name}!\n\nThe feedback link has been shared. Any negative feedback will appear in your dashboard.`
        );
        setStatus("");

        // Clear selection
        clearSel();
        return;
      }

      // For multiple customers, use Twilio SMS if configured
      if (twilioConfigured) {
        onQueue(selectedIds);

        // Show JavaScript alert for bulk SMS (Requirement 1)
        alert(
          `✅ Success!\n\n${selectedIds.length} SMS messages have been queued and are being sent.\n\nAny negative feedback from customers will appear in your dashboard automatically.`
        );
        setStatus("");

        // Clear selection
        clearSel();
        return;
      }

      // Not configured and multiple selected → guide user to configure
      setStatus(
        "Twilio is not configured. Open Messenger to add SID, Token, and From number."
      );
    };

    return (
      <div className="bg-white shadow-lg p-4 sm:p-5 lg:p-6 border border-gray-200 h-full rounded-2xl">
        <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 shadow-md text-white">
            <PaperAirplaneIcon className="h-3.5 w-3.5 rotate-45" />
          </span>
          Send Messages
        </h3>
        <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">
          Uses your SMS template and Twilio settings from Messenger. You can
          edit them anytime.
        </p>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
          <div className="text-xs sm:text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
              {selectedIds.length}
            </span>
            <span className="text-gray-600">of {eligible.length} selected</span>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs px-3 py-1 rounded bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 font-medium"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={clearSel}
              className="text-xs px-3 py-1 rounded bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="mb-2">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <SearchIcon className="h-4 w-4 text-gray-400" />
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        </div>
        <div className="max-h-40 overflow-y-auto bg-gray-50 border border-gray-200 rounded-xl">
          {filtered.length === 0 ? (
            <div className="p-3 text-xs text-gray-500">No customers</div>
          ) : (
            <ul>
              {filtered.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between px-3 py-2 text-sm border-b last:border-b-0 hover:bg-gray-100 cursor-pointer"
                  onClick={() => toggle(c.id)}
                >
                  <div>
                    <div className="font-medium text-gray-800">{c.name}</div>
                    <div className="text-xs text-gray-500">{c.phone}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggle(c.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 text-primary-600 cursor-pointer"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
        {selectedIds.length === 1 && (
          <div className="mb-3 bg-green-50 border-2 border-green-300 rounded-lg p-3 flex items-start gap-3 animate-fadeIn">
            <svg
              className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-bold text-green-900 mb-1">
                🎉 Single customer selected - WhatsApp ready!
              </p>
              <p className="text-xs text-green-800">
                Click the green button below to open WhatsApp with a pre-filled
                message.
              </p>
            </div>
          </div>
        )}
        <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={send}
            disabled={
              selectedIds.length === 0 ||
              (selectedIds.length > 1 && !twilioConfigured)
            }
            className={`w-full sm:w-auto px-5 py-3 rounded-lg font-bold text-base sm:text-lg flex items-center justify-center gap-2 shadow-lg transition-all duration-200 ${
              selectedIds.length === 0 ||
              (selectedIds.length > 1 && !twilioConfigured)
                ? "bg-gray-400 cursor-not-allowed"
                : selectedIds.length === 1
                ? "bg-green-600 hover:bg-green-700 text-white hover:scale-105 animate-pulse"
                : "bg-gray-900 hover:bg-gray-800 text-white hover:scale-105"
            }`}
          >
            {selectedIds.length === 1 && (
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
            )}
            <span className="font-extrabold">
              {selectedIds.length === 1
                ? "📱 Send via WhatsApp"
                : selectedIds.length > 1
                ? `Send ${selectedIds.length} SMS`
                : "Send Message"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              const base = (import.meta as any).env?.BASE_URL || "/";
              const target = `${base}messenger`;
              if (window.location.pathname !== target) {
                window.history.pushState({ page: target }, "", target);
                window.dispatchEvent(new PopStateEvent("popstate"));
              }
            }}
            className="w-full sm:w-auto px-3 py-2 rounded-lg font-medium bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 text-sm sm:text-base"
          >
            Edit Messenger
          </button>
        </div>
        {successBanner && (
          <div className="mt-4 bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-400 text-emerald-900 px-5 py-4 rounded-xl text-base font-bold shadow-lg flex items-center gap-3 animate-fadeIn">
            <div className="flex-shrink-0 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-emerald-900 font-extrabold text-lg">
                ✅ Success!
              </p>
              <p className="text-emerald-800 text-sm">{successBanner}</p>
            </div>
          </div>
        )}
        {status && (
          <div className="mt-3 bg-blue-50 border-2 border-blue-300 text-blue-900 px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-2">
            <svg
              className="h-5 w-5 text-blue-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <span>{status}</span>
          </div>
        )}
        {!twilioConfigured && selectedIds.length > 1 && (
          <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded p-2">
            Twilio is not configured. Add Account SID, Auth Token, and Phone in
            Messenger to enable sending.
          </p>
        )}
      </div>
    );
  };

  // Listen for selection events from SendMessagesCard
  React.useEffect(() => {
    const handler = (e: any) => {
      const cnt = Number(e?.detail?.count || 0);
      setSendMessagesSelectedCount(cnt);
    };
    window.addEventListener("sendmessages:selection", handler as any);
    return () =>
      window.removeEventListener("sendmessages:selection", handler as any);
  }, []);

  function openAddCustomer(forWhatsapp: boolean) {
    setModalOpenForWhatsapp(Boolean(forWhatsapp));
    setIsModalOpen(true);
  }

  return (
    <DebugBoundary>
      <div className="min-h-screen grid-pattern relative overflow-hidden ">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-10">
          {sendBanner && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-lg text-sm">
              {sendBanner}
            </div>
          )}
          {/* Hidden file input for uploading customers; triggered from Customer List section */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />
          <div className="mb-6 sm:mb-8 lg:mb-10">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.8fr] gap-4 sm:gap-5 lg:gap-6">
              {/* Left bar: Title & description */}
              <div className="gradient-border premium-card bg-white shadow-lg p-5 sm:p-6 transition-all duration-300 rounded-2xl edge-left-rounded hover:shadow-xl">
                <div className="space-y-2 flex flex-col justify-center h-full">
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 shadow-lg ring-2 ring-indigo-400/50 text-white pulse-scale"
                      style={{
                        boxShadow:
                          "0 0 20px rgba(99, 102, 241, 0.4), 0 4px 6px -1px rgba(99, 102, 241, 0.3)",
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-5 w-5"
                      >
                        <path d="M12 3l9 4.5v9L12 21 3 16.5v-9L12 3z" />
                      </svg>
                    </span>
                    {isEditingName ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="text-2xl font-bold text-gray-900 border-b-2 border-primary-500 focus:outline-none bg-transparent"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveName();
                            if (e.key === "Escape") {
                              setIsEditingName(false);
                              setEditedName(businessName);
                            }
                          }}
                        />
                        <button
                          onClick={handleSaveName}
                          className="text-sm bg-primary-600 text-white px-3 py-1 rounded-lg hover:bg-primary-700"
                          title="Save"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => {
                            setIsEditingName(false);
                            setEditedName(businessName);
                          }}
                          className="text-sm bg-gray-300 text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-400"
                          title="Cancel"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span className="flex items-center gap-2">
                        {businessName || "Acme Inc."}
                        <button
                          onClick={() => {
                            setIsEditingName(true);
                            setEditedName(businessName);
                          }}
                          className="text-primary-600 hover:text-primary-700 transition-colors"
                          title="Change business name"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                      </span>
                    )}
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                    Your reputation dashboard — track messages, feedback, and
                    growth in real time.
                  </p>
                </div>
              </div>

              {/* Right bar: Unified card with stats in 2x2 grid */}
              <div className="gradient-border premium-card bg-white shadow-lg p-5 sm:p-6 transition-all duration-300 rounded-2xl edge-right-rounded hover:shadow-xl">
                {dashLoading ? (
                  <div className="h-48 animate-pulse bg-gray-50 rounded-xl" />
                ) : dashError ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
                    <p className="text-sm font-semibold">
                      Failed to load stats
                    </p>
                    <p className="text-xs">{dashError}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:gap-5">
                    {/* 1. Messages Sent Card - Top Left */}
                    <div className="flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl p-4 sm:p-5 text-center hover:shadow-lg hover:scale-105 transition-all duration-200">
                      <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                        Messages Sent
                      </div>
                      <div className="text-4xl sm:text-5xl font-extrabold text-blue-600 mb-2">
                        {messageCount}
                      </div>
                      <div className="bg-blue-100 p-2 rounded-lg inline-flex">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-blue-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* 2. Feedback Received Card - Top Right */}
                    <div className="flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-green-100/50 border border-green-200 rounded-xl p-4 sm:p-5 text-center hover:shadow-lg hover:scale-105 transition-all duration-200">
                      <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                        Feedback Received
                      </div>
                      <div className="text-4xl sm:text-5xl font-extrabold text-green-600 mb-2">
                        {feedbackCount}
                      </div>
                      <div className="bg-green-100 p-2 rounded-lg inline-flex">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-green-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* 3. Negative Comments Card - Bottom Left */}
                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          // Prefer scrolling to the full negative comments section
                          const el = document.getElementById(
                            "negative-comments-list"
                          );
                          if (el) {
                            el.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                            return;
                          }
                          // Fallback to global opener if available
                          if (
                            typeof (window as any).openFeedbackFromDashboard ===
                            "function"
                          ) {
                            (window as any).openFeedbackFromDashboard(
                              "negative"
                            );
                          }
                        }}
                        className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 rounded-xl font-bold hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl hover:scale-105 text-base sm:text-lg w-full"
                      >
                        <XCircleIcon className="h-5 w-5" />
                        <span className="flex items-center gap-2">
                          Negative Comments
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold bg-red-800/30 text-white border border-red-400/30">
                            {negativeComments?.length || 0}
                          </span>
                        </span>
                      </button>
                    </div>

                    {/* 4. View Feedback Button - Bottom Right */}
                    <div className="flex items-center justify-center">
                      <a
                        href={`${
                          (import.meta as any).env?.BASE_URL || "/"
                        }feedback`}
                        onClick={(e) => {
                          e.preventDefault();
                          const base =
                            (import.meta as any).env?.BASE_URL || "/";
                          const target = `${base}feedback`;
                          if (window.location.pathname !== target) {
                            window.history.pushState(
                              { page: target },
                              "",
                              target
                            );
                            window.dispatchEvent(new PopStateEvent("popstate"));
                          }
                        }}
                        className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-gray-900 to-gray-800 text-white px-6 py-4 rounded-xl font-bold hover:from-gray-800 hover:to-gray-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 text-base sm:text-lg w-full"
                      >
                        <StarIcon className="h-5 w-5" />
                        <span>Feedback Page</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Analytics Section: Real-time stats are now summarized in the unified card above */}

          {/* Charts Grid: Analytics (fills full width) */}
          <div className="w-full flex flex-row gap-4 sm:gap-6 mt-6">
            <div className="flex-1 min-w-0">
              <AnalyticsSection
                customers={customers}
                activityLogs={activityLogs}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
            <div className="lg:col-span-3 float-delay-2">
              {(() => {
                let storedDemo = false;
                try {
                  storedDemo = localStorage.getItem("dash:demoMode") === "1";
                } catch {}
                const funnelShowDemo =
                  storedDemo ||
                  (customers.length === 0 && activityLogs.length === 0);
                return (
                  <FunnelAnalytics
                    customers={customers}
                    demoMode={funnelShowDemo}
                  />
                );
              })()}
            </div>

            {/* Negative Comments Section - Full Width */}
            <div className="lg:col-span-3 float-delay-3">
              <div id="negative-comments-list">
                <NegativeFeedbackSection
                  comments={negativeComments}
                  loading={loadingComments}
                  onDelete={handleDeleteComment}
                  onExport={handleExportComments}
                  onClearAll={handleClearAllComments}
                  businessName={businessName}
                  feedbackPageLink={feedbackPageLink}
                  deletingIds={deletingIds}
                />
              </div>
            </div>

            <div className="lg:col-span-2 float-delay-3">
              <CustomerTable
                customers={customers.filter((c) => {
                  if (c.id === "public-feedback") return false;
                  // Hide known sample/dummy data used in initial seeds
                  const dummyNames = new Set(["John Doe", "Jane Smith"]);
                  const dummyPhones = new Set(["+1234567890", "+1987654321"]);
                  if (dummyNames.has(c.name)) return false;
                  if (dummyPhones.has(c.phone)) return false;
                  return true;
                })}
                onSendMessage={onSendMessage}
                onDeleteCustomer={onDeleteCustomer}
                onOpenFunnel={onOpenFunnel}
                onOpenFeedback={onOpenFeedback}
                onClearCustomers={onClearCustomers}
                businessName={businessName}
                feedbackPageLink={feedbackPageLink}
                onUploadCustomers={triggerFileUpload}
                onOpenAddCustomer={() => openAddCustomer(true)}
              />
            </div>
            <div className="flex flex-col gap-8">
              <SendMessagesCard
                customers={customers}
                onQueue={onQueueSmsCustomers}
                selectAllSignal={selectAllSignal}
                twilioConfigured={twilioConfigured}
              />
            </div>
          </div>

          {isModalOpen && (
            <AddCustomerModal
              onClose={() => setIsModalOpen(false)}
              onAddCustomer={onAddCustomer}
              openWhatsappOnSubmit={modalOpenForWhatsapp}
              businessName={businessName}
              feedbackPageLink={feedbackPageLink}
            />
          )}
        </div>
      </div>
    </DebugBoundary>
  );
};

export default DashboardPage;
