import React from "react";

const PaymentCancelPage: React.FC = () => {
  const handleRetryPayment = () => {
    window.location.href = "/payment";
  };

  const handleGoHome = () => {
    window.location.href = "/";
  };

  // Hide the navbar/header if present
  React.useEffect(() => {
    const header = document.querySelector("header");
    if (header) {
      (header as HTMLElement).style.display = "none";
    }
    return () => {
      if (header) {
        (header as HTMLElement).style.display = "";
      }
    };
  }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6 text-center">
          {/* Cancel Icon */}
          <div className="flex justify-center">
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>

          {/* Cancel Message */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">
              Payment Cancelled
            </h1>
            <p className="text-lg text-gray-600">
              Your payment was not completed
            </p>
          </div>

          {/* Details */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 text-left">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="text-sm text-gray-700">
                  <p className="font-medium mb-1">What happened?</p>
                  <p>
                    Your payment was cancelled or interrupted. No charges were
                    made to your account.
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-3">
                <p className="text-sm text-gray-700 font-medium mb-2">
                  You can:
                </p>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <span className="text-blue-500">•</span>
                    Try again with the same plan
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-500">•</span>
                    Choose a different plan
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-500">•</span>
                    Contact support if you need help
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleRetryPayment}
              className="w-full py-3 px-6 rounded-lg bg-gradient-to-r from-gray-900 to-gray-700 text-white font-semibold hover:from-gray-800 hover:to-gray-600 transition-all duration-200 flex items-center justify-center gap-2"
            >
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Try Payment Again</span>
            </button>

            <button
              onClick={handleGoHome}
              className="w-full py-3 px-6 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all duration-200"
            >
              Go to Home Page
            </button>
          </div>

          {/* Support Link */}
          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Need help?{" "}
              <a
                href="mailto:support@reputationflow.com"
                className="text-gray-900 font-medium hover:underline"
              >
                Contact Support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentCancelPage;
