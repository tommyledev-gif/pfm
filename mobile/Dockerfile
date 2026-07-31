# syntax=docker/dockerfile:1

FROM ghcr.io/cirruslabs/flutter:stable AS builder
WORKDIR /app

COPY pubspec.yaml ./
RUN flutter pub get

COPY . .
RUN dart run build_runner build --delete-conflicting-outputs

# Injected at build time from docker-compose.yml's build.args (sourced from
# the root .env) — never hardcoded, and baked in at build time since this is
# a static web bundle with no runtime env access once served by nginx.
ARG API_BASE_URL
RUN flutter build web --release --dart-define=API_BASE_URL=${API_BASE_URL}

FROM nginx:1.27-alpine
COPY --from=builder /app/build/web /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
