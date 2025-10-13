import React, { useState } from "react";
import { loginWithEmail, loginWithGoogle } from "../lib/firebaseAuth";

interface AuthPageProps {
  onAuthSuccess: (role: string) => void;
}
// Detect current route for minor UX differences (e.g., showing Google button)

const getCurrentRoute = () => {
  if (typeof window === "undefined") return "login";
  const path = window.location.pathname.toLowerCase();
  if (path.endsWith("/admin-login")) return "admin-login";
  if (path.endsWith("/login")) return "login";
  return "login"; // treat /auth and others as client login
};

const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  // Client-only login state
  const [error, setError] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPassword, setClientPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientEmail || !clientPassword) {
      setError("Please enter email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Login with Firebase
      const { user, clientId } = await loginWithEmail(
        clientEmail,
        clientPassword
      );

      // Store auth_uid (which is now the clientId/companyId) and email in localStorage
      const authUid = user.uid; // Firebase Auth UID
      localStorage.setItem("companyId", authUid); // Use auth_uid for data isolation
      localStorage.setItem("clientId", authUid); // Use auth_uid for data isolation
      localStorage.setItem("userEmail", user.email || "");
      localStorage.setItem("auth_uid", authUid); // Store auth_uid explicitly
      // Store Firebase user info (used by TopNav for photoURL)
      try {
        const u = {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || "",
          photoURL: (user as any).photoURL || null,
        };
        localStorage.setItem("firebaseUser", JSON.stringify(u));
      } catch {}

      // Dispatch auth ready event
      window.dispatchEvent(
        new CustomEvent("auth:ready", {
          detail: {
            companyId: authUid,
            clientId: authUid,
            email: user.email,
            auth_uid: authUid,
          },
        })
      );

      // Navigate to dashboard
      window.history.pushState({ page: "/dashboard" }, "", "/dashboard");
      onAuthSuccess("client");
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth
  const handleGoogleOAuth = async () => {
    setLoading(true);
    setError("");

    try {
      const { user, clientId } = await loginWithGoogle();

      // Store auth_uid (which is now the clientId/companyId) and email in localStorage
      const authUid = user.uid; // Firebase Auth UID
      localStorage.setItem("companyId", authUid); // Use auth_uid for data isolation
      localStorage.setItem("clientId", authUid); // Use auth_uid for data isolation
      localStorage.setItem("userEmail", user.email || "");
      localStorage.setItem("auth_uid", authUid); // Store auth_uid explicitly
      // Store Firebase user info (used by TopNav for photoURL)
      try {
        const u = {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || "",
          photoURL: (user as any).photoURL || null,
        };
        localStorage.setItem("firebaseUser", JSON.stringify(u));
      } catch {}

      // Dispatch auth ready event
      window.dispatchEvent(
        new CustomEvent("auth:ready", {
          detail: {
            companyId: authUid,
            clientId: authUid,
            email: user.email,
            auth_uid: authUid,
          },
        })
      );

      // Navigate to dashboard
      window.history.pushState({ page: "/dashboard" }, "", "/dashboard");
      onAuthSuccess("client");
    } catch (err: any) {
      setError(err.message || "Google login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20">
      {/* Animated background overlay */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* Back to Homepage Button - Top Left Corner */}
      <div className="relative">
        <div className="absolute top-3 left-3 sm:top-6 sm:left-6 z-10">
          <button
            onClick={() => {
              window.history.pushState({ page: "/" }, "", "/");
              window.location.reload();
            }}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white/60 backdrop-blur-md border border-gray-200 rounded-lg hover:bg-white/80 transition-all duration-200 shadow-sm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-3.5 h-3.5 sm:w-4 sm:h-4"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            Homepage
          </button>
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 min-h-screen flex items-center">
        <div className="max-w-md mx-auto space-y-4 sm:space-y-6 lg:space-y-8 w-full">
          {/* Header Card */}
          <div
            className="gradient-border premium-card bg-white/60 backdrop-blur-md shadow p-4 sm:p-5 lg:p-6 transition-all duration-300 rounded-xl sm:rounded-2xl"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.55)" }}
          >
            <div className="flex items-start gap-2 sm:gap-3">
              <span
                className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 text-white ring-2 ring-indigo-400/40 shadow-lg flex-shrink-0"
                style={{
                  boxShadow:
                    "0 0 20px rgba(99,102,241,0.4), 0 4px 6px -1px rgba(99,102,241,0.3)",
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-4 w-4 sm:h-5 sm:w-5"
                >
                  <path d="M5 7a3 3 0 013-3h8a3 3 0 013 3v10a3 3 0 01-3 3H8a3 3 0 01-3-3V7zm3-1a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V7a1 1 0 00-1-1H8z" />
                  <path d="M9 9h6v2H9V9zm0 4h6v2H9v-2z" />
                </svg>
              </span>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-gray-900">
                  Welcome back
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  Sign in to access your dashboard and messaging tools
                </p>
              </div>
            </div>
          </div>

          {/* Auth Card */}
          <div
            className="gradient-border glow-on-hover premium-card bg-white/60 backdrop-blur-md shadow p-4 sm:p-5 lg:p-6 transition-all duration-300 hover:shadow-md rounded-xl sm:rounded-2xl"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.55)" }}
          >
            {/* Client login only. Admin login is available at /admin-login and handled by a separate page. */}
            {getCurrentRoute() === "login" && (
              <>
                <button
                  type="button"
                  className="w-full bg-white border border-gray-200 text-gray-700 py-2 sm:py-2.5 rounded-lg font-semibold hover:bg-gray-50 mb-3 sm:mb-4 flex items-center justify-center gap-2 transition text-sm sm:text-base"
                  onClick={handleGoogleOAuth}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 48 48"
                    className="inline-block sm:w-5 sm:h-5"
                  >
                    <g>
                      <path
                        fill="#4285F4"
                        d="M43.6 20.5H42V20H24v8h11.3C34.7 32.1 30.1 35 24 35c-6.1 0-11.3-4.9-11.3-11S17.9 13 24 13c2.6 0 5 .8 6.9 2.3l6.5-6.5C33.7 5.5 29.1 3.5 24 3.5 12.7 3.5 3.5 12.7 3.5 24S12.7 44.5 24 44.5c10.7 0 19.5-8.7 19.5-19.5 0-1.3-.1-2.2-.3-3.5z"
                      />
                      <path
                        fill="#34A853"
                        d="M6.3 14.7l6.6 4.8C14.3 16.1 18.8 13 24 13c2.6 0 5 .8 6.9 2.3l6.5-6.5C33.7 5.5 29.1 3.5 24 3.5c-7.2 0-13.4 4.1-16.7 10.2z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M24 44.5c5.8 0 10.7-1.9 14.2-5.2l-6.6-5.4c-2 1.4-4.6 2.2-7.6 2.2-6.1 0-11.3-4.9-11.3-11 0-1.7.4-3.3 1-4.7l-6.6-5.1C5.1 25.2 8.9 44.5 24 44.5z"
                      />
                      <path
                        fill="#EA4335"
                        d="M43.6 20.5H42V20H24v8h11.3C34.7 32.1 30.1 35 24 35c-6.1 0-11.3-4.9-11.3-11S17.9 13 24 13c2.6 0 5 .8 6.9 2.3l6.5-6.5C33.7 5.5 29.1 3.5 24 3.5 12.7 3.5 3.5 12.7 3.5 24S12.7 44.5 24 44.5c10.7 0 19.5-8.7 19.5-19.5 0-1.3-.1-2.2-.3-3.5z"
                      />
                    </g>
                  </svg>
                  <span className="font-medium">Sign in with Google</span>
                </button>
                <div className="text-center text-gray-400 mb-2 text-xs sm:text-sm">
                  or
                </div>
              </>
            )}

            {error && (
              <div className="mb-2 sm:mb-3 text-red-600 text-xs sm:text-sm text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Client credentials form */}
              {getCurrentRoute() === "login" && (
                <>
                  <div className="mb-2.5 sm:mb-3">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 sm:py-2 text-sm sm:text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900/20 transition bg-white shadow-sm"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      required
                      placeholder="you@email.com"
                    />
                  </div>
                  <div className="mb-3 sm:mb-4">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 sm:py-2 text-sm sm:text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900/20 transition bg-white shadow-sm"
                      value={clientPassword}
                      onChange={(e) => setClientPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 transition text-sm lg:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Signing in..." : "Client Login"}
                  </button>
                </>
              )}
            </form>

            {/* Link to signup page */}
            {getCurrentRoute() === "login" && (
              <div className="mt-3 sm:mt-4 text-center text-xs sm:text-sm text-gray-600">
                Don't have an account?{" "}
                <button
                  onClick={() => {
                    // Client-side navigate to signup page without reloading
                    window.history.pushState(
                      { page: "/signup" },
                      "",
                      "/signup"
                    );
                    window.dispatchEvent(new PopStateEvent("popstate"));
                  }}
                  className="text-gray-900 font-semibold hover:underline"
                >
                  Sign up
                </button>
              </div>
            )}
          </div>

          {/* Footer note */}
          <p className="text-center text-[10px] sm:text-xs text-gray-500">
            Admin login is available at{" "}
            <span className="font-mono">/admin-login</span>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
