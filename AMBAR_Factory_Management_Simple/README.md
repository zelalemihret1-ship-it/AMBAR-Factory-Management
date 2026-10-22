# AMBAR Factory Management Mini App

## Deploy on Render
- Create a Web Service from this ZIP/repository.
- Build command: `npm install`
- Start command: `npm start`
- The app serves `public/index.html` and has a `/health` endpoint.

## Current functionality
The interface is a browser-based prototype for factory workflow, finished-product stock/sales, materials received, material cutting/usage, and daily/10-day/monthly summaries. It supports local record entry and report/export features implemented in the HTML app.

## Important data limitation
This version stores records in the browser's local storage. Records are local to that browser/device and are not automatically shared between employees or devices. A Render deployment alone does not create a shared database, and browser storage can be lost if browser data is cleared. Before using this as the factory's official ledger, connect a persistent database (such as Supabase/Postgres), implement user access controls, and test backups.
