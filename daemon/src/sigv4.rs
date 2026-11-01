use chrono::Utc;
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::env;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::timeout;
use tracing::{debug, info};

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Clone)]
pub struct AwsCredentials {
    pub access_key_id: String,
    pub secret_access_key: String,
    pub session_token: Option<String>,
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC supports any key size");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

/// Resolves AWS credentials either from environment variables or from the
/// ECS task link-local metadata agent (http://169.254.170.2).
pub async fn resolve_aws_credentials() -> Result<AwsCredentials, String> {
    // 1. Check standard environment variables first
    if let (Ok(ak), Ok(sk)) = (
        env::var("AWS_ACCESS_KEY_ID"),
        env::var("AWS_SECRET_ACCESS_KEY"),
    ) {
        if !ak.is_empty() && !sk.is_empty() {
            let session_token = env::var("AWS_SESSION_TOKEN").ok().filter(|s| !s.is_empty());
            debug!("Resolved AWS credentials from process environment");
            return Ok(AwsCredentials {
                access_key_id: ak,
                secret_access_key: sk,
                session_token,
            });
        }
    }

    // 2. Query AWS ECS task metadata agent (169.254.170.2)
    let relative_uri = env::var("AWS_CONTAINER_CREDENTIALS_RELATIVE_URI").ok();
    let full_uri = env::var("AWS_CONTAINER_CREDENTIALS_FULL_URI").ok();

    let (host, port, path): (String, u16, String) = if let Some(rel) = relative_uri {
        ("169.254.170.2".to_string(), 80, rel)
    } else if let Some(full) = full_uri {
        // Parse host, port, path from full URI if provided
        if full.starts_with("http://") {
            let without_proto = &full[7..];
            let mut parts = without_proto.splitn(2, '/');
            let host_port = parts.next().unwrap_or("169.254.170.2");
            let path_part = format!("/{}", parts.next().unwrap_or(""));
            let mut hp_parts = host_port.splitn(2, ':');
            let h = hp_parts.next().unwrap_or("169.254.170.2").to_string();
            let p = hp_parts.next().and_then(|s| s.parse::<u16>().ok()).unwrap_or(80);
            (h, p, path_part)
        } else {
            ("169.254.170.2".to_string(), 80, full)
        }
    } else {
        return Err("No AWS credentials found in environment (AWS_ACCESS_KEY_ID) or ECS metadata (AWS_CONTAINER_CREDENTIALS_RELATIVE_URI)".to_string());
    };

    info!("Querying ECS link-local metadata endpoint at {}:{}{}", host, port, path);

    let connect_future = TcpStream::connect(format!("{}:{}", host, port));
    let mut stream = match timeout(Duration::from_secs(2), connect_future).await {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => return Err(format!("Failed to connect to ECS metadata agent: {}", e)),
        Err(_) => return Err("Timed out connecting to ECS metadata agent (169.254.170.2)".to_string()),
    };

    let request = format!(
        "GET {} HTTP/1.1\r\nHost: {}\r\nAccept: application/json\r\nConnection: close\r\n\r\n",
        path, host
    );

    stream.write_all(request.as_bytes()).await.map_err(|e| format!("Write failed: {}", e))?;

    let mut response_bytes = Vec::new();
    stream.read_to_end(&mut response_bytes).await.map_err(|e| format!("Read failed: {}", e))?;

    let response_str = String::from_utf8_lossy(&response_bytes);
    let body = match response_str.split("\r\n\r\n").nth(1) {
        Some(b) => b,
        None => return Err("Malformed HTTP response from ECS metadata service".to_string()),
    };

    let json: serde_json::Value = serde_json::from_str(body.trim())
        .map_err(|e| format!("Failed to parse metadata JSON: {} (raw body: {})", e, body))?;

    let access_key = json.get("AccessKeyId")
        .and_then(|v| v.as_str())
        .ok_or("Missing AccessKeyId in metadata response")?;
    let secret_key = json.get("SecretAccessKey")
        .and_then(|v| v.as_str())
        .ok_or("Missing SecretAccessKey in metadata response")?;
    let session_token = json.get("Token")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    info!("Successfully minted ephemeral STS credentials from ECS task role (AccessKeyId: {}...)", &access_key[..6.min(access_key.len())]);

    Ok(AwsCredentials {
        access_key_id: access_key.to_string(),
        secret_access_key: secret_key.to_string(),
        session_token,
    })
}

/// Computes an AWS Signature Version 4 presigned authentication token for RDS PostgreSQL.
///
/// Output format (without scheme):
/// `<db_host>:<db_port>/?Action=connect&DBUser=<user>&X-Amz-Algorithm=AWS4-HMAC-SHA256&...&X-Amz-Signature=<sig>`
pub fn generate_rds_iam_token(
    db_host: &str,
    db_port: u16,
    db_user: &str,
    region: &str,
    creds: &AwsCredentials,
) -> Result<String, String> {
    let now = Utc::now();
    let date_time = now.format("%Y%m%dT%H%M%SZ").to_string();
    let date_stamp = now.format("%Y%m%d").to_string();

    let credential_scope = format!("{}/{}/rds-db/aws4_request", date_stamp, region);

    // Collect query parameters in BTreeMap to guarantee alphabetical canonical sorting
    let mut query_params = BTreeMap::new();
    query_params.insert("Action".to_string(), "connect".to_string());
    query_params.insert("DBUser".to_string(), urlencoding::encode(db_user).to_string());
    query_params.insert("X-Amz-Algorithm".to_string(), "AWS4-HMAC-SHA256".to_string());
    query_params.insert(
        "X-Amz-Credential".to_string(),
        urlencoding::encode(&format!("{}/{}", creds.access_key_id, credential_scope)).to_string(),
    );
    query_params.insert("X-Amz-Date".to_string(), date_time.clone());
    query_params.insert("X-Amz-Expires".to_string(), "900".to_string()); // 15 minutes TTL

    if let Some(ref token) = creds.session_token {
        query_params.insert("X-Amz-Security-Token".to_string(), urlencoding::encode(token).to_string());
    }

    query_params.insert("X-Amz-SignedHeaders".to_string(), "host".to_string());

    // Construct Canonical Query String
    let canonical_query_string = query_params
        .iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join("&");

    // Canonical Headers
    let canonical_headers = format!("host:{}:{}\n", db_host, db_port);
    let signed_headers = "host";

    // Payload Hash (SHA-256 of empty string for GET request)
    let payload_hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

    // Canonical Request
    let canonical_request = format!(
        "GET\n/\n{}\n{}\n{}\n{}",
        canonical_query_string, canonical_headers, signed_headers, payload_hash
    );

    let hashed_canonical_request = hex::encode(Sha256::digest(canonical_request.as_bytes()));

    // String to Sign
    let string_to_sign = format!(
        "AWS4-HMAC-SHA256\n{}\n{}\n{}",
        date_time, credential_scope, hashed_canonical_request
    );

    // Derive Signing Key
    let k_secret = format!("AWS4{}", creds.secret_access_key);
    let k_date = hmac_sha256(k_secret.as_bytes(), date_stamp.as_bytes());
    let k_region = hmac_sha256(&k_date, region.as_bytes());
    let k_service = hmac_sha256(&k_region, b"rds-db");
    let k_signing = hmac_sha256(&k_service, b"aws4_request");

    // Calculate Signature
    let signature = hex::encode(hmac_sha256(&k_signing, string_to_sign.as_bytes()));

    // Construct final token for PostgreSQL authentication
    let token = format!(
        "{}:{}?{}&X-Amz-Signature={}",
        db_host, db_port, canonical_query_string, signature
    );

    debug!("Generated valid AWS SigV4 RDS IAM token (length: {} bytes)", token.len());

    Ok(token)
}
