import React, { useState } from "react";

interface FeedbackReplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (message: string, channel: "sms" | "whatsapp") => void;
  customerPhone: string;
}

const FeedbackReplyModal: React.FC<FeedbackReplyModalProps> = ({
  isOpen,
  onClose,
  onSend,
  customerPhone,
}) => {
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-bold mb-2">Reply to Customer</h3>
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Phone</label>
          <div className="bg-gray-100 rounded px-3 py-2 text-gray-700">
            {customerPhone}
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Message</label>
          <textarea
            className="w-full border border-gray-300 rounded px-3 py-2"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your reply..."
          />
        </div>
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm font-medium">Channel:</label>
          <select
            className="border border-gray-300 rounded px-2 py-1"
            value={channel}
            onChange={(e) => setChannel(e.target.value as any)}
          >
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 rounded bg-gray-200 text-gray-700"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded bg-primary-600 text-white font-semibold hover:bg-primary-700"
            onClick={() => {
              onSend(message, channel);
              setMessage("");
              onClose();
            }}
            disabled={!message.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackReplyModal;
