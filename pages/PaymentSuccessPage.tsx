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
    // Save selected plan to Firestore and set planInfo
    const saveSubscription = async () => {
      try {
        initializeFirebase();
        const auth = getFirebaseAuth();
        // Wait for auth
        const waitForAuth = (authObj: any, timeoutMs = 15000) =>
          new Promise<void>((resolve) => {
            if (authObj.currentUser) return resolve();
            const unsubscribe = authObj.onAuthStateChanged((user: any) => {
              if (user) {
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
        await waitForAuth(auth, 10000);
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        const urlParams = new URLSearchParams(window.location.search);
        // Support clientId/companyId and planId in URL
        let planId =
          urlParams.get("plan") || urlParams.get("planId") || undefined;
        let planSource = "url";
        // Accept both clientId and companyId for flexibility
        let clientId =
          urlParams.get("clientId") || urlParams.get("companyId") || undefined;
        if (!planId) {
          planId = localStorage.getItem("pendingPlan") || undefined;
          if (planId) planSource = "localStorage";
        }
        // Always get sessionId/subscription_id from URL
        const sessionId =
          urlParams.get("sessionId") ||
          urlParams.get("subscription_id") ||
          urlParams.get("subscriptionId") ||
          urlParams.get("id") ||
          urlParams.get("sid") ||
          urlParams.get("session") ||
          undefined;

        // If both clientId/companyId and planId are present, fetch canonical plan from server
        if (clientId && planId) {
          try {
            const resp = await fetch(
              `/api/subscription?companyId=${encodeURIComponent(clientId)}`
            );
            if (resp.ok) {
              const j = await resp.json();
              const s = j.subscription || j.session || j.data || j;
              // Find the plan in the response that matches planId, or just use the returned plan
              let matchedPlan = s;
              if (Array.isArray(s) && planId) {
                matchedPlan =
                  s.find(
                    (p: any) =>
                      p.planId === planId ||
                      p.plan === planId ||
                      p.planName === planId
                  ) || s[0];
              }
              if (
                matchedPlan &&
                (matchedPlan.planId || matchedPlan.planName || matchedPlan.plan)
              ) {
                planId =
                  matchedPlan.planId ||
                  matchedPlan.plan ||
                  matchedPlan.planName;
                planSource = "server-clientId";
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
                // Always use planId from URL for plan details
                const plan = planMapping[planId] || {
                  name:
                    matchedPlan.planName ||
                    matchedPlan.planId ||
                    matchedPlan.plan ||
                    "",
                  sms:
                    matchedPlan.smsCredits || matchedPlan.remainingCredits || 0,
                  months: matchedPlan.durationMonths || 1,
                };
                setPlanInfo({
                  planName: plan.name,
                  smsCredits: plan.sms,
                  months: plan.months,
                  planId: planId,
                });
                setPlanDebug({ source: planSource, value: planId });
                // Write to Firestore using clientId from URL if present, else currentUser.uid
                try {
                  const db = getFirebaseDb();
                  const profileRef = doc(
                    db,
                    "clients",
                    clientId || currentUser.uid,
                    "profile",
                    "main"
                  );
                  const profilePayload: any = {
                    planId: planId,
                    planName: plan.name,
                    planSource: planSource, // debug: server-clientId
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
                  // Notify client that subscription was updated so ProfilePage refreshes
                  try {
                    window.localStorage.setItem(
                      "profile_subscription_present",
                      JSON.stringify({
                        companyId: clientId || currentUser.uid,
                        ts: Date.now(),
                      })
                    );
                  } catch {}
                  try {
                    window.dispatchEvent(new Event("subscription:updated"));
                  } catch {}
                } catch (e) {
                  console.warn(
                    "[PaymentSuccess] Failed to write fetched plan to Firestore profile:",
                    e
                  );
                }
              }
            }
          } catch (e) {
            // ignore
          }
        } else if (!planId && sessionId) {
          // If planId is missing but sessionId is present, fetch plan details from server
          try {
            const resp = await fetch(
              `/api/subscription?sessionId=${encodeURIComponent(sessionId)}`
            );
            if (resp.ok) {
              const j = await resp.json();
              const s = j.subscription || j.session || j.data || j;
              if (s && (s.planId || s.planName || s.plan)) {
                planId = s.planId || s.plan || s.planName;
                planSource = "server";
                // Map planId to plan details
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
                const plan = planMapping[planId] || {
                  name: s.planName || s.planId || s.plan || "",
                  sms: s.smsCredits || s.remainingCredits || 0,
                  months: s.durationMonths || 1,
                };
                setPlanInfo({
                  planName: plan.name,
                  smsCredits: plan.sms,
                  months: plan.months,
                  planId: planId,
                });
                setPlanDebug({ source: planSource, value: planId });
                // Write to Firestore
                try {
                  const db = getFirebaseDb();
                  const profileRef = doc(
                    db,
                    "clients",
                    currentUser.uid,
                    "profile",
                    "main"
                  );
                  const profilePayload: any = {
                    planId: planId,
                    planName: plan.name,
                    planSource: planSource, // debug: server
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
                  // Notify client that subscription was updated so ProfilePage refreshes
                  try {
                    window.localStorage.setItem(
                      "profile_subscription_present",
                      JSON.stringify({
                        companyId: currentUser.uid,
                        ts: Date.now(),
                      })
                    );
                  } catch {}
                  try {
                    window.dispatchEvent(new Event("subscription:updated"));
                  } catch {}
                } catch (e) {
                  console.warn(
                    "[PaymentSuccess] Failed to write fetched plan to Firestore profile:",
                    e
                  );
                }
              }
            }
          } catch (e) {
            // ignore
          }
        } else {
          setPlanDebug({ source: planSource, value: planId });
          if (planId) {
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
            // Write to Firestore using clientId from URL if present, else currentUser.uid
            try {
              const db = getFirebaseDb();
              const profileRef = doc(
                db,
                "clients",
                clientId || currentUser.uid,
                "profile",
                "main"
              );
              const profilePayload: any = {
                planId: planId,
                planName: plan.name,
                planSource: planSource, // debug: url or localStorage
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
              // Notify client that subscription was updated so ProfilePage refreshes
              try {
                window.localStorage.setItem(
                  "profile_subscription_present",
                  JSON.stringify({
                    companyId: clientId || currentUser.uid,
                    ts: Date.now(),
                  })
                );
              } catch {}
              try {
                window.dispatchEvent(new Event("subscription:updated"));
              } catch {}
            } catch (e) {
              console.warn(
                "[PaymentSuccess] Failed to write selected plan to Firestore profile:",
                e
              );
            }
          }
        }

        // If we have a dodo session/subscription id, attempt to call the server
        // claim endpoint so the server webhook/fallback logic can reconcile and
        // persist the canonical subscription (clients/{companyId}/profile/main).
        if (sessionId) {
          try {
            // Try to get an ID token to allow the server to derive ownership
            let token: string | null = null;
            try {
              token = await waitForAuthToken(5000);
            } catch {}

            const claimHeaders: any = { "Content-Type": "application/json" };
            if (token) claimHeaders.Authorization = `Bearer ${token}`;

            // POST /api/subscription/claim { sessionId }
            await fetch(`/api/subscription/claim`, {
              method: "POST",
              headers: claimHeaders,
              body: JSON.stringify({ sessionId }),
            }).catch(() => null);

            // After attempting claim, notify UI to refresh subscription info
            try {
              window.dispatchEvent(new Event("subscription:updated"));
            } catch {}

            // Poll the server subscription endpoint for the sessionId (or companyId)
            // This helps when webhook processing is slightly delayed.
            const pollForSubscription = async (
              sid: string | undefined,
              cid?: string
            ) => {
              if (!sid && !cid) return null;
              const base = ""; // relative URL works with same origin
              const timeoutMs = 15000; // total wait time
              const intervalMs = 1000;
              const maxTries = Math.ceil(timeoutMs / intervalMs);
              let tries = 0;
              while (tries < maxTries) {
                try {
                  const q = sid
                    ? `/api/subscription?sessionId=${encodeURIComponent(sid)}`
                    : cid
                    ? `/api/subscription?companyId=${encodeURIComponent(cid)}`
                    : ``;
                  const resp = await fetch(q).catch(() => null as any);
                  if (resp && resp.ok) {
                    const j = await resp.json().catch(() => ({} as any));
                    const sub =
                      j && (j.subscription || j.session || j.data || null);
                    // Some endpoints return { success:true, subscription: {...} }
                    if (
                      j &&
                      (j.subscription || (j.success && j.subscription))
                    ) {
                      const s = j.subscription;
                      // update serverPlan and planInfo to display immediately
                      setServerPlan({
                        plan: s.planName || s.planId || s.plan || null,
                        price: s.price || s.amount || null,
                        companyId: j.companyId || s.companyId || cid || null,
                        userEmail: j.userEmail || s.userEmail || null,
                      });
                      try {
                        // merge into planInfo if not already set
                        if (!planInfo || !planInfo.planId) {
                          setPlanInfo((prev) => ({
                            planName:
                              s.planName ||
                              s.planId ||
                              (prev && prev.planName) ||
                              "",
                            smsCredits:
                              s.smsCredits ||
                              s.remainingCredits ||
                              (prev && prev.smsCredits) ||
                              0,
                            months: s.durationMonths || prev?.months || 1,
                            planId: s.planId || s.plan || prev?.planId || "",
                          }));
                        }
                      } catch {}
                      try {
                        localStorage.setItem(
                          "profile_subscription_present",
                          JSON.stringify({
                            companyId:
                              j.companyId || s.companyId || cid || null,
                            ts: Date.now(),
                          })
                        );
                      } catch {}
                      try {
                        window.dispatchEvent(new Event("subscription:updated"));
                      } catch {}
                      return s;
                    }
                    // Some servers return subscription directly at top-level
                    if (j && (j.plan || j.planId || j.planName)) {
                      const s = j;
                      setServerPlan({
                        plan: s.planName || s.planId || s.plan || null,
                        price: s.price || s.amount || null,
                        companyId: s.companyId || cid || null,
                        userEmail: s.userEmail || null,
                      });
                      try {
                        setPlanInfo((prev) => ({
                          planName:
                            s.planName ||
                            s.planId ||
                            (prev && prev.planName) ||
                            "",
                          smsCredits:
                            s.smsCredits ||
                            s.remainingCredits ||
                            (prev && prev.smsCredits) ||
                            0,
                          months: s.durationMonths || prev?.months || 1,
                          planId: s.planId || s.plan || prev?.planId || "",
                        }));
                      } catch {}
                      try {
                        localStorage.setItem(
                          "profile_subscription_present",
                          JSON.stringify({
                            companyId: s.companyId || cid || null,
                            ts: Date.now(),
                          })
                        );
                      } catch {}
                      try {
                        window.dispatchEvent(new Event("subscription:updated"));
                      } catch {}
                      return s;
                    }
                  }
                } catch (e) {
                  // ignore and retry
                }
                tries++;
                await new Promise((r) => setTimeout(r, intervalMs));
              }
              return null;
            };

            // Start polling but don't block the UI flow
            pollForSubscription(sessionId, currentUser.uid).catch(() => null);
          } catch (e) {
            // non-fatal
          }
        }
      } catch (error) {
        console.error("Error saving subscription:", error);
      }
    };
    const savePromise = saveSubscription();

    // Fetch server-side subscription plan data (if available)
    const urlParams = new URLSearchParams(window.location.search);
    const companyId = urlParams.get("companyId");
    if (companyId) {
      fetch(`/api/subscription?companyId=${companyId}`)
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
