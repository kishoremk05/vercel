import React, { useMemo, useState } from "react";
import FeedbackAnalytics from "../components/FeedbackAnalytics";
import FeedbackReplyModal from "../components/FeedbackReplyModal";
import FeedbackDeleteModal from "../components/FeedbackDeleteModal";
import { Customer } from "../types";
import { getSmsServerUrl } from "../lib/firebaseConfig";

interface FeedbackPageProps {
  customers: Customer[];
  customer: Customer | null;
  feedbackType: "positive" | "negative" | null;
  addFeedback: (
    customerId: string,
    text: string,
    sentiment: "positive" | "negative",
    phone?: string,
    rating?: number,
    idOverride?: string
  ) => void;
  googleReviewLink: string;
  apiBase?: string;
  tenantKey?: string;
  addCustomer?: (name: string, phone: string) => string | void; // optional for auto-create
  onBack?: () => void; // optional back handler when viewing filtered feedback
  onClearNegative?: () => void; // optional: clear all negative feedback
  ratingThreshold?: "5" | "3"; // Rating threshold: "5" = only 5 stars positive (1-4 negative), "3" = 3-5 stars positive (1-2 negative)
}
//

const FeedbackPage: React.FC<FeedbackPageProps> = ({
  customers,
  customer,
  feedbackType,
  addFeedback,
  googleReviewLink,
  apiBase,
  tenantKey,
  addCustomer,
  onBack,
  onClearNegative,
  ratingThreshold = "5", // Default: only 5 stars is positive
}) => {
  // Requirement 4: Extract clientId from URL for multi-tenant support (must be defined early)
  const clientIdFromUrl = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("clientId");
    } catch {
      return null;
    }
  }, []);

  // Store clientId in sessionStorage if present for future API calls
  React.useEffect(() => {
    if (clientIdFromUrl) {
      try {
        sessionStorage.setItem("feedbackClientId", clientIdFromUrl);
      } catch {}
    }
  }, [clientIdFromUrl]);

  const [newFeedbackText, setNewFeedbackText] = useState("");

  // New public form state (star-only flow)
  const [rating, setRating] = useState<number | null>(null); // 1-5 stars
  const [comment, setComment] = useState("");
  // Removed name/email collection for negative feedback; we'll use customer ID instead
  const [submitted, setSubmitted] = useState(false);

  // If opened via public link ?id=<phone>, prefer that as the attribution phone.
  const idFromUrl = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("id") || undefined;
    } catch {
      return undefined;
    }
  }, []);
  // Note: we do not auto-create customers from public links to avoid side-effects.

  // Only show negative feedback entries
  type Entry = {
    id: string;
    text: string;
    sentiment: "positive" | "negative";
    date: Date | string;
    phone?: string;
    name: string;
    customerId: string;
  };

  const entries: Entry[] = useMemo(() => {
    return customers.flatMap((c) =>
      (c.feedback || [])
        .filter((f) => f.sentiment === "negative")
        .map((f) => ({
          id: f.id,
          text: f.text,
          sentiment: f.sentiment,
          date: f.date,
          phone: (f as any).phone || c.phone,
          name: c.name,
          customerId: c.id,
        }))
    );
  }, [customers]);

  // --- Reply/Delete Modal State ---
  const [replyModal, setReplyModal] = useState<{
    open: boolean;
    phone: string;
  }>({ open: false, phone: "" });
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    entry: Entry | null;
  }>({ open: false, entry: null });

  // No sentiment filter, just show all negative entries
  const filtered = useMemo(() => entries, [entries]);

  // Admin view filters and pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "name">(
    "newest"
  );
  const [page, setPage] = useState(1);
  const pageSize = 9;

  // --- Utility: Normalize external URL (basic implementation) ---
  function normalizeExternalUrl(url: string): string {
    try {
      const u = new URL(url);
      return u.toString();
    } catch {
      // If not a valid URL, just return as-is
      return url.trim();
    }
  }

  // CSV export for filtered results (not paged)
  const exportCsv = () => {
    const rows = filteredWithControls.map((e) => ({
      Name: e.name,
      Phone: e.phone || "",
      Date: new Date(e.date).toLocaleString(),
      Sentiment: e.sentiment,
      Text: e.text,
    }));
    const headers = Object.keys(
      rows[0] || {
        Name: "",
        Phone: "",
        Date: "",
        Sentiment: "",
        Text: "",
      }
    );
    const esc = (v: any) => {
      const s = String(v ?? "");
      if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const csv = [headers.join(",")]
      .concat(rows.map((r) => headers.map((h) => esc((r as any)[h])).join(",")))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `negative-feedback-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Details modal state
  const [selected, setSelected] = useState<Entry | null>(null);

  const filteredWithControls = useMemo(() => {
    const s = searchQuery.trim().toLowerCase();
    // Date range filters removed per requirement
    const start = null;
    const end = null;

    let list = filtered.filter((e) => {
      const inSearch = !s
        ? true
        : e.name.toLowerCase().includes(s) ||
          (e.phone || "").toLowerCase().includes(s) ||
          e.text.toLowerCase().includes(s);
      if (!inSearch) return false;
      // Date range filtering removed
      return true;
    });

    list = list.slice().sort((a, b) => {
      if (sortOrder === "name") {
        return a.name.localeCompare(b.name);
      }
      const ad = +new Date(a.date);
      const bd = +new Date(b.date);
      return sortOrder === "newest" ? bd - ad : ad - bd;
    });
    return list;
  }, [filtered, searchQuery, sortOrder]);

  const totalCount = filtered.length;
  const filteredCount = filteredWithControls.length;
  const totalPages = Math.max(
    1,
    Math.ceil(filteredWithControls.length / pageSize)
  );
  const paged = filteredWithControls.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setPage(1);
  }, [searchQuery, sortOrder]);

  // Derived sentiment computed on submit
  const [quickSentiment, setQuickSentiment] = useState<"positive" | "negative">(
    "positive"
  );
  const [quickStatus, setQuickStatus] = useState<string | null>(null);
  // Admin filters UX helpers
  const hasActiveFilters =
    (searchQuery && searchQuery.trim().length > 0) || sortOrder !== "newest";
  const [filtersNotice, setFiltersNotice] = useState<string | null>(null);

  // Helpers for nicer negative layout
  const maskPhone = (p?: string) => {
    if (!p) return "";
    const digits = p.replace(/\D/g, "");
    if (digits.length < 4) return p;
    const last4 = digits.slice(-4);
    return `••••••${last4}`;
  };
  const isPublicBucketId = (id?: string) => id === "public-feedback";

  const appendIdToLink = (link: string, id?: string) => {
    if (!link) return link;
    if (!id) return link;
    // Append id param if not present
    try {
      const url = new URL(link);
      url.searchParams.set("id", id);
      return url.toString();
    } catch {
      // If not a valid URL, just append as query param
      if (link.includes("?")) return `${link}&id=${encodeURIComponent(id)}`;
      return `${link}?id=${encodeURIComponent(id)}`;
    }
  };

  // Compute the outgoing Google Review link once; disable CTA if it's not valid.

  // Precompute id/phone used for attribution and the positive target href to keep it stable during click.
  // --- POSITIVE REVIEW REDIRECT LOGIC ---
  const [positiveError, setPositiveError] = useState<string | null>(null);
  const positiveIdParam = useMemo(() => {
    return customer?.phone || idFromUrl || undefined;
  }, [customer?.phone, idFromUrl]);

  // Helper to strip any id query param from a URL string
  const stripIdParam = (link?: string) => {
    const s = (link || "").trim();
    if (!s) return s;
    try {
      const url = new URL(s);
      url.searchParams.delete("id");
      return url.toString();
    } catch {
      // Fallback for non-URL strings
      let base = s;
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
      return params ? `${path}?${params}${hash}` : `${path}${hash}`;
    }
  };

  // Allow any valid link for positive review redirect (do NOT append id)
  const positiveHref = useMemo(() => {
    const raw = (googleReviewLink || "").trim();
    if (!raw) return undefined;
    const base = normalizeExternalUrl(raw);
    if (base === "#" || base === "https://" || base === "http://")
      return undefined;
    return stripIdParam(base);
  }, [googleReviewLink]);

  // Final href: prefer appended id link; else normalized raw link; else '#'
  const finalPositiveHref = useMemo(() => {
    if (positiveHref) return positiveHref;
    const raw = (googleReviewLink || "").trim();
    if (!raw) return "#";
    const norm = normalizeExternalUrl(raw);
    return stripIdParam(norm);
  }, [positiveHref, googleReviewLink]);

  // Robust fallback: if finalPositiveHref is not usable, fall back to normalized raw link
  const positiveTargetHref = useMemo(() => {
    const fallback = stripIdParam(normalizeExternalUrl(googleReviewLink || ""));
    if (finalPositiveHref && finalPositiveHref !== "#")
      return finalPositiveHref;
    return fallback;
  }, [finalPositiveHref, googleReviewLink]);
  const hasPositiveLink = !!positiveTargetHref && positiveTargetHref !== "#";

  // Remove all error/validation for the link format
  React.useEffect(() => {
    setPositiveError(null);
  }, [googleReviewLink]);

  const handlePositiveMouseDown = () => {
    // Persist without blocking navigation: sendBeacon immediately; defer local state update.
    const targetCustomerId = customer?.id || "";
    const phone = positiveIdParam || undefined;
    const message = `Public positive rating: ${rating} star${
      rating && rating > 1 ? "s" : ""
    }`;
    const feedbackId = `fb_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    // Defer local add to next tick so the anchor click navigation isn't interrupted by a re-render.
    setTimeout(() => {
      addFeedback(
        targetCustomerId,
        message,
        "positive",
        phone,
        rating || undefined,
        feedbackId
      );
      try {
        window.dispatchEvent(new CustomEvent("dash:feedback:changed"));
      } catch {}
    }, 0);
    // Persist remotely (best-effort, non-blocking). Prefer sendBeacon; fallback to fetch keepalive.
    if (tenantKey) {
      const payload = JSON.stringify({
        tenantKey,
        sentiment: "positive",
        text: message,
        phone,
        rating: rating || undefined,
        customerId: targetCustomerId || undefined,
        id: feedbackId,
        // include companyId when available so server writes to V2 schema
        companyId: localStorage.getItem("companyId") || undefined,
      });
      try {
        const base = (apiBase ?? "").trim();
        const url = base ? `${base}/feedback` : `/api/feedback`;
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: "application/json" });
          navigator.sendBeacon(url, blob);
        } else {
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true as any,
          }).catch(() => {});
        }
      } catch {}
    }
  };

  const handleQuickSubmit = async () => {
    setQuickStatus(null);
    // Require star rating
    if (!rating) {
      setQuickStatus("Please choose a star rating.");
      return;
    }

    // Determine sentiment based on rating threshold
    // "5" threshold: only 5 stars = positive (1-4 = negative)
    // "3" threshold: 3-5 stars = positive (1-2 = negative)
    const isPositive = ratingThreshold === "5" ? rating === 5 : rating >= 3;
    const sentiment: "positive" | "negative" = isPositive
      ? "positive"
      : "negative";
    setQuickSentiment(sentiment);
    // If negative, require a short comment only (anonymous)
    if (sentiment === "negative") {
      if (!comment.trim()) {
        setQuickStatus("Please share a few details to help us improve.");
        return;
      }
      // Persist the negative feedback so it shows on Dashboard, tagged by customer phone
      const idForRecord = customer?.phone || idFromUrl || "public";
      const composed = comment.trim();
      // If a specific customer context exists, use it; otherwise pass empty id and rely on phone match or bucket
      const targetCustomerId = customer?.id || "";
      const phone =
        customer?.phone ||
        (typeof idForRecord === "string" ? idForRecord : undefined);
      // Generate a deterministic id we will also send to the server so merge won't duplicate
      const feedbackId = `fb_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 10)}`;
      // Save locally (for same-device sessions) with same id
      addFeedback(
        targetCustomerId,
        composed,
        "negative",
        phone,
        rating || undefined,
        feedbackId
      );
      try {
        window.dispatchEvent(new CustomEvent("dash:feedback:changed"));
      } catch {}
      // Save remotely so admin dashboard sees it from any device
      if (tenantKey) {
        try {
          // Use Firebase config for SMS server URL
          const url = await getSmsServerUrl().then(
            (base) => `${base}/feedback`
          );

          // Requirement 4: Use clientId from URL or session storage or localStorage
          const companyId =
            clientIdFromUrl ||
            sessionStorage.getItem("feedbackClientId") ||
            localStorage.getItem("companyId") ||
            undefined;

          console.log(
            `[FeedbackPage] 📤 Submitting negative feedback to: ${url}`
          );
          console.log(`[FeedbackPage] companyId: ${companyId}`);
          console.log(`[FeedbackPage] tenantKey: ${tenantKey}`);
          console.log(`[FeedbackPage] rating: ${rating}`);
          console.log(`[FeedbackPage] sentiment: negative`);

          // Fallback: try to get tenantKey from URL if not provided
          const finalTenantKey =
            tenantKey ||
            new URLSearchParams(window.location.search).get("tenantKey") ||
            "demo";
          console.log(`[FeedbackPage] finalTenantKey: ${finalTenantKey}`);

          const payload = {
            tenantKey: finalTenantKey, // Use fallback
            sentiment: "negative",
            // send both 'comment' and 'text' for compatibility
            comment: composed,
            text: composed,
            phone,
            rating: rating || undefined,
            customerId: targetCustomerId || undefined,
            id: feedbackId,
            companyId: companyId, // Requirement 4: Include clientId
          };

          console.log(
            `[FeedbackPage] 📦 Payload:`,
            JSON.stringify(payload).substring(0, 200)
          );

          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
            .then(async (res) => {
              if (!res.ok) {
                const text = await res.text().catch(() => "");
                console.error(
                  `[FeedbackPage] ❌ Server error: ${res.status}`,
                  text
                );
              } else {
                console.log(
                  `[FeedbackPage] ✅ Negative feedback submitted successfully`
                );
              }
            })
            .catch((err) => {
              console.error(`[FeedbackPage] ❌ Network error:`, err);
            });
        } catch (err) {
          console.error(`[FeedbackPage] ❌ Outer catch:`, err);
        }
      }

      setSubmitted(true);
      setQuickStatus(null);
      // Clear selections after showing thank-you
      setComment("");
      return;
    }

    // Positive sentiment: do not open windows here (anchor handles navigation)
    // Determine phone/id for attribution (prefer customer.phone, else ?id)
    const targetCustomerId = customer?.id || "";
    const phone = customer?.phone || idFromUrl || undefined;
    const message = `Public positive rating: ${rating} star${
      rating && rating > 1 ? "s" : ""
    }`;
    // Generate a shared feedback id for both local and server saves
    const feedbackId = `fb_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    // Persist locally so the current session dashboard updates
    addFeedback(
      targetCustomerId,
      message,
      "positive",
      phone,
      rating || undefined,
      feedbackId
    );
    try {
      window.dispatchEvent(new CustomEvent("dash:feedback:changed"));
    } catch {}
    // Persist remotely so other devices see the count
    if (tenantKey) {
      try {
        // Use Firebase config for SMS server URL
        const url = await getSmsServerUrl().then((base) => `${base}/feedback`);

        // Requirement 4: Use clientId from URL or session storage or localStorage
        const companyId =
          clientIdFromUrl ||
          sessionStorage.getItem("feedbackClientId") ||
          localStorage.getItem("companyId") ||
          undefined;

        console.log(
          `[FeedbackPage] 📤 Submitting positive feedback to: ${url}`
        );
        console.log(`[FeedbackPage] companyId: ${companyId}`);
        console.log(`[FeedbackPage] tenantKey: ${tenantKey}`);

        // Fallback: try to get tenantKey from URL if not provided
        const finalTenantKey =
          tenantKey ||
          new URLSearchParams(window.location.search).get("tenantKey") ||
          "demo";
        console.log(`[FeedbackPage] finalTenantKey: ${finalTenantKey}`);

        const payload = {
          tenantKey: finalTenantKey, // Use fallback
          sentiment: "positive",
          text: message,
          phone,
          rating: rating || undefined,
          customerId: targetCustomerId || undefined,
          id: feedbackId,
          companyId: companyId, // Requirement 4: Include clientId
        };

        console.log(
          `[FeedbackPage] 📦 Payload:`,
          JSON.stringify(payload).substring(0, 200)
        );

        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then(async (res) => {
            if (!res.ok) {
              const text = await res.text().catch(() => "");
              console.error(
                `[FeedbackPage] ❌ Server error: ${res.status}`,
                text
              );
            } else {
              console.log(`[FeedbackPage] ✅ Positive feedback submitted`);
            }
          })
          .catch((err) => {
            console.error(`[FeedbackPage] ❌ Network error:`, err);
          });
      } catch (err) {
        console.error(`[FeedbackPage] ❌ Outer catch:`, err);
      }
    }
    setQuickStatus(null);
  };

  const handleSubmit = (custId: string) => {
    if (!newFeedbackText.trim()) return alert("Please enter feedback text.");
    addFeedback(
      custId,
      newFeedbackText.trim(),
      feedbackType,
      undefined,
      undefined,
      undefined
    );
    // If positive, redirect to Google review link to encourage leaving an official review
    if (feedbackType === "positive" && googleReviewLink) {
      // open in new tab
      window.open(googleReviewLink, "_blank");
    }
    setNewFeedbackText("");
  };

  // --- Reply Modal handler ---
  const handleSendReply = (message: string) => {
    // Implement SMS/WhatsApp reply logic here
    // For now, just close the modal
    setReplyModal({ open: false, phone: "" });
    // Optionally show a toast/notification
  };

  // --- Delete Feedback handler ---
  const handleDeleteFeedback = (entry: Entry) => {
    // Implement feedback deletion logic here
    // For now, just close the modal
    setDeleteModal({ open: false, entry: null });
    // Optionally show a toast/notification
    // You may want to call a prop or update state to remove the entry
  };

  // Dedicated form-first layout when no specific sentiment filter is chosen (public feedback entry page)
  if (!feedbackType) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-12">
        <div className="w-full max-w-2xl">
          {/* Card */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 sm:p-8">
            {!submitted && (
              <>
                <h1 className="text-2xl font-bold text-gray-900 text-center">
                  Share your experience
                </h1>
                <p className="text-center text-gray-600 mt-2">
                  How would you rate our service?
                </p>

                {/* Stars */}
                <div className="mt-6 flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setRating(n);
                        setSubmitted(false);
                        setQuickStatus(null);

                        // Show popup for 4-5 star ratings encouraging Google review
                        if (n >= 4 && googleReviewLink) {
                          // Ask user immediately; open link synchronously to
                          // avoid popup blockers preventing a new tab/window.
                          const confirmed = window.confirm(
                            "🌟 Thank you for the amazing rating! \n\nWould you like to share your positive experience on Google? It helps us a lot!"
                          );
                          if (confirmed) {
                            // Open the prepared positive target (strip id to avoid leaking)
                            const target =
                              positiveTargetHref || googleReviewLink;
                            try {
                              window.open(target, "_blank");
                            } catch (openErr) {
                              // Fallback: navigate in same window as last resort
                              window.location.href = target;
                            }
                          }
                        }
                      }}
                      className={`text-3xl transition-transform ${
                        rating && n <= rating
                          ? "text-yellow-400"
                          : "text-gray-300"
                      } hover:scale-110`}
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Positive CTA */}
            {rating !== null && rating >= 4 && (
              <div className="mt-8 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-5 text-center">
                <h2 className="text-lg font-semibold text-emerald-800">
                  We'd love your review online
                </h2>
                <p className="mt-1 text-emerald-700">
                  Please share your experience on our chosen review site — it
                  helps us a lot!
                </p>
                {hasPositiveLink ? (
                  <a
                    href={positiveTargetHref}
                    target="_blank"
                    rel="noreferrer"
                    onMouseDown={handlePositiveMouseDown}
                    className="inline-flex items-center justify-center mt-4 px-5 py-3 rounded-md bg-emerald-600 text-white font-medium shadow hover:bg-emerald-700"
                    title={`Open review link: ${positiveTargetHref}`}
                  >
                    Write a review
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center justify-center mt-4 px-5 py-3 rounded-md bg-emerald-600 text-white font-medium shadow opacity-60 cursor-not-allowed"
                    title="Add your review link in Settings to enable this"
                  >
                    Write a review
                  </button>
                )}
              </div>
            )}

            {/* Negative follow-up */}
            {rating !== null && rating <= 3 && !submitted && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleQuickSubmit();
                }}
                className="mt-8"
              >
                <div className="bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 border-2 border-red-200 rounded-2xl p-8 shadow-lg">
                  {/* Header Section with Emoji and Message */}
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-100 to-orange-100 rounded-full mb-4 shadow-md">
                      <span className="text-4xl">😔</span>
                    </div>
                    <h2 className="text-2xl font-bold text-red-900 mb-3">
                      We're sorry to hear that
                    </h2>
                  </div>

                  {/* Textarea Section */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-bold text-red-900 mb-3 flex items-center gap-2">
                        <svg
                          className="w-5 h-5 text-red-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Tell us more about your experience
                        <span className="text-red-600">*</span>
                      </label>
                      <div className="relative">
                        <textarea
                          rows={5}
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          maxLength={500}
                          className="w-full border-2 border-red-300 rounded-xl p-4 focus:outline-none focus:ring-4 focus:ring-red-200 focus:border-red-500 bg-white shadow-inner placeholder-red-400/70 text-gray-900 transition-all duration-200 resize-none"
                          placeholder="Please share specific details about what didn't work well. Your insights help us serve you better in the future."
                        />
                        {/* Character Counter - positioned inside textarea */}
                        <div className="absolute bottom-3 right-3 text-xs font-medium text-gray-500 bg-white/90 px-2 py-1 rounded-md shadow-sm">
                          {comment.length}/500
                        </div>
                      </div>
                    </div>

                    {/* Privacy Notice & Submit Button */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4">
                      {/* Privacy Notice */}
                      <div className="flex items-start gap-2 text-xs text-red-700 bg-white/60 backdrop-blur-sm px-3 py-2 rounded-lg border border-red-200">
                        <svg
                          className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <div>
                          <span className="font-semibold">Privacy note:</span>{" "}
                          Your feedback goes directly to our improvement team
                        </div>
                      </div>

                      {/* Submit Button */}
                      <button
                        type="submit"
                        className="group px-8 py-3.5 rounded-xl bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white font-bold shadow-lg hover:shadow-xl hover:from-red-700 hover:via-red-800 hover:to-red-900 transform hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        <span>Send Feedback</span>
                        <svg
                          className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Error Status Message */}
                    {quickStatus && (
                      <div className="bg-white border-2 border-red-300 rounded-xl p-4 shadow-md animate-shake">
                        <div className="flex items-start gap-3">
                          <svg
                            className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <p className="text-sm text-red-800 font-semibold flex-1">
                            {quickStatus}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </form>
            )}

            {/* Thank-you card for negative submissions */}
            {submitted && (
              <div className="mt-8 text-center">
                <div className="mx-auto w-full max-w-xl">
                  {/* Success Animation Container */}
                  <div className="relative bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 rounded-2xl border-2 border-amber-200 shadow-xl p-10">
                    {/* Decorative circles */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/30 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-200/30 rounded-full blur-3xl"></div>

                    {/* Content */}
                    <div className="relative z-10">
                      {/* Icon with animation */}
                      <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-100 to-yellow-100 rounded-full mb-6 shadow-lg animate-bounce-slow">
                        <span className="text-5xl">🙏</span>
                      </div>

                      {/* Success Message */}
                      <h3 className="text-3xl font-bold text-amber-900 mb-4">
                        Thank you so much!
                      </h3>
                      <p className="text-lg text-amber-800 leading-relaxed mb-6 max-w-md mx-auto">
                        We truly appreciate your feedback. Our team will review
                        it and use it to improve our service.
                      </p>

                      {/* Success Icon Row */}
                      <div className="flex items-center justify-center gap-4 mb-6">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-amber-300 shadow-sm">
                          <svg
                            className="w-5 h-5 text-green-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="text-sm font-semibold text-amber-900">
                            Feedback received
                          </span>
                        </div>
                      </div>

                      {/* Additional info */}
                      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-amber-200">
                        <div className="flex items-start gap-3 text-left">
                          <svg
                            className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <p className="text-sm text-amber-800">
                            <span className="font-semibold">
                              What happens next?
                            </span>
                            <br />
                            Your feedback will be reviewed by our customer
                            success team within 24-48 hours.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Sentiment-filtered (internal/admin) view layout
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 p-6 lg:p-10">
      {/* Enhanced Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <div className="flex flex-col md:flex-row items-center gap-4">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="px-5 py-2.5 rounded-xl bg-white border-2 border-gray-200 text-gray-700 font-bold hover:bg-gray-50 hover:border-gray-300 shadow-md hover:shadow-lg transition-all duration-200 text-base flex items-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-red-100 to-orange-100 rounded-2xl shadow-lg">
                <svg
                  className="w-7 h-7 text-red-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-red-800 tracking-tight flex items-center gap-3">
                  Negative Reviews
                  <span className="px-4 py-1.5 rounded-full bg-red-600 text-white text-lg font-bold border-2 border-red-700 shadow-md">
                    {totalCount}
                  </span>
                </h1>
                <p className="text-red-700 text-sm mt-1 font-medium">
                  Showing {filteredCount} of {totalCount} negative review(s)
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* Enhanced Filter Controls */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <svg
                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search name, phone, or text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 h-12 rounded-xl border-2 border-gray-300 focus:ring-4 focus:ring-red-200 focus:border-red-400 text-base bg-white transition-all duration-200"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
              <svg
                className="w-5 h-5 text-gray-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
              </svg>
              <span className="text-gray-700 text-sm font-medium">Sort:</span>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="bg-transparent border-none focus:ring-0 text-base font-semibold text-gray-900 cursor-pointer"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSortOrder("newest");
                  setPage(1);
                  setFiltersNotice("✓ Filters cleared");
                  setTimeout(() => setFiltersNotice(null), 2000);
                }}
                className="px-4 h-11 rounded-xl border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Clear
              </button>
              {onClearNegative && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        "⚠️ Delete all negative feedback?\n\nThis action cannot be undone. All negative reviews will be permanently removed."
                      )
                    ) {
                      onClearNegative();
                      setFiltersNotice("✓ All negative feedback cleared");
                      setTimeout(() => setFiltersNotice(null), 2000);
                    }
                  }}
                  className="px-4 h-11 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white font-bold hover:from-red-700 hover:to-red-800 shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Clear Data
                </button>
              )}
              <button
                type="button"
                onClick={exportCsv}
                className="px-4 h-11 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {filtersNotice && (
          <div className="text-center text-xs text-gray-500 mb-4">
            {filtersNotice}
          </div>
        )}
        {filteredCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 px-4">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center mb-6 shadow-inner">
              <span className="text-6xl">😕</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              No reviews found
            </h3>
            <p className="text-gray-500 text-center max-w-md mb-6">
              {searchQuery
                ? "Try adjusting your search or filters to find what you're looking for."
                : "When customers leave negative feedback, it will appear here."}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSortOrder("newest");
                  setPage(1);
                }}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold hover:from-red-700 hover:to-orange-700 shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paged.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-2xl border-2 border-red-100 p-6 shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 group relative flex flex-col min-h-[240px]"
              >
                {/* Header with Profile Icon */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-6 h-6 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 text-lg truncate">
                      {isPublicBucketId(r.customerId)
                        ? "Anonymous"
                        : r.name || `ID: ${r.customerId}`}
                    </div>
                    {r.phone && (
                      <div className="flex items-center gap-1.5 text-sm text-gray-600 mt-1">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                        {r.phone}
                      </div>
                    )}
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-sm">
                    Negative
                  </span>
                </div>

                {/* Date */}
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {new Date(r.date).toLocaleString()}
                </div>

                {/* Feedback Text */}
                <div className="flex-1 mb-4">
                  <div className="text-gray-800 leading-relaxed whitespace-pre-line bg-gray-50 rounded-lg p-3 border border-gray-200">
                    {r.text && r.text.length > 180
                      ? r.text.slice(0, 180) + "…"
                      : r.text}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setSelected(r)}
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 hover:from-gray-200 hover:to-gray-300 transition-all duration-200 flex items-center justify-center gap-1.5"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setReplyModal({ open: true, phone: r.phone || "" })
                    }
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    title="Reply via SMS/WhatsApp"
                    disabled={!r.phone}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                      />
                    </svg>
                    Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteModal({ open: true, entry: r })}
                    className="px-3 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center"
                    title="Delete feedback"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Enhanced Details Modal */}
        {selected && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setSelected(null)}
            ></div>
            <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border-2 border-red-200 overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-start gap-4 px-6 py-5 bg-gradient-to-r from-red-50 to-orange-50 border-b-2 border-red-200">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-7 h-7 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {isPublicBucketId(selected.customerId)
                      ? "Anonymous Customer"
                      : selected.name || `Customer ID: ${selected.customerId}`}
                  </h3>
                  {selected.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                      {selected.phone}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-600 mt-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {new Date(selected.date).toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  className="p-2.5 rounded-xl hover:bg-white transition-colors duration-200 text-gray-600 hover:text-red-600 flex-shrink-0"
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-700">
                    Feedback Details
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-sm">
                    Negative Review
                  </span>
                </div>
                <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border-2 border-red-200 max-h-96 overflow-auto">
                  <p className="text-gray-900 leading-relaxed whitespace-pre-line text-base">
                    {selected.text}
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t-2 border-gray-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    if (selected.phone) {
                      setReplyModal({ open: true, phone: selected.phone });
                    }
                  }}
                  disabled={!selected.phone}
                  className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                    />
                  </svg>
                  Reply to Customer
                </button>
                <button
                  type="button"
                  className="px-5 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-100 hover:border-gray-400 transition-all duration-200"
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackPage;
