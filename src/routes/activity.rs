use axum::{routing::{get, post}, Router};
use std::sync::Arc;

use crate::{handlers::activity, AppState};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", post(activity::create_activity))
        .route("/", get(activity::get_activities))
        .route("/post/{slug}/stats", get(activity::get_post_stats))
}
