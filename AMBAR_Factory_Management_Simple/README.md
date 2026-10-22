# AMBAR Factory Management Mini App

## Deploy to Render
- Root directory: `AMBAR_Factory_Management_Full` (if this folder is at repository root, leave Root Directory blank)
- Build command: `npm install`
- Start command: `npm start`

## Updated behavior
- Workflow no longer asks for a manually typed finished date. Tick **I checked finished** and save; the app records today's date and adds the product to stock if it is not already linked.
- Stock records are linked to workflow by source job/Product ID. Click a stock Product ID to see workflow start date, finish date, delivery date, and sold date.
- Stock table no longer displays quantity, remaining value, sold value, or sold type. Sales info is placed immediately before Changes and Edit.
- Product Type is selectable directly in the stock table and in the edit form.

## Important data note
The app stores data in browser localStorage on the device/browser being used. This is a prototype and does not synchronize across devices or employees. Export/backup your records regularly and do not use as a shared official ledger without adding a persistent database.
