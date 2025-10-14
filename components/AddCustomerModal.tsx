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
              Send via WhatsApp
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCustomerModal;
