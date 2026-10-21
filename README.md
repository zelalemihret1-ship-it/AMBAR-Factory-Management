# AMBAR Furniture Factory Management

A starter full-stack factory reporting system for Telegram-adjacent operations. It includes a mobile-friendly web dashboard, PostgreSQL database, auto-generated product IDs, workflow tracking, finished-stock movements, material movements, employee roles, CSV exports, daily reports, and scheduled Telegram summary messages.

## Included
- `public/index.html` — dashboard and forms.
- `server.js` — Express API, login, permissions, database setup, Telegram report scheduling.
- `schema.sql` — PostgreSQL tables and indexes.
- `.env.example` — required environment variables.
- `package.json` — application dependencies.

## Important honest scope note
This is a working starter app, not yet a Telegram Mini App launch configuration or a fully audited enterprise system. The dashboard works as a web app. Telegram integration in this version verifies the bot token and sends a scheduled report to the configured admin chat; it does not yet provide all forms as Telegram chat commands. Before production use with valuable factory records, add database backups, HTTPS, a password-reset process, audit review, and a proper security review.

## Run locally
Requirements: Node.js 20+ and a PostgreSQL database.

1. Create a PostgreSQL database.
2. Copy `.env.example` to `.env`.
3. Set `DATABASE_URL`, `JWT_SECRET`, `ADMIN_PASSWORD`, and (optionally) Telegram settings. Set `DATABASE_SSL=false` for a local PostgreSQL server if appropriate.
4. Install and start:
   ```bash
   npm install
   npm start
   ```
5. Open `http://localhost:3000`.
6. Sign in with `ADMIN_USERNAME` (default `admin`) and the `ADMIN_PASSWORD` you set.

The app creates its database tables and initial admin on first start. If you change `ADMIN_PASSWORD` after the admin account already exists, this startup process does not overwrite that user's password hash. Use a password-management migration/process before real deployment.

## Deploy on Render
1. Push this folder's contents to a new GitHub repository.
2. Create a **PostgreSQL database** with a provider you control. On Render, create a PostgreSQL database and copy its **Internal Database URL** for a web service in the same region, or use the External URL if required.
3. Create a Render **Web Service** connected to the repository.
   - Build command: `npm install`
   - Start command: `npm start`
4. Add environment variables in Render from `.env.example`:
   - `DATABASE_URL` = your PostgreSQL connection URL
   - `DATABASE_SSL` = `true` when required by your database provider (for Render internal database connections, check the provider's current instructions)
   - `JWT_SECRET` = a long random secret
   - `ADMIN_USERNAME` = your chosen username
   - `ADMIN_PASSWORD` = a strong unique password (at least 12 characters recommended)
   - `ADMIN_NAME` = your admin display name
   - `TELEGRAM_BOT_TOKEN` = optional BotFather token
   - `TELEGRAM_ADMIN_CHAT_ID` = optional Telegram chat ID for daily reports
   - `DAILY_REPORT_CRON` = optional cron expression, default `0 18 * * *`
5. Deploy and open the Render URL. Test sign-in and create a test product before importing real records.
6. Keep `.env` out of GitHub. Never paste the bot token or passwords into public chats or source files.

## Telegram daily report setup
1. Create a bot using Telegram's official `@BotFather` and store its token only in Render environment variables.
2. Open the bot in Telegram and press Start.
3. Get your Telegram numeric chat ID using a trusted bot/tool or add a temporary private `/chatid` handler in a controlled development copy. This starter app currently does not poll incoming updates, so it does not implement `/chatid`.
4. Set `TELEGRAM_ADMIN_CHAT_ID` in Render and redeploy.
5. The scheduled summary uses the `Africa/Addis_Ababa` timezone. Default schedule is 18:00 local time. This requires the service to be running at the scheduled time.
6. If the report does not arrive, check Render logs and verify both Telegram variables. Test using a private bot chat first.

## Product and stock rules
- Product IDs are generated once as `AMB-0001`, `AMB-0002`, etc., based on the database ID.
- A workflow entry at `Completed` automatically creates a `produced` stock movement for the same quantity.
- Do not record the same completed quantity a second time in stock, or it will be double-counted.
- A sale can only be recorded if the currently recorded stock is sufficient.
- Material usage and waste reduce the balance; receipts increase it.
- Stock adjustments in this starter version add the quantity to the balance. For corrections that need to subtract stock, add an explicit adjustment direction in a future iteration.
- Material low-stock warning currently uses a generic balance threshold of 5 (in the material's selected unit). Configure per-material thresholds for production use.
- Employee accounts are created by the admin. Roles: `admin`, `manager`, `production`, `storekeeper`, `sales`.

## Data safety
- Use strong credentials and only share access with authorized staff.
- Schedule regular PostgreSQL backups and test restoration.
- Use separate test data before live operation.
- Record units consistently for each material (e.g. sheets should always be entered as `sheet`).
