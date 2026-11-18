CREATE TABLE player_preferences (
  discord_user_id TEXT PRIMARY KEY,
  result_dm_enabled INTEGER NOT NULL DEFAULT 0 CHECK (result_dm_enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP INDEX player_stats_leaderboard;

CREATE INDEX player_stats_leaderboard
  ON player_stats (high_score DESC, highest_level DESC, created_at ASC);

CREATE TRIGGER enforce_run_submission_cooldown
BEFORE INSERT ON run_submissions
WHEN EXISTS (
  SELECT 1
  FROM run_submissions
  WHERE discord_user_id = NEW.discord_user_id
    AND created_at > datetime('now', '-5 seconds')
)
BEGIN
  SELECT RAISE(ABORT, 'run submission cooldown');
END;
