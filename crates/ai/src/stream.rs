use crate::AiError;
use nichinichi_types::{AiConfig, ChatMessage, ParsedEntry};
use futures::StreamExt;
use reqwest::Client;
use serde_json::{json, Value};
use std::time::Duration;

pub struct AiClient {
    config: AiConfig,
    client: Client,
}

impl AiClient {
    pub fn new(config: AiConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }

    /// Fetch available model IDs from the Open WebUI `/api/models` endpoint.
    pub async fn list_models(&self) -> Result<Vec<String>, AiError> {
        let url = format!(
            "{}/api/models",
            self.config.base_url.trim_end_matches('/')
        );
        let resp = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(AiError::Api { status, body });
        }

        let json: serde_json::Value = resp.json().await?;
        let ids = json["data"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|m| m["id"].as_str().map(String::from))
            .collect();

        Ok(ids)
    }

    /// Ask the AI a question, streaming the response.
    ///
    /// `context_entries` are FTS5 results used to build the system prompt.
    /// `history` is the prior conversation turns (user + assistant messages).
    /// `on_chunk` is called for each text delta as it arrives.
    /// Returns the full concatenated response text when done.
    /// Times out after 120 seconds and returns `AiError::Timeout`.
    pub async fn ask(
        &self,
        user_query: &str,
        context_entries: &[ParsedEntry],
        history: &[ChatMessage],
        on_chunk: impl Fn(String),
    ) -> Result<String, AiError> {
        const TIMEOUT_SECS: u64 = 120;
        tokio::time::timeout(
            Duration::from_secs(TIMEOUT_SECS),
            self.ask_inner(user_query, context_entries, history, on_chunk),
        )
        .await
        .map_err(|_| AiError::Timeout(TIMEOUT_SECS))?
    }

    async fn ask_inner(
        &self,
        user_query: &str,
        context_entries: &[ParsedEntry],
        history: &[ChatMessage],
        on_chunk: impl Fn(String),
    ) -> Result<String, AiError> {
        let system_prompt = build_system_prompt(context_entries);

        // Build messages: system prompt → conversation history → current user query
        let mut messages: Vec<Value> = Vec::new();
        messages.push(json!({"role": "system", "content": system_prompt}));
        for msg in history {
            messages.push(json!({"role": msg.role, "content": msg.content}));
        }
        messages.push(json!({"role": "user", "content": user_query}));

        let url = format!(
            "{}/api/chat/completions",
            self.config.base_url.trim_end_matches('/')
        );

        let body = json!({
            "model": self.config.model,
            "stream": true,
            "messages": messages,
        });

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status().as_u16();
            let body = response.text().await.unwrap_or_default();
            return Err(AiError::Api { status, body });
        }

        let mut stream = response.bytes_stream();
        let mut full_response = String::new();
        let mut buffer = String::new();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            // Process complete SSE lines
            while let Some(newline_pos) = buffer.find('\n') {
                let line = buffer[..newline_pos].trim().to_string();
                buffer = buffer[newline_pos + 1..].to_string();

                if let Some(data) = line.strip_prefix("data: ") {
                    if data == "[DONE]" {
                        break;
                    }
                    if let Ok(parsed) = serde_json::from_str::<Value>(data) {
                        if let Some(text) = extract_delta_text(&parsed) {
                            on_chunk(text.clone());
                            full_response.push_str(&text);
                        }
                    }
                }
            }
        }

        Ok(full_response)
    }
}

fn build_system_prompt(entries: &[ParsedEntry]) -> String {
    let mut prompt = String::from(
        "You are Nichinichi, an AI assistant embedded in a developer's personal knowledge base.\n\
         You have access to the developer's journal entries below. Answer questions about their \
         work history, decisions, and patterns based solely on this context.\n\n\
         If you cannot find relevant information in the entries, say so clearly.\n\n\
         Always format your responses using Markdown. Use headers, bullet points, bold, \
         code blocks, and tables where appropriate to make the response easy to scan.\n\n\
         When the user asks you to create, log, or add a journal entry, include a fenced \
         code block with the language tag `nichinichi-entry` containing ONLY the entry body \
         text in the format: `body text @org #type` (no timestamp — it is added automatically). \
         Example:\n\
         ```nichinichi-entry\n\
         fixed JWT refresh bug, moved expiry check before decode @acme #solution\n\
         ```\n\
         You may suggest multiple entries as separate blocks. Do not invent org or type tags \
         unless the user specified them.\n\n\
         When the user asks you to create a goal, include a fenced code block with the language \
         tag `nichinichi-goal`. Fields on separate lines before a blank line: type (career|learning), \
         org, horizon, why, title (required). Then a blank line, then `steps:` followed by \
         `- step text` lines. Do not invent fields the user did not mention. Example:\n\
         ```nichinichi-goal\n\
         type: career\n\
         org: acme\n\
         title: become a staff engineer\n\
         \n\
         steps:\n\
         - mentor a junior through a full feature\n\
         - lead a cross-team technical initiative\n\
         ```\n\n\
         When the user asks you to create a playbook or runbook, include a fenced code block \
         with the language tag `nichinichi-playbook`. Fields before a blank line: title (required), \
         tags (comma-separated), org. Then a blank line, then the numbered steps body. Example:\n\
         ```nichinichi-playbook\n\
         title: debugging node.js memory leaks\n\
         tags: node, memory\n\
         org: null\n\
         \n\
         1. Run `node --inspect` and open Chrome DevTools Memory tab\n\
         2. Take heap snapshot before and after suspected leak\n\
         ```\n\n\
         When the user asks you to generate a weekly, monthly, or review report or digest, \
         include a fenced code block with the language tag `nichinichi-digest`. Fields before \
         a blank line: type (weekly|monthly|review), period_start (YYYY-MM-DD), \
         period_end (YYYY-MM-DD), org. Then a blank line, then the report body. Example:\n\
         ```nichinichi-digest\n\
         type: weekly\n\
         period_start: 2026-03-16\n\
         period_end: 2026-03-22\n\
         org: acme\n\
         \n\
         3 score entries this week — solid delivery.\n\
         ```\n\n\
         ## Journal Entries\n\n",
    );

    for e in entries {
        prompt.push_str(&format!(
            "**{}** {}{} | {}\n",
            e.date,
            e.time,
            if e.approximate { " (approx)" } else { "" },
            e.body
        ));
        if let Some(detail) = &e.detail {
            prompt.push_str(&format!("{}\n", detail));
        }
        prompt.push('\n');
    }

    prompt
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn extract_delta_text_valid() {
        let event = json!({
            "choices": [{"delta": {"content": "hello world"}, "finish_reason": null}]
        });
        assert_eq!(
            extract_delta_text(&event),
            Some("hello world".to_string())
        );
    }

    #[test]
    fn extract_delta_text_missing_content_field() {
        let event = json!({"choices": [{"delta": {}}]});
        assert_eq!(extract_delta_text(&event), None);
    }

    #[test]
    fn extract_delta_text_empty_content() {
        let event = json!({
            "choices": [{"delta": {"content": ""}}]
        });
        assert_eq!(extract_delta_text(&event), None, "empty string yields None");
    }
}

fn extract_delta_text(event: &Value) -> Option<String> {
    // OpenAI-compatible SSE format:
    // {"choices":[{"delta":{"content":"..."},"finish_reason":null}]}
    let content = event
        .get("choices")?
        .get(0)?
        .get("delta")?
        .get("content")?
        .as_str()?;
    if content.is_empty() {
        return None;
    }
    Some(content.to_string())
}
