use chrono::{DateTime, Duration, Utc};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone)]
pub struct SessionToken {
    pub token: String,
    pub caller_pid: i32,
    pub caller_uid: u32,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Default, Clone)]
pub struct TokenStore {
    tokens: Arc<Mutex<HashMap<String, SessionToken>>>,
}

impl TokenStore {
    pub fn new() -> Self {
        Self {
            tokens: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Issue a new IMDSv2-style session token bound to the caller's kernel PID and UID.
    pub fn issue_token(&self, pid: i32, uid: u32, ttl_seconds: i64) -> Result<String, String> {
        let ttl = ttl_seconds.clamp(5, 300); // Between 5 seconds and 5 minutes
        let token = format!("tb_tok_{:032x}", rand::random::<u128>());
        let expires_at = Utc::now() + Duration::seconds(ttl);

        let session = SessionToken {
            token: token.clone(),
            caller_pid: pid,
            caller_uid: uid,
            expires_at,
        };

        let mut lock = self.tokens.lock().unwrap();
        // Prune expired tokens periodically
        lock.retain(|_, v| v.expires_at > Utc::now());
        lock.insert(token.clone(), session);

        Ok(token)
    }

    /// Verify a token against the caller PID and UID.
    pub fn verify_token(&self, token_str: &str, current_pid: i32, current_uid: u32) -> Result<(), String> {
        let mut lock = self.tokens.lock().unwrap();

        if let Some(session) = lock.get(token_str) {
            if session.expires_at < Utc::now() {
                lock.remove(token_str);
                return Err("IMDSv2 token has expired".to_string());
            }

            // Ensure the process using the token matches the process that minted it
            if session.caller_pid != current_pid || session.caller_uid != current_uid {
                return Err(format!(
                    "IMDSv2 token hijacking detected! Token minted for PID: {}, but used by PID: {}",
                    session.caller_pid,
                    current_pid
                ));
            }

            Ok(())
        } else {
            Err("Invalid or unknown IMDSv2 token".to_string())
        }
    }
}
