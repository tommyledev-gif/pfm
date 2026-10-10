# syntax=docker/dockerfile:1

FROM golang:1.26-alpine AS builder
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
# -trimpath drops build-machine paths from the binary; -s -w drops the symbol
# and DWARF tables (about a third smaller, no effect on behaviour).
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/seed ./cmd/seed
# db/migrations/*.sql are compiled into this binary via go:embed (see
# backend/db/migrations.go), so the image carries the exact schema the
# server binary expects — no volume mount, no synced host directory.
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
# Opt-in local trust store: certs/local-dev-ca/*.crt is gitignored, so this is
# empty for everyone except a developer who dropped a cert in there (e.g. a
# corporate/antivirus TLS-inspection root that intercepts outbound SMTP —
# smtp.gmail.com in particular). Never bake such a cert into a tracked file;
# it must stay opt-in per machine.
COPY certs/local-dev-ca/ /tmp/local-dev-ca/
RUN find /tmp/local-dev-ca -name '*.crt' -exec cp {} /usr/local/share/ca-certificates/ \; \
    && update-ca-certificates \
    && rm -rf /tmp/local-dev-ca
# Run as an unprivileged user: a bug in the API (or in a library it parses
# untrusted uploads with) must not hand an attacker root in the container.
# The process only listens on 8080 and writes nothing to disk, so it needs no
# privileges. cmd/migrate and cmd/seed run as the same user (deploy.sh).
RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app -H -s /sbin/nologin app
WORKDIR /app
COPY --from=builder --chown=app:app /out/server ./server
COPY --from=builder --chown=app:app /out/seed ./seed
COPY --from=builder --chown=app:app /out/migrate ./migrate
USER app

EXPOSE 8080
ENTRYPOINT ["./server"]
