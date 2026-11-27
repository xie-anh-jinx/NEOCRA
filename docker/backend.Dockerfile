FROM rust:bookworm AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
COPY migrations ./migrations
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/neocra-backend /app/neocra-backend
COPY --from=builder /app/migrations /app/migrations
EXPOSE 8080
CMD ["/app/neocra-backend"]
