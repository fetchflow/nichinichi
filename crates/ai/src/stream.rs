use crate::AiError;
use nichinichi_types::{AiConfig, ChatMessage, ParsedEntry};
use futures::StreamExt;
use reqwest::Client;
use serde_json::{json, Value};

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

    /// Ask the AI a question, streaming the response.
    ///
    /// `context_entries` are FTS5 results used to build the system prompt.
    /// `history` is the prior conversation turns (user + assistant messages).
    /// `on_chunk` is called for each text delta as it arrives.
    /// Returns the full concatenated response text when done.
    pub async fn ask(
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
