import React, { useState } from "react";
import { ActivityLog } from "../types";
import { getSmsServerUrl } from "../lib/firebaseConfig";

const API_BASE = import.meta.env.VITE_API_BASE || "";

interface ProfilePageProps {
  user: {
    name: string;
    email: string;
    subscription: string;
    stripeStatus: string;
    logoUrl?: string;
    supportEmail?: string;
  };
  activityLogs: ActivityLog[];
  onLogout: () => void;
  setBusinessName: (name: string) => void;
  setBusinessEmail: (email: string) => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({
  user,
  activityLogs,
  onLogout,
  setBusinessName,
  setBusinessEmail,
}) => {
  const [editBusinessName, setEditBusinessName] = useState(user.name || "");
  // Removed Logo URL and Support Email fields
  const [editEmail, setEditEmail] = useState(user.email || "");
  const [profileSaved, setProfileSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleProfileSave = async () => {
    setSaving(true);
    setError("");
    try {
      const companyId = localStorage.getItem("companyId");
      if (!companyId) {
        setError("No company ID found. Please log in again.");
        return;
      }

      // Save business name to Firestore company document
      const base = await getSmsServerUrl().catch(() => API_BASE);
      const url = base
        ? `${base}/api/company/profile`
        : `${API_BASE}/api/company/profile`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          companyName: editBusinessName,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setBusinessName(editBusinessName);
        setBusinessEmail(editEmail);
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2500);
      } else {
        setError(data.error || "Failed to save profile");
      }
    } catch (e: any) {
      console.error("[profile:save:error]", e);
      setError("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen grid-pattern relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-6 lg:py-10">
        {/* Header Section */}
        <div className="mb-8 lg:mb-10">
          <div className="gradient-border premium-card bg-white shadow-lg p-5 lg:p-6 transition-all duration-300 rounded-2xl">
            <div className="space-y-1">
              <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 shadow-lg ring-2 ring-indigo-400/50 text-white pulse-scale"
                  style={{
                    boxShadow:
                      "0 0 20px rgba(99, 102, 241, 0.4), 0 4px 6px -1px rgba(99, 102, 241, 0.3)",
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                Profile
              </h2>
              <p className="text-sm text-gray-600">
                Manage your business profile and view recent activity.
              </p>
            </div>
          </div>
        </div>

        {/* Profile Card */}
        <div className="mb-8 lg:mb-10">
          <div className="gradient-border glow-on-hover premium-card bg-white shadow-lg transition-all duration-300 hover:shadow-xl rounded-2xl">
            <div className="relative p-8 md:p-12 flex flex-col items-center">
              {/* Logo avatar */}
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-gradient-to-tr from-indigo-500 via-purple-500 to-indigo-600 rounded-full p-1.5 shadow-xl ring-4 ring-indigo-400/30">
                <div className="w-28 h-28 rounded-full bg-white flex items-center justify-center overflow-hidden border-4 border-gray-100">
                  <span className="text-5xl text-indigo-600 font-bold">
                    {editBusinessName?.[0]?.toUpperCase() || "B"}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 mt-16 w-full">
                <div className="text-3xl lg:text-4xl font-bold text-gray-900 mb-1 tracking-tight text-center">
                  {editBusinessName || "Business Owner"}
                </div>
                <div className="text-gray-600 text-base lg:text-lg mb-1 text-center">
                  {user.email}
                </div>
                <span className="text-xs text-indigo-700 font-semibold bg-indigo-100 border border-indigo-200 px-4 py-1 rounded-full mb-2">
                  Subscription: {user.subscription}
                </span>
              </div>
              <div className="w-full border-t border-gray-200 my-6"></div>
              <form className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Business Name
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all bg-white shadow-sm"
                    value={editBusinessName}
                    onChange={(e) => setEditBusinessName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all bg-white shadow-sm"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>
              </form>
              {error && (
                <div className="w-full mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div className="flex items-center gap-4 mt-8 w-full">
                <button
                  className="bg-gray-900 text-white px-8 py-2.5 rounded-lg hover:bg-gray-800 font-semibold shadow-md transition-all text-base inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleProfileSave}
                  type="button"
                  disabled={saving}
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {saving ? "Saving..." : "Save Profile"}
                </button>
                {profileSaved && (
                  <span className="text-green-600 font-semibold flex items-center gap-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Saved!
                  </span>
                )}
                <button
                  className="ml-auto bg-white border border-gray-200 px-8 py-2.5 rounded-lg hover:bg-gray-50 text-base font-semibold shadow-sm transition-all text-gray-900"
                  onClick={onLogout}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
