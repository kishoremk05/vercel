/**
 * Example: Using Firebase in React Components
 *
 * This file demonstrates how to integrate Firestore operations
 * into your existing React components
 */

import React, { useState, useEffect } from "react";
import { getFirebaseAuth } from "../lib/firebaseClient";
import {
  getClientByAuthUid,
  getClientDashboard,
  getFeedback,
  getMessages,
  createMessage,
  updateLastLogin,
} from "../lib/firestoreClient";
import type {
  ClientWithId,
  FeedbackWithId,
  MessageWithId,
  DashboardStats,
} from "../types/firebaseTypes";

// ==================== EXAMPLE 1: Dashboard Component ====================

export function DashboardWithFirestore() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const auth = getFirebaseAuth();
        const user = auth.currentUser;

        if (!user) {
          setError("Not authenticated");
          return;
        }

        // Get client by auth UID
        const client = await getClientByAuthUid(user.uid);

        if (!client) {
          setError("Client not found");
          return;
        }

        setClientId(client.id);

        // Update last login
        await updateLastLogin(client.id);

        // Get dashboard stats
        const dashboardStats = await getClientDashboard(client.id);
        setStats(dashboardStats);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) return <div>Loading dashboard...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!stats) return <div>No data available</div>;

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>
      <div className="stats">
        <div className="stat-card">
          <h3>Messages Sent</h3>
          <p>{stats.messageCount}</p>
        </div>
        <div className="stat-card">
          <h3>Total Feedback</h3>
          <p>{stats.feedbackCount}</p>
        </div>
        <div className="stat-card">
          <h3>Negative Feedback</h3>
          <p>{stats.negativeFeedbackCount}</p>
        </div>
      </div>
      {/* Chart using stats.graphData */}
    </div>
  );
}

// ==================== EXAMPLE 2: Feedback List Component ====================

export function FeedbackListWithFirestore() {
  const [feedbackList, setFeedbackList] = useState<FeedbackWithId[]>([]);
  const [filter, setFilter] = useState<
    "all" | "positive" | "negative" | "neutral"
  >("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFeedback() {
      try {
        const auth = getFirebaseAuth();
        const user = auth.currentUser;

        if (!user) return;

        const client = await getClientByAuthUid(user.uid);
        if (!client) return;

        // Get feedback with optional filter
        const sentimentFilter = filter === "all" ? undefined : filter;
        const feedback = await getFeedback(client.id, 50, sentimentFilter);

        setFeedbackList(feedback);
      } catch (err) {
        console.error("Error loading feedback:", err);
      } finally {
        setLoading(false);
      }
    }

    loadFeedback();
  }, [filter]);

  return (
    <div className="feedback-list">
      <h2>Customer Feedback</h2>

      {/* Filter buttons */}
      <div className="filters">
        <button onClick={() => setFilter("all")}>All</button>
        <button onClick={() => setFilter("positive")}>Positive</button>
        <button onClick={() => setFilter("negative")}>Negative</button>
        <button onClick={() => setFilter("neutral")}>Neutral</button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="feedback-items">
          {feedbackList.map((feedback) => (
            <div
              key={feedback.id}
              className={`feedback-item ${feedback.sentiment}`}
            >
              <div className="rating">{"⭐".repeat(feedback.rating)}</div>
              <p>{feedback.comment}</p>
              <span className="phone">{feedback.phone_number}</span>
              <span className="date">
                {feedback.created_at.toDate().toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== EXAMPLE 3: Send Message Component ====================

export function SendMessageWithFirestore() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setSuccess(false);

    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;

      if (!user) {
        alert("Not authenticated");
        return;
      }

      const client = await getClientByAuthUid(user.uid);
      if (!client) {
        alert("Client not found");
        return;
      }

      // Send SMS via your API (Twilio)
      const response = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phoneNumber,
          message: message,
        }),
      });

      const data = await response.json();

      if (data.smsId) {
        // Store message in Firestore
        await createMessage(client.id, {
          sms_id: data.smsId,
          phone_number: phoneNumber,
          message_body: message,
          status: "sent",
        });

        setSuccess(true);
        setPhoneNumber("");
        setMessage("");
      }
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="send-message">
      <h2>Send SMS</h2>
      <form onSubmit={handleSendMessage}>
        <input
          type="tel"
          placeholder="Phone Number"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          required
        />
        <textarea
          placeholder="Message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />
        <button type="submit" disabled={sending}>
          {sending ? "Sending..." : "Send Message"}
        </button>
      </form>
      {success && <p className="success">Message sent successfully!</p>}
    </div>
  );
}

// ==================== EXAMPLE 4: Messages History Component ====================

export function MessagesHistoryWithFirestore() {
  const [messages, setMessages] = useState<MessageWithId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMessages() {
      try {
        const auth = getFirebaseAuth();
        const user = auth.currentUser;

        if (!user) return;

        const client = await getClientByAuthUid(user.uid);
        if (!client) return;

        // Get recent messages
        const messagesList = await getMessages(client.id, 50);
        setMessages(messagesList);
      } catch (err) {
        console.error("Error loading messages:", err);
      } finally {
        setLoading(false);
      }
    }

    loadMessages();
  }, []);

  return (
    <div className="messages-history">
      <h2>Message History</h2>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Phone</th>
              <th>Message</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((msg) => (
              <tr key={msg.id}>
                <td>{msg.sent_at.toDate().toLocaleString()}</td>
                <td>{msg.phone_number}</td>
                <td>{msg.message_body}</td>
                <td>
                  <span className={`status ${msg.status}`}>{msg.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ==================== EXAMPLE 5: Public Feedback Form ====================

export function PublicFeedbackForm({
  clientId,
  smsId,
}: {
  clientId: string;
  smsId: string;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Determine sentiment from rating
      let sentiment: "positive" | "negative" | "neutral";
      if (rating >= 4) sentiment = "positive";
      else if (rating <= 2) sentiment = "negative";
      else sentiment = "neutral";

      // Submit feedback (no auth required)
      const response = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          smsId,
          rating,
          comment,
          phoneNumber,
          sentiment,
        }),
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        alert("Failed to submit feedback");
      }
    } catch (err) {
      console.error("Error submitting feedback:", err);
      alert("Error submitting feedback");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="feedback-success">
        <h2>Thank You!</h2>
        <p>Your feedback has been submitted successfully.</p>
      </div>
    );
  }

  return (
    <div className="feedback-form">
      <h2>Rate Your Experience</h2>
      <form onSubmit={handleSubmit}>
        <div className="rating-stars">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={rating >= star ? "selected" : ""}
            >
              ⭐
            </button>
          ))}
        </div>

        <textarea
          placeholder="Tell us about your experience..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          required
        />

        <input
          type="tel"
          placeholder="Your phone number"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          required
        />

        <button type="submit" disabled={submitting || rating === 0}>
          {submitting ? "Submitting..." : "Submit Feedback"}
        </button>
      </form>
    </div>
  );
}

// ==================== EXAMPLE 6: Custom Hook for Client Data ====================

export function useClientData() {
  const [client, setClient] = useState<ClientWithId | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadClient() {
      try {
        const auth = getFirebaseAuth();
        const user = auth.currentUser;

        if (!user) {
          setError("Not authenticated");
          return;
        }

        const clientData = await getClientByAuthUid(user.uid);
        setClient(clientData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadClient();
  }, []);

  return { client, loading, error };
}

// Usage:
// const { client, loading, error } = useClientData();
