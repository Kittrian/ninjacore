FROM rust:1.81-slim as builder

WORKDIR /build
COPY . .

RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates curl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/target/release/ninjacore /usr/local/bin/ninjacore

EXPOSE 8080
CMD ["ninjacore"]
