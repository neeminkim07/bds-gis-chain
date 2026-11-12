# Backend API

Base URL: `http://localhost:4000/api`. JSON success responses use `{ "ok": true, "data": ... }`. Except `/health`, `/auth/register`, and `/auth/login`, requests require `Authorization: Bearer <token>`. Tokens expire after one hour. Registration assigns the `User` role; an operator must promote an account to `Admin` directly in PostgreSQL.

## Authentication

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | PostgreSQL/PostGIS health and property count |
| POST | `/auth/register` | Register with username, optional email, and password |
| POST | `/auth/login` | Login by username or email and receive a token |
| GET | `/auth/me` | Return identity from the bearer token |
| PATCH | `/auth/me` | Update the current username and/or email |
| GET | `/users?page=1&limit=50&q=...` | List accounts (Admin only; no password fields) |
| POST | `/users` | Create an account (Admin only; password is hashed) |
| PATCH | `/users/:id` | Edit account, role, wallet, or active status (Admin only) |
| DELETE | `/users/:id` | Delete account (Admin only) |

Passwords must be 12–128 characters and are stored as salted scrypt hashes. `JWT_SECRET` must contain at least 32 characters and is read from `backend/.env`.

The profile update body accepts `username` and optionally `email`; send `email: null` to clear an email address. Omitted email is preserved.

Admin user creation accepts `username`, `password`, optional `email`, `role`, and `wallet_address`. Admin updates accept `username`, `email`, `role`, `wallet_address`, and/or `is_active`. The current account cannot demote, disable, or delete itself; the final active Admin cannot be demoted, disabled, or deleted. Disabling an account immediately blocks login and protected API requests.

## Properties

All property routes require a token. Writes require `Admin`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/properties?page=1&limit=20` | List, search, filter, and paginate |
| GET | `/properties/:id` | Read a property by numeric ID |
| POST | `/properties` | Create a property (Admin) |
| POST | `/properties/bulk` | Upsert 1–500 properties atomically (Admin) |
| PUT | `/properties/:id` | Update a property (Admin) |
| DELETE | `/properties/:id` | Delete a property (Admin) |

List filters: `q` searches code and address; `type`, `area_min`, `area_max`, `price_min`, `price_max`, `page`, and `limit` are optional. `limit` is 1–100. Create/update JSON uses `code`, `address`, `type`, optional `owner_name`, `area`, `price`, `description`, `document_status`, and GeoJSON `boundary`. Geometry must use Polygon/MultiPolygon in WGS84/EPSG:4326 with `[longitude, latitude]` coordinates. Bulk upsert validates the full array before one transaction; matching codes are updated and unrelated database rows are kept.

## GIS

| Method | Path | Purpose |
|---|---|---|
| GET | `/gis/radius?lon=...&lat=...&radius_m=...` | Find properties by radius |
| POST | `/gis/intersects` | Find boundaries intersecting `{ "geometry": ... }` |
| POST | `/gis/area` | Calculate square meters for `{ "geometry": ... }` |
| GET | `/gis/statistics` | Summary and counts by property type |

Radius and area values use meters and square meters. Spatial calculations use PostGIS geography for distance and area.

## Import

From `backend/`, run `npm run import -- [path/to/file.geojson]`. The importer validates the complete FeatureCollection before writing, accepts Polygon and MultiPolygon, and wraps all upserts in one transaction. Invalid input or a database error rolls back the whole import. The repeatable schema in `db/01_schema.sql` preserves existing rows and migrates existing Polygon boundaries to MultiPolygon in place.

The property management page now reads and writes property records through this API. GIS, notifications, and verification still contain demo interactions; they are not presented as persisted backend features yet.
