use crate::error::CloudError;
use nichinichi_types::ParsedEntry;

/// Strategy for resolving conflicts between a local record and a remote record
/// when both have been modified since the last sync.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ConflictStrategy {
    /// The remote (server) copy wins. Local changes are overwritten.
    #[default]
    RemoteWins,
    /// The local copy wins. Remote changes are overwritten on the next push.
    LocalWins,
    /// Return a `CloudError::MergeConflict` so the caller can decide.
    Error,
}

/// Outcome of merging a single entry.
#[derive(Debug, Clone)]
pub enum MergeOutcome {
    /// Keep the entry as-is (already up to date).
    NoOp,
    /// Use the provided entry (remote won or local won unanimously).
    Use(ParsedEntry),
    /// The entry must be pushed to the server (local is newer).
    PushLocal(ParsedEntry),
}

/// Merge a local entry with the version fetched from the server.
///
/// `local_updated_at` and `remote_updated_at` are ISO-8601 strings.
/// When both sides have the same `updated_at` the entry is already in sync.
pub fn merge_entry(
    local: &ParsedEntry,
    remote: &ParsedEntry,
    local_updated_at: &str,
    remote_updated_at: &str,
    strategy: ConflictStrategy,
) -> Result<MergeOutcome, CloudError> {
    if local_updated_at == remote_updated_at {
        return Ok(MergeOutcome::NoOp);
    }

    // Compare timestamps lexicographically — ISO-8601 strings sort correctly.
    let local_is_newer = local_updated_at > remote_updated_at;

    if local_is_newer {
        match strategy {
            ConflictStrategy::RemoteWins => Ok(MergeOutcome::Use(remote.clone())),
            ConflictStrategy::LocalWins => Ok(MergeOutcome::PushLocal(local.clone())),
            ConflictStrategy::Error => Err(CloudError::MergeConflict {
                id: local.id.clone(),
                local_updated_at: local_updated_at.to_string(),
                remote_updated_at: remote_updated_at.to_string(),
            }),
        }
    } else {
        // Remote is newer — always pull the remote regardless of strategy
        // (there is no local change to protect).
        Ok(MergeOutcome::Use(remote.clone()))
    }
}

/// Diff two manifest ID sets and return:
/// - `to_pull`: IDs present on remote but absent locally, or newer on remote.
/// - `to_push`: IDs present locally but absent on remote.
pub fn diff_manifests(
    local_ids: &std::collections::HashMap<String, String>,
    remote_manifest: &[crate::manifest::ManifestEntry],
) -> (Vec<String>, Vec<String>) {
    let mut to_pull: Vec<String> = Vec::new();
    let mut remote_id_set: std::collections::HashSet<String> =
        std::collections::HashSet::new();

    for remote in remote_manifest {
        remote_id_set.insert(remote.id.clone());
        match local_ids.get(&remote.id) {
            None => to_pull.push(remote.id.clone()),
            Some(local_ts) if local_ts.as_str() < remote.updated_at.as_str() => {
                to_pull.push(remote.id.clone());
            }
            _ => {}
        }
    }

    let to_push: Vec<String> = local_ids
        .keys()
        .filter(|id| !remote_id_set.contains(*id))
        .cloned()
        .collect();

    (to_pull, to_push)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn dummy_entry(id: &str) -> ParsedEntry {
        ParsedEntry {
            id: id.to_string(),
            date: "2026-03-17".to_string(),
            time: "09:05".to_string(),
            body: "test entry".to_string(),
            detail: None,
            entry_type: nichinichi_types::EntryType::Log,
            tags: vec![],
            project: None,
            org: None,
            approximate: false,
            raw_line: String::new(),
        }
    }

    #[test]
    fn test_merge_no_op_when_timestamps_equal() {
        let e = dummy_entry("abc");
        let result = merge_entry(
            &e,
            &e,
            "2026-03-17T09:00:00",
            "2026-03-17T09:00:00",
            ConflictStrategy::RemoteWins,
        )
        .unwrap();
        assert!(matches!(result, MergeOutcome::NoOp));
    }

    #[test]
    fn test_merge_remote_wins_when_local_newer() {
        let local = dummy_entry("abc");
        let remote = dummy_entry("abc");
        let result = merge_entry(
            &local,
            &remote,
            "2026-03-17T10:00:00",
            "2026-03-17T09:00:00",
            ConflictStrategy::RemoteWins,
        )
        .unwrap();
        assert!(matches!(result, MergeOutcome::Use(_)));
    }

    #[test]
    fn test_merge_local_wins_push() {
        let local = dummy_entry("abc");
        let remote = dummy_entry("abc");
        let result = merge_entry(
            &local,
            &remote,
            "2026-03-17T10:00:00",
            "2026-03-17T09:00:00",
            ConflictStrategy::LocalWins,
        )
        .unwrap();
        assert!(matches!(result, MergeOutcome::PushLocal(_)));
    }

    #[test]
    fn test_merge_error_on_conflict() {
        let local = dummy_entry("abc");
        let remote = dummy_entry("abc");
        let result = merge_entry(
            &local,
            &remote,
            "2026-03-17T10:00:00",
            "2026-03-17T09:00:00",
            ConflictStrategy::Error,
        );
        assert!(matches!(result, Err(CloudError::MergeConflict { .. })));
    }

    #[test]
    fn test_diff_manifests() {
        use crate::manifest::{ManifestEntry, ManifestKind};

        let mut local: HashMap<String, String> = HashMap::new();
        local.insert("id-local-only".to_string(), "2026-01-01T00:00:00".to_string());
        local.insert("id-both".to_string(), "2026-01-01T00:00:00".to_string());

        let remote = vec![
            ManifestEntry {
                id: "id-both".to_string(),
                updated_at: "2026-01-02T00:00:00".to_string(),
                kind: ManifestKind::Entry,
            },
            ManifestEntry {
                id: "id-remote-only".to_string(),
                updated_at: "2026-01-01T00:00:00".to_string(),
                kind: ManifestKind::Entry,
            },
        ];

        let (to_pull, to_push) = diff_manifests(&local, &remote);

        assert!(to_pull.contains(&"id-both".to_string()));
        assert!(to_pull.contains(&"id-remote-only".to_string()));
        assert_eq!(to_push, vec!["id-local-only".to_string()]);
    }
}
