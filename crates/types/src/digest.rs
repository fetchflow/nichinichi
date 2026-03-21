use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DigestType {
    Weekly,
    Monthly,
    Review,
}

impl std::fmt::Display for DigestType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DigestType::Weekly => f.write_str("weekly"),
            DigestType::Monthly => f.write_str("monthly"),
            DigestType::Review => f.write_str("review"),
        }
    }
}

impl std::str::FromStr for DigestType {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "weekly" => Ok(DigestType::Weekly),
            "monthly" => Ok(DigestType::Monthly),
            "review" => Ok(DigestType::Review),
            other => Err(format!("unknown digest type: {other}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Digest {
    pub id: String,
    pub digest_type: DigestType,
    pub content: String,
    pub period_start: String,
    pub period_end: String,
    pub entry_count: Option<i64>,
    pub org: Option<String>,
    pub file_path: String,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConversation {
    pub id: String,
    pub date: String,
    pub query: String,
    pub org: Option<String>,
    pub content: String,
    pub file_path: String,
}
