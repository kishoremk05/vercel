import React, { useState } from "react";
import { Page } from "../types";
import { DashboardIcon, SettingsIcon, BriefcaseIcon } from "./icons";
import { getSmsServerUrl } from "../lib/firebaseConfig";

const API_BASE = import.meta.env.VITE_API_BASE || "";

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  businessName: string;
  email: string;
  onBusinessNameChange?: (newName: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  setCurrentPage,
  businessName,
  email,
  onBusinessNameChange,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(businessName);

  const handleSaveName = async () => {
    const trimmed = editedName.trim();
    if (!trimmed) {
      alert("Business name cannot be empty");
      return;
    }

    try {
      // Save to Firestore via API
      const companyId = localStorage.getItem("companyId");
      if (!companyId) {
        alert("No company ID found. Please log in again.");
        return;
      }

      const base = await getSmsServerUrl().catch(() => API_BASE);
      const url = base
        ? `${base}/api/company/update-name`
        : `${API_BASE}/api/company/update-name`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, businessName: trimmed }),
      });

      if (!response.ok) {
        throw new Error("Failed to update business name");
      }

      // Update parent component
      if (onBusinessNameChange) {
        onBusinessNameChange(trimmed);
      }

      setIsEditingName(false);
    } catch (error: any) {
      console.error("Error updating business name:", error);
      alert("Failed to update business name. Please try again.");
    }
  };

  const navItems = [
    { id: Page.Dashboard, label: "Dashboard", icon: DashboardIcon },
    { id: Page.Settings, label: "Messenger", icon: SettingsIcon },
    { id: Page.Profile, label: "Profile", icon: BriefcaseIcon },
    // Feedback page intentionally hidden from sidebar navigation.
  ];

  return (
    <aside className="w-64 bg-gradient-to-b from-white to-gray-50 text-gray-800 flex flex-col transition-all duration-300 border-r border-gray-200 shadow-md">
      <div className="h-20 flex items-center justify-start px-6 border-b border-gray-100">
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-2.5 rounded-lg shadow-md">
          <BriefcaseIcon className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-xl font-bold text-gray-800 ml-3">
          Reputation <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-primary-700">
            flow
          </span>
        </h1>
      </div>
      <nav className="flex-1 px-4 py-6">
        <ul>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => setCurrentPage(item.id)}
                  className={`w-full flex items-center px-4 py-3 my-1.5 rounded-lg transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-primary-50 to-primary-100 text-primary-700 shadow-sm border border-primary-100"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-800 border border-transparent"
                  }`}
                >
                  <div
                    className={`p-1.5 rounded-lg ${
                      isActive ? "bg-primary-100" : ""
                    } mr-3`}
                  >
                    <Icon
                      className={`h-5 w-5 ${
                        isActive ? "text-primary-700" : "text-gray-500"
                      }`}
                    />
                  </div>
                  <span className="font-semibold">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 m-4 rounded-lg shadow-sm">
        <div className="flex items-center">
          <img
            src="https://i.pravatar.cc/40?u=bizowner"
            alt="Owner"
            className="rounded-full border-2 border-primary-200 shadow-sm"
          />
          <div className="ml-3 flex-1">
            <p className="font-semibold text-sm text-gray-800">
              {email || "Biz Owner"}
            </p>
            {isEditingName ? (
              <div className="mt-1 flex items-center gap-1">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="text-xs px-2 py-0.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 w-full"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") {
                      setIsEditingName(false);
                      setEditedName(businessName);
                    }
                  }}
                />
                <button
                  onClick={handleSaveName}
                  className="text-xs bg-primary-600 text-white px-2 py-0.5 rounded hover:bg-primary-700"
                  title="Save"
                >
                  ✓
                </button>
                <button
                  onClick={() => {
                    setIsEditingName(false);
                    setEditedName(businessName);
                  }}
                  className="text-xs bg-gray-300 text-gray-700 px-2 py-0.5 rounded hover:bg-gray-400"
                  title="Cancel"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full shadow-sm">
                  {businessName || "Acme Inc."}
                </p>
                <button
                  onClick={() => {
                    setIsEditingName(true);
                    setEditedName(businessName);
                  }}
                  className="text-xs text-primary-600 hover:text-primary-700"
                  title="Change business name"
                >
                  ✏️
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
