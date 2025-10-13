import React, { useEffect, useState } from "react";
import { getSmsServerUrl } from "../lib/firebaseConfig";

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
        const urlParams = new URLSearchParams(window.location.search);
        const planId =
          urlParams.get("plan") || localStorage.getItem("pendingPlan");
        const companyId = localStorage.getItem("companyId");

        if (!planId || !companyId) {
          console.warn("Missing plan or companyId, skipping subscription save");
          return;
        }

        // Map plan to SMS credits and name
        const planMapping: Record<
          string,
          { name: string; sms: number; months: number }
        > = {
          starter_1m: { name: "1-Month Plan", sms: 250, months: 1 },
          monthly: { name: "1-Month Plan", sms: 250, months: 1 },
          growth_3m: { name: "3-Month Plan", sms: 500, months: 3 },
          quarterly: { name: "3-Month Plan", sms: 500, months: 3 },
          pro_6m: { name: "6-Month Plan", sms: 1500, months: 6 },
          halfyearly: { name: "6-Month Plan", sms: 1500, months: 6 },
        };

        const plan = planMapping[planId];
        if (!plan) {
          console.warn("Unknown plan:", planId);
          return;
        }

        setPlanInfo({ planName: plan.name, smsCredits: plan.sms });

        // Save subscription to database
        const base = await getSmsServerUrl();
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

        const data = await response.json();
        if (data.success) {
          console.log("✅ Subscription saved successfully");
          // Clear pending plan
          localStorage.removeItem("pendingPlan");
        } else {
          console.error("Failed to save subscription:", data.error);
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
