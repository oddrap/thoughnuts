use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
};
use chrono::Utc;
use std::sync::Arc;

use crate::{
    db,
    models::tip::{Tip, TipRequest, TipResponse},
    web3, AppState,
};

pub async fn submit_tip(
    State(state): State<Arc<AppState>>,
    Json(req): Json<TipRequest>,
) -> Result<Json<TipResponse>, StatusCode> {
    let to_address = match req.chain.as_str() {
        "ethereum" => state.config.author_eth_address.clone(),
        "solana" => state.config.author_sol_address.clone(),
        _ => {
            return Ok(Json(TipResponse {
                success: false,
                message: "Unsupported chain".to_string(),
                tip_id: None,
            }))
        }
    };

    let tip = Tip {
        id: 0,
        post_id: req.post_id,
        from_address: req.from_address.clone(),
        to_address: to_address.clone(),
        amount: req.amount.clone(),
        currency: req.currency.clone(),
        chain: req.chain.clone(),
        tx_hash: req.tx_hash.clone(),
        verified: false,
        created_at: Utc::now(),
    };

    let tip_id = db::create_tip(&state.db, &tip)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    tokio::spawn({
        let db = state.db.clone();
        let config = state.config.clone();
        let chain = req.chain.clone();
        let tx_hash = req.tx_hash.clone();

        async move {
            let verified = match chain.as_str() {
                "ethereum" => {
                    web3::ethereum::verify_transaction(&config.eth_rpc_url, &tx_hash, &to_address)
                        .await
                }
                "solana" => {
                    web3::solana::verify_transaction(&config.sol_rpc_url, &tx_hash, &to_address)
                        .await
                }
                _ => false,
            };

            if verified {
                let _ = db::verify_tip(&db, tip_id).await;
            }
        }
    });

    Ok(Json(TipResponse {
        success: true,
        message: "Tip submitted, verification in progress".to_string(),
        tip_id: Some(tip_id),
    }))
}

pub async fn get_tips(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Tip>>, StatusCode> {
    let tips = db::get_all_tips(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(tips))
}
