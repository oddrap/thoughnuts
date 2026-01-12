use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Tip {
    pub id: i64,
    pub post_id: Option<i64>,
    pub from_address: String,
    pub to_address: String,
    pub amount: String,
    pub currency: String,
    pub chain: String,
    pub tx_hash: String,
    pub verified: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct TipRequest {
    pub post_id: Option<i64>,
    pub from_address: String,
    pub amount: String,
    pub currency: String,
    pub chain: String,
    pub tx_hash: String,
}

#[derive(Debug, Serialize)]
pub struct TipResponse {
    pub success: bool,
    pub message: String,
    pub tip_id: Option<i64>,
}
