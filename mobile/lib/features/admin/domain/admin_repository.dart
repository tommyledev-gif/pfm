import 'admin_models.dart';

abstract class AdminRepository {
  Future<void> inviteUser({required String email, String? role});

  Future<AdminUserPage> listUsers({
    String? status,
    String? role,
    String? cursor,
    required int limit,
  });
}
