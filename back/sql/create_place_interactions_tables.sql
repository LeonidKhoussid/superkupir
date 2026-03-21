BEGIN;

CREATE TABLE IF NOT EXISTS place_likes (
  id BIGSERIAL PRIMARY KEY,
  place_id BIGINT NOT NULL REFERENCES wineries (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS place_likes_place_id_user_id_unique_idx
  ON place_likes (place_id, user_id);

CREATE INDEX IF NOT EXISTS place_likes_place_id_idx
  ON place_likes (place_id);

CREATE INDEX IF NOT EXISTS place_likes_user_id_idx
  ON place_likes (user_id);

CREATE TABLE IF NOT EXISTS place_comments (
  id BIGSERIAL PRIMARY KEY,
  place_id BIGINT NOT NULL REFERENCES wineries (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT place_comments_content_not_blank CHECK (btrim(content) <> '')
);

CREATE INDEX IF NOT EXISTS place_comments_place_id_idx
  ON place_comments (place_id);

CREATE INDEX IF NOT EXISTS place_comments_user_id_idx
  ON place_comments (user_id);

CREATE INDEX IF NOT EXISTS place_comments_created_at_idx
  ON place_comments (created_at DESC);

CREATE OR REPLACE FUNCTION update_place_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_place_comments_updated_at ON place_comments;

CREATE TRIGGER set_place_comments_updated_at
BEFORE UPDATE ON place_comments
FOR EACH ROW
EXECUTE FUNCTION update_place_comments_updated_at();

COMMIT;
