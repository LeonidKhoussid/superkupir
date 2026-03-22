BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_guide BOOLEAN NOT NULL DEFAULT FALSE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_users_email_lowercase CHECK (email = lower(email))
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_unique_idx
  ON auth_users (email);

CREATE OR REPLACE FUNCTION set_row_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE IF EXISTS auth_users
  ADD COLUMN IF NOT EXISTS is_guide BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE TABLE IF NOT EXISTS place_types (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seasons (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS places (
  id BIGSERIAL PRIMARY KEY,
  import_key TEXT NOT NULL UNIQUE,
  type_id BIGINT NOT NULL REFERENCES place_types(id),
  name TEXT NOT NULL,
  description TEXT,
  short_description TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  source_location TEXT,
  card_url TEXT,
  logo_url TEXT,
  photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimated_cost NUMERIC(12, 2),
  estimated_duration_minutes INTEGER,
  radius_group TEXT,
  size TEXT,
  coordinates_raw TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  import_confidence TEXT NOT NULL DEFAULT 'high',
  city_distance_km NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT places_photo_urls_array CHECK (jsonb_typeof(photo_urls) = 'array'),
  CONSTRAINT places_import_confidence_check CHECK (import_confidence IN ('high', 'low'))
);

ALTER TABLE IF EXISTS places
  ADD COLUMN IF NOT EXISTS import_key TEXT,
  ADD COLUMN IF NOT EXISTS import_confidence TEXT,
  ADD COLUMN IF NOT EXISTS city_distance_km NUMERIC(10, 2);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'places'
      AND column_name = 'external_id'
  ) THEN
    UPDATE places
    SET import_key = external_id
    WHERE import_key IS NULL
      AND external_id IS NOT NULL;
  END IF;
END $$;

UPDATE places
SET import_key = CONCAT('legacy:place:', id::text)
WHERE import_key IS NULL;

UPDATE places
SET import_confidence = 'high'
WHERE import_confidence IS NULL;

ALTER TABLE IF EXISTS places
  ALTER COLUMN import_key SET NOT NULL,
  ALTER COLUMN import_confidence SET DEFAULT 'high',
  ALTER COLUMN import_confidence SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS places_import_key_unique_idx ON places(import_key);

ALTER TABLE IF EXISTS places
  DROP CONSTRAINT IF EXISTS places_external_id_key;

ALTER TABLE IF EXISTS places
  DROP COLUMN IF EXISTS external_id;

ALTER TABLE IF EXISTS places
  DROP CONSTRAINT IF EXISTS places_import_confidence_check;

ALTER TABLE IF EXISTS places
  ADD CONSTRAINT places_import_confidence_check
  CHECK (import_confidence IN ('high', 'low'));

CREATE INDEX IF NOT EXISTS places_type_id_idx ON places(type_id);
CREATE INDEX IF NOT EXISTS places_source_location_idx ON places(source_location);
CREATE INDEX IF NOT EXISTS places_radius_group_idx ON places(radius_group);
CREATE INDEX IF NOT EXISTS places_lat_lon_idx ON places(latitude, longitude);
CREATE INDEX IF NOT EXISTS places_is_active_id_idx ON places(is_active, id);

CREATE TABLE IF NOT EXISTS place_seasons (
  id BIGSERIAL PRIMARY KEY,
  place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  season_id BIGINT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (place_id, season_id)
);

CREATE INDEX IF NOT EXISTS place_seasons_place_id_idx ON place_seasons(place_id);
CREATE INDEX IF NOT EXISTS place_seasons_season_id_idx ON place_seasons(season_id);

CREATE TABLE IF NOT EXISTS place_likes (
  id BIGSERIAL PRIMARY KEY,
  place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (place_id, user_id)
);

CREATE INDEX IF NOT EXISTS place_likes_place_id_idx ON place_likes(place_id);
CREATE INDEX IF NOT EXISTS place_likes_user_id_idx ON place_likes(user_id);

CREATE TABLE IF NOT EXISTS place_comments (
  id BIGSERIAL PRIMARY KEY,
  place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT place_comments_content_not_blank CHECK (btrim(content) <> '')
);

CREATE INDEX IF NOT EXISTS place_comments_place_id_idx ON place_comments(place_id);
CREATE INDEX IF NOT EXISTS place_comments_user_id_idx ON place_comments(user_id);
CREATE INDEX IF NOT EXISTS place_comments_created_at_idx ON place_comments(created_at DESC);

CREATE TABLE IF NOT EXISTS routes (
  id BIGSERIAL PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  creation_mode TEXT NOT NULL,
  season_id BIGINT REFERENCES seasons(id),
  total_estimated_cost NUMERIC(12, 2),
  total_estimated_duration_minutes INTEGER,
  revision_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT routes_creation_mode_check CHECK (
    creation_mode IN ('quiz', 'selection_builder', 'manual', 'shared_copy')
  )
);

CREATE INDEX IF NOT EXISTS routes_owner_user_id_idx ON routes(owner_user_id);
CREATE INDEX IF NOT EXISTS routes_season_id_idx ON routes(season_id);

CREATE TABLE IF NOT EXISTS route_places (
  id BIGSERIAL PRIMARY KEY,
  route_id BIGINT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  day_number INTEGER,
  estimated_travel_minutes_from_previous INTEGER,
  estimated_distance_km_from_previous NUMERIC(8, 2),
  stay_duration_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (route_id, sort_order)
);

CREATE INDEX IF NOT EXISTS route_places_route_id_idx ON route_places(route_id);
CREATE INDEX IF NOT EXISTS route_places_place_id_idx ON route_places(place_id);

CREATE TABLE IF NOT EXISTS route_access (
  id BIGSERIAL PRIMARY KEY,
  route_id BIGINT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (route_id, user_id),
  CONSTRAINT route_access_type_check CHECK (access_type IN ('shared', 'collaborator', 'viewer'))
);

CREATE INDEX IF NOT EXISTS route_access_route_id_idx ON route_access(route_id);
CREATE INDEX IF NOT EXISTS route_access_user_id_idx ON route_access(user_id);

CREATE TABLE IF NOT EXISTS route_share_links (
  id BIGSERIAL PRIMARY KEY,
  route_id BIGINT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  can_edit BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS route_share_links_route_id_idx ON route_share_links(route_id);
CREATE INDEX IF NOT EXISTS route_share_links_expires_at_idx ON route_share_links(expires_at);

CREATE TABLE IF NOT EXISTS route_build_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
  season_id BIGINT NOT NULL REFERENCES seasons(id),
  source_mode TEXT NOT NULL,
  anchor_place_id BIGINT REFERENCES places(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT route_build_sessions_source_mode_check CHECK (
    source_mode IN ('mobile_swipe', 'desktop_board')
  ),
  CONSTRAINT route_build_sessions_status_check CHECK (
    status IN ('active', 'completed', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS route_build_sessions_user_id_idx ON route_build_sessions(user_id);
CREATE INDEX IF NOT EXISTS route_build_sessions_status_idx ON route_build_sessions(status);

CREATE TABLE IF NOT EXISTS route_build_session_places (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES route_build_sessions(id) ON DELETE CASCADE,
  place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT route_build_session_places_action_type_check CHECK (
    action_type IN ('accepted', 'rejected', 'saved')
  )
);

CREATE INDEX IF NOT EXISTS route_build_session_places_session_id_idx
  ON route_build_session_places(session_id);
CREATE INDEX IF NOT EXISTS route_build_session_places_place_id_idx
  ON route_build_session_places(place_id);
CREATE INDEX IF NOT EXISTS route_build_session_places_action_type_idx
  ON route_build_session_places(action_type);

CREATE TABLE IF NOT EXISTS posts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT posts_content_not_blank CHECK (btrim(content) <> ''),
  CONSTRAINT posts_image_urls_array CHECK (jsonb_typeof(image_urls) = 'array')
);

CREATE INDEX IF NOT EXISTS posts_user_id_idx ON posts(user_id);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at DESC);

INSERT INTO place_types (name, slug)
VALUES
  ('Winery', 'winery'),
  ('Hotel', 'hotel'),
  ('Park', 'park'),
  ('Farm', 'farm'),
  ('Gastro', 'gastro'),
  ('Mountain', 'mountain'),
  ('Event', 'event'),
  ('Museum', 'museum')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO seasons (name, slug)
VALUES
  ('Spring', 'spring'),
  ('Summer', 'summer'),
  ('Autumn', 'autumn'),
  ('Winter', 'winter')
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  winery_type_id BIGINT;
BEGIN
  SELECT id INTO winery_type_id
  FROM place_types
  WHERE slug = 'winery';

  IF winery_type_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'wineries'
    )
  THEN
    INSERT INTO places (
      id,
      import_key,
      type_id,
      name,
      description,
      short_description,
      address,
      latitude,
      longitude,
      source_location,
      card_url,
      logo_url,
      photo_urls,
      radius_group,
      size,
      coordinates_raw,
      is_active
    )
    SELECT
      wineries.id,
      CONCAT('legacy:wineries:', wineries.external_id),
      winery_type_id,
      wineries.name,
      wineries.description,
      CASE
        WHEN wineries.description IS NULL THEN NULL
        ELSE LEFT(wineries.description, 220)
      END,
      wineries.address,
      wineries.lat,
      wineries.lon,
      wineries.source_location,
      wineries.card_url,
      wineries.logo_url,
      COALESCE(wineries.photo_urls, '[]'::jsonb),
      COALESCE(NULLIF(wineries.source_location, ''), 'legacy-import'),
      wineries.size,
      wineries.coordinates_raw,
      TRUE
    FROM wineries
    ON CONFLICT (id) DO UPDATE SET
      import_key = EXCLUDED.import_key,
      type_id = EXCLUDED.type_id,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      short_description = EXCLUDED.short_description,
      address = EXCLUDED.address,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      source_location = EXCLUDED.source_location,
      card_url = EXCLUDED.card_url,
      logo_url = EXCLUDED.logo_url,
      photo_urls = EXCLUDED.photo_urls,
      radius_group = EXCLUDED.radius_group,
      size = EXCLUDED.size,
      coordinates_raw = EXCLUDED.coordinates_raw,
      is_active = EXCLUDED.is_active,
      updated_at = NOW();

    PERFORM setval(
      pg_get_serial_sequence('places', 'id'),
      COALESCE((SELECT MAX(id) FROM places), 1),
      TRUE
    );

    INSERT INTO place_seasons (place_id, season_id)
    SELECT places.id, seasons.id
    FROM places
    CROSS JOIN seasons
    WHERE places.type_id = winery_type_id
    ON CONFLICT (place_id, season_id) DO NOTHING;
  END IF;
END $$;

ALTER TABLE IF EXISTS place_likes
DROP CONSTRAINT IF EXISTS place_likes_place_id_fkey;

ALTER TABLE IF EXISTS place_likes
DROP CONSTRAINT IF EXISTS place_likes_user_id_fkey;

ALTER TABLE IF EXISTS place_likes
ADD CONSTRAINT place_likes_place_id_fkey
FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS place_likes
ADD CONSTRAINT place_likes_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS place_comments
DROP CONSTRAINT IF EXISTS place_comments_place_id_fkey;

ALTER TABLE IF EXISTS place_comments
DROP CONSTRAINT IF EXISTS place_comments_user_id_fkey;

ALTER TABLE IF EXISTS place_comments
ADD CONSTRAINT place_comments_place_id_fkey
FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS place_comments
ADD CONSTRAINT place_comments_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE;

DROP TRIGGER IF EXISTS set_auth_users_updated_at ON auth_users;
CREATE TRIGGER set_auth_users_updated_at
BEFORE UPDATE ON auth_users
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS set_place_types_updated_at ON place_types;
CREATE TRIGGER set_place_types_updated_at
BEFORE UPDATE ON place_types
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS set_seasons_updated_at ON seasons;
CREATE TRIGGER set_seasons_updated_at
BEFORE UPDATE ON seasons
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS set_places_updated_at ON places;
CREATE TRIGGER set_places_updated_at
BEFORE UPDATE ON places
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS set_place_comments_updated_at ON place_comments;
CREATE TRIGGER set_place_comments_updated_at
BEFORE UPDATE ON place_comments
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS set_routes_updated_at ON routes;
CREATE TRIGGER set_routes_updated_at
BEFORE UPDATE ON routes
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS set_route_places_updated_at ON route_places;
CREATE TRIGGER set_route_places_updated_at
BEFORE UPDATE ON route_places
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS set_route_build_sessions_updated_at ON route_build_sessions;
CREATE TRIGGER set_route_build_sessions_updated_at
BEFORE UPDATE ON route_build_sessions
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS set_posts_updated_at ON posts;
CREATE TRIGGER set_posts_updated_at
BEFORE UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

COMMIT;
