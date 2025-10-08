Deployment checklist for Render (backend) + Vercel (frontend)

1. Render (backend - Node/Express)

- Create a new Web Service on Render and connect your GitHub repository.
- Set the start command to: npm run start
- Set the build command (Render will detect Node): npm install
- Environment variables (Render secret envs):

  - FIREBASE_ADMIN_JSON — the JSON for the Firebase service account (stringified). Example: '{"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",...}'
  - TWILIO_ACCOUNT_SID
  - TWILIO_AUTH_TOKEN
  - TWILIO_FROM
  - CORS_ORIGINS — optional, comma-separated list of allowed origins (e.g., https://your-frontend.vercel.app)
  - PORT — usually Render sets this automatically; keep default if unspecified.

- Optional: set NODE_ENV=production

- Confirm your service responds at /health and /ready after deploy.

2. Vercel (frontend)

- Create a new project on Vercel and link the same repository.
- Build command: npm run build
- Output directory: dist
- Recommended Environment variables (Project Settings > Environment Variables):
  - VITE_API_BASE — (optional) the Render service URL (e.g., https://your-service.onrender.com). Useful as a fallback if admin_settings/global is not set yet.

3. Firestore

- Add the Render service URL into the Firestore document admin_settings/global under serverConfig.smsServerUrl (or equivalent key used by lib/firebaseConfig.ts). Make sure it is an https URL and has no trailing slash (the client normalizes it).

4. Security

- On Render, configure your service to use the FIREBASE_ADMIN_JSON secret; do not commit service account files in the repo.
- Ensure CORS_ORIGINS includes your Vercel frontend domain before locking CORS down.
- Confirm Firestore rules allow the frontend to read admin_settings/global if your frontend reads it (authenticated reads allowed earlier in project changes).

5. Testing after deploy

- Visit Vercel app and verify fetching of the admin_settings/global happens and that getSmsServerUrl() returns your Render URL.
- Try sending a test feedback/sms to confirm the backend /send-sms route works.
- Check /health on the Render service and ensure it returns status: ok

6. Troubleshooting

- If Firebase admin fails to initialize, check FIREBASE_ADMIN_JSON formatting and ensure newlines in private_key are escaped (\n) when set via the web dashboard.
- If CORS errors arise, add the exact origin URL shown in browser console to CORS_ORIGINS.

7. Rollout

- Once stable, remove any local service account files from the repo and rotate service account keys for safety.
