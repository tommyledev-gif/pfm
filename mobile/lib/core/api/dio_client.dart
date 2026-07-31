import 'package:dio/dio.dart';

import '../env/env.dart';
import '../storage/secure_storage_service.dart';
import 'session_events.dart';

/// Shared Dio instance: attaches the stored access token per request and
/// reports 401s via [sessionExpiredController] — no `/auth/refresh` endpoint
/// yet, so an expired token forces a re-login, not a silent refresh.
Dio buildDioClient(SecureStorageService storage) {
  final dio = Dio(BaseOptions(baseUrl: Env.apiBaseUrl));

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await storage.readAccessToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        final hadAuthHeader =
            error.requestOptions.headers.containsKey('Authorization');
        if (hadAuthHeader && error.response?.statusCode == 401) {
          await storage.clear();
          sessionExpiredController.add(null);
        }
        handler.next(error);
      },
    ),
  );

  return dio;
}
