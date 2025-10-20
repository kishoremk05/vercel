import React, { useState, useEffect } from "react";
import { ActivityLog } from "../types";
import { getSmsServerUrl } from "../lib/firebaseConfig";
import {
  getFirebaseDb,
  getFirebaseAuth,
  initializeFirebase,
} from "../lib/firebaseClient";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

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
  const [profilePhoto, setProfilePhoto] = useState<string>("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);

  // Load profile photo from localStorage on mount (Firebase upload handled separately)
  useEffect(() => {
    try {
      const savedPhoto = localStorage.getItem("profilePhoto");
      if (savedPhoto) {
        setProfilePhoto(savedPhoto);
      }
    } catch (error) {
      console.error("Error loading profile photo from localStorage:", error);
    }
  }, []);

  // Load subscription data from Firebase Firestore (cross-device) - PRIMARY SOURCE
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubBilling: (() => void) | null = null;

    const waitForAuth = (authObj: any, timeoutMs = 10000) =>
      new Promise<any>((resolve) => {
        if (authObj.currentUser) return resolve(authObj.currentUser);
        const unsubscribe = authObj.onAuthStateChanged((user: any) => {
          if (user) {
            try {
              unsubscribe();
            } catch {}
            return resolve(user);
          }
        });
        setTimeout(() => {
          try {
            unsubscribe();
          } catch {}
          return resolve(authObj.currentUser || null);
        }, timeoutMs);
      });

    const loadSubscriptionData = async () => {
      try {
        let companyId = null;
        try {
          companyId = localStorage.getItem("companyId");
        } catch {}

        // If companyId isn't in localStorage (redirects can clear it), try
        // to derive it from the server via /auth/me using the current
        // Firebase ID token. This allows the Profile page to show
        // subscription data even when localStorage was lost during
        // hosted-checkout redirects.
        if (!companyId) {
          try {
            initializeFirebase();
            const auth = getFirebaseAuth();
            const user = await waitForAuth(auth, 10000);
            if (user) {
              const baseLocal = await getSmsServerUrl().catch(() => "");
              if (baseLocal) {
                const idToken = await user.getIdToken();
                const meResp = await fetch(`${baseLocal}/auth/me`, {
                  headers: { Authorization: `Bearer ${idToken}` },
                });
                if (meResp.ok) {
                  const meJson = await meResp.json().catch(() => ({}));
                  companyId = meJson.companyId || null;
                  if (companyId) {
                    try {
                      localStorage.setItem("companyId", companyId);
                    } catch {}
                  }
                }
              }
            }
          } catch (e) {
            console.warn(
              "[Profile] Failed to derive companyId from auth/me:",
              e
            );
          }
        }
        if (!companyId) {
          setLoadingSubscription(false);
          return;
        }

        // Subscribe to the canonical Firestore profile document so the
        // UI updates in real-time when the server/admin writes subscription
        // data (preferred over polling /api/subscription which can fail
        // with a 502 if the API is temporarily unreachable).
        try {
          const db = getFirebaseDb();
          const profileRef = doc(db, "clients", companyId, "profile", "main");

          // Listen to both `profile/main` (preferred) and `billing/subscription`
          // (fallback) in real-time. Profile/main wins when it contains a
          // plan; billing/subscription is used only when profile/main is
          // empty or doesn't provide enough information.
          const billingRef = doc(
            db,
            "clients",
            companyId,
            "billing",
            "subscription"
          );

          unsubProfile = onSnapshot(
            profileRef,
            (snap) => {
              if (snap.exists()) {
                const firebaseData = snap.data();
                console.log("[Profile] profile/main changed:", firebaseData);
                const hasPlan = !!(
                  firebaseData.planId ||
                  firebaseData.plan ||
                  firebaseData.planName
                );
                if (hasPlan) {
                  const formattedData = {
                    planId: firebaseData.planId || firebaseData.plan || null,
                    planName:
                      firebaseData.planName ||
                      firebaseData.name ||
                      firebaseData.plan ||
                      null,
                    smsCredits:
                      firebaseData.smsCredits ||
                      firebaseData.remainingCredits ||
                      (firebaseData.price &&
                        (firebaseData.price === 75
                          ? 600
                          : firebaseData.price === 100
                          ? 900
                          : 250)) ||
                      0,
                    status: firebaseData.status || "active",
                    price: firebaseData.price,
                    startDate:
                      firebaseData.activatedAt || firebaseData.startDate,
                    expiryDate: firebaseData.expiryAt || firebaseData.endDate,
                    remainingCredits:
                      firebaseData.remainingCredits ||
                      firebaseData.smsCredits ||
                      0,
                  };
                  setSubscriptionData(formattedData);
                }
              }
              setLoadingSubscription(false);
            },
            (err) => {
              console.warn("[Profile] profile onSnapshot error:", err);
              setLoadingSubscription(false);
            }
          );

          unsubBilling = onSnapshot(
            billingRef,
            (snap) => {
              if (snap.exists()) {
                const b = snap.data();
                console.log("[Profile] billing/subscription changed:", b);
                // Only set billing fallback if profile/main is not already
                // providing plan information. We can't easily check profile
                // snapshot state from here, so always set billing data when
                // it exists; profile snapshot will overwrite when it arrives.
                const formattedData = {
                  planId: b.planId || null,
                  planName: b.planName || null,
                  smsCredits: b.smsCredits || b.remainingCredits || 0,
                  status: b.status || "active",
                  price: b.price,
                  startDate: b.startDate,
                  expiryDate: b.endDate,
                  remainingCredits: b.remainingCredits || b.smsCredits || 0,
                };
                setSubscriptionData(formattedData);
              }
              setLoadingSubscription(false);
            },
            (err) => {
              console.warn("[Profile] billing onSnapshot error:", err);
              setLoadingSubscription(false);
            }
          );

          // listeners are assigned to outer-scoped variables; cleanup
          // will be handled by the effect's return function below.
        } catch (firebaseError) {
          console.warn("[Profile] Firestore subscribe error:", firebaseError);
          setLoadingSubscription(false);
        }
      } catch (error) {
        console.error("Error loading subscription data:", error);
      } finally {
        setLoadingSubscription(false);
      }
    };

    loadSubscriptionData();

    return () => {
      try {
        if (unsubProfile) unsubProfile();
      } catch {}
      try {
        if (unsubBilling) unsubBilling();
      } catch {}
    };
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size should be less than 5MB");
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
      return;
    }

    setUploadingPhoto(true);
    setError("");

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Image = reader.result as string;

          // Save to localStorage (no API call needed)
          localStorage.setItem("profilePhoto", base64Image);
          setProfilePhoto(base64Image);
          setProfileSaved(true);
          setTimeout(() => setProfileSaved(false), 2500);
          console.log("✅ Profile photo saved to localStorage");
        } catch (e: any) {
          console.error("[photo:upload:error]", e);
          setError("Failed to save photo. Please try again.");
          setShowError(true);
          setTimeout(() => setShowError(false), 3000);
        } finally {
          setUploadingPhoto(false);
        }
      };

      reader.onerror = () => {
        setError("Failed to read image file");
        setShowError(true);
        setTimeout(() => setShowError(false), 3000);
        setUploadingPhoto(false);
      };

      reader.readAsDataURL(file);
    } catch (e: any) {
      console.error("[photo:upload:error]", e);
      setError("Failed to upload photo. Please try again.");
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
      setUploadingPhoto(false);
    }
  };

  const [showError, setShowError] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== "delete") {
      setError('Please type "DELETE" to confirm');
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      const companyId = localStorage.getItem("companyId");
      const auth_uid = localStorage.getItem("auth_uid");

      if (!companyId || !auth_uid) {
        setError("No account information found. Please log in again.");
        setShowError(true);
        setTimeout(() => setShowError(false), 3000);
        return;
      }

      const base = await getSmsServerUrl().catch(() => API_BASE);
      const url = base
        ? `${base}/api/account/delete`
        : `${API_BASE}/api/account/delete`;

      const response = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          auth_uid,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Clear all localStorage
        localStorage.clear();
        sessionStorage.clear();

        // Redirect to home
        window.location.href = "/";
      } else {
        setError(data.error || "Failed to delete account");
        setShowError(true);
        setTimeout(() => setShowError(false), 5000);
      }
    } catch (e: any) {
      console.error("[account:delete:error]", e);
      setError("Failed to delete account. Please try again.");
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
    } finally {
      setIsDeleting(false);
    }
  };

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
        try {
          // Persist businessName locally so other parts of the app read the
          // newly edited value immediately and don't get reverted by a
          // near-simultaneous background profile sync.
          localStorage.setItem("businessName", editBusinessName);
          // Mark the time of this local edit so App.tsx can avoid overwriting
          // with a server value fetched within a short window.
          localStorage.setItem("businessNameUpdatedAt", String(Date.now()));
        } catch {}
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
              {/* Logo avatar with photo upload */}
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-gradient-to-tr from-indigo-500 via-purple-500 to-indigo-600 rounded-full p-1.5 shadow-xl ring-4 ring-indigo-400/30">
                <div className="w-28 h-28 rounded-full bg-white flex items-center justify-center overflow-hidden border-4 border-gray-100 relative group">
                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt={editBusinessName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-5xl text-indigo-600 font-bold">
                      {editBusinessName?.[0]?.toUpperCase() || "B"}
                    </span>
                  )}
                  {/* Upload overlay */}
                  <label
                    htmlFor="photo-upload"
                    className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    {uploadingPhoto ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-8 h-8 text-white"
                      >
                        <path d="M12 9a3.75 3.75 0 100 7.5A3.75 3.75 0 0012 9z" />
                        <path
                          fillRule="evenodd"
                          d="M9.344 3.071a49.52 49.52 0 015.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 01-3 3h-15a3 3 0 01-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 001.11-.71l.822-1.315a2.942 2.942 0 012.332-1.39zM6.75 12.75a5.25 5.25 0 1110.5 0 5.25 5.25 0 01-10.5 0zm12-1.5a.75.75 0 100-1.5.75.75 0 000 1.5z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    <input
                      id="photo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                    />
                  </label>
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
                  Subscription:{" "}
                  {subscriptionData?.planName || user.subscription || "Free"}
                </span>
              </div>
              <div className="w-full border-t border-gray-200 my-6"></div>

              {/* Subscription Payment Details */}
              <div className="w-full space-y-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Payment Details
                </h3>

                {loadingSubscription ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : subscriptionData ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Current Plan and Status containers removed as requested */}

                    {/* Plan Name & Price */}
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-lg border border-indigo-200">
                      <div className="flex items-center gap-2 mb-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-5 h-5 text-indigo-600"
                        >
                          <path d="M10.464 8.746c.227-.18.497-.311.786-.394v2.795a2.252 2.252 0 01-.786-.393c-.394-.313-.546-.681-.546-1.004 0-.323.152-.691.546-1.004zM12.75 15.662v-2.824c.347.085.664.228.921.421.427.32.579.686.579.991 0 .305-.152.671-.579.991a2.534 2.534 0 01-.921.42z" />
                          <path
                            fillRule="evenodd"
                            d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v.816a3.836 3.836 0 00-1.72.756c-.712.566-1.112 1.35-1.112 2.178 0 .829.4 1.612 1.113 2.178.502.4 1.102.647 1.719.756v2.978a2.536 2.536 0 01-.921-.421l-.879-.66a.75.75 0 00-.9 1.2l.879.66c.533.4 1.169.645 1.821.75V18a.75.75 0 001.5 0v-.81a4.124 4.124 0 001.821-.749c.745-.559 1.179-1.344 1.179-2.191 0-.847-.434-1.632-1.179-2.191a4.122 4.122 0 00-1.821-.75V8.354c.29.082.559.213.786.393l.415.33a.75.75 0 00.933-1.175l-.415-.33a3.836 3.836 0 00-1.719-.755V6z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-sm font-semibold text-gray-700">
                          Current Plan
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        {subscriptionData.planName || "N/A"}
                      </p>
                      {subscriptionData.price && (
                        <p className="text-lg font-semibold text-indigo-600 mt-1">
                          ${subscriptionData.price}
                        </p>
                      )}
                    </div>

                    {/* Status */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-5 h-5 text-green-600"
                        >
                          <path
                            fillRule="evenodd"
                            d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-sm font-semibold text-gray-700">
                          Status
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-green-600 capitalize">
                        {subscriptionData.status || "N/A"}
                      </p>
                    </div>

                    {/* Start Date */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-5 h-5 text-gray-600"
                        >
                          <path d="M12.75 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM7.5 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM8.25 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM9.75 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM10.5 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM12.75 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM14.25 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM15 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM16.5 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM15 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM16.5 13.5a.75.75 0 100-1.5.75.75 0 000 1.5z" />
                          <path
                            fillRule="evenodd"
                            d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-sm font-semibold text-gray-700">
                          Start Date
                        </span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">
                        {(() => {
                          if (subscriptionData?.startDate?.toDate) {
                            return new Date(
                              subscriptionData.startDate.toDate()
                            ).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            });
                          }
                          if (subscriptionData?.startDate?._seconds) {
                            return new Date(
                              subscriptionData.startDate._seconds * 1000
                            ).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            });
                          }
                          return "N/A";
                        })()}
                      </p>
                    </div>

                    {/* Expiry Date */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-5 h-5 text-gray-600"
                        >
                          <path
                            fillRule="evenodd"
                            d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-sm font-semibold text-gray-700">
                          Expiry Date
                        </span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">
                        {(() => {
                          if (subscriptionData?.expiryDate?.toDate) {
                            return new Date(
                              subscriptionData.expiryDate.toDate()
                            ).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            });
                          }
                          if (subscriptionData?.expiryDate?._seconds) {
                            return new Date(
                              subscriptionData.expiryDate._seconds * 1000
                            ).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            });
                          }
                          return "N/A";
                        })()}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-600">
                    <p className="text-lg">No subscription data available</p>
                    <p className="text-sm mt-2">
                      Please purchase a plan to get started
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div className="w-full mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div className="flex items-center gap-4 mt-8 w-full flex-wrap justify-end">
                <button
                  className="bg-white border border-gray-200 px-8 py-2.5 rounded-lg hover:bg-gray-50 text-base font-semibold shadow-sm transition-all text-gray-900"
                  onClick={onLogout}
                >
                  Logout
                </button>
              </div>
              {/* Delete Account Section */}
              <div className="w-full border-t border-gray-200 mt-8 pt-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-5">
                  <h3 className="text-lg font-bold text-red-900 mb-2 flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Danger Zone
                  </h3>
                  <p className="text-sm text-red-800 mb-4">
                    Deleting your account is permanent and cannot be undone. All
                    your data, including customers, messages, and subscription
                    will be deleted.
                  </p>
                  <button
                    className="bg-red-600 text-white px-6 py-2.5 rounded-lg hover:bg-red-700 font-semibold shadow-md transition-all text-sm inline-flex items-center gap-2"
                    onClick={() => setShowDeleteModal(true)}
                    type="button"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Delete Account Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-6 w-6 text-red-600"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    Delete Account?
                  </h3>
                  <p className="text-sm text-gray-600">
                    This action cannot be undone. This will permanently delete
                    your account and remove all your data from our servers.
                  </p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800 font-medium mb-2">
                  ⚠️ You will lose:
                </p>
                <ul className="text-xs text-yellow-700 space-y-1 ml-4 list-disc">
                  <li>All customer data and contacts</li>
                  <li>Message history and activity logs</li>
                  <li>Active subscription and SMS credits</li>
                  <li>Business profile and settings</li>
                </ul>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Type <span className="text-red-600 font-mono">DELETE</span> to
                  confirm:
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="DELETE"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-200 font-semibold transition-all"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmText("");
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-lg hover:bg-red-700 font-semibold transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleDeleteAccount}
                  disabled={
                    isDeleting || deleteConfirmText.toLowerCase() !== "delete"
                  }
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-5 w-5"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Delete Forever
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// SMS Credits display component - shows sent count derived from subscription
const SmsCreditsDisplay: React.FC<{ subscriptionData: any }> = ({
  subscriptionData,
}) => {
  const [sentCount, setSentCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    try {
      if (!subscriptionData) {
        setSentCount(0);
        return;
      }
      const total = Number(
        subscriptionData.smsCredits ?? subscriptionData.totalCredits ?? 0
      );
      const remaining = Number(
        subscriptionData.remainingCredits ?? subscriptionData.remaining ?? total
      );
      const sent =
        Number.isFinite(total) && Number.isFinite(remaining)
          ? Math.max(0, total - remaining)
          : 0;
      setSentCount(sent);
    } catch (e) {
      console.warn("[SmsCreditsDisplay] compute error:", e);
      setSentCount(0);
    } finally {
      setLoading(false);
    }
  }, [subscriptionData]);

  if (loading) return <div className="text-sm text-gray-500">Loading...</div>;
  return (
    <div className="text-sm text-gray-600">Sent: {sentCount ?? "N/A"}</div>
  );
};

export default ProfilePage;
