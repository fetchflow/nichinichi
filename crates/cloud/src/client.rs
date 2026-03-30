use reqwest::{Client, StatusCode};
use serde::de::DeserializeOwned;
use serde::Serialize;

use nichinichi_types::{AiConversation, Config, Digest, Goal, ParsedEntry, Playbook};

use crate::error::CloudError;
use crate::manifest::{ManifestQuery, SyncManifest};

/// HTTP client for the nichinichi-cloud sync API.
///
/// All methods are async and require a bearer token in `CloudConfig.token`.
/// The base URL comes from `CloudConfig.base_url` (e.g. `https://sync.nichinichi.app`).
pub struct CloudClient {
    http: Client,
    base_url: String,
    token: String,
}

impl CloudClient {
    /// Build a client from the user's config.
    /// Returns `CloudError::NotConfigured` if cloud sync is not set up.
    pub fn from_config(config: &Config) -> Result<Self, CloudError> {
        let cloud = config.cloud.as_ref().ok_or(CloudError::NotConfigured)?;
        if cloud.token.is_empty() {
            return Err(CloudError::Unauthenticated);
        }
        Ok(Self {
            http: Client::new(),
            base_url: cloud.base_url.trim_end_matches('/').to_string(),
            token: cloud.token.clone(),
        })
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, CloudError> {
        let resp = self
            .http
            .get(self.url(path))
            .bearer_auth(&self.token)
            .send()
            .await?;
        self.parse(resp).await
    }

    async fn get_with_query<T: DeserializeOwned, Q: Serialize + ?Sized>(
        &self,
        path: &str,
        query: &Q,
    ) -> Result<T, CloudError> {
        let resp = self
            .http
            .get(self.url(path))
            .bearer_auth(&self.token)
            .query(query)
            .send()
            .await?;
        self.parse(resp).await
    }

    async fn post<B: Serialize + ?Sized, T: DeserializeOwned>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T, CloudError> {
        let resp = self
            .http
            .post(self.url(path))
            .bearer_auth(&self.token)
            .json(body)
            .send()
            .await?;
        self.parse(resp).await
    }

    async fn put<B: Serialize, T: DeserializeOwned>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T, CloudError> {
        let resp = self
            .http
            .put(self.url(path))
            .bearer_auth(&self.token)
            .json(body)
            .send()
            .await?;
        self.parse(resp).await
    }

    async fn delete_req(&self, path: &str) -> Result<(), CloudError> {
        let resp = self
            .http
            .delete(self.url(path))
            .bearer_auth(&self.token)
            .send()
            .await?;
        if resp.status().is_success() {
            return Ok(());
        }
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        Err(CloudError::Api { status, body })
    }

    async fn parse<T: DeserializeOwned>(&self, resp: reqwest::Response) -> Result<T, CloudError> {
        let status = resp.status();
        if status == StatusCode::UNAUTHORIZED || status == StatusCode::FORBIDDEN {
            return Err(CloudError::Unauthenticated);
        }
        if !status.is_success() {
            let code = status.as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(CloudError::Api { status: code, body });
        }
        let val = resp.json::<T>().await?;
        Ok(val)
    }

    // -------------------------------------------------------------------------
    // Manifest
    // -------------------------------------------------------------------------

    /// Fetch the sync manifest from the server.
    /// Pass `query.since` to get only items changed after a prior sync.
    pub async fn get_manifest(&self, query: &ManifestQuery) -> Result<SyncManifest, CloudError> {
        self.get_with_query("/sync/manifest", query).await
    }

    // -------------------------------------------------------------------------
    // Entries
    // -------------------------------------------------------------------------

    /// Fetch a single entry by ID.
    pub async fn get_entry(&self, id: &str) -> Result<ParsedEntry, CloudError> {
        self.get(&format!("/sync/entries/{id}")).await
    }

    /// Fetch multiple entries by ID in a single batched request.
    pub async fn get_entries(&self, ids: &[String]) -> Result<Vec<ParsedEntry>, CloudError> {
        #[derive(Serialize)]
        struct BatchRequest<'a> {
            ids: &'a [String],
        }
        self.post("/sync/entries/batch", &BatchRequest { ids }).await
    }

    /// Push (upsert) a single entry.
    pub async fn push_entry(&self, entry: &ParsedEntry) -> Result<ParsedEntry, CloudError> {
        self.put(&format!("/sync/entries/{}", entry.id), entry)
            .await
    }

    /// Push a batch of entries.
    pub async fn push_entries(&self, entries: &[ParsedEntry]) -> Result<Vec<ParsedEntry>, CloudError> {
        self.post("/sync/entries", entries).await
    }

    /// Delete an entry by ID.
    pub async fn delete_entry(&self, id: &str) -> Result<(), CloudError> {
        self.delete_req(&format!("/sync/entries/{id}")).await
    }

    // -------------------------------------------------------------------------
    // Goals
    // -------------------------------------------------------------------------

    /// Fetch all goals from the server.
    pub async fn get_goals(&self) -> Result<Vec<Goal>, CloudError> {
        self.get("/sync/goals").await
    }

    /// Fetch a single goal by ID (slug).
    pub async fn get_goal(&self, id: &str) -> Result<Goal, CloudError> {
        self.get(&format!("/sync/goals/{id}")).await
    }

    /// Push (upsert) a single goal.
    pub async fn push_goal(&self, goal: &Goal) -> Result<Goal, CloudError> {
        self.put(&format!("/sync/goals/{}", goal.id), goal).await
    }

    // -------------------------------------------------------------------------
    // Playbooks
    // -------------------------------------------------------------------------

    /// Fetch all playbooks from the server.
    pub async fn get_playbooks(&self) -> Result<Vec<Playbook>, CloudError> {
        self.get("/sync/playbooks").await
    }

    /// Fetch a single playbook by ID (slug).
    pub async fn get_playbook(&self, id: &str) -> Result<Playbook, CloudError> {
        self.get(&format!("/sync/playbooks/{id}")).await
    }

    /// Push (upsert) a single playbook.
    pub async fn push_playbook(&self, playbook: &Playbook) -> Result<Playbook, CloudError> {
        self.put(&format!("/sync/playbooks/{}", playbook.id), playbook)
            .await
    }

    // -------------------------------------------------------------------------
    // Digests
    // -------------------------------------------------------------------------

    /// Fetch all digests from the server.
    pub async fn get_digests(&self) -> Result<Vec<Digest>, CloudError> {
        self.get("/sync/digests").await
    }

    /// Fetch a single digest by ID.
    pub async fn get_digest(&self, id: &str) -> Result<Digest, CloudError> {
        self.get(&format!("/sync/digests/{id}")).await
    }

    /// Push (upsert) a single digest.
    pub async fn push_digest(&self, digest: &Digest) -> Result<Digest, CloudError> {
        self.put(&format!("/sync/digests/{}", digest.id), digest)
            .await
    }

    // -------------------------------------------------------------------------
    // AI Conversations
    // -------------------------------------------------------------------------

    /// Push a saved AI conversation.
    pub async fn push_ai_conversation(
        &self,
        convo: &AiConversation,
    ) -> Result<AiConversation, CloudError> {
        self.put(&format!("/sync/ai/{}", convo.id), convo).await
    }

    // -------------------------------------------------------------------------
    // Auth helpers
    // -------------------------------------------------------------------------

    /// Exchange a device token / API key for a session token.
    /// Returns the bearer token string to store in `CloudConfig.token`.
    pub async fn authenticate(&self, api_key: &str) -> Result<String, CloudError> {
        #[derive(Serialize)]
        struct AuthRequest<'a> {
            api_key: &'a str,
        }
        #[derive(serde::Deserialize)]
        struct AuthResponse {
            token: String,
        }
        let url = self.url("/auth/token");
        let resp = self
            .http
            .post(url)
            .json(&AuthRequest { api_key })
            .send()
            .await?;
        let auth: AuthResponse = self.parse(resp).await?;
        Ok(auth.token)
    }

    /// Verify the current token is still valid. Returns `Ok(())` on success.
    pub async fn verify_token(&self) -> Result<(), CloudError> {
        let _: serde_json::Value = self.get("/auth/verify").await?;
        Ok(())
    }
}
