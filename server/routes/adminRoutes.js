import express from "express";
import { validateAdminUid } from "../db/firebaseAdmin";

const router = express.Router();

// Middleware to validate admin UID
router.use(async (req, res, next) => {
  const adminUid = req.headers["x-admin-uid"];

  if (!adminUid) {
    return res.status(401).json({ error: "Missing Admin UID" });
  }

  const isValidAdmin = await validateAdminUid(adminUid);

  if (!isValidAdmin) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  next();
});

// Example route: Fetch global stats
router.get("/global-stats", async (req, res) => {
  try {
    // Fetch global stats from Firestore or other sources
    const stats = {
      totalUsers: 100,
      totalMessages: 500,
      totalFeedback: 200,
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error("[AdminRoutes] Error fetching global stats:", error);
    res.status(500).json({ error: "Failed to fetch global stats" });
  }
});

// Example route: Fetch Firebase users
router.get("/firebase-users", async (req, res) => {
  try {
    // Fetch users from Firestore or other sources
    const users = [
      {
        uid: "user_001",
        email: "user1@example.com",
        displayName: "User One",
        disabled: false,
      },
      {
        uid: "user_002",
        email: "user2@example.com",
        displayName: "User Two",
        disabled: true,
      },
    ];

    res.json({ success: true, users });
  } catch (error) {
    console.error("[AdminRoutes] Error fetching Firebase users:", error);
    res.status(500).json({ error: "Failed to fetch Firebase users" });
  }
});

export default router;
