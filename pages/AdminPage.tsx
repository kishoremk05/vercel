import React, { useState, useEffect, useCallback } from "react";
import DebugBoundary from "../components/DebugBoundary";
import { getSmsServerUrl } from "../lib/firebaseConfig";
import {
  fetchWithTokenRefresh,
  setupAutoTokenRefresh,
} from "../lib/tokenRefresh";
import { getFirebaseAuth } from "../lib/firebaseClient";

interface AdminPageProps {
  twilioAccountSid: string;
  setTwilioAccountSid: (sid: string) => void;
  twilioAuthToken: string;
  setTwilioAuthToken: (t: string) => void;
  twilioPhoneNumber: string;
  setTwilioPhoneNumber: (p: string) => void;
  onLogout: () => void;
}

const ADMIN_USERS_KEY = "admin_users";
const ADMIN_STATS_KEY = "admin_stats";
const ADMIN_CREDS_KEY = "admin_creds";

const AdminPage: React.FC<AdminPageProps> = ({
  twilioAccountSid,
  setTwilioAccountSid,
  twilioAuthToken,
  setTwilioAuthToken,
  twilioPhoneNumber,
  setTwilioPhoneNumber,
  onLogout,
}) => {
  const [users, setUsers] = useState<any[]>(() => {
    try {
      const raw = sessionStorage.getItem(ADMIN_USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [stats, setStats] = useState<any>(() => {
    try {
      const raw = sessionStorage.getItem(ADMIN_STATS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [localSid, setLocalSid] = useState<string>(() => {
    try {
      const raw = sessionStorage.getItem(ADMIN_CREDS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return (parsed && parsed.accountSid) || twilioAccountSid;
    } catch {
      return twilioAccountSid;
    }
  });

  const [localToken, setLocalToken] = useState<string>(() => {
    try {
      const raw = sessionStorage.getItem(ADMIN_CREDS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return (parsed && parsed.authToken) || twilioAuthToken;
    } catch {
      return twilioAuthToken;
    }
  });

  const [localPhone, setLocalPhone] = useState<string>(() => {
    try {
      const raw = sessionStorage.getItem(ADMIN_CREDS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return (parsed && parsed.phoneNumber) || twilioPhoneNumber;
    } catch {
      return twilioPhoneNumber;
    }
  });

  const [search, setSearch] = useState("");
  const [adminPrivLost, setAdminPrivLost] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const cleanup = setupAutoTokenRefresh();
    return cleanup;
  }, []);

  const loadCredentials = useCallback(async () => {
    try {
      const base = await getSmsServerUrl();
      const url = `${String(base).replace(/\/+$/, "")}/admin/credentials`;

      let res = await fetchWithTokenRefresh(url);
      if (res.status === 401) {
        try {
          const auth = getFirebaseAuth();
          if (auth?.currentUser) await auth.currentUser.getIdToken(true);
          res = await fetchWithTokenRefresh(url);
        } catch {}
      }

      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        const creds = json?.credentials || {};
        if (creds.accountSid) setLocalSid(creds.accountSid);
        if (creds.authToken) setLocalToken(creds.authToken);
        if (creds.phoneNumber) setLocalPhone(creds.phoneNumber);
        if (creds.accountSid) setTwilioAccountSid(creds.accountSid);
        if (creds.authToken) setTwilioAuthToken(creds.authToken);
        if (creds.phoneNumber) setTwilioPhoneNumber(creds.phoneNumber);
        try {
          sessionStorage.setItem(ADMIN_CREDS_KEY, JSON.stringify(creds));
        } catch {}
      } else {
        const body = await res.json().catch(() => ({}));
        if (
          res.status === 401 &&
          String(body?.error || "")
            .toLowerCase()
            .includes("insufficient")
        ) {
          setAdminPrivLost(true);
          setErrorMessage(
            "Insufficient privileges: admin role required. Please re-login with an admin account."
          );
        }
      }
    } catch (e) {
      console.error("loadCredentials error", e);
    }
  }, [setTwilioAccountSid, setTwilioAuthToken, setTwilioPhoneNumber]);

  const loadAdminData = useCallback(async () => {
    try {
      const base = await getSmsServerUrl();
      const statsUrl = `${String(base).replace(/\/+$/, "")}/admin/global-stats`;
      const usersUrl = `${String(base).replace(
        /\/+$/,
        ""
      )}/admin/firebase-users`;

      let statsRes = await fetchWithTokenRefresh(statsUrl);
      let usersRes = await fetchWithTokenRefresh(usersUrl);

      if (statsRes.status === 401 || usersRes.status === 401) {
        try {
          const auth = getFirebaseAuth();
          if (auth?.currentUser) await auth.currentUser.getIdToken(true);
          statsRes = await fetchWithTokenRefresh(statsUrl);
          usersRes = await fetchWithTokenRefresh(usersUrl);
        } catch {}
      }

      if (statsRes.ok) {
        const j = await statsRes.json().catch(() => null);
        setStats(j?.stats || null);
        try {
          sessionStorage.setItem(
            ADMIN_STATS_KEY,
            JSON.stringify(j?.stats || null)
          );
        } catch {}
      } else {
        const body = await statsRes.json().catch(() => null);
        if (
          statsRes.status === 401 &&
          String(body?.error || "")
            .toLowerCase()
            .includes("insufficient")
        ) {
          setAdminPrivLost(true);
          setErrorMessage(
            "Insufficient privileges: admin role required. Please re-login with an admin account."
          );
          return;
        }
      }

      if (usersRes.ok) {
        const j = await usersRes.json().catch(() => null);
        const u = Array.isArray(j?.users) ? j.users : [];
        setUsers(u);
        try {
          sessionStorage.setItem(ADMIN_USERS_KEY, JSON.stringify(u));
        } catch {}
      } else {
        const body = await usersRes.json().catch(() => null);
        if (
          usersRes.status === 401 &&
          String(body?.error || "")
            .toLowerCase()
            .includes("insufficient")
        ) {
          setAdminPrivLost(true);
          setErrorMessage(
            "Insufficient privileges: admin role required. Please re-login with an admin account."
          );
          return;
        }
        setUsers([]);
      }
    } catch (e) {
      console.error("loadAdminData error", e);
    }
  }, []);

  const handleRetryAdminFetch = useCallback(async () => {
    try {
      const auth = getFirebaseAuth();
      if (auth?.currentUser) await auth.currentUser.getIdToken(true);
    } catch {}
    await loadCredentials();
    await loadAdminData();
  }, [loadCredentials, loadAdminData]);

  useEffect(() => {
    loadCredentials();
    loadAdminData();
  }, [loadCredentials, loadAdminData]);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth || !auth.onIdTokenChanged) return;
    const unsub = auth.onIdTokenChanged(async (user) => {
      if (user) {
        setAdminPrivLost(false);
        setErrorMessage("");
        try {
          await loadCredentials();
          await loadAdminData();
        } catch {}
      }
    });
    return () => unsub();
  }, [loadCredentials, loadAdminData]);

  const handleSaveCredentials = async () => {
    if (adminPrivLost) {
      setErrorMessage("You no longer have admin privileges.");
      return;
    }
    setIsSaving(true);
    try {
      const base = await getSmsServerUrl();
      const res = await fetchWithTokenRefresh(
        `${String(base).replace(/\/+$/, "")}/admin/credentials`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountSid: localSid,
            authToken: localToken,
            phoneNumber: localPhone,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to save credentials");
      setTwilioAccountSid(localSid);
      setTwilioAuthToken(localToken);
      setTwilioPhoneNumber(localPhone);
      try {
        sessionStorage.setItem(
          ADMIN_CREDS_KEY,
          JSON.stringify({
            accountSid: localSid,
            authToken: localToken,
            phoneNumber: localPhone,
          })
        );
      } catch {}
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e?.message || String(e));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DebugBoundary>
      <div className="min-h-screen p-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <p className="text-sm text-gray-600">
                Signed in as {localStorage.getItem("adminEmail") || "admin"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRetryAdminFetch}
                className="px-3 py-1 bg-gray-100 rounded"
              >
                Retry admin fetch
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem("adminSession");
                    localStorage.removeItem("adminEmail");
                  } catch {}
                  onLogout();
                }}
                className="px-3 py-1 bg-red-500 text-white rounded"
              >
                Logout
              </button>
            </div>
          </div>

          {adminPrivLost && (
            <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 rounded">
              <div className="flex justify-between items-center">
                <div>
                  <strong>Admin access required.</strong>
                  <div className="text-sm">
                    {errorMessage || "Your account lacks the admin role."}
                  </div>
                </div>
                <div>
                  <button
                    onClick={handleRetryAdminFetch}
                    className="px-3 py-1 bg-yellow-400 rounded"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded shadow">
              <div className="text-sm text-gray-500">Total Clients</div>
              <div className="text-2xl font-bold">{users.length}</div>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <div className="text-sm text-gray-500">Messages Sent</div>
              <div className="text-2xl font-bold">
                {stats?.totalMessages ?? "-"}
              </div>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <div className="text-sm text-gray-500">Companies</div>
              <div className="text-2xl font-bold">
                {stats?.totalCompanies ?? "-"}
              </div>
            </div>
          </div>

          <div className="bg-white rounded p-4 shadow mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Registered Clients</h2>
              <div className="flex items-center gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border px-2 py-1 rounded"
                  placeholder="Search..."
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-2 py-2">Email</th>
                    <th className="px-2 py-2">Role</th>
                    <th className="px-2 py-2">Last Sign In</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users
                    .filter((u) => {
                      const q = search.toLowerCase();
                      return (
                        !q ||
                        (u.email || "").toLowerCase().includes(q) ||
                        (u.role || "").toLowerCase().includes(q)
                      );
                    })
                    .map((user) => (
                      <tr key={user.uid} className="border-t">
                        <td className="px-2 py-3 text-sm">
                          {user.firestoreEmail || user.email || "-"}
                        </td>
                        <td className="px-2 py-3 text-sm">
                          {user.role || "User"}
                        </td>
                        <td className="px-2 py-3 text-sm">
                          {user.lastSignInAt
                            ? new Date(user.lastSignInAt).toLocaleString()
                            : "Never"}
                        </td>
                        <td className="px-2 py-3 text-sm">
                          {user.disabled ? "Disabled" : "Active"}
                        </td>
                      </tr>
                    ))}
                  {users.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-2 py-6 text-center text-gray-400"
                      >
                        No Firebase users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded p-4 shadow">
            <h3 className="font-semibold mb-2">Twilio SMS Credentials</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs">Account SID</label>
                <input
                  value={localSid}
                  onChange={(e) => setLocalSid(e.target.value)}
                  className="w-full border px-2 py-1 rounded"
                />
              </div>
              <div>
                <label className="text-xs">Auth Token</label>
                <input
                  value={localToken}
                  onChange={(e) => setLocalToken(e.target.value)}
                  className="w-full border px-2 py-1 rounded"
                />
              </div>
              <div>
                <label className="text-xs">Phone Number</label>
                <input
                  value={localPhone}
                  onChange={(e) => setLocalPhone(e.target.value)}
                  className="w-full border px-2 py-1 rounded"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleSaveCredentials}
                disabled={isSaving || adminPrivLost}
                className={`px-4 py-2 rounded ${
                  isSaving || adminPrivLost
                    ? "bg-gray-300"
                    : "bg-gray-900 text-white"
                }`}
              >
                {isSaving ? "Saving..." : "Save Credentials"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DebugBoundary>
  );
};

export default AdminPage;
