use anyhow::Result;
use chrono::Utc;
use sqlx::SqlitePool;

use crate::models::{Post, Tip, User, UserActivity};

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

pub async fn delete_post(pool: &SqlitePool, slug: &str) -> Result<()> {
    sqlx::query("DELETE FROM posts WHERE slug = ?")
        .bind(slug)
        .execute(pool)
        .await?;

    Ok(())
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

// =============================================
// USER ACTIVITY TRACKING FUNCTIONS
// =============================================

/// Create a new user activity record
pub async fn create_activity(
    pool: &SqlitePool,
    wallet_address: &str,
    activity_type: &str,
    target_type: Option<&str>,
    target_id: Option<&str>,
    metadata: Option<&str>,
    chain: Option<&str>,
    ip_hash: Option<&str>,
    user_agent: Option<&str>,
) -> Result<i64> {
    // Try to find user_id for this wallet
    let user: Option<(i64,)> = sqlx::query_as(
        "SELECT id FROM users WHERE wallet_address = ? LIMIT 1"
    )
    .bind(wallet_address)
    .fetch_optional(pool)
    .await?;

    let user_id = user.map(|u| u.0);

    let result = sqlx::query(
        r#"
        INSERT INTO user_activities (user_id, wallet_address, activity_type, target_type, target_id, metadata, chain, ip_hash, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(user_id)
    .bind(wallet_address)
    .bind(activity_type)
    .bind(target_type)
    .bind(target_id)
    .bind(metadata)
    .bind(chain)
    .bind(ip_hash)
    .bind(user_agent)
    .bind(Utc::now())
    .execute(pool)
    .await?;

    Ok(result.last_insert_rowid())
}

/// Get activities for a specific user
pub async fn get_user_activities(
    pool: &SqlitePool,
    wallet_address: &str,
    limit: i64,
) -> Result<Vec<UserActivity>> {
    let activities = sqlx::query_as::<_, UserActivity>(
        r#"
        SELECT * FROM user_activities
        WHERE wallet_address = ?
        ORDER BY created_at DESC
        LIMIT ?
        "#,
    )
    .bind(wallet_address)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(activities)
}

/// Get activities by type
pub async fn get_activities_by_type(
    pool: &SqlitePool,
    activity_type: &str,
    limit: i64,
) -> Result<Vec<UserActivity>> {
    let activities = sqlx::query_as::<_, UserActivity>(
        r#"
        SELECT * FROM user_activities
        WHERE activity_type = ?
        ORDER BY created_at DESC
        LIMIT ?
        "#,
    )
    .bind(activity_type)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(activities)
}

/// Get post view count from activities (more accurate than views column)
pub async fn get_post_view_count(pool: &SqlitePool, post_slug: &str) -> Result<i64> {
    let result: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*) FROM user_activities
        WHERE activity_type = 'post_view' AND target_id = ?
        "#,
    )
    .bind(post_slug)
    .fetch_one(pool)
    .await?;

    Ok(result.0)
}

/// Get unique viewers for a post
pub async fn get_post_unique_viewers(pool: &SqlitePool, post_slug: &str) -> Result<i64> {
    let result: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(DISTINCT wallet_address) FROM user_activities
        WHERE activity_type = 'post_view' AND target_id = ?
        "#,
    )
    .bind(post_slug)
    .fetch_one(pool)
    .await?;

    Ok(result.0)
}

/// Increment user login count
pub async fn increment_user_login_count(pool: &SqlitePool, user_id: i64) -> Result<()> {
    sqlx::query("UPDATE users SET login_count = login_count + 1, last_login = ? WHERE id = ?")
        .bind(Utc::now())
        .bind(user_id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Update user preferred chain
pub async fn update_user_preferred_chain(pool: &SqlitePool, user_id: i64, chain: &str) -> Result<()> {
    sqlx::query("UPDATE users SET preferred_chain = ? WHERE id = ?")
        .bind(chain)
        .bind(user_id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Get user by wallet address (any chain)
pub async fn get_user_by_wallet(pool: &SqlitePool, wallet_address: &str) -> Result<Option<User>> {
    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE wallet_address = ? LIMIT 1",
    )
    .bind(wallet_address)
    .fetch_optional(pool)
    .await?;

    Ok(user)
}

/// Reader info with last read post
#[derive(Debug, sqlx::FromRow)]
pub struct ReaderInfo {
    pub wallet_address: String,
    pub wallet_type: Option<String>,
    pub last_login: Option<chrono::DateTime<chrono::Utc>>,
    pub login_count: i64,
    pub last_post_slug: Option<String>,
    pub last_post_title: Option<String>,
    pub last_read_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Get all readers with their last read post
pub async fn get_readers_with_last_post(pool: &SqlitePool) -> Result<Vec<ReaderInfo>> {
    let readers = sqlx::query_as::<_, ReaderInfo>(
        r#"
        SELECT
            u.wallet_address,
            u.wallet_type,
            u.last_login,
            COALESCE(u.login_count, 0) as login_count,
            (
                SELECT ua.target_id
                FROM user_activities ua
                WHERE ua.wallet_address = u.wallet_address
                AND ua.activity_type = 'post_view'
                ORDER BY ua.created_at DESC
                LIMIT 1
            ) as last_post_slug,
            (
                SELECT p.title
                FROM user_activities ua
                JOIN posts p ON p.slug = ua.target_id
                WHERE ua.wallet_address = u.wallet_address
                AND ua.activity_type = 'post_view'
                ORDER BY ua.created_at DESC
                LIMIT 1
            ) as last_post_title,
            (
                SELECT ua.created_at
                FROM user_activities ua
                WHERE ua.wallet_address = u.wallet_address
                AND ua.activity_type = 'post_view'
                ORDER BY ua.created_at DESC
                LIMIT 1
            ) as last_read_at
        FROM users u
        ORDER BY u.last_login DESC NULLS LAST
        LIMIT 100
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(readers)
}
