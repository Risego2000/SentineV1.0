# Backend Mode (Temporary Decision)

Current temporary primary backend mode is:

- **Option A (primary): `server.js` legacy backend**

Reason:

- It currently contains the full route surface used by frontend/Electron.
- Modular backend is still under migration.

Operational rules:

- Use `npm run start` / `npm run dev:api` for normal development and runtime.
- `server/index.ts` is migration-only (`npm run start:modular` / `npm run dev:api:modular`).
- Modular TODO modules (`transcoding`, `cameras`, `evidence`, `reports`) now proxy to legacy endpoints to keep compatibility during migration.

Migration note:

- To switch to Option B later, modular routes must be implemented natively and proxy removed.
