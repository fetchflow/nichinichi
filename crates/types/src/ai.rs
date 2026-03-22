use serde::{Deserialize, Serialize};

/// A single message in an AI conversation (OpenAI-compatible role/content format).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,    // "user" | "assistant" | "system"
    pub content: String,
}
