import React, { useState } from "react";
import { XIcon } from "./icons";

interface AddCustomerModalProps {
  onClose: () => void;
  onAddCustomer: (
    name: string,
    phone: string
  ) => string | void | Promise<string | void>;
  onSendSms?: (name: string, phone: string) => void | Promise<void>;
  openWhatsappOnSubmit?: boolean;
  businessName?: string;
  feedbackPageLink?: string;
}

const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  onClose,
  onAddCustomer,
  onSendSms,
  openWhatsappOnSubmit = false,
  businessName = "",
  feedbackPageLink = "",
}) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  // Handler for Send SMS button
  const handleSendSms = async (e: React.MouseEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone number are required.");
      return;
    }
    if (!/^\+?[1-9]\d{1,14}$/.test(phone)) {
      setError("Please enter a valid phone number (e.g., +1234567890).");
      return;
    }

    try {
      const phoneDigits = phone.replace(/[^\d]/g, "");
      if (!/\d{8,15}/.test(phoneDigits)) {
        setError("Invalid phone number format for SMS.");
        return;
      }

      // Send SMS using Twilio
      const message = `Hi ${name}, we'd love your feedback for ${businessName}. Link: ${feedbackPageLink}`;
      const response = await fetch("/api/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: phoneDigits, message }),
      });

      if (!response.ok) {
        throw new Error("Failed to send SMS. Please try again.");
      }

      alert(`✅ SMS sent successfully to ${name}!`);
      onClose();
    } catch (err) {
      console.error("Error sending SMS:", err);
      setError("Failed to send SMS. Please try again.");
    }
  };

  // Helpers copied from DashboardPage to ensure consistent link construction
  function appendIdToLink(link: string, customerId?: string) {
    if (!link) return link;
    try {
      const url = new URL(link, window.location.origin);
      if (customerId) url.searchParams.set("id", customerId);
      return url.toString();
    } catch {
      let base = link;
      let hash = "";
      const hashIdx = base.indexOf("#");
      if (hashIdx >= 0) {
        hash = base.slice(hashIdx);
        base = base.slice(0, hashIdx);
      }
      const [path, query = ""] = base.split("?");
      const params = query
        .split("&")
        .filter((kv) => kv && !/^id=/i.test(kv))
        .join("&");
      const sep = params ? "&" : "";
      const qs = customerId
        ? `${params}${sep}id=${encodeURIComponent(customerId)}`
        : params;
      return qs ? `${path}?${qs}${hash}` : `${path}${hash}`;
    }
  }

  function ensureTenantKey(link: string) {
    if (!link) return link;
    try {
      const url = new URL(link, window.location.origin);
      if (!url.searchParams.get("tenantKey")) {
        const tkFromUrl = new URLSearchParams(window.location.search).get(
          "tenantKey"
        );
        const host = window.location.hostname;
        const fallback =
          tkFromUrl ||
          (host === "localhost" || host === "127.0.0.1"
            ? "demo"
            : "business-saas");
        url.searchParams.set("tenantKey", fallback);
      }
      return url.toString();
    } catch {
      const hasQ = link.includes("?");
      const hasTk = /(?:^|[?&])tenantKey=/.test(link);
      if (hasTk) return link;
      const host = window.location.hostname;
      const tk =
        host === "localhost" || host === "127.0.0.1" ? "demo" : "business-saas";
      return `${link}${hasQ ? "&" : "?"}tenantKey=${encodeURIComponent(tk)}`;
    }
  }

  function buildWaMessage(opts: {
    customerName: string;
    businessName: string;
    reviewLink: string;
  }) {
    const { customerName, businessName, reviewLink } = opts;
    const template =
      "Hi [Customer Name], we'd love your feedback for [Business Name]. Link: [Review Link]";
    return template
      .replace(/\[Customer Name\]/g, customerName || "Customer")
      .replace(/\[Business Name\]/g, businessName)
      .replace(/\[Review Link\]/g, reviewLink);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !phone.trim()) {
      setError("Name and phone number are required.");
      return;
    }

    if (!/^\+?[1-9]\d{1,14}$/.test(phone)) {
      setError("Please enter a valid phone number (e.g., +1234567890).");
      return;
    }

    try {
      // If configured to only open WhatsApp on submit, DO NOT persist the customer
      if (openWhatsappOnSubmit) {
        try {
          const digits = phone.replace(/[^0-9]/g, "");
          if (!digits) throw new Error("No digits in phone");

          const clientCompanyId = localStorage.getItem("companyId") || "";
          // Use provided feedbackPageLink if available, else fallback to quick-feedback
          let review = feedbackPageLink
            ? appendIdToLink(ensureTenantKey(feedbackPageLink), phone)
            : `${
                window.location.origin
              }/quick-feedback?companyId=${encodeURIComponent(
                clientCompanyId
              )}&phone=${encodeURIComponent(phone)}`;

          if (clientCompanyId) {
            try {
              const u = new URL(review, window.location.origin);
              u.searchParams.set("clientId", clientCompanyId);
              review = u.toString();
            } catch {
              review =
                review +
                (review.includes("?") ? "&" : "?") +
                `clientId=${encodeURIComponent(clientCompanyId)}`;
            }
          }

          const text = encodeURIComponent(
            buildWaMessage({
              customerName: name,
              businessName,
              reviewLink: review,
            })
          );
          const waUrl = `https://wa.me/${digits}?text=${text}`;
          window.open(waUrl, "_blank", "noopener");
        } catch (waErr) {
          console.error("[AddCustomerModal] error sending WhatsApp:", waErr);
          setError("Failed to open WhatsApp. Please try again.");
          return;
        }

        // Close modal, but DO NOT call onAddCustomer so the customer is not persisted
        onClose();
        return;
      }

      // Default behavior: persist the customer via onAddCustomer
      const res = onAddCustomer(name, phone);
      // Support promise-based handlers as well
      const value =
        res && typeof (res as any).then === "function"
          ? await (res as any)
          : res;
      if (typeof value === "string" && value) {
        setError(value);
        return;
      }

      onClose();
    } catch (err: any) {
      console.error("[AddCustomerModal] error:", err);
      setError("Failed to add customer. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 transition-opacity duration-300 backdrop-blur-sm">
      <div className="bg-gradient-to-b from-white to-gray-50 rounded-xl shadow-2xl p-8 w-full max-w-lg m-4 border border-gray-100">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-800 flex items-center">
            <span className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-2 rounded-lg mr-3 shadow-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </span>
            Add New Customer
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 transition-colors p-2 rounded-full hover:bg-gray-100"
          >
            <XIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Customer Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-primary-600 focus:border-primary-600 bg-white text-gray-900 shadow-sm hover:shadow-md transition-all duration-200"
                placeholder="e.g., Jane Doe"
              />
            </div>
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-primary-600 focus:border-primary-600 bg-white text-gray-900 shadow-sm hover:shadow-md transition-all duration-200"
                placeholder="e.g., +15551234567"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg border border-red-100">
              {error}
            </p>
          )}

          <div className="flex justify-end space-x-4 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-gradient-to-r from-gray-200 to-gray-300 text-gray-800 rounded-lg hover:shadow-md shadow-sm font-semibold transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSendSms}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg shadow-md font-semibold transition-all duration-200 flex items-center gap-2 hover:from-blue-600 hover:to-blue-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8h2a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V10a2 2 0 012-2h2m2-4h4m-4 0a2 2 0 00-2 2v4a2 2 0 002 2h4a2 2 0 002-2V6a2 2 0 00-2-2m-4 0V2m4 2V2"
                />
              </svg>
              Send SMS
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg shadow-md font-semibold transition-all duration-200 flex items-center gap-2 hover:from-green-600 hover:to-green-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
              Send WhatsApp
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCustomerModal;
