use axum::{routing::post, Router};
use std::sync::Arc;

use crate::{handlers::wallet, AppState};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/nonce", post(wallet::get_nonce))
        .route("/verify", post(wallet::verify_signature))
}
