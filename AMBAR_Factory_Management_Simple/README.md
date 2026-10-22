# AMBAR Furniture Workshop ERP

## Run locally
- Node.js 20+
- Configure `DATABASE_URL` for PostgreSQL.
- Run `npm install` and `npm start`.
- Open the server URL in a browser.

## Current interface updates
- Workshop cards show only priority, Product ID, model, and current stage; click a card for details and available actions.
- Work-order form includes product category.
- Showroom cards show priority, Product ID, model, and status; click a card to view/edit details or sell available stock.
- Material receipt and cut/usage forms record a chosen transaction date. Daily cut summaries group usage by recorded date; movements include material, quantity, type, and notes.
- Admin Controller is removed from the regular navigation.

## Important security note
The Admin Controller navigation item is hidden from ordinary users, but this version does **not** provide server-enforced employee authentication or role-based authorization. Hiding a link is not access control. Do not use this build to protect sensitive operations until server-side admin authentication and role checks are implemented.

The app stores shared state in PostgreSQL through the server. This is a practical operational starter, not a fully audited manufacturing ERP. Verify the deployed database and backups before relying on it for production.
