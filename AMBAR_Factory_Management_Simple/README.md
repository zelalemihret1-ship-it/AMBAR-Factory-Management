# AMBAR Furniture Workshop MES / ERP — Enterprise Starter Package

This package is based on the supplied Enterprise Architecture specification. It includes the existing AMBAR workshop web app, a normalized PostgreSQL schema for the next MES/ERP phase, and the full specification for implementation reference.

## Included
- `public/index.html`: current AMBAR workshop mini-app UI (workflow, finished stock, materials, reports, marketing and admin control).
- `server.js`: current Node.js JSON-file backend with protected admin endpoints.
- `database/schema.sql`: normalized PostgreSQL schema covering products, BOM, raw materials, work orders, stage logs, material transactions, finished inventory, commissions, QC and audit log.
- `docs/Enterprise_MES_Specification.md`: the specification supplied for this update.

## Run the current web app
1. Install Node.js 18 or newer.
2. Run `npm install` (no third-party packages are currently required).
3. Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in the environment. Use a unique password of at least 12 characters.
4. Run `npm start` and open `http://localhost:3000`.

## Deploy on Render
- Build command: `npm install`
- Start command: `npm start`
- Set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `NODE_ENV=production`.
- Mount persistent storage for the app's `data` directory, or migrate to PostgreSQL before relying on production records.

## Important implementation status
The current web app is the existing operational starter and does **not yet implement every advanced feature in the specification**. In particular, the PostgreSQL schema is provided as a migration foundation; the current server still stores app data in JSON files. BOM reservation/explosion, QR scanning and traveler labels, six-stage timing, enforced QC gate, atomic POS transactions, commission calculations, Telegram/WhatsApp/SMS dispatch, and full role-based screen restrictions still need backend and UI integration and live testing. Do not treat those items as active merely because their tables or specification are included.

## Suggested implementation order
1. Back up current data and deploy a staging copy.
2. Migrate JSON records to PostgreSQL and add transactional APIs.
3. Implement BOM allocation and insufficient-stock checks.
4. Add six-stage routing, worker time logs, QR traveler page, and mandatory QC.
5. Add sale checkout, receipts, commission ledger, and stock discharge transaction.
6. Add low-stock/bottleneck notifications and role-based permissions.
7. Test with sample records before switching the live workshop over.
