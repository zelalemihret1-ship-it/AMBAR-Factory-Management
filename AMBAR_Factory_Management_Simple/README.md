# AMBAR Factory Management — simple version

A small, clean production tracker designed to be easier to deploy and use.

## What it includes
- Admin password sign-in
- Add production jobs/products
- Track stages: Material preparation, Cutting, Assembly, Finishing, Completed, Sold
- Edit stage and quantity, add notes, delete jobs
- Summary counts

## 1. Create the Supabase table
1. Open your Supabase project.
2. Open **SQL Editor** and create a new query.
3. Paste all contents of `supabase_schema.sql`.
4. Click **Run**.

## 2. Set Render environment variables
In Render, open the *new factory service* → **Environment** and add these exact variables:

- `ADMIN_PASSWORD` — a strong admin password you choose.
- `SUPABASE_URL` — from Supabase Project Settings → API (Project URL).
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase Project Settings → API Keys. Use the secret/service-role key. Keep it private; never place it in frontend code.

This version does not require you to configure `JWT_SECRET` or `DATABASE_URL`.

## 3. Render settings
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`

Deploy from the root of this repository.

## Important notes
- Use a separate Render service for the factory app; do not modify the AMBAR Furniture service.
- Keep Supabase keys and the admin password private.
- This starter uses in-memory login sessions. Signing in again may be needed after a service restart.
- This starter does not yet send Telegram notifications, integrate Telegram bot login, or open as a Telegram Mini App. Those are separate steps after the dashboard is running reliably.
