import 'auth_models.dart';

abstract class AuthRepository {
  Future<TokenPair> login({required String email, required String password});

  Future<TokenPair> activate({
    required String token,
    String? fullName,
    required String password,
    required String passwordConfirm,
  });

  Future<void> logout(String refreshToken);
}
