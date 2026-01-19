use askama::Template;
use axum::{
    extract::{Path, State},
    response::Html,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use chrono::Utc;

use crate::{db, markdown::MarkdownParser, models::Post, AppState};

// Admin wallet addresses (lowercase)
const ADMIN_ADDRESSES: &[&str] = &["0x360091e9e692b7775543da956b7ca6cc39bae86c"];

fn is_admin(address: &str) -> bool {
    ADMIN_ADDRESSES.contains(&address.to_lowercase().as_str())
}

#[derive(Clone)]
pub struct PostData {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub author: String,
    pub tags: String,
    pub content: String,
}

impl Default for PostData {
    fn default() -> Self {
        Self {
            slug: String::new(),
            title: String::new(),
            description: String::new(),
            author: String::new(),
            tags: String::new(),
            content: String::new(),
        }
    }
}

#[derive(Template)]
#[template(path = "admin/editor.html")]
pub struct EditorTemplate {
    pub is_edit: bool,
    pub post: PostData,
}

#[derive(Debug, Deserialize)]
pub struct PostRequest {
    pub title: String,
    pub slug: String,
    pub description: String,
    pub author: String,
    pub tags: String,
    pub content: String,
    pub wallet_address: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DeleteRequest {
    pub wallet_address: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ApiResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slug: Option<String>,
}

// Editor page for new post
pub async fn new_post() -> Html<String> {
    let template = EditorTemplate {
        is_edit: false,
        post: PostData::default(),
    };
    Html(template.render().unwrap_or_else(|e| format!("Error: {}", e)))
}

// Editor page for editing existing post
pub async fn edit_post(
    State(state): State<Arc<AppState>>,
    Path(slug): Path<String>,
) -> Html<String> {
    match db::get_post_by_slug(&state.db, &slug).await {
        Ok(Some(post)) => {
            let template = EditorTemplate {
                is_edit: true,
                post: PostData {
                    slug: post.slug,
                    title: post.title,
                    description: post.description,
                    author: post.author,
                    tags: post.tags,
                    content: post.content,
                },
            };
            Html(template.render().unwrap_or_else(|e| format!("Error: {}", e)))
        }
        _ => Html("<h1>Post not found</h1>".to_string()),
    }
}

// API: Create new post
pub async fn create_post(
    State(state): State<Arc<AppState>>,
    Json(req): Json<PostRequest>,
) -> Json<ApiResponse> {
    // Check admin authorization
    let wallet = req.wallet_address.as_deref().unwrap_or("");
    if !is_admin(wallet) {
        return Json(ApiResponse {
            success: false,
            error: Some("Unauthorized".to_string()),
            slug: None,
        });
    }

    let parser = MarkdownParser::new();
    let html_content = match parser.parse(&req.content) {
        Ok(html) => html,
        Err(e) => {
            return Json(ApiResponse {
                success: false,
                error: Some(format!("Failed to parse markdown: {}", e)),
                slug: None,
            });
        }
    };

    let post = Post {
        id: 0,
        slug: req.slug.clone(),
        title: req.title,
        description: req.description,
        content: req.content.clone(),
        html_content,
        author: req.author,
        tags: req.tags,
        published: true,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        views: 0,
    };

    match db::upsert_post(&state.db, &post).await {
        Ok(_) => {
            // Also save to markdown file
            let _ = save_post_to_file(&post, &req.content);

            Json(ApiResponse {
                success: true,
                error: None,
                slug: Some(req.slug),
            })
        }
        Err(e) => Json(ApiResponse {
            success: false,
            error: Some(format!("Failed to save: {}", e)),
            slug: None,
        }),
    }
}

// API: Update existing post
pub async fn update_post(
    State(state): State<Arc<AppState>>,
    Path(slug): Path<String>,
    Json(req): Json<PostRequest>,
) -> Json<ApiResponse> {
    // Check admin authorization
    let wallet = req.wallet_address.as_deref().unwrap_or("");
    if !is_admin(wallet) {
        return Json(ApiResponse {
            success: false,
            error: Some("Unauthorized".to_string()),
            slug: None,
        });
    }

    // Get existing post to preserve views
    let existing = db::get_post_by_slug(&state.db, &slug).await.ok().flatten();
    let views = existing.map(|p| p.views).unwrap_or(0);

    let parser = MarkdownParser::new();
    let html_content = match parser.parse(&req.content) {
        Ok(html) => html,
        Err(e) => {
            return Json(ApiResponse {
                success: false,
                error: Some(format!("Failed to parse markdown: {}", e)),
                slug: None,
            });
        }
    };

    let post = Post {
        id: 0,
        slug: slug.clone(),
        title: req.title,
        description: req.description,
        content: req.content.clone(),
        html_content,
        author: req.author,
        tags: req.tags,
        published: true,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        views,
    };

    match db::upsert_post(&state.db, &post).await {
        Ok(_) => {
            // Also update markdown file
            let _ = save_post_to_file(&post, &req.content);

            Json(ApiResponse {
                success: true,
                error: None,
                slug: Some(slug),
            })
        }
        Err(e) => Json(ApiResponse {
            success: false,
            error: Some(format!("Failed to save: {}", e)),
            slug: None,
        }),
    }
}

// API: Delete post
pub async fn delete_post(
    State(state): State<Arc<AppState>>,
    Path(slug): Path<String>,
    Json(req): Json<DeleteRequest>,
) -> Json<ApiResponse> {
    // Check admin authorization
    let wallet = req.wallet_address.as_deref().unwrap_or("");
    if !is_admin(wallet) {
        return Json(ApiResponse {
            success: false,
            error: Some("Unauthorized".to_string()),
            slug: None,
        });
    }

    match db::delete_post(&state.db, &slug).await {
        Ok(_) => {
            // Also delete markdown file
            let _ = std::fs::remove_file(format!("posts/{}.md", slug));

            Json(ApiResponse {
                success: true,
                error: None,
                slug: None,
            })
        }
        Err(e) => Json(ApiResponse {
            success: false,
            error: Some(format!("Failed to delete: {}", e)),
            slug: None,
        }),
    }
}

fn save_post_to_file(post: &Post, content: &str) -> std::io::Result<()> {
    let posts_dir = std::path::Path::new("posts");
    if !posts_dir.exists() {
        std::fs::create_dir_all(posts_dir)?;
    }

    let frontmatter = format!(
        r#"---
title: "{}"
description: "{}"
author: "{}"
tags: [{}]
published: true
---

{}"#,
        post.title,
        post.description,
        post.author,
        post.tags.split(',').map(|t| format!("\"{}\"", t.trim())).collect::<Vec<_>>().join(", "),
        content
    );

    std::fs::write(format!("posts/{}.md", post.slug), frontmatter)
}
