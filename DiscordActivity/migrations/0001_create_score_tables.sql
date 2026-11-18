CREATE TABLE player_stats (
  discord_user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  high_score INTEGER NOT NULL DEFAULT 0 CHECK (high_score >= 0),
  highest_level INTEGER NOT NULL DEFAULT 1 CHECK (highest_level >= 1),
  current_streak INTEGER NOT NULL DEFAULT 1 CHECK (current_streak >= 1),
  longest_streak INTEGER NOT NULL DEFAULT 1 CHECK (longest_streak >= 1),
  last_play_date TEXT NOT NULL,
  total_runs INTEGER NOT NULL DEFAULT 0 CHECK (total_runs >= 0),
  last_posted_at INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE run_submissions (
  submission_id TEXT PRIMARY KEY,
  discord_user_id TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  level INTEGER NOT NULL CHECK (level >= 1),
  won INTEGER NOT NULL CHECK (won IN (0, 1)),
  game_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX run_submissions_by_player
  ON run_submissions (discord_user_id, created_at DESC);

CREATE INDEX player_stats_leaderboard
  ON player_stats (high_score DESC, highest_level DESC, updated_at ASC);
