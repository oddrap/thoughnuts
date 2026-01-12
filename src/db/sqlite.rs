use anyhow::Result;
use chrono::Utc;
use sqlx::SqlitePool;

use crate::models::{Post, Tip, User};

pub async fn get_all_posts(pool: &SqlitePool) -> Result<Vec<Post>> {
    let posts = sqlx::query_as::<_, Post>(
        r#"
        SELECT * FROM posts
        WHERE published = true
        ORDER BY created_at DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(posts)
}

pub async fn get_post_by_slug(pool: &SqlitePool, slug: &str) -> Result<Option<Post>> {
    let post = sqlx::query_as::<_, Post>(
        r#"
        SELECT * FROM posts WHERE slug = ? AND published = true
        "#,
    )
    .bind(slug)
    .fetch_optional(pool)
    .await?;

    Ok(post)
}

pub async fn increment_post_views(pool: &SqlitePool, slug: &str) -> Result<()> {
    sqlx::query("UPDATE posts SET views = views + 1 WHERE slug = ?")
        .bind(slug)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn create_post(pool: &SqlitePool, post: &Post) -> Result<i64> {
    let result = sqlx::query(
        r#"
        INSERT INTO posts (slug, title, description, content, html_content, author, tags, published, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&post.slug)
    .bind(&post.title)
    .bind(&post.description)
    .bind(&post.content)
    .bind(&post.html_content)
    .bind(&post.author)
    .bind(&post.tags)
    .bind(post.published)
    .bind(post.created_at)
    .bind(post.updated_at)
    .execute(pool)
    .await?;

    Ok(result.last_insert_rowid())
}

pub async fn get_or_create_user(
    pool: &SqlitePool,
    wallet_address: &str,
    wallet_type: &str,
) -> Result<User> {
    let existing = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE wallet_address = ? AND wallet_type = ?",
    )
    .bind(wallet_address)
    .bind(wallet_type)
    .fetch_optional(pool)
    .await?;

    if let Some(user) = existing {
        return Ok(user);
    }

    let nonce = uuid::Uuid::new_v4().to_string();
    let now = Utc::now();

    sqlx::query(
        r#"
        INSERT INTO users (wallet_address, wallet_type, nonce, created_at)
        VALUES (?, ?, ?, ?)
        "#,
    )
    .bind(wallet_address)
    .bind(wallet_type)
    .bind(&nonce)
    .bind(now)
    .execute(pool)
    .await?;

    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE wallet_address = ? AND wallet_type = ?",
    )
    .bind(wallet_address)
    .bind(wallet_type)
    .fetch_one(pool)
    .await?;

    Ok(user)
}

pub async fn update_user_nonce(pool: &SqlitePool, user_id: i64, nonce: &str) -> Result<()> {
    sqlx::query("UPDATE users SET nonce = ? WHERE id = ?")
        .bind(nonce)
        .bind(user_id)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn update_user_login(pool: &SqlitePool, user_id: i64) -> Result<()> {
    sqlx::query("UPDATE users SET last_login = ? WHERE id = ?")
        .bind(Utc::now())
        .bind(user_id)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn create_tip(pool: &SqlitePool, tip: &Tip) -> Result<i64> {
    let result = sqlx::query(
        r#"
        INSERT INTO tips (post_id, from_address, to_address, amount, currency, chain, tx_hash, verified, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(tip.post_id)
    .bind(&tip.from_address)
    .bind(&tip.to_address)
    .bind(&tip.amount)
    .bind(&tip.currency)
    .bind(&tip.chain)
    .bind(&tip.tx_hash)
    .bind(tip.verified)
    .bind(tip.created_at)
    .execute(pool)
    .await?;

    Ok(result.last_insert_rowid())
}

pub async fn get_tips_for_post(pool: &SqlitePool, post_id: i64) -> Result<Vec<Tip>> {
    let tips = sqlx::query_as::<_, Tip>(
        "SELECT * FROM tips WHERE post_id = ? AND verified = true ORDER BY created_at DESC",
    )
    .bind(post_id)
    .fetch_all(pool)
    .await?;

    Ok(tips)
}

pub async fn get_all_tips(pool: &SqlitePool) -> Result<Vec<Tip>> {
    let tips = sqlx::query_as::<_, Tip>(
        "SELECT * FROM tips WHERE verified = true ORDER BY created_at DESC LIMIT 50",
    )
    .fetch_all(pool)
    .await?;

    Ok(tips)
}

pub async fn verify_tip(pool: &SqlitePool, tip_id: i64) -> Result<()> {
    sqlx::query("UPDATE tips SET verified = true WHERE id = ?")
        .bind(tip_id)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn post_exists(pool: &SqlitePool, slug: &str) -> Result<bool> {
    let result: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM posts WHERE slug = ?")
        .bind(slug)
        .fetch_one(pool)
        .await?;

    Ok(result.0 > 0)
}

pub async fn upsert_post(pool: &SqlitePool, post: &Post) -> Result<i64> {
    let exists = post_exists(pool, &post.slug).await?;

    if exists {
        sqlx::query(
            r#"
            UPDATE posts SET
                title = ?, description = ?, content = ?, html_content = ?,
                author = ?, tags = ?, published = ?, updated_at = ?
            WHERE slug = ?
            "#,
        )
        .bind(&post.title)
        .bind(&post.description)
        .bind(&post.content)
        .bind(&post.html_content)
        .bind(&post.author)
        .bind(&post.tags)
        .bind(post.published)
        .bind(post.updated_at)
        .bind(&post.slug)
        .execute(pool)
        .await?;

        let existing: (i64,) = sqlx::query_as("SELECT id FROM posts WHERE slug = ?")
            .bind(&post.slug)
            .fetch_one(pool)
            .await?;

        Ok(existing.0)
    } else {
        create_post(pool, post).await
    }
}
