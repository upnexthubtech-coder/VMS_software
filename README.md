# API - Quick Notes

This API now uses cookie-based JWT authentication.

Environment variables (set in `.env` or your environment):

- DB_USER, DB_PASSWORD, DB_SERVER, DB_NAME - your DB connection
- PORT - server port
- FRONTEND_URL - allowed origin for CORS
- JWT_SECRET - secret used to sign JWT tokens (set a secure value in production)
- JWT_EXPIRES - optional, defaults to `1d` (e.g. `1h`, `7d`)

New endpoints / behavior:
- POST /api/login/login - returns user info and sets an httpOnly cookie `auth_token` on success
- GET /api/login/me - requires cookie; returns current user details
- POST /api/login/logout - clears auth cookie

Dependencies added: `cookie-parser`, `jsonwebtoken` (in `package.json`).

Make sure to run `npm install` in the `API` folder after pulling these changes.

Database notes for visitor prebooking:

- The prebooking endpoints expect `time_slot_from` and `time_slot_to` to be SQL-compatible time values. Prefer sending full `HH:MM:SS` strings (e.g. `09:30:00`).
- The backend will normalize common browser formats (`HH:MM`) to `HH:MM:SS` and will log a warning if it receives an unparseable value.

Gatepass / In-out tables & flow

- New tables (see `sql/create_gatepass_and_inout_tables.sql`) for `visitor_gatepass` and `visitor_inout`.
- When a prebooking is approved a gatepass record is created and a printable gatepass PDF (with the visitor photo) is saved under `uploads/gatepasses/` and the visitor is emailed a gatepass PDF.
	Security staff can use the gatepass code (printed on the pass) to lookup records at the security desk and create in/out checks.

Dependencies: server creates PDF gatepasses (uses `pdfkit`); QR generation has been disabled.
To create the DB tables run the included SQL file (use SQL Server Management Studio or command line):

1. Open `API/sql/create_gatepass_and_inout_tables.sql` and run the script on your database.

2. Restart the API and ensure the `uploads/gatepasses/` directory exists and is writable by the server user.

Manual test: Approve a prebooking (PUT /api/visitor/prebooking/:id/status with action=APPROVE). The server will create a gatepass, save a printable PDF under `/uploads/gatepasses`, and send the visitor an email with the gate pass attached.
