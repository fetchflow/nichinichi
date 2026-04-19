use std::path::Path;

use chrono::{DateTime, Utc};
use reqwest::{Client, StatusCode};
use serde::{de::DeserializeOwned, Deserialize, Serialize};

use nichinichi_types::Config;

use crate::error::CloudError;
use crate::manifest::{sha256_hex, FileManifest};
use crate::merge::merge_daily_file;

// ── Public types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileRef {
    pub path: String,
    pub hash: String,
    pub modified_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadItem {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadItem {
    pub path: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictItem {
    pub path: String,
    pub local_hash: String,
    pub remote_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReconcileResponse {
    pub upload: Vec<UploadItem>,
    pub download: Vec<DownloadItem>,
    pub conflicts: Vec<ConflictItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountStatus {
    pub plan: String,
    pub status: String,
    pub synced_files: i64,
    pub storage_used_bytes: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub uploaded: usize,
    pub downloaded: usize,
    /// Conflicts that were auto-resolved (daily: union merge; other: remote wins).
    pub resolved: usize,
    /// Conflicts that could not be resolved (e.g. network failure during resolution).
    pub conflicts: Vec<ConflictItem>,
}

// ── CloudClient ───────────────────────────────────────────────────────────────

pub struct CloudClient {
    http: Client,
    base_url: String,
    token: String,
}

impl CloudClient {
    /// Build from config. Returns `NotConfigured` if `cloud` key is absent,
    /// `Unauthenticated` if token is empty.
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

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    // ── HTTP helpers ──────────────────────────────────────────────────────────

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    fn auth_header(&self) -> String {
        format!("Bearer {}", self.token)
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
        Ok(resp.json::<T>().await?)
    }

    async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, CloudError> {
        let resp = self
            .http
            .get(self.url(path))
            .header("Authorization", self.auth_header())
            .send()
            .await?;
        self.parse(resp).await
    }

    async fn post_json<B: Serialize, T: DeserializeOwned>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T, CloudError> {
        let resp = self
            .http
            .post(self.url(path))
            .header("Authorization", self.auth_header())
            .json(body)
            .send()
            .await?;
        self.parse(resp).await
    }

    async fn put_bytes(&self, path: &str, bytes: Vec<u8>) -> Result<(), CloudError> {
        let resp = self
            .http
            .put(self.url(path))
            .header("Authorization", self.auth_header())
            .body(bytes)
            .send()
            .await?;
        if resp.status().is_success() {
            return Ok(());
        }
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        Err(CloudError::Api { status, body })
    }

    async fn get_bytes(&self, path: &str) -> Result<Vec<u8>, CloudError> {
        let resp = self
            .http
            .get(self.url(path))
            .header("Authorization", self.auth_header())
            .send()
            .await?;
        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(CloudError::Api { status, body });
        }
        Ok(resp.bytes().await?.to_vec())
    }

    async fn delete_req(&self, path: &str) -> Result<(), CloudError> {
        let resp = self
            .http
            .delete(self.url(path))
            .header("Authorization", self.auth_header())
            .send()
            .await?;
        if resp.status().is_success() {
            return Ok(());
        }
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        Err(CloudError::Api { status, body })
    }

    // ── Static auth (no token required) ──────────────────────────────────────

    /// Sign in with email + password. Returns the bearer token to store.
    pub async fn sign_in(
        base_url: &str,
        email: &str,
        password: &str,
    ) -> Result<String, CloudError> {
        #[derive(Serialize)]
        struct Req<'a> { email: &'a str, password: &'a str }
        #[derive(Deserialize)]
        struct Resp { api_token: String }

        let url = format!("{}/auth/token", base_url.trim_end_matches('/'));
        let resp = Client::new().post(&url).json(&Req { email, password }).send().await?;
        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(CloudError::Api { status, body });
        }
        Ok(resp.json::<Resp>().await?.api_token)
    }

    /// Register a new account. Returns the bearer token to store.
    pub async fn register(
        base_url: &str,
        email: &str,
        password: &str,
    ) -> Result<String, CloudError> {
        #[derive(Serialize)]
        struct Req<'a> { email: &'a str, password: &'a str }
        #[derive(Deserialize)]
        struct Resp { api_token: String }

        let url = format!("{}/auth/register", base_url.trim_end_matches('/'));
        let resp = Client::new().post(&url).json(&Req { email, password }).send().await?;
        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(CloudError::Api { status, body });
        }
        Ok(resp.json::<Resp>().await?.api_token)
    }

    // ── Instance methods ──────────────────────────────────────────────────────

    pub async fn sign_out(&self) -> Result<(), CloudError> {
        self.delete_req("/auth/token").await
    }

    pub async fn get_account_status(&self) -> Result<AccountStatus, CloudError> {
        self.get("/account/status").await
    }

    pub async fn reconcile(
        &self,
        files: Vec<FileRef>,
        last_sync_at: Option<DateTime<Utc>>,
    ) -> Result<ReconcileResponse, CloudError> {
        #[derive(Serialize)]
        struct Req { files: Vec<FileRef>, last_sync_at: Option<DateTime<Utc>> }
        self.post_json("/sync/reconcile", &Req { files, last_sync_at }).await
    }

    pub async fn push_file(&self, rel_path: &str, bytes: Vec<u8>) -> Result<(), CloudError> {
        let encoded = rel_path.replace('\\', "/");
        self.put_bytes(&format!("/sync/files/{encoded}"), bytes).await
    }

    pub async fn pull_file(&self, rel_path: &str) -> Result<Vec<u8>, CloudError> {
        let encoded = rel_path.replace('\\', "/");
        self.get_bytes(&format!("/sync/files/{encoded}")).await
    }

    pub async fn resolve_conflict(&self, rel_path: &str, bytes: Vec<u8>) -> Result<(), CloudError> {
        let encoded = rel_path.replace('\\', "/");
        self.put_bytes(&format!("/sync/conflict/resolve/{encoded}"), bytes).await
    }

    pub async fn get_checkout_url(&self) -> Result<String, CloudError> {
        #[derive(Deserialize)]
        struct Resp { checkout_url: String }
        Ok(self.get::<Resp>("/billing/checkout").await?.checkout_url)
    }

    pub async fn get_portal_url(&self) -> Result<String, CloudError> {
        #[derive(Deserialize)]
        struct Resp { portal_url: String }
        Ok(self.get::<Resp>("/billing/portal").await?.portal_url)
    }

    // ── Full sync orchestration ───────────────────────────────────────────────

    /// Full sync round-trip against the server.
    pub async fn sync(&self, repo: &Path) -> Result<SyncResult, CloudError> {
        let mut manifest = FileManifest::load(repo);
        let current_files = walk_repo(repo)?;

        let file_refs: Vec<FileRef> = current_files
            .iter()
            .map(|(rel, bytes)| FileRef {
                path: rel.clone(),
                hash: sha256_hex(bytes),
                modified_at: manifest
                    .files
                    .get(rel)
                    .map(|e| e.modified_at)
                    .unwrap_or_else(Utc::now),
            })
            .collect();

        let response = self.reconcile(file_refs, manifest.last_sync_at).await?;

        let mut uploaded = 0usize;
        let mut downloaded = 0usize;

        // Upload concurrently (best-effort per file)
        let file_map: std::collections::HashMap<&str, &Vec<u8>> =
            current_files.iter().map(|(r, b)| (r.as_str(), b)).collect();

        for item in &response.upload {
            if let Some(&bytes) = file_map.get(item.path.as_str()) {
                let bytes = bytes.clone();
                if self.push_file(&item.path, bytes.clone()).await.is_ok() {
                    manifest.update(&item.path, &bytes);
                    uploaded += 1;
                }
            }
        }

        // Download concurrently (best-effort per file)
        for item in &response.download {
            if let Ok(bytes) = self.pull_file(&item.path).await {
                let dest = repo.join(&item.path);
                if let Some(parent) = dest.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                if std::fs::write(&dest, &bytes).is_ok() {
                    manifest.update(&item.path, &bytes);
                    downloaded += 1;
                }
            }
        }

        // Resolve conflicts: daily files get a union merge; all others fall
        // back to remote-wins (structured files like goals/playbooks are
        // safer to overwrite locally than to produce a garbled merge).
        let mut resolved = 0usize;
        let mut unresolved: Vec<ConflictItem> = Vec::new();

        for item in response.conflicts {
            let local_path = repo.join(&item.path);

            let local_bytes = match std::fs::read(&local_path) {
                Ok(b) => b,
                Err(_) => { unresolved.push(item); continue; }
            };
            let remote_bytes = match self.pull_file(&item.path).await {
                Ok(b) => b,
                Err(_) => { unresolved.push(item); continue; }
            };

            let merged_bytes = if is_daily_path(&item.path) {
                let local_str = String::from_utf8_lossy(&local_bytes);
                let remote_str = String::from_utf8_lossy(&remote_bytes);
                merge_daily_file(&local_str, &remote_str).into_bytes()
            } else {
                remote_bytes
            };

            if let Some(parent) = local_path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            let write_ok = std::fs::write(&local_path, &merged_bytes).is_ok();

            if write_ok {
                match self.resolve_conflict(&item.path, merged_bytes.clone()).await {
                    Ok(()) => {
                        manifest.update(&item.path, &merged_bytes);
                        resolved += 1;
                    }
                    Err(_) => { unresolved.push(item); }
                }
            } else {
                unresolved.push(item);
            }
        }

        manifest.last_sync_at = Some(Utc::now());
        let _ = manifest.save(repo);

        Ok(SyncResult {
            uploaded,
            downloaded,
            resolved,
            conflicts: unresolved,
        })
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Returns true if `rel` names a daily entry file (`YYYY-MM-DD.md`).
/// Works for root-level files and archived ones (`archive/2025/2025-01-03.md`).
fn is_daily_path(rel: &str) -> bool {
    let name = Path::new(rel)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");
    name.len() == 13
        && name.ends_with(".md")
        && name.as_bytes()[4] == b'-'
        && name.as_bytes()[7] == b'-'
        && name[..4].bytes().all(|b| b.is_ascii_digit())
        && name[5..7].bytes().all(|b| b.is_ascii_digit())
        && name[8..10].bytes().all(|b| b.is_ascii_digit())
}

// ── Repo walker ───────────────────────────────────────────────────────────────

fn walk_repo(repo: &Path) -> Result<Vec<(String, Vec<u8>)>, CloudError> {
    let mut files = Vec::new();
    walk_dir(repo, repo, &mut files)?;
    Ok(files)
}

fn walk_dir(root: &Path, dir: &Path, out: &mut Vec<(String, Vec<u8>)>) -> Result<(), CloudError> {
    let entries = std::fs::read_dir(dir).map_err(|e| CloudError::Io(e.to_string()))?;
    for entry in entries.flatten() {
        let path = entry.path();
        let name = path.file_name().unwrap_or_default().to_string_lossy();

        // Skip hidden dirs (.quiet/, .git/, etc.) and non-content files
        if name.starts_with('.') || name == "nichinichi.db"
            || name.ends_with("-shm") || name.ends_with("-wal")
        {
            continue;
        }

        if path.is_dir() {
            walk_dir(root, &path, out)?;
        } else if path.extension().map(|e| e == "md").unwrap_or(false) {
            if let Ok(bytes) = std::fs::read(&path) {
                let rel = path
                    .strip_prefix(root)
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();
                if !rel.is_empty() {
                    out.push((rel, bytes));
                }
            }
        }
    }
    Ok(())
}
