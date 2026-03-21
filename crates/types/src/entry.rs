use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EntryType {
    Log,
    Solution,
    Decision,
    Reflection,
    Score,
    Ai,
}

impl EntryType {
    pub fn as_str(&self) -> &'static str {
        match self {
            EntryType::Log => "log",
            EntryType::Solution => "solution",
            EntryType::Decision => "decision",
            EntryType::Reflection => "reflection",
            EntryType::Score => "score",
            EntryType::Ai => "ai",
        }
    }
}

impl std::fmt::Display for EntryType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

impl std::str::FromStr for EntryType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "log" => Ok(EntryType::Log),
            "solution" => Ok(EntryType::Solution),
            "decision" => Ok(EntryType::Decision),
            "reflection" => Ok(EntryType::Reflection),
            "score" => Ok(EntryType::Score),
            "ai" => Ok(EntryType::Ai),
            other => Err(format!("unknown entry type: {other}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedEntry {
    /// sha256 of (date || time || body)
    pub id: String,
    pub date: String,
    pub time: String,
    pub body: String,
    pub detail: Option<String>,
    pub entry_type: EntryType,
    pub tags: Vec<String>,
    pub project: Option<String>,
    pub org: Option<String>,
    pub approximate: bool,
    pub raw_line: String,
}

/// Active org filter applied to queries and UI display.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", content = "value", rename_all = "snake_case")]
pub enum OrgScope {
    All,
    Personal,
    Org(String),
}
