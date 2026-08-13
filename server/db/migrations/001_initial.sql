CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  public_token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  scenario TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'paused')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE task_steps (
  id INTEGER PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  instruction TEXT NOT NULL,
  UNIQUE (task_id, position)
) STRICT;

CREATE TABLE task_targets (
  task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('builtin', 'upload', 'url')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'invalid')),
  url TEXT,
  origin TEXT,
  content_token TEXT UNIQUE,
  content_revision TEXT,
  validated_at TEXT
) STRICT;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL CHECK (sequence_number > 0),
  participant_code TEXT NOT NULL,
  session_token_hash TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('participant', 'trial')),
  status TEXT NOT NULL CHECK (status IN ('created', 'recording', 'completed', 'abandoned')),
  consent_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  coupon_decision TEXT CHECK (coupon_decision IN ('none', 'applied', 'declined')),
  duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  event_count INTEGER NOT NULL DEFAULT 0 CHECK (event_count >= 0),
  frame_count INTEGER NOT NULL DEFAULT 0 CHECK (frame_count >= 0),
  last_emotion_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (task_id, mode, sequence_number),
  UNIQUE (task_id, participant_code)
) STRICT;

CREATE TABLE session_recordings (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  rrweb_events_json TEXT NOT NULL DEFAULT '[]',
  face_frames_json TEXT NOT NULL DEFAULT '[]',
  metrics_json TEXT NOT NULL DEFAULT '{}',
  task_result_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE diagnoses (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  result_json TEXT,
  fallback_reason TEXT,
  share_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX tasks_created_at_idx ON tasks(created_at DESC);
CREATE INDEX sessions_task_id_idx ON sessions(task_id);
CREATE INDEX sessions_mode_created_at_idx ON sessions(mode, created_at DESC);
CREATE INDEX sessions_status_created_at_idx ON sessions(status, created_at DESC);
CREATE INDEX diagnoses_share_token_idx ON diagnoses(share_token);
