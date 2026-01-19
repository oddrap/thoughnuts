mod config;
mod db;
mod handlers;
mod markdown;
mod models;
mod routes;
mod web3;

use anyhow::Result;
use axum::{routing::{get, post, put, delete}, Router};
use chrono::Utc;
use sqlx::sqlite::SqlitePoolOptions;
use std::sync::Arc;
use tower_http::{cors::CorsLayer, services::ServeDir, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::config::Config;
use crate::markdown::MarkdownParser;
use crate::models::Post;

pub struct AppState {
    pub db: sqlx::SqlitePool,
    pub config: Config,
}

async fn load_posts_from_directory(pool: &sqlx::SqlitePool) -> Result<()> {
    let posts_dir = std::path::Path::new("posts");

    if !posts_dir.exists() {
        tracing::info!("No posts directory found, skipping post loading");
        return Ok(());
    }

    let parser = MarkdownParser::new();

    for entry in std::fs::read_dir(posts_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.extension().map(|e| e == "md").unwrap_or(false) {
            let content = std::fs::read_to_string(&path)?;
            let slug = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("untitled")
                .to_string();

            match markdown::parse_frontmatter(&content) {
                Ok((frontmatter, markdown_content)) => {
                    let html_content = parser.parse(&markdown_content)?;

                    let post = Post {
                        id: 0,
                        slug,
                        title: frontmatter.title,
                        description: frontmatter.description.unwrap_or_default(),
                        content: markdown_content,
                        html_content,
                        author: frontmatter.author.unwrap_or_else(|| "Anonymous".to_string()),
                        tags: frontmatter.tags.unwrap_or_default().join(","),
                        published: frontmatter.published.unwrap_or(true),
                        created_at: Utc::now(),
                        updated_at: Utc::now(),
                        views: 0,
                    };

                    match db::upsert_post(pool, &post).await {
                        Ok(_) => tracing::info!("Loaded post: {}", post.title),
                        Err(e) => tracing::error!("Failed to load post {}: {}", post.title, e),
                    }
                }
                Err(e) => {
                    tracing::warn!("Failed to parse frontmatter for {:?}: {}", path, e);
                }
            }
        }
    }

    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "vibe_p_one=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env();

    let db = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&config.database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&db).await?;

    // Load posts from markdown files
    if let Err(e) = load_posts_from_directory(&db).await {
        tracing::error!("Failed to load posts: {}", e);
    }

    let state = Arc::new(AppState { db, config });

    let app = Router::new()
        .route("/", get(handlers::posts::index))
        .route("/post/:slug", get(handlers::posts::show))
        .route("/posts", get(handlers::posts::list))
        // Admin routes
        .route("/admin/post/new", get(handlers::admin::new_post))
        .route("/admin/post/edit/:slug", get(handlers::admin::edit_post))
        .route("/api/admin/posts", post(handlers::admin::create_post))
        .route("/api/admin/posts/:slug", put(handlers::admin::update_post))
        .route("/api/admin/posts/:slug", delete(handlers::admin::delete_post))
        .nest("/api/auth", routes::auth::router())
        .nest("/api/tips", routes::tipping::router())
        .nest("/api/activity", routes::activity::router())
        .nest_service("/static", ServeDir::new("static"))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    tracing::info!("Server running on http://localhost:3000");

    axum::serve(listener, app).await?;

    Ok(())
}
