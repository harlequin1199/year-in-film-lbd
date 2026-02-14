CREATE TABLE IF NOT EXISTS client_error_events (
  id UUID PRIMARY KEY,
  error_id VARCHAR(120) NOT NULL UNIQUE,
  message TEXT NOT NULL,
  stack TEXT,
  component_stack TEXT,
  scope VARCHAR(16) NOT NULL,
  feature_name VARCHAR(120),
  route TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_error_events_created_at
  ON client_error_events(created_at DESC);
