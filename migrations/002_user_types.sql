-- Add user_type column for role-based access control
-- Types: 'admin', 'writer', 'reader'

ALTER TABLE users ADD COLUMN user_type TEXT NOT NULL DEFAULT 'reader';

-- Create index for user_type queries
CREATE INDEX IF NOT EXISTS idx_users_type ON users(user_type);
