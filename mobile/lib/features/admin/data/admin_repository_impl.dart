import 'package:dio/dio.dart';

import '../../../core/api/admin_api.dart';
import '../../../core/common/api_exception.dart';
import '../domain/admin_models.dart';
import '../domain/admin_repository.dart';

class AdminRepositoryImpl implements AdminRepository {
  AdminRepositoryImpl(this._api);

  final AdminApi _api;

  @override
  Future<void> inviteUser({required String email, String? role}) async {
    try {
      await _api.inviteUser({
        'email': email,
        if (role != null) 'role': role,
      });
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  @override
  Future<AdminUserPage> listUsers({
    String? status,
    String? role,
    String? cursor,
    required int limit,
  }) async {
    try {
      final response = await _api.listUsers({
        if (status != null) 'status': status,
        if (role != null) 'role': role,
        if (cursor != null) 'cursor': cursor,
        'limit': limit,
      });
      final envelope = response.data as Map<String, dynamic>;
      final data = envelope['data'] as Map<String, dynamic>;
      final items = (data['data'] as List<dynamic>)
          .map((e) => AdminUser.fromJson(e as Map<String, dynamic>))
          .toList();
      final pagination = data['pagination'] as Map<String, dynamic>;
      return AdminUserPage(
        items: items,
        nextCursor: pagination['next_cursor'] as String?,
        total: pagination['total'] as int,
      );
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}
