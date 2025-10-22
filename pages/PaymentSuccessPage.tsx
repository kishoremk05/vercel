import React, { useEffect, useState } from "react";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import {
  initializeFirebase,
  getFirebaseAuth,
  getFirebaseDb,
} from "../lib/firebaseClient";
import { fetchClientProfile } from "../lib/dashboardFirebase";

const PaymentSuccessPage: React.FC = () => {
  const [planInfo, setPlanInfo] = useState<{
    planName: string;
    smsCredits: number;
  } | null>(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
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
        const planId = urlParams.get("plan") || undefined;
        const sessionId =
          urlParams.get("sessionId") ||
          urlParams.get("subscription_id") ||
          urlParams.get("subscriptionId") ||
          urlParams.get("id") ||
          urlParams.get("sid") ||
          urlParams.get("session") ||
          undefined;
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
          setPlanInfo({ planName: plan.name, smsCredits: plan.sms });
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
          } catch (e) {
            console.warn(
              "[PaymentSuccess] Failed to write selected plan to Firestore profile:",
              e
            );
          }
        }
      } catch (error) {
        console.error("Error saving subscription:", error);
      }
    };
    const savePromise = saveSubscription();
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
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;
