# Render deployment / environment variables

This project requires several environment variables when running on a platform such as Render (or similar). Keep secrets in the platform's **secret** store.

Required / strongly recommended

- FIREBASE_ADMIN_JSON — The full Firebase service account JSON as a single string. The server will parse this value and initialize the Admin SDK. Example (set the entire JSON object, not the path):
  - Use Render's secret/environment variable field and paste the JSON content.
  - Alternatively place a file named `firebase-service-account.json` in the project root (not recommended for production).
- DODO_API_KEY — Dodo payments API key (if you use the Dodo gateway)
- TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN — Twilio credentials (if you send SMS via Twilio). Optionally set TWILIO_MESSAGING_SERVICE_SID.
- ADMIN_SETUP_SECRET — A high-entropy secret used by the temporary `/setup-admin` endpoint (if you choose to use it). Prefer not to rely on the endpoint; use the one-off script instead.

Optional / useful

- CORS_ORIGINS — Comma-separated allowed origins (example: `https://app.example.com,https://admin.example.com`). If omitted the code will allow all origins in dev-like mode.
- DODO_API_BASE — Override Dodo API base URL (useful for test vs prod)
- PORT — The port to bind (Render sets this automatically). The server defaults to 3002.

Notes on private key / newline handling

- When you paste the `FIREBASE_ADMIN_JSON` into Render, the JSON should be valid and include `private_key`. Keep it as the raw JSON string; newline characters in `private_key` must remain escaped as `\n` inside the JSON. The script will parse and pass the object to `firebase-admin` which expects the private key string with `\n` sequences.

Recommended deployment steps (safe)

1. Set `FIREBASE_ADMIN_JSON` in Render (secret). Confirm your service account has `Firebase Admin` privileges.
2. Set `ADMIN_SETUP_SECRET` in Render to a random secret if you plan to use `/setup-admin`. Better: do _not_ use `/setup-admin` in production.
3. Deploy the service.
4. Run the one-off script locally to set an admin user (recommended):

   - Locally (with a service account file in project root):

     ```powershell
     # If you have the service account file in repo root:
     node .\scripts\set-admin.js --email admin@example.com
     ```

   - Or using the `FIREBASE_ADMIN_JSON` env locally:

     ```powershell
     $env:FIREBASE_ADMIN_JSON = Get-Content .\path\to\service-account.json -Raw
     node .\scripts\set-admin.js --email admin@example.com
     ```

5. After the admin user is created, remove or disable the `/setup-admin` endpoint if you enabled it.

Why use the script instead of the endpoint?

- The one-off script avoids exposing a temporary HTTP endpoint that can be attacked if misconfigured. It runs locally (or in a secure admin CI job) and sets the custom claim directly using the Admin SDK.

If you want, I can also add a small npm script to `package.json` (e.g. `npm run set-admin -- --email a@b.com`) to make usage easier.
