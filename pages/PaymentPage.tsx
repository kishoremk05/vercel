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
    price: 15,
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
    price: 40,
    smsCredits: 800,
    features: [
      "800 SMS credits",
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
    price: 80,
    smsCredits: 1500,
    features: [
      "1500 SMS credits",
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
  const [paymentMethod, setPaymentMethod] = useState<"card" | "upi">("card");

  // Clear pendingPlan after mount so refresh won't overwrite selection later
  useEffect(() => {
    try {
      localStorage.removeItem("pendingPlan");
    } catch {}
  }, []);

  // Payment form state
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvv, setCvv] = useState("");
  const [upiId, setUpiId] = useState("");

  // Get user info
  const userEmail = localStorage.getItem("userEmail") || "";
  const businessName = localStorage.getItem("businessName") || "Your Business";

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(" ");
    } else {
      return value;
    }
  };

  // Format expiry date
  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    if (v.length >= 2) {
      return v.slice(0, 2) + "/" + v.slice(2, 4);
    }
    return v;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted.length <= 19) {
      // 16 digits + 3 spaces
      setCardNumber(formatted);
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiryDate(e.target.value);
    if (formatted.length <= 5) {
      setExpiryDate(formatted);
    }
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/gi, "");
    if (value.length <= 4) {
      setCvv(value);
    }
  };

  const validateForm = (): boolean => {
    if (paymentMethod === "card") {
      const cardDigits = cardNumber.replace(/\s+/g, "");
      if (cardDigits.length !== 16) {
        alert("Please enter a valid 16-digit card number");
        return false;
      }
      if (!cardName.trim()) {
        alert("Please enter the cardholder name");
        return false;
      }
      if (expiryDate.length !== 5) {
        alert("Please enter a valid expiry date (MM/YY)");
        return false;
      }
      if (cvv.length < 3) {
        alert("Please enter a valid CVV");
        return false;
      }
    } else if (paymentMethod === "upi") {
      if (!upiId.trim() || !upiId.includes("@")) {
        alert("Please enter a valid UPI ID");
        return false;
      }
    }
    return true;
  };

  const handlePayment = async () => {
    if (!validateForm()) return;

    setIsProcessing(true);

    try {
      // TODO: Integrate with Dodo Payment Gateway
      // This is a placeholder for the actual payment integration

      // Simulate API call to Dodo Payment Gateway
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // For demo purposes, we'll simulate success
      // In production, you would:
      // 1. Send payment details to your backend
      // 2. Backend calls Dodo Payment API
      // 3. Backend saves subscription info to Firebase
      // 4. Return success/failure

      const companyId = localStorage.getItem("companyId");
      if (companyId) {
        // Save subscription data to localStorage (temporary - should be in Firebase)
        const subscriptionData = {
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          smsCredits: selectedPlan.smsCredits,
          remainingCredits: selectedPlan.smsCredits,
          startDate: new Date().toISOString(),
          endDate: new Date(
            Date.now() + getDurationInMs(selectedPlan.duration)
          ).toISOString(),
          status: "active",
          paymentMethod: paymentMethod,
          amount: selectedPlan.price,
        };

        try {
          localStorage.setItem(
            "subscription",
            JSON.stringify(subscriptionData)
          );
        } catch {}

        // Attempt to save subscription to backend so it shows up in Firestore (if server configured)
        (async () => {
          try {
            // Resolve API base: try runtime globals, localStorage, or VITE env fallback
            const resolveApiBase = () => {
              try {
                const fromLS = localStorage.getItem("apiBase");
                if (fromLS) return fromLS.replace(/\/$/, "");
              } catch {}
              try {
                // app may set a global SMS server url
                const g =
                  (window as any).SMS_SERVER_URL || (window as any).API_BASE;
                if (g) return String(g).replace(/\/$/, "");
              } catch {}
              try {
                const env = (import.meta as any)?.env?.VITE_API_BASE;
                if (env) return String(env).replace(/\/$/, "");
              } catch {}
              return ""; // fall back to relative
            };

            const apiBase = resolveApiBase();
            const url = apiBase
              ? `${apiBase}/api/subscription`
              : `/api/subscription`;
            const payload = {
              companyId,
              planId: subscriptionData.planId,
              smsCredits: subscriptionData.smsCredits,
              durationMonths: subscriptionData.planId.includes("3m")
                ? 3
                : subscriptionData.planId.includes("6m")
                ? 6
                : 1,
              status: subscriptionData.status,
            };
            const resp = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            if (!resp.ok) {
              const text = await resp.text().catch(() => "");
              console.warn(
                "Subscription saved locally but backend returned",
                resp.status,
                text
              );
            } else {
              const json = await resp.json().catch(() => null);
              console.log("Subscription saved to backend:", json);
            }
          } catch (err) {
            console.warn("Failed to save subscription to backend:", err);
          }
        })();
      }

      alert("✅ Payment successful! Welcome to ReputationFlow.");
      onPaymentSuccess();
    } catch (error) {
      console.error("Payment error:", error);
      alert("❌ Payment failed. Please try again.");
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
            Complete Your Purchase
          </h1>
          <p className="text-lg text-gray-600">
            Welcome <strong>{businessName}</strong> • {userEmail}
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
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Payment Method
              </h2>

              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                    paymentMethod === "card"
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 text-gray-700 hover:border-gray-400"
                  }`}
                >
                  💳 Credit/Debit Card
                </button>
                <button
                  onClick={() => setPaymentMethod("upi")}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                    paymentMethod === "upi"
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 text-gray-700 hover:border-gray-400"
                  }`}
                >
                  📱 UPI
                </button>
              </div>

              {paymentMethod === "card" ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Card Number
                    </label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      placeholder="1234 5678 9012 3456"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cardholder Name
                    </label>
                    <input
                      type="text"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        value={expiryDate}
                        onChange={handleExpiryChange}
                        placeholder="MM/YY"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        CVV
                      </label>
                      <input
                        type="text"
                        value={cvv}
                        onChange={handleCvvChange}
                        placeholder="123"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    UPI ID
                  </label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="yourname@upi"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Enter your UPI ID (e.g., yourname@paytm, yourname@gpay)
                  </p>
                </div>
              )}
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
                onClick={handlePayment}
                disabled={isProcessing}
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
                ) : (
                  `Pay $${selectedPlan.price}`
                )}
              </button>

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
