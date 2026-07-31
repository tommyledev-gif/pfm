import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Single wrapper around flutter_secure_storage — widgets and repositories
/// never touch FlutterSecureStorage directly (CLAUDE.md convention).
class SecureStorageService {
  SecureStorageService(this._storage);

  final FlutterSecureStorage _storage;

  static const _accessTokenKey = 'pfm_access_token';
  static const _refreshTokenKey = 'pfm_refresh_token';

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _refreshTokenKey, value: refreshToken);
  }

  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);

  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);

  Future<void> clear() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }
}
