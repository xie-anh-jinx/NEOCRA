use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct DomainEvent {
    pub id: Uuid,
    pub event_type: String,
    pub aggregate: String,
    pub aggregate_id: String,
    pub payload: serde_json::Value,
}

impl DomainEvent {
    pub fn new(
        event_type: impl Into<String>,
        aggregate: impl Into<String>,
        aggregate_id: impl Into<String>,
        payload: serde_json::Value,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            event_type: event_type.into(),
            aggregate: aggregate.into(),
            aggregate_id: aggregate_id.into(),
            payload,
        }
    }
}
