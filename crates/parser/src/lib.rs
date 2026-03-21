pub mod config;
pub mod digest;
pub mod entry;
pub mod goal;
pub mod playbook;
pub mod router;

pub use config::load_config;
pub use router::{parse_file, ParsedFile};

use thiserror::Error;

#[derive(Debug, Error)]
pub enum ParseError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("YAML parse error: {0}")]
    Yaml(#[from] serde_yaml::Error),
    #[error("invalid file format: {0}")]
    Format(String),
    #[error("missing field: {0}")]
    MissingField(String),
}
