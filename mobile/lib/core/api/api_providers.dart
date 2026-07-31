import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../storage/secure_storage_service.dart';
import 'admin_api.dart';
import 'auth_api.dart';
import 'dio_client.dart';

part 'api_providers.g.dart';

@Riverpod(keepAlive: true)
SecureStorageService secureStorageService(Ref ref) {
  return SecureStorageService(const FlutterSecureStorage());
}

@Riverpod(keepAlive: true)
Dio dioClient(Ref ref) {
  return buildDioClient(ref.watch(secureStorageServiceProvider));
}

@Riverpod(keepAlive: true)
AuthApi authApi(Ref ref) {
  return AuthApi(ref.watch(dioClientProvider));
}

@Riverpod(keepAlive: true)
AdminApi adminApi(Ref ref) {
  return AdminApi(ref.watch(dioClientProvider));
}
