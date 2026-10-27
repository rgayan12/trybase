use hyper_util::rt::{TokioExecutor, TokioIo};
use hyper_util::server::conn::auto::Builder;
use hyper_util::service::TowerToHyperService;
use std::collections::HashMap;
use std::env;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::sync::Arc;
use tokio::net::UnixListener;
use tokio::signal;
use tracing::{error, info, warn};

use trybase_daemon::auth::TokenStore;
use trybase_daemon::handlers::handle_request;
use trybase_daemon::peer::PeerIdentity;
use trybase_daemon::secrets::{DatabaseConfig, SecretStore};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize structured logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,trybase_daemon=debug".into()),
        )
        .init();

    info!("Starting TryBase Anti-Leak Secret Daemon v0.1.0...");

    let socket_path = env::var("TRYBASE_SOCKET_PATH")
        .unwrap_or_else(|_| "/var/run/trybase/secrets.sock".to_string());
    let tenant_id = env::var("TRYBASE_TENANT_ID").unwrap_or_else(|_| "default-tenant".to_string());
    let allowed_binary = env::var("TRYBASE_ALLOWED_BINARY").ok();

    // Ensure socket parent directory exists
    let socket_path_obj = Path::new(&socket_path);
    if let Some(parent) = socket_path_obj.parent() {
        fs::create_dir_all(parent)?;
    }

    // Clean up stale socket file if it exists
    if socket_path_obj.exists() {
        warn!("Removing stale socket file at: {}", socket_path);
        fs::remove_file(&socket_path)?;
    }

    // Bind Unix domain socket
    let listener = UnixListener::bind(&socket_path)?;
    info!("Unix Domain Socket bound to: {}", socket_path);

    // Set file permissions: 0666 (rw-rw-rw-) so all task containers can connect
    let permissions = fs::Permissions::from_mode(0o666);
    fs::set_permissions(&socket_path, permissions)?;
    info!("Socket permissions set to 0666");

    // Initialize stores
    let token_store = TokenStore::new();
    let secret_store = SecretStore::new(&tenant_id);

    // Bootstrap initial secrets (e.g. from container payload or environment during boot)
    let mut initial_secrets = HashMap::new();
    for (k, v) in env::vars() {
        if k.starts_with("APP_") || k.starts_with("SECRET_") || k.starts_with("STRIPE_") || k.starts_with("OPENAI_") || k.starts_with("DB_") {
            initial_secrets.insert(k, v);
        }
    }

    // Configure database
    let db_host = env::var("DB_HOST").unwrap_or_else(|_| "localhost".to_string());
    let db_port = env::var("DB_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(5432);
    let db_user = env::var("DB_USER").unwrap_or_else(|_| format!("user_{}", tenant_id));
    let db_name = env::var("DB_NAME").unwrap_or_else(|_| format!("schema_{}", tenant_id));
    let aws_region = env::var("AWS_REGION").unwrap_or_else(|_| "eu-west-2".to_string());

    secret_store.set_database_config(DatabaseConfig {
        host: db_host,
        port: db_port,
        user: db_user,
        database: db_name,
        region: aws_region,
    });

    secret_store.load_secrets(initial_secrets);

    let allowed_binary_clone = allowed_binary.clone();
    let token_store_clone = token_store.clone();
    let secret_store_clone = secret_store.clone();
    let socket_cleanup_path = socket_path.clone();

    // Spawn server accept loop
    tokio::spawn(async move {
        loop {
            match listener.accept().await {
                Ok((stream, _)) => {
                    // 1. KERNEL SECURITY GATE: SO_PEERCRED & /proc/<pid>/exe
                    let peer = match PeerIdentity::from_socket(&stream) {
                        Ok(p) => p,
                        Err(e) => {
                            error!("Kernel credential inspection failed: {}", e);
                            continue;
                        }
                    };

                    // 2. BINARY AUTHORIZATION GATE
                    if let Err(alert) = peer.is_authorized(allowed_binary_clone.as_deref()) {
                        warn!("Dropping unauthorized connection: {}", alert);
                        drop(stream);
                        continue;
                    }

                    info!(
                        "Authorized connection from PID: {} (UID: {}, Binary: {:?})",
                        peer.pid, peer.uid, peer.binary_path
                    );

                    let tokens = token_store_clone.clone();
                    let secrets = secret_store_clone.clone();
                    let io = TokioIo::new(stream);

                    tokio::spawn(async move {
                        let service = hyper::service::service_fn(move |req| {
                            let p = peer.clone();
                            let t = tokens.clone();
                            let s = secrets.clone();
                            async move { handle_request(req, p, t, s).await }
                        });

                        let builder = Builder::new(TokioExecutor::new());
                        if let Err(err) = builder.serve_connection(io, service).await {
                            error!("Error serving UDS connection: {:?}", err);
                        }
                    });
                }
                Err(e) => {
                    error!("Socket accept error: {}", e);
                    break;
                }
            }
        }
    });

    info!("TryBase Anti-Leak Daemon ready. Listening for requests.");

    // Wait for termination signal
    match signal::ctrl_c().await {
        Ok(()) => {
            info!("Received shutdown signal. Cleaning up...");
        }
        Err(err) => {
            error!("Unable to listen for shutdown signal: {}", err);
        }
    }

    // Cleanup socket file on exit
    if Path::new(&socket_cleanup_path).exists() {
        let _ = fs::remove_file(&socket_cleanup_path);
        info!("Removed socket file: {}", socket_cleanup_path);
    }

    info!("TryBase Daemon shutdown complete.");
    Ok(())
}
