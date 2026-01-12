use axum::{routing::{get, post}, Router};
use std::sync::Arc;

use crate::{handlers::tips, AppState};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/submit", post(tips::submit_tip))
        .route("/list", get(tips::get_tips))
}
