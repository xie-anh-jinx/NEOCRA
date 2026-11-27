use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiStatus {
    pub enabled: bool,
    pub provider: String,
    pub supported_providers: Vec<&'static str>,
}

pub fn get_ai_status(enabled: bool, provider: &str) -> AiStatus {
    AiStatus {
        enabled,
        provider: provider.to_string(),
        supported_providers: vec!["ollama", "openai", "deepseek", "claude", "mcp"],
    }
}
