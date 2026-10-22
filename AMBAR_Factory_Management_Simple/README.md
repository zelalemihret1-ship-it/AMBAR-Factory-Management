# AMBAR Factory Management — Admin Control Center

Dark orange/black AMBAR Factory Management mini app with a protected Admin Control Center.

## Deploy to Render
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Root directory: the folder containing `server.js`, `package.json`, and `public/` (for this ZIP, the extracted project root).
- Set environment variables in Render before deployment:
  - `ADMIN_USERNAME`: your main administrator username
  - `ADMIN_PASSWORD`: a unique password of at least 12 characters
  - `NODE_ENV`: `production`
- Use a persistent disk mounted at `/opt/render/project/src/data` (adjust mount path to your service root) so server-side records, user accounts, and backups survive restarts. Without persistent storage, local JSON files may be lost when the service redeploys.

## Admin features
- Server-side login with HttpOnly, SameSite session cookie and password hashing.
- Main owner can add/remove assigned administrators, choose admin or read-only viewer role, edit system configuration, and manage server records.
- JSON editor for workflow, stock, material receipt, and cutting records; changes are backed up before save.
- Export server record JSON backup.
- One-time migration from this browser's localStorage. Migration refuses to overwrite a non-empty server database; local data is never deleted.
- Server records and configuration are saved in `data/` as JSON files. A persistent disk is required for reliable persistence on Render.

## Important data notes
- Existing browser records are not automatically erased or replaced. Sign in as owner and use “Copy this browser's data to server”. If server records already exist, migration stops safely rather than overwriting them.
- Browser app data and server records are not automatically synchronized with every existing Workflow/Stock/Materials action yet. The Admin Control Center manages the server-side copy; use a controlled migration/backup workflow until the main app's ordinary CRUD operations are migrated to the server API.
- Configuration is saved as server JSON; arbitrary custom keys only affect UI elements once the frontend is wired to use them.
- This is a JSON-file backend suitable for a small deployment, not a substitute for a managed database in a multi-user/high-concurrency environment. Keep regular backups and restrict access to Render settings.
