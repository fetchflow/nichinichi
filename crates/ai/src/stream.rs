use crate::AiError;
use devlog_types::{AiConfig, ParsedEntry};
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
    /// `on_chunk` is called for each text delta as it arrives.
    /// Returns the full concatenated response text when done.
    pub async fn ask(
        &self,
        user_query: &str,
        context_entries: &[ParsedEntry],
        on_chunk: impl Fn(String),
    ) -> Result<String, AiError> {
        let system_prompt = build_system_prompt(context_entries);

        let url = format!("{}/v1/messages", self.config.base_url.trim_end_matches('/'));

        let body = json!({
            "model": self.config.model,
            "max_tokens": 1024,
            "stream": true,
            "system": system_prompt,
            "messages": [
                {"role": "user", "content": user_query}
            ]
        });

        let response = self
            .client
            .post(&url)
            .header("x-api-key", &self.config.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
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
                        if let Some(delta_text) = extract_delta_text(&parsed) {
                            on_chunk(delta_text.clone());
                            full_response.push_str(&delta_text);
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
        "You are DevLog, an AI assistant embedded in a developer's personal knowledge base.\n\
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
    // Anthropic SSE format:
    // {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "..."}}
    if event.get("type")?.as_str()? == "content_block_delta" {
        let delta = event.get("delta")?;
        if delta.get("type")?.as_str()? == "text_delta" {
            return delta.get("text")?.as_str().map(String::from);
        }
    }
    None
}
