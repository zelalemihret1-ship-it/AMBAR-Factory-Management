# AMBAR Furniture Workshop ERP — Main Administrator Sign-in Fix

This build fixes a common sign-in failure: previously, if the admin username already existed in PostgreSQL, changing `ADMIN_PASSWORD` in Render did not update that user's stored password. On each server start, this build now ensures the configured `ADMIN_USERNAME` exists, is active, has the `admin` role and `all` access, and has a password hash synchronized from `ADMIN_PASSWORD`. Existing sessions for that configured owner are revoked on restart.

## Create / recover the main administrator

In **Render → your Web Service → Environment**, set these values:

- `DATABASE_URL`: your Render PostgreSQL internal connection string (or the database URL already attached to the service)
- `ADMIN_USERNAME`: your chosen owner username, e.g. `ambar.owner`
- `ADMIN_PASSWORD`: your own strong password, at least 12 characters; use a unique password
- `ADMIN_NAME`: e.g. `AMBAR Main Administrator`
- `NODE_ENV`: `production`

Save changes and redeploy. Then open `/api/health` on the deployed site; it should return `ok: true`, `database: postgresql`, `auth: enabled`. Sign in with the exact `ADMIN_USERNAME` and `ADMIN_PASSWORD` set in Render. Username matching is case-insensitive and surrounding spaces are removed.

**Security:** Do not put the password in the source code, GitHub, README, or a message. Only enter it in Render's Environment settings. Every time this service starts, the configured environment password becomes the main admin password for that username. If you want to change it, change `ADMIN_PASSWORD` in Render and redeploy.

## Deploy

1. Upload the contents of this folder to the root of your GitHub repository, keeping `public/index.html` at that exact path.
2. On Render choose Node runtime, build command `npm install`, start command `npm start`.
3. Attach your PostgreSQL database and configure the environment variables above.
4. Deploy and verify `/api/health`.
5. Sign in with the configured owner credentials and open **Admin & Staff** to add employees.

## Admin behavior

The configured owner account is ensured as an active `admin` with `all` access. Admin-only staff account APIs require a valid server session. Staff passwords are hashed using Node `scrypt`; sessions use HttpOnly cookies. Staff account creation requires passwords of at least 10 characters.

## Troubleshooting

- If `/api/health` fails, check Render logs and `DATABASE_URL` first.
- If login says incorrect username/password, verify the exact values in Render Environment, redeploy, and then sign in again. This build resets the configured owner's password hash on startup from the environment variable.
- If Render shows an old build, confirm the correct GitHub branch and latest deploy succeeded.
- Ensure you open the HTTPS Render URL, not an old local preview.

This package improves account bootstrap and recovery but is not a substitute for a security audit, read isolation by department, rate limiting, CSRF defenses, and tested backups.
