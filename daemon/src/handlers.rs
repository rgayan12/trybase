use crate::auth::TokenStore;
use crate::peer::PeerIdentity;
use crate::secrets::SecretStore;
use http_body_util::Full;
use hyper::body::Bytes;
use hyper::{Method, Request, Response, StatusCode};
use serde_json::json;
use tracing::{info, warn};

pub async fn handle_request(
    req: Request<hyper::body::Incoming>,
    peer: PeerIdentity,
    tokens: TokenStore,
    secrets: SecretStore,
) -> Result<Response<Full<Bytes>>, hyper::Error> {
    let method = req.method().clone();
    let path = req.uri().path().to_string();

    // 1. Defend against SSRF / HTTP proxy injections:
    // Reject any request containing X-Forwarded-For or X-Forwarded-Host
    if req.headers().contains_key("x-forwarded-for")
        || req.headers().contains_key("x-forwarded-host")
        || req.headers().contains_key("x-forwarded-proto")
    {
        warn!(
            "SECURITY ALERT: Rejected SSRF proxy attempt with X-Forwarded headers from PID: {}",
            peer.pid
        );
        return Ok(Response::builder()
            .status(StatusCode::BAD_REQUEST)
            .header("Content-Type", "application/json")
            .body(Full::new(Bytes::from(
                json!({ "error": "SSRF violation: X-Forwarded-* headers are strictly forbidden" }).to_string(),
            )))
            .unwrap());
    }

    // Route: Health check (no token required)
    if method == Method::GET && path == "/healthz" {
        return Ok(Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", "application/json")
            .body(Full::new(Bytes::from(
                json!({ "status": "ok", "service": "trybase-daemon" }).to_string(),
            )))
            .unwrap());
    }

    // Route: IMDSv2 Token Minting
    // PUT /latest/api/token
    if method == Method::PUT && path == "/latest/api/token" {
        let ttl_seconds = req
            .headers()
            .get("x-trybase-token-ttl-seconds")
            .and_then(|h| h.to_str().ok())
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(60);

        match tokens.issue_token(peer.pid, peer.uid, ttl_seconds) {
            Ok(token) => {
                info!(
                    "Issued IMDSv2 session token to PID {} (UID: {}) valid for {}s",
                    peer.pid, peer.uid, ttl_seconds
                );
                return Ok(Response::builder()
                    .status(StatusCode::OK)
                    .header("Content-Type", "text/plain")
                    .header("X-TryBase-Token-TTL-Seconds", ttl_seconds.to_string())
                    .body(Full::new(Bytes::from(token)))
                    .unwrap());
            }
            Err(e) => {
                return Ok(Response::builder()
                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                    .header("Content-Type", "application/json")
                    .body(Full::new(Bytes::from(json!({ "error": e }).to_string())))
                    .unwrap());
            }
        }
    }

    // All routes below require a valid IMDSv2 token
    let token_header = match req
        .headers()
        .get("x-trybase-token")
        .and_then(|h| h.to_str().ok())
    {
        Some(t) => t,
        None => {
            warn!("Rejected unauthenticated request missing X-TryBase-Token header from PID: {}", peer.pid);
            return Ok(Response::builder()
                .status(StatusCode::UNAUTHORIZED)
                .header("Content-Type", "application/json")
                .body(Full::new(Bytes::from(
                    json!({ "error": "Missing mandatory X-TryBase-Token header. Perform PUT /latest/api/token first." }).to_string(),
                )))
                .unwrap());
        }
    };

    if let Err(err) = tokens.verify_token(token_header, peer.pid, peer.uid) {
        warn!("Token verification failed for PID {}: {}", peer.pid, err);
        return Ok(Response::builder()
            .status(StatusCode::FORBIDDEN)
            .header("Content-Type", "application/json")
            .body(Full::new(Bytes::from(json!({ "error": err }).to_string())))
            .unwrap());
    }

    // Route: GET /latest/secrets (Return all secrets as JSON)
    if method == Method::GET && path == "/latest/secrets" {
        let all = secrets.get_all();
        return Ok(Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", "application/json")
            .body(Full::new(Bytes::from(json!(all).to_string())))
            .unwrap());
    }

    // Route: GET /latest/secrets/<key>
    if method == Method::GET && path.starts_with("/latest/secrets/") {
        let key = &path["/latest/secrets/".len()..];
        if let Some(val) = secrets.get_secret(key) {
            return Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "text/plain")
                .body(Full::new(Bytes::from(val)))
                .unwrap());
        } else {
            return Ok(Response::builder()
                .status(StatusCode::NOT_FOUND)
                .header("Content-Type", "application/json")
                .body(Full::new(Bytes::from(
                    json!({ "error": format!("Secret '{}' not found", key) }).to_string(),
                )))
                .unwrap());
        }
    }

    // Route: GET /latest/database/token (Ephemeral 15-minute RDS IAM password)
    if method == Method::GET && path == "/latest/database/token" {
        match secrets.generate_db_token() {
            Ok(db_token) => {
                return Ok(Response::builder()
                    .status(StatusCode::OK)
                    .header("Content-Type", "application/json")
                    .body(Full::new(Bytes::from(json!(db_token).to_string())))
                    .unwrap());
            }
            Err(e) => {
                return Ok(Response::builder()
                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                    .header("Content-Type", "application/json")
                    .body(Full::new(Bytes::from(json!({ "error": e }).to_string())))
                    .unwrap());
            }
        }
    }

    // 404 Fallthrough
    Ok(Response::builder()
        .status(StatusCode::NOT_FOUND)
        .header("Content-Type", "application/json")
        .body(Full::new(Bytes::from(
            json!({ "error": "Endpoint not found" }).to_string(),
        )))
        .unwrap())
}
