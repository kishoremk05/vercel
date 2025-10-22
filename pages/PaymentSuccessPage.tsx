// Utility: Call this after account deletion to clear all localStorage keys related to company/profile
function clearProfileLocalStorage() {
  try {
    localStorage.removeItem("companyId");
    localStorage.removeItem("auth_uid");
    localStorage.removeItem("serverCompanyId");
    localStorage.removeItem("profile_subscription_present");
    localStorage.removeItem("pendingPlan");
    localStorage.removeItem("subscription");
    // Add any other keys you use for profile/account caching here
    console.log(
      "[Profile] Cleared all localStorage keys after account deletion."
    );
  } catch (e) {
    console.warn(
      "[Profile] Failed to clear localStorage after account deletion",
      e
    );
  }
}

import React, { useEffect, useState } from "react";
import { getSmsServerUrl } from "../lib/firebaseConfig";
import {
  getFirebaseDb,
  getFirebaseAuth,
  initializeFirebase,
} from "../lib/firebaseClient";
import {
  doc,
  setDoc,
  Timestamp,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import {
  updateClientProfile,
  getClientProfile,
  getClientByAuthUid,
  createClient,
  updateClient,
} from "../lib/firestoreClient";

const PaymentSuccessPage: React.FC = () => {
  const [countdown, setCountdown] = useState(5);
  const [planInfo, setPlanInfo] = useState<{
    planName: string;
    smsCredits: number;
  } | null>(null);
  // Debugging helpers: record runtime steps and show verification results
  const [debugLogs, setDebugLogs] = useState<Array<any>>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [serverVerification, setServerVerification] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  const sanitizeDebug = (obj: any) => {
    try {
      const clone = JSON.parse(JSON.stringify(obj));
      if (
        clone &&
        clone.headers &&
        (clone.headers.Authorization || clone.headers.authorization)
      ) {
        clone.headers.Authorization = "REDACTED";
        clone.headers.authorization = "REDACTED";
      }
      return clone;
    } catch {
      return obj;
    }
  };

  const pushDebug = (
    message: string,
    payload?: any,
    level: string = "info"
  ) => {
    try {
      const entry = {
        ts: Date.now(),
        level,
        message,
        payload: sanitizeDebug(payload),
      };
      setDebugLogs((p) => [entry, ...p].slice(0, 200));
      if (level === "error") console.error(message, payload);
      else if (level === "warn") console.warn(message, payload);
      else console.log(message, payload);
    } catch {}
  };

  useEffect(() => {
    // Extract plan info from URL params and save subscription
    const saveSubscription = async () => {
      try {
        // Ensure Firebase App is initialized before using Auth/Firestore
        initializeFirebase();
        // Use helper to wait for auth to be restored (hosted checkout redirects can be slow)
        const auth = getFirebaseAuth();
        const waitForAuth = (authObj: any, timeoutMs = 15000) =>
          new Promise<void>((resolve) => {
            if (authObj.currentUser) return resolve();
            const unsubscribe = authObj.onAuthStateChanged((user: any) => {
              if (user) {
                console.log("[PaymentSuccess] Auth state ready:", user.uid);
                try {
                  unsubscribe();
                } catch {}
                return resolve();
              }
            });
            setTimeout(() => {
              try {
                unsubscribe();
              } catch {}
              return resolve();
            }, timeoutMs);
          });

        await waitForAuth(auth, 10000); // wait up to 10s
        const currentUser = auth.currentUser;
        console.log("[PaymentSuccess] Auth state:", {
          authenticated: !!currentUser,
          uid: currentUser?.uid,
          email: currentUser?.email,
        });
        if (!currentUser) {
          console.warn(
            "[PaymentSuccess] Warning: auth not available after wait; Firestore writes may fail"
          );
        }

        const urlParams = new URLSearchParams(window.location.search);
        const planId = urlParams.get("plan") || undefined;
        // Session / subscription id from provider (try many param names)
        const sessionId =
          urlParams.get("sessionId") ||
          urlParams.get("subscription_id") ||
          urlParams.get("subscriptionId") ||
          urlParams.get("id") ||
          urlParams.get("sid") ||
          urlParams.get("session") ||
          undefined;
        // Will be set if we find a canonical subscription while waiting
        let found: any = null;
        // Keep companyId available to the rest of the function so we can
        // include it in the server POST payload if needed.
        // companyId is always the current user's UID for Firestore profile
        let companyIdForPayload: string | null = currentUser?.uid || null;
        // When the webhook/server already created a canonical subscription
        // we want to avoid POSTing the same payload again. However we
        // still need to ensure the authenticated user's client-visible
        // profile document receives the subscription info so the UI can
        // update immediately. Use this flag to skip the server POST but
        // continue local client-side writes.
        let skipServerPost = false;
        // (sessionId is already declared above)

        console.log("[PaymentSuccess] Starting subscription save:", {
          planId,
        });

        if (!planId) {
          console.warn(
            "[PaymentSuccess] No planId in return URL. Will attempt to fetch canonical subscription from Firestore / API."
          );

          // No need for getCompanyId: always use currentUser.uid

          const fetchSubscriptionByCompany = async (
            companyId: string | null
          ) => {
            if (!companyId) return null;
            // First try Firestore (client SDK) if available; this will work
            // even when the server API is temporarily unreachable.
            try {
              const db = getFirebaseDb();
              const profileRef = doc(
                db,
                "clients",
                companyId,
                "profile",
                "main"
              );
              const snap = await getDoc(profileRef);
              if (snap && snap.exists()) return snap.data();
            } catch (e) {
              console.warn("[PaymentSuccess] Firestore fetch failed:", e);
            }

            // Fallback to API GET
            try {
              const baseLocal = await getSmsServerUrl().catch(() => "");
              if (!baseLocal) return null;
              // Include ID token when available so server can verify ownership
              const headers: any = {};
              if (currentUser) {
                try {
                  const idToken = await currentUser.getIdToken();
                  if (idToken) headers.Authorization = `Bearer ${idToken}`;
                } catch {}
              }
              const res = await fetch(
                `${baseLocal}/api/subscription?companyId=${companyId}`,
                { headers }
              );
              const json = await res.json().catch(() => ({}));
              if (json && json.success && json.subscription)
                return json.subscription;
            } catch (e) {
              console.warn(
                "[PaymentSuccess] API subscription fetch failed:",
                e
              );
            }
            return null;
          };

          // Try a few times (simple retry) to let webhook/admin writes finish
          found = null;
          companyIdForPayload = currentUser?.uid || null;
          for (let i = 0; i < 4; i++) {
            found = await fetchSubscriptionByCompany(companyIdForPayload).catch(
              () => null
            );
            if (found) break;
            // wait before retrying
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, 2000));
          }
          if (found) {
            console.log(
              "[PaymentSuccess] Found canonical subscription:",
              found
            );
            pushDebug("Found canonical subscription", found);
            try {
              setPlanInfo({
                planName: found.planName || found.planId,
                smsCredits: found.smsCredits || found.remainingCredits || 0,
              });
            } catch {}
            // No need to persist companyId in localStorage; always use currentUser.uid
            // If the canonical subscription already contains a planId and we
            // have a companyId, there's nothing further for the client to do:
            // the server/webhook already wrote the canonical doc and the
            // Profile page will display it. Skip the POST to avoid 400s.
            if (
              (found.planId || found.plan || found.planName) &&
              (companyIdForPayload || found.companyId)
            ) {
              console.log(
                "[PaymentSuccess] Canonical subscription already present; will skip server POST but still write to client profile (auth uid)."
              );
              pushDebug(
                "Server already has canonical subscription; skipping POST",
                found
              );
              skipServerPost = true;
            }
          } else {
            console.warn(
              "[PaymentSuccess] No subscription found after retries. The server or webhook may still be processing."
            );
          }

          // Continue — the Profile page will receive real-time updates via Firestore
          // and the server-admin write will make the subscription visible there.
        }

        // Map planId -> plan details
        const planMapping: Record<
          string,
          { name: string; sms: number; months: number }
        > = {
          starter_1m: { name: "Starter", sms: 250, months: 1 },
          monthly: { name: "Starter", sms: 250, months: 1 },
          growth_3m: { name: "Growth", sms: 600, months: 3 },
          quarterly: { name: "Growth", sms: 600, months: 3 },
          pro_6m: { name: "Professional", sms: 900, months: 6 },
          halfyearly: { name: "Professional", sms: 900, months: 6 },
        };

        // Derive an effective planId if URL didn't contain one
        const smsToPlan = (sms?: number) => {
          if (!sms) return null;
          if (sms === 250) return "starter_1m";
          if (sms === 600) return "growth_3m";
          if (sms === 900) return "pro_6m";
          return null;
        };

        // Price -> plan mapping (keeps parity with App.tsx PLAN_PRICES)
        const priceToPlan: Record<number, string> = {
          30: "starter_1m",
          75: "growth_3m",
          100: "pro_6m",
        };

        let effectivePlanId: string | null = planId || null;
        if (!effectivePlanId && typeof found === "object" && found) {
          effectivePlanId =
            found.planId ||
            found.plan ||
            smsToPlan(found.smsCredits || found.remainingCredits || 0) ||
            // Older or alternate docs may store price instead of planId
            (typeof found.price === "number"
              ? priceToPlan[found.price]
              : typeof found.price === "string" &&
                !Number.isNaN(Number(found.price))
              ? priceToPlan[Number(found.price)]
              : null) ||
            null;
        }

        // Determine plan object either from mapping or from found payload
        let plan = effectivePlanId ? planMapping[effectivePlanId] : null;
        // If not found in mapping, fallback to found object (custom plan), but always resolve a valid planId
        if (!plan && typeof found === "object" && found) {
          // Try to infer planId from SMS credits or price
          let inferredPlanId = smsToPlan(
            found.smsCredits || found.remainingCredits || 0
          );
          if (!inferredPlanId && typeof found.price === "number") {
            inferredPlanId = priceToPlan[found.price];
          }
          if (
            !inferredPlanId &&
            typeof found.price === "string" &&
            !Number.isNaN(Number(found.price))
          ) {
            inferredPlanId = priceToPlan[Number(found.price)];
          }
          effectivePlanId = inferredPlanId || "starter_1m";
          plan = planMapping[effectivePlanId];
        }
        // If still no valid planId, fallback to a default valid planId
        if (!effectivePlanId || !planMapping[effectivePlanId]) {
          effectivePlanId = "starter_1m";
          plan = planMapping[effectivePlanId];
        }
        setPlanInfo({ planName: plan.name, smsCredits: plan.sms });

        // As a best-effort we will also write the subscription directly to
        // Firestore from the client so the Profile page immediately shows
        // the plan details. The server POST (admin write) remains the
        // authoritative operation and will reconcile/overwrite if needed.
        const base = await getSmsServerUrl().catch(() => "");
        if (!base) console.warn("[PaymentSuccess] No API base available");

        // Derive a canonical planId to send to the server when possible.
        // This helps the server accept the request even if a human-friendly
        // plan name was used earlier (e.g. "Starter"). Prefer explicit
        // effectivePlanId, otherwise try name -> enum mapping, then
        // infer from SMS allocation.
        let canonicalPlanId: string | null = effectivePlanId || null;
        try {
          const pname =
            plan && plan.name ? String(plan.name).toLowerCase() : "";
          if (!canonicalPlanId && pname) {
            if (pname.includes("starter") || pname.includes("monthly"))
              canonicalPlanId = "starter_1m";
            else if (pname.includes("growth") || pname.includes("quarterly"))
              canonicalPlanId = "growth_3m";
            else if (
              pname.includes("pro") ||
              pname.includes("professional") ||
              pname.includes("halfyearly")
            )
              canonicalPlanId = "pro_6m";
          }
          if (!canonicalPlanId) {
            canonicalPlanId = smsToPlan(plan?.sms) || null;
          }
        } catch (e) {
          // No-op; fallback to sending human-friendly name below
          canonicalPlanId = canonicalPlanId || null;
        }

        // Build payload for server save. Use canonicalPlanId when available
        // so the server can map to known credit bundles deterministically.
        const payload: any = {
          planId: canonicalPlanId || effectivePlanId || plan.name,
          smsCredits: plan.sms,
          durationMonths: plan.months,
          status: "active",
        };
        // Record prepared payload for debugging
        pushDebug("Prepared server payload", payload);

        // --- Robust companyId/planId assignment ---
        // Always use currentUser.uid as companyId for Firestore profile
        payload.companyId = currentUser?.uid || null;
        if (!payload.companyId) {
          console.error(
            "[PaymentSuccess] ERROR: companyId missing from payload. Aborting POST.",
            payload
          );
        }
        if (!payload.planId) {
          console.error(
            "[PaymentSuccess] ERROR: planId missing from payload. Aborting POST.",
            payload
          );
        }
        if (!payload.companyId || !payload.planId) {
          pushDebug(
            "ERROR: Required fields missing for POST",
            payload,
            "error"
          );
        }
        if (!payload.companyId && currentUser?.email)
          payload.userEmail = currentUser.email;
        if (sessionId) payload.sessionId = sessionId;

        // --- End robust assignment ---
        // Utility: Call this after account deletion to clear all localStorage keys related to company/profile

        // No longer needed: clearProfileLocalStorage utility (all state is in Firestore)

        // Try a client-side Firestore write first (best-effort) so the
        // Profile page can reflect the purchase immediately for this user.
        // We'll always attempt to write to the authenticated user's
        // client document (auth UID) because Firestore rules permit that
        // operation. Also attempt a best-effort write to any server-derived
        // companyId (may fail due to permission restrictions).
        let firestoreSaved = false;
        try {
          const authUid = currentUser?.uid || null;

          // Build a complete profile object: planId, planName, status, expiry, credits
          const profilePayload: any = {
            planId: effectivePlanId, // always a valid planId
            planName: plan.name,
            status: payload.status || "active",
            smsCredits: plan.sms,
            remainingCredits: plan.sms,
            activatedAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };
          // Set expiry date based on plan duration
          if (plan.months && Number(plan.months) > 0) {
            const months = Number(plan.months);
            const expiry = new Date();
            expiry.setMonth(expiry.getMonth() + months);
            profilePayload.expiryAt = Timestamp.fromDate(expiry);
          }
          if (payload.sessionId)
            profilePayload.paymentSessionId = payload.sessionId;

          // Ensure an auth-UID-owned client document exists and write the
          // profile there so the signed-in user can immediately see the
          // subscription in the Profile page.
          try {
            if (authUid) {
              const existingClient = await getClientByAuthUid(authUid).catch(
                () => null
              );
              if (!existingClient) {
                try {
                  await createClient({
                    name:
                      currentUser?.displayName ||
                      currentUser?.email?.split("@")[0] ||
                      "User",
                    email: currentUser?.email || undefined,
                    auth_uid: authUid,
                    activity_status: "active",
                  });
                  console.log(
                    "[PaymentSuccess] ✅ Created client document for auth uid:",
                    authUid
                  );
                } catch (createErr) {
                  console.warn(
                    "[PaymentSuccess] Failed to create client doc for auth uid (non-fatal):",
                    createErr
                  );
                }
              }

              // Ensure parent client doc contains auth_uid/email for rule
              // checks and convenience.
              try {
                await updateClient(authUid, {
                  auth_uid: authUid,
                  email: currentUser?.email,
                });
              } catch (uErr) {
                // Non-fatal - continue
              }

              try {
                await updateClientProfile(authUid, profilePayload as any);
                firestoreSaved = true;
                console.log(
                  `[PaymentSuccess] Wrote subscription to Firestore clients/${authUid}/profile/main (client-side)`
                );
                pushDebug("Wrote auth-owned profile (client-side)", {
                  authUid,
                  profilePayload,
                });
                // No need to persist companyId/auth_uid in localStorage

                // Verification read: ensure the document contains the
                // expected subscription fields so the UI will pick it up.
                try {
                  const verified = await getClientProfile(authUid).catch(
                    () => null
                  );
                  if (verified && (verified.planId || verified.smsCredits)) {
                    console.log(
                      `[PaymentSuccess] Verified saved subscription at clients/${authUid}/profile/main`,
                      verified
                    );
                    try {
                      setPlanInfo({
                        planName:
                          verified.planName ||
                          verified.planId ||
                          payload.planId ||
                          plan.name,
                        smsCredits:
                          verified.smsCredits ||
                          verified.remainingCredits ||
                          payload.smsCredits ||
                          plan.sms,
                      });
                      // Mark a short-lived flag so other tabs/pages (Payment,
                      // Dashboard) can detect that a subscription was just
                      // saved for this user and immediately update their UI.
                      // No need to persist profile_subscription_present or clear pendingPlan/subscription in localStorage
                    } catch {}
                  } else {
                    console.warn(
                      `[PaymentSuccess] Verification read returned empty or missing fields for clients/${authUid}/profile/main`,
                      verified
                    );
                  }
                } catch (verErr) {
                  console.warn(
                    "[PaymentSuccess] Verification read failed:",
                    verErr
                  );
                }
              } catch (fireErr) {
                console.warn(
                  "[PaymentSuccess] Client-side Firestore write to auth-UID client failed (will still try server):",
                  fireErr
                );
              }
            }
          } catch (e) {
            console.warn(
              "[PaymentSuccess] Error ensuring client doc for auth uid:",
              e
            );
          }

          // Also attempt a best-effort write to the server-provided companyId
          const candidateCompanyId =
            payload.companyId ||
            companyIdForPayload ||
            (found && found.companyId) ||
            null;
          if (
            candidateCompanyId &&
            candidateCompanyId !== (currentUser?.uid || null)
          ) {
            try {
              await updateClientProfile(
                candidateCompanyId,
                profilePayload as any
              );
              console.log(
                `[PaymentSuccess] Also attempted to write canonical subscription to clients/${candidateCompanyId}/profile/main (best-effort)`
              );
              // No need to persist serverCompanyId in localStorage

              // Verification read for server company id (best-effort)
              try {
                const serverVerified = await getClientProfile(
                  candidateCompanyId
                ).catch(() => null);
                if (serverVerified) {
                  console.log(
                    `[PaymentSuccess] Verified server-side profile at clients/${candidateCompanyId}/profile/main`,
                    serverVerified
                  );
                }
              } catch (vErr) {
                // Non-fatal
              }
            } catch (e) {
              console.warn(
                "[PaymentSuccess] Best-effort write to server companyId failed (non-fatal):",
                e
              );
            }
          }
          // After writing auth-owned profile, ensure payload contains a
          // companyId so server-side POSTs succeed. Prefer the auth-owned
          // client id (authUid) when nothing else was derived earlier.
          if (!payload.companyId && currentUser?.uid) {
            payload.companyId = currentUser.uid;
          }
        } catch (e) {
          console.warn("[PaymentSuccess] Error preparing Firestore write:", e);
        }

        // Try to save to server; prefer ID token when available. If a
        // canonical subscription was already found we may skip the server
        // POST but continue to ensure the client-visible profile is
        // populated (above).
        try {
          if (skipServerPost) {
            console.log(
              "[PaymentSuccess] Skipping POST to server because canonical subscription already exists on server."
            );
          } else {
            const headers: any = { "Content-Type": "application/json" };
            if (currentUser) {
              try {
                const idToken = await currentUser.getIdToken();
                headers.Authorization = `Bearer ${idToken}`;
              } catch {}
            }
            // Also surface the companyId and planId into headers so the server
            // can more easily reconcile requests when the request body may be
            // affected by proxies or other quirks.
            if (payload.companyId) headers["x-company-id"] = payload.companyId;
            if (payload.planId) headers["x-plan-id"] = payload.planId;
            // Also include user email and session id in headers as a
            // fallback so the server can reconcile claims even if body is
            // not parsed correctly by the hosting platform.
            if (currentUser?.email) headers["x-user-email"] = currentUser.email;
            if (payload.sessionId) headers["x-session-id"] = payload.sessionId;
            console.log("[PaymentSuccess] Posting subscription to server:", {
              url: `${base}/api/subscription`,
              headers,
              payload,
            });
            pushDebug("Posting subscription to server", {
              url: `${base}/api/subscription`,
              headers,
              payload,
            });

            const response = await fetch(`${base}/api/subscription`, {
              method: "POST",
              headers,
              body: JSON.stringify(payload),
            });

            const data = await response.json().catch(() => ({}));
            pushDebug("Server POST response", data);
            if (data && data.success) {
              console.log(
                "✅ Subscription saved on server (billing/profile)",
                data.subscription || data
              );
              // Verify server-side saved record and show result in-debug UI
              try {
                setVerifying(true);
                const cid = payload.companyId || currentUser?.uid || null;
                if (cid) {
                  const verifyUrl = `${base}/api/subscription?companyId=${cid}`;
                  pushDebug("Verification GET (after server save)", {
                    verifyUrl,
                  });
                  // Attach ID token to verification request when available
                  const verifyHeaders: any = {};
                  if (currentUser) {
                    try {
                      const idToken = await currentUser.getIdToken();
                      if (idToken)
                        verifyHeaders.Authorization = `Bearer ${idToken}`;
                    } catch {}
                  }
                  const vres = await fetch(verifyUrl, {
                    headers: verifyHeaders,
                  });
                  const verifyJson = await vres.json().catch(() => ({}));
                  setServerVerification(verifyJson);
                  pushDebug(
                    "Verification GET result (after server save)",
                    verifyJson
                  );
                } else {
                  pushDebug("Verification skipped: no companyId available");
                }
              } catch (vErr) {
                pushDebug(
                  "Verification GET error (after server save)",
                  vErr,
                  "error"
                );
              } finally {
                setVerifying(false);
              }
            } else {
              console.warn("[PaymentSuccess] Server save incomplete:", data);
              // If server did not accept the payload (e.g., missing companyId),
              // try claim by session id or userEmail so the server can
              // reconcile the session even when JSON bodies are dropped by
              // upstream proxies. Include header fallbacks (x-user-email,
              // x-session-id, x-company-id, x-plan-id and Authorization) so
              // the claim endpoint has multiple ways to derive the target
              // company/plan.
              if (sessionId || currentUser?.email) {
                try {
                  const claimHeaders: any = {
                    "Content-Type": "application/json",
                  };
                  if (currentUser) {
                    try {
                      const idToken = await currentUser.getIdToken();
                      if (idToken)
                        claimHeaders.Authorization = `Bearer ${idToken}`;
                    } catch {}
                    if (currentUser.email)
                      claimHeaders["x-user-email"] = currentUser.email;
                  }
                  if (sessionId) claimHeaders["x-session-id"] = sessionId;
                  if (payload.companyId)
                    claimHeaders["x-company-id"] = payload.companyId;
                  if (payload.planId)
                    claimHeaders["x-plan-id"] = payload.planId;

                  console.log(
                    "[PaymentSuccess] Attempting claim with headers:",
                    {
                      x_user_email: claimHeaders["x-user-email"],
                      x_session_id: claimHeaders["x-session-id"],
                      x_company_id: claimHeaders["x-company-id"],
                      x_plan_id: claimHeaders["x-plan-id"],
                    }
                  );

                  const claimRes = await fetch(
                    `${base}/api/subscription/claim`,
                    {
                      method: "POST",
                      headers: claimHeaders,
                      body: JSON.stringify({
                        sessionId,
                        userEmail: currentUser?.email,
                      }),
                    }
                  );
                  const claimJson = await claimRes.json().catch(() => ({}));
                  pushDebug("Claim response", claimJson);
                  if (claimJson && claimJson.success) {
                    console.log(
                      "✅ Claimed subscription via session endpoint:",
                      claimJson.subscription
                    );
                    try {
                      localStorage.setItem(
                        "profile_subscription_present",
                        JSON.stringify({
                          companyId: String(
                            claimJson.companyId ||
                              payload.companyId ||
                              currentUser?.uid ||
                              null
                          ),
                          userEmail: currentUser?.email || null,
                          ts: Date.now(),
                        })
                      );
                      try {
                        localStorage.removeItem("pendingPlan");
                        localStorage.removeItem("subscription");
                      } catch {}
                    } catch {}
                    // Verify after successful claim
                    try {
                      setVerifying(true);
                      const cid =
                        claimJson.companyId ||
                        payload.companyId ||
                        currentUser?.uid ||
                        null;
                      if (cid) {
                        const baseLocal = await getSmsServerUrl().catch(
                          () => ""
                        );
                        const verifyUrl = baseLocal
                          ? `${baseLocal}/api/subscription?companyId=${cid}`
                          : `/api/subscription?companyId=${cid}`;
                        pushDebug("Verification GET (post-claim)", {
                          verifyUrl,
                        });
                        // Attach ID token when available
                        const verifyHeaders2: any = {};
                        if (currentUser) {
                          try {
                            const idToken = await currentUser.getIdToken();
                            if (idToken)
                              verifyHeaders2.Authorization = `Bearer ${idToken}`;
                          } catch {}
                        }
                        const vres = await fetch(verifyUrl, {
                          headers: verifyHeaders2,
                        });
                        const verifyResp = await vres.json().catch(() => ({}));
                        setServerVerification(verifyResp);
                        pushDebug(
                          "Verification GET result (post-claim)",
                          verifyResp
                        );
                      } else {
                        pushDebug(
                          "Verification skipped after claim: no companyId returned",
                          claimJson,
                          "warn"
                        );
                      }
                    } catch (vErr) {
                      pushDebug(
                        "Verification GET error (post-claim)",
                        vErr,
                        "error"
                      );
                    } finally {
                      setVerifying(false);
                    }
                  } else {
                    console.warn(
                      "[PaymentSuccess] Claim attempt failed:",
                      claimJson
                    );
                  }
                } catch (claimErr) {
                  console.warn(
                    "[PaymentSuccess] Claim attempt error:",
                    claimErr
                  );
                }
              }
            }
          }
        } catch (e) {
          console.error("Error posting subscription to server:", e);
        }
      } catch (error) {
        console.error("Error saving subscription:", error);
      }
    };

    const savePromise = saveSubscription();

    // Start the redirect countdown once the save completes or after a
    // short timeout — this improves the chance the profile shows the
    // new plan on the dashboard immediately after redirect.
    const MAX_WAIT_MS = 5000;
    const startRedirectTimer = () => {
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
    };

    let cleanupTimer: (() => void) | null = null;
    Promise.race([
      savePromise.catch(() => null),
      new Promise((r) => setTimeout(r, MAX_WAIT_MS)),
    ]).then(() => {
      // Start the visible countdown after save or timeout
      cleanupTimer = startRedirectTimer();
    });

    return () => {
      try {
        if (cleanupTimer) cleanupTimer();
      } catch {}
    };
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

            <div className="mt-3 text-left">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700">Debug</h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowDebug((s) => !s)}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    {showDebug ? "Hide" : "Show"}
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        setVerifying(true);
                        setServerVerification(null);
                        // Prefer a stored companyId and fall back to current auth
                        let cid: string | null = null;
                        try {
                          cid = localStorage.getItem("companyId");
                        } catch {}
                        if (!cid) {
                          try {
                            initializeFirebase();
                            const au = getFirebaseAuth().currentUser;
                            if (au && au.uid) cid = au.uid;
                          } catch {}
                        }
                        if (!cid) {
                          pushDebug(
                            "Manual verify failed: no companyId available",
                            null,
                            "warn"
                          );
                          return;
                        }
                        const baseLocal = await getSmsServerUrl().catch(
                          () => ""
                        );
                        const verifyUrl = baseLocal
                          ? `${baseLocal}/api/subscription?companyId=${cid}`
                          : `/api/subscription?companyId=${cid}`;
                        pushDebug("Manual verify requested", { verifyUrl });
                        const verifyHeaders: any = {};
                        try {
                          const au = getFirebaseAuth().currentUser;
                          if (au) {
                            const t = await au.getIdToken();
                            if (t) verifyHeaders.Authorization = `Bearer ${t}`;
                          }
                        } catch {}
                        const vres = await fetch(verifyUrl, {
                          headers: verifyHeaders,
                        });
                        const j = await vres.json().catch(() => ({}));
                        setServerVerification(j);
                        pushDebug("Manual verify result", j);
                      } catch (err) {
                        pushDebug("Manual verify error", err, "error");
                      } finally {
                        setVerifying(false);
                      }
                    }}
                    className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded"
                  >
                    Verify Now
                  </button>
                </div>
              </div>

              {verifying && (
                <div className="text-xs text-gray-500 mt-1">
                  Verifying server subscription...
                </div>
              )}

              {serverVerification && (
                <pre className="mt-2 p-2 rounded bg-black text-white text-xs overflow-auto max-h-40">
                  {JSON.stringify(serverVerification, null, 2)}
                </pre>
              )}

              {showDebug && (
                <div className="mt-2">
                  <div className="text-xs text-gray-600 mb-1">
                    Recent debug logs (newest first)
                  </div>
                  <div className="text-xs bg-gray-900 text-white p-2 rounded max-h-40 overflow-auto">
                    {debugLogs.length === 0 ? (
                      <div className="text-gray-400">No debug logs yet.</div>
                    ) : (
                      debugLogs.map((d, i) => (
                        <div key={i} className="mb-2">
                          <div className="text-[11px] text-gray-300">
                            {new Date(d.ts).toLocaleString()} • {d.level}
                          </div>
                          <div className="text-[13px] font-medium">
                            {d.message}
                          </div>
                          <pre className="text-[11px] mt-1 whitespace-pre-wrap">
                            {JSON.stringify(d.payload, null, 2)}
                          </pre>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;
