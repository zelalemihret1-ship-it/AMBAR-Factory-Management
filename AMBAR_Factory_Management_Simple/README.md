# AMBAR Furniture Workshop ERP — Shared Users version

This package modifies the uploaded `index(1).html` to load and save factory records through a central server and check for team updates every 5 seconds.

## Render deployment
1. Put all project files in a GitHub repository.
2. Create a Render **Web Service** connected to that repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add a persistent disk mounted at `/opt/render/project/src/data`.
6. Set environment variable `DATA_DIR=/opt/render/project/src/data`.
7. Deploy and open `https://YOUR-RENDER-SERVICE.onrender.com/api/health`; expect `{"ok":true,...}`.
8. Open the app in two browsers/devices and test a new work order or material update.

## Critical notes
- This version uses shared JSON-file storage on the server, not PostgreSQL/Supabase.
- The API currently has no employee login or role authorization. Do not expose sensitive or production factory data publicly until authentication and server-side permissions are added.
- Whole-state saves can overwrite simultaneous edits. For reliable production use, migrate to PostgreSQL/Supabase with authenticated users, role-based permissions, audit logs, and conflict-safe transactions.
- Render persistent disk is required to keep data across redeploys/restarts.
- This is a modified package; it has not been deployed to your existing service automatically.
