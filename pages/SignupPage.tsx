import React, { useState } from "react";
import { signupWithEmail, signupWithGoogle } from "../lib/firebaseAuth";

interface SignupPageProps {
  onSignupSuccess: (role: string) => void;
}

const SignupPage: React.FC<SignupPageProps> = ({ onSignupSuccess }) => {
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agentCode, setAgentCode] = useState(""); // Optional marketing/agent code
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!name || !email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Sign up with Firebase
      const { user, clientId } = await signupWithEmail(email, password, name);

      // Store auth_uid (which is now the clientId/companyId) and email in localStorage
      const authUid = user.uid; // Firebase Auth UID
      localStorage.setItem("companyId", authUid); // Use auth_uid for data isolation
      localStorage.setItem("clientId", authUid); // Use auth_uid for data isolation
      localStorage.setItem("userEmail", user.email || "");
      localStorage.setItem("auth_uid", authUid); // Store auth_uid explicitly
      if (agentCode.trim()) {
        localStorage.setItem("agentCode", agentCode.trim()); // Store agent code if provided
      }

      // Remove any cached subscription that belongs to a different
      // company id or only matches by email — treat Google sign-up as a
      // potential re-creation and avoid inheriting someone else's
      // subscription state.
      try {
        const raw = localStorage.getItem("subscription");
        if (raw) {
          const sub = JSON.parse(raw || "{}");
          const subCompany =
            sub.companyId || sub.clientId || sub.client || null;
          const subEmail = (sub.userEmail || sub.email || "").toLowerCase();
          const currEmail = (user.email || "").toLowerCase();
          const companyMismatch =
            subCompany && String(subCompany) !== String(authUid);
          const emailMatchOnly =
            !subCompany && subEmail && subEmail === currEmail;
          if (companyMismatch || emailMatchOnly) {
            try {
              localStorage.removeItem("subscription");
              localStorage.removeItem("profile_subscription_present");
              localStorage.removeItem("pendingPlan");
            } catch {}
          }
        }
      } catch (e) {
        // ignore
      }

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

      // Clear any previous local subscription/pending flags that don't
      // belong to this new user so they start with a clean slate. If a
      // cached subscription belongs to a different companyId (or only
      // matches by email) treat this as a re-created/deleted account and
      // clear the cached subscription so the new account does not inherit
      // the previous owner's subscription state.
      try {
        const raw = localStorage.getItem("subscription");
        if (raw) {
          const sub = JSON.parse(raw || "{}");
          const subCompany =
            sub.companyId || sub.clientId || sub.client || null;
          const subEmail = (sub.userEmail || sub.email || "").toLowerCase();
          const currEmail = (user.email || "").toLowerCase();
          const companyMismatch =
            subCompany && String(subCompany) !== String(authUid);
          const emailMatchOnly =
            !subCompany && subEmail && subEmail === currEmail;
          if (companyMismatch || emailMatchOnly) {
            try {
              localStorage.removeItem("subscription");
              localStorage.removeItem("profile_subscription_present");
              localStorage.removeItem("pendingPlan");
            } catch {}
          }
        }
      } catch (e) {
        // ignore
      }

      // Navigate to verification page to check if user already has a plan
      const target = "/verify-subscription";
      window.history.pushState({ page: target }, "", target);
      onSignupSuccess("client");
    } catch (err: any) {
      setError(err.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setLoading(true);
    setError("");

    try {
      const { user, clientId } = await signupWithGoogle();

      // Store auth_uid (which is now the clientId/companyId) and email in localStorage
      const authUid = user.uid; // Firebase Auth UID
      localStorage.setItem("companyId", authUid); // Use auth_uid for data isolation
      localStorage.setItem("clientId", authUid); // Use auth_uid for data isolation
      localStorage.setItem("userEmail", user.email || "");
      localStorage.setItem("auth_uid", authUid); // Store auth_uid explicitly
      if (agentCode.trim()) {
        localStorage.setItem("agentCode", agentCode.trim()); // Store agent code if provided
      }

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

      // Navigate to verification page to check if user already has a plan
      const target = "/verify-subscription";
      window.history.pushState({ page: target }, "", target);
      onSignupSuccess("client");
    } catch (err: any) {
      setError(err.message || "Google signup failed. Please try again.");
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
                  <path d="M6.25 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM3.25 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122zM19.75 7.5a.75.75 0 00-1.5 0v2.25H16a.75.75 0 000 1.5h2.25v2.25a.75.75 0 001.5 0v-2.25H22a.75.75 0 000-1.5h-2.25V7.5z" />
                </svg>
              </span>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-gray-900">
                  Create your account
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  Get started with automated customer feedback and grow your
                  business
                </p>
              </div>
            </div>
          </div>

          {/* Signup Card */}
          <div
            className="gradient-border glow-on-hover premium-card bg-white/60 backdrop-blur-md shadow p-4 sm:p-5 lg:p-6 transition-all duration-300 hover:shadow-md rounded-xl sm:rounded-2xl"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.55)" }}
          >
            <button
              type="button"
              disabled={loading}
              className="w-full bg-white border border-gray-200 text-gray-700 py-2 sm:py-2.5 rounded-lg font-semibold hover:bg-gray-50 mb-3 sm:mb-4 flex items-center justify-center gap-2 transition text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleGoogleSignup}
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
              <span className="font-medium">Sign up with Google</span>
            </button>
            <div className="text-center text-gray-400 mb-2 text-xs sm:text-sm">
              or
            </div>

            {error && (
              <div className="mb-2 sm:mb-3 text-red-600 text-xs sm:text-sm text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-2.5 sm:mb-3">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 sm:py-2 text-sm sm:text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900/20 transition bg-white shadow-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="John Doe"
                />
              </div>
              <div className="mb-2.5 sm:mb-3">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 sm:py-2 text-sm sm:text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900/20 transition bg-white shadow-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@email.com"
                />
              </div>
              <div className="mb-2.5 sm:mb-3">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 sm:py-2 text-sm sm:text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900/20 transition bg-white shadow-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>
              <div className="mb-2.5 sm:mb-3">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 sm:py-2 text-sm sm:text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900/20 transition bg-white shadow-sm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>
              <div className="mb-3 sm:mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Agent Code{" "}
                  <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 sm:py-2 text-sm sm:text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900/20 transition bg-white shadow-sm"
                  value={agentCode}
                  onChange={(e) => setAgentCode(e.target.value)}
                  placeholder="Enter agent/referral code"
                />
                <p className="mt-1 text-xs text-gray-500">
                  For marketing tracking purposes
                </p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 transition text-sm lg:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>

            {/* Link to login page */}
            <div className="mt-3 sm:mt-4 text-center text-xs sm:text-sm text-gray-600">
              Already have an account?{" "}
              <button
                onClick={() => {
                  window.history.pushState({ page: "/auth" }, "", "/auth");
                  window.location.reload();
                }}
                className="text-gray-900 font-semibold hover:underline"
              >
                Sign in
              </button>
            </div>
          </div>

          {/* Footer note */}
          <p className="text-center text-[10px] sm:text-xs text-gray-500">
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
