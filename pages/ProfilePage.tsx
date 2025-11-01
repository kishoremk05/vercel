import React, { useState, useEffect, useMemo } from "react";
import SEO from "../components/SEO";
import { ActivityLog } from "../types";
import { getSmsServerUrl } from "../lib/firebaseConfig";
import {
  getFirebaseDb,
  getFirebaseAuth,
  initializeFirebase,
} from "../lib/firebaseClient";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import {
  getClientByAuthUid,
  getClientProfile,
  getClientBillingSubscription,
} from "../lib/firestoreClient";

const API_BASE = import.meta.env.VITE_API_BASE || "";

// Known plan metadata used to render friendly names and SMS allocation
const PLAN_METADATA: Record<
  string,
  { name: string; smsCredits: number; price?: number }
> = {
  starter_1m: { name: "Starter", smsCredits: 250, price: 30 },
  monthly: { name: "Starter", smsCredits: 250, price: 30 },
  growth_3m: { name: "Growth", smsCredits: 600, price: 75 },
  quarterly: { name: "Growth", smsCredits: 600, price: 75 },
  pro_6m: { name: "Professional", smsCredits: 900, price: 100 },
  halfyearly: { name: "Professional", smsCredits: 900, price: 100 },
};

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
  messagesSentThisMonth?: number;
}

const ProfilePage: React.FC<ProfilePageProps> = ({
  user,
  activityLogs,
  onLogout,
  setBusinessName,
  setBusinessEmail,
  messagesSentThisMonth,
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
  const [claimReconciled, setClaimReconciled] = useState<{
    at: number;
    message?: string;
  } | null>(null);
  // Render-time subscription which may merge Firestore data with
  // client-side pending/legacy local values so the UI shows the
  // plan the user selected (pendingPlan / local subscription) when
  // Firestore contains an ambiguous value like "Custom".
  const [displaySubscription, setDisplaySubscription] = useState<any>(null);

  // Derive authoritative 'sent' count from dashboard activity logs when
  // available so the Profile page shows the same "Sent" number as the
  // Dashboard. Prefer the parent-provided messagesSentThisMonth when
  // available so both pages (Dashboard and Profile) use the exact same
  // computation/authority.
  const activityMessagesSentThisMonth = useMemo(() => {
    try {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return (
        (activityLogs || [])
          .filter(
            (log) =>
              (log.action || "")
                .toLowerCase()
                .includes("sent review request") ||
              (log.action || "").toLowerCase().includes("sent sms") ||
              (log.action || "").toLowerCase().includes("resend sms")
          )
          .filter((l) => new Date(l.timestamp) >= firstDay).length || 0
      );
    } catch (e) {
      return 0;
    }
  }, [activityLogs]);

  // Server-provided authoritative monthly message count (persistent
  // across reloads). We will prefer this value when available so the
  // Profile page mirrors the Dashboard's persisted count. However, the
  // highest priority source is a parent-provided computation (passed
  // from App) so Dashboard and Profile always match exactly.
  const [serverMessageCount, setServerMessageCount] = useState<number | null>(
    null
  );

  // Always use the current Firebase user's UID as companyId for Firestore profile/subscription
  const deriveCompanyId = async (): Promise<string | null> => {
    try {
      initializeFirebase();
      const auth = getFirebaseAuth();
      const waitForAuth = (authObj: any, timeoutMs = 5000) =>
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
      const current = await waitForAuth(getFirebaseAuth(), 3000);
      if (current && current.uid) {
        return current.uid;
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  // Fetch messages from server and compute the count for the current month.
  const fetchServerMonthlyCount = async (companyId: string) => {
    try {
      const base = await getSmsServerUrl().catch(() => API_BASE);
      const url = base
        ? `${base}/api/dashboard/messages?companyId=${companyId}`
        : `/api/dashboard/messages?companyId=${companyId}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json().catch(() => ({} as any));
      const messages = Array.isArray(json.messages) ? json.messages : [];
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const count = messages.filter((m: any) => {
        try {
          const ts = m.timestamp ? new Date(m.timestamp) : null;
          return ts && ts >= firstDay;
        } catch {
          return false;
        }
      }).length;
      try {
        localStorage.setItem("serverMessagesSentThisMonth", String(count));
      } catch {}
      setServerMessageCount(count);
      return count;
    } catch (e) {
      console.warn("[Profile] fetchServerMonthlyCount failed:", e);
      return null;
    }
  };

  // On mount and when relevant events fire, refresh the server monthly
  // count so Profile shows the same authoritative number as Dashboard.
  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        try {
          const cached = localStorage.getItem("serverMessagesSentThisMonth");
          if (cached && mounted) setServerMessageCount(Number(cached));
        } catch {}

        let companyId: string | null = await deriveCompanyId();
        if (companyId && mounted) {
          await fetchServerMonthlyCount(companyId);
        }
      } catch (e) {
        /* ignore */
      }
    };

    refresh();

    const handler = () => {
      setTimeout(() => {
        refresh();
      }, 800);
    };

    window.addEventListener("dash:sms:success", handler as any);
    window.addEventListener("subscription:updated", handler as any);
    window.addEventListener("auth:ready", handler as any);

    return () => {
      mounted = false;
      try {
        window.removeEventListener("dash:sms:success", handler as any);
        window.removeEventListener("subscription:updated", handler as any);
        window.removeEventListener("auth:ready", handler as any);
      } catch {}
    };
  }, []);

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

  // Ensure the profile page URL includes the clientId query param so
  // links opened from external sources include the client context.
  // Prefer localStorage.companyId / auth_uid, otherwise derive via Firebase.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("clientId")) return;

      const fromStorage =
        localStorage.getItem("companyId") || localStorage.getItem("auth_uid");
      if (fromStorage) {
        url.searchParams.set("clientId", fromStorage);
        window.history.replaceState(window.history.state, "", url.toString());
        return;
      }

      // Fallback: try to derive companyId from Firebase auth
      (async () => {
        try {
          const cid = await deriveCompanyId();
          if (cid) {
            try {
              const u = new URL(window.location.href);
              if (!u.searchParams.get("clientId")) {
                u.searchParams.set("clientId", cid);
                window.history.replaceState(
                  window.history.state,
                  "",
                  u.toString()
                );
              }
            } catch (e) {
              // ignore
            }
          }
        } catch (e) {
          // ignore
        }
      })();
    } catch (e) {
      // ignore
    }
  }, []);

  // Always use Firestore subscriptionData for display; never fall back to localStorage
  useEffect(() => {
    if (!subscriptionData) {
      setDisplaySubscription(null);
      return;
    }
    // Only show if planName/planId is present and not ambiguous
    const planId = subscriptionData.planId || null;
    const planName = subscriptionData.planName || null;
    if (
      planId &&
      planName &&
      planName !== "Custom" &&
      planName !== "N/A" &&
      planId !== "custom" &&
      planId !== "N/A"
    ) {
      setDisplaySubscription(subscriptionData);
    } else {
      setDisplaySubscription(null);
    }
  }, [subscriptionData]);

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
        let companyId: string | null = await deriveCompanyId();
        if (!companyId) {
          setLoadingSubscription(false);
          return;
        }

        // Helper: subscribe to profile/main and billing/subscription for
        // the provided companyId. If we receive a permission error we
        // attempt to fall back to the authenticated user's client id.
        const db = getFirebaseDb();
        const subscribeForCompany = async (cid: string) => {
          try {
            const profileRef = doc(db, "clients", cid, "profile", "main");
            const billingRef = doc(
              db,
              "clients",
              cid,
              "billing",
              "subscription"
            );

            // Unsubscribe existing listeners before re-subscribing
            try {
              if (unsubProfile) unsubProfile();
            } catch {}
            try {
              if (unsubBilling) unsubBilling();
            } catch {}

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
                    try {
                      // Mark a short-lived local flag so other tabs can
                      // immediately update their UI while Firestore remains
                      // the true source of authority for sends.
                      try {
                        localStorage.setItem(
                          "profile_subscription_present",
                          JSON.stringify({ companyId: cid, ts: Date.now() })
                        );
                      } catch {}
                      window.dispatchEvent(new Event("subscription:updated"));
                    } catch {}
                  } else {
                    // Document exists but contains no plan info. Try a
                    // fallback: derive the client's own document (by auth
                    // UID) and re-subscribe to that so the UI displays the
                    // client-side saved subscription.
                    (async () => {
                      try {
                        const auth = getFirebaseAuth();
                        const current = await waitForAuth(auth, 3000);
                        if (current) {
                          const mapped = await getClientByAuthUid(
                            current.uid
                          ).catch(() => null);
                          if (mapped && mapped.id && mapped.id !== cid) {
                            console.log(
                              "[Profile] Server profile lacks plan; resubscribing to auth-owned client:",
                              mapped.id
                            );
                            try {
                              localStorage.setItem("companyId", mapped.id);
                            } catch {}
                            subscribeForCompany(mapped.id);
                            return;
                          }
                        }
                      } catch (e) {
                        console.warn(
                          "[Profile] fallback derive companyId during empty profile:",
                          e
                        );
                      }
                    })();
                  }
                }
                setLoadingSubscription(false);
              },
              async (err) => {
                console.warn("[Profile] profile onSnapshot error:", err);
                // If permission denied, try to fall back to the client's
                // auth-UID-based document which the user should have access to.
                if (
                  err &&
                  (err.code === "permission-denied" ||
                    (err.message &&
                      err.message.includes(
                        "Missing or insufficient permissions"
                      )))
                ) {
                  try {
                    const auth = getFirebaseAuth();
                    const current = await waitForAuth(auth, 10000);
                    if (current) {
                      const mapped = await getClientByAuthUid(
                        current.uid
                      ).catch(() => null);
                      if (mapped && mapped.id && mapped.id !== cid) {
                        try {
                          localStorage.setItem("companyId", mapped.id);
                        } catch {}
                        subscribeForCompany(mapped.id);
                        return;
                      }
                    }
                  } catch (fallbackErr) {
                    console.warn(
                      "[Profile] Fallback derive companyId failed:",
                      fallbackErr
                    );
                  }
                }
                setLoadingSubscription(false);
              }
            );

            // Attempt an initial read of the billing doc first. If the
            // initial read fails due to permission-denied we will not
            // subscribe to the billing onSnapshot so we avoid spamming
            // the console with repeated permission errors for protected
            // billing documents. The Profile/main doc remains the
            // primary source for client-visible subscription info.
            try {
              const initialBilling = await getClientBillingSubscription(
                cid
              ).catch(() => null);
              if (initialBilling) {
                // Set subscription data immediately from billing and
                // subscribe for realtime updates
                const formattedData = {
                  planId: initialBilling.planId || null,
                  planName: initialBilling.planName || null,
                  smsCredits:
                    initialBilling.smsCredits ||
                    initialBilling.remainingCredits ||
                    0,
                  status: initialBilling.status || "active",
                  price: initialBilling.price,
                  startDate: initialBilling.startDate,
                  expiryDate: initialBilling.endDate,
                  remainingCredits:
                    initialBilling.remainingCredits ||
                    initialBilling.smsCredits ||
                    0,
                };
                setSubscriptionData(formattedData);
                try {
                  try {
                    localStorage.setItem(
                      "profile_subscription_present",
                      JSON.stringify({ companyId: cid, ts: Date.now() })
                    );
                  } catch {}
                  window.dispatchEvent(new Event("subscription:updated"));
                } catch {}

                unsubBilling = onSnapshot(
                  billingRef,
                  (snap) => {
                    if (snap.exists()) {
                      const b = snap.data();
                      console.log("[Profile] billing/subscription changed:", b);
                      const formatted = {
                        planId: b.planId || null,
                        planName: b.planName || null,
                        smsCredits: b.smsCredits || b.remainingCredits || 0,
                        status: b.status || "active",
                        price: b.price,
                        startDate: b.startDate,
                        expiryDate: b.endDate,
                        remainingCredits:
                          b.remainingCredits || b.smsCredits || 0,
                      };
                      setSubscriptionData(formatted);
                      try {
                        try {
                          localStorage.setItem(
                            "profile_subscription_present",
                            JSON.stringify({ companyId: cid, ts: Date.now() })
                          );
                        } catch {}
                        window.dispatchEvent(new Event("subscription:updated"));
                      } catch {}
                    }
                    setLoadingSubscription(false);
                  },
                  (err) => {
                    // If permission denied, treat as benign (billing
                    // is intentionally restricted) and do not resubscribe
                    // — log at debug level to reduce noise.
                    if (
                      err &&
                      (err.code === "permission-denied" ||
                        (err.message &&
                          err.message.includes(
                            "Missing or insufficient permissions"
                          )))
                    ) {
                      console.debug(
                        "[Profile] billing subscription permission denied, skipping realtime listen"
                      );
                    } else {
                      console.warn("[Profile] billing onSnapshot error:", err);
                    }
                    setLoadingSubscription(false);
                  }
                );
              } else {
                // No billing doc accessible — skip realtime billing subscription
                console.debug(
                  "[Profile] billing doc not accessible for company",
                  cid
                );
                setLoadingSubscription(false);
              }
            } catch (billingErr) {
              // If any unexpected error occurs, fallback gracefully.
              console.debug(
                "[Profile] billing read/subscribe failed (ignored):",
                billingErr
              );
              setLoadingSubscription(false);
            }
          } catch (firebaseError) {
            console.warn("[Profile] Firestore subscribe error:", firebaseError);
            setLoadingSubscription(false);
          }
        };

        // Before subscribing to the stored/companyId doc, try a direct
        // read of the authenticated user's profile document. This
        // prioritizes the client-owned doc (clients/{authUid}/profile/main)
        // where PaymentSuccess writes the subscription for immediate UI
        // consistency.
        try {
          const auth = getFirebaseAuth();
          const me = await waitForAuth(auth, 3000);
          if (me && me.uid) {
            try {
              const myProfile = await getClientProfile(me.uid).catch(
                () => null
              );
              if (
                myProfile &&
                (myProfile.planId || myProfile.plan || myProfile.planName)
              ) {
                console.log(
                  "[Profile] Found subscription in auth-owned profile, using clients/" +
                    me.uid +
                    "/profile/main"
                );
                const formattedData = {
                  planId: myProfile.planId || myProfile.plan || null,
                  planName:
                    myProfile.planName ||
                    myProfile.name ||
                    myProfile.plan ||
                    null,
                  smsCredits:
                    myProfile.smsCredits || myProfile.remainingCredits || 0,
                  status: myProfile.status || "active",
                  price: myProfile.price,
                  startDate: myProfile.activatedAt || myProfile.startDate,
                  expiryDate: myProfile.expiryAt || myProfile.endDate,
                  remainingCredits:
                    myProfile.remainingCredits || myProfile.smsCredits || 0,
                };
                setSubscriptionData(formattedData);
                try {
                  try {
                    localStorage.setItem(
                      "profile_subscription_present",
                      JSON.stringify({ companyId: me.uid, ts: Date.now() })
                    );
                  } catch {}
                  window.dispatchEvent(new Event("subscription:updated"));
                } catch {}
                // If the auth-owned profile does not include SMS credits
                // but a canonical subscription may exist at company-level,
                // attempt to claim it server-side using the user's email so
                // the client-visible profile shows credits after logout/login.
                (async () => {
                  try {
                    const smsServer = await getSmsServerUrl().catch(() => "");
                    if (!smsServer) return;
                    const userEmail = me?.email || null;
                    // Only attempt if we don't already have positive credits
                    const hasCredits =
                      Number(formattedData.smsCredits || 0) > 0 ||
                      Number(formattedData.remainingCredits || 0) > 0;
                    if (!userEmail || hasCredits) return;

                    const claimHeaders: any = {
                      "Content-Type": "application/json",
                    };
                    try {
                      const token = await me.getIdToken();
                      if (token) claimHeaders.Authorization = `Bearer ${token}`;
                    } catch {}
                    claimHeaders["x-user-email"] = userEmail;

                    const claimRes = await fetch(
                      `${smsServer}/api/subscription/claim`,
                      {
                        method: "POST",
                        headers: claimHeaders,
                        body: JSON.stringify({ userEmail }),
                      }
                    );
                    if (!claimRes.ok) return;
                    const claimJson = await claimRes
                      .json()
                      .catch(() => ({} as any));
                    if (
                      claimJson &&
                      claimJson.success &&
                      claimJson.subscription
                    ) {
                      const srv = claimJson.subscription;
                      const merged: any = { ...formattedData };
                      merged.smsCredits = Number(
                        srv.smsCredits ||
                          srv.remainingCredits ||
                          merged.smsCredits ||
                          0
                      );
                      merged.remainingCredits = Number(
                        srv.remainingCredits ||
                          srv.smsCredits ||
                          merged.remainingCredits ||
                          merged.smsCredits ||
                          0
                      );
                      merged.startDate =
                        merged.startDate ||
                        srv.startDate ||
                        srv.activatedAt ||
                        srv.activatedAt ||
                        null;
                      merged.expiryDate =
                        merged.expiryDate ||
                        srv.endDate ||
                        srv.expiryAt ||
                        srv.expiryAt ||
                        null;
                      // Persist companyId when returned
                      if (claimJson.companyId) {
                        try {
                          localStorage.setItem(
                            "companyId",
                            String(claimJson.companyId)
                          );
                          localStorage.setItem(
                            "serverCompanyId",
                            String(claimJson.companyId)
                          );
                        } catch {}
                      }
                      setSubscriptionData(merged);
                      setDisplaySubscription(merged);
                      // Mark that we reconciled via server claim so the UI
                      // can notify the user (helps operators and debugging)
                      setClaimReconciled({
                        at: Date.now(),
                        message: "Credits reconciled from server",
                      });
                      try {
                        window.dispatchEvent(
                          new CustomEvent("subscription:claimed", {
                            detail: { companyId: claimJson.companyId || null },
                          })
                        );
                        window.dispatchEvent(new Event("subscription:updated"));
                      } catch {}
                      // Auto-hide banner after 8s
                      setTimeout(() => setClaimReconciled(null), 8000);
                    }
                  } catch (e) {
                    console.warn(
                      "[Profile] claim subscription attempt failed:",
                      e
                    );
                  }
                })();
                try {
                  localStorage.setItem("companyId", me.uid);
                } catch {}
                // Also subscribe to the auth-owned doc for realtime updates
                subscribeForCompany(me.uid);
                setLoadingSubscription(false);
                return;
              }
            } catch (readErr) {
              console.warn(
                "[Profile] Direct auth-owned profile read failed:",
                readErr
              );
            }
          }
        } catch (e) {
          console.warn(
            "[Profile] Error during direct auth-owned profile check:",
            e
          );
        }

        // Start subscriptions for the companyId we derived earlier
        subscribeForCompany(companyId);
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

      // Get ID token from current user so server can verify ownership
      let idToken: string | null = null;
      try {
        initializeFirebase();
        const au = getFirebaseAuth().currentUser;
        if (au) {
          idToken = await au.getIdToken();
        }
      } catch (tokenErr) {
        console.warn("[profile:delete] Failed to obtain ID token:", tokenErr);
      }

      const base = await getSmsServerUrl().catch(() => API_BASE);
      const url = base
        ? `${base}/api/account/delete`
        : `${API_BASE}/api/account/delete`;

      const headers: any = { "Content-Type": "application/json" };
      if (idToken) headers.Authorization = `Bearer ${idToken}`;

      // Include email as additional hint for server-side deletion
      let userEmail: string | null = null;
      try {
        const au = getFirebaseAuth().currentUser;
        userEmail = au?.email || null;
      } catch {}

      const response = await fetch(url, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ companyId, auth_uid, userEmail }),
      });

      const data = await response.json();

      if (data.success) {
        // Clear relevant localStorage keys to avoid resurrecting a deleted
        // profile from stale client-side state.
        try {
          localStorage.removeItem("companyId");
          localStorage.removeItem("serverCompanyId");
          localStorage.removeItem("auth_uid");
          localStorage.removeItem("subscription");
          localStorage.removeItem("pendingPlan");
          localStorage.removeItem("profile_subscription_present");
          localStorage.removeItem("businessName");
          localStorage.removeItem("businessNameUpdatedAt");
          localStorage.removeItem("profilePhoto");
        } catch {}
        try {
          // Ensure the client signs out of Firebase so cached auth state
          // does not remain after the server removed the auth user.
          initializeFirebase();
          const auth = getFirebaseAuth();
          if (auth && auth.signOut) {
            try {
              await auth.signOut();
            } catch (signOutErr) {
              // If signOut fails, ignore - we still clear local storage below.
              console.warn(
                "[profile:delete] firebase signOut failed:",
                signOutErr?.message || signOutErr
              );
            }
          }
        } catch (e) {
          // ignore any sign-out errors
        }

        try {
          sessionStorage.clear();
        } catch {}

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
    <>
      <SEO
        title="Profile | ReputationFlow360"
        description="Manage your ReputationFlow360 profile, subscription, and account settings. View your plan details and SMS credits."
        canonical="https://reputationflow360.com/profile"
        keywords="profile, account settings, subscription management, user profile"
        noindex={true}
      />
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
                  {/* Prefer the merged displaySubscription which may reflect
                    the user's selected plan (pending/local) when server
                    shows an ambiguous value such as 'Custom'. */}
                  {(() => {
                    const effective =
                      displaySubscription || subscriptionData || null;
                    const planSource = effective?.planSource;
                    return (
                      <span className="text-xs text-indigo-700 font-semibold bg-indigo-100 border border-indigo-200 px-4 py-1 rounded-full mb-2">
                        Subscription:{" "}
                        {effective?.planName || user.subscription || "Free"}
                        {planSource && (
                          <span className="ml-2 text-xs text-gray-500">
                            (source: {planSource})
                          </span>
                        )}
                      </span>
                    );
                  })()}
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
                  ) : displaySubscription || subscriptionData ? (
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
                          {displaySubscription?.planName ||
                            subscriptionData.planName ||
                            "N/A"}
                        </p>
                        {(displaySubscription?.price ||
                          subscriptionData.price) && (
                          <p className="text-lg font-semibold text-indigo-600 mt-1">
                            $
                            {displaySubscription?.price ||
                              subscriptionData.price}
                          </p>
                        )}
                      </div>

                      {/* Status card removed per design request */}

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
                            const eff = displaySubscription || subscriptionData;
                            const value = eff?.startDate;
                            if (value?.toDate) {
                              return new Date(
                                value.toDate()
                              ).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              });
                            }
                            if (value?._seconds) {
                              return new Date(
                                value._seconds * 1000
                              ).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              });
                            }
                            if (typeof value === "string" && value) {
                              try {
                                return new Date(value).toLocaleDateString(
                                  "en-US",
                                  {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  }
                                );
                              } catch {}
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
                            const eff = displaySubscription || subscriptionData;
                            const value = eff?.expiryDate;
                            if (value?.toDate) {
                              return new Date(
                                value.toDate()
                              ).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              });
                            }
                            if (value?._seconds) {
                              return new Date(
                                value._seconds * 1000
                              ).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              });
                            }
                            if (typeof value === "string" && value) {
                              try {
                                return new Date(value).toLocaleDateString(
                                  "en-US",
                                  {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  }
                                );
                              } catch {}
                            }
                            return "N/A";
                          })()}
                        </p>
                      </div>
                      {/* SMS Credits */}
                      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-lg border border-indigo-200">
                        <div className="flex items-center gap-2 mb-2">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="w-5 h-5 text-indigo-600"
                          >
                            <path d="M3 5a1 1 0 011-1h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V5z" />
                            <path d="M7 9h10v2H7V9z" />
                          </svg>
                          <span className="text-sm font-semibold text-gray-700">
                            SMS Credits
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">
                          {displaySubscription?.smsCredits ??
                            subscriptionData.smsCredits ??
                            "N/A"}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Remaining:{" "}
                          {displaySubscription?.remainingCredits ??
                            subscriptionData.remainingCredits ??
                            "N/A"}
                        </p>
                        <div className="mt-2">
                          <SmsCreditsDisplay
                            subscriptionData={
                              displaySubscription || subscriptionData
                            }
                            messagesSentThisMonth={
                              typeof messagesSentThisMonth === "number"
                                ? messagesSentThisMonth
                                : serverMessageCount !== null
                                ? serverMessageCount
                                : activityMessagesSentThisMonth
                            }
                          />
                        </div>
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
                      Deleting your account is permanent and cannot be undone.
                      All your data, including customers, messages, and
                      subscription will be deleted.
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
                    Type <span className="text-red-600 font-mono">DELETE</span>{" "}
                    to confirm:
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
    </>
  );
};

// SMS Credits display component - shows sent count derived from subscription
const SmsCreditsDisplay: React.FC<{
  subscriptionData: any;
  messagesSentThisMonth?: number;
}> = ({ subscriptionData, messagesSentThisMonth }) => {
  const [remainingCount, setRemainingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    try {
      if (!subscriptionData) {
        setRemainingCount(0);
        return;
      }
      if (
        typeof messagesSentThisMonth === "number" &&
        messagesSentThisMonth >= 0
      ) {
        // Calculate remaining SMS count based on dashboard's sent count
        const total = Number(
          subscriptionData.smsCredits ?? subscriptionData.totalCredits ?? 0
        );
        const remaining = Math.max(0, total - messagesSentThisMonth);
        setRemainingCount(remaining);
      } else {
        setRemainingCount(null);
      }
    } catch (e) {
      console.warn("[SmsCreditsDisplay] compute error:", e);
      setRemainingCount(0);
    } finally {
      setLoading(false);
    }
  }, [subscriptionData, messagesSentThisMonth]);

  if (loading) return <div className="text-sm text-gray-500">Loading...</div>;
  return (
    <div className="text-sm text-gray-600">
      Remaining SMS: {remainingCount ?? "N/A"}
    </div>
  );
};

export default ProfilePage;
