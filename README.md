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

## Deploy on Render with Supabase (free-tier target)

This app uses PostgreSQL (`pg`), so it can use a Supabase PostgreSQL database. The app will **not start successfully without a real `DATABASE_URL`, `JWT_SECRET`, and `ADMIN_PASSWORD`**. Do not enter placeholder text such as `value`.

1. In Supabase, create a project and wait for the database to finish provisioning.
2. In the Supabase dashboard, open the database connection settings and copy a PostgreSQL connection string that is reachable from Render. Use the provider's recommended connection method; if the direct connection does not work from the Render runtime, use Supabase's session pooler connection string.
3. In Render, create a Web Service from this repository. Set:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: Free
4. Add these environment variables in Render:
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = the actual Supabase PostgreSQL connection string (never share it publicly)
   - `DATABASE_SSL` = `true`
   - `JWT_SECRET` = a long random secret (at least 32 random characters)
   - `ADMIN_USERNAME` = `admin` (or your preferred username)
   - `ADMIN_PASSWORD` = a strong unique password of at least 12 characters
   - `ADMIN_NAME` = `Factory Admin` (or your preferred display name)
   - `TELEGRAM_BOT_TOKEN` = optional; your BotFather token, kept secret
   - `TELEGRAM_ADMIN_CHAT_ID` = optional numeric ID for the management chat/channel
   - `DAILY_REPORT_CRON` = optional; defaults to `0 18 * * *` (18:00 Ethiopia time)
5. Deploy and check the Render logs. Confirm the database tables and initial admin are created before entering real factory data.
6. Keep `.env` out of GitHub. Never commit passwords, database URLs, JWT secrets, or bot tokens.

**Do not use these older/incorrect variable names:** `TELEGRAM_GROUP_ID` or `TELEGRAM_CHANNEL_ID`. This version's scheduled-report code reads `TELEGRAM_ADMIN_CHAT_ID`. Telegram chat integration is optional during first deployment; you can add the bot variables later.

Free-tier terms, quotas, pausing, and availability may change. A free plan is not a guarantee of lifetime service or uninterrupted uptime. Back up important data regularly.

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
