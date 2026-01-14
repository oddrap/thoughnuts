use askama::Template;
use axum::{
    extract::{Path, State},
    response::Html,
};
use std::sync::Arc;

use crate::{db, models::Post, AppState};

#[derive(Template)]
#[template(path = "index.html")]
pub struct IndexTemplate {
    pub title: String,
    pub description: String,
    pub posts: Vec<Post>,
}

#[derive(Template)]
#[template(path = "post.html")]
pub struct PostTemplate {
    pub title: String,
    pub post: Post,
    pub author_eth_address: String,
    pub author_avax_address: String,
    pub author_sol_address: String,
    pub author_btc_address: String,
}

#[derive(Template)]
#[template(path = "posts.html")]
pub struct PostsTemplate {
    pub title: String,
    pub posts: Vec<Post>,
}

pub async fn index(State(state): State<Arc<AppState>>) -> Html<String> {
    let posts = db::get_all_posts(&state.db).await.unwrap_or_default();

    let template = IndexTemplate {
        title: state.config.blog_title.clone(),
        description: state.config.blog_description.clone(),
        posts,
    };

    Html(template.render().unwrap_or_else(|e| format!("Error: {}", e)))
}

pub async fn show(State(state): State<Arc<AppState>>, Path(slug): Path<String>) -> Html<String> {
    match db::get_post_by_slug(&state.db, &slug).await {
        Ok(Some(post)) => {
            // Increment view count
            let _ = db::increment_post_views(&state.db, &slug).await;

            let template = PostTemplate {
                title: format!("{} | {}", post.title, state.config.blog_title),
                post,
                author_eth_address: state.config.author_eth_address.clone(),
                author_avax_address: state.config.author_avax_address.clone(),
                author_sol_address: state.config.author_sol_address.clone(),
                author_btc_address: state.config.author_btc_address.clone(),
            };
            Html(template.render().unwrap_or_else(|e| format!("Error: {}", e)))
        }
        _ => Html("<h1>Post not found</h1>".to_string()),
    }
}

pub async fn list(State(state): State<Arc<AppState>>) -> Html<String> {
    let posts = db::get_all_posts(&state.db).await.unwrap_or_default();

    let template = PostsTemplate {
        title: format!("All Posts | {}", state.config.blog_title),
        posts,
    };

    Html(template.render().unwrap_or_else(|e| format!("Error: {}", e)))
}
