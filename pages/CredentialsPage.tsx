import React, { useState, useEffect } from "react";
import { getSmsServerUrl } from "../lib/firebaseConfig";

const API_BASE = import.meta.env.VITE_API_BASE || "";

interface CredentialsPageProps {
  onBack: () => void;
}

interface Credentials {
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  whatsappAccountSid: string;
  whatsappAuthToken: string;
  whatsappPhoneNumber: string;
  feedbackUrl: string;
  googleRedirectUrl: string;
}

const CredentialsPage: React.FC<CredentialsPageProps> = ({ onBack }) => {
  const [credentials, setCredentials] = useState<Credentials>({
    twilioAccountSid: "",
    twilioAuthToken: "",
    twilioPhoneNumber: "",
    whatsappAccountSid: "",
    whatsappAuthToken: "",
    whatsappPhoneNumber: "",
    feedbackUrl: "",
    googleRedirectUrl: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showTokens, setShowTokens] = useState({
    twilio: false,
    whatsapp: false,
  });

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    try {
      const companyId = localStorage.getItem("companyId");
      if (!companyId) {
        setMessage({
          type: "error",
          text: "No company ID found. Please log in again.",
        });
        setLoading(false);
        return;
      }

      const response = await fetch(
        `/api/company/credentials?companyId=${companyId}`
      );
      const data = await response.json();

      if (data.success && data.credentials) {
        setCredentials(data.credentials);
      } else {
        throw new Error(data.error || "Failed to load credentials");
      }
    } catch (e: any) {
      console.error("[credentials:fetch:error]", e);
      setMessage({
        type: "error",
        text: e.message || "Failed to load credentials",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const companyId = localStorage.getItem("companyId");
      if (!companyId) {
        setMessage({
          type: "error",
          text: "No company ID found. Please log in again.",
        });
        return;
      }

      const base = await getSmsServerUrl().catch(() => API_BASE);
      const url = base
        ? `${base}/api/company/credentials`
        : `${API_BASE}/api/company/credentials`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          ...credentials,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({
          type: "success",
          text: "Credentials saved successfully!",
        });
        // If server returned the updated credentials, apply them
        if (data.credentials)
          setCredentials((prev) => ({ ...prev, ...data.credentials }));
        setTimeout(() => setMessage(null), 2500);
      } else {
        throw new Error(data.error || "Failed to save credentials");
      }
    } catch (e: any) {
      console.error("[credentials:save:error]", e);
      setMessage({
        type: "error",
        text: e.message || "Failed to save credentials",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Credentials, value: string) => {
    setCredentials((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen grid-pattern relative overflow-hidden flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-pattern relative overflow-hidden">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        {/* Header */}
        <div className="mb-6">
          <div className="gradient-border premium-card bg-white shadow-lg p-4 sm:p-6 transition-all duration-300 rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 text-white shadow-lg">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M15.75 1.5a6.75 6.75 0 00-6.651 7.906c.067.39-.032.717-.221.906l-6.5 6.499a3 3 0 00-.878 2.121v2.818c0 .414.336.75.75.75H6a.75.75 0 00.75-.75v-1.5h1.5A.75.75 0 009 19.5V18h1.5a.75.75 0 00.53-.22l2.658-2.658c.19-.189.517-.288.906-.22A6.75 6.75 0 1015.75 1.5zm0 3a.75.75 0 000 1.5A2.25 2.25 0 0118 8.25a.75.75 0 001.5 0 3.75 3.75 0 00-3.75-3.75z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  Credentials & Settings
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Configure Twilio, WhatsApp, and feedback URLs
                </p>
              </div>
              <button
                onClick={onBack}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    fillRule="evenodd"
                    d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
                    clipRule="evenodd"
                  />
                </svg>
                Back
              </button>
            </div>
          </div>
        </div>

        {/* Success/Error Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === "success" ? (
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              <span className="font-medium">{message.text}</span>
            </div>
          </div>
        )}

        {/* Twilio SMS Credentials */}
        <div className="mb-6 gradient-border premium-card bg-white shadow-lg p-6 rounded-2xl">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">📱</span>
            Twilio SMS Credentials
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account SID
              </label>
              <input
                type="text"
                value={credentials.twilioAccountSid}
                onChange={(e) =>
                  handleChange("twilioAccountSid", e.target.value)
                }
                placeholder="AC..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Auth Token
              </label>
              <div className="relative">
                <input
                  type={showTokens.twilio ? "text" : "password"}
                  value={credentials.twilioAuthToken}
                  onChange={(e) =>
                    handleChange("twilioAuthToken", e.target.value)
                  }
                  placeholder="Enter auth token"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowTokens((prev) => ({ ...prev, twilio: !prev.twilio }))
                  }
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showTokens.twilio ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={credentials.twilioPhoneNumber}
                onChange={(e) =>
                  handleChange("twilioPhoneNumber", e.target.value)
                }
                placeholder="+1234567890"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* WhatsApp Credentials */}
        <div className="mb-6 gradient-border premium-card bg-white shadow-lg p-6 rounded-2xl">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">💬</span>
            WhatsApp Credentials
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account SID
              </label>
              <input
                type="text"
                value={credentials.whatsappAccountSid}
                onChange={(e) =>
                  handleChange("whatsappAccountSid", e.target.value)
                }
                placeholder="AC..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Auth Token
              </label>
              <div className="relative">
                <input
                  type={showTokens.whatsapp ? "text" : "password"}
                  value={credentials.whatsappAuthToken}
                  onChange={(e) =>
                    handleChange("whatsappAuthToken", e.target.value)
                  }
                  placeholder="Enter auth token"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowTokens((prev) => ({
                      ...prev,
                      whatsapp: !prev.whatsapp,
                    }))
                  }
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showTokens.whatsapp ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={credentials.whatsappPhoneNumber}
                onChange={(e) =>
                  handleChange("whatsappPhoneNumber", e.target.value)
                }
                placeholder="whatsapp:+1234567890"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* URLs Configuration */}
        <div className="mb-6 gradient-border premium-card bg-white shadow-lg p-6 rounded-2xl">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">🔗</span>
            Feedback & Redirect URLs
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Feedback Page URL
              </label>
              <input
                type="url"
                value={credentials.feedbackUrl}
                onChange={(e) => handleChange("feedbackUrl", e.target.value)}
                placeholder="https://yourdomain.com/feedback"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Customers will be sent this link to provide feedback
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Google Review Redirect URL
              </label>
              <input
                type="url"
                value={credentials.googleRedirectUrl}
                onChange={(e) =>
                  handleChange("googleRedirectUrl", e.target.value)
                }
                placeholder="https://g.page/your-business/review"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Positive feedback will redirect here (Google Reviews)
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onBack}
            className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                  <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                </svg>
                Save Credentials
              </>
            )}
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">
            💡 How to get Twilio credentials:
          </h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>
              Go to{" "}
              <a
                href="https://www.twilio.com/console"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Twilio Console
              </a>
            </li>
            <li>Find your Account SID and Auth Token on the dashboard</li>
            <li>Get a phone number from "Phone Numbers" section</li>
            <li>
              For WhatsApp, enable WhatsApp Sandbox or get approved number
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default CredentialsPage;
