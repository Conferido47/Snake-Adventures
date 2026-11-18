-- Browser/Windows identities are installation-scoped, not verified Discord accounts.
CREATE TABLE named_players (
  player_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 32),
  platform TEXT NOT NULL CHECK (platform IN ('browser', 'windows')),
  game_version TEXT NOT NULL,
  high_score INTEGER NOT NULL DEFAULT 0,
  highest_level INTEGER NOT NULL DEFAULT 1,
  total_runs INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE named_sessions (
  player_id TEXT NOT NULL REFERENCES named_players(player_id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (player_id, session_id)
);

CREATE TABLE named_runs (
  player_id TEXT NOT NULL REFERENCES named_players(player_id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 10000000),
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 1000),
  won INTEGER NOT NULL CHECK (won IN (0, 1)),
  game_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (player_id, submission_id)
);

CREATE TRIGGER named_session_stats AFTER INSERT ON named_sessions BEGIN
  UPDATE named_players SET total_sessions = total_sessions + 1,
    updated_at = CURRENT_TIMESTAMP WHERE player_id = NEW.player_id;
END;

CREATE TRIGGER named_run_cooldown BEFORE INSERT ON named_runs
WHEN NOT EXISTS (SELECT 1 FROM named_runs WHERE player_id = NEW.player_id AND submission_id = NEW.submission_id)
  AND EXISTS (SELECT 1 FROM named_runs WHERE player_id = NEW.player_id AND created_at > datetime('now', '-5 seconds'))
BEGIN
  SELECT RAISE(ABORT, 'named run cooldown');
END;

CREATE TRIGGER named_run_stats AFTER INSERT ON named_runs BEGIN
  UPDATE named_players SET total_runs = total_runs + 1,
    high_score = MAX(high_score, NEW.score), highest_level = MAX(highest_level, NEW.level),
    updated_at = CURRENT_TIMESTAMP WHERE player_id = NEW.player_id;
END;

-- Admin-only views: the Discord leaderboard continues to use verified Discord rows.
CREATE VIEW all_player_stats AS
SELECT discord_user_id, display_name, high_score, highest_level, current_streak,
  longest_streak, last_play_date, total_runs, created_at, updated_at,
  'discord' AS platform, NULL AS total_sessions
FROM player_stats
UNION ALL
SELECT player_id, display_name, high_score, highest_level, NULL, NULL,
  substr(updated_at, 1, 10), total_runs, created_at, updated_at, platform, total_sessions
FROM named_players;

CREATE VIEW all_run_submissions AS
SELECT submission_id, discord_user_id, score, level, won, game_version, created_at FROM run_submissions
UNION ALL
SELECT submission_id, player_id, score, level, won, game_version, created_at FROM named_runs;
