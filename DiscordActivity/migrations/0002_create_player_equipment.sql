CREATE TABLE player_equipment (
  discord_user_id TEXT NOT NULL,
  slot TEXT NOT NULL,
  cosmetic_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (discord_user_id, slot)
);

CREATE INDEX player_equipment_by_cosmetic
  ON player_equipment (cosmetic_id, updated_at DESC);
