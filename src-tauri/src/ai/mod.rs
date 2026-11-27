use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiStatus {
    pub enabled: bool,
    pub provider: String,
    pub supported_providers: Vec<String>,
}

pub fn get_ai_status(enabled: bool, provider: &str) -> AiStatus {
    AiStatus {
        enabled,
        provider: provider.to_string(),
        supported_providers: vec![
            "ollama".to_string(),
            "openai".to_string(),
            "deepseek".to_string(),
            "claude".to_string(),
            "mcp".to_string(),
        ],
    }
}
