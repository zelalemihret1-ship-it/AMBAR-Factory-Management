# AMBAR Furniture Workshop ERP — Complete Deployment Files

This folder contains the complete application package: frontend, Node/Express server, PostgreSQL persistence, sign-in, main-admin account synchronization, staff assignment endpoints, and Render Blueprint configuration.

## Important: first deployment on Render

1. Upload these complete files to a GitHub repository. Keep `public/index.html` inside the `public` folder.
2. In Render, choose **New → Blueprint** and select that repository. Render reads `render.yaml` and creates the web service and PostgreSQL database. The database plan may be paid; check Render's current pricing before confirming.
3. During Blueprint setup, supply `ADMIN_USERNAME` and `ADMIN_PASSWORD`. Use a username of 3–40 characters (`a-z`, digits, `.`, `_`, `-`) and a password of at least 12 characters. Do not put secrets in GitHub.
4. Wait for deployment to finish. In the web service's Environment page, verify `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_NAME`, and `NODE_ENV=production` exist. If you already have a PostgreSQL database, use its connection string instead of creating a second database.
5. Open `https://YOUR-SERVICE.onrender.com/api/health`. A working deployment returns JSON containing `"ok":true`, `"database":"postgresql"`, and `"auth":"enabled"`.
6. Open the service URL (not a local HTML file) and sign in with the exact `ADMIN_USERNAME` and `ADMIN_PASSWORD` saved in Render.

## How main-admin recovery works

On each server startup, the application ensures the username configured by `ADMIN_USERNAME` exists, updates that account's display name, synchronizes its password from `ADMIN_PASSWORD`, restores `role=admin`, `area=all`, and `active=true`, and revokes old sessions for that account. This is intentionally a startup operation: changing Render environment variables requires a restart/redeploy before the new password works.

Use the same username spelling as Render's environment variable. Usernames are normalized to lowercase. Do not delete the `ambar_users` table manually. The main-admin username is controlled by the environment variable, not by a form in the app.

## Troubleshooting sign-in

- **`/api/health` does not show `ok:true`:** the server or database is not healthy. Open Render → service → Logs and look for `DB initialization failed`, missing `DATABASE_URL`, or a database connection error.
- **`/api/health` works but login says incorrect username/password:** check the current `ADMIN_USERNAME` and `ADMIN_PASSWORD` in Render, save them, then manually trigger **Deploy latest commit** or restart the service. Type the same values into the login page; username is lowercase-normalized. Passwords are case-sensitive.
- **Login page never completes:** make sure you opened the Render HTTPS URL and not `public/index.html` directly from your computer. Static-file opening does not run the server/API.
- **After changing the admin password:** redeploy/restart, wait for logs to show `Main administrator account ensured...`, then reload the page and sign in again.
- **A staff user cannot open an area:** sign in as main admin and assign that account to the matching area. Admin accounts have full area access.

## Local development

Requires Node.js 20+ and a reachable PostgreSQL database. Copy `.env.example` to `.env`, set real values, then run:

```bash
npm install
npm start
```

The app listens on `http://localhost:3000` by default. The included `.env` example is not a real credential file. The application currently reads environment variables directly; if running locally, export them in your shell or use your platform's environment-variable configuration.

## Current limitations

This is a working foundation, not a completed audited enterprise ERP. It uses shared JSONB state in PostgreSQL and shared authenticated reads. Server-side write restrictions exist for staff areas, but row-level data isolation, CSRF protection, rate limiting, password reset/change UI, comprehensive immutable audit trails, automated backup/restore drills, and a formal security review are still needed before sensitive production use. Back up PostgreSQL regularly.
