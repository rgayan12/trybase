# Multi-stage ultra-lean build for TryBase Anti-Leak Secret Daemon
# Produces a statically linked, stripped ~4MB binary with zero runtime dependencies.

# Stage 1: Build static binaries
FROM rust:1.85-alpine AS builder

RUN apk add --no-cache musl-dev libc-dev

WORKDIR /app
COPY Cargo.toml ./
COPY src ./src

# Build release binaries with LTO and symbols stripped
RUN cargo build --release

# Stage 2: Minimal runner runtime
FROM alpine:3.20 AS runner

# Create dedicated non-root user and socket directory
RUN addgroup -g 10001 trybase && \
    adduser -D -u 10001 -G trybase trybase && \
    mkdir -p /var/run/trybase && \
    chown -R trybase:trybase /var/run/trybase && \
    chmod 777 /var/run/trybase

# Copy stripped binaries from builder
COPY --from=builder /app/target/release/trybase-daemon /usr/local/bin/trybase-daemon
COPY --from=builder /app/target/release/trybase-entrypoint /usr/local/bin/trybase-entrypoint

USER trybase
WORKDIR /var/run/trybase

EXPOSE 0

ENTRYPOINT ["/usr/local/bin/trybase-daemon"]
