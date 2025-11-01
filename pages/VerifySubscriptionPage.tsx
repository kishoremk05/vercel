import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import {
  getFirebaseDb,
  getFirebaseAuth,
  initializeFirebase,
} from "../lib/firebaseClient";

const VerifySubscriptionPage: React.FC = () => {
  const [status, setStatus] = useState<
    "checking" | "has-plan" | "no-plan" | "error"
  >("checking");
  const [message, setMessage] = useState("Verifying your account...");

  useEffect(() => {
    let mounted = true;

    const checkSubscription = async () => {
      try {
        // Initialize Firebase
        initializeFirebase();
        const auth = getFirebaseAuth();

        // Wait for auth to be ready (with timeout)
        await new Promise<void>((resolve) => {
          if (auth.currentUser) return resolve();
          const unsub = auth.onAuthStateChanged((user: any) => {
            if (user) {
              try {
                unsub();
              } catch {}
              return resolve();
            }
          });
          // Timeout after 10 seconds
          setTimeout(() => {
            try {
              unsub();
            } catch {}
            resolve();
          }, 10000);
        });

        if (!mounted) return;

        const currentUser = auth.currentUser;
        if (!currentUser) {
          setStatus("error");
          setMessage("Authentication failed. Redirecting to login...");
          setTimeout(() => {
            window.location.href = "/auth";
          }, 2000);
          return;
        }

        const clientId = currentUser.uid;

        // Store clientId in localStorage
        try {
          localStorage.setItem("companyId", clientId);
          localStorage.setItem("clientId", clientId);
          localStorage.setItem("auth_uid", clientId);
        } catch {}

        if (!mounted) return;
        setMessage("Checking your subscription...");

        // Check if user already has a plan in Firestore
        const db = getFirebaseDb();
        const profileRef = doc(db, "clients", clientId, "profile", "main");
        const snap = await getDoc(profileRef);

        if (!mounted) return;

        if (snap.exists()) {
          const data = snap.data();
          const hasPlan = !!(
            data?.planId ||
            data?.planName ||
            data?.status === "active"
          );
          const hasCredits =
            Number(data?.remainingCredits || data?.smsCredits || 0) > 0;

          if (hasPlan || hasCredits) {
            // User already has a plan
            setStatus("has-plan");
            setMessage(
              "Active subscription found! Redirecting to dashboard..."
            );

            // Store subscription in localStorage
            try {
              localStorage.setItem(
                "subscription",
                JSON.stringify({ ...data, companyId: clientId })
              );
              localStorage.setItem(
                "profile_subscription_present",
                JSON.stringify({ companyId: clientId, ts: Date.now() })
              );
            } catch {}

            // Redirect to dashboard after a short delay
            setTimeout(() => {
              window.location.href = "/dashboard";
            }, 1500);
            return;
          }
        }

        // No plan found - redirect to payment page
        if (!mounted) return;
        setStatus("no-plan");
        setMessage("No subscription found. Redirecting to payment...");

        setTimeout(() => {
          window.location.href = "/payment";
        }, 1500);
      } catch (error: any) {
        console.error("[VerifySubscription] Error:", error);
        if (!mounted) return;
        setStatus("error");
        setMessage(
          "Verification failed. Redirecting to payment page as fallback..."
        );
        setTimeout(() => {
          window.location.href = "/payment";
        }, 2000);
      }
    };

    checkSubscription();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6 text-center">
          {/* Loading/Status Icon */}
          <div className="flex justify-center">
            {status === "checking" && (
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center animate-pulse">
                <svg
                  className="w-10 h-10 text-white animate-spin"
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
              </div>
            )}
            {status === "has-plan" && (
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center animate-bounce">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            )}
            {status === "no-plan" && (
              <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            )}
            {status === "error" && (
              <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-white"
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
              </div>
            )}
          </div>

          {/* Status Message */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">
              {status === "checking" && "Verifying Account"}
              {status === "has-plan" && "Welcome Back!"}
              {status === "no-plan" && "Setup Required"}
              {status === "error" && "Verification Error"}
            </h1>
            <p className="text-lg text-gray-600">{message}</p>
          </div>

          {/* Progress Indicator */}
          {status === "checking" && (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6">
              <div className="space-y-3 text-left text-sm text-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span>Authenticating user...</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse animation-delay-200"></div>
                  <span>Checking subscription status...</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse animation-delay-400"></div>
                  <span>Preparing your dashboard...</span>
                </div>
              </div>
            </div>
          )}

          {status === "has-plan" && (
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 text-left">
              <div className="space-y-2 text-sm text-green-700">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Active subscription detected</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>SMS credits available</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Loading dashboard...</span>
                </div>
              </div>
            </div>
          )}

          {status === "no-plan" && (
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 text-left">
              <div className="space-y-2 text-sm text-yellow-700">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-yellow-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>No active subscription found</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-yellow-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  <span>Redirecting to payment page...</span>
                </div>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 text-left">
              <p className="text-sm text-red-700">
                We encountered an issue verifying your subscription. You'll be
                redirected to the payment page to complete your setup.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifySubscriptionPage;
