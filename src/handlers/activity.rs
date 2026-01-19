use axum::{
    extract::{State, Query},
    http::{StatusCode, HeaderMap},
    response::Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::{db, AppState};

#[derive(Debug, Deserialize)]
pub struct CreateActivityRequest {
    pub wallet_address: String,
    pub activity_type: String,
    pub target_type: Option<String>,
    pub target_id: Option<String>,
    pub metadata: Option<String>,
    pub chain: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ActivityResponse {
    pub success: bool,
    pub message: String,
    pub activity_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct GetActivitiesQuery {
    pub wallet_address: Option<String>,
    pub activity_type: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ActivityItem {
    pub id: i64,
    pub wallet_address: String,
    pub activity_type: String,
    pub target_type: Option<String>,
    pub target_id: Option<String>,
    pub metadata: Option<String>,
    pub chain: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct ActivitiesResponse {
    pub success: bool,
    pub activities: Vec<ActivityItem>,
}

fn hash_ip(ip: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    ip.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

fn extract_client_info(headers: &HeaderMap) -> (Option<String>, Option<String>) {
    let ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or(s).trim().to_string())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string())
        });

    let user_agent = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    (ip.map(|ip| hash_ip(&ip)), user_agent)
}

/// POST /api/activity - Create a new activity record
pub async fn create_activity(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<CreateActivityRequest>,
) -> Result<Json<ActivityResponse>, StatusCode> {
    let (ip_hash, user_agent) = extract_client_info(&headers);

    let activity_id = db::create_activity(
        &state.db,
        &req.wallet_address,
        &req.activity_type,
        req.target_type.as_deref(),
        req.target_id.as_deref(),
        req.metadata.as_deref(),
        req.chain.as_deref(),
        ip_hash.as_deref(),
        user_agent.as_deref(),
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to create activity: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // If this is a wallet_connect event, increment login count
    if req.activity_type == "wallet_connect" {
        if let Ok(Some(user)) = db::get_user_by_wallet(&state.db, &req.wallet_address).await {
            let _ = db::increment_user_login_count(&state.db, user.id).await;

            // Update preferred chain if provided
            if let Some(chain) = &req.chain {
                let _ = db::update_user_preferred_chain(&state.db, user.id, chain).await;
            }
        }
    }

    // If this is a network_switch event, update preferred chain
    if req.activity_type == "network_switch" {
        if let Some(chain) = &req.chain {
            if let Ok(Some(user)) = db::get_user_by_wallet(&state.db, &req.wallet_address).await {
                let _ = db::update_user_preferred_chain(&state.db, user.id, chain).await;
            }
        }
    }

    Ok(Json(ActivityResponse {
        success: true,
        message: "Activity recorded".to_string(),
        activity_id: Some(activity_id),
    }))
}

/// GET /api/activity - Get activities (optionally filtered)
pub async fn get_activities(
    State(state): State<Arc<AppState>>,
    Query(query): Query<GetActivitiesQuery>,
) -> Result<Json<ActivitiesResponse>, StatusCode> {
    let limit = query.limit.unwrap_or(50);

    let activities = if let Some(wallet) = &query.wallet_address {
        db::get_user_activities(&state.db, wallet, limit)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else if let Some(activity_type) = &query.activity_type {
        db::get_activities_by_type(&state.db, activity_type, limit)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        // Return empty if no filter provided (for privacy)
        Vec::new()
    };

    let items: Vec<ActivityItem> = activities
        .into_iter()
        .map(|a| ActivityItem {
            id: a.id,
            wallet_address: a.wallet_address,
            activity_type: a.activity_type,
            target_type: a.target_type,
            target_id: a.target_id,
            metadata: a.metadata,
            chain: a.chain,
            created_at: a.created_at.to_rfc3339(),
        })
        .collect();

    Ok(Json(ActivitiesResponse {
        success: true,
        activities: items,
    }))
}

#[derive(Debug, Serialize)]
pub struct PostStatsResponse {
    pub success: bool,
    pub slug: String,
    pub total_views: i64,
    pub unique_viewers: i64,
}

/// GET /api/activity/post/:slug/stats - Get post statistics
pub async fn get_post_stats(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(slug): axum::extract::Path<String>,
) -> Result<Json<PostStatsResponse>, StatusCode> {
    let total_views = db::get_post_view_count(&state.db, &slug)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let unique_viewers = db::get_post_unique_viewers(&state.db, &slug)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(PostStatsResponse {
        success: true,
        slug,
        total_views,
        unique_viewers,
    }))
}
