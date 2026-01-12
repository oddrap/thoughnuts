use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Post {
    pub id: i64,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub content: String,
    pub html_content: String,
    pub author: String,
    pub tags: String,
    pub published: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub views: i64,
}

#[derive(Debug, Deserialize)]
pub struct PostFrontmatter {
    pub title: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub tags: Option<Vec<String>>,
    pub published: Option<bool>,
    pub date: Option<String>,
}

impl Post {
    pub fn tags_list(&self) -> Vec<&str> {
        self.tags.split(',').filter(|s| !s.is_empty()).collect()
    }

    pub fn reading_time(&self) -> u32 {
        let words = self.content.split_whitespace().count();
        ((words as f64 / 200.0).ceil() as u32).max(1)
    }
}
