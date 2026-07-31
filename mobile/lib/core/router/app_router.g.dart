// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_router.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// Guard: unauthenticated -> /login, authenticated hitting /login|/activate
/// -> their landing page, non-admin hitting /admin/users -> /. Rebuilds
/// whenever [authProvider] changes (login/logout/session-expiry).

@ProviderFor(appRouter)
final appRouterProvider = AppRouterProvider._();

/// Guard: unauthenticated -> /login, authenticated hitting /login|/activate
/// -> their landing page, non-admin hitting /admin/users -> /. Rebuilds
/// whenever [authProvider] changes (login/logout/session-expiry).

final class AppRouterProvider
    extends $FunctionalProvider<GoRouter, GoRouter, GoRouter>
    with $Provider<GoRouter> {
  /// Guard: unauthenticated -> /login, authenticated hitting /login|/activate
  /// -> their landing page, non-admin hitting /admin/users -> /. Rebuilds
  /// whenever [authProvider] changes (login/logout/session-expiry).
  AppRouterProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'appRouterProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$appRouterHash();

  @$internal
  @override
  $ProviderElement<GoRouter> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  GoRouter create(Ref ref) {
    return appRouter(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(GoRouter value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<GoRouter>(value),
    );
  }
}

String _$appRouterHash() => r'0aab740e43b9c733603c5d91a9755ed4901df9e9';
