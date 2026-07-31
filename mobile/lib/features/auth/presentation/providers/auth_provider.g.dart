// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(authRepository)
final authRepositoryProvider = AuthRepositoryProvider._();

final class AuthRepositoryProvider
    extends $FunctionalProvider<AuthRepository, AuthRepository, AuthRepository>
    with $Provider<AuthRepository> {
  AuthRepositoryProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'authRepositoryProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$authRepositoryHash();

  @$internal
  @override
  $ProviderElement<AuthRepository> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  AuthRepository create(Ref ref) {
    return authRepository(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(AuthRepository value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<AuthRepository>(value),
    );
  }
}

String _$authRepositoryHash() => r'fc021aab01737ca82c8905795be8403ff647facb';

/// Holds the current session (null = logged out). Built once at app start
/// from whatever access token is already in secure storage; login/activate
/// replace it, logout/forceLogout clear it.

@ProviderFor(AuthNotifier)
final authProvider = AuthNotifierProvider._();

/// Holds the current session (null = logged out). Built once at app start
/// from whatever access token is already in secure storage; login/activate
/// replace it, logout/forceLogout clear it.
final class AuthNotifierProvider
    extends $AsyncNotifierProvider<AuthNotifier, UserSession?> {
  /// Holds the current session (null = logged out). Built once at app start
  /// from whatever access token is already in secure storage; login/activate
  /// replace it, logout/forceLogout clear it.
  AuthNotifierProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'authProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$authNotifierHash();

  @$internal
  @override
  AuthNotifier create() => AuthNotifier();
}

String _$authNotifierHash() => r'b1c379b1c05b7f54285a9c5aa9058e8877b9b440';

/// Holds the current session (null = logged out). Built once at app start
/// from whatever access token is already in secure storage; login/activate
/// replace it, logout/forceLogout clear it.

abstract class _$AuthNotifier extends $AsyncNotifier<UserSession?> {
  FutureOr<UserSession?> build();
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<AsyncValue<UserSession?>, UserSession?>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AsyncValue<UserSession?>, UserSession?>,
              AsyncValue<UserSession?>,
              Object?,
              Object?
            >;
    element.handleCreate(ref, build);
  }
}
