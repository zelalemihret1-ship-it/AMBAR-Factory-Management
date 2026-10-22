# AMBAR Factory Management — Shared Users build

## What this update does
- Stores the factory's shared state on the server rather than relying only on each browser's local storage.
- Loads the shared records when a user opens the app.
- Checks for server updates every 5 seconds and refreshes another user's screen when it can do so safely.
- Keeps the existing Export backup JSON feature.

## Deploy on Render
1. Upload/extract this project into a GitHub repository.
2. In Render, create a **Web Service** connected to that repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add a **persistent disk** mounted at `/opt/render/project/src/data` and set environment variable `DATA_DIR=/opt/render/project/src/data`.
6. Deploy, then open `https://YOUR-SERVICE.onrender.com/api/health`. It should return JSON with `ok: true`.
7. Open the main app URL in two different browsers/devices, add a test record in one, and confirm it appears on the other.

## Important limitations / safety
- This is a shared-data starter, not a full enterprise-grade multi-user database. The API currently has no login or role-based authorization; **do not expose it publicly for real sensitive factory data until authentication and permissions are added**.
- Concurrent edits to the same record can overwrite each other. For reliable production use, migrate this state API to PostgreSQL/Supabase with authenticated user sessions, row-level permissions, audit history, and conflict-safe updates.
- Persistent storage is required on Render; without it, data may be lost on redeploy/restart.
- This app is not connected to your live deployment automatically. Deploy and test this package before replacing your current app.
