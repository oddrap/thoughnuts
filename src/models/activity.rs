use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Types of user activities that can be tracked
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ActivityType {
    WalletConnect,
    WalletDisconnect,
    NetworkSwitch,
    PostView,
    PostReadTime,
    TipSent,
    TipReceived,
    ScrollDepth,
    LinkClick,
    Share,
}

impl std::fmt::Display for ActivityType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            ActivityType::WalletConnect => "wallet_connect",
            ActivityType::WalletDisconnect => "wallet_disconnect",
            ActivityType::NetworkSwitch => "network_switch",
            ActivityType::PostView => "post_view",
            ActivityType::PostReadTime => "post_read_time",
            ActivityType::TipSent => "tip_sent",
            ActivityType::TipReceived => "tip_received",
            ActivityType::ScrollDepth => "scroll_depth",
            ActivityType::LinkClick => "link_click",
            ActivityType::Share => "share",
        };
        write!(f, "{}", s)
    }
}

impl std::str::FromStr for ActivityType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "wallet_connect" => Ok(ActivityType::WalletConnect),
            "wallet_disconnect" => Ok(ActivityType::WalletDisconnect),
            "network_switch" => Ok(ActivityType::NetworkSwitch),
            "post_view" => Ok(ActivityType::PostView),
            "post_read_time" => Ok(ActivityType::PostReadTime),
            "tip_sent" => Ok(ActivityType::TipSent),
            "tip_received" => Ok(ActivityType::TipReceived),
            "scroll_depth" => Ok(ActivityType::ScrollDepth),
            "link_click" => Ok(ActivityType::LinkClick),
            "share" => Ok(ActivityType::Share),
            _ => Err(format!("Unknown activity type: {}", s)),
        }
    }
}

/// Target types for activities
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TargetType {
    Post,
    Tip,
    Network,
    User,
    Link,
}

impl std::fmt::Display for TargetType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            TargetType::Post => "post",
            TargetType::Tip => "tip",
            TargetType::Network => "network",
            TargetType::User => "user",
            TargetType::Link => "link",
        };
        write!(f, "{}", s)
    }
}

/// User activity record stored in database
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserActivity {
    pub id: i64,
    pub user_id: Option<i64>,
    pub wallet_address: String,
    pub activity_type: String,
    pub target_type: Option<String>,
    pub target_id: Option<String>,
    pub metadata: Option<String>,
    pub chain: Option<String>,
    pub ip_hash: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Request to create a new activity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateActivityRequest {
    pub wallet_address: String,
    pub activity_type: String,
    pub target_type: Option<String>,
    pub target_id: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub chain: Option<String>,
}

/// Activity metadata for specific activity types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostReadMetadata {
    pub duration_seconds: u64,
    pub scroll_depth_percent: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkSwitchMetadata {
    pub from_chain: String,
    pub to_chain: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TipMetadata {
    pub amount: String,
    pub currency: String,
    pub tx_hash: String,
    pub post_slug: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkClickMetadata {
    pub url: String,
    pub link_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShareMetadata {
    pub platform: String, // twitter, facebook, copy_link, etc.
    pub content_type: String, // post, tip, etc.
}
