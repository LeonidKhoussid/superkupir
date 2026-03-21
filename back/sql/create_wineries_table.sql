BEGIN;

CREATE TABLE IF NOT EXISTS wineries (
  id BIGSERIAL PRIMARY KEY,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source_location TEXT,
  card_url TEXT,
  logo_url TEXT,
  size TEXT,
  description TEXT,
  photo_urls JSONB,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  coordinates_raw TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS wineries_external_id_unique_idx
  ON wineries (external_id);

CREATE INDEX IF NOT EXISTS wineries_lat_lon_idx
  ON wineries (lat, lon);

CREATE OR REPLACE FUNCTION update_wineries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_wineries_updated_at ON wineries;

CREATE TRIGGER set_wineries_updated_at
BEFORE UPDATE ON wineries
FOR EACH ROW
EXECUTE FUNCTION update_wineries_updated_at();

COMMIT;
