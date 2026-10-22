# AMBAR Factory Management — Shared Admin Control Center

Dark orange/black AMBAR Factory Management app with a protected server-side Admin Control Center and shared server-backed data synchronization for signed-in administrators.

## Render deployment
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Root directory: folder containing `server.js`, `package.json`, and `public/`.
- Environment variables:
  - `ADMIN_USERNAME`: main administrator username
  - `ADMIN_PASSWORD`: unique password (at least 12 characters)
  - `NODE_ENV`: `production`
- Attach a Render persistent disk mounted at `/opt/render/project/src/data` (adjust for your Root Directory). JSON records, users, configuration, and backups are stored in `data/`.

## Admin features
- Hashed passwords, HttpOnly/SameSite session cookie, main owner and assigned admin/viewer roles.
- Owner can add/remove assigned accounts and change configuration.
- Admin can edit server-side records through the advanced JSON editor; writes create a backup first.
- Signed-in admin sessions load server records into the normal Workflow/Stock/Materials screens. Normal saves and saved daily reports sync to the server for signed-in admins.
- “Copy this browser's data to server” migrates local records and saved daily reports without deleting the browser copy. Migration refuses to overwrite a non-empty server record store.
- Exportable JSON backup and monthly browser reminder.

## Important
1. Back up your existing browser records and repository before deployment.
2. Deploy, sign in through **Admin Control**, then use **Copy this browser's data to server** if the server is empty.
3. For shared data, each staff member must sign in with an assigned account before editing. The existing UI is not a full public multi-user login system; unauthenticated use remains local to that browser.
4. Signed-in administrator data is shared via the server's JSON store. A persistent Render disk is required. For heavy simultaneous use, migrate to a managed database such as PostgreSQL.
5. Do not use this version for critical production until you test all workflows, reports, backups, and concurrent edits with a copy of your data.
