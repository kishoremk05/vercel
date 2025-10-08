import React, { useState } from "react";
import { Customer } from "../types";

interface QuickFeedbackPageProps {
  customers: Customer[];
  onAddCustomer: (name: string, phone: string) => string | void;
  onAddFeedback?: (customerId: string, text: string) => void;
}

const QuickFeedbackPage: React.FC<QuickFeedbackPageProps> = ({
  customers,
  onAddCustomer,
  onAddFeedback,
}) => {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    setStatus(null);

    if (!name.trim()) {
      setStatus("Please provide your name.");
      return;
    }

    if (!rating) {
      setStatus("Please select a rating.");
      return;
    }

    if (!message.trim()) {
      setStatus("Please provide your feedback message.");
      return;
    }

    const existing = customers.find((c) => c.name === name.trim());
    if (existing) {
      if (onAddFeedback) onAddFeedback(existing.id, message.trim());
    } else {
      const phonePlaceholder = "+0000000000";
      const createdId = onAddCustomer(name.trim(), phonePlaceholder);
      let targetId: string | undefined =
        (typeof createdId === "string" && createdId) || undefined;
      if (!targetId) {
        const found = customers.find((c) => c.name === name.trim());
        targetId = found?.id;
      }
      if (targetId && onAddFeedback) onAddFeedback(targetId, message.trim());
    }

    setSubmitted(true);
    setTimeout(() => {
      setName("");
      setMessage("");
      setRating(null);
      setSubmitted(false);
      setStatus(null);
    }, 3000);
  };

  const isNegative = rating !== null && rating <= 3;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-4 py-12">
      <div className="w-full max-w-2xl">
        {!submitted ? (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 sm:p-10">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mb-4 shadow-lg">
                <svg
                  className="w-8 h-8 text-indigo-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                  <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">
                Quick Feedback
              </h1>
              <p className="text-base text-gray-600 mt-2">
                Share your thoughts and help us improve
              </p>
            </div>

            {/* Rating Stars */}
            <div className="mb-8">
              <label className="text-sm font-semibold text-gray-700 mb-3 flex items-center justify-center gap-2">
                <svg
                  className="w-5 h-5 text-yellow-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                How would you rate your experience?
                <span className="text-red-600">*</span>
              </label>
              <div className="flex items-center justify-center gap-3 mt-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setRating(n);
                      setStatus(null);
                    }}
                    className={`text-4xl transition-all duration-200 ${
                      rating && n <= rating
                        ? "text-yellow-400 scale-110"
                        : "text-gray-300 hover:text-yellow-200"
                    } hover:scale-125 active:scale-95`}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              {rating !== null && (
                <div className="text-center mt-3">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                      rating >= 4
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {rating >= 4 ? "😊 Positive" : "😔 Needs Improvement"}
                  </span>
                </div>
              )}
            </div>

            {/* Form Fields */}
            <div className="space-y-5">
              {/* Name Field */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-gray-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Your Name
                  <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-200 focus:border-indigo-500 transition-all duration-200 placeholder-gray-400"
                />
              </div>

              {/* Message Field - Different styling based on rating */}
              <div>
                <label
                  className={`text-sm font-semibold mb-2 flex items-center gap-2 ${
                    isNegative ? "text-red-900" : "text-gray-700"
                  }`}
                >
                  <svg
                    className={`w-5 h-5 ${
                      isNegative ? "text-red-600" : "text-gray-600"
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {isNegative ? "Tell us what went wrong" : "Your Feedback"}
                  <span
                    className={isNegative ? "text-red-600" : "text-red-600"}
                  >
                    *
                  </span>
                </label>
                <div className="relative">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={500}
                    placeholder={
                      isNegative
                        ? "Please share specific details about what didn't work well. Your feedback helps us improve."
                        : "Share your thoughts and experiences with us..."
                    }
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200 h-32 resize-none ${
                      isNegative
                        ? "border-red-300 focus:ring-red-200 focus:border-red-500 placeholder-red-400/70"
                        : "border-gray-300 focus:ring-indigo-200 focus:border-indigo-500 placeholder-gray-400"
                    }`}
                  />
                  <div
                    className={`absolute bottom-3 right-3 text-xs font-medium bg-white/90 px-2 py-1 rounded-md shadow-sm ${
                      isNegative ? "text-red-600" : "text-gray-500"
                    }`}
                  >
                    {message.length}/500
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 ${
                  isNegative
                    ? "bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:via-red-800 hover:to-red-900 hover:shadow-xl"
                    : "bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:via-purple-700 hover:to-indigo-800 hover:shadow-xl"
                } transform hover:scale-105 active:scale-95`}
              >
                <span>Submit Feedback</span>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </button>

              {/* Status Message */}
              {status && (
                <div
                  className={`rounded-xl p-4 shadow-md animate-shake ${
                    status.includes("Please")
                      ? "bg-red-50 border-2 border-red-300"
                      : "bg-green-50 border-2 border-green-300"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {status.includes("Please") ? (
                      <svg
                        className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    <p
                      className={`text-sm font-semibold flex-1 ${
                        status.includes("Please")
                          ? "text-red-800"
                          : "text-green-800"
                      }`}
                    >
                      {status}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Thank You Card */
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-10">
            <div className="relative">
              {/* Decorative circles */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-200/30 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-200/30 rounded-full blur-3xl"></div>

              {/* Content */}
              <div className="relative z-10 text-center">
                {/* Animated Icon */}
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full mb-6 shadow-lg animate-bounce-slow">
                  <span className="text-5xl">🎉</span>
                </div>

                {/* Success Message */}
                <h3 className="text-3xl font-bold text-gray-900 mb-4">
                  Thank you for your feedback!
                </h3>
                <p className="text-lg text-gray-700 leading-relaxed mb-6 max-w-md mx-auto">
                  Your feedback has been received and will help us improve our
                  service.
                </p>

                {/* Success Badge */}
                <div className="flex items-center justify-center gap-4 mb-6">
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-50 backdrop-blur-sm rounded-full border border-green-300 shadow-sm">
                    <svg
                      className="w-5 h-5 text-green-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm font-semibold text-green-900">
                      Successfully submitted
                    </span>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 backdrop-blur-sm rounded-xl p-4 border border-indigo-200">
                  <div className="flex items-start gap-3 text-left">
                    <svg
                      className="w-5 h-5 text-indigo-700 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <p className="text-sm text-indigo-900">
                      <span className="font-semibold">What's next?</span>
                      <br />
                      Our team will review your feedback and take appropriate
                      action to improve your experience.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickFeedbackPage;
