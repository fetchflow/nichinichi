use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GoalType {
    Career,
    Learning,
}

impl std::fmt::Display for GoalType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GoalType::Career => f.write_str("career"),
            GoalType::Learning => f.write_str("learning"),
        }
    }
}

impl std::str::FromStr for GoalType {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "career" => Ok(GoalType::Career),
            "learning" => Ok(GoalType::Learning),
            other => Err(format!("unknown goal type: {other}")),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GoalStatus {
    Active,
    Paused,
    Done,
    Abandoned,
}

impl std::fmt::Display for GoalStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GoalStatus::Active => f.write_str("active"),
            GoalStatus::Paused => f.write_str("paused"),
            GoalStatus::Done => f.write_str("done"),
            GoalStatus::Abandoned => f.write_str("abandoned"),
        }
    }
}

impl std::str::FromStr for GoalStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "active" => Ok(GoalStatus::Active),
            "paused" => Ok(GoalStatus::Paused),
            "done" => Ok(GoalStatus::Done),
            "abandoned" => Ok(GoalStatus::Abandoned),
            other => Err(format!("unknown goal status: {other}")),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GoalStepStatus {
    NotStarted,
    InProgress,
    Done,
}

impl std::fmt::Display for GoalStepStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GoalStepStatus::NotStarted => f.write_str("not_started"),
            GoalStepStatus::InProgress => f.write_str("in_progress"),
            GoalStepStatus::Done => f.write_str("done"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProgressSignal {
    Breakthrough,
    Strong,
    Steady,
    Moderate,
    Struggling,
    Quiet,
}

impl std::fmt::Display for ProgressSignal {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProgressSignal::Breakthrough => f.write_str("breakthrough"),
            ProgressSignal::Strong => f.write_str("strong"),
            ProgressSignal::Steady => f.write_str("steady"),
            ProgressSignal::Moderate => f.write_str("moderate"),
            ProgressSignal::Struggling => f.write_str("struggling"),
            ProgressSignal::Quiet => f.write_str("quiet"),
        }
    }
}

impl std::str::FromStr for ProgressSignal {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "breakthrough" => Ok(ProgressSignal::Breakthrough),
            "strong" => Ok(ProgressSignal::Strong),
            "steady" => Ok(ProgressSignal::Steady),
            "moderate" => Ok(ProgressSignal::Moderate),
            "struggling" => Ok(ProgressSignal::Struggling),
            "quiet" => Ok(ProgressSignal::Quiet),
            other => Err(format!("unknown progress signal: {other}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoalStep {
    /// sha256 of (goal_id || title)
    pub id: String,
    pub goal_id: String,
    pub title: String,
    pub status: GoalStepStatus,
    pub notes: Option<String>,
    pub due_date: Option<String>,
    pub position: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoalProgress {
    pub id: String,
    pub goal_id: String,
    pub period_start: String,
    pub period_end: String,
    pub signal: ProgressSignal,
    pub note: Option<String>,
    pub created_at: Option<String>,
    /// Log-entry refs in "YYYY-MM-DD HH:MM" format
    #[serde(default)]
    pub refs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Goal {
    /// slug from filename
    pub id: String,
    pub title: String,
    pub goal_type: Option<GoalType>,
    pub horizon: Option<String>,
    pub status: GoalStatus,
    pub why: Option<String>,
    pub org: Option<String>,
    pub file_path: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub completion_date: Option<String>,
    pub steps: Vec<GoalStep>,
    pub progress: Vec<GoalProgress>,
}
