import 'package:dio/dio.dart';

import '../../../core/api/auth_api.dart';
import '../../../core/common/api_exception.dart';
import '../domain/auth_models.dart';
import '../domain/auth_repository.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl(this._api);

  final AuthApi _api;

  @override
  Future<TokenPair> login({required String email, required String password}) async {
    try {
      final response = await _api.login({'email': email, 'password': password});
      return _tokenPairFrom(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  @override
  Future<TokenPair> activate({
    required String token,
    String? fullName,
    required String password,
    required String passwordConfirm,
  }) async {
    try {
      final response = await _api.activate({
        'token': token,
        if (fullName != null && fullName.isNotEmpty) 'full_name': fullName,
        'password': password,
        'password_confirm': passwordConfirm,
      });
      return _tokenPairFrom(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  @override
  Future<void> logout(String refreshToken) async {
    try {
      await _api.logout({'refresh_token': refreshToken});
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  TokenPair _tokenPairFrom(Map<String, dynamic> envelope) {
    final data = envelope['data'] as Map<String, dynamic>;
    return TokenPair(
      accessToken: data['access_token'] as String,
      refreshToken: data['refresh_token'] as String,
    );
  }
}
