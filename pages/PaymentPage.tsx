import React, { useState, useEffect } from "react";

interface PaymentPageProps {
  onPaymentSuccess: () => void;
  onBack: () => void;
}

interface PricingPlan {
  id: string;
  name: string;
  duration: string;
  price: number;
  smsCredits: number;
  features: string[];
  popular?: boolean;
}

const pricingPlans: PricingPlan[] = [
  {
    id: "starter_1m",
    name: "Starter",
    duration: "1 month",
    price: 30,
    smsCredits: 250,
    features: [
      "250 SMS credits",
      "Real-time analytics",
      "Smart review funneling",
      "Email support",
    ],
  },
  {
    id: "growth_3m",
    name: "Growth",
    duration: "3 months",
    price: 75,
    smsCredits: 600,
    features: [
      "600 SMS credits",
      "Everything in Starter",
      "Priority support",
      "Advanced analytics",
    ],
    popular: true,
  },
  {
    id: "pro_6m",
    name: "Professional",
    duration: "6 months",
    price: 100,
    smsCredits: 900,
    features: [
      "900 SMS credits",
      "Everything in Growth",
      "Dedicated account manager",
      "Custom integrations",
    ],
  },
];

const PaymentPage: React.FC<PaymentPageProps> = ({
  onPaymentSuccess,
  onBack,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan>(() => {
    try {
      const pending = localStorage.getItem("pendingPlan");
      if (pending) {
        const found = pricingPlans.find((p) => p.id === pending);
        if (found) return found;
      }
    } catch {}
    return pricingPlans[1];
  }); // Default to Growth plan
  const [isProcessing, setIsProcessing] = useState(false);
  const [alreadyPaid, setAlreadyPaid] = useState(false);

  // Clear pendingPlan after mount so refresh won't overwrite selection later
  useEffect(() => {
    try {
      localStorage.removeItem("pendingPlan");
    } catch {}
  }, []);

  // On mount, perform a pre-flight check so the page can immediately
  // indicate if the client already has a subscription and avoid showing
  // the payment CTA when they don't need it.
  useEffect(() => {
    (async () => {
      try {
        const companyId = localStorage.getItem("companyId");
        if (!companyId) return;
        const resolveApiBase = () => {
          try {
            const fromSms = localStorage.getItem("smsServerUrl");
            if (fromSms) return fromSms.replace(/\/$/, "");
          } catch {}
          try {
            const fromLS = localStorage.getItem("apiBase");
            if (fromLS) return fromLS.replace(/\/$/, "");
          } catch {}
          try {
            const g =
              (window as any).SMS_SERVER_URL || (window as any).API_BASE;
            if (g) return String(g).replace(/\/$/, "");
          } catch {}
          try {
            const env = (import.meta as any)?.env?.VITE_API_BASE;
            if (env) return String(env).replace(/\/$/, "");
          } catch {}
          if (
            typeof window !== "undefined" &&
            window.location &&
            window.location.hostname &&
            window.location.hostname !== "localhost" &&
            window.location.hostname !== "127.0.0.1"
          ) {
            return "https://server-cibp.onrender.com";
          }
          return "";
        };

        const apiBase = resolveApiBase();
        const checkUrl = apiBase
          ? `${apiBase}/api/subscription?companyId=${companyId}`
          : `/api/subscription?companyId=${companyId}`;
        const resp = await fetch(checkUrl).catch(() => null);
        if (!resp || !resp.ok) return;
        const json = await resp.json().catch(() => ({}));
        const existing = json && json.subscription;
        if (
          existing &&
          (existing.planId ||
            existing.planName ||
            existing.status === "active" ||
            Number(existing.remainingCredits || existing.smsCredits || 0) > 0)
        ) {
          setAlreadyPaid(true);
        }
      } catch (e) {
        // Non-fatal
      }
    })();
  }, []);

  // Get user info
  const userEmail = localStorage.getItem("userEmail") || "";
  const businessName = localStorage.getItem("businessName") || "Your Business";
  // Start hosted checkout immediately using backend create-session
  const handlePayment = async () => {
    setIsProcessing(true);

    try {
      const companyId = localStorage.getItem("companyId");
      const userEmail = localStorage.getItem("userEmail") || "";

      if (!companyId) {
        throw new Error("Please log in to continue with payment");
      }

      console.log("[Payment] Creating Dodo payment session for:", {
        plan: selectedPlan.id,
        price: selectedPlan.price,
        companyId,
      });

      // Resolve API base
      const resolveApiBase = () => {
        // Priority: smsServerUrl from Firebase config -> explicit apiBase -> globals -> Vite env -> hosted fallback (Render)
        try {
          const fromSms = localStorage.getItem("smsServerUrl");
          if (fromSms) return fromSms.replace(/\/$/, "");
        } catch {}
        try {
          const fromLS = localStorage.getItem("apiBase");
          if (fromLS) return fromLS.replace(/\/$/, "");
        } catch {}
        try {
          const g = (window as any).SMS_SERVER_URL || (window as any).API_BASE;
          if (g) return String(g).replace(/\/$/, "");
        } catch {}
        try {
          const env = (import.meta as any)?.env?.VITE_API_BASE;
          if (env) return String(env).replace(/\/$/, "");
        } catch {}
        // Production fallback to Render when on a hosted domain
        if (
          typeof window !== "undefined" &&
          window.location &&
          window.location.hostname &&
          window.location.hostname !== "localhost" &&
          window.location.hostname !== "127.0.0.1"
        ) {
          return "https://server-cibp.onrender.com";
        }
        return ""; // dev: fall back to relative for local proxy
      };

      const apiBase = resolveApiBase();
      const url = apiBase
        ? `${apiBase}/api/payments/create-session`
        : `/api/payments/create-session`;

      console.log("[Payment] Sending request:", {
        url,
        plan: selectedPlan.id,
        price: selectedPlan.price,
        companyId,
        userEmail,
      });

      // Pre-flight: check if client already has an active subscription so
      // we can avoid duplicate one-time purchases. Prefer the server
      // canonical subscription endpoint which reads billing/profile.
      try {
        const checkResp = await fetch(
          apiBase
            ? `${apiBase}/api/subscription?companyId=${companyId}`
            : `/api/subscription?companyId=${companyId}`
        );
        if (checkResp.ok) {
          const checkJson = await checkResp.json().catch(() => ({}));
          const existing = checkJson && checkJson.subscription;
          const alreadyHasPlan = !!(
            existing &&
            (existing.planId ||
              existing.planName ||
              existing.status === "active" ||
              Number(existing.remainingCredits || existing.smsCredits || 0) > 0)
          );
          if (alreadyHasPlan) {
            alert(
              "You already have an active subscription. Redirecting to Dashboard."
            );
            window.location.href = "/dashboard";
            return;
          }
        }
      } catch (e) {
        console.warn(
          "[Payment] Pre-flight subscription check failed, continuing with checkout",
          e
        );
      }

      // Create Dodo payment session
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Fallback headers so server can read identifiers even if body parsing is impaired by host
          "x-company-id": companyId || "",
          "x-user-email": userEmail || "",
          "x-plan-id": selectedPlan.id || "",
          "x-price": String(selectedPlan.price || ""),
        },
        body: JSON.stringify({
          plan: selectedPlan.id,
          price: selectedPlan.price,
          companyId,
          userEmail,
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      let data: any = null;
      try {
        data = contentType.includes("application/json")
          ? await response.json()
          : await response.text();
      } catch {}

      if (!response.ok) {
        const msg =
          (data && typeof data === "object" && (data.error || data.message)) ||
          (typeof data === "string"
            ? data
            : "Failed to create payment session");
        throw new Error(msg);
      }

      if (!data || !data.url) {
        throw new Error("No payment URL received from server");
      }

      console.log("[Payment] ✅ Redirecting to Dodo payment:", data.url);
      // Persist the pending plan so we can recover it after redirect from the
      // hosted checkout (server or redirect may not include the plan param).
      try {
        localStorage.setItem("pendingPlan", selectedPlan.id);
      } catch (e) {}
      window.location.href = data.url; // Redirect to Dodo hosted checkout
    } catch (error: any) {
      console.error("Payment error:", error);
      alert(`❌ Payment failed: ${error.message || "Please try again later."}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const getDurationInMs = (duration: string): number => {
    if (duration.includes("1 month")) return 30 * 24 * 60 * 60 * 1000;
    if (duration.includes("3 months")) return 90 * 24 * 60 * 60 * 1000;
    if (duration.includes("6 months")) return 180 * 24 * 60 * 60 * 1000;
    return 30 * 24 * 60 * 60 * 1000;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gray-900 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </div>
            <span className="text-xl font-semibold text-gray-900">
              ReputationFlow
            </span>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => {
                // Allow user to change plan selection - navigate back to pricing section on Home page
                try {
                  localStorage.setItem("pendingPlan", selectedPlan.id);
                } catch {}
                // Use hash so HomePage can scroll to pricing section
                window.location.href = "/#pricing";
              }}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Change plan
            </button>
            <button
              onClick={onBack}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              ← Back
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Choose Your Plan
          </h1>
          <p className="text-lg text-gray-600 mb-2">
            Welcome <strong>{businessName}</strong> • {userEmail}
          </p>
          <p className="text-sm text-gray-500">
            Select a plan to unlock unlimited SMS credits.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Plan Selection */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Select Your Plan
              </h2>

              <div className="space-y-4">
                {pricingPlans.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    className={`relative border-2 rounded-xl p-6 cursor-pointer transition-all ${
                      selectedPlan.id === plan.id
                        ? "border-gray-900 bg-gray-50"
                        : "border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-6">
                        <span className="bg-yellow-400 text-gray-900 px-3 py-1 rounded-full text-xs font-bold">
                          MOST POPULAR
                        </span>
                      </div>
                    )}

                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <input
                            type="radio"
                            checked={selectedPlan.id === plan.id}
                            onChange={() => setSelectedPlan(plan)}
                            className="w-5 h-5 text-gray-900"
                          />
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">
                              {plan.name}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {plan.duration}
                            </p>
                          </div>
                        </div>
                        <div className="ml-8">
                          <ul className="space-y-2 text-sm text-gray-700">
                            {plan.features.map((feature, idx) => (
                              <li key={idx} className="flex items-center gap-2">
                                <svg
                                  className="w-4 h-4 text-green-500"
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
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-gray-900">
                          ${plan.price}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Checkout
              </h2>
              <p className="text-gray-600 mb-4">
                You'll be redirected to our secure payment provider to complete
                your subscription for {selectedPlan.name}.
              </p>
              <ul className="list-disc ml-6 text-sm text-gray-700 mb-6">
                <li>Hosted checkout (card/UPI handled by provider)</li>
                <li>Return to app automatically after payment</li>
              </ul>
              <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                <div>
                  Business: <strong>{businessName}</strong>
                </div>
                <div>
                  Plan: <strong>{selectedPlan.name}</strong>
                </div>
                <div>
                  Amount: <strong>${selectedPlan.price}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Order Summary
              </h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Plan</span>
                  <span className="font-medium text-gray-900">
                    {selectedPlan.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration</span>
                  <span className="font-medium text-gray-900">
                    {selectedPlan.duration}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">SMS Credits</span>
                  <span className="font-medium text-gray-900">
                    {selectedPlan.smsCredits}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-lg font-semibold text-gray-900">
                      Total
                    </span>
                    <span className="text-3xl font-bold text-gray-900">
                      ${selectedPlan.price}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (alreadyPaid) {
                    window.location.href = "/dashboard";
                    return;
                  }
                  handlePayment();
                }}
                disabled={isProcessing || alreadyPaid}
                className={`w-full py-4 px-6 rounded-lg font-bold text-lg transition-all ${
                  isProcessing
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-gray-900 hover:bg-gray-800 text-white shadow-lg hover:shadow-xl"
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
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
                    Processing...
                  </span>
                ) : alreadyPaid ? (
                  `Active — Go to Dashboard`
                ) : (
                  `Pay $${selectedPlan.price}`
                )}
              </button>

              {alreadyPaid && (
                <div className="mt-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg p-3">
                  You already have an active subscription.{" "}
                  <button
                    onClick={() => (window.location.href = "/dashboard")}
                    className="underline font-semibold"
                  >
                    Go to Dashboard
                  </button>
                </div>
              )}

              <div className="mt-6 space-y-3 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  <span>Secure payment with Dodo Gateway</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500"
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
                  <span>Cancel anytime</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                  <span>No hidden fees</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
