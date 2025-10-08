import React from "react";

interface FeedbackDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
}

const FeedbackDeleteModal: React.FC<FeedbackDeleteModalProps> = ({
  isOpen,
  onClose,
  onDelete,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold mb-4">Delete Feedback</h3>
        <p className="mb-6 text-gray-700">
          Are you sure you want to delete this feedback? This action cannot be
          undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 rounded bg-gray-200 text-gray-700"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700"
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackDeleteModal;
