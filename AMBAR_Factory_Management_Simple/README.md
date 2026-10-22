# AMBAR Factory Management — Workbook-Organized Mini App

This version organizes the mini app around the workbook structure described by the user:

1. **Dashboard** — overview cards for production, finished stock, material balance, and planned marketing posts.
2. **Workflow** — WFN product tracking, product ID/model, ready-stock vs customer-order, priority, start/finish/delivery dates, sales name, and changes.
3. **Finished stock** — products automatically added when workflow reaches IN STOCK; stock/sold reports and product categories.
4. **Materials** — material receipts and daily cutting/usage share the unified materials balance sheet.
5. **Reports** — date-range reports, summaries, charts, saved daily reports, CSV export, and photo report.
6. **Marketing schedule** — TikTok and social posting calendar with platform, title, date/time, status, link, remarks, edit/delete, and CSV export.
7. **Admin Control** — protected login, server record controls, system configuration, and assigned administrators.

## Run locally
- Node.js 18+
- `npm install`
- Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` (use a unique password of at least 12 characters)
- Set `NODE_ENV=production` when deployed with HTTPS
- `npm start`

## Render
- Build command: `npm install`
- Start command: `npm start`
- Set environment variables `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `NODE_ENV=production`.
- Configure a persistent disk mounted to the app's `data` directory, or use a persistent database before relying on this for production.

## Data and safety
- Existing browser data remains in localStorage until migrated by an administrator.
- The server data API stores workflow, stock, materials, cutting, marketing schedule, and saved reports together.
- Back up the existing repository and production data before deploying.
- The actual Excel workbook was not attached in the conversation; this build uses the workbook layout and module description provided in the message. It does not import spreadsheet rows automatically.
- Verify the screens and multi-user behavior in a staging deployment before using it for daily operations.
