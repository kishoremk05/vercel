import React, { useState } from "react";
import * as auth from "firebase/auth";
import { getFirebaseAuth } from "../lib/firebaseClient";

interface AdminAuthPageProps {
  onAuthSuccess: () => void;
}

const AdminAuthPage: React.FC<AdminAuthPageProps> = ({ onAuthSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Temporary demo login shortcut for local development
      const isLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      if (isLocalhost && email === "admin@demo.com" && password === "admin") {
        // Create a short-lived demo token and store it
        const demoToken = "DEMO_ADMIN_TOKEN_LOCALHOST";
        localStorage.setItem("adminToken", demoToken);
        localStorage.setItem("adminEmail", email);
        console.log("✅ Demo admin logged in (localhost)");
        onAuthSuccess();
        setIsLoading(false);
        return;
      }

      // Production / normal flow: Sign in with Firebase Auth
      const firebaseAuth = getFirebaseAuth();
      // Log payload for debugging network/400 errors coming from identitytoolkit
      try {
        console.log("[admin-login] attempting signInWithEmailAndPassword", {
          email,
        });
      } catch (e) {}

      // @ts-ignore
      const userCredential = await auth.signInWithEmailAndPassword(
        firebaseAuth,
        email,
        password
      );
      // Get the ID token for API requests
      const idToken = await userCredential.user.getIdToken();
      // Store the token for admin API requests
      localStorage.setItem("adminToken", idToken);
      localStorage.setItem("adminEmail", email);
      console.log("✅ Admin logged in successfully:", email);
      // Notify App to set admin auth state
      onAuthSuccess();
    } catch (err: any) {
      // Log extended Firebase error details for debugging (includes server response when available)
      try {
        console.error("❌ Admin login error:", err);
        console.error("❌ Admin login error - details:", {
          code: err?.code,
          message: err?.message,
          customData: err?.customData || null,
          serverResponse: err?.serverResponse || null,
        });
      } catch (e) {
        console.error("Error while logging admin auth error details", e);
      }

      const errorMessage = getAdminAuthErrorMessage(err?.code || "");
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Convert Firebase error codes to user-friendly messages for admin
  function getAdminAuthErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case "auth/user-not-found":
        return "Admin account not found. Please check your email.";
      case "auth/wrong-password":
        return "Incorrect password. Please try again.";
      case "auth/invalid-credential":
        return "Invalid admin credentials. Please try again.";
      case "auth/too-many-requests":
        return "Too many failed attempts. Please try again later.";
      case "auth/network-request-failed":
        return "Network error. Please check your connection.";
      case "auth/invalid-email":
        return "Invalid email format.";
      default:
        return "Login failed. Please check your credentials.";
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/20">
      {/* Animated background overlay */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 py-10">
        <div className="max-w-md mx-auto space-y-6 lg:space-y-8">
          {/* Header Card */}
          <div
            className="gradient-border premium-card bg-white/60 backdrop-blur-md shadow p-5 lg:p-6 transition-all duration-300 rounded-2xl"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.55)" }}
          >
            <div className="flex items-start gap-3">
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 text-white ring-2 ring-indigo-400/40 shadow-lg"
                style={{
                  boxShadow:
                    "0 0 20px rgba(99,102,241,0.4), 0 4px 6px -1px rgba(99,102,241,0.3)",
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path d="M8 4h8a3 3 0 013 3v10a3 3 0 01-3 3H8a3 3 0 01-3-3V7a3 3 0 013-3zm0 2a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V7a1 1 0 00-1-1H8z" />
                  <path d="M12 9a3 3 0 110 6 3 3 0 010-6z" />
                </svg>
              </span>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-gray-900">
                  Admin Login
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Restricted area. Authorized personnel only.
                </p>
              </div>
            </div>
          </div>

          {/* Auth Card */}
          <div
            className="gradient-border glow-on-hover premium-card bg-white/60 backdrop-blur-md shadow p-5 lg:p-6 transition-all duration-300 hover:shadow-md rounded-2xl"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.55)" }}
          >
            {error && (
              <div className="mb-3 text-red-600 text-sm text-center">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900/20 transition bg-white shadow-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@demo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900/20 transition bg-white shadow-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full px-5 py-2.5 rounded-lg font-semibold transition text-sm lg:text-base inline-flex items-center justify-center gap-2 ${
                  isLoading
                    ? "bg-gray-400 cursor-not-allowed text-white"
                    : "bg-gray-900 text-white hover:bg-gray-800"
                }`}
              >
                {isLoading ? (
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
                    Signing in...
                  </>
                ) : (
                  "Admin Login"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAuthPage;
