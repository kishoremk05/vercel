import React, { useState, useMemo, useEffect, useRef } from "react";
import { Page, Customer, ActivityLog, CustomerStatus } from "./types";
import TopNav from "./components/TopNav";
import DashboardPage from "./pages/DashboardPage";
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";
import FunnelPage from "./pages/FunnelPage";
import FeedbackPage from "./pages/FeedbackPage";
import QuickFeedbackPage from "./pages/QuickFeedbackPage";
import ProfilePage from "./pages/ProfilePage";
import AuthPage from "./pages/AuthPage";
import SignupPage from "./pages/SignupPage";
import AdminPage from "./pages/AdminPage";
import AdminAuthPage from "./pages/AdminAuthPage";
import CredentialsPage from "./pages/CredentialsPage";
import PaymentPage from "./pages/PaymentPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import PaymentCancelPage from "./pages/PaymentCancelPage";
import { initializeGlobalConfig, getSmsServerUrl } from "./lib/firebaseConfig";
import { initializeFirebase, getFirebaseAuth } from "./lib/firebaseClient";
import { getClientProfile } from "./lib/firestoreClient";
// import { EnvelopeIcon } from "./components/icons";

// Determine API base at runtime.
// Priority: Firebase global config -> explicit Vite env -> same-origin relative (if backend served together) -> local dev server (if reachable) -> fallback hosted server.
let API_BASE: string = "";
// We'll initialize API_BASE from Firebase config at startup; this variable may
// be empty initially in dev, but components call getSmsServerUrl() when needed.
// As a safety, set a reasonable fallback immediately.
if ((import.meta as any).env?.DEV) {
  API_BASE = ""; // use same-origin + proxy during Vite dev
} else if (
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1"
) {
  API_BASE = "http://localhost:3002";
} else {
  API_BASE =
    (import.meta as any).env?.VITE_API_BASE ||
    "https://server-cibp.onrender.com";
}

// Respect Vite base path
const BASE_URL: string = (import.meta as any).env?.BASE_URL || "/";
const joinBase = (slug: string) => {
  const b = BASE_URL.endsWith("/") ? BASE_URL : BASE_URL + "/";
  const s = slug.startsWith("/") ? slug.slice(1) : slug;
  return b + s;
};
const stripBase = (p: string) => {
  const b = (BASE_URL || "/").toLowerCase();
  const lower = (p || "/").toLowerCase();
  if (b !== "/" && lower.startsWith(b)) {
    const rest = p.slice(BASE_URL.length);
    return "/" + rest.replace(/^\/+/, "");
  }
  return p || "/";
};

// Multi-tenant key
const queryTenantKey = (() => {
  try {
    return new URLSearchParams(window.location.search).get("tenantKey");
  } catch {
    return null;
  }
})();
const TENANT_KEY =
  queryTenantKey ||
  (location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "demo"
    : "business-saas");

// Initial customers array used as a safe default
const initialCustomers: Customer[] = [];

// Plan price mapping used by checkout
const PLAN_PRICES: Record<string, number> = {
  starter_1m: 30,
  growth_3m: 75,
  pro_6m: 100,
  monthly: 30,
  quarterly: 75,
  halfyearly: 100,
};

const App: React.FC = () => {
  // Lightweight auth listener: restore minimal session info and dispatch
  // `auth:ready` so other parts of the app can react. This is a compact
  // replacement for the original, more complex listener and keeps the
  // app compiling while preserving essential behavior.
  useEffect(() => {
    let unsub: any = null;
    (async () => {
      try {
        const authModule: any = await import("./lib/firebaseAuth");
        unsub = authModule.onAuthChange(async (user: any) => {
          if (user) {
            try {
              // Attempt to restore the clientId if available
              const clientId = await authModule.getUserClientId?.(user);
              if (clientId) {
                try {
                  localStorage.setItem("companyId", clientId);
                  localStorage.setItem("clientId", clientId);
                  localStorage.setItem("auth_uid", user.uid || "");
                  localStorage.setItem("userEmail", user.email || "");
                } catch {}
              }
            } catch (e) {
              console.warn("[App] getUserClientId error:", e);
            }
            setAuth({ role: "buyer" });
            window.dispatchEvent(new Event("auth:ready"));
          } else {
            setAuth(null);
          }
        });
      } catch (e) {
        console.error("[App] Failed to setup auth listener:", e);
      }
    })();

    return () => {
      try {
        if (unsub) unsub();
      } catch {}
    };
  }, []);

  // Auth state: use localStorage for demo/local logins only.
  const [auth, setAuth] = useState<{ role: "buyer" | "admin" } | null>(() => {
    // Initialize auth from localStorage to prevent logout on reload
    try {
      const companyId = localStorage.getItem("companyId");
      const userEmail = localStorage.getItem("userEmail");
      const adminSession = localStorage.getItem("adminSession");

      if (adminSession === "true") {
        return { role: "admin" };
      } else if (companyId && userEmail) {
        // User is logged in as client
        return { role: "buyer" };
      }
    } catch {}
    return null;
  });
  // Subscription and payment flow removed (payment feature disabled)

  // Listen for in-app navigation requests (e.g., Customer List 'Choose a Plan' button)
  useEffect(() => {
    // Payment page has been removed; keep listener registration as no-op for
    // backward compatibility (older UI might still emit the event).
    const noop = () => {
      // intentionally empty
    };
    window.addEventListener("app:navigate:payment", noop as EventListener);
    return () =>
      window.removeEventListener("app:navigate:payment", noop as EventListener);
  }, []);
  const handleLogout = async () => {
    console.log("[App] Logging out...");

    // CRITICAL: Sign out from Firebase first to clear auth state
    try {
      const authModule = await import("./lib/firebaseAuth");
      await authModule.logout();
      console.log("[App] ✅ Firebase logout successful");
    } catch (error) {
      console.error("[App] ❌ Firebase logout error:", error);
    }

    // Clear all auth state
    setAuth(null);

    // Clear ALL localStorage items
    try {
      const keysToRemove = [
        "adminSession",
        "companyId",
        "clientId",
        "auth_uid",
        "userEmail",
        "token",
        "adminToken",
        "businessName",
        "businessEmail",
        "feedbackPageLink",
        "googleReviewLink",
        "customers",
        "messageTemplate",
        "tenantKey",
        "smsServerUrl",
        "firebaseUser", // Clear Firebase user cache
        "pendingPlan", // Clear pending plan
      ];
      keysToRemove.forEach((key) => localStorage.removeItem(key));
      console.log("[App] ✅ Cleared localStorage");
    } catch (error) {
      console.error("[App] ❌ Error clearing localStorage:", error);
    }

    // Navigate to Auth page
    const target = joinBase("auth");
    console.log("[App] Navigating to:", target);

    // Update URL
    if (window.location.pathname !== target) {
      window.history.pushState({ page: target }, "", target);
    }

    // Set page to Auth
    setCurrentPage(Page.Auth);

    console.log("[App] ✅ Logout complete - redirecting to auth page");
  };

  // Start Dodo checkout immediately for a selected plan
  const startCheckout = async (planId: string) => {
    try {
      // Ensure we have a session
      const companyId = localStorage.getItem("companyId");
      const userEmail = localStorage.getItem("userEmail") || "";
      if (!companyId) {
        // Not logged in, send to auth and keep pendingPlan
        try {
          localStorage.setItem("pendingPlan", planId);
        } catch {}
        const target = joinBase("auth");
        if (window.location.pathname !== target) {
          window.history.pushState({ page: target }, "", target);
        }
        setCurrentPage(Page.Auth);
        return;
      }

      // Build API URL
      const base = (await getSmsServerUrl().catch(() => API_BASE)) || API_BASE;
      const url = base
        ? `${String(base)
            .trim()
            .replace(/\/+$/, "")}/api/payments/create-session`
        : `/api/payments/create-session`;

      const price = PLAN_PRICES[planId] || 0;
      console.log("[Checkout] Creating session", {
        planId,
        price,
        companyId,
        userEmail,
      });
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-company-id": companyId || "",
          "x-user-email": userEmail || "",
          "x-plan-id": planId || "",
          "x-price": String(price || ""),
        },
        body: JSON.stringify({ plan: planId, price, companyId, userEmail }),
      });
      const data = await resp.json().catch(() => ({} as any));
      if (!resp.ok || !data?.url) {
        console.error("[Checkout] Failed: ", data);
        alert(
          data?.error ||
            "Failed to start checkout. Please try again or contact support."
        );
        return;
      }

      // Redirect to Dodo hosted checkout
      window.location.href = data.url;
    } catch (e: any) {
      console.error("[Checkout] Exception:", e);
      alert(e?.message || "Payment initialization failed");
    }
  };

  // Payment flow removed — no-op placeholder for any old callers.
  function handlePaymentSuccess() {
    // intentionally left blank
  }
  // Add all your state and logic here
  // Handler to clear all customers and purge negative feedback on the server
  const handleClearCustomers = async () => {
    setCustomers([]);
    localStorage.removeItem("customers");
    // Reset activity logs so 'Messages Sent' count goes to 0 immediately
    setActivityLogs([]);
    // Also clear negative feedback from the backend store so it doesn't re-sync
    try {
      const buildUrl = (sentiment: "negative" | "positive") => {
        const companyId = localStorage.getItem("companyId");
        const params = new URLSearchParams({
          sentiment,
        });
        // Prefer companyId (v2), fallback to tenantKey (legacy)
        if (companyId) {
          params.set("companyId", companyId);
        } else {
          params.set("tenantKey", TENANT_KEY);
        }
        return API_BASE
          ? `${API_BASE}/feedback?${params.toString()}`
          : `/api/feedback?${params.toString()}`;
      };
      await Promise.all([
        fetch(buildUrl("negative"), { method: "DELETE" }).catch(() => {}),
        fetch(buildUrl("positive"), { method: "DELETE" }).catch(() => {}),
      ]);
    } catch {}
    // Reset the remote sync pointer to avoid bringing back stale entries
    lastRemoteSync.current = null;
  };
  // Handler to clear only negative feedback (requested on Negative Reviews page)
  const handleClearNegativeFeedback = async () => {
    // Remove negative feedback from local state for all customers (including public bucket)
    setCustomers((prev) =>
      prev.map((c) => ({
        ...c,
        feedback: (c.feedback || []).filter((f) => f.sentiment !== "negative"),
      }))
    );
    // Optionally also clear related logs (so Overview reflects fresh state)
    setActivityLogs((prev) => prev.filter((l) => !/negative/i.test(l.action)));
    try {
      const buildUrl = (sentiment: "negative" | "positive") => {
        const companyId = localStorage.getItem("companyId");
        const params = new URLSearchParams({
          sentiment,
        });
        // Prefer companyId (v2), fallback to tenantKey (legacy)
        if (companyId) {
          params.set("companyId", companyId);
        } else {
          params.set("tenantKey", TENANT_KEY);
        }
        return API_BASE
          ? `${API_BASE}/feedback?${params.toString()}`
          : `/api/feedback?${params.toString()}`;
      };
      await fetch(buildUrl("negative"), { method: "DELETE" });
    } catch {}
    // Reset remote sync pointer so removed items don't come back
    lastRemoteSync.current = null;
  };
  const pathRaw = stripBase(window.location.pathname).toLowerCase();
  // Determine initial page from the path. Auth checks happen during render.
  const initialPage: Page =
    pathRaw === "/admin"
      ? Page.Admin
      : pathRaw === "/admin-login"
      ? Page.AdminLogin
      : pathRaw === "/auth" || pathRaw === "/login"
      ? Page.Auth
      : pathRaw === "/signup"
      ? Page.Signup
      : pathRaw === "/payment"
      ? Page.Payment
      : pathRaw === "/payment-success"
      ? Page.PaymentSuccess
      : pathRaw === "/payment-cancel"
      ? Page.PaymentCancel
      : pathRaw === "/messenger" || pathRaw === "/settings"
      ? Page.Settings
      : pathRaw === "/feedback" || pathRaw === "/feeback"
      ? Page.Feedback
      : pathRaw === "/quick-feedback" || pathRaw === "/feeback"
      ? Page.QuickFeedback
      : pathRaw === "/profile"
      ? Page.Profile
      : pathRaw === "/credentials"
      ? Page.Credentials
      : pathRaw === "/" || pathRaw === ""
      ? Page.Home
      : Page.Dashboard;
  const [currentPage, setCurrentPage] = useState<Page>(initialPage);
  // Load customers from localStorage if available to preserve state across hard reloads
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const isSampleCustomer = (c: Customer) => {
      const byId = c.id === "cust-1" || c.id === "cust-2";
      const byKnownPair =
        (c.name === "John Doe" && c.phone === "+1234567890") ||
        (c.name === "Jane Smith" && c.phone === "+1987654321");
      return byId || byKnownPair;
    };
    const stripSamples = (arr: Customer[]) =>
      arr.filter((c) => !isSampleCustomer(c));
    try {
      const stored = localStorage.getItem("customers");
      if (stored) {
        const parsed: any[] = JSON.parse(stored);
        // Rehydrate date objects & fallback if structure changed
        const hydrated = parsed.map((c) => ({
          ...c,
          addedAt: c.addedAt ? new Date(c.addedAt) : new Date(),
          feedback: (c.feedback || []).map((f: any) => ({
            ...f,
            date: f.date ? new Date(f.date) : new Date(),
          })),
        })) as Customer[];
        // One-time migration: remove any known sample customers
        return stripSamples(hydrated);
      }
    } catch (e) {
      console.warn("Failed to parse customers from storage", e);
    }
    // Default to empty list
    return stripSamples(initialCustomers);
  });
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const lastRemoteSync = useRef<Date | null>(null);
  const [selectedFeedbackCustomer, setSelectedFeedbackCustomer] =
    useState<Customer | null>(null);
  const [selectedFeedbackType, setSelectedFeedbackType] = useState<
    "positive" | "negative" | null
  >(null);

  // One-time cleanup: collapse near-duplicate feedback (same phone+text within 10 minutes)
  useEffect(() => {
    setCustomers((prev) => {
      const normalizeDigits = (s?: string) => (s ? s.replace(/\D/g, "") : "");
      const windowMs = 10 * 60 * 1000;
      let changed = false;
      const next = prev.map((c) => {
        const list = (c.feedback || [])
          .slice()
          .sort((a, b) => +new Date(a.date as any) - +new Date(b.date as any));
        const keep: typeof list = [];
        const seen = new Map<string, number[]>();
        for (const f of list) {
          const key = `${normalizeDigits((f as any).phone || c.phone)}|${String(
            f.text || ""
          )
            .trim()
            .toLowerCase()}`;
          const t = +new Date(f.date as any);
          const times = seen.get(key) || [];
          if (times.some((tt) => Math.abs(tt - t) <= windowMs)) {
            changed = true; // drop as duplicate
            continue;
          }
          times.push(t);
          seen.set(key, times);
          keep.push(f);
        }
        if (keep.length !== list.length) changed = true;
        return { ...c, feedback: keep };
      });
      return changed ? next : prev;
    });
    // run only once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Settings state used by SettingsPage
  const [messageTemplate, setMessageTemplate] = useState<string>(
    () =>
      localStorage.getItem("messageTemplate") ||
      "Hey [Customer Name], we'd love to hear your feedback about [Business Name]. Please leave a review at [Review Link]."
  );
  // Email subject/content removed per requirement
  const [businessName, setBusinessName] = useState<string>(
    () => localStorage.getItem("businessName") || "Acme Inc."
  );
  // Feedback page link used in outbound messages (we append ?id=<phone>)
  const [feedbackPageLink, setFeedbackPageLink] = useState<string>(
    () => localStorage.getItem("feedbackPageLink") || ""
  );
  // Email for sidebar/profile - show logged-in user's email
  const [businessEmail, setBusinessEmail] = useState<string>(
    () => localStorage.getItem("userEmail") || "owner@email.com"
  );

  // Sync email from localStorage when it changes (e.g., after login)
  useEffect(() => {
    const syncEmail = () => {
      const userEmail = localStorage.getItem("userEmail");
      if (userEmail && userEmail !== businessEmail) {
        setBusinessEmail(userEmail);
      }
    };

    // Sync on mount
    syncEmail();

    // Listen for custom event after login
    window.addEventListener("auth:ready", syncEmail);

    // Cleanup
    return () => window.removeEventListener("auth:ready", syncEmail);
  }, [businessEmail]);

  // Load business name and links from Firebase after login
  useEffect(() => {
    const loadBusinessProfile = async () => {
      try {
        const companyId = localStorage.getItem("companyId");
        if (!companyId) return;

        // Fetch from dashboard stats API which now includes profile data
        const base = await getSmsServerUrl().catch(() => API_BASE);
        const url = base
          ? `${base}/api/dashboard/stats?companyId=${companyId}`
          : `${API_BASE}/api/dashboard/stats?companyId=${companyId}`;
        const response = await fetch(url);
        if (!response.ok) return;

        const data = await response.json();
        if (data.success && data.profile) {
          // Update business name if present
          if (data.profile.businessName) {
            try {
              const updatedAt = Number(
                localStorage.getItem("businessNameUpdatedAt") || "0"
              );
              const now = Date.now();
              // If user recently updated the businessName locally (within 5s),
              // don't overwrite it with the server value which may be stale or
              // reflect the previously saved name. This prevents an immediate
              // revert when user edits their name in the Profile page.
              if (!updatedAt || now - updatedAt > 5000) {
                setBusinessName(data.profile.businessName);
                localStorage.setItem("businessName", data.profile.businessName);
              } else {
                console.log(
                  "[App] Skipping server businessName because local edit is recent"
                );
              }
            } catch (e) {
              setBusinessName(data.profile.businessName);
              localStorage.setItem("businessName", data.profile.businessName);
            }
          }
          // Update feedback page link if present
          if (data.profile.feedbackPageLink) {
            setFeedbackPageLink(data.profile.feedbackPageLink);
            localStorage.setItem(
              "feedbackPageLink",
              data.profile.feedbackPageLink
            );
          }
          // Update Google review link if present
          if (data.profile.googleReviewLink) {
            setGoogleReviewLink(data.profile.googleReviewLink);
            localStorage.setItem(
              "googleReviewLink",
              data.profile.googleReviewLink
            );
          }
          console.log(
            "✅ Loaded business profile from Firebase:",
            data.profile
          );
        }
      } catch (error) {
        console.error("Failed to load business profile:", error);
      }
    };

    // Load on mount if companyId exists
    loadBusinessProfile();

    // Also load after auth:ready event
    window.addEventListener("auth:ready", loadBusinessProfile);

    // Cleanup
    return () => window.removeEventListener("auth:ready", loadBusinessProfile);
  }, []);

  // Google review link for positive 4–5 star redirect on Feedback page
  const [googleReviewLink, setGoogleReviewLink] = useState<string>(
    () => localStorage.getItem("googleReviewLink") || ""
  );

  // Rating threshold configuration: "5" = only 5 stars is positive (1-4 negative), "3" = 3-5 stars positive (1-2 negative)
  const [ratingThreshold, setRatingThreshold] = useState<"5" | "3">(
    () => (localStorage.getItem("ratingThreshold") as "5" | "3") || "5"
  );
  const [twilioAccountSid, setTwilioAccountSid] = useState<string>("");
  const [twilioAuthToken, setTwilioAuthToken] = useState<string>("");
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState<string>("");
  const [twilioMessagingServiceSid, setTwilioMessagingServiceSid] =
    useState<string>("");

  // Auto-load Twilio credentials from backend (admin global credentials)
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    const loadCreds = async () => {
      try {
        console.log(
          "[App] Loading Twilio credentials... (attempt",
          retryCount + 1,
          "/",
          maxRetries,
          ")"
        );

        // Fetch admin global credentials (no auth needed - public endpoint)
        // Use VITE_API_BASE when available so the built frontend calls the deployed API server
        // If VITE_API_BASE wasn't set at build time (common cause of 404s from Vercel static host),
        // fall back at runtime to the Render server so the frontend can reach the API.
        const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";
        const adminUrl = API_BASE
          ? API_BASE.replace(/\/+$/, "") + "/api/admin/global-credentials"
          : location.hostname === "localhost" ||
            location.hostname === "127.0.0.1"
          ? "/api/admin/global-credentials"
          : "https://server-cibp.onrender.com/api/admin/global-credentials";
        const adminResp = await fetch(adminUrl);

        if (adminResp.ok) {
          const adminData = await adminResp.json().catch(() => ({} as any));
          const adminCreds = adminData?.credentials || {};

          console.log("[App] Admin credentials response:", {
            success: adminData.success,
            hasAccountSid: !!adminCreds.accountSid,
            hasAuthToken: !!adminCreds.authToken,
            hasPhoneNumber: !!adminCreds.phoneNumber,
            accountSid: adminCreds.accountSid
              ? adminCreds.accountSid.substring(0, 10) + "..."
              : "MISSING",
            phoneNumber: adminCreds.phoneNumber || "MISSING",
          });

          // Set admin credentials
          if (adminCreds.accountSid) {
            setTwilioAccountSid(adminCreds.accountSid);
            console.log(
              "[App] ✅ Set twilioAccountSid:",
              adminCreds.accountSid.substring(0, 8) + "..."
            );
          } else {
            console.error("[App] ❌ Missing accountSid in response!");
          }

          if (adminCreds.authToken) {
            setTwilioAuthToken(adminCreds.authToken);
            console.log(
              "[App] ✅ Set twilioAuthToken:",
              adminCreds.authToken.substring(0, 8) + "..."
            );
          } else {
            console.error("[App] ❌ Missing authToken in response!");
          }

          if (adminCreds.phoneNumber) {
            setTwilioPhoneNumber(adminCreds.phoneNumber);
            console.log(
              "[App] ✅ Set twilioPhoneNumber:",
              adminCreds.phoneNumber
            );
          } else {
            console.error("[App] ❌ Missing phoneNumber in response!");
          }

          if (adminCreds.messagingServiceSid) {
            setTwilioMessagingServiceSid(adminCreds.messagingServiceSid);
            console.log("[App] ✅ Set messagingServiceSid");
          }

          if (
            adminCreds.accountSid &&
            adminCreds.authToken &&
            adminCreds.phoneNumber
          ) {
            console.log(
              "[App] ✅✅✅ Successfully loaded ALL admin global Twilio credentials!"
            );
          } else {
            console.error(
              "[App] ⚠️ Incomplete credentials loaded. Check admin settings in Firestore."
            );

            // Retry if incomplete and haven't exceeded max retries
            if (retryCount < maxRetries) {
              retryCount++;
              console.log("[App] Retrying in", retryDelay, "ms...");
              setTimeout(loadCreds, retryDelay);
            }
          }
        } else {
          console.error(
            "[App] ❌ Failed to load admin global credentials - Status:",
            adminResp.status
          );

          // Retry on failure
          if (retryCount < maxRetries) {
            retryCount++;
            console.log("[App] Retrying in", retryDelay, "ms...");
            setTimeout(loadCreds, retryDelay);
          }
        }
      } catch (e) {
        console.error("[App] ❌ Error loading credentials:", e);

        // Retry on error
        if (retryCount < maxRetries) {
          retryCount++;
          console.log("[App] Retrying in", retryDelay, "ms...");
          setTimeout(loadCreds, retryDelay);
        }
      }
    };

    // Load credentials IMMEDIATELY on mount, don't wait for auth
    loadCreds();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps = run once on mount

  // --- SMS sending helpers ---
  const appendIdToLink = (link: string, customerId: string) => {
    if (!link) return link;
    try {
      const url = new URL(link, window.location.origin);
      if (customerId) url.searchParams.set("id", customerId);
      return url.toString();
    } catch {
      // Fallback for non-URL strings: replace existing id= if present, then append
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
  };

  // Build message text with correct feedback link and clientId tagging
  const formatTemplate = (
    template: string,
    name: string,
    phone: string,
    customerId?: string
  ) => {
    const defaultFeedbackPath = joinBase("feedback");
    const defaultFeedbackUrl = new URL(
      defaultFeedbackPath,
      window.location.origin
    ).toString();
    let reviewBase = (feedbackPageLink || "").trim() || defaultFeedbackUrl;
    // If someone mistakenly set the site root as link, auto-correct to /feedback
    try {
      const u = new URL(reviewBase, window.location.origin);
      const rootPath = new URL(BASE_URL || "/", window.location.origin)
        .pathname;
      if (
        u.pathname === rootPath ||
        u.pathname === rootPath.replace(/\/$/, "")
      ) {
        u.pathname = new URL(
          defaultFeedbackPath,
          window.location.origin
        ).pathname;
        reviewBase = u.toString();
      }
    } catch {}

    // Add customer ID to the link
    let reviewWithId = appendIdToLink(reviewBase, phone || "");

    // Add clientId parameter for proper Firebase storage
    const clientCompanyId = localStorage.getItem("companyId") || "";
    if (clientCompanyId) {
      try {
        const url = new URL(reviewWithId, window.location.origin);
        url.searchParams.set("clientId", clientCompanyId);
        reviewWithId = url.toString();
      } catch {
        // Fallback: append clientId manually
        reviewWithId =
          reviewWithId +
          (reviewWithId.includes("?") ? "&" : "?") +
          `clientId=${encodeURIComponent(clientCompanyId)}`;
      }
    }

    return (template || "")
      .replace(/\[Customer Name\]/g, name)
      .replace(/\[Business Name\]/g, businessName)
      .replace(/\[Review Link\]/g, reviewWithId)
      .replace(/\[Phone\]/g, phone)
      .replace(/\{\{\s*name\s*\}\}/gi, name)
      .replace(/\{\{\s*business\s*\}\}/gi, businessName)
      .replace(/\{\{\s*review(_link)?\s*\}\}/gi, reviewWithId)
      .replace(/\{\{\s*phone\s*\}\}/gi, phone);
  };

  const sendSmsToCustomer = async (customer: Customer) => {
    if (!customer.phone) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customer.id ? { ...c, status: CustomerStatus.Failed } : c
        )
      );
      logActivity("SMS failed (missing phone)", customer.name);
      return { ok: false, reason: "Missing phone" };
    }
    // Local subscription credit guard (UI) - server still authoritative
    // NOTE: some flows write the subscription to Firestore (ProfilePage)
    // and the client may not have the up-to-date `localStorage.subscription`.
    // Do not block sends purely on a stale localStorage value — prefer the
    // server-side check below which queries `/api/subscription`.
    // Helper: check Firestore profile (company or auth-owned) for subscription
    async function checkFirestoreSubscription(companyId?: string) {
      try {
        initializeFirebase();
        let profile: any = null;
        if (companyId) {
          profile = await getClientProfile(companyId).catch(() => null);
        }
        if (!profile) {
          const auth = getFirebaseAuth();
          const waitForAuth = (timeoutMs = 5000) =>
            new Promise<any>((resolve) => {
              if (auth.currentUser) return resolve(auth.currentUser);
              const unsub = auth.onAuthStateChanged((u: any) => {
                if (u) {
                  try {
                    unsub();
                  } catch {}
                  return resolve(u);
                }
              });
              setTimeout(() => resolve(auth.currentUser || null), timeoutMs);
            });
          const user = await waitForAuth().catch(() => null);
          if (user && user.uid) {
            profile = await getClientProfile(user.uid).catch(() => null);
          }
        }
        if (!profile) return { found: false };
        const hasPlan = Boolean(
          profile.planId || profile.plan || profile.planName
        );
        const remainingRaw =
          profile.remainingCredits ??
          profile.smsCredits ??
          profile.remaining ??
          null;
        const remaining =
          remainingRaw === null ? null : Number(remainingRaw || 0);
        if (hasPlan) {
          if (remaining === null)
            return { found: true, allowed: true, remaining: null, profile };
          return { found: true, allowed: remaining > 0, remaining, profile };
        }
        return { found: true, allowed: false, remaining, profile };
      } catch (e) {
        console.warn("[checkFirestoreSubscription] error:", e);
        return { found: false };
      }
    }

    // Firestore-first subscription check (do not gate on localStorage)
    const companyId = localStorage.getItem("companyId") || undefined;
    let skipSubscriptionApiCheck = false;
    try {
      const fs = await checkFirestoreSubscription(companyId);
      if (fs && fs.found) {
        if (fs.allowed) {
          // Firestore indicates the client has a plan with credits — allow send
          skipSubscriptionApiCheck = true;
          console.log("[SMS] Allowed by Firestore profile", fs);
        } else {
          // Firestore explicitly indicates no credits or no plan — block send
          alert(
            "SMS limit reached! You have 0 SMS credits remaining. Please upgrade your plan or wait for renewal."
          );
          setCustomers((prev) =>
            prev.map((c) =>
              c.id === customer.id ? { ...c, status: CustomerStatus.Failed } : c
            )
          );
          return { ok: false, reason: "SMS limit reached" };
        }
      }
    } catch (e) {
      console.warn("[SMS] Firestore check failed, will fallback to API:", e);
    }
    const body = formatTemplate(
      messageTemplate,
      customer.name,
      customer.phone,
      customer.id
    );
    try {
      // Check SMS credits before sending (API check only if Firestore didn't allow)
      if (!skipSubscriptionApiCheck) {
        try {
          const base = await getSmsServerUrl().catch(() => API_BASE);
          const subUrl = `${base}/api/subscription?companyId=${companyId}`;
          const subRes = await fetch(subUrl);
          const subData = await subRes.json();

          if (subData.success && subData.subscription) {
            const remaining =
              subData.subscription.remainingCredits ??
              subData.subscription.smsCredits ??
              0;
            const status = subData.subscription.status;

            if (status !== "active") {
              alert(
                "Your subscription is not active. Please activate your plan to send SMS."
              );
              setCustomers((prev) =>
                prev.map((c) =>
                  c.id === customer.id
                    ? { ...c, status: CustomerStatus.Failed }
                    : c
                )
              );
              return { ok: false, reason: "Subscription not active" };
            }

            if (remaining <= 0) {
              alert(
                "SMS limit reached! You have 0 SMS credits remaining. Please upgrade your plan or wait for renewal."
              );
              setCustomers((prev) =>
                prev.map((c) =>
                  c.id === customer.id
                    ? { ...c, status: CustomerStatus.Failed }
                    : c
                )
              );
              return { ok: false, reason: "SMS limit reached" };
            }

            console.log(`[SMS] Credits available: ${remaining}`);
          }
        } catch (subErr) {
          console.warn(
            "[SMS] Could not check subscription via API, proceeding anyway:",
            subErr
          );
        }
      }

      const base = await getSmsServerUrl().catch(() => API_BASE);
      const sendUrl = base
        ? `${String(base).trim().replace(/\/+$/, "")}/send-sms`
        : `/send-sms`;
      const res = await fetch(sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Prefer server-side credentials via companyId; include local creds if present as fallback
          ...(twilioAccountSid && twilioAuthToken
            ? { accountSid: twilioAccountSid, authToken: twilioAuthToken }
            : {}),
          ...(twilioMessagingServiceSid
            ? { messagingServiceSid: twilioMessagingServiceSid }
            : twilioPhoneNumber
            ? { from: twilioPhoneNumber }
            : {}),
          ...(companyId ? { companyId } : {}),
          to: customer.phone,
          body,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === customer.id ? { ...c, status: CustomerStatus.Sent } : c
          )
        );
        logActivity("Sent SMS", customer.name);
        try {
          // surface a brief dashboard success banner
          (window as any).dispatchEvent(
            new CustomEvent("dash:sms:success", {
              detail: { id: customer.id, to: customer.phone },
            })
          );
        } catch {}
        // Trigger subscription refresh
        window.dispatchEvent(new Event("subscription:updated"));
        return { ok: true };
      } else {
        // Check if error is due to SMS limit
        if (
          res.status === 403 ||
          (data.error && data.error.includes("SMS limit"))
        ) {
          alert(
            `SMS limit reached: ${data.error}\n\nRemaining credits: ${
              data.remainingCredits || 0
            }`
          );
        }

        setCustomers((prev) =>
          prev.map((c) =>
            c.id === customer.id ? { ...c, status: CustomerStatus.Failed } : c
          )
        );
        logActivity(`SMS failed (${data.code || "error"})`, customer.name);
        return { ok: false, reason: data.error };
      }
    } catch (e: any) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customer.id ? { ...c, status: CustomerStatus.Failed } : c
        )
      );
      logActivity("SMS network error", customer.name);
      return { ok: false, reason: e?.message || "network" };
    }
  };

  // Simple queue to process SMS in batches of 10
  const [smsQueue, setSmsQueue] = useState<string[]>([]);
  const [queueActive, setQueueActive] = useState(false);

  const enqueueSmsCustomers = (ids: string[]) => {
    setSmsQueue((prev) => [...prev, ...ids]);
  };

  useEffect(() => {
    if (queueActive) return;
    if (smsQueue.length === 0) return;
    let cancelled = false;
    const run = async () => {
      setQueueActive(true);
      try {
        while (!cancelled && smsQueue.length > 0) {
          // Take up to 10
          const chunk = smsQueue.slice(0, 10);
          setSmsQueue((prev) => prev.slice(chunk.length));
          for (const id of chunk) {
            const cust = customers.find((c) => c.id === id);
            if (!cust) continue;
            // Allow resend for all except Reviewed (final state)
            if (cust.status === CustomerStatus.Reviewed) continue;
            await sendSmsToCustomer(cust);
            // Small pause to avoid hitting limits too fast
            await new Promise((r) => setTimeout(r, 150));
          }
          // Yield between chunks
          await new Promise((r) => setTimeout(r, 500));
        }
      } finally {
        setQueueActive(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    smsQueue,
    queueActive,
    customers,
    twilioAccountSid,
    twilioAuthToken,
    twilioPhoneNumber,
    messageTemplate,
    businessName,
    googleReviewLink,
    feedbackPageLink,
  ]);

  // Persist customers whenever they change (debounced by microtask naturally)
  useEffect(() => {
    try {
      localStorage.setItem(
        "customers",
        JSON.stringify(
          customers.map((c) => ({
            ...c,
            // Ensure Dates serialized with validation
            addedAt:
              c.addedAt instanceof Date && !isNaN(c.addedAt.getTime())
                ? c.addedAt.toISOString()
                : c.addedAt,
            feedback: (c.feedback || []).map((f) => ({
              ...f,
              date:
                f.date instanceof Date && !isNaN(f.date.getTime())
                  ? f.date.toISOString()
                  : f.date,
            })),
          }))
        )
      );
    } catch (e) {
      console.warn("Failed to persist customers", e);
    }
  }, [customers]);

  // Persist settings so public Feedback page has the links on reload/direct open
  useEffect(() => {
    try {
      localStorage.setItem("messageTemplate", messageTemplate);
    } catch {}
  }, [messageTemplate]);
  useEffect(() => {
    try {
      localStorage.setItem("businessName", businessName);
    } catch {}
  }, [businessName]);
  useEffect(() => {
    try {
      localStorage.setItem("feedbackPageLink", feedbackPageLink);
    } catch {}
  }, [feedbackPageLink]);
  useEffect(() => {
    try {
      localStorage.setItem("googleReviewLink", googleReviewLink);
    } catch {}
  }, [googleReviewLink]);

  // Simple activity log helper
  const logActivity = (action: string, customerName: string) => {
    const newLog: ActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      customerName,
      action,
      timestamp: new Date(),
    };
    setActivityLogs((prev) => [newLog, ...prev]);
  };

  // Exposed helpers for SettingsPage direct send path
  const markCustomerSent = (customerId: string, context?: string) => {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customerId ? { ...c, status: CustomerStatus.Sent } : c
      )
    );
    const cust = customers.find((c) => c.id === customerId);
    if (cust)
      logActivity(`Sent SMS${context ? ` (${context})` : ""}`, cust.name);
  };
  const markCustomerFailed = (customerId: string, reason?: string) => {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customerId ? { ...c, status: CustomerStatus.Failed } : c
      )
    );
    const cust = customers.find((c) => c.id === customerId);
    if (cust)
      logActivity(
        `SMS failed${
          reason
            ? ` (${reason.slice(0, 40)}` + (reason.length > 40 ? "…" : "") + ")"
            : ""
        }`,
        cust.name
      );
  };

  // Minimal plan info used by PlanStatus
  const plan = useMemo(
    () => ({
      name: "Growth Plan",
      messageLimit: 500,
      renewalDate: new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        15
      ),
    }),
    []
  );

  const messagesSentThisMonth = useMemo(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return activityLogs.filter(
      (log) =>
        (log.action.toLowerCase().includes("sent review request") ||
          log.action.toLowerCase().includes("sent sms") ||
          log.action.toLowerCase().includes("resend sms")) &&
        log.timestamp >= firstDay
    ).length;
  }, [activityLogs]);

  // Handlers expected by DashboardPage
  const handleAddCustomer = (name: string, phone: string) => {
    const newCustomer: Customer = {
      id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      phone,
      status: CustomerStatus.Pending,
      addedAt: new Date(),
    };
    setCustomers((prev) => [newCustomer, ...prev]);
    logActivity("Added to customer list", newCustomer.name);
    // Don't auto-send SMS when adding via modal - WhatsApp is handled by modal itself
    // return void so modal doesn't show error
  };

  const handleSendMessage = (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return;
    // Queue a real send
    enqueueSmsCustomers([customerId]);
  };

  const handleDeleteCustomer = (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return;
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
    logActivity("Deleted customer", cust.name);
  };

  const handleBulkAddCustomers = (
    customersData: Omit<Customer, "id" | "status" | "addedAt" | "rating">[]
  ) => {
    const addedCustomers: Customer[] = customersData.map((d) => ({
      id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: d.name,
      phone: d.phone,
      status: CustomerStatus.Pending,
      addedAt: new Date(),
    }));
    setCustomers((prev) => [...addedCustomers, ...prev]);
    addedCustomers.forEach((c) => logActivity("Bulk uploaded", c.name));
    return { added: addedCustomers.length, duplicates: 0, invalid: 0 };
  };
  // Email send simulation removed

  const handleOpenFunnel = (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return;
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customerId ? { ...c, status: CustomerStatus.Clicked } : c
      )
    );
    logActivity("Clicked review link (simulation)", cust.name);
  };

  // Example navigation handler for feedback
  const handleOpenFeedback = (
    customerId: string,
    feedbackType: "positive" | "negative"
  ) => {
    const customer = customers.find((c) => c.id === customerId) || null;
    setSelectedFeedbackCustomer(customer);
    setSelectedFeedbackType(feedbackType);
    setCurrentPage(Page.Feedback);
  };

  // Placeholder for funnel complete handler
  const handleFunnelComplete = () => {
    setSelectedFeedbackCustomer(null);
    setCurrentPage(Page.Dashboard);
  };

  // Placeholder for funnel close handler
  const handleCloseFunnel = () => {
    setSelectedFeedbackCustomer(null);
    setCurrentPage(Page.Dashboard);
  };

  // Placeholder for feedback back handler
  const handleBackFromFeedback = () => {
    setSelectedFeedbackCustomer(null);
    setSelectedFeedbackType(null);
    setCurrentPage(Page.Dashboard);
  };

  // Allow dashboard summary cards to open feedback without a specific customer
  React.useEffect(() => {
    (window as any).openFeedbackFromDashboard = (
      type: "positive" | "negative"
    ) => {
      setSelectedFeedbackCustomer(null);
      setSelectedFeedbackType(type);
      setCurrentPage(Page.Feedback);
    };
    return () => {
      try {
        delete (window as any).openFeedbackFromDashboard;
      } catch (e) {
        (window as any).openFeedbackFromDashboard = undefined;
      }
    };
  }, []);

  // Add a feedback entry (persisted to customers state). If no matching customer, bucket under a synthetic "Public Feedback" contact.
  const addFeedback = (
    customerId: string,
    text: string,
    sentiment: "positive" | "negative",
    phone?: string,
    rating?: number,
    idOverride?: string
  ) => {
    const newEntry = {
      id:
        idOverride ||
        `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: (text || "").trim(),
      sentiment,
      date: new Date(),
      phone,
      rating: typeof rating === "number" ? rating : undefined,
    } as const;

    setCustomers((prev) => {
      // Helper to append to a specific index
      const appendAt = (arr: typeof prev, index: number) =>
        arr.map((c, i) =>
          i === index
            ? { ...c, feedback: [...(c.feedback || []), newEntry] }
            : c
        );

      // 1) Try by explicit customerId
      let idx = prev.findIndex((c) => c.id === customerId);
      if (idx >= 0) {
        return appendAt(prev, idx);
      }

      // 2) Try by phone (normalized)
      if (phone) {
        const norm = (s: string) => s.replace(/\D/g, "");
        idx = prev.findIndex((c) => norm(c.phone) === norm(phone));
        if (idx >= 0) return appendAt(prev, idx);
      }

      // 3) Fallback bucket: create or reuse synthetic customer
      const bucketId = "public-feedback";
      const existingBucketIdx = prev.findIndex((c) => c.id === bucketId);
      if (existingBucketIdx >= 0) {
        return appendAt(prev, existingBucketIdx);
      }
      // Create new synthetic bucket at the top
      const bucket = {
        id: bucketId,
        name: "Public Feedback",
        phone: "N/A",
        status: CustomerStatus.Reviewed,
        addedAt: new Date(),
        feedback: [newEntry],
      } as Customer;
      return [bucket, ...prev];
    });
  };

  // Merge remote feedback entries fetched from server into local customers state
  const normalizeDigits = (s?: string) => (s ? s.replace(/\D/g, "") : "");
  const mergeRemoteFeedback = (
    entries: Array<{
      id: string;
      text: string;
      sentiment: "positive" | "negative";
      date: string;
      phone?: string;
      rating?: number;
    }>
  ) => {
    if (!entries || entries.length === 0) return;
    setCustomers((prev) => {
      // Build a quick index of existing feedback ids to avoid duplicates
      const existingIds = new Set<string>();
      // Build a similarity index by phone+text to avoid near-duplicate clones from local+server
      const similarIndex = new Map<string, number[]>(); // key -> timestamps (ms)
      for (const c of prev) {
        for (const f of c.feedback || []) {
          existingIds.add(f.id);
          const k = `${normalizeDigits((f as any).phone || c.phone)}|${String(
            f.text || ""
          )
            .trim()
            .toLowerCase()}`;
          const t = +new Date(f.date as any);
          if (!similarIndex.has(k)) similarIndex.set(k, []);
          similarIndex.get(k)!.push(t);
        }
      }
      let updated = prev.slice();
      for (const e of entries) {
        if (existingIds.has(e.id)) continue;
        // Skip if an equivalent feedback exists within a 10-minute window
        const simKey = `${normalizeDigits(e.phone || "")}|${String(e.text || "")
          .trim()
          .toLowerCase()}`;
        const eTime = +new Date(e.date);
        const windowMs = 10 * 60 * 1000; // 10 minutes
        const times = similarIndex.get(simKey) || [];
        if (times.some((t) => Math.abs(t - eTime) <= windowMs)) {
          continue;
        }
        const newEntry = {
          id: e.id,
          text: e.text,
          sentiment: e.sentiment,
          date: new Date(e.date),
          phone: e.phone,
          rating: typeof e.rating === "number" ? e.rating : undefined,
        } as const;
        // Track in similarity index to avoid further duplicates in this batch
        if (!similarIndex.has(simKey)) similarIndex.set(simKey, []);
        similarIndex.get(simKey)!.push(eTime);
        // Try to attach by phone first
        const idxByPhone = e.phone
          ? updated.findIndex(
              (c) => normalizeDigits(c.phone) === normalizeDigits(e.phone)
            )
          : -1;
        if (idxByPhone >= 0) {
          const c = updated[idxByPhone];
          updated = updated.map((cc, i) =>
            i === idxByPhone
              ? { ...c, feedback: [...(c.feedback || []), newEntry] }
              : cc
          );
          continue;
        }
        // Else append into public-feedback bucket
        const bucketId = "public-feedback";
        const bucketIdx = updated.findIndex((c) => c.id === bucketId);
        if (bucketIdx >= 0) {
          const c = updated[bucketIdx];
          updated = updated.map((cc, i) =>
            i === bucketIdx
              ? { ...c, feedback: [...(c.feedback || []), newEntry] }
              : cc
          );
        } else {
          updated = [
            {
              id: bucketId,
              name: "Public Feedback",
              phone: "N/A",
              status: CustomerStatus.Reviewed,
              addedAt: new Date(),
              feedback: [newEntry],
            } as Customer,
            ...updated,
          ];
        }
      }
      return updated;
    });
  };

  // Periodically sync remote feedback (both negative and positive) into dashboard
  useEffect(() => {
    let timer: any;
    const fetchRemote = async () => {
      try {
        // Use companyId for v2 API (preferred) or fallback to tenantKey for legacy
        const companyId = localStorage.getItem("companyId");
        const sentiments: Array<"negative" | "positive"> = [
          "negative",
          "positive",
        ];
        const since = lastRemoteSync.current
          ? lastRemoteSync.current.toISOString()
          : undefined;
        for (const s of sentiments) {
          const params = new URLSearchParams({
            sentiment: s,
          });
          // Prefer companyId (v2 schema), fallback to tenantKey (legacy)
          if (companyId) {
            params.set("companyId", companyId);
          } else {
            params.set("tenantKey", TENANT_KEY);
          }
          if (since) params.set("since", since);
          const res = await fetch(
            API_BASE
              ? `${API_BASE}/feedback?${params.toString()}`
              : `/api/feedback?${params.toString()}`
          );
          const data = await res.json().catch(() => ({}));
          if (data?.success && Array.isArray(data.entries)) {
            mergeRemoteFeedback(data.entries);
          }
        }
      } catch {
      } finally {
        lastRemoteSync.current = new Date();
      }
    };
    // initial fetch soon after load
    fetchRemote();
    // poll every 60s
    timer = setInterval(fetchRemote, 60000);
    return () => clearInterval(timer);
  }, []);

  // Exposed handler for dashboard rows: accept free-text feedback and auto-classify sentiment
  const onAddFeedback = (customerId: string, text: string) => {
    if (!text || !text.trim()) return;
    const lower = text.toLowerCase();
    // Very simple heuristic: words that usually indicate positive
    const positiveWords = [
      "good",
      "great",
      "excellent",
      "love",
      "loved",
      "amazing",
      "nice",
      "fast",
      "friendly",
      "recommended",
      "recommend",
    ];
    const negativeWords = [
      "bad",
      "poor",
      "late",
      "slow",
      "rude",
      "problem",
      "issue",
      "not",
      "disappointed",
      "hate",
    ];

    let sentiment: "positive" | "negative" = "negative";
    if (positiveWords.some((w) => lower.includes(w))) sentiment = "positive";
    else if (negativeWords.some((w) => lower.includes(w)))
      sentiment = "negative";
    else sentiment = lower.length > 60 ? "positive" : "negative"; // fallback heuristic

    addFeedback(customerId, text.trim(), sentiment, undefined, undefined);
  };

  // If a link is opened with ?id=... (public link), automatically open the Feedback page
  useEffect(() => {
    try {
      const id = new URLSearchParams(window.location.search).get("id");
      if (id && currentPage !== Page.Feedback) {
        navigate(Page.Feedback);
      }
    } catch {}
    // run on mount and when currentPage changes once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Client-side navigation & history management ---
  const mapPathToPage = (path: string): Page => {
    const p = stripBase(path).toLowerCase();
    if (p === "/admin") return Page.Admin;
    if (p === "/admin-login") return Page.AdminLogin;
    if (p === "/auth" || p === "/login") return Page.Auth;
    if (p === "/signup") return Page.Signup;
    if (p === "/" || p === "") return Page.Home;
    if (p === "/dashboard") return Page.Dashboard;
    if (p === "/messenger" || p === "/settings") return Page.Settings;
    if (p === "/feedback" || p === "/feeback") return Page.Feedback;
    if (p === "/quick-feedback" || p === "/feeback-quick")
      return Page.QuickFeedback;
    if (p === "/profile") return Page.Profile;
    if (p === "/credentials") return Page.Credentials;
    if (p === "/payment") return Page.Payment;
    if (p === "/payment-success") return Page.PaymentSuccess;
    if (p === "/payment-cancel") return Page.PaymentCancel;
    return Page.Dashboard;
  };

  const pageToPath = (page: Page): string => {
    switch (page) {
      case Page.Home:
        return joinBase("");
      case Page.Admin:
        return joinBase("admin");
      case Page.AdminLogin:
        return joinBase("admin-login");
      case Page.Auth:
        return joinBase("auth");
      case Page.Signup:
        return joinBase("signup");
      case Page.Dashboard:
        return joinBase("dashboard");
      case Page.Settings:
        return joinBase("messenger");
      case Page.Feedback:
        return joinBase("feedback");
      case Page.QuickFeedback:
        return joinBase("quick-feedback");
      case Page.Profile:
        return joinBase("profile");
      case Page.Credentials:
        return joinBase("credentials");
      case Page.Payment:
        return joinBase("payment");
      case Page.PaymentSuccess:
        return joinBase("payment-success");
      case Page.PaymentCancel:
        return joinBase("payment-cancel");
      default:
        return joinBase("dashboard");
    }
  };

  const navigate = (page: Page) => {
    const targetPath = pageToPath(page);
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ page: targetPath }, "", targetPath);
    }
    setCurrentPage(page);
  };

  // Listen for browser back/forward
  useEffect(() => {
    const onPop = () => {
      const newPage = mapPathToPage(window.location.pathname);
      // Only allow admin to see AdminPage
      if (newPage === Page.Admin && (!auth || auth.role !== "admin")) {
        setCurrentPage(Page.Dashboard);
      } else {
        setCurrentPage(newPage);
      }
      // Reset contextual selections when leaving feedback
      if (newPage !== Page.Feedback) {
        setSelectedFeedbackCustomer(null);
        setSelectedFeedbackType(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [auth]);

  // Wrap existing handlers that set pages so they also push history
  useEffect(() => {
    (window as any).openFeedbackFromDashboard = (
      type: "positive" | "negative"
    ) => {
      setSelectedFeedbackCustomer(null);
      setSelectedFeedbackType(type);
      setCurrentPage(Page.Feedback);
    };
    return () => {
      try {
        delete (window as any).openFeedbackFromDashboard;
      } catch (e) {
        (window as any).openFeedbackFromDashboard = undefined;
      }
    };
  }, []);

  // Detect login route (keep for backward compatibility checks)
  const isAdminRoute =
    stripBase(window.location.pathname).toLowerCase() === "/admin";
  const isAdminLoginRoute =
    stripBase(window.location.pathname).toLowerCase() === "/admin-login";
  const isSignupRoute =
    stripBase(window.location.pathname).toLowerCase() === "/signup";

  // Public access: allow opening Feedback page without authentication
  if (!auth && currentPage === Page.Feedback) {
    return (
      <div className="flex">
        <main className="flex-1 min-h-screen bg-gray-50">
          <FeedbackPage
            customers={customers}
            customer={null}
            feedbackType={null}
            addFeedback={addFeedback}
            googleReviewLink={googleReviewLink}
            apiBase={API_BASE}
            tenantKey={TENANT_KEY}
            addCustomer={handleAddCustomer}
            ratingThreshold={ratingThreshold}
          />
        </main>
      </div>
    );
  }

  if (
    !auth ||
    currentPage === Page.Auth ||
    currentPage === Page.Home ||
    currentPage === Page.AdminLogin ||
    currentPage === Page.Signup
  ) {
    // If already authenticated and somehow on Auth page, redirect to dashboard
    if (auth && currentPage === Page.Auth) {
      const target = joinBase("dashboard");
      if (window.location.pathname !== target) {
        window.history.pushState({ page: target }, "", target);
      }
      setCurrentPage(Page.Dashboard);
    }
    // If someone directly visits /admin without being authenticated as admin,
    // send them to the dedicated Admin Login page and render it.
    if (currentPage === Page.Admin || isAdminRoute) {
      if (!auth || auth.role !== "admin") {
        // Only redirect once we've completed checks
        const target = joinBase("admin-login");
        if (window.location.pathname !== target) {
          window.history.pushState({ page: target }, "", target);
        }
        return (
          <AdminAuthPage
            onAuthSuccess={() => {
              setAuth({ role: "admin" });
              try {
                localStorage.setItem("adminSession", "true");
              } catch {}
              setCurrentPage(Page.Admin);
              if (
                stripBase(window.location.pathname).toLowerCase() !== "/admin"
              ) {
                window.history.pushState(
                  { page: "/admin" },
                  "",
                  joinBase("admin")
                );
              }
            }}
          />
        );
      }
    }
    if (currentPage === Page.AdminLogin || isAdminLoginRoute) {
      // If already authenticated as admin, go straight to admin
      if (auth && auth.role === "admin") {
        const target = joinBase("admin");
        if (window.location.pathname !== target) {
          window.history.pushState({ page: target }, "", target);
        }
        setCurrentPage(Page.Admin);
      }
      return (
        <AdminAuthPage
          onAuthSuccess={() => {
            setAuth({ role: "admin" });
            try {
              localStorage.setItem("adminSession", "true");
            } catch {}
            setCurrentPage(Page.Admin);
            if (
              stripBase(window.location.pathname).toLowerCase() !== "/admin"
            ) {
              window.history.pushState(
                { page: "/admin" },
                "",
                joinBase("admin")
              );
            }
          }}
        />
      );
    }
    // Handle signup route
    if (currentPage === Page.Signup || isSignupRoute) {
      return (
        <SignupPage
          onSignupSuccess={(role) => {
            if (role === "admin") {
              setAuth({ role: "admin" });
              try {
                localStorage.setItem("adminSession", "true");
              } catch {}
              setCurrentPage(Page.Admin);
              if (
                stripBase(window.location.pathname).toLowerCase() !== "/admin"
              ) {
                window.history.pushState(
                  { page: "/admin" },
                  "",
                  joinBase("admin")
                );
              }
            } else {
              // Buyer signup: show Payment page (pricing) so they can choose a plan
              setAuth({ role: "buyer" });

              // Check if they came from a plan selection
              let pending: string | null = null;
              try {
                pending = localStorage.getItem("pendingPlan");
              } catch {}

              if (pending) {
                // User selected a plan before signup -> continue to checkout immediately
                localStorage.removeItem("pendingPlan");
                startCheckout(pending);
              } else {
                // No pending plan -> show Payment page (pricing)
                setCurrentPage(Page.Payment);
                if (
                  stripBase(window.location.pathname).toLowerCase() !==
                  "/payment"
                ) {
                  window.history.pushState(
                    { page: "/payment" },
                    "",
                    joinBase("payment")
                  );
                }
              }
            }
          }}
        />
      );
    }
    // Landing page (Home) for unauthenticated users
    if (currentPage === Page.Home) {
      return (
        <HomePage
          onTryFree={() => {
            setAuth(null);
            localStorage.removeItem("token");
            localStorage.removeItem("companyId");
            localStorage.removeItem("user");
            const target = joinBase("signup");
            if (window.location.pathname !== target) {
              window.history.pushState({ page: target }, "", target);
            }
            setCurrentPage(Page.Auth);
          }}
          onDemo={() => {
            setAuth(null);
            localStorage.removeItem("token");
            localStorage.removeItem("companyId");
            localStorage.removeItem("user");
            const target = joinBase("auth");
            if (window.location.pathname !== target) {
              window.history.pushState({ page: target }, "", target);
            }
            setCurrentPage(Page.Auth);
          }}
          onSelectPlan={(planId) => {
            try {
              localStorage.setItem("pendingPlan", planId);
            } catch {}
            // If logged in, start checkout immediately; else go to auth
            if (auth) {
              startCheckout(planId);
            } else {
              const target = joinBase("auth");
              if (window.location.pathname !== target) {
                window.history.pushState({ page: target }, "", target);
              }
              setCurrentPage(Page.Auth);
            }
          }}
        />
      );
    }
    // Always show AuthPage if /auth route or not logged in
    return (
      <AuthPage
        onAuthSuccess={async (role) => {
          if (role === "admin") {
            setAuth({ role: "admin" });
            try {
              localStorage.setItem("adminSession", "true");
            } catch {}
            setCurrentPage(Page.Admin);
            if (
              stripBase(window.location.pathname).toLowerCase() !== "/admin"
            ) {
              window.history.pushState(
                { page: "/admin" },
                "",
                joinBase("admin")
              );
            }
            return;
          }

          // Buyer login: check for pending plan first
          setAuth({ role: "buyer" });
          let pending: string | null = null;
          try {
            pending = localStorage.getItem("pendingPlan");
          } catch {}

          if (pending) {
            try {
              localStorage.removeItem("pendingPlan");
            } catch {}
            startCheckout(pending);
            return;
          }

          // No pending plan - check if this user already has a subscription.
          // If they do, send them to Dashboard; otherwise show Payment page.
          try {
            const authModule = await import("./lib/firebaseAuth");
            const currentUser = authModule.getCurrentUser
              ? authModule.getCurrentUser()
              : null;

            let clientId: string | null = null;
            try {
              clientId = localStorage.getItem("companyId");
            } catch {}

            if (!clientId && currentUser) {
              clientId = await authModule.getUserClientId(currentUser);
            }

            if (clientId) {
              const { getClientProfile } = await import(
                "./lib/firestoreClient"
              );
              const profile = await getClientProfile(clientId);

              const hasPlan =
                profile &&
                (profile.planId ||
                  profile.plan ||
                  profile.planName ||
                  profile.smsCredits ||
                  profile.remainingCredits);

              const status =
                (profile && (profile.status || "active")) || "active";
              const isActive = ["active", "trialing", "paid"].includes(
                String(status).toLowerCase()
              );

              if (hasPlan && isActive) {
                try {
                  localStorage.setItem("companyId", clientId);
                  localStorage.setItem("clientId", clientId);
                  if (currentUser?.email)
                    localStorage.setItem("userEmail", currentUser.email);
                  if (currentUser?.uid)
                    localStorage.setItem("auth_uid", currentUser.uid);
                } catch {}

                // notify other parts of the app that auth is ready
                window.dispatchEvent(new Event("auth:ready"));

                setCurrentPage(Page.Dashboard);
                if (
                  stripBase(window.location.pathname).toLowerCase() !==
                  "/dashboard"
                ) {
                  window.history.pushState(
                    { page: "/dashboard" },
                    "",
                    "/dashboard"
                  );
                }
                return;
              }
            }
          } catch (e) {
            console.warn("[App] Subscription check failed during login:", e);
          }

          // Fallback: show Payment page
          setCurrentPage(Page.Payment);
          const target = joinBase("payment");
          if (
            stripBase(window.location.pathname).toLowerCase() !== "/payment"
          ) {
            window.history.pushState({ page: "/payment" }, "", target);
          }
        }}
      />
    );
  }
  return (
    <div className="flex">
      {/* Top navigation bar replaces sidebar across the app except Admin, Feedback, Home and Payment */}
      {currentPage !== Page.Feedback &&
        currentPage !== Page.Admin &&
        currentPage !== Page.Home &&
        currentPage !== Page.Payment && (
          <TopNav
            currentPage={currentPage}
            setCurrentPage={navigate}
            businessName={businessName}
            email={businessEmail}
          />
        )}
      <main
        className={`flex-1 min-h-screen bg-gray-50 ${
          currentPage !== Page.Feedback &&
          currentPage !== Page.Admin &&
          currentPage !== Page.Payment
            ? "pt-14"
            : ""
        }`}
      >
        {currentPage === Page.Admin && auth.role === "admin" && (
          <AdminPage
            twilioAccountSid={twilioAccountSid}
            setTwilioAccountSid={setTwilioAccountSid}
            twilioAuthToken={twilioAuthToken}
            setTwilioAuthToken={setTwilioAuthToken}
            twilioPhoneNumber={twilioPhoneNumber}
            setTwilioPhoneNumber={setTwilioPhoneNumber}
            onLogout={handleLogout}
          />
        )}
        {currentPage === Page.Dashboard && (
          <div className="relative">
            <DashboardPage
              customers={customers}
              activityLogs={activityLogs}
              plan={plan}
              messagesSentThisMonth={messagesSentThisMonth}
              onAddCustomer={handleAddCustomer}
              onSendMessage={handleSendMessage}
              onDeleteCustomer={handleDeleteCustomer}
              onBulkAddCustomers={handleBulkAddCustomers}
              onOpenFunnel={handleOpenFunnel}
              onOpenFeedback={handleOpenFeedback}
              onAddFeedback={addFeedback}
              onClearCustomers={handleClearCustomers}
              businessName={businessName}
              feedbackPageLink={feedbackPageLink}
              onQueueSmsCustomers={(ids) => enqueueSmsCustomers(ids)}
              twilioConfigured={Boolean(
                twilioAccountSid &&
                  twilioAuthToken &&
                  (twilioPhoneNumber || twilioMessagingServiceSid)
              )}
              messageTemplate={messageTemplate}
              onBusinessNameChange={(newName) => {
                setBusinessName(newName);
                localStorage.setItem("businessName", newName);
              }}
            />
            {/* Dashboard now stays visible; locking handled inside Customer List section */}
          </div>
        )}
        {/* Payment Pages */}
        {currentPage === Page.Payment && (
          <PaymentPage
            onPaymentSuccess={handlePaymentSuccess}
            onBack={() => navigate(Page.Home)}
          />
        )}
        {currentPage === Page.PaymentSuccess && <PaymentSuccessPage />}
        {currentPage === Page.PaymentCancel && <PaymentCancelPage />}
        {currentPage === Page.Profile && (
          <ProfilePage
            user={{
              name: businessName,
              email: businessEmail,
              subscription: "Growth Plan",
              stripeStatus: "active",
              logoUrl: "",
              supportEmail: "support@email.com",
            }}
            activityLogs={activityLogs}
            onLogout={handleLogout}
            setBusinessName={setBusinessName}
            setBusinessEmail={setBusinessEmail}
          />
        )}
        {currentPage === Page.Settings && (
          <SettingsPage
            customers={customers}
            businessName={businessName}
            setBusinessName={setBusinessName}
            feedbackPageLink={feedbackPageLink}
            setFeedbackPageLink={setFeedbackPageLink}
            googleReviewLink={googleReviewLink}
            setGoogleReviewLink={setGoogleReviewLink}
            messageTemplate={messageTemplate}
            setMessageTemplate={setMessageTemplate}
            onMarkCustomerSent={markCustomerSent}
            onMarkCustomerFailed={markCustomerFailed}
            ratingThreshold={ratingThreshold}
            setRatingThreshold={setRatingThreshold}
          />
        )}
        {/* If you have a Funnel page, use the correct enum value. If not, comment this out. */}
        {/* {currentPage === Page.Funnel && selectedFeedbackCustomer && (
          <FunnelPage
            customer={selectedFeedbackCustomer}
            businessName={businessName}
            googleReviewLink={googleReviewLink}
            onComplete={handleFunnelComplete}
            onClose={handleCloseFunnel}
          />
        )} */}
        {currentPage === Page.Feedback && (
          <FeedbackPage
            customers={customers}
            customer={selectedFeedbackCustomer}
            feedbackType={selectedFeedbackType}
            addFeedback={addFeedback}
            googleReviewLink={googleReviewLink}
            apiBase={API_BASE}
            tenantKey={TENANT_KEY}
            addCustomer={handleAddCustomer}
            onBack={handleBackFromFeedback}
            onClearNegative={handleClearNegativeFeedback}
            ratingThreshold={ratingThreshold}
          />
        )}
        {currentPage === Page.QuickFeedback && (
          <QuickFeedbackPage
            customers={customers}
            onAddCustomer={handleAddCustomer}
            onAddFeedback={addFeedback}
          />
        )}
        {currentPage === Page.Credentials && (
          <CredentialsPage onBack={() => navigate(Page.Dashboard)} />
        )}
        {/* Payment success/cancel handled by PaymentPage via onPaymentSuccess/onBack props above */}
      </main>
    </div>
  );
};

export default App;
