import React, { useEffect, useState } from "react";
import { Page } from "../types";
import {
  DashboardIcon,
  SettingsIcon,
  BriefcaseIcon,
  SparklesIcon,
  MessageIcon,
} from "./icons";
import { logout } from "../lib/firebaseAuth";

interface TopNavProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  businessName: string;
  email: string;
}

const TopNav: React.FC<TopNavProps> = ({
  currentPage,
  setCurrentPage,
  businessName,
  email,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Shared sign-out handler to show a toast and redirect after a short delay
  const handleSignOut = async () => {
    try {
      console.log("[TopNav] Signing out (shared)...");
      await logout();

      // Clear additional localStorage keys
      try {
        localStorage.removeItem("firebaseUser");
        localStorage.removeItem("adminSession");
        localStorage.removeItem("token");
        localStorage.removeItem("adminToken");
      } catch {}

      setToastMessage("Signed out");
      // Allow toast to display briefly before redirecting
      setTimeout(() => {
        window.location.href = "/auth";
      }, 800);
    } catch (error) {
      console.error("[TopNav] Sign out failed (shared):", error);
      // Fallback: clear storage and redirect
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
      setToastMessage("Signed out");
      setTimeout(() => {
        window.location.href = "/auth";
      }, 600);
    }
  };

  // Firebase removed. Use props only.
  const displayedEmail = email || "";
  // Generate text-based avatar showing email initials (not random images)
  const getInitials = (email: string): string => {
    if (!email) return "U";
    const name = email.split("@")[0];
    const parts = name.split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get Firebase user photo from localStorage - check immediately and on every render
  const [displayedPhoto, setDisplayedPhoto] = React.useState<string | null>(
    () => {
      // Initialize with photo from localStorage if available
      try {
        const userData = localStorage.getItem("firebaseUser");
        if (userData) {
          const user = JSON.parse(userData);
          if (user.photoURL) {
            console.log("[TopNav] Initial photo URL:", user.photoURL);
            return user.photoURL;
          }
        }
      } catch (e) {
        console.error("[TopNav] Failed to parse Firebase user data:", e);
      }
      return null;
    }
  );

  React.useEffect(() => {
    const updatePhoto = () => {
      try {
        const userData = localStorage.getItem("firebaseUser");
        if (userData) {
          const user = JSON.parse(userData);
          // Use photoURL directly from Firebase Auth user object
          if (user.photoURL) {
            console.log("[TopNav] Found photo URL:", user.photoURL);
            setDisplayedPhoto(user.photoURL);
          } else {
            console.log("[TopNav] No photoURL found in user data");
            setDisplayedPhoto(null);
          }
        }
      } catch (e) {
        console.error("[TopNav] Failed to parse Firebase user data:", e);
      }
    };

    // Update immediately
    updatePhoto();

    // Listen for storage changes (in case user data is updated)
    window.addEventListener("storage", updatePhoto);

    // Poll every 500ms for faster real-time updates
    const interval = setInterval(updatePhoto, 500);

    return () => {
      window.removeEventListener("storage", updatePhoto);
      clearInterval(interval);
    };
  }, [email]);

  // Memoize avatar URLs to prevent recreation on every render
  const { avatarSmallUrl, avatarLargeUrl } = React.useMemo(() => {
    const initials = getInitials(displayedEmail);
    return {
      avatarSmallUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(
        initials
      )}&size=32&background=4f46e5&color=fff&bold=true`,
      avatarLargeUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(
        initials
      )}&size=40&background=4f46e5&color=fff&bold=true`,
    };
  }, [displayedEmail]);

  const [avatarSmallSrc, setAvatarSmallSrc] = useState<string>(avatarSmallUrl);
  const [avatarLargeSrc, setAvatarLargeSrc] = useState<string>(avatarLargeUrl);

  // Update avatar URLs when email changes
  useEffect(() => {
    setAvatarSmallSrc(displayedPhoto || avatarSmallUrl);
    setAvatarLargeSrc(displayedPhoto || avatarLargeUrl);
  }, [displayedPhoto, avatarSmallUrl, avatarLargeUrl]);

  // Close user menu on Escape for accessibility
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowUserMenu(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navItems = [
    { id: Page.Dashboard, label: "Dashboard", icon: DashboardIcon },
    { id: Page.Settings, label: "Messenger", icon: SettingsIcon },
    { id: Page.Profile, label: "Profile", icon: BriefcaseIcon },
  ];

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 bg-white shadow-sm border-b border-gray-100"
      style={{ background: "linear-gradient(180deg, #fff 90%, #f8fafc 100%)" }}
    >
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="flex h-14 sm:h-16 items-center justify-between">
          {/* Brand - smaller icon */}
          <div
            className="flex items-center gap-1.5 sm:gap-2 cursor-pointer select-none"
            onClick={() => setCurrentPage(Page.Dashboard)}
            role="button"
            aria-label="Go to Dashboard"
          >
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl shadow ring-1 ring-indigo-300/30">
              <BriefcaseIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-black" />
            </div>
            <span className="text-base sm:text-lg lg:text-xl font-extrabold text-gray-900 tracking-tight">
              ReputationFlow
            </span>
          </div>
          {/* Normal horizontal nav */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2 ml-4 lg:ml-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={String(item.id)}
                  onClick={() => setCurrentPage(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-1.5 lg:gap-2 px-2 lg:px-4 py-1.5 lg:py-2 rounded-full text-sm lg:text-base font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                    isActive
                      ? "bg-white text-indigo-700 shadow-sm border border-gray-200"
                      : "text-gray-500 hover:text-indigo-700 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden lg:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>
          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg
              className="h-6 w-6 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {isMobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
          {/* Right actions */}
          <div className="hidden md:flex items-center gap-2 lg:gap-3">
            {/* Current Plan + SMS Status */}
            <SubscriptionStatusBadge />
            <CurrentPlanBadge />
            <div className="hidden lg:flex items-center relative">
              <button
                onClick={() => setShowUserMenu((s) => !s)}
                aria-expanded={showUserMenu}
                aria-haspopup="true"
                className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-50 border border-gray-200 hover:shadow-sm transition-colors"
              >
                <img
                  src={avatarSmallSrc}
                  onError={() => {
                    // If UI Avatars fails, use fallback with email initials
                    const initials = getInitials(displayedEmail);
                    setAvatarSmallSrc(
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        initials
                      )}&size=32&background=6366f1&color=fff&bold=true`
                    );
                  }}
                  alt="User"
                  className="h-7 w-7 rounded-full ring-1 ring-gray-200"
                />
                <div className="hidden xl:flex flex-col text-left leading-tight">
                  <span className="text-sm font-semibold text-gray-700 truncate">
                    {displayedEmail || "Account"}
                  </span>
                  <span className="text-xs text-gray-500 truncate">
                    {businessName || "Workspace"}
                  </span>
                </div>
                <span className="text-base font-semibold text-gray-700 xl:hidden">
                  Account
                </span>
                <svg
                  className="h-4 w-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Simple dropdown showing email and a sign-out placeholder */}
              {showUserMenu && (
                <div className="absolute right-0 mt-3 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-2">
                  <div className="px-3 py-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {displayedEmail || "user@example.com"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {businessName || "Workspace"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowUserMenu(false)}
                      aria-label="Close"
                      title="Close"
                      className="p-1.5 rounded-md text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
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
                  <div className="border-t border-gray-100" />
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      handleSignOut();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Toast (shows briefly on sign-out) */}
        {toastMessage && (
          <div className="fixed right-4 top-20 z-50">
            <div className="bg-black text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in">
              {toastMessage}
            </div>
          </div>
        )}

        {/* Modern Mobile Menu (animated overlay) */}
        <div
          className={`lg:hidden fixed left-0 right-0 top-14 z-40 transform transition-transform duration-250 ease-in-out ${
            isMobileMenuOpen
              ? "translate-y-0 opacity-100"
              : "-translate-y-2 opacity-0 pointer-events-none"
          }`}
          style={{ backdropFilter: isMobileMenuOpen ? "blur(4px)" : undefined }}
        >
          <div className="mx-3 bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="flex flex-col gap-2 px-2 py-2">
              {/* Mobile menu header with close button */}
              <div className="flex items-center justify-between w-full px-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white shadow ring-1 ring-indigo-200/30">
                    <BriefcaseIcon className="h-4 w-4 text-black" />
                  </div>
                  <span className="font-extrabold text-base text-gray-900">
                    ReputationFlow
                  </span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label="Close menu"
                  className="p-2 rounded-md bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                  title="Close"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
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
              {/* Mobile Navigation Pills */}
              <div className="flex flex-col gap-1 bg-gray-50 rounded-2xl p-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  return (
                    <button
                      key={String(item.id)}
                      onClick={() => {
                        setCurrentPage(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                        isActive
                          ? "bg-white text-gray-900 shadow-md"
                          : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 transition-colors ${
                          isActive ? "text-indigo-600" : "text-gray-400"
                        }`}
                      />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Mobile User Section */}
              <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-200/60 mt-2">
                <img
                  src={avatarLargeSrc}
                  onError={() => {
                    // If UI Avatars fails, use fallback with email initials
                    const initials = getInitials(displayedEmail);
                    setAvatarLargeSrc(
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        initials
                      )}&size=40&background=6366f1&color=fff&bold=true`
                    );
                  }}
                  alt="User"
                  className="h-10 w-10 rounded-full ring-2 ring-white shadow-sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {displayedEmail || "user@example.com"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {businessName || "Workspace"}
                  </p>
                </div>
              </div>

              {/* Mobile Sign out button */}
              <div className="px-3 mt-3 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleSignOut();
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl bg-red-50 text-red-700 font-semibold hover:bg-red-100"
                >
                  Sign out
                </button>
              </div>

              {/* Settings removed from mobile menu by request */}
            </div>
          </div>
        </div>
      </div>

      {/* Modern Animated Bottom Border */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent">
        <div className="h-full w-1/3 bg-gradient-to-r from-indigo-500 to-purple-500 animate-[slide_8s_ease-in-out_infinite]" />
      </div>
    </header>
  );
};

export default TopNav;

// Current Plan Badge - shows the active subscription plan
const CurrentPlanBadge: React.FC = () => {
  const [planName, setPlanName] = React.useState<string>("");

  React.useEffect(() => {
    const fetchPlanName = async () => {
      try {
        const companyId = localStorage.getItem("companyId");
        if (!companyId) return;

        // Try to get from localStorage first
        const cached = localStorage.getItem("subscription");
        if (cached) {
          const sub = JSON.parse(cached);
          if (sub && sub.planName) {
            setPlanName(sub.planName);
            return;
          }
        }

        // Fetch from API
        const smsServerUrl = localStorage.getItem("smsServerUrl");
        if (!smsServerUrl) return;

        const response = await fetch(
          `${smsServerUrl}/api/subscription?companyId=${companyId}`
        );
        const data = await response.json();

        if (data.success && data.subscription) {
          setPlanName(data.subscription.planName || "");
          // Cache it
          localStorage.setItem(
            "subscription",
            JSON.stringify(data.subscription)
          );
        }
      } catch (error) {
        console.error("[CurrentPlanBadge] Error fetching plan:", error);
      }
    };

    fetchPlanName();

    // Refresh every 30 seconds
    const interval = setInterval(fetchPlanName, 30000);

    // Listen for subscription updates
    const handler = () => fetchPlanName();
    window.addEventListener("subscription:updated", handler);

    return () => {
      clearInterval(interval);
      window.removeEventListener("subscription:updated", handler);
    };
  }, []);

  if (!planName) return null;

  return (
    <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 border border-green-200">
      <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1" />
      <span className="text-sm font-semibold text-emerald-700">{planName}</span>
    </div>
  );
};

// Lightweight inline component to display SMS remaining (format: "SMS Left: 120/250")
const SubscriptionStatusBadge: React.FC = () => {
  const [sub, setSub] = React.useState<any>(() => {
    try {
      const raw = localStorage.getItem("subscription");
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const companyId = localStorage.getItem("companyId");
        if (!companyId) return;

        const smsServerUrl = localStorage.getItem("smsServerUrl");
        if (!smsServerUrl) return;

        const response = await fetch(
          `${smsServerUrl}/api/subscription?companyId=${companyId}`
        );
        const data = await response.json();

        if (data.success && data.subscription) {
          setSub(data.subscription);
          localStorage.setItem(
            "subscription",
            JSON.stringify(data.subscription)
          );
        }
      } catch (error) {
        console.error(
          "[SubscriptionStatusBadge] Error fetching subscription:",
          error
        );
      }
    };

    // Initial fetch
    fetchSubscription();

    // Listen for storage changes
    const handler = () => {
      try {
        const raw = localStorage.getItem("subscription");
        if (raw) setSub(JSON.parse(raw));
      } catch {}
    };

    window.addEventListener("storage", handler);
    window.addEventListener("subscription:updated", fetchSubscription);

    // Refresh every 30 seconds
    const id = setInterval(fetchSubscription, 30000);

    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("subscription:updated", fetchSubscription);
      clearInterval(id);
    };
  }, []);

  if (!sub || sub.status !== "active") return null;

  const remaining = sub.remainingCredits ?? sub.smsCredits ?? 0;
  const total = sub.smsCredits ?? 0;

  return (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200">
      <span className="h-2 w-2 rounded-full bg-indigo-500" />
      <span className="text-xs font-semibold text-indigo-700 whitespace-nowrap">
        SMS Left: {remaining}/{total}
      </span>
    </div>
  );
};
