import React, { useState, useEffect, useRef } from "react";
import SEO from "../components/SEO";
import {
  waitForAuthToken,
  getFirebaseDb,
  getFirebaseAuth,
} from "../lib/firebaseClient";
import { doc, getDoc } from "firebase/firestore";
import { getSmsServerUrl } from "../lib/firebaseConfig";

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
      const params = new URLSearchParams(window.location.search || "");
      // Prefer explicit ?plan= query param, fallback to locally-stored pendingPlan
      const planParam =
        params.get("plan") || localStorage.getItem("pendingPlan") || "";
      if (planParam) {
        const found = pricingPlans.find((p) => p.id === planParam);
        if (found) return found;
      }
    } catch {}
    return pricingPlans[1];
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [alreadyPaidSource, setAlreadyPaidSource] = useState<
    "server" | "local" | null
  >(null);

  // --- Subscription check that re-runs on auth state changes ---
  const authListenerRef = useRef<any>(null);
  useEffect(() => {
    let unsub: any = null;
    const checkSubscription = async (user: any) => {
      try {
        if (!user) {
          setAlreadyPaid(false);
          setAlreadyPaidSource(null);
          return;
        }
        const db = getFirebaseDb();
        // Always use the logged-in user's UID for the profile check
        const profileRef = doc(db, "clients", user.uid, "profile", "main");
        const snap = await getDoc(profileRef);
        if (snap.exists()) {
          const data = snap.data();
          try {
            localStorage.setItem(
              "subscription",
              JSON.stringify({ ...data, companyId: user.uid })
            );
          } catch {}
          const hasPlan =
            data.planId || data.planName || data.status === "active";
          const hasCredits =
            Number(data.remainingCredits || data.smsCredits || 0) > 0;
          if (hasPlan || hasCredits) {
            setAlreadyPaid(true);
            setAlreadyPaidSource("server");
            return;
          }
        }
        setAlreadyPaid(false);
        setAlreadyPaidSource(null);
      } catch (e) {
        console.warn("[Payment] Profile fetch failed", e);
      }
    };

    const auth = getFirebaseAuth();
    // Initial check
    checkSubscription(auth.currentUser);
    // Listen for auth state changes
    unsub = auth.onAuthStateChanged((user) => {
      checkSubscription(user);
    });
    authListenerRef.current = unsub;
    return () => {
      if (authListenerRef.current) {
        try {
          authListenerRef.current();
        } catch {}
        authListenerRef.current = null;
      }
    };
  }, []);

  // If a clientId is present in the URL (or localStorage) verify that the
  // client's profile does not already have an active plan or remaining SMS
  // credits. If such data exists, redirect to the dashboard to avoid double
  // payment attempts.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search || "");
        let clientId =
          params.get("clientId") || localStorage.getItem("companyId");
        if (!clientId) return;

        const db = getFirebaseDb();
        const profileRef = doc(
          db,
          "clients",
          String(clientId),
          "profile",
          "main"
        );
        const snap = await getDoc(profileRef).catch(() => null as any);
        if (!mounted) return;
        if (snap && snap.exists && snap.exists()) {
          const data: any = snap.data();
          const hasPlan = !!(
            data?.planId ||
            data?.planName ||
            data?.status === "active"
          );
          const hasCredits =
            Number(data?.remainingCredits || data?.smsCredits || 0) > 0;
          if (hasPlan || hasCredits) {
            // Ensure local companyId is set for other parts of the app
            try {
              localStorage.setItem("companyId", String(clientId));
            } catch {}
            window.location.href = "/dashboard";
          }
        }
      } catch (e) {
        // ignore - non-fatal
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Redirect to dashboard if alreadyPaid from server
  useEffect(() => {
    if (alreadyPaid && alreadyPaidSource === "server") {
      window.location.href = "/dashboard";
    }
  }, [alreadyPaid, alreadyPaidSource]);

  // Get user info from localStorage for display
  const userEmail = localStorage.getItem("userEmail") || "";
  const businessName = localStorage.getItem("businessName") || "Your Business";

  // Ensure the payment page URL includes the logged-in client's id
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Prefer stored companyId, fall back to authenticated user's UID
        let companyId = localStorage.getItem("companyId");
        if (!companyId) {
          try {
            const auth = getFirebaseAuth();
            if (auth && !auth.currentUser) {
              // wait briefly for auth state to initialize
              await new Promise<void>((resolve) => {
                const off = auth.onAuthStateChanged((u: any) => {
                  try {
                    off();
                  } catch {}
                  resolve();
                });
                setTimeout(() => {
                  try {
                    off();
                  } catch {}
                  resolve();
                }, 2000);
              });
            }
            if (auth && auth.currentUser && auth.currentUser.uid) {
              companyId = auth.currentUser.uid;
            }
          } catch (e) {
            // ignore
          }
        }

        if (!mounted) return;
        if (companyId) {
          try {
            const params = new URLSearchParams(window.location.search || "");
            if (!params.get("clientId")) {
              params.set("clientId", String(companyId));
              const newUrl = `${window.location.pathname}?${params.toString()}`;
              window.history.replaceState({}, "", newUrl);
            }
          } catch (e) {}
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handlePayment = async () => {
    if (alreadyPaid) {
      window.location.href = "/dashboard";
      return;
    }

    setIsProcessing(true);
    try {
      const companyId = localStorage.getItem("companyId");
      const email = localStorage.getItem("userEmail") || "";
      if (!companyId) {
        try {
          localStorage.setItem("pendingPlan", String(selectedPlan.id));
        } catch {}
        window.location.href = `/auth?plan=${encodeURIComponent(
          selectedPlan.id
        )}`;
        return;
      }

      let token: string | null = null;
      try {
        token = await waitForAuthToken(5000);
      } catch (e) {
        token = null;
      }

      if (token) {
        try {
          const apiBase = (await getSmsServerUrl().catch(() => "")) || "";
          const checkUrl = apiBase
            ? `${String(apiBase).replace(
                /\/+$/,
                ""
              )}/api/subscription?companyId=${companyId}`
            : `/api/subscription?companyId=${companyId}`;
          const resp = await fetch(checkUrl, {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => null as any);
          if (resp && resp.ok) {
            const json = await resp.json().catch(() => ({} as any));
            const existing = json && json.subscription;
            const subCompany =
              existing?.companyId || existing?.clientId || null;
            const companyMatches =
              subCompany && String(subCompany) === String(companyId);
            const hasPlan =
              existing &&
              (existing.planId ||
                existing.planName ||
                existing.status === "active");
            const hasCredits =
              existing &&
              Number(existing.remainingCredits || existing.smsCredits || 0) > 0;
            if (companyMatches && (hasPlan || hasCredits)) {
              setAlreadyPaid(true);
              setAlreadyPaidSource("server");
              alert("You already have an active subscription.");
              setIsProcessing(false);
              return;
            }
          }
        } catch (e) {
          // non-fatal — continue to create session
        }
      }

      const apiBase = (await getSmsServerUrl().catch(() => "")) || "";
      const createUrl = apiBase
        ? `${String(apiBase).replace(/\/+$/, "")}/api/payments/create-session`
        : `/api/payments/create-session`;

      const headers: any = {
        "Content-Type": "application/json",
        "x-company-id": companyId || "",
        "x-user-email": email || "",
        "x-plan-id": selectedPlan.id || "",
        "x-price": String(selectedPlan.price || ""),
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const resp = await fetch(createUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          plan: selectedPlan.id,
          price: selectedPlan.price,
          companyId,
          userEmail: email,
        }),
      });

      const contentType = resp.headers.get("content-type") || "";
      let data: any = null;
      if (contentType.includes("application/json")) {
        data = await resp.json().catch(() => null);
      } else {
        const text = await resp.text().catch(() => "");
        try {
          data = JSON.parse(text);
        } catch {
          data = { url: text };
        }
      }

      if (!resp.ok) {
        const msg =
          data?.error || data?.message || "Failed to create payment session";
        throw new Error(msg);
      }
      if (!data || !data.url)
        throw new Error("No payment URL received from server");

      try {
        localStorage.removeItem("pendingPlan");
      } catch {}

      window.location.href = data.url;
    } catch (err: any) {
      console.error("[Payment] Error:", err);
      alert(err?.message || "Payment failed. Please try again later.");
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
    <>
      <SEO
        title="Plans & Pricing | ReputationFlow360"
        description="Compare our affordable review automation plans and start improving your customer reputation today. Choose from Starter, Growth, or Pro plans."
        canonical="https://reputationflow360.com/payment"
        keywords="pricing, plans, subscription, review automation pricing, reputation management plans, sms credit packages"
      />
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
            {/* Removed Change plan, Back, and Skip for now buttons */}
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
              Select a plan to unlock SMS credits.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                                <li
                                  key={idx}
                                  className="flex items-center gap-2"
                                >
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

              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Checkout
                </h2>
                <p className="text-gray-600 mb-4">
                  You'll be redirected to our secure payment provider to
                  complete your subscription for {selectedPlan.name}.
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
                  {isProcessing
                    ? "Processing..."
                    : alreadyPaid
                    ? `Active — Go to Dashboard`
                    : `Pay $${selectedPlan.price}`}
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
    </>
  );
};

export default PaymentPage;
