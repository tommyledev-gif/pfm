import 'dart:async';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../../core/api/api_providers.dart';
import '../../../../core/api/session_events.dart';
import '../../../../core/common/jwt_decoder.dart';
import '../../data/auth_repository_impl.dart';
import '../../domain/auth_models.dart';
import '../../domain/auth_repository.dart';

part 'auth_provider.g.dart';

@Riverpod(keepAlive: true)
AuthRepository authRepository(Ref ref) {
  return AuthRepositoryImpl(ref.watch(authApiProvider));
}

/// Holds the current session (null = logged out). Built once at app start
/// from whatever access token is already in secure storage; login/activate
/// replace it, logout/forceLogout clear it.
@Riverpod(keepAlive: true)
class AuthNotifier extends _$AuthNotifier {
  StreamSubscription<void>? _sessionExpiredSub;

  @override
  FutureOr<UserSession?> build() async {
    _sessionExpiredSub?.cancel();
    _sessionExpiredSub = sessionEventsListen(forceLogout);
    ref.onDispose(() => _sessionExpiredSub?.cancel());

    final storage = ref.watch(secureStorageServiceProvider);
    final token = await storage.readAccessToken();
    if (token == null) return null;
    return _sessionFromToken(token);
  }

  Future<void> login({required String email, required String password}) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final tokens = await ref.read(authRepositoryProvider).login(
            email: email,
            password: password,
          );
      await ref.read(secureStorageServiceProvider).saveTokens(
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
          );
      return _sessionFromToken(tokens.accessToken);
    });
  }

  Future<void> activate({
    required String token,
    String? fullName,
    required String password,
    required String passwordConfirm,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final tokens = await ref.read(authRepositoryProvider).activate(
            token: token,
            fullName: fullName,
            password: password,
            passwordConfirm: passwordConfirm,
          );
      await ref.read(secureStorageServiceProvider).saveTokens(
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
          );
      return _sessionFromToken(tokens.accessToken);
    });
  }

  Future<void> logout() async {
    final storage = ref.read(secureStorageServiceProvider);
    final refreshToken = await storage.readRefreshToken();
    try {
      if (refreshToken != null) {
        await ref.read(authRepositoryProvider).logout(refreshToken);
      }
    } finally {
      await storage.clear();
      state = const AsyncData(null);
    }
  }

  /// Fired on 401 (token expired/revoked). Storage is already cleared by
  /// the dio interceptor; this resets in-memory state so the router redirects.
  void forceLogout() {
    state = const AsyncData(null);
  }

  UserSession _sessionFromToken(String accessToken) {
    final claims = JwtDecoder.decodePayload(accessToken);
    return UserSession(
      userId: claims['user_id'] as String,
      role: claims['role'] as String,
    );
  }
}

StreamSubscription<void> sessionEventsListen(void Function() onEvent) {
  return sessionExpiredController.stream.listen((_) => onEvent());
}
