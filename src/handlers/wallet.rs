use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::{db, web3, AppState};

#[derive(Debug, Deserialize)]
pub struct NonceRequest {
    pub wallet_address: String,
    pub wallet_type: String,
}

#[derive(Debug, Serialize)]
pub struct NonceResponse {
    pub nonce: String,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifyRequest {
    pub wallet_address: String,
    pub wallet_type: String,
    pub signature: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct VerifyResponse {
    pub success: bool,
    pub message: String,
    pub session_token: Option<String>,
}

pub async fn get_nonce(
    State(state): State<Arc<AppState>>,
    Json(req): Json<NonceRequest>,
) -> Result<Json<NonceResponse>, StatusCode> {
    let user = db::get_or_create_user(&state.db, &req.wallet_address, &req.wallet_type)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let new_nonce = uuid::Uuid::new_v4().to_string();
    db::update_user_nonce(&state.db, user.id, &new_nonce)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let message = match req.wallet_type.as_str() {
        "ethereum" => web3::ethereum::create_siwe_message(&req.wallet_address, &new_nonce),
        "solana" => web3::solana::create_siws_message(&req.wallet_address, &new_nonce),
        _ => return Err(StatusCode::BAD_REQUEST),
    };

    Ok(Json(NonceResponse {
        nonce: new_nonce,
        message,
    }))
}

pub async fn verify_signature(
    State(state): State<Arc<AppState>>,
    Json(req): Json<VerifyRequest>,
) -> Result<Json<VerifyResponse>, StatusCode> {
    let user = db::get_or_create_user(&state.db, &req.wallet_address, &req.wallet_type)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let is_valid = match req.wallet_type.as_str() {
        "ethereum" => {
            web3::ethereum::verify_signature(&req.wallet_address, &req.message, &req.signature)
                .await
        }
        "solana" => {
            web3::solana::verify_signature(&req.wallet_address, &req.message, &req.signature)
        }
        _ => return Err(StatusCode::BAD_REQUEST),
    };

    if !is_valid {
        return Ok(Json(VerifyResponse {
            success: false,
            message: "Invalid signature".to_string(),
            session_token: None,
        }));
    }

    db::update_user_login(&state.db, user.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let session_token = uuid::Uuid::new_v4().to_string();

    Ok(Json(VerifyResponse {
        success: true,
        message: "Authentication successful".to_string(),
        session_token: Some(session_token),
    }))
}
