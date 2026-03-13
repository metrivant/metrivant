-- ── 018_user_achievements.sql ────────────────────────────────────────────────
-- Intel Score achievement system.
-- user_achievements: unlocked milestone records per user.
-- user_strategy_actions: completed strategy checklist items per user.

CREATE TABLE IF NOT EXISTS user_achievements (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL,
  unlocked_at    timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS user_strategy_actions (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_id    text NOT NULL,
  completed_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, action_id)
);

-- RLS
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own achievements"
  ON user_achievements FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE user_strategy_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own strategy actions"
  ON user_strategy_actions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id
  ON user_achievements (user_id);

CREATE INDEX IF NOT EXISTS idx_user_strategy_actions_user_id
  ON user_strategy_actions (user_id);
