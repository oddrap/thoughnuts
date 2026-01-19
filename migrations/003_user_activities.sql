-- User activity tracking for wallet-based login users
-- This table stores user actions for analytics and engagement tracking

CREATE TABLE IF NOT EXISTS user_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    wallet_address TEXT NOT NULL,          -- 지갑 주소 (비로그인 상태 추적용)
    activity_type TEXT NOT NULL,           -- 활동 유형
    target_type TEXT,                      -- 대상 유형 (post, tip, network, etc.)
    target_id TEXT,                        -- 대상 ID (post slug, tx_hash, etc.)
    metadata TEXT,                         -- JSON 형식의 추가 데이터
    chain TEXT,                            -- 네트워크 (ethereum, base, solana)
    ip_hash TEXT,                          -- IP 해시 (프라이버시 보호)
    user_agent TEXT,                       -- 브라우저 정보
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_activities_user ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_wallet ON user_activities(wallet_address);
CREATE INDEX IF NOT EXISTS idx_activities_type ON user_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_created ON user_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_activities_target ON user_activities(target_type, target_id);

-- Activity types:
-- 'wallet_connect'    - 지갑 연결
-- 'wallet_disconnect' - 지갑 연결 해제
-- 'network_switch'    - 네트워크 전환
-- 'post_view'         - 포스트 조회
-- 'post_read_time'    - 포스트 읽기 시간 (metadata에 duration)
-- 'tip_sent'          - 팁 전송
-- 'tip_received'      - 팁 수신
-- 'scroll_depth'      - 스크롤 깊이 (metadata에 percentage)
-- 'link_click'        - 링크 클릭 (metadata에 url)
-- 'share'             - 공유 (metadata에 platform)

-- Add login_count and total_tips to users table for quick stats
ALTER TABLE users ADD COLUMN login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN total_tips_sent TEXT NOT NULL DEFAULT '0';
ALTER TABLE users ADD COLUMN total_tips_received TEXT NOT NULL DEFAULT '0';
ALTER TABLE users ADD COLUMN preferred_chain TEXT;

-- Create index for user stats queries
CREATE INDEX IF NOT EXISTS idx_users_login_count ON users(login_count);
