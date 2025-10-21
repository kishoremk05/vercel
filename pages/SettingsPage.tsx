import React, { useState, useEffect } from "react";
import { LinkIcon, StarIcon } from "../components/icons";
import { getSmsServerUrl } from "../lib/firebaseConfig";

import { Customer } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE || "";

// Note: API base will be resolved from Firebase admin settings via
// getSmsServerUrl(). We still keep local fallbacks in lib/firebaseConfig.

interface SettingsPageProps {
  customers: Customer[]; // retained for compatibility but not used here
  messageTemplate: string;
  setMessageTemplate: (template: string) => void;
  businessName: string;
  setBusinessName?: (name: string) => void;
  feedbackPageLink: string; // used in outbound messages & WhatsApp
  setFeedbackPageLink: (link: string) => void;
  googleReviewLink: string; // used for positive redirect on FeedbackPage
  setGoogleReviewLink: (link: string) => void;
  onMarkCustomerSent?: (customerId: string, context?: string) => void; // not used
  onMarkCustomerFailed?: (customerId: string, reason?: string) => void; // not used
  tenantKey?: string;
  ratingThreshold?: "5" | "3"; // Rating threshold configuration
  setRatingThreshold?: (threshold: "5" | "3") => void; // Setter for rating threshold
}

const SettingsPage: React.FC<SettingsPageProps> = ({
  customers,
  messageTemplate,
  setMessageTemplate,
  businessName,
  setBusinessName,
  feedbackPageLink,
  setFeedbackPageLink,
  googleReviewLink,
  setGoogleReviewLink,
  onMarkCustomerSent,
  onMarkCustomerFailed,
  tenantKey,
  ratingThreshold = "5",
  setRatingThreshold,
}) => {
  // State for SMS server port from Firebase (Requirement 2)
  const [smsServerPort, setSmsServerPort] = useState<string | null>(null);
  const [loadingServerPort, setLoadingServerPort] = useState(true);

  // Fetch SMS server port from Firebase on mount (Requirement 2)
  useEffect(() => {
    const fetchServerPort = async () => {
      try {
        const token = localStorage.getItem("adminToken");
        const headers: any = {};
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        // Resolve API base so we don't accidentally hit the frontend
        // origin (which returns index.html) and cause a JSON parse
        // error when reading admin JSON endpoints.
        const base = await getSmsServerUrl().catch(() => API_BASE);
        const url = base
          ? `${String(base).replace(/\/+$/, "")}/admin/server-config`
          : `${API_BASE}/admin/server-config`;

        let response: Response | null = null;
        try {
          response = await fetch(url, { headers });
        } catch (fetchErr) {
          console.error("Failed to fetch server port:", fetchErr);
          setLoadingServerPort(false);
          return;
        }

        if (response && response.ok) {
          // Defensive parse: some hosting setups may return HTML error pages
          // (DOCTYPE) instead of JSON — handle that gracefully.
          try {
            const data = await response.json();
            if (data && data.success && data.config?.smsServerPort) {
              setSmsServerPort(data.config.smsServerPort);
            }
          } catch (parseErr) {
            const text = await response.text().catch(() => null);
            console.error(
              "Failed to parse /admin/server-config JSON response:",
              parseErr,
              text
            );
          }
        } else if (response) {
          const text = await response.text().catch(() => null);
          console.warn(
            "admin/server-config responded with non-OK status:",
            response.status,
            text
          );
        }
      } catch (error) {
        console.error("Failed to fetch server port:", error);
      } finally {
        setLoadingServerPort(false);
      }
    };
    fetchServerPort();
    // Also prefer the global Firebase-configured SMS server URL (admin_settings/global)
    (async () => {
      try {
        const base = await getSmsServerUrl();
        if (base) {
          // Normalize and persist as fallback for other parts of the app
          const val = String(base).trim().replace(/\/+$/, "");
          setSmsServerPort(val);
          try {
            localStorage.setItem("smsServerUrl", val);
          } catch {}
        }
      } catch (e) {
        // ignore - earlier fetchServerPort handles errors for admin endpoint
      }
    })();
  }, []);

  // Helper to personalize strings with placeholders used in both preview and send flows
  // Ensure a link contains tenantKey, preserving other params
  const ensureTenantKey = (link: string) => {
    if (!link) return link;
    // Prefer explicit tenantKey prop, then URL query, then localStorage, finally 'demo'
    const fallback = (() => {
      try {
        return new URLSearchParams(window.location.search).get("tenantKey");
      } catch {
        return null;
      }
    })();
    const key =
      tenantKey || fallback || localStorage.getItem("tenantKey") || "demo";
    try {
      const url = new URL(link, window.location.origin);
      url.searchParams.set("tenantKey", key);
      return url.toString();
    } catch {
      // Relative URL fallback
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
        .filter((kv) => kv && !/^tenantKey=/i.test(kv))
        .join("&");
      const sep = params ? "&" : "";
      const qs = `${params}${sep}tenantKey=${encodeURIComponent(key)}`;
      return qs ? `${path}?${qs}${hash}` : `${path}${hash}`;
    }
  };

  const appendIdToLink = (link: string, customerId?: string) => {
    if (!link) return link;
    const ensured = ensureTenantKey(link);
    try {
      const url = new URL(ensured, window.location.origin);
      if (customerId) url.searchParams.set("id", customerId);
      return url.toString();
    } catch {
      // Fallback: strip any existing id= and re-append; keep tenantKey
      let base = ensured;
      let hash = "";
      const hashIdx = base.indexOf("#");
      if (hashIdx >= 0) {
        hash = base.slice(hashIdx);
        base = base.slice(0, hashIdx);
      }
      const [path, query = ""] = base.split("?");
      const pairs = query.split("&").filter(Boolean);
      const filtered = pairs.filter((kv) => kv && !/^id=/i.test(kv));
      const params = filtered.join("&");
      const sep = params ? "&" : "";
      const qs = customerId
        ? `${params}${sep}id=${encodeURIComponent(customerId)}`
        : params;
      return qs ? `${path}?${qs}${hash}` : `${path}${hash}`;
    }
  };

  const personalize = (
    template: string,
    customer: Customer | null,
    opts?: { fallbackName?: string }
  ) => {
    if (!template) return template;
    const name = customer?.name || opts?.fallbackName || "Customer";
    const phone = customer?.phone || "";
    let reviewWithId = appendIdToLink(feedbackPageLink, customer?.phone);

    // CRITICAL FIX: Add clientId parameter for proper Firebase storage
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

    return template
      .replace(/\[Customer Name\]/g, name)
      .replace(/\[Business Name\]/g, businessName)
      .replace(/\[Review Link\]/g, reviewWithId)
      .replace(/\[Phone\]/g, phone)
      .replace(/\{\{\s*name\s*\}\}/gi, name)
      .replace(/\{\{\s*business\s*\}\}/gi, businessName)
      .replace(/\{\{\s*review(_link)?\s*\}\}/gi, reviewWithId)
      .replace(/\{\{\s*phone\s*\}\}/gi, phone);
  };
  const [localSmsTemplate, setLocalSmsTemplate] = useState(messageTemplate);
  const [localGoogleReviewLink, setLocalGoogleReviewLink] =
    useState(googleReviewLink);
  // Note: Feedback URL removed - managed in Admin page
  const [waMessage, setWaMessage] = useState<string>(
    "Hi [Customer Name], we'd love your feedback for [Business Name]. Link: [Review Link]"
  );
  // WhatsApp manual send removed here; template preview only
  const [showSuccess, setShowSuccess] = useState(false);
  // Removed multi-recipient selection and send from Settings; use Dashboard instead

  const handleSave = async () => {
    const googleLink = localGoogleReviewLink.trim();

    // Save to state
    setMessageTemplate(localSmsTemplate);
    setGoogleReviewLink(googleLink);

    // Save Google Review link to Firebase (per client)
    try {
      const companyId = localStorage.getItem("companyId");
      if (!companyId) {
        console.warn(
          "No companyId found in localStorage — saving Google Review link locally as fallback"
        );
        try {
          localStorage.setItem("googleReviewLink", googleLink);
        } catch {}
      } else {
        const base = await getSmsServerUrl().catch(() => API_BASE);
        const url = base
          ? `${String(base).replace(/\/+$/, "")}/api/company/links`
          : `${API_BASE}/api/company/links`;

        let response: Response | null = null;
        try {
          response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // Also surface companyId into headers so intermediary proxies
              // or server parsers can still route the request correctly.
              "x-company-id": companyId || "",
            },
            body: JSON.stringify({
              companyId,
              googleReviewLink: googleLink,
            }),
          });
        } catch (fetchErr) {
          console.error("Network error saving Google Review link:", fetchErr);
          // Persist locally as a fallback so the user's change isn't lost
          try {
            localStorage.setItem("googleReviewLink", googleLink);
            console.warn(
              "Saved Google Review link to localStorage as fallback"
            );
          } catch {}
          response = null;
        }

        if (response) {
          // Try reading JSON body safely; if not JSON, capture text for logs
          let bodyData: any = null;
          try {
            bodyData = await response.json();
          } catch (parseErr) {
            const txt = await response.text().catch(() => null);
            console.error(
              "Failed to parse /api/company/links response as JSON:",
              parseErr,
              txt
            );
          }

          if (response.ok && bodyData && bodyData.success) {
            console.log("✅ Google Review link saved to Firebase successfully");
            try {
              localStorage.setItem("googleReviewLink", googleLink);
            } catch {}
          } else {
            console.error(
              "Failed to save Google Review link to Firebase",
              response.status,
              bodyData || null
            );
            // Persist locally as a fallback so the user's change isn't lost
            try {
              localStorage.setItem("googleReviewLink", googleLink);
              console.warn(
                "Saved Google Review link to localStorage as fallback"
              );
            } catch {}
          }
        }
      }
    } catch (error) {
      console.error("Error saving Google Review link:", error);
      try {
        localStorage.setItem("googleReviewLink", googleLink);
      } catch {}
    }

    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  // Representative sample for previews (use feedbackPageLink from props)
  const selectedCustomer = null;
  const dynamicPreviewName = "Jane Doe";
  const basePreviewLink = (feedbackPageLink || "/feedback").trim();

  // Add clientId to preview link
  const getPreviewLinkWithClientId = (link: string, phone?: string) => {
    let reviewLink = appendIdToLink(ensureTenantKey(link), phone);
    const clientCompanyId = localStorage.getItem("companyId") || "";
    if (clientCompanyId) {
      try {
        const url = new URL(reviewLink, window.location.origin);
        url.searchParams.set("clientId", clientCompanyId);
        reviewLink = url.toString();
      } catch {
        reviewLink =
          reviewLink +
          (reviewLink.includes("?") ? "&" : "?") +
          `clientId=${encodeURIComponent(clientCompanyId)}`;
      }
    }
    return reviewLink;
  };

  const dynamicPreviewLink = getPreviewLinkWithClientId(
    basePreviewLink,
    selectedCustomer?.phone
  );

  // Build a simple sample WhatsApp preview (no sending here)
  const sampleWaPreview = (() => {
    const samplePhone = "+15551234567";
    const reviewWithId = getPreviewLinkWithClientId(
      (feedbackPageLink || "/feedback").trim(),
      samplePhone
    );
    return (waMessage || "")
      .replace(/\[Customer Name\]/g, dynamicPreviewName)
      .replace(/\[Business Name\]/g, businessName)
      .replace(/\[Review Link\]/g, reviewWithId)
      .replace(/\{\{\s*name\s*\}\}/gi, dynamicPreviewName)
      .replace(/\{\{\s*business\s*\}\}/gi, businessName)
      .replace(/\{\{\s*review(_link)?\s*\}\}/gi, reviewWithId);
  })();

  return (
    <div className="min-h-screen grid-pattern relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-6 lg:py-10">
        {/* Header Section */}
        <div className="mb-8 lg:mb-10">
          <div className="gradient-border premium-card bg-white shadow-lg p-5 lg:p-6 transition-all duration-300 rounded-2xl">
            <div className="space-y-1">
              <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 flex items-center gap-2">
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
                    <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                Settings
              </h2>
              <p className="text-sm text-gray-600">
                Customize messages and configure your review funnel and
                SMS/WhatsApp integration.
              </p>
            </div>
            <div className="mt-4 flex justify-center">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-800 text-xs font-semibold shadow-sm">
                <span className="font-semibold">SMS Server:</span>
                {loadingServerPort ? (
                  <span className="font-mono text-gray-500">Loading...</span>
                ) : smsServerPort ? (
                  <span className="font-mono text-indigo-600 font-bold">
                    {smsServerPort}
                  </span>
                ) : (
                  <span className="font-mono text-gray-500">
                    Not configured
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Message Template Configuration Card */}
        <div className="mb-8 lg:mb-10">
          <div className="gradient-border glow-on-hover premium-card bg-white shadow-lg p-6 transition-all duration-300 hover:shadow-xl rounded-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <div className="bg-indigo-100 p-1.5 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5 text-indigo-600"
                >
                  <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
                  <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
                </svg>
              </div>
              Message Templates
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Configure your SMS and WhatsApp message templates. Twilio
              credentials are managed in the Admin page.
            </p>
            <div className="space-y-6">
              <div className="pt-2">
                <h4 className="text-base font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <div className="bg-green-100 p-1 rounded">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-4 w-4 text-green-600"
                    >
                      <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 00-1.032-.211 50.89 50.89 0 00-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 002.433 3.984L7.28 21.53A.75.75 0 016 21v-4.03a48.527 48.527 0 01-1.087-.128C2.905 16.58 1.5 14.833 1.5 12.862V6.638c0-1.97 1.405-3.718 3.413-3.979z" />
                      <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 001.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0015.75 7.5z" />
                    </svg>
                  </div>
                  WhatsApp Template (manual)
                </h4>
                <p className="text-xs text-gray-500 mb-3">
                  This template is used when you open WhatsApp manually from the
                  Dashboard. Edit the text and placeholders below.
                </p>
                <div className="mt-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    WhatsApp Message Template
                  </label>
                  <textarea
                    value={waMessage}
                    onChange={(e) => setWaMessage(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-gray-900 shadow-sm"
                    placeholder="Hi [Customer Name]..."
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Placeholders supported: [Customer Name], [Business Name],
                    [Review Link].
                  </p>
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-700 border border-gray-200">
                    <span className="font-semibold">Preview:</span>{" "}
                    {sampleWaPreview}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Google Review Redirect Link - Client Setting */}
        <div className="mb-8 lg:mb-10">
          <div className="gradient-border glow-on-hover premium-card bg-white shadow-lg p-6 transition-all duration-300 hover:shadow-xl rounded-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <div className="bg-blue-100 p-1.5 rounded-full">
                <StarIcon className="h-5 w-5 text-blue-600" />
              </div>
              Google Review Link (Positive Redirect)
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Paste your public Google review URL. When a user selects 4–5 stars
              on the feedback page, we will redirect them here. Saved per
              client.
            </p>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LinkIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="url"
                value={localGoogleReviewLink}
                onChange={(e) => setLocalGoogleReviewLink(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 bg-white text-gray-900 shadow-sm"
                placeholder="https://g.page/r/your-business-id/review"
              />
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Note: Feedback page URL is managed globally by admin.
            </p>
          </div>
        </div>

        {/* Rating Threshold Configuration */}
        <div className="mb-8 lg:mb-10">
          <div className="gradient-border glow-on-hover premium-card bg-white shadow-lg p-6 transition-all duration-300 hover:shadow-xl rounded-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <div className="bg-yellow-100 p-1.5 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5 text-yellow-600"
                >
                  <path
                    fillRule="evenodd"
                    d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              Rating Classification
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Configure how star ratings are classified as positive or negative
              feedback.
            </p>
            <div className="space-y-3">
              <label
                className="flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all hover:border-gray-300 hover:bg-gray-50"
                style={{
                  borderColor:
                    ratingThreshold === "5"
                      ? "rgb(99, 102, 241)"
                      : "rgb(229, 231, 235)",
                  backgroundColor:
                    ratingThreshold === "5" ? "rgb(238, 242, 255)" : "white",
                }}
              >
                <input
                  type="radio"
                  name="ratingThreshold"
                  value="5"
                  checked={ratingThreshold === "5"}
                  onChange={(e) =>
                    setRatingThreshold && setRatingThreshold("5")
                  }
                  className="mt-0.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">
                      Strict Mode
                    </span>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                      Recommended
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Only{" "}
                    <span className="font-semibold text-yellow-600">
                      ★★★★★ (5 stars)
                    </span>{" "}
                    = Positive
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold text-red-600">
                      ★ to ★★★★ (1-4 stars)
                    </span>{" "}
                    = Negative
                  </p>
                  <p className="text-xs text-gray-500 mt-2 italic">
                    Best for maintaining high standards and capturing detailed
                    feedback for improvement.
                  </p>
                </div>
              </label>

              <label
                className="flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all hover:border-gray-300 hover:bg-gray-50"
                style={{
                  borderColor:
                    ratingThreshold === "3"
                      ? "rgb(99, 102, 241)"
                      : "rgb(229, 231, 235)",
                  backgroundColor:
                    ratingThreshold === "3" ? "rgb(238, 242, 255)" : "white",
                }}
              >
                <input
                  type="radio"
                  name="ratingThreshold"
                  value="3"
                  checked={ratingThreshold === "3"}
                  onChange={(e) =>
                    setRatingThreshold && setRatingThreshold("3")
                  }
                  className="mt-0.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">
                      Lenient Mode
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    <span className="font-semibold text-yellow-600">
                      ★★★ to ★★★★★ (3-5 stars)
                    </span>{" "}
                    = Positive
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold text-red-600">
                      ★ to ★★ (1-2 stars)
                    </span>{" "}
                    = Negative
                  </p>
                  <p className="text-xs text-gray-500 mt-2 italic">
                    Good for businesses wanting more positive reviews and less
                    critical feedback tracking.
                  </p>
                </div>
              </label>
            </div>
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> This setting affects how ratings are
                  classified in your dashboard analytics and determines when
                  customers are prompted to leave Google reviews.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button Section */}
        <div className="flex justify-end items-center gap-4">
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
              Changes saved successfully!
            </p>
          )}
          <button
            onClick={handleSave}
            className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 font-semibold shadow-md transition-colors inline-flex items-center gap-2"
          >
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
            Save All Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
