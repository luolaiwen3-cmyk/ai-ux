ALTER TABLE diagnoses RENAME TO diagnoses_legacy;

CREATE TABLE diagnoses (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  provider TEXT,
  model TEXT,
  result_json TEXT,
  fallback_reason TEXT,
  share_token TEXT NOT NULL UNIQUE,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  last_error TEXT,
  queued_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  next_attempt_at TEXT,
  claimed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

INSERT INTO diagnoses (
  id, session_id, status, provider, model, result_json, fallback_reason,
  share_token, attempt_count, max_attempts, last_error, queued_at,
  started_at, completed_at, created_at, updated_at
)
SELECT
  id, session_id, status, provider, model, result_json, fallback_reason,
  share_token, 1, 3,
  CASE WHEN status = 'failed' THEN fallback_reason ELSE NULL END,
  created_at, created_at,
  CASE WHEN status IN ('completed', 'failed') THEN updated_at ELSE NULL END,
  created_at, updated_at
FROM diagnoses_legacy;

DROP TABLE diagnoses_legacy;

CREATE INDEX diagnoses_share_token_idx ON diagnoses(share_token);
CREATE INDEX diagnoses_queue_idx
  ON diagnoses(status, next_attempt_at, queued_at);
