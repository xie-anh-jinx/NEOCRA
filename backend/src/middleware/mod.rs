use crate::{auth::AuthUser, utils::AppResult};

pub fn check_permission(user: &AuthUser, required_role: &str) -> AppResult<()> {
    user.require_role(required_role)
}
