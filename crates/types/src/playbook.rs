use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playbook {
    /// slug from filename
    pub id: String,
    pub title: String,
    pub content: Option<String>,
    pub tags: Vec<String>,
    pub org: Option<String>,
    pub forked_from: Option<String>,
    pub file_path: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}
