# syntax=docker/dockerfile:1

FROM golang:1.23-alpine AS builder
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/server ./cmd/server
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/seed ./cmd/seed

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
WORKDIR /app
COPY --from=builder /out/server ./server
COPY --from=builder /out/seed ./seed

EXPOSE 8080
ENTRYPOINT ["./server"]
