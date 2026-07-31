// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(adminRepository)
final adminRepositoryProvider = AdminRepositoryProvider._();

final class AdminRepositoryProvider
    extends
        $FunctionalProvider<AdminRepository, AdminRepository, AdminRepository>
    with $Provider<AdminRepository> {
  AdminRepositoryProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'adminRepositoryProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$adminRepositoryHash();

  @$internal
  @override
  $ProviderElement<AdminRepository> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  AdminRepository create(Ref ref) {
    return adminRepository(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(AdminRepository value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<AdminRepository>(value),
    );
  }
}

String _$adminRepositoryHash() => r'9e1326011d3b250cd1b01322ce194c4a5ce053a2';

/// Owns the admin user list (F-01 US-03) plus the invite action (US-01).
/// One provider per concern, matching CLAUDE.md's Riverpod convention —
/// invite mutates then reloads the first page rather than hand-patching
/// local state, so pagination/total always reflect the server.

@ProviderFor(AdminUsersNotifier)
final adminUsersProvider = AdminUsersNotifierProvider._();

/// Owns the admin user list (F-01 US-03) plus the invite action (US-01).
/// One provider per concern, matching CLAUDE.md's Riverpod convention —
/// invite mutates then reloads the first page rather than hand-patching
/// local state, so pagination/total always reflect the server.
final class AdminUsersNotifierProvider
    extends $AsyncNotifierProvider<AdminUsersNotifier, AdminUsersState> {
  /// Owns the admin user list (F-01 US-03) plus the invite action (US-01).
  /// One provider per concern, matching CLAUDE.md's Riverpod convention —
  /// invite mutates then reloads the first page rather than hand-patching
  /// local state, so pagination/total always reflect the server.
  AdminUsersNotifierProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'adminUsersProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$adminUsersNotifierHash();

  @$internal
  @override
  AdminUsersNotifier create() => AdminUsersNotifier();
}

String _$adminUsersNotifierHash() =>
    r'56119e4ef7a65d00584c84f51b94535e15394c74';

/// Owns the admin user list (F-01 US-03) plus the invite action (US-01).
/// One provider per concern, matching CLAUDE.md's Riverpod convention —
/// invite mutates then reloads the first page rather than hand-patching
/// local state, so pagination/total always reflect the server.

abstract class _$AdminUsersNotifier extends $AsyncNotifier<AdminUsersState> {
  FutureOr<AdminUsersState> build();
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<AsyncValue<AdminUsersState>, AdminUsersState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AsyncValue<AdminUsersState>, AdminUsersState>,
              AsyncValue<AdminUsersState>,
              Object?,
              Object?
            >;
    element.handleCreate(ref, build);
  }
}
