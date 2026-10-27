use hyper_util::rt::TokioIo;
use serde_json::Value;
use std::env;
use std::os::unix::process::CommandExt;
use std::path::Path;
use std::process::Command;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::UnixStream;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().skip(1).collect();
    if args.is_empty() {
        eprintln!("Usage: trybase-entrypoint <command> [args...]");
        std::process::exit(1);
    }

    let socket_path = env::var("TRYBASE_SOCKET_PATH")
        .unwrap_or_else(|_| "/var/run/trybase/secrets.sock".to_string());

    println!("🔒 [trybase-entrypoint] Bootstrapping zero-secret container runtime...");

    // Wait up to 5 seconds for daemon socket to become ready
    let mut stream = None;
    for _ in 0..50 {
        if Path::new(&socket_path).exists() {
            if let Ok(s) = UnixStream::connect(&socket_path).await {
                stream = Some(s);
                break;
            }
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }

    let mut stream = match stream {
        Some(s) => s,
        None => {
            eprintln!("⚠️ [trybase-entrypoint] Could not connect to socket {}. Proceeding with native environment.", socket_path);
            let err = Command::new(&args[0]).args(&args[1..]).exec();
            eprintln!("Failed to exec {}: {:?}", args[0], err);
            std::process::exit(1);
        }
    };

    // 1. IMDSv2 Handshake: PUT /latest/api/token
    let token_req = "PUT /latest/api/token HTTP/1.1\r\nHost: localhost\r\nX-TryBase-Token-TTL-Seconds: 30\r\nConnection: close\r\n\r\n";
    stream.write_all(token_req.as_bytes()).await?;

    let mut resp = Vec::new();
    stream.read_to_end(&mut resp).await?;
    let resp_str = String::from_utf8_lossy(&resp);

    // Extract token from HTTP response body
    let token = match resp_str.split("\r\n\r\n").nth(1) {
        Some(t) => t.trim().to_string(),
        None => {
            eprintln!("❌ [trybase-entrypoint] Failed to obtain IMDSv2 token from TryBase daemon.");
            std::process::exit(1);
        }
    };

    // 2. Fetch Secrets: GET /latest/secrets
    let mut stream = UnixStream::connect(&socket_path).await?;
    let get_req = format!(
        "GET /latest/secrets HTTP/1.1\r\nHost: localhost\r\nX-TryBase-Token: {}\r\nConnection: close\r\n\r\n",
        token
    );
    stream.write_all(get_req.as_bytes()).await?;

    let mut secrets_resp = Vec::new();
    stream.read_to_end(&mut secrets_resp).await?;
    let secrets_str = String::from_utf8_lossy(&secrets_resp);

    let body = secrets_str.split("\r\n\r\n").nth(1).unwrap_or("{}");
    let secrets_map: Value = serde_json::from_str(body).unwrap_or(Value::Object(serde_json::Map::new()));

    // 3. Optionally fetch ephemeral 15-minute RDS database token
    let mut db_password_token = None;
    if let Ok(mut stream) = UnixStream::connect(&socket_path).await {
        let db_req = format!(
            "GET /latest/database/token HTTP/1.1\r\nHost: localhost\r\nX-TryBase-Token: {}\r\nConnection: close\r\n\r\n",
            token
        );
        let _ = stream.write_all(db_req.as_bytes()).await;
        let mut db_resp = Vec::new();
        if stream.read_to_end(&mut db_resp).await.is_ok() {
            let db_str = String::from_utf8_lossy(&db_resp);
            if let Some(db_body) = db_str.split("\r\n\r\n").nth(1) {
                if let Ok(val) = serde_json::from_str::<Value>(db_body) {
                    if let Some(t) = val.get("auth_token").and_then(|v| v.as_str()) {
                        db_password_token = Some(t.to_string());
                    }
                }
            }
        }
    }

    println!("✅ [trybase-entrypoint] Injected secrets into process memory. Launching application: {}", args.join(" "));

    // 4. Build process command with memory-only injected environment
    let mut cmd = Command::new(&args[0]);
    cmd.args(&args[1..]);

    if let Value::Object(map) = secrets_map {
        for (k, v) in map {
            if let Some(v_str) = v.as_str() {
                cmd.env(k, v_str);
            }
        }
    }

    if let Some(token) = db_password_token {
        cmd.env("DB_PASSWORD", token.clone());
        cmd.env("DATABASE_PASSWORD", token);
    }

    // Replace current process with application (execvp)
    let err = cmd.exec();
    eprintln!("Failed to exec application {}: {:?}", args[0], err);
    std::process::exit(1);
}
