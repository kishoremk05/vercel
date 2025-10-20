import React, { useEffect, useState } from "react";
import { getSmsServerUrl } from "../lib/firebaseConfig";
import {
  getFirebaseDb,
  getFirebaseAuth,
  initializeFirebase,
} from "../lib/firebaseClient";
import {
  doc,
  setDoc,
  Timestamp,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

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
        const currentUser = auth.currentUser;
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
        const planId = urlParams.get("plan") || undefined;
        // Session / subscription id from provider (try many param names)
        const sessionId =
          urlParams.get("sessionId") ||
          urlParams.get("subscription_id") ||
          urlParams.get("subscriptionId") ||
          urlParams.get("id") ||
          urlParams.get("sid") ||
          urlParams.get("session") ||
          undefined;
        // Will be set if we find a canonical subscription while waiting
        let found: any = null;
        // Keep companyId available to the rest of the function so we can
        // include it in the server POST payload if needed.
        let companyIdForPayload: string | null = null;
        // (sessionId is already declared above)

        console.log("[PaymentSuccess] Starting subscription save:", {
          planId,
        });

        if (!planId) {
          console.warn(
            "[PaymentSuccess] No planId in return URL. Will attempt to fetch canonical subscription from Firestore / API."
          );

          const getCompanyId = async () => {
            // Prefer a client-side stored companyId when available
            try {
              const stored = localStorage.getItem("companyId");
              if (stored) return stored;
            } catch {}

            // If user is authenticated, ask server for companyId via /auth/me
            if (currentUser) {
              try {
                const baseLocal = await getSmsServerUrl().catch(() => "");
                const idToken = await currentUser.getIdToken();
                if (!baseLocal) return null;
                const meResp = await fetch(`${baseLocal}/auth/me`, {
                  headers: { Authorization: `Bearer ${idToken}` },
                });
                if (!meResp.ok) return null;
                const meJson = await meResp.json().catch(() => ({}));
                return meJson.companyId || null;
              } catch (e) {
                console.warn(
                  "[PaymentSuccess] Failed to derive companyId from /auth/me:",
                  e
                );
                return null;
              }
            }
            return null;
          };

          const fetchSubscriptionByCompany = async (
            companyId: string | null
          ) => {
            if (!companyId) return null;
            // First try Firestore (client SDK) if available; this will work
            // even when the server API is temporarily unreachable.
            try {
              const db = getFirebaseDb();
              const profileRef = doc(
                db,
                "clients",
                companyId,
                "profile",
                "main"
              );
              const snap = await getDoc(profileRef);
              if (snap && snap.exists()) return snap.data();
            } catch (e) {
              console.warn("[PaymentSuccess] Firestore fetch failed:", e);
            }

            // Fallback to API GET
            try {
              const baseLocal = await getSmsServerUrl().catch(() => "");
              if (!baseLocal) return null;
              const res = await fetch(
                `${baseLocal}/api/subscription?companyId=${companyId}`
              );
              const json = await res.json().catch(() => ({}));
              if (json && json.success && json.subscription)
                return json.subscription;
            } catch (e) {
              console.warn(
                "[PaymentSuccess] API subscription fetch failed:",
                e
              );
            }
            return null;
          };

          // Try a few times (simple retry) to let webhook/admin writes finish
          found = null;
          companyIdForPayload = await getCompanyId();
          for (let i = 0; i < 4; i++) {
            found = await fetchSubscriptionByCompany(companyIdForPayload).catch(
              () => null
            );
            if (found) break;
            // wait before retrying
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, 2000));
          }
          if (found) {
            console.log(
              "[PaymentSuccess] Found canonical subscription:",
              found
            );
            try {
              setPlanInfo({
                planName: found.planName || found.planId,
                smsCredits: found.smsCredits || found.remainingCredits || 0,
              });
            } catch {}
            // Persist derived companyId in localStorage so other pages (Profile)
            // can subscribe to the correct Firestore document. Prefer the
            // companyId we used to fetch the canonical subscription when
            // available.
            try {
              const persistId =
                companyIdForPayload ||
                found.companyId ||
                found.clientId ||
                null;
              if (persistId) {
                localStorage.setItem("companyId", String(persistId));
              }
            } catch (e) {}
            // If the canonical subscription already contains a planId and we
            // have a companyId, there's nothing further for the client to do:
            // the server/webhook already wrote the canonical doc and the
            // Profile page will display it. Skip the POST to avoid 400s.
            if (
              (found.planId || found.plan || found.planName) &&
              (companyIdForPayload || found.companyId)
            ) {
              console.log(
                "[PaymentSuccess] Canonical subscription already present; skipping server POST."
              );
              return;
            }
          } else {
            console.warn(
              "[PaymentSuccess] No subscription found after retries. The server or webhook may still be processing."
            );
          }

          // Continue — the Profile page will receive real-time updates via Firestore
          // and the server-admin write will make the subscription visible there.
        }

        // Map planId -> plan details
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

        // Derive an effective planId if URL didn't contain one
        const smsToPlan = (sms?: number) => {
          if (!sms) return null;
          if (sms === 250) return "starter_1m";
          if (sms === 600) return "growth_3m";
          if (sms === 900) return "pro_6m";
          return null;
        };

        // Price -> plan mapping (keeps parity with App.tsx PLAN_PRICES)
        const priceToPlan: Record<number, string> = {
          30: "starter_1m",
          75: "growth_3m",
          100: "pro_6m",
        };

        let effectivePlanId: string | null = planId || null;
        if (!effectivePlanId && typeof found === "object" && found) {
          effectivePlanId =
            found.planId ||
            found.plan ||
            smsToPlan(found.smsCredits || found.remainingCredits || 0) ||
            // Older or alternate docs may store price instead of planId
            (typeof found.price === "number"
              ? priceToPlan[found.price]
              : typeof found.price === "string" &&
                !Number.isNaN(Number(found.price))
              ? priceToPlan[Number(found.price)]
              : null) ||
            null;
        }

        // Determine plan object either from mapping or from found payload
        let plan = effectivePlanId ? planMapping[effectivePlanId] : null;
        if (!plan && typeof found === "object" && found) {
          plan = {
            name:
              found.planName ||
              found.name ||
              String(effectivePlanId || "Custom"),
            sms: found.smsCredits || found.remainingCredits || 0,
            months: found.months || 1,
          } as any;
          // Keep a syntactic planId when we don't have one
          if (!effectivePlanId && plan.sms) {
            effectivePlanId = smsToPlan(plan.sms) || null;
          }
        }

        if (!plan) {
          console.warn(
            "Unknown plan and no canonical subscription to infer it.",
            { planId, found }
          );
          return;
        }

        setPlanInfo({ planName: plan.name, smsCredits: plan.sms });

        // Save subscription to server; server should persist to Firestore
        // (admin write) so other browsers/devices can read it without client
        // authentication. We'll POST the subscription with the caller's
        // Firebase ID token so the server can verify and map the user ->
        // companyId securely.
        const base = await getSmsServerUrl().catch(() => "");
        if (!base) console.warn("[PaymentSuccess] No API base available");

        // Build payload for server save
        const payload: any = {
          planId: effectivePlanId || plan.name,
          smsCredits: plan.sms,
          durationMonths: plan.months,
          status: "active",
        };

        // Determine companyId if available or supply userEmail for server-side derivation
        let derivedCompanyId = null;
        try {
          derivedCompanyId = localStorage.getItem("companyId");
        } catch {}
        if (!derivedCompanyId && currentUser) {
          try {
            const baseLocal = await getSmsServerUrl().catch(() => "");
            if (baseLocal) {
              const idToken = await currentUser.getIdToken();
              const meResp = await fetch(`${baseLocal}/auth/me`, {
                headers: { Authorization: `Bearer ${idToken}` },
              });
              if (meResp.ok) {
                const meJson = await meResp.json().catch(() => ({}));
                derivedCompanyId = meJson.companyId || null;
              }
            }
          } catch (e) {
            console.warn("[PaymentSuccess] getCompanyId (me) failed:", e);
          }
        }

        if (derivedCompanyId) payload.companyId = derivedCompanyId;
        // Prefer a companyId we discovered earlier when fetching canonical
        // subscription (if any). This reduces chances of a server 400.
        if (!payload.companyId && companyIdForPayload)
          payload.companyId = companyIdForPayload;
        // As a last resort, try to use companyId-like values from the found
        // payload (some variants of the data include clientId/companyId).
        if (!payload.companyId && typeof found === "object" && found) {
          payload.companyId = found.companyId || found.clientId || null;
        }
        if (!payload.companyId && currentUser?.email)
          payload.userEmail = currentUser.email;

        // If a sessionId is present, include it so the server can reconcile via provider API if needed
        if (sessionId) payload.sessionId = sessionId;

        // Try to save to server; prefer ID token when available
        try {
          const headers: any = { "Content-Type": "application/json" };
          if (currentUser) {
            try {
              const idToken = await currentUser.getIdToken();
              headers.Authorization = `Bearer ${idToken}`;
            } catch {}
          }
          // Also surface the companyId and planId into headers so the server
          // can more easily reconcile requests when the request body may be
          // affected by proxies or other quirks.
          if (payload.companyId) headers["x-company-id"] = payload.companyId;
          if (payload.planId) headers["x-plan-id"] = payload.planId;
          console.log("[PaymentSuccess] Posting subscription to server:", {
            url: `${base}/api/subscription`,
            headers,
            payload,
          });

          const response = await fetch(`${base}/api/subscription`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
          });

          const data = await response.json().catch(() => ({}));
          if (data && data.success) {
            console.log(
              "✅ Subscription saved on server (billing/profile)",
              data.subscription || data
            );
          } else {
            console.warn("[PaymentSuccess] Server save incomplete:", data);
            // If server did not accept the payload (e.g., missing companyId),
            // try claim by session id if sessionId is available
            if (sessionId) {
              try {
                const claimRes = await fetch(`${base}/api/subscription/claim`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sessionId,
                    userEmail: currentUser?.email,
                  }),
                });
                const claimJson = await claimRes.json().catch(() => ({}));
                if (claimJson && claimJson.success) {
                  console.log(
                    "✅ Claimed subscription via session endpoint:",
                    claimJson.subscription
                  );
                } else {
                  console.warn(
                    "[PaymentSuccess] Claim attempt failed:",
                    claimJson
                  );
                }
              } catch (claimErr) {
                console.warn("[PaymentSuccess] Claim attempt error:", claimErr);
              }
            }
          }
        } catch (e) {
          console.error("Error posting subscription to server:", e);
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
