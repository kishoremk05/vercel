import React, { useEffect, useState } from "react";
import { getSmsServerUrl } from "../lib/firebaseConfig";
import {
  getFirebaseDb,
  getFirebaseAuth,
  initializeFirebase,
} from "../lib/firebaseClient";
import { doc, setDoc, Timestamp, getDoc, updateDoc } from "firebase/firestore";

const PaymentSuccessPage: React.FC = () => {
  const [countdown, setCountdown] = useState(5);
  const [planInfo, setPlanInfo] = useState<{
    planName: string;
    smsCredits: number;
  } | null>(null);

  useEffect(() => {
    // Extract plan info from URL params and save subscription
    const saveSubscription = async () => {
      try {
        // Ensure Firebase App is initialized before using Auth/Firestore
        initializeFirebase();
        // Use helper to wait for auth to be restored (hosted checkout redirects can be slow)
        const auth = getFirebaseAuth();
        const waitForAuth = (authObj: any, timeoutMs = 15000) =>
          new Promise<void>((resolve) => {
            if (authObj.currentUser) return resolve();
            const unsubscribe = authObj.onAuthStateChanged((user: any) => {
              if (user) {
                console.log("[PaymentSuccess] Auth state ready:", user.uid);
                try {
                  unsubscribe();
                } catch {}
                return resolve();
              }
            });
            setTimeout(() => {
              try {
                unsubscribe();
              } catch {}
              return resolve();
            }, timeoutMs);
          });

        await waitForAuth(auth, 10000); // wait up to 10s
        let currentUser = auth.currentUser;
        console.log("[PaymentSuccess] Auth state:", {
          authenticated: !!currentUser,
          uid: currentUser?.uid,
          email: currentUser?.email,
        });
        if (!currentUser) {
          console.warn(
            "[PaymentSuccess] Warning: auth not available after wait; Firestore writes may fail"
          );
        }

        const urlParams = new URLSearchParams(window.location.search);
        const planId =
          urlParams.get("plan") || localStorage.getItem("pendingPlan");
        const companyId = localStorage.getItem("companyId");

        console.log("[PaymentSuccess] Starting subscription save:", {
          planId,
          companyId,
        });

        if (!planId || !companyId) {
          console.error(
            "❌ Missing plan or companyId, skipping subscription save"
          );
          return;
        }

        // Map plan to SMS credits and name
        const planMapping: Record<
          string,
          { name: string; sms: number; months: number }
        > = {
          starter_1m: { name: "Starter", sms: 250, months: 1 },
          monthly: { name: "Starter", sms: 250, months: 1 },
          growth_3m: { name: "Growth", sms: 600, months: 3 },
          quarterly: { name: "Growth", sms: 600, months: 3 },
          pro_6m: { name: "Professional", sms: 900, months: 6 },
          halfyearly: { name: "Professional", sms: 900, months: 6 },
        };

        const plan = planMapping[planId];
        if (!plan) {
          console.warn("Unknown plan:", planId);
          return;
        }

        setPlanInfo({ planName: plan.name, smsCredits: plan.sms });

        // Save subscription to server; server should persist to Firestore
        // (admin write) so other browsers/devices can read it without client
        // authentication. We'll POST then GET the saved subscription to build
        // a reliable local snapshot.
        const base = await getSmsServerUrl().catch(() => "");
        if (!base) console.warn("[PaymentSuccess] No API base available");
        try {
          const response = await fetch(`${base}/api/subscription`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companyId,
              planId,
              smsCredits: plan.sms,
              durationMonths: plan.months,
              status: "active",
            }),
          });

          const data = await response.json().catch(() => ({}));
          if (data && data.success) {
            console.log("✅ Subscription saved on server (billing)");

            // Try to read back the subscription from the server (billing doc
            // or profile doc) so we can set a canonical local snapshot.
            try {
              const getResp = await fetch(
                `${base}/api/subscription?companyId=${encodeURIComponent(
                  companyId
                )}`
              );
              const getJson = await getResp.json().catch(() => ({}));
              if (getJson && getJson.success && getJson.subscription) {
                const s = getJson.subscription;
                console.log("[PaymentSuccess] Server subscription:", s);

                // Normalize subscription data into snapshot shape
                const snap = {
                  planId: s.planId || planId,
                  planName: s.planName || plan.name,
                  smsCredits: Number(s.smsCredits || s.remainingCredits || plan.sms),
                  remainingCredits: Number(s.remainingCredits || s.smsCredits || plan.sms),
                  status: s.status || "active",
                  // handle various date formats: ISO string or Firestore timestamp
                  activatedAt: s.startDate
                    ? new Date(s.startDate).getTime()
                    : s.activatedAt && s.activatedAt._seconds
                    ? s.activatedAt._seconds * 1000
                    : Date.now(),
                  expiryAt: s.endDate
                    ? new Date(s.endDate).getTime()
                    : s.expiryAt && s.expiryAt._seconds
                    ? s.expiryAt._seconds * 1000
                    : Date.now() + plan.months * 30 * 24 * 60 * 60 * 1000,
                };
                localStorage.setItem("subscriptionSnapshot", JSON.stringify(snap));
                localStorage.setItem("hasPaid", "true");
                localStorage.removeItem("pendingPlan");
                console.log("✅ Local snapshot saved from server response");
              } else {
                console.warn("[PaymentSuccess] No subscription returned from server GET");
              }
            } catch (getErr) {
              console.warn("[PaymentSuccess] Failed to GET subscription from server:", getErr);
            }
          } else {
            console.error("Failed to save subscription on server:", data.error || data);
          }
        } catch (e) {
          console.error("Error posting subscription to server:", e);
        }

        // Save subscription to Firebase Firestore for cross-device persistence
        // (Client-side write). Only attempt if the user is authenticated in
        // this browser; otherwise rely on the server-admin write done earlier.
        console.log("[PaymentSuccess] Client-side Firebase save attempt...", {
          companyId,
          planId,
        });
        try {
          const db = getFirebaseDb();
          const auth = getFirebaseAuth();
          const currentUser = auth.currentUser;
          if (!currentUser) {
            console.warn(
              "[PaymentSuccess] Skipping client-side Firestore write, user not authenticated in this browser"
            );
          } else {

          // First, ensure the client document has auth_uid set
          const clientRef = doc(db, "clients", companyId);
          try {
            const clientDoc = await getDoc(clientRef);
            if (clientDoc.exists()) {
              const clientData = clientDoc.data();
              console.log(
                "[PaymentSuccess] Client document exists:",
                clientData
              );

              // Update auth_uid if missing or different
              if (
                !clientData.auth_uid ||
                clientData.auth_uid !== currentUser.uid
              ) {
                console.log(
                  "[PaymentSuccess] Updating client auth_uid:",
                  currentUser.uid
                );
                await updateDoc(clientRef, { auth_uid: currentUser.uid });
                console.log("✅ Client auth_uid updated");
              }
            } else {
              console.log(
                "[PaymentSuccess] Client document doesn't exist, creating it"
              );
              await setDoc(clientRef, {
                auth_uid: currentUser.uid,
                email: currentUser.email,
                createdAt: Timestamp.now(),
              });
              console.log("✅ Client document created");
            }
          } catch (clientError: any) {
            console.error("❌ Failed to update client document:", clientError);
            // Continue anyway - maybe permissions allow subscription write
          }

          const activatedAt = Date.now();
          // Calculate expiry date based on plan duration
          const expiryAt = activatedAt + plan.months * 30 * 24 * 60 * 60 * 1000;

          const subscriptionData = {
            planId,
            planName: plan.name,
            smsCredits: plan.sms,
            remainingCredits: plan.sms,
            status: "active",
            activatedAt: Timestamp.fromMillis(activatedAt),
            expiryAt: Timestamp.fromMillis(expiryAt),
            price:
              plan.name === "Starter" ? 30 : plan.name === "Growth" ? 75 : 100,
            savedAt: Timestamp.now(),
            userId: currentUser.uid,
            userEmail: currentUser.email,
          };

          // Save to Firebase under clients/{companyId}/profile/main (NEW PATH)
          const profileRef = doc(db, "clients", companyId, "profile", "main");

          console.log(
            "[PaymentSuccess] Saving to path:",
            `clients/${companyId}/profile/main`
          );
          console.log("[PaymentSuccess] Data to save:", subscriptionData);
          console.log("[PaymentSuccess] Current user:", {
            uid: currentUser.uid,
            email: currentUser.email,
          });

          try {
            // Use setDoc with merge so the document is created if it doesn't exist
            await setDoc(profileRef, subscriptionData, { merge: true });
            console.log(
              "✅✅✅ Subscription saved to Firebase profile/main successfully!"
            );
          } catch (writeError: any) {
            console.error(
              "[PaymentSuccess] Failed to write subscription to Firestore:",
              writeError
            );
            if (writeError?.code === "permission-denied") {
              console.error(
                "[PaymentSuccess] Firestore permission-denied: check security rules and ensure the authenticated user is authorized to write to clients/{companyId}/profile/main"
              );
            }
            throw writeError;
          }

          // Also keep local snapshot for immediate fallback
          const snapshot = {
            planId,
            planName: plan.name,
            smsCredits: plan.sms,
            remainingCredits: plan.sms,
            status: "active",
            activatedAt,
            expiryAt,
          };
          localStorage.setItem(
            "subscriptionSnapshot",
            JSON.stringify(snapshot)
          );
          localStorage.setItem("hasPaid", "true");
          localStorage.removeItem("pendingPlan");
          console.log("✅ localStorage snapshot saved");
        }
        } catch (e: any) {
          console.error(
            "❌❌❌ CRITICAL: Failed to save subscription to Firebase:",
            e
          );
          console.error("Error details:", {
            message: e.message,
            code: e.code,
            stack: e.stack,
          });

          // Still save to localStorage as fallback
          try {
            const activatedAt = Date.now();
            const expiryAt =
              activatedAt + plan.months * 30 * 24 * 60 * 60 * 1000;
            const snapshot = {
              planId,
              planName: plan.name,
              smsCredits: plan.sms,
              remainingCredits: plan.sms,
              status: "active",
              activatedAt,
              expiryAt,
            };
            localStorage.setItem(
              "subscriptionSnapshot",
              JSON.stringify(snapshot)
            );
            localStorage.setItem("hasPaid", "true");
            localStorage.removeItem("pendingPlan");
            console.log(
              "✅ Fallback: localStorage snapshot saved despite Firebase error"
            );
          } catch (localError) {
            console.error("❌ Even localStorage save failed:", localError);
          }
        }
      } catch (error) {
        console.error("Error saving subscription:", error);
      }
    };

    saveSubscription();

    // Auto-redirect to dashboard after 5 seconds
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = "/dashboard";
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleGoToDashboard = () => {
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6 text-center">
          {/* Success Icon */}
          <div className="flex justify-center">
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
          </div>

          {/* Success Message */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">
              Payment Successful! 🎉
            </h1>
            <p className="text-lg text-gray-600">
              {planInfo
                ? `${planInfo.planName} is now active`
                : "Your subscription is now active"}
            </p>
          </div>

          {/* Details */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Welcome to</p>
                <p className="font-semibold text-gray-900">ReputationFlow</p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-3 space-y-2 text-sm text-gray-700">
              <div className="flex justify-between">
                <span>✅ Subscription activated</span>
              </div>
              {planInfo && (
                <div className="flex justify-between">
                  <span>✅ {planInfo.smsCredits} SMS credits loaded</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>✅ Dashboard ready</span>
              </div>
            </div>
          </div>

          {/* Countdown */}
          <div className="text-sm text-gray-500">
            Redirecting to dashboard in{" "}
            <span className="font-bold text-green-600">{countdown}</span> second
            {countdown !== 1 ? "s" : ""}...
          </div>

          {/* Action Button */}
          <button
            onClick={handleGoToDashboard}
            className="w-full py-3 px-6 rounded-lg bg-gradient-to-r from-gray-900 to-gray-700 text-white font-semibold hover:from-gray-800 hover:to-gray-600 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <span>Go to Dashboard Now</span>
            <svg
              className="w-5 h-5"
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
          </button>

          {/* Additional Info */}
          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              A confirmation email has been sent to your registered email
              address.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;
