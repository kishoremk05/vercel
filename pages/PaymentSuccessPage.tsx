import React, { useEffect, useState } from "react";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import {
  initializeFirebase,
  getFirebaseAuth,
  getFirebaseDb,
} from "../lib/firebaseClient";
import { fetchClientProfile } from "../lib/dashboardFirebase";
import { waitForAuthToken } from "../lib/firebaseClient";

const PaymentSuccessPage: React.FC = () => {
  const [planInfo, setPlanInfo] = useState<{
    planName: string;
    smsCredits: number;
    months: number;
    planId: string;
  } | null>(null);
  const [planDebug, setPlanDebug] = useState<{
    source: string;
    value: string | undefined;
  } | null>(null);
  const [serverPlan, setServerPlan] = useState<{
    plan?: string;
    price?: number;
    companyId?: string;
    userEmail?: string;
  } | null>(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Check if payment actually succeeded - Dodo might redirect here even on failure
    const checkAndSave = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const status = urlParams.get("status") || urlParams.get("payment_status");
      const referrer = document.referrer || "";
      
      // If status is explicitly "failed" or "cancelled", redirect to cancel page
      if (status === "failed" || status === "cancelled" || status === "canceled") {
        console.log("[PaymentSuccess] Payment failed/cancelled, redirecting to cancel page");
        const clientId = urlParams.get("client_id") || urlParams.get("clientId") || urlParams.get("companyId");
        const planId = urlParams.get("plan_id") || urlParams.get("planId") || urlParams.get("plan");
        const cancelUrl = `/payment-cancel?client_id=${clientId || "unknown"}&plan_id=${planId || "unknown"}`;
        window.location.href = cancelUrl;
        return;
      }
      
      // If coming from Dodo failed page, redirect to cancel
      if (referrer.includes("dodopayments.com") && referrer.includes("/failed")) {
        console.log("[PaymentSuccess] Detected failed payment from Dodo, redirecting to cancel page");
        const clientId = urlParams.get("client_id") || urlParams.get("clientId") || urlParams.get("companyId");
        const planId = urlParams.get("plan_id") || urlParams.get("planId") || urlParams.get("plan");
        const cancelUrl = `/payment-cancel?client_id=${clientId || "unknown"}&plan_id=${planId || "unknown"}`;
        window.location.href = cancelUrl;
        return;
      }

      // Save selected plan to Firestore and set planInfo
      try {
        initializeFirebase();
        const auth = getFirebaseAuth();

        // wait for auth readiness (but do not block forever)
        await new Promise<void>((resolve) => {
          if (auth.currentUser) return resolve();
          const unsub = auth.onAuthStateChanged((u: any) => {
            if (u) {
              try {
                unsub();
              } catch {}
              return resolve();
            }
          });
          setTimeout(() => {
            try {
              unsub();
            } catch {}
            resolve();
          }, 10000);
        });

        const currentUser = auth.currentUser;
        const urlParams = new URLSearchParams(window.location.search);
        const planIdParam =
          urlParams.get("plan") ||
          urlParams.get("planId") ||
          urlParams.get("plan_id");
        const pending = localStorage.getItem("pendingPlan");
        let planId =
          (planIdParam as string) || (pending as string) || undefined;
        let planSource = planIdParam
          ? "url"
          : pending
          ? "localStorage"
          : "unknown";
        const clientId =
          urlParams.get("clientId") ||
          urlParams.get("companyId") ||
          urlParams.get("client_id") ||
          undefined;
        const sessionId =
          urlParams.get("sessionId") ||
          urlParams.get("subscription_id") ||
          urlParams.get("subscriptionId") ||
          urlParams.get("id") ||
          urlParams.get("sid") ||
          urlParams.get("session") ||
          undefined;

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

        // Helper: poll server for subscription by sessionId
        const pollForSubscription = async (sid?: string) => {
          if (!sid) return null;
          const timeoutMs = 15000;
          const intervalMs = 1000;
          const maxTries = Math.ceil(timeoutMs / intervalMs);
          let tries = 0;
          while (tries < maxTries) {
            try {
              const q = `/api/subscription?sessionId=${encodeURIComponent(
                sid
              )}`;
              const resp = await fetch(q).catch(() => null as any);
              if (resp && resp.ok) {
                const j = await resp.json().catch(() => ({} as any));
                const s = j.subscription || j.session || j.data || j;
                if (s && (s.planId || s.plan || s.planName || j.subscription)) {
                  return s;
                }
              }
            } catch {}
            tries++;
            await new Promise((r) => setTimeout(r, intervalMs));
          }
          return null;
        };

        // If we already know planId, show it and write to Firestore (if authenticated)
        if (planId) {
          const plan = planMapping[planId] || {
            name: planId,
            sms: 0,
            months: 1,
          };
          setPlanInfo({
            planName: plan.name,
            smsCredits: plan.sms,
            months: plan.months,
            planId,
          });
          setPlanDebug({ source: planSource, value: planId });
          if (currentUser) {
            try {
              const writeClientId = clientId || currentUser.uid;
              const db = getFirebaseDb();
              const profileRef = doc(
                db,
                "clients",
                writeClientId,
                "profile",
                "main"
              );
              const profilePayload: any = {
                planId,
                planName: plan.name,
                planSource,
                status: "active",
                smsCredits: plan.sms,
                remainingCredits: plan.sms,
                activatedAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
              };
              if (plan.months && Number(plan.months) > 0) {
                const months = Number(plan.months);
                const expiry = new Date();
                expiry.setMonth(expiry.getMonth() + months);
                profilePayload.expiryAt = Timestamp.fromDate(expiry);
              }
              if (sessionId) profilePayload.paymentSessionId = sessionId;
              await setDoc(profileRef, profilePayload, { merge: true });
              try {
                localStorage.setItem(
                  "profile_subscription_present",
                  JSON.stringify({ companyId: writeClientId, ts: Date.now() })
                );
              } catch {}
              try {
                window.dispatchEvent(new Event("subscription:updated"));
              } catch {}
            } catch (e) {
              console.warn(
                "[PaymentSuccess] Failed to write selected plan:",
                e
              );
            }
            return;
          }

          // Not authenticated: persist pending plan and clientId so the app can
          // complete the write after the user signs in (App auth listener will
          // propagate and Profile page listens for subscription:updated).
          try {
            if (planId) localStorage.setItem("pendingPlan", planId);
            if (clientId) localStorage.setItem("pendingClientId", clientId);
          } catch {}
          return;
        }

        // If no planId but we have a sessionId, attempt to claim and poll the server for canonical subscription
        if (!planId && sessionId) {
          try {
            let token: string | null = null;
            try {
              token = await waitForAuthToken(5000);
            } catch {}
            const claimHeaders: any = { "Content-Type": "application/json" };
            if (token) claimHeaders.Authorization = `Bearer ${token}`;
            await fetch(`/api/subscription/claim`, {
              method: "POST",
              headers: claimHeaders,
              body: JSON.stringify({ sessionId }),
            }).catch(() => null);

            const s = await pollForSubscription(sessionId);
            if (s) {
              const serverCompanyId = s.companyId || s.clientId || undefined;
              const serverPlanId =
                s.planId || s.plan || s.planName || undefined;
              const serverStatus = s.status || undefined;
              if (serverPlanId) {
                const plan = planMapping[serverPlanId] || {
                  name: s.planName || serverPlanId,
                  sms: s.smsCredits || 0,
                  months: s.durationMonths || 1,
                };
                setPlanInfo({
                  planName: plan.name,
                  smsCredits: plan.sms,
                  months: plan.months,
                  planId: serverPlanId,
                });
                setPlanDebug({ source: "server", value: serverPlanId });
                setServerPlan({
                  plan: plan.name,
                  price: s.price || s.amount || null,
                  companyId: serverCompanyId,
                  userEmail: s.userEmail || null,
                });
                // write to Firestore if we have an authenticated user or a serverCompanyId
                const writeClientId = serverCompanyId || currentUser?.uid;
                if (writeClientId) {
                  try {
                    const db = getFirebaseDb();
                    const profileRef = doc(
                      db,
                      "clients",
                      writeClientId,
                      "profile",
                      "main"
                    );
                    const profilePayload: any = {
                      planId: serverPlanId,
                      planName: plan.name,
                      planSource: "server",
                      status:
                        serverStatus === "active" || serverStatus === "paid"
                          ? "active"
                          : "active",
                      smsCredits: plan.sms,
                      remainingCredits: plan.sms,
                      activatedAt: Timestamp.now(),
                      updatedAt: Timestamp.now(),
                    };
                    if (plan.months && Number(plan.months) > 0) {
                      const months = Number(plan.months);
                      const expiry = new Date();
                      expiry.setMonth(expiry.getMonth() + months);
                      profilePayload.expiryAt = Timestamp.fromDate(expiry);
                    }
                    if (sessionId) profilePayload.paymentSessionId = sessionId;
                    await setDoc(profileRef, profilePayload, { merge: true });
                    try {
                      localStorage.setItem(
                        "profile_subscription_present",
                        JSON.stringify({
                          companyId: writeClientId,
                          ts: Date.now(),
                        })
                      );
                    } catch {}
                    try {
                      window.dispatchEvent(new Event("subscription:updated"));
                    } catch {}
                  } catch (e) {
                    console.warn(
                      "[PaymentSuccess] Failed to write server plan:",
                      e
                    );
                  }
                }
              }
            }
          } catch (e) {
            // ignore
          }
        }
      } catch (error) {
        console.error("Error saving subscription:", error);
      }
    };

    // Start the async check and save
    const savePromise = checkAndSave();

    // Fetch server-side subscription plan data (if available)
    const companyIdParam = new URLSearchParams(window.location.search).get("companyId");
    if (companyIdParam) {
      fetch(`/api/subscription?companyId=${companyIdParam}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && (data.plan || data.price)) {
            setServerPlan({
              plan: data.plan,
              price: data.price,
              companyId: data.companyId,
              userEmail: data.userEmail,
            });
          }
        })
        .catch(() => {});
    }

    // Start the redirect countdown once the save completes or after a short timeout
    const MAX_WAIT_MS = 5000;
    let cleanupTimer: (() => void) | null = null;
    const fetchLatestProfile = async () => {
      try {
        initializeFirebase();
        const auth = getFirebaseAuth();
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        const latest = await fetchClientProfile(currentUser.uid).catch(
          () => null
        );
        if (latest && (latest.planId || latest.planName)) {
          setPlanInfo({
            planName: latest.planName || latest.planId,
            smsCredits: latest.smsCredits || latest.remainingCredits || 0,
            months: latest.months || 1,
            planId: latest.planId || "",
          });
        }
      } catch {}
    };
    const startRedirectTimer = () => {
      const timer = setInterval(async () => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            fetchLatestProfile().then(() => {
              window.location.href = "/dashboard";
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    };
    Promise.race([
      savePromise.catch(() => null),
      new Promise((r) => setTimeout(r, MAX_WAIT_MS)),
    ]).then(() => {
      cleanupTimer = startRedirectTimer();
    });
    return () => {
      try {
        if (cleanupTimer) cleanupTimer();
      } catch {}
    };
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

          {/* Debug: Show plan source and value */}
          {planDebug && (
            <div className="mb-2 text-xs text-gray-500 text-left">
              Plan loaded from: <b>{planDebug.source}</b>{" "}
              {planDebug.value
                ? `(value: ${planDebug.value})`
                : "(no value found)"}
            </div>
          )}
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

            {planInfo && (
              <div className="border-t border-gray-200 pt-3 space-y-2 text-sm text-gray-700">
                <div className="flex justify-between">
                  <span>✅ Plan:</span>
                  <span className="font-semibold">
                    {planInfo.planName} ({planInfo.planId})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>✅ SMS Credits:</span>
                  <span className="font-semibold">{planInfo.smsCredits}</span>
                </div>
                <div className="flex justify-between">
                  <span>✅ Duration:</span>
                  <span className="font-semibold">
                    {planInfo.months} month{planInfo.months > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>✅ Subscription activated</span>
                </div>
                <div className="flex justify-between">
                  <span>✅ Dashboard ready</span>
                </div>
              </div>
            )}

            {/* Server-side plan details */}
            {serverPlan && (
              <div className="border-t border-green-200 pt-3 mt-3 space-y-2 text-sm text-green-700">
                <div className="flex justify-between">
                  <span>🔗 Server Plan:</span>
                  <span className="font-semibold">{serverPlan.plan}</span>
                </div>
                <div className="flex justify-between">
                  <span>💲 Price:</span>
                  <span className="font-semibold">{serverPlan.price}</span>
                </div>
                <div className="flex justify-between">
                  <span>🏢 Company ID:</span>
                  <span className="font-semibold">{serverPlan.companyId}</span>
                </div>
                <div className="flex justify-between">
                  <span>📧 User Email:</span>
                  <span className="font-semibold">{serverPlan.userEmail}</span>
                </div>
              </div>
            )}
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
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;
