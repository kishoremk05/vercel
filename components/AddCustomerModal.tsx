import React, { useState } from "react";
import { XIcon } from "./icons";

interface AddCustomerModalProps {
  onClose: () => void;
  onAddCustomer: (name: string, phone: string) => string | void;
}

const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  onClose,
  onAddCustomer,
}) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone number are required.");
      return;
    }
    if (!/^\+?[1-9]\d{1,14}$/.test(phone)) {
      setError("Please enter a valid phone number (e.g., +1234567890).");
      return;
    }
    onAddCustomer(name, phone);
    onClose();
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
          {/* Email field removed per requirement */}

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
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:shadow-md shadow-sm font-semibold transition-all duration-200"
            >
              Add and Send Review Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCustomerModal;
