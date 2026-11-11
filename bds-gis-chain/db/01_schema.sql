-- Repeatable schema setup. Existing tables and rows are preserved.
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users keep the existing username/password_hash/role contract. Email is
-- nullable for compatibility with pre-existing accounts created before email
-- was added; new registrations validate and store it when supplied.
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(254),
    password_hash TEXT         NOT NULL,
    role          VARCHAR(10)  NOT NULL DEFAULT 'User'
                  CHECK (role IN ('Admin', 'User')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(254);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower
    ON users (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
    ON users (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS properties (
    id         SERIAL PRIMARY KEY,
    code       VARCHAR(20)   NOT NULL UNIQUE,
    owner_name VARCHAR(100),
    address    VARCHAR(255)  NOT NULL,
    area       NUMERIC(12,2) NOT NULL CHECK (area > 0),
    type       VARCHAR(20)   NOT NULL
               CHECK (type IN ('house', 'apartment', 'land', 'commercial')),
    price      NUMERIC(16,0) CHECK (price >= 0),
    location   geometry(Point, 4326),
    boundary   geometry(Polygon, 4326),
    image_path VARCHAR(255),
    doc_path   VARCHAR(255),
    created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_properties_location_gist ON properties USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_properties_boundary_gist ON properties USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties (type);
CREATE INDEX IF NOT EXISTS idx_properties_area ON properties (area);

CREATE TABLE IF NOT EXISTS property_versions (
    id          SERIAL PRIMARY KEY,
    property_id INTEGER     NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    version     INTEGER     NOT NULL CHECK (version >= 1),
    data_json   JSONB       NOT NULL,
    data_hash   CHAR(64)    NOT NULL,
    tx_hash     VARCHAR(80),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (property_id, version)
);
CREATE INDEX IF NOT EXISTS idx_versions_property ON property_versions (property_id);
