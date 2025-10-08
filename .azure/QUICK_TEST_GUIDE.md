# Quick Test Guide - Updated Dashboard

## 🚀 Quick Start (2 minutes)

### 1. Check Servers

Both should be running:

- ✅ Frontend: http://localhost:5173
- ✅ Backend: http://localhost:3002

### 2. Test Login Flow

```
Navigate to: http://localhost:5173
↓
Click "Sign up" or "Login"
↓
Click "Sign up with Google"
↓
Choose your Google account
↓
Should redirect to /dashboard
```

### 3. What You'll See

**Dashboard Metrics (4 cards):**

- Messages Sent: 0
- Feedback Received: 0
- Average Rating: 0.0
- Response Rate: 0.0%

**Charts:**

- Sentiment Analysis: "No feedback data available yet"
- (Existing analytics charts below)

### 4. Verify in Console (F12)

```javascript
// Check localStorage
localStorage.getItem("companyId"); // Should show ID
localStorage.getItem("user"); // Should show user JSON
localStorage.getItem("token"); // Should show JWT

// Check network requests
// Should see: GET /api/dashboard/stats?companyId=...
// Status: 200 OK
```

### 5. Check Firebase Console

Go to: https://console.firebase.google.com/project/business-saas-70900/firestore

**Verify Collections:**

- `users` → Should have 1 document (your user)
- `companies` → Should have 1 document (your company)
- `feedback` → Empty (expected)
- `messages` → Empty (expected)

---

## 🧪 Add Test Data (Optional)

To see dashboard with numbers:

**Option 1: Via Firebase Console**

1. Go to Firestore
2. Add documents to `feedback` and `messages` collections
3. Use your `companyId` from localStorage
4. Refresh dashboard

**Option 2: Via Backend API** (Coming in Phase 3)

- Messages page will let you send SMS
- Feedback page will record customer responses

---

## ✅ Success Checklist

- [ ] Both servers running
- [ ] Can login with Google
- [ ] Dashboard displays 4 metric cards
- [ ] Cards show "0" values (not errors)
- [ ] Sentiment chart shows "No data" message
- [ ] No console errors
- [ ] User and company created in Firestore
- [ ] localStorage has companyId, user, token

---

## 🐛 Troubleshooting

**"No company ID found" error:**

- Clear localStorage and login again
- Check if auth flow completed successfully

**Stats not loading:**

- Check Network tab for API request
- Verify backend server is running
- Check backend logs for errors

**Charts not displaying:**

- Hard refresh (Ctrl+Shift+R)
- Check for TypeScript errors in console
- Verify recharts library is installed

---

## 📸 Expected Dashboard Layout

```
┌────────────────────────────────────────────────────────┐
│  [Reputation Overview Header]                           │
└────────────────────────────────────────────────────────┘

┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│Messages  │ │Feedback  │ │Average   │ │Response  │
│Sent: 0   │ │Received:0│ │Rating:0.0│ │Rate: 0%  │
└──────────┘ └──────────┘ └──────────┘ └──────────┘

┌─────────────────────┐  ┌─────────────────────┐
│ Analytics Charts    │  │ Sentiment Analysis  │
│ (Line/Bar graphs)   │  │ (Pie Chart)         │
│                     │  │                     │
└─────────────────────┘  └─────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Funnel Analytics                                    │
└─────────────────────────────────────────────────────┘

┌────────────────────┐  ┌─────────────────────────┐
│ Customer Table     │  │ Send Messages Card      │
└────────────────────┘  └─────────────────────────┘
```

---

## 🎯 Next Steps

Once dashboard is working:

1. **Phase 3A**: Create Messages Page
2. **Phase 3B**: Update Profile Page with credentials form
3. **Phase 3C**: Build Admin Portal
4. **Phase 4**: Add Firestore security rules

**Everything is ready to test! 🚀**
