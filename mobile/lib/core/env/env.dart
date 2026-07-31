/// Compile-time configuration. Set via `--dart-define=API_BASE_URL=...` at
/// build time (see mobile/Dockerfile) — never hardcoded, never checked in
/// with a real value baked in the source.
class Env {
  const Env._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:8090/api/v1',
  );
}
