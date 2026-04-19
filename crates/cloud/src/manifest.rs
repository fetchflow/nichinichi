use std::collections::HashMap;
use std::path::Path;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest as _, Sha256};

use crate::client::FileRef;
use crate::error::CloudError;

const MANIFEST_FILE: &str = ".nichinichi-manifest.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub hash: String,
    pub modified_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FileManifest {
    /// rel_path → FileEntry
    pub files: HashMap<String, FileEntry>,
    pub last_sync_at: Option<DateTime<Utc>>,
}

impl FileManifest {
    pub fn load(repo: &Path) -> Self {
        let path = repo.join(MANIFEST_FILE);
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, repo: &Path) -> Result<(), CloudError> {
        let path = repo.join(MANIFEST_FILE);
        let json = serde_json::to_string_pretty(self)?;
        std::fs::write(&path, json).map_err(|e| CloudError::Io(e.to_string()))?;
        Ok(())
    }

    pub fn update(&mut self, rel_path: &str, bytes: &[u8]) {
        self.files.insert(
            rel_path.to_string(),
            FileEntry {
                hash: sha256_hex(bytes),
                modified_at: Utc::now(),
            },
        );
    }

    pub fn remove(&mut self, rel_path: &str) {
        self.files.remove(rel_path);
    }

    pub fn to_file_refs(&self) -> Vec<FileRef> {
        self.files
            .iter()
            .map(|(path, entry)| FileRef {
                path: path.clone(),
                hash: entry.hash.clone(),
                modified_at: entry.modified_at,
            })
            .collect()
    }
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}
